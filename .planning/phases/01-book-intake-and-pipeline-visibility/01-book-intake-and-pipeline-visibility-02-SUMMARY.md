---
phase: 01-book-intake-and-pipeline-visibility
plan: 02
subsystem: ui
tags: [convex, intake, discovery, upload, dashboard]

requires:
  - phase: 01-book-intake-and-pipeline-visibility
    provides: backend intake pipeline foundation and duplicate policies
provides:
  - operator manual upload flow with immediate visible book row and inline dedupe handling
  - discovery candidates panel with pre-enqueue visibility and persistent status rows
  - local discovery scanner script with idempotent Convex ingestion
affects: [phase-02-cleanup-review, intake-ux, operator-workflow]

tech-stack:
  added: [tsx]
  patterns:
    - upload URL then enqueue mutation for immediate pipeline kickoff
    - discovery candidate rows remain visible while status transitions occur
    - local scanner sends chunked candidate batches via ConvexHttpClient

key-files:
  created:
    - src/components/DiscoveryCandidatesPanel.tsx
    - scripts/discover-library.ts
  modified:
    - src/components/ImportModal.tsx
    - src/components/LibraryPage.tsx
    - src/components/Dashboard.tsx
    - convex/intake.ts
    - package.json

key-decisions:
  - "Manual upload accepts optional Gutenberg ID and enforces duplicate-block with explicit override toggle before retry."
  - "Discovery candidate rows stay in-table after enqueue and surface status badges instead of removal."
  - "Scanner processes large corpora in chunked batches and supports DISCOVER_LIMIT for bounded runs."

patterns-established:
  - "Inline dedupe feedback: show backend duplicate_blocked message with link to existing row anchor."
  - "Idempotent candidate ingestion: patch existing discovery rows on reruns rather than inserting duplicates."

duration: 9 min
completed: 2026-02-12
---

# Phase 1 Plan 2: Operator Intake UX Summary

**Manual upload now starts intake immediately with duplicate safeguards, and discovery candidates are visible pre-enqueue with persistent status tracking fed by a local scanner command.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-12T10:29:52Z
- **Completed:** 2026-02-12T10:39:20Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Replaced placeholder import behavior with upload URL -> enqueue flow and inline duplicate block/override UX.
- Added discovery candidates panel showing Gutenberg ID, title/author, source path, warnings, duplicate link feedback, and in-place status transitions.
- Added `npm run discover:library` script that scans local Gutenberg folders and upserts candidates via Convex HTTP client.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire manual upload to immediate record creation and auto-start intake** - `8723a34` (feat)
2. **Task 2: Build discovery candidates panel with pre-enqueue visibility and warnings** - `1d4da4a` (feat)
3. **Task 3: Add local discovery scanner script and runnable npm command** - `6a2dc57` (feat)

## Files Created/Modified

- `src/components/ImportModal.tsx` - Upload-first intake modal with duplicate block handling and override retry.
- `src/components/LibraryPage.tsx` - Added status labels for importing flow and embedded discovery panel.
- `src/components/DiscoveryCandidatesPanel.tsx` - Candidate table with warnings, enqueue controls, dedupe feedback, and persistent rows.
- `src/components/Dashboard.tsx` - Library page labeling aligned with intake workflow.
- `convex/intake.ts` - Candidate listing query and idempotent candidate upsert updates.
- `scripts/discover-library.ts` - Local scanner for `library/epub` / `Library/epub` with chunked mutation calls.
- `package.json` - Added `discover:library` command and `tsx` dev dependency.

## Decisions Made

- Manual upload duplicate handling is driven by backend `duplicate_blocked` responses and requires explicit override before re-enqueue.
- Discovery review is first-class in the library page so operators can inspect metadata/warnings before enqueue.
- Scanner performs chunked sync to avoid heap blowups on large local Gutenberg corpora.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added backend query for discovery candidates with existing-book context**

- **Found during:** Task 2 (discovery panel implementation)
- **Issue:** Plan required a discovery table view, but no query exposed candidate rows or existing-book IDs for inline linking.
- **Fix:** Added `intake.listDiscoveryCandidates` query returning candidate rows plus existing book context.
- **Files modified:** `convex/intake.ts`
- **Verification:** `npm run lint` succeeded and panel compiles against generated API.
- **Committed in:** `1d4da4a`

**2. [Rule 3 - Blocking] Fixed discovery script memory exhaustion for 30GB corpus scale**

- **Found during:** Task 3 (`npm run discover:library` verification)
- **Issue:** Initial implementation accumulated all candidates and hit Node heap limits on local corpus size.
- **Fix:** Switched to chunked scan/push with bounded file previews and optional `DISCOVER_LIMIT` guard.
- **Files modified:** `scripts/discover-library.ts`
- **Verification:** `DISCOVER_LIMIT=50 npm run discover:library` completed successfully and rerun updated existing rows.
- **Committed in:** `6a2dc57`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both fixes were required for correctness and operability; scope stayed within intake UX and discovery ingestion.

## Authentication Gates

None.

## Issues Encountered

- First discovery-script attempt ran out of memory on large library size; resolved by streaming-chunk workflow and verified reruns.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Intake operator workflow now supports upload and discovery review with dedupe-safe enqueue behavior.
- Ready for Plan 03 to polish pipeline visibility and downstream intake interactions.

---

_Phase: 01-book-intake-and-pipeline-visibility_
_Completed: 2026-02-12_

## Self-Check: PASSED

- FOUND: `.planning/phases/01-book-intake-and-pipeline-visibility/01-book-intake-and-pipeline-visibility-02-SUMMARY.md`
- FOUND: `8723a34`
- FOUND: `1d4da4a`
- FOUND: `6a2dc57`
