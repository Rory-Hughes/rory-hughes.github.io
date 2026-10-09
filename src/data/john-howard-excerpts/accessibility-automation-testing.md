# Segment 5 — Accessibility Testing Against the Realised Automation Tree

**Source:** `tests/JohnHowardAdminApp.UiTests/`, `tests/JohnHowardHouseApp.UiTests/`,
`tests/Shared/UiAutomationChecks.cs`

**Scale:** 84 Admin cases + 46 House cases across 10 and 8 test classes respectively.

---

## The insight that makes this suite different

An in-process test reading `AutomationProperties.Name` off a WPF object returns **the
value the XAML declared** — whether or not WPF ever publishes it. An element with no
automation peer silently never reaches the accessibility tree.

So these suites **host a real shown `MainWindow`** on a shared STA dispatcher, attach
FlaUI to the HWND, and assert against the **realised** UIA tree.

The project's own documentation states the consequence plainly:

> An attached-property assertion proves what the XAML declares, not what an
> assistive-technology client perceives. WPF publishes `AutomationId` and live-region
> content to the tree only for elements with a real automation peer, and an explicit
> `AutomationProperties.Name` *replaces* the element's text rather than supplementing it.

This has found **eight genuine accessibility defects** — container `AutomationId`s on
`Grid`/`Border`/`StackPanel` that are never published, a live region announcing its
constant instead of its message, two navigation destinations with no deliberate id, an
unnamed workspace focus stop, and a header that is not an automation region.

---

## Practice 1 — Known defects pinned as current state

`AdminShellAutomationGapTests` and `HouseShellAutomationGapTests` / `HouseFeatureAutomationGapTests`
assert that each defect **still exists**:

```csharp
// A jh-admin-session-start id IS reachable…
Assert.Contains("jh-admin-session-start", reachable);

// …while the locked surface's id is NOT published, because the container has no peer.
Assert.DoesNotContain("jh-admin-locked-surface", reachable);

// A live region is present…
Assert.Equal(FlaUI.Core.Definitions.LiveSetting.Polite,
             status.Properties.LiveSetting.ValueOrDefault);

// …but an explicit Name replaces the announced text rather than supplementing it.
Assert.NotEqual("audit state", AutomationChecks.Name(auditState));
Assert.Contains("audit events", AutomationChecks.Name(auditState),
                StringComparison.OrdinalIgnoreCase);
```

**Fixing the XAML makes these tests fail — by design.**

This is worth emphasising in a portfolio. It converts an informal to-do list into
**enforced, reviewable work**, and it means "we know these are broken" is a tracked,
verified claim rather than a promise in a document.

---

## Practice 2 — Negative controls, so tests cannot be silently defeated

`UiTestParallelisationTests` reads the assembly attribute at runtime:

```csharp
public sealed class UiTestParallelisationTests
{
    [Fact]
    public void UiTestAssembly_DisablesTestParallelisation()
    {
        var behaviour = typeof(UiTestParallelisationTests).Assembly
            .GetCustomAttribute<CollectionBehaviorAttribute>();

        Assert.NotNull(behaviour);
        Assert.True(behaviour.DisableTestParallelization,
            "JohnHowardAdminApp.UiTests must declare "
            + "[assembly: CollectionBehavior(DisableTestParallelization = true)]. …");
    }
}
```

The reason it exists is stated in the file's own documentation comment:

> Without this pin, the control is revertible with every routine verification signal still
> green. … **Nothing fails deterministically** — the suite would flake at worst — and the
> acceptance gate cannot catch it either, because it runs window-showing projects one at a
> time and so never exercises intra-assembly parallelism at all.

And the negative control was **performed, not assumed**:

> Status: the negative control was performed for this project on 2026-10-05, not copied.
> `UiTestAssembly.cs` was renamed out of the project's compile set, the project rebuilt,
> and this test run on its own: it failed with `Assert.NotNull() Failure: Value is null`,
> exit 1. The file was then restored, `git status` confirmed it unmodified, and this test
> passed 1/1 in 31 ms. An unevidenced "verified to discriminate" is what this test exists
> to prevent.

**This is the strongest thing in the whole test suite.** Most portfolios cannot show a
single test proven to actually fail when it should. Here, removing the control is
demonstrated to break the test, with the evidence recorded rather than assumed.

---

## Practice 3 — Shared source, not a shared reference

`UiAutomationChecks.cs` is **linked into** both UI test projects rather than placed in a
referenced library:

```csharp
/// This file is shared by linking it into both UI-automation test projects rather than by
/// referencing either one. The helpers are pure UI Automation reads with no knowledge of
/// either shell, so a single copy keeps one property-tolerance rule — notably the
/// <c>PropertyNotSupportedException</c> handling in <c>Id</c> and <c>Name</c> — governing
/// both harnesses instead of letting the copies drift.
```

Consistent with the project's architecture rule: **the two shells never reference one
another**, and test infrastructure honours the same boundary.

---

## Practice 4 — Tolerating genuine peer variation

Not every UI Automation peer supports every property; reading directly throws:

```csharp
// Always go through AutomationChecks.Id / Name, which swallow
// PropertyNotSupportedException.
Assert.NotEqual("audit state", AutomationChecks.Name(auditState));
```

One rule, enforced by shared source, rather than two copies drifting apart.

Also worth noting: focus order is **read from the tree**, not synthesised with Tab
keystrokes — because Tab presses need foreground focus and would contend with every other
test showing a window. The suite documents *why* `MainWindow.xaml` declaring no `TabIndex`
makes WPF's visual order the correct thing to read.

---

## Presenter notes

- **Open with the distinction.** "I don't assert accessibility properties in isolation —
  I read the live automation tree." That sentence alone separates you from most portfolios.
- **Then the payoff:** *"That's how I found eight defects that the XAML-level tests passed
  straight over."*
- **The negative control is your best material.** Being able to say you removed a control,
  watched the test fail, and recorded the evidence is a level of rigour that is genuinely
  rare. Lead with it if presenting to a senior audience.
- **Be candid about the limit:** these suites show real top-level windows, so they can
  conflict when test projects run concurrently. They pass when run serially, as the
  acceptance gate does. Explaining *why* — foreground activation is desktop-wide — is a
  good answer in itself.