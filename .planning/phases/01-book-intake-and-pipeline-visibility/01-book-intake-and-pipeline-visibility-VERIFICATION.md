---
phase: 01-book-intake-and-pipeline-visibility
verified: 2026-02-12T10:44:18Z
status: human_needed
score: 11/11 must-haves verified
human_verification:
  - test: "Upload local .txt and confirm immediate library row + running job"
    expected: "Book appears in Library immediately after submit; Jobs shows queued/running/completed transitions with progress"
    why_human: "Requires live UI/reactive timing validation and real upload execution"
  - test: "Run discovery scanner then enqueue a candidate from dashboard"
    expected: "Candidate rows appear with metadata/source path, remain visible after enqueue, and update status in-place"
    why_human: "Needs end-to-end local filesystem scan plus dashboard interaction"
  - test: "Trigger duplicate Gutenberg ID for upload and discovery"
    expected: "Inline duplicate warning appears with link to existing book and override path succeeds when checked"
    why_human: "Needs interactive validation of inline UX and user flow branches"
  - test: "Inspect failed job diagnostics in list and drawer"
    expected: "Failed row shows snippet, inline expansion reveals full details/logs, drawer shows full error context"
    why_human: "Visual/interaction quality and readability cannot be fully validated by static code checks"
---

# Phase 1: Book Intake and Pipeline Visibility Verification Report

