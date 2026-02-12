---
phase: 01-book-intake-and-pipeline-visibility
plan: 01
subsystem: api
tags: [convex, intake, dedupe, gutenberg, jobs]
requires:
  - phase: none
    provides: first delivery in phase
provides:
  - canonical queued/running/completed/failed intake job lifecycle
  - unified upload/discovery enqueue mutations with Gutenberg dedupe and override
  - metadata extraction action with durable success/failure persistence
affects: [phase-01-plan-02, phase-01-plan-03, intake-ui, jobs-observability]
tech-stack:
  added: []
  patterns:
    - mutation writes intake intent then schedules internal action
    - source-aware dedupe with explicit overrideDuplicate escape hatch
    - durable failed-state persistence (no auto-delete)
key-files:
  created:
    - convex/intake.ts
  modified:
    - convex/schema.ts
    - convex/books.ts
    - convex/jobs.ts
    - convex/intakeMetadata.ts
    - convex/_generated/api.d.ts
key-decisions:
  - "Use discoveryCandidates table so discovery rows remain visible before and after enqueue."
  - "Treat Gutenberg-ID dedupe as default block and return existingBookId for inline linking."
  - "Fail extraction when no file exists and persist job/book failure details for operator review."
patterns-established:
  - "Intake orchestration pattern: source mutation -> shared enqueue helper -> scheduler action."
  - "Status normalization pattern: queued/running/completed/failed only for jobs and candidate lifecycle updates."
duration: 7 min
completed: 2026-02-12
---

# Phase 1 Plan 1: Backend intake foundation Summary

**Shared Convex intake pipeline now enqueues upload and discovery flows with deterministic Gutenberg dedupe and durable metadata extraction state transitions.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-12T10:19:22Z
- **Completed:** 2026-02-12T10:26:55Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Normalized schema for intake jobs and candidates, including canonical statuses and lookup indexes.
- Added unified intake entrypoints (`enqueueUpload`, `createDiscoveryCandidates`, `enqueueDiscoveryCandidate`) with duplicate blocking and override support.
- Implemented metadata extraction action that parses Gutenberg markers and persists completed/failed outcomes without deleting rows.

## Task Commits

Each task was committed atomically:

1. **Task 1: Normalize intake schema and candidate/job state model** - `c993517` (feat)
2. **Task 2: Implement unified idempotent intake mutations with source-specific dedupe** - `1e9c080` (feat)
3. **Task 3: Add metadata extraction action with durable failure handling** - `c36362a` (feat)

**Plan metadata:** `TBD` (docs)

## Files Created/Modified

- `convex/schema.ts` - canonical job state enum, discovery candidate table, and dedupe/query indexes.
- `convex/intake.ts` - shared enqueue flow for upload and discovery with source-aware duplicate policy.
- `convex/intakeMetadata.ts` - action + internal mutations for stage/progress transitions and durable failure persistence.
- `convex/books.ts` - upload path now forwards into unified intake mutation; added Gutenberg lookup query.
- `convex/jobs.ts` - status enum alignment and required queued/stage fields.
- `convex/_generated/api.d.ts` - generated API surface for new Convex functions.

## Decisions Made

- Discovery keeps explicit candidate rows in `discoveryCandidates` even before enqueue so operators can inspect and act later.
- Duplicate checks use Gutenberg ID by default and return `existingBookId` payloads for inline UI linking.
- Metadata extraction treats missing file/storage failures as first-class failed states with persisted error and details.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated existing books/jobs mutations for new required schema fields**

- **Found during:** Task 1 (Normalize intake schema and candidate/job state model)
- **Issue:** `npm run lint` failed because existing inserts still used old schema (`done/error`, missing `source` and `queuedAt`).
- **Fix:** Patched `convex/books.ts` and `convex/jobs.ts` to satisfy required fields and canonical statuses.
- **Files modified:** `convex/books.ts`, `convex/jobs.ts`
- **Verification:** `npm run lint` succeeded with Convex codegen/build passing.
- **Committed in:** `c993517`

**2. [Rule 3 - Blocking] Added scheduler target scaffolding before full metadata implementation**

- **Found during:** Task 2 (Implement unified idempotent intake mutations with source-specific dedupe)
- **Issue:** `enqueueUpload` needed to schedule `internal.intakeMetadata.extractAndPersist`, but no target function existed yet.
- **Fix:** Added `convex/intakeMetadata.ts` scaffold so enqueue verification could run, then completed implementation in Task 3.
- **Files modified:** `convex/intakeMetadata.ts`
- **Verification:** `npx convex run intake:enqueueUpload ...` returned deterministic enqueue and duplicate-block payloads.
- **Committed in:** `1e9c080`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were required to keep the planned workflow executable and verifiable; no scope creep.

## Authentication Gates

None.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Intake backend prerequisites for ING-01/ING-02/ING-03 and OPS-01 are in place for UI integration.
- Plan 01-02 can now wire manual/discovery UI flows to the new intake mutations and candidate lifecycle.

---

_Phase: 01-book-intake-and-pipeline-visibility_
_Completed: 2026-02-12_

## Self-Check: PASSED

- Verified summary and key created files exist on disk.
- Verified task commits `c993517`, `1e9c080`, and `c36362a` exist in git history.
