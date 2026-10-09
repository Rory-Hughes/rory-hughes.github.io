# Segment 3 — Strict Parsing of Untrusted Crypto Artifacts

**Source:** `src/JHS.Transfer/Signing/TransferSigningTrustArtifact.cs`
**Also:** `src/JHS.Transfer/Envelope/SignedTransferPackageEnvelope.cs`

**Purpose:** treat a trust artifact arriving on removable media as hostile input.

---

## (a) Reject unknown AND duplicate properties, and require an exact set

```csharp
string[] expectedProperties =
[
    "format",
    "formatVersion",
    "sendingInstallationId",
    "signingKeyId",
    "signatureAlgorithm",
    "signingPublicKeyBase64"
];
var names = new HashSet<string>(StringComparer.Ordinal);
foreach (JsonProperty property in root.EnumerateObject())
{
    // !names.Add(...) is the DUPLICATE check — Add returns false if already present.
    if (!names.Add(property.Name) ||
        !expectedProperties.Contains(property.Name, StringComparer.Ordinal))
    {
        throw new InvalidDataException(
            "The signing-trust artifact contains duplicate or unexpected fields.");
    }
}

if (names.Count != expectedProperties.Length ||
    root.GetProperty("format").GetString() != CurrentFormat ||
    root.GetProperty("formatVersion").GetInt32() != CurrentFormatVersion ||
    root.GetProperty("signatureAlgorithm").GetString() !=
        TransferSignatureAlgorithms.EcdsaP256Sha256P1363)
{
    throw new InvalidDataException("The signing-trust artifact format is not supported.");
}
```

Three things at once: **no unknown fields** (defeats property-injection tricks that rely
on a lenient reader), **no duplicate fields** (defeats last-one-wins ambiguity between
two parsers), and **exact field set** (nothing silently ignored).

`StringComparer.Ordinal` throughout — no culture-sensitive comparison.

---

## (b) Recompute the fingerprint; never trust the declared one

```csharp
var trustedKey = new TrustedTransferSigningKey(
    installationId, publicKey, TransferSigningKeyTrustStatus.Pending);

if (trustedKey.KeyId != declaredKeyId)
{
    throw new InvalidDataException(
        "The signing-trust artifact's fingerprint does not match its public key.");
}
```

`trustedKey` **derives** the fingerprint from the public key. The file's own
`signingKeyId` field is only a claim. A file cannot assert its own identity.

---

## (c) Enforce canonical form by re-serializing and byte-comparing

```csharp
byte[] canonical = Serialize(installationId, declaredKeyId, publicKey);
if (!artifactBytes.SequenceEqual(canonical))
{
    throw new InvalidDataException("The signing-trust artifact is not in canonical form.");
}
```

These artifacts are hashed and signed. If two encodings of identical content were
accepted, they would produce **two different signatures over the same logical
document** — and canonical-form agreement is exactly what prevents that.

The parser is therefore a **closed grammar**, not a tolerant reader.

---

## (d) Zero key material on every path, including failure

```csharp
try
{
    // … parse, verify, compare …
    return new TransferSigningTrustArtifact(
        installationId, declaredKeyId, publicKey, canonical);
}
finally
{
    CryptographicOperations.ZeroMemory(publicKey);
}
```

`finally`, not the success path. Material is cleared whether parsing returned or threw.

---

## (e) Bound everything before allocating

```csharp
if (artifactBytes is { Length: <= 0 or > MaximumArtifactBytes })   // 16 KB
{
    throw new InvalidDataException("The signing-trust artifact has an invalid size.");
}
```

And the envelope applies the same discipline:

```csharp
if (signatureText.Length > 128 ||
    signedContentText.Length > TransferPackageLimits.MaximumEncodedSignedContentLength)
{
    throw new JsonException("An encoded transfer-envelope value is too large.");
}
```

---

## (f) Normalize exceptions at the boundary

```csharp
catch (Exception exception) when (exception is JsonException
    or FormatException
    or ArgumentException
    or InvalidOperationException
    or CryptographicException)
{
    throw new InvalidDataException("The signing-trust artifact is malformed.", exception);
}
```

Callers upstream get **one** exception type to handle, with the original preserved as
`InnerException` for diagnostics. No crypto or JSON types leak past the boundary.

---

## Presenter notes

- **Strict parsing of untrusted input is the security skill reviewers look for**, and it
  is far more often wrong than right in real projects.
- Lead with (b): *"the fingerprint is recomputed from the key, not read from the file."*
  That single line shows you understand identity vs. assertion.
- Then (c): canonical form is what makes signing meaningful. Two encodings, two
  signatures, same document — a real and underappreciated failure mode.
- Close on (d): zeroing in a `finally` is the detail most projects omit entirely.