**Phase Goal:** User can bring books into the system and monitor pipeline execution status from the dashboard.
**Verified:** 2026-02-12T10:44:18Z
**Status:** human_needed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                  | Status     | Evidence                                                                                                                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Manual upload and discovery both enter the same idempotent intake pipeline.                                            | ✓ VERIFIED | Both `enqueueUpload` and `enqueueDiscoveryCandidate` call shared `enqueueSharedIntake` in `convex/intake.ts:14`, with re-enqueue guard on `linkedJobId` in `convex/intake.ts:224`.                                                                                                                                                                                 |
| 2   | Manual upload creates a visible book record immediately and auto-queues intake work.                                   | ✓ VERIFIED | `enqueueSharedIntake` inserts `books` before scheduling job/action in `convex/intake.ts:28` and `convex/intake.ts:63`; modal uses upload URL then enqueue via `api.books.createFromFile` in `src/components/ImportModal.tsx:64` and `src/components/ImportModal.tsx:80`.                                                                                           |
| 3   | Discovery creates visible candidate rows before enqueue and keeps failed records visible.                              | ✓ VERIFIED | Candidates are inserted/updated with `status: "discovered"` in `convex/intake.ts:189`; list query returns all rows without filtering in `convex/intake.ts:271`; UI renders all rows in `src/components/DiscoveryCandidatesPanel.tsx:104`.                                                                                                                          |
| 4   | Job lifecycle is durable and normalized to queued/running/completed/failed.                                            | ✓ VERIFIED | Canonical statuses are enforced in schema `convex/schema.ts:55` and used in transitions in `convex/intakeMetadata.ts:104`, `convex/intakeMetadata.ts:155`, `convex/intakeMetadata.ts:185`.                                                                                                                                                                         |
| 5   | Operator can upload a local file and immediately see a new book row without waiting for metadata completion.           | ✓ VERIFIED | Library subscribes to `api.books.list` in `src/components/LibraryPage.tsx:10`; upload triggers backend insert before metadata completion in `convex/intake.ts:28`.                                                                                                                                                                                                 |
| 6   | Discovery lists all candidates by default before enqueue, including Gutenberg ID, title/author, and source path.       | ✓ VERIFIED | Panel queries `api.intake.listDiscoveryCandidates` and renders required columns in `src/components/DiscoveryCandidatesPanel.tsx:29`, `src/components/DiscoveryCandidatesPanel.tsx:96`, `src/components/DiscoveryCandidatesPanel.tsx:97`, `src/components/DiscoveryCandidatesPanel.tsx:98`.                                                                         |
| 7   | Duplicate block feedback appears inline with link to existing book, with explicit override for intentional duplicates. | ✓ VERIFIED | Upload inline duplicate block and override checkbox in `src/components/ImportModal.tsx:246`; discovery inline duplicate block + override in `src/components/DiscoveryCandidatesPanel.tsx:136` and `src/components/DiscoveryCandidatesPanel.tsx:180`; backend returns `existingBookId` and `duplicate_blocked` in `convex/intake.ts:95` and `convex/intake.ts:244`. |
| 8   | Enqueued candidates remain visible and show their status transitions instead of disappearing.                          | ✓ VERIFIED | Candidate row is patched with `linkedBookId/linkedJobId/status` in `convex/intake.ts:54`; panel explicitly states and renders persistent rows in `src/components/DiscoveryCandidatesPanel.tsx:81` and `src/components/DiscoveryCandidatesPanel.tsx:104`.                                                                                                           |
| 9   | Job rows show stage and percent by default with Queued/Running/Completed/Failed labels.                                | ✓ VERIFIED | Jobs page uses grouped summary query in `src/components/JobsPage.tsx:22`; stage/progress displayed per row in `src/components/JobsPage.tsx:145` and `src/components/JobsPage.tsx:152`; labels map in `src/lib/jobStatus.ts:1`.                                                                                                                                     |
| 10  | Failed jobs show inline error snippets and allow expanding to full details/logs.                                       | ✓ VERIFIED | Error snippet built in `convex/jobs.ts:38`; inline failure snippet + expansion and logs in `src/components/JobsPage.tsx:169` and `src/components/JobsPage.tsx:191`; drawer shows full details/logs in `src/components/JobDetailsDrawer.tsx:116` and `src/components/JobDetailsDrawer.tsx:130`.                                                                     |
| 11  | When a book has multiple jobs, default dashboard view shows grouped summary by state.                                  | ✓ VERIFIED | Grouped aggregation exists in `convex/jobs.ts:72`; UI renders per-group state counts with `hasMultipleJobs` in `src/components/JobsPage.tsx:102`.                                                                                                                                                                                                                  |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact                                      | Expected                                                          | Status     | Details                                                                                                                                                                                                         |
| --------------------------------------------- | ----------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `convex/schema.ts`                            | Canonical status enums and candidate/index model                  | ✓ VERIFIED | Exists, substantive, and consumed by Convex runtime; includes `jobs` and `discoveryCandidates` statuses/indexes at `convex/schema.ts:29` and `convex/schema.ts:53`.                                             |
| `convex/intake.ts`                            | Unified enqueue/discovery mutations with dedupe and override      | ✓ VERIFIED | Exports all required mutations (`enqueueUpload`, `createDiscoveryCandidates`, `enqueueDiscoveryCandidate`) and links scheduler/action at `convex/intake.ts:80`, `convex/intake.ts:122`, `convex/intake.ts:213`. |
| `convex/intakeMetadata.ts`                    | Metadata extraction action with durable state transitions         | ✓ VERIFIED | `extractAndPersist` plus running/completed/failed mutations implemented at `convex/intakeMetadata.ts:36` and `convex/intakeMetadata.ts:97`.                                                                     |
| `src/components/ImportModal.tsx`              | Upload URL flow with inline duplicate handling                    | ✓ VERIFIED | Uses `generateUploadUrl -> fetch -> createFromFile` and renders duplicate UX/override at `src/components/ImportModal.tsx:64`, `src/components/ImportModal.tsx:80`, `src/components/ImportModal.tsx:246`.        |
| `src/components/DiscoveryCandidatesPanel.tsx` | Candidate table with warnings, enqueue controls, persistence      | ✓ VERIFIED | Queries candidates and enqueues with override; renders warnings/statuses/actions in `src/components/DiscoveryCandidatesPanel.tsx:29` and `src/components/DiscoveryCandidatesPanel.tsx:167`.                     |
| `scripts/discover-library.ts`                 | Local scanner for `library/epub/<id>/pg*.txt` using Convex client | ✓ VERIFIED | Scans numeric dirs and pushes via `ConvexHttpClient` mutation at `scripts/discover-library.ts:99` and `scripts/discover-library.ts:138`.                                                                        |
| `convex/jobs.ts`                              | Grouped summary and detailed job query data                       | ✓ VERIFIED | `listDetailed` and `listGroupedSummary` implemented with error snippet and grouping at `convex/jobs.ts:58` and `convex/jobs.ts:72`.                                                                             |
| `src/components/JobsPage.tsx`                 | Grouped jobs UI with stage/progress and inline failures           | ✓ VERIFIED | Uses grouped query and renders statuses/stage/progress + failure expansion at `src/components/JobsPage.tsx:22` and `src/components/JobsPage.tsx:169`.                                                           |
| `src/components/JobDetailsDrawer.tsx`         | Expanded failure details and logs inspection                      | ✓ VERIFIED | Drawer fetches selected job and renders error details/logs at `src/components/JobDetailsDrawer.tsx:18` and `src/components/JobDetailsDrawer.tsx:116`.                                                           |

### Key Link Verification

