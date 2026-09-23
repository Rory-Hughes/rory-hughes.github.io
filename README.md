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
- The supplied QA Software Intern resume is copied unchanged to
  public/downloads/Rory-Hughes-Resume.docx. Its pinned SHA-256 and byte count
  are checked locally and in CI. If the owner supplies a replacement, update
  both the file and src/content/resume-asset.json.

Use the 5 supplied MileageTracker screen recordings. John Howard demo
and sanitized-repository destinations remain pending; do not add links until
Rory supplies the approved public destinations.

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
