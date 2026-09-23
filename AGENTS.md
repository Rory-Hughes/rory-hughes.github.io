<!-- bmad:context -->
<!-- Verified 2026-09-23 against 67e9293. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## rory-hughes.github.io

Public static portfolio site built with Astro and Node.js. Project records and media publication checks are part of the site build. Read README.md for existing build and release guidance.

## Policy

- Use FFmpeg for local video inspection only; do not rewrite, trim, or re-encode source clips during review.
- Keep extracted review frames in the operating system's temp directory; they are review output, not publishable assets.

## Where things are

- Video metadata and frame sampling: scripts/media/review-video.ps1.

## Running and verifying

- Run pwsh -NoProfile -File scripts/media/review-video.ps1 -InputPath <video-path> to inspect metadata and extract five review frames; pass -SampleCount 0 for metadata only.
- The helper resolves FFmpeg and FFprobe from PATH or the current user's WinGet installation. Keep it out of the site build and CI.
<!-- /bmad:context -->
