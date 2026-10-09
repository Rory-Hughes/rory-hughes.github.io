# Portfolio content baseline — October 7, 2026

Assignment target: Friday, October 9, 2026, as supplied by Rory. The assignment rubric
and submission instructions have not been supplied in this update.

## What is on the site

| Surface | Content |
| --- | --- |
| Home | Introduction, About, Skills, Projects, Experience, Education, Contact, resume download |
| John Howard | Operational context, role, two-shell/shared-core architecture, session epochs, strict parsing, import-service phases, protected storage/audit, dated verification, development process, current scope |
| MileageTracker | Problem, solo role, local storage architecture, interrupted-trip durability, recorded screens, beta gates, sanitized code and architecture/onboarding links |
| Bioelectric simulator | Existing learning-project case study and research reference; its previous scope and limitations are retained |

The profile includes the previously documented software-engineering/product direction
and longer-term university/research goals, clearly presented as aspirations. Existing
employment, education, contact facts, and the supplied resume are retained. No new
employment dates or credentials were invented.

## Source and claim decisions

The John Howard source package is in the separate planning workspace at
`C:/Users/rory/Documents/ChatGPT/portfolio creation/portfolio content john howard/`.
The visitor-facing summary is adapted from this approved material; the raw files are
not bundled into the site. `evidence/verification-log.md` wins when the package
summaries disagree with it.

- Reported October 7 execution: 1,148 passing expanded cases in six suites.
- Another 130 cases were enumerated in two UI suites without a completed run.
- The report's zero-warning build describes a modified working tree. This portfolio
  update did not re-run the private application gate.
- Epic 1 is complete. Epic 2 has accepted, in-review, in-progress, and backlog work.
  Participant/reporting/return-package journeys and Epics 3–7 remain backlog.
- Transfer-service foundations and core tests are described separately from unfinished
  application workflows. AD-14/15/16 remain decided, not built.
- Native accessibility acceptance and production/compliance approval are not claimed.

MileageTracker source: [public repository](https://github.com/Rory-Hughes/MilageTracker),
[architecture](https://github.com/Rory-Hughes/MilageTracker/blob/main/docs/ARCHITECTURE.md),
and [onboarding](https://github.com/Rory-Hughes/MilageTracker/blob/main/docs/ONBOARDING.md).
The source is linked for inspection; no fresh Android test pass is claimed by this work.

## John Howard application recording — October 8, 2026

Rory supplied and authorized `C:/Users/rory/Downloads/JHDemoVid3.mp4` for the public
portfolio demo. It is copied unchanged to
`public/media/john-howard-application-walkthrough.mp4`. The single walkthrough replaces
the three planned recording placeholders and appears before the case-study reading body.
Homepage and project-index cards link directly to the recording.

The clip is 80.2 seconds, 1280×720 H.264 with AAC audio, and 8,701,124 bytes.
SHA-256: `65fc7b3093b594e72e4643a591f230705c9c1f382d3efb2364812ef90dd5a1fe`.
Inspection frames remain in the OS temp directory. Sampled screens identify synthetic
workspaces and show program authoring, reusable fields, cadence, House assignment,
form preview, publication, and House trust/import setup. A written visual transcript
describes these actions without claiming a completed participant/reporting journey.

For each finished, privacy-reviewed clip:

1. Keep the source unchanged and check it with `scripts/media/review-video.ps1`.
2. Place only the approved publishable recording in `public/media/`, strictly below
   100 MiB. Review credentials, paths, notifications, identifying content, and narration.
3. Update the matching slot in `src/content/projects/john-howard.json`: `kind: video`,
   `availability: published`, `publicationState: public`, `reviewStatus: approved`,
   `assetPath: media/<filename>`, a useful `altText`, a precise `caption`, a concise
   `transcript`, and a readable `fallbackText`.
4. Update the approved-media regression assertion for any additional specifically
   authorized clips; retain the no-fabricated-destinations check and exact media bytes.
   Do not weaken the media approval, transcript, or size rules.
5. Run `npm run ci:validate` and review desktop/mobile playback and captions.

## Iterate on design with stable content

Profile facts live in `src/content/profile/rory.json`; case studies live in
`src/content/projects/`. They are shared across the homepage, project index, and project
pages. Presentation lives in `src/components/`, `src/layouts/`, `src/pages/`, and
`src/styles/`. Use the same facts and case-study sections when comparing designs, so
visual changes do not accidentally change the project claims.

The current Harbor Ledger design is the baseline. The next design pass can concentrate
on homepage hierarchy, project emphasis, case-study reading length, and recording
placement after Rory reviews the content.

## Before assignment submission or public release

- Compare the site with the actual assignment rubric and submit the requested format.
- Review wording, contact information, research ambitions, and resume framing.
- Add the planned clips if ready; the existing written case study remains usable.
- Review keyboard navigation, 320px reflow, zoom, and the chosen design in real browsers.
- Review the exact candidate diff before a public push. Configure and dispatch Pages
  only when authorized; local preview is not evidence that the public URL is deployed.
- Complete the adopted deployed-URL and release checks, including Lighthouse/browser
  coverage, against the published artifact before calling release acceptance complete.

## Local verification of this content pass

October 8 demo update: Astro reported zero errors/warnings/hints across 29 files;
content/media policy passed, all 12 regression tests passed, and the static build
produced 11 pages with valid routes, links, media, resume, and release manifest.
The copied John Howard video matches the supplied file's byte count and SHA-256.
Playback was checked in the in-app browser (80.2 seconds, 1280×720), with no
horizontal overflow at a 390px mobile viewport. The preview was restarted to make
the newly added public asset available. These local checks used the bundled Node
v24.19.0; the exact v24.21.0 pin remains part of the GitHub release environment.
The source and recording remain local pending Rory's final design pass and release.
An unnecessary About-page grid override was removed so the shared mobile breakpoint
can stack the page's heading and biography correctly.

`npm run ci:validate` passed with zero Astro errors/warnings/hints, all 12 existing
tests, six prerendered pages, approved media and resume hashes, link checks, and the
release manifest. The bundled Node v24.19.0 was used; the project declares v24.21.0,
so exact pinned-runtime verification remains a release check. No dependency versions
were changed.

An independent content review checked the candidate. Its corrections made known
accessibility defects explicit, replaced public tracker IDs with capability names,
added the documented negative-control example, and distinguished the MileageTracker
README's compliance terminology from established compliance. A proposed discovery
anecdote was not invented from general process notes.

The desktop homepage was visually inspected in Chromium. The homepage and John Howard
case study had no horizontal overflow at 320px; all six homepage sections were present,
and keyboard focus reached the skip link with a visible outline. This is a focused
local check, not the complete manual/browser/deployed acceptance gate.
