# Segment 2 — End-to-End Trust Chain

**Source:** `tests/JHS.Infrastructure.Tests/CoreWorkflow1EndToEndTests.cs` (~990 lines)
**Purpose:** executable proof of the entire signed/encrypted offline exchange, starting
from genuinely empty stores.

**Verified:** 4 tests pass, ~8 seconds.

---

## Structure

| Test | What it proves |
|---|---|
| `BlankStores_CompleteAssignmentBoundAdminToHouseProvisioningAndRegistration` | The full happy path from empty |
| `PublicationAndAssignmentGuards_BlockInvalidAuthoredState` | Invalid authored state cannot publish |
| `ProvisioningGuards_RejectTamperingSubstitutionWrongHouseUnsupportedSchemaAndUnsignedActivation` | Seven attack variants rejected |
| `HouseRegistrationGuards_RejectAssignmentMismatchWithoutCreatingTrust` | Mismatch creates no trust |

---

## Runtime 1 — Assert genuinely blank, then author

Starting from empty is what makes this honest. A test cannot pass because of leftover
fixture state.

```csharp
using (EncryptedAdminProgramConfigurationStore blankAdmin =
       await EncryptedAdminProgramConfigurationStore.OpenOrCreateAsync(adminDirectory.Path))
{
    Assert.Empty(await blankAdmin.GetProgramsAsync(new ProgramPortfolioFilter()));
    Assert.Empty(await blankAdmin.GetDraftsAsync());
    Assert.Empty(await blankAdmin.GetHousesAsync(includeInactive: true));
    Assert.Empty(await blankAdmin.GetFieldDefinitionsAsync(includeIneligible: true));

    await blankAdmin.SaveHouseAsync(house);
    // … author a governed field definition and a program draft with a House assignment …
}
```

---

## Runtime 2 — Validate, preview, publish immutably

```csharp
var validator = new ProgramPublicationValidator(publishingAdmin, publishingAdmin);
ProgramPublicationValidationResult validation = await validator.ValidateAsync(reloadedDraft);
Assert.True(validation.CanPublish);
Assert.Empty(validation.Issues);

// Preview is non-mutating — it projects the form without writing.
ProgramFormProjection preview = ProgramFormProjector.Project(reloadedDraft);

var published = await publication.PublishAsync(new ProgramPublicationRequest(
    programId, programVersion, reloadedDraft.LastEditedAtUtc,
    "Initial Core Workflow 1 publication."));

PublishedProgramVersion immutableVersion = Assert.IsType<PublishedProgramVersion>(
    published.PublishedVersion);

// The assignment is bound to ONE House installation.
ProgramAssignment assignment = Assert.Single(published.Assignments);
Assert.Equal(houseInstallation.Id, assignment.RecipientInstallationId);

// The editable draft is gone; only the published version survives.
Assert.Null(await publishingAdmin.GetAsync(programId));
Assert.Equal(assignment, await publishingAdmin.GetAsync(assignmentId));
```

---

## Runtime 3 — Export public trust + assignment-specific package

```csharp
TransferSigningTrustArtifact trust = exporter.CreateSigningTrustArtifact();
Assert.Equal(mainInstallation.Id, trust.InstallationId);
Assert.Equal(64, trust.KeyId.Value.Length);        // 256-bit fingerprint

ProgramProvisioningExportResult export = await exporter.ExportAsync(assignmentId);
CreatedProgramProvisioningPackage package = Assert.IsType<CreatedProgramProvisioningPackage>(export.Package);

Assert.Equal(programId, package.Header.ProgramId);
Assert.Equal(programVersion, package.Header.ProgramVersion);
Assert.Equal(houseInstallation.Id, package.Header.RecipientInstallationId);

// Two SEPARATE files — public trust travels out-of-band from the payload.
await TransferSigningTrustFile.WriteNewAsync(trustPath, trust.ExportArtifactBytes());
await TransferPackageFile.WriteNewAsync(provisioningPath, package.ExportPackageBytes());
```

---

## Runtime 4 — House enrols the fingerprint explicitly

The security-critical human step. Trust is **not** established by the package arriving —
it is established by an operator comparing a fingerprint through a separate channel.

```csharp
ProtectedTransferSigningTrustStore blankTrustStore =
    await ProtectedTransferSigningTrustStore.OpenOrCreateAsync(houseDirectory.Path);
Assert.False(blankTrustStore.State.IsEnrolled);      // starts untrusted

var trustEnrollment = new SyntheticTransferTrustEnrollment(
    enrollmentSession, mainInstallation.Id, blankTrustStore);

TransferSigningTrustEnrollmentResult enrollment =
    await trustEnrollment.EnrollFileAsync(trustPath, mainSigningFingerprint.Value);

Assert.Equal(TransferSigningTrustEnrollmentStatus.Enrolled, enrollment.Status);
Assert.Equal(mainSigningFingerprint.Value, enrollment.State.Fingerprint);
```

The supplied fingerprint must match the key's **recomputed** fingerprint. The code cannot
accept "the file said so".

---

## Runtime 5 — Review before activation

Importing does not activate. The House inspects sender, recipient, program, and version
before anything is durable.

```csharp
using (EncryptedHouseProgramConfigurationStore blankHouse =
       await EncryptedHouseProgramConfigurationStore.OpenOrCreateAsync(houseDirectory.Path))
{
    Assert.Empty(await blankHouse.GetActivatedProgramsAsync());   // nothing yet

    var reader = new ProgramProvisioningPackageReader(
        houseInstallation.Id, reopenedTrust,
        new HouseProgramConfigurationReplayLedger(blankHouse));   // replay guard

    var import = new ProgramProvisioningImportReviewService(
        reader, houseSession, blankHouse,
        supportedHouseSchemaVersion: 1,
        new MutableTimeProvider(HouseOperationAtUtc));

    ProgramDataReviewResult result = await import.ReviewFileAsync(provisioningPath);
    Assert.Equal(ProgramProvisioningReviewStatus.ReadyForReview, result.Status);
    Assert.Equal(mainInstallation.Id.Value, review.SendingInstallationId);
    Assert.Equal(houseInstallation.Id.Value, review.RecipientInstallationId);
    // … confirm, then activate …
}
```

Note `MutableTimeProvider` — all time is injected, which is what makes the test
deterministic rather than clock-dependent.

---

## The negative-path tests

The same file rejects every broken variant:

| Attack | Rejected because |
|---|---|
| Tampered payload | Signature no longer verifies |
| Substituted signing key | Fingerprint does not match enrolled trust |
| Wrong recipient | Package is bound to one installation |
| Unsupported schema version | Version allow-list |
| Unsigned activation | No valid signature |
| Assignment mismatch | Program assignment does not apply to this House |
| Replayed package | Transfer ID already committed |

---

## Presenter notes

- **This is the security claim as a test.** If any link in the chain broke, it fails.
- **It starts blank every time**, so it cannot pass on fixture residue — say this
  explicitly, it is the difference between a meaningful test and a decorative one.
- **Real crypto, real SQLite, no mocks** on the critical path.
- Pair with Segment 3: this is the happy path, Segment 3 is what happens to hostile input.

> Run `.\scripts\run-core-workflow-1-e2e.ps1` to reproduce the full gate before recording.