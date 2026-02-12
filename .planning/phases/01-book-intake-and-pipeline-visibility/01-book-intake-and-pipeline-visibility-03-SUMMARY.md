---
phase: 01-book-intake-and-pipeline-visibility
plan: 03
subsystem: ui
tags: [convex, react, dashboard, observability, jobs]

# Dependency graph
requires:
  - phase: 01-book-intake-and-pipeline-visibility
    provides: intake jobs with canonical queued/running/completed/failed lifecycle data
provides:
  - Grouped-by-book job summaries with per-state counts for default dashboard rendering.
  - Detailed job rows exposing stage/progress plus error snippet, full error details, and logs.
  - Canonical user-facing status/stage labels shared across list and drawer views.
affects: [ops-monitoring, failure-debugging, phase-02-cleanup-review]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Convex query split between summary payloads and detailed payloads for UI composition.
    - Shared status/stage mapping module consumed by multiple job UI surfaces.

key-files:
  created:
    - src/lib/jobStatus.ts
  modified:
    - convex/jobs.ts
    - src/components/JobsPage.tsx
    - src/components/JobDetailsDrawer.tsx

key-decisions:
  - "Use grouped summary query as the default jobs page source so books with multiple jobs are summarized by state first."
  - "Keep canonical status labels in a shared lib module to prevent drift between row and drawer views."

patterns-established:
  - "Job observability data shape: grouped summary for top-level cards, nested detailed rows for drill-down."
  - "Failed job diagnostics appear first as inline snippet, then expandable inline details, then full drawer context."

# Metrics
duration: 5 min
completed: 2026-02-12
---

# Phase 1 Plan 3: Pipeline Observability Summary

**Grouped job monitoring now shows per-book state rollups with canonical Queued/Running/Completed/Failed labels and layered failure diagnostics (inline snippet, inline expansion, drawer logs).**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-12T10:29:00Z
- **Completed:** 2026-02-12T10:34:01Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Added Convex queries for grouped-by-book summaries and detailed job rows including stage/progress/error context.
- Switched jobs dashboard default rendering to grouped summaries with canonical status labels and stage/progress visible on first render.
- Implemented inline failed-job detail expansion and updated drawer content to show full error details plus logs.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add job queries for grouped summaries and detailed failure context** - `d9301dd` (feat)
2. **Task 2: Update Jobs page default view to grouped summaries with stage+percent** - `22efb56` (feat)
3. **Task 3: Expand failure details inline and in drawer** - `c1d53d6` (feat)

## Files Created/Modified

- `convex/jobs.ts` - Added `listDetailed` and `listGroupedSummary` queries with normalized failure context fields.
- `src/components/JobsPage.tsx` - Refactored default list to grouped summaries with state counts, stage/progress defaults, and inline failure expansion.
- `src/components/JobDetailsDrawer.tsx` - Aligned drawer to canonical status labels and full error-detail/log presentation.
- `src/lib/jobStatus.ts` - Centralized status/stage label and badge mapping used by jobs UI.

## Decisions Made

- Default jobs dashboard query is grouped summary data, not flat jobs list, so multi-job books are immediately understandable.
- Canonical status and stage label mapping lives in one shared module to prevent `done/error` drift.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing shared status mapping file expected by plan outputs**

- **Found during:** Task 2 (Jobs page grouped summary refactor)
- **Issue:** `src/lib/jobStatus.ts` did not exist, but shared canonical status labels were required across multiple components.
- **Fix:** Created `src/lib/jobStatus.ts` and moved status/stage label + badge mapping into reusable helpers.
- **Files modified:** `src/lib/jobStatus.ts`, `src/components/JobsPage.tsx`, `src/components/JobDetailsDrawer.tsx`
- **Verification:** `npm run lint` completed successfully after integration.
- **Committed in:** `22efb56` and `c1d53d6`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was required for the planned shared-label architecture and prevented status drift; no scope creep.

## Issues Encountered

- `npx convex run` verification initially used dotted function paths; corrected to `module:function` syntax (`jobs:list`, `jobs:listGroupedSummary`, `jobs:listDetailed`) and re-ran successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Jobs observability requirements for OPS-01/OPS-02 are implemented with grouped monitoring and failure drill-down.
- Ready for next phase planning/execution work; no new blockers introduced.

---

_Phase: 01-book-intake-and-pipeline-visibility_
_Completed: 2026-02-12_

## Self-Check: PASSED

- FOUND: `.planning/phases/01-book-intake-and-pipeline-visibility/01-book-intake-and-pipeline-visibility-03-SUMMARY.md`
- FOUND commit: `d9301dd`
- FOUND commit: `22efb56`
- FOUND commit: `c1d53d6`
