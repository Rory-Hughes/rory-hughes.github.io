# rory-hughes.github.io

Personal website and developer portfolio for Rory Hughes.

## Local development

Use Node.js 24.21.0, then run:

1. npm ci
2. npm run dev
3. npm run check
4. npm test
5. npm run build

Astro writes a fully static site to dist/. The build validates structured
profile and project records, publication boundaries, the media allow-list,
output routes and links, and the release manifest. No server-side runtime or
client-side router is required.

## Content updates

- Profile facts live in src/content/profile/rory.json.
- Each project has one authoritative record in src/content/projects/.
- Project publication state and evidence-media review state are required.
  Unknown, deferred, private, or unreviewed material must not be published.
- Add public media only under public/media/, reference it from the matching
  project record, include descriptive alt text and a caption, and provide a
  concise transcript for recordings. Every media file must be smaller than
  100 MiB and pass a manual privacy review.
- Published recordings also require a reviewed `posterPath` in their media record.
  Posters use the same allow-list, file-signature, size, and publication checks as
  other media. Players show the poster with `preload="none"` and retain native
  controls alongside a progressively enhanced "Watch demo" button.
- The owner-supplied resume is retained unchanged at
  public/downloads/Portfolio_Resume.docx, with a PDF export of the same document at
  public/downloads/Portfolio_Resume.pdf. The PDF is the primary download; Word is
  the secondary format. SHA-256 and byte counts in src/content/resume-asset.json
  and src/content/resume-pdf-asset.json are checked locally and in CI.
- To export a replacement resume on Windows with Microsoft Word installed, run
  pwsh -NoProfile -File scripts/export-resume-pdf.ps1. The script opens the DOCX
  read-only in a separate automation instance and verifies its bytes are unchanged.
  Render and visually review every PDF page before updating both asset manifests.
- Relevant coursework and owner-confirmed work dates share the profile record.
  Current courses use `education.coursework`; earlier study uses
  `education.earlierCoursework`. Summarize topics supported by actual term material
  and exercises rather than treating the full program catalogue as completed study.
  Project accomplishments share the project records; keep summaries consistent
  with the detailed evidence and development status.
- scripts/create-social-image.py uses Pillow and the Windows Segoe UI fonts to
  rebuild public/social/portfolio-preview.png. Review the image after changes.
  The build creates sitemap.xml from actual rendered pages and excludes 404;
  public/robots.txt identifies the sitemap. Search Console and deployed-page
  Lighthouse checks remain owner-operated release checks.

Use the 5 supplied MileageTracker screen recordings without changing their bytes.
The owner-approved sanitized source repository is
https://github.com/Rory-Hughes/MilageTracker (the repository spelling intentionally
differs from the MileageTracker display name).

John Howard's case study uses the owner-approved October 7 content package in the
separate portfolio planning workspace. The package's verification log takes
precedence over its summaries: it reports 1,148 passing cases across six suites;
130 additional UI cases were listed but those suites did not complete. These are
dated working-tree observations, not a fresh acceptance run. Do not copy the
package's contradictory "1,278 tests all passing" headline.

John Howard's owner-approved 80-second synthetic-data walkthrough is published locally
as public/media/john-howard-application-walkthrough.mp4, unchanged from JHDemoVid3.mp4.
It appears before the case-study reading body with a caption and written visual transcript.
Its exact bytes are pinned in the publication-policy regression test. The public source
repository remains pending approval. Do not publish the raw handoff,
verification log, or internal context files as downloadable assets.

See [docs/content-readiness.md](docs/content-readiness.md) for the content inventory,
recording handoff, and remaining assignment/release checks.

## GitHub Pages release (owner-operated)

This repository does not configure Pages or deploy automatically on pushes.
When ready, Rory must choose GitHub Actions as the Pages source and create or
configure the github-pages environment. The workflow runs only when manually
dispatched. It builds and validates on any selected ref, but the deploy job
is additionally gated to main and the explicit deploy_now confirmation. Run
that release only after reviewing the exact public content.

The workflow writes a release-manifest.json into the static artifact with the
source commit, workflow-run identity, and SHA-256 for every other built file.
Local verification is not evidence of deployment or production approval.
