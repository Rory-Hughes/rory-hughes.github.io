# Segment 1 — Session Epoch Pattern

**Source:** `src/JHS.Application/Security/SecuritySession.cs`
**Purpose:** prevent work that was authorized before a lock from completing into a
locked UI.

---

## The race being prevented

```csharp
if (IsAuthorized())              // valid at this instant
{
    await LoadSensitiveData();   // ← operator locks the app while suspended here
    DisplayResults();            // ← stale results now shown on a locked screen
}
```

An authorization check answers "was this permitted?" — not "is this *still* permitted?".
In an `async` method the answer can change between the check and the use.

---

## The mechanism

**Capture** the epoch at the start of the operation:

```csharp
public long SessionEpoch => Volatile.Read(ref _sessionEpoch);
```

**Pass** it back in when running the guarded work:

```csharp
public async Task<bool> TryRunExclusiveAsync(
    long expectedSessionEpoch,
    Func<Task> operation,
    CancellationToken cancellationToken = default)
{
    ArgumentNullException.ThrowIfNull(operation);

    await _gate.WaitAsync(cancellationToken);
    try
    {
        // Check 1 — before any work runs.
        if (_currentActor is null ||                                  // signed out
            SessionEpoch != expectedSessionEpoch ||                   // locked / new session
            Volatile.Read(ref _transitionPending) != 0)               // transition in flight
        {
            return false;
        }

        await operation().ConfigureAwait(false);

        // Check 2 — the same three conditions, re-read AFTER the awaits.
        return _currentActor is not null &&
            SessionEpoch == expectedSessionEpoch &&
            Volatile.Read(ref _transitionPending) == 0;
    }
    finally
    {
        _gate.Release();
    }
}
```

**Advance** the epoch on every lock, sign-out, and invalidation:

```csharp
private long AdvanceSessionEpoch()
{
    long current = Volatile.Read(ref _sessionEpoch);
    if (current == long.MaxValue)
    {
        // Fail closed: exhaustion must never silently reuse an epoch.
        throw new InvalidOperationException("The security-session epoch is exhausted.");
    }

    return Interlocked.Increment(ref _sessionEpoch);
}
```

---

## Why all three conditions

| Condition | Blocks |
|---|---|
| `_currentActor is null` | Work started by a session that has since signed out |
| `SessionEpoch != expected` | Work started before *any* lock/sign-out/invalidation |
| `_transitionPending != 0` | Work racing a transition that is still finishing |

`TryRunTransitionSerializedAsync` applies the identical triple check twice — once before
acquiring `_transitionGate`, once after — because a transition may start while waiting
for the gate.

---

## Applied to audit queries

A late-arriving audit result is discarded rather than displayed:

```csharp
private bool IsCurrentAuditQuery(long sessionEpoch, AuditEventQueryRequest request) =>
    SessionEpoch == sessionEpoch && EvaluateAuditQueryAuthorization(request, CurrentActor).IsGranted;

private AuditEventQueryResult StaleAuditQueryResult() => /* explicit stale result */;
```

The epoch appears **24 times** across the file — re-checked after each await wherever a
result could otherwise land in a now-locked UI.

---

## Presenter notes

- **Lead with the distinction:** a boolean says "was authorized"; an epoch says "was
  authorized *and nothing has changed since*", re-checked after every await.
- **This is a pattern, not a patch.** It applies to authorization, audit queries, and
  transitions uniformly.
- **Be candid about the limit.** The House shell's `FocusRecoverySurfaceIfNeeded`
  re-posts at `DispatcherPriority.Input` until the surface is visible, then calls
  `Keyboard.Focus` **once**. If another window activates and closes inside that nested
  frame, the one-shot call has already succeeded and is never re-posted. This is a known
  latent defect, recorded as such in the project context file.

> Naming the flaw in your own concurrency design is worth more than claiming it is
> flawless.