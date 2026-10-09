# Optional Segment 6 — Encrypted Storage & Single-Writer Audit

**Source:** `src/JHS.Infrastructure/Security/WindowsCurrentUserProtectedDocumentFile.cs`,
`src/JHS.Infrastructure/Storage/ProtectedSyntheticAuditEventStore.cs`

Include only if you have room. Two details are worth a mention each.

---

## DPAPI with per-write entropy and explicit zeroing

```csharp
public async Task SaveNewAsync(
    string path,
    ReadOnlyMemory<byte> plaintext,
    CancellationToken cancellationToken = default)
{
    byte[] plaintextCopy = plaintext.ToArray();
    byte[] entropy = RandomNumberGenerator.GetBytes(32);      // fresh per write
    byte[]? protectedPayload = null;
    try
    {
        protectedPayload = ProtectedData.Protect(
            plaintextCopy, entropy, DataProtectionScope.CurrentUser);

        // … write to a temp file with FileOptions.WriteThrough …
        File.Move(temporaryPath, fullPath, overwrite: false);  // atomic publish
    }
    finally
    {
        CryptographicOperations.ZeroMemory(plaintextCopy);
        CryptographicOperations.ZeroMemory(entropy);
        if (protectedPayload is not null)
        {
            CryptographicOperations.ZeroMemory(protectedPayload);
        }
    }
}
```

Three details worth naming out loud:

1. **32 bytes of fresh random entropy per write** — DPAPI is used with an additional
   secret, so the blob is useless to an attacker who obtains it without the process.
2. **Temp file then atomic move** — a crash mid-write cannot leave a truncated document.
3. **`WriteThrough`** — the bytes reach the device before the move is attempted.

---

## Single-writer lease

```csharp
try
{
    writerLease = new FileStream(
        path + ".writer.lock",
        FileMode.OpenOrCreate,
        FileAccess.ReadWrite,
        FileShare.None);                     // ← exclusive: one writer per installation
}
catch (IOException exception) when ((exception.HResult & 0xFFFF) is 32 or 33)
{
    throw new IOException(
        "The protected synthetic audit store already has an active writer.", exception);
}
```

Hresult 32/33 are sharing-violation and lock-violation — the precise signal that another
process holds the lease, distinguished from a genuine I/O fault. Released on dispose
under the same gate that serialises writes, and released in a `catch` if the subsequent
load fails, so a failed open never leaks the lease.

---

## Rollback so in-memory state never overstates what is on disk

```csharp
PrivacySafeAuditEvent[] previous = _events.ToArray();
_events.AddRange(batch);
if (_events.Count > MaximumEvents)
{
    _events.RemoveRange(0, _events.Count - MaximumEvents);
}

try
{
    await PersistAsync(batch.Length, cancellationToken);
}
catch
{
    _events.Clear();
    _events.AddRange(previous);      // in-memory view matches disk again
    throw;
}
```

**This is the interesting one.** Without the rollback, a failed persist leaves memory
showing events that were never written — the UI would display audit evidence that does not
exist on disk. In an audit system, that is a correctness bug with real consequences.

The size-limit handling in `PersistAsync` shows the same care: it drops the *oldest*
events to fit the byte budget, but refuses outright once it would have to discard events
from the batch just written:

```csharp
if (_events.Count <= protectedTrailingCount)
{
    throw new InvalidOperationException(
        "The protected synthetic audit document exceeded its size limit.");
}
_events.RemoveAt(0);
```

Newly-appended audit evidence is never silently dropped to make the write fit.

---

## Presenter notes

- **The rollback is the story.** "If persisting fails, memory goes back to matching disk —
  otherwise the UI would show audit evidence that doesn't exist." That is a one-sentence
  explanation of a subtle correctness property.
- **Mention entropy and atomic move briefly**, then move on. They are table stakes;
  the rollback is the differentiator.