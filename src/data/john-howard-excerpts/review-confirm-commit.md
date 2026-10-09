# Segment 4 — Three-Phase Review → Confirm → Commit

**Source:** `src/JHS.Transfer/ProgramData/ProgramDataImportReviewService.cs`
**Purpose:** make an irreversible bulk-data import impossible to perform casually or
partially.

---

## Three phases, three different authorization capabilities

| Phase | Capability | Writes durable data? |
|---|---|---|
| Review | `ReviewProgramDataPackages` | **No** |
| Confirm | `ReviewProgramDataPackages` | **No** |
| Commit | `CommitProgramDataImports` | **Yes** |

An actor who can determine whether a package is valid **cannot** commit it. These are
separate capabilities granted separately by role.

---

## Commit requires prior confirmation

```csharp
public async Task<ProgramDataImportCommitStatus> CommitConfirmedReviewAsync(
    Guid reviewToken,
    CancellationToken cancellationToken = default)
{
    // Different capability from review — cannot be short-circuited.
    if (!await IsAuthorizedAsync(
            AccessCapability.CommitProgramDataImports, cancellationToken))
    {
        return ProgramDataImportCommitStatus.AccessDenied;
    }

    PendingReview? pending;
    lock (_stateGate)
    {
        pending = _pendingReview;
        if (reviewToken == Guid.Empty ||
            pending is null ||
            pending.Review.ReviewToken != reviewToken)
        {
            return ProgramDataImportCommitStatus.ReviewNotAvailable;
        }

        if (!pending.IsConfirmed)
        {
            return ProgramDataImportCommitStatus.ReviewNotConfirmed;   // cannot skip confirm
        }
    }
    // … commit …
}
```

The confirmation is re-verified **inside the commit path**, not merely required of the
UI. A view-model bug cannot bypass it.

---

## The generation counter prevents a slow review from winning

```csharp
private int BeginReview()
{
    int generation = Interlocked.Increment(ref _generation);
    lock (_stateGate)
    {
        _pendingReview = null;      // any new review supersedes the previous one
    }

    return generation;
}
```

…and the async completion re-checks it:

```csharp
private async Task<ProgramDataImportReviewResult> CompleteReviewAsync(
    ProgramDataImportReview review,
    bool alreadyStaged,
    int generation,
    CancellationToken cancellationToken)
{
    await _securitySession.RecordActivityAsync(/* … */);

    lock (_stateGate)
    {
        if (generation != Volatile.Read(ref _generation))
        {
            // A newer review started while this one was awaiting.
            return ProgramDataImportReviewResult.Rejected(
                ProgramDataImportReviewFailure.ReviewSuperseded);
        }

        _pendingReview = new PendingReview(review);
    }

    return ProgramDataImportReviewResult.Ready(review, alreadyStaged);
}
```

Without this, a slow review could overwrite a newer one — the operator would confirm the
package they were actually looking at, but a different one would be committed. **The
same class of bug as the session epoch in Segment 1, applied to review state.**

---

## Failures are named states, not exceptions

```csharp
private static ProgramDataImportReviewFailure MapFailure(
    TransferPackageFailureCode failureCode) => failureCode switch
{
    TransferPackageFailureCode.MalformedEnvelope
        or TransferPackageFailureCode.MalformedSignedContent
        or TransferPackageFailureCode.NonCanonicalSignedContent
            => ProgramDataImportReviewFailure.MalformedPackage,

    TransferPackageFailureCode.InvalidSender
        or TransferPackageFailureCode.UnknownSigningKey
        or TransferPackageFailureCode.PendingSigningKey
        or TransferPackageFailureCode.RevokedSigningKey
            => ProgramDataImportReviewFailure.UntrustedSender,

    TransferPackageFailureCode.WrongRecipient
        => ProgramDataImportReviewFailure.WrongRecipient,
    // … ~20 codes mapped in total …
};
```

Protocol internals are translated once, at the boundary, into presentation-safe reasons.
The UI never sees `TransferPackageFailureCode` and never has to interpret it.

This also means **every rejection is a distinct, testable value** rather than a generic
failure — which is why the negative-path tests can assert precise outcomes.

---

## Explicit duplicate handling

```csharp
if (transferResult.Status == TransferPackageReadStatus.Duplicate)
{
    existing = await _store.FindStagedByPackageDigestAsync(packageDigest, cancellationToken);
    if (existing is null)
    {
        return ProgramDataImportReviewResult.Duplicate();
    }

    // Re-open the already-staged review instead of staging again.
    return await CompleteReviewAsync(existing, alreadyStaged: true, generation, cancellationToken);
}
```

Re-importing the same package is **idempotent** — it re-opens the existing review rather
than creating a second one. Combined with the store's `AlreadyCommitted` status, this is
what makes repeated returns safe.

---

## Presenter notes

- **The headline is the capability split**: you can review without being able to commit.
  That is authorization *design*, not authorization *checking*.
- **Confirmation is enforced at commit, not in the UI.** A view-model bug cannot skip it.
- **The generation counter is the interesting subtlety** — and it is recognisably the
  same pattern as the session epoch. Showing you applied one idea consistently across two
  unrelated problems is a strong signal.
- **Named failure states** make every rejection independently testable — connect this to
  the seven attack variants rejected in Segment 2.