| From                                          | To                                     | Via                                 | Status  | Details                                                                                                                                                       |
| --------------------------------------------- | -------------------------------------- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `convex/intake.ts`                            | `convex/intakeMetadata.ts`             | `ctx.scheduler.runAfter`            | ✓ WIRED | Scheduler call to `internal.intakeMetadata.extractAndPersist` at `convex/intake.ts:63`.                                                                       |
| `convex/intake.ts`                            | `convex/schema.ts`                     | Gutenberg dedupe lookup index       | ✓ WIRED | Dedupe query uses `withIndex("by_gutenberg_id")` at `convex/intake.ts:10`; index exists at `convex/schema.ts:26`.                                             |
| `convex/intakeMetadata.ts`                    | books/jobs tables                      | Success/failure state updates       | ✓ WIRED | Writes `status: completed/failed` to both jobs and books in `convex/intakeMetadata.ts:154` and `convex/intakeMetadata.ts:194`.                                |
| `src/components/ImportModal.tsx`              | `api.intake.enqueueUpload`             | Upload URL flow then enqueue        | ✓ WIRED | Indirectly wired via `api.books.createFromFile` in `src/components/ImportModal.tsx:80`, which forwards to `api.intake.enqueueUpload` in `convex/books.ts:58`. |
| `scripts/discover-library.ts`                 | `api.intake.createDiscoveryCandidates` | `ConvexHttpClient` mutation         | ✓ WIRED | Client mutation call at `scripts/discover-library.ts:138`.                                                                                                    |
| `src/components/DiscoveryCandidatesPanel.tsx` | `api.intake.enqueueDiscoveryCandidate` | Enqueue action with override toggle | ✓ WIRED | Mutation plus `overrideDuplicate` state passed at `src/components/DiscoveryCandidatesPanel.tsx:40`.                                                           |
| `src/lib/jobStatus.ts`                        | `src/components/JobsPage.tsx`          | Single status label map             | ✓ WIRED | Canonical `queued/running/completed/failed` labels at `src/lib/jobStatus.ts:1`, consumed at `src/components/JobsPage.tsx:135`.                                |
| `src/components/JobsPage.tsx`                 | `api.jobs`                             | Grouped summary query subscription  | ✓ WIRED | `useQuery(api.jobs.listGroupedSummary)` at `src/components/JobsPage.tsx:22`.                                                                                  |
| `src/components/JobsPage.tsx`                 | `src/components/JobDetailsDrawer.tsx`  | Expand failure details              | ✓ WIRED | `selectedJobId` controls drawer rendering at `src/components/JobsPage.tsx:23` and `src/components/JobsPage.tsx:220`.                                          |

### Requirements Coverage

| Requirement                                               | Status      | Blocking Issue                                                                                                      |
| --------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| ING-01: import a local `.txt` from dashboard              | ✓ SATISFIED | None (upload modal + Convex upload URL pipeline present).                                                           |
| ING-02: scan `library/` and discover candidates           | ✓ SATISFIED | None (`discover:library` script scans and pushes candidates).                                                       |
| ING-03: extract title/author metadata from Gutenberg text | ✓ SATISFIED | None (upload extraction in `convex/intakeMetadata.ts`; discovery preview parsing in `scripts/discover-library.ts`). |
| OPS-01: track jobs with Queued/Running/Completed/Failed   | ✓ SATISFIED | None (canonical statuses in schema + jobs UI labels).                                                               |
| OPS-02: view per-job progress and error logs in dashboard | ✓ SATISFIED | None (Jobs page shows stage/progress; inline and drawer error/log details).                                         |

### Anti-Patterns Found

| File                          | Line | Pattern                  | Severity | Impact                                            |
| ----------------------------- | ---- | ------------------------ | -------- | ------------------------------------------------- |
| `scripts/discover-library.ts` | 194  | `console.log` CLI output | ℹ️ Info  | Expected script telemetry; not a stub or blocker. |

### Human Verification Required

### 1. Upload Pipeline Live Run

**Test:** Upload a real `.txt` file through dashboard import modal.
**Expected:** Book card appears immediately in Library; Jobs shows queue/running/completed progression.
**Why human:** Requires runtime reactivity/timing confirmation in browser.

### 2. Discovery End-to-End

**Test:** Run `npm run discover:library`, then enqueue at least one candidate from dashboard.
**Expected:** Candidate rows appear pre-enqueue, remain visible post-enqueue, and status updates in-place.
**Why human:** Depends on local filesystem corpus + UI interaction.

### 3. Duplicate UX Branches

**Test:** Attempt upload and discovery enqueue with an existing Gutenberg ID, then retry with override enabled.
**Expected:** Inline duplicate warning/link appears first; override path allows intentional enqueue.
**Why human:** Requires user-flow and visual feedback validation across branches.

### 4. Failure Diagnostics Readability

**Test:** Open a failed job row and verify inline expansion and drawer details.
**Expected:** Snippet, full error details, and logs are understandable and complete.
**Why human:** UX clarity and readability are subjective and visual.

### Gaps Summary

No automated code-level gaps found against declared must-haves. Phase goal appears implemented in code; live UX and end-to-end behavior need human confirmation.

---

_Verified: 2026-02-12T10:44:18Z_
_Verifier: Claude (gsd-verifier)_
