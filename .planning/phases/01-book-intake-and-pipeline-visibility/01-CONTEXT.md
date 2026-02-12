# Phase 1: Book Intake and Pipeline Visibility - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver end-to-end book intake and pipeline observability from the dashboard: manual single-file `.txt` import, local `library/` discovery, Gutenberg metadata extraction (title/author), and job visibility with Queued, Running, Completed, and Failed states including progress and error details.

</domain>

<decisions>
## Implementation Decisions

### Intake flow behavior

- Manual upload creates a visible book record immediately on upload.
- Manual upload auto-starts intake pipeline without a second enqueue action.
- Discovery creates visible candidate rows before enqueue.
- Metadata extraction failure keeps the record with failed status (not removed).

### Duplicate handling policy

- Default dedupe behavior is block by Gutenberg ID.
- Duplicate block feedback is inline warning with link to the existing book.
- Manual upload and discovery use different dedupe policy behavior by source.
- Intentional duplicates require an explicit override toggle (no silent duplicate import).

### Pipeline status details

- Dashboard job rows show stage plus percent by default.
- Failed jobs show inline error snippet with access to expanded details.
- Operator-facing labels use human-friendly state names: Queued, Running, Completed, Failed.
- For books with multiple jobs, default display is grouped summary by state.

### Discovery result UX

- Discovery shows all candidates by default; operator chooses what to enqueue.
- Candidate rows include Gutenberg ID, title/author, and source path.
- Low-confidence or missing metadata candidates remain visible with warning indicators.
- After enqueue, candidate rows stay visible and reflect processing status transitions.

### Claude's Discretion

- Exact source-specific difference for dedupe between manual upload and discovery (while preserving the locked requirement that policies differ by source and require explicit override for intentional duplicates).
- Exact visual pattern for grouped job summaries and expanded error details.
- Exact warning badge wording and visual treatment for low-confidence metadata.

</decisions>

<specifics>
## Specific Ideas

- Intake status should remain visible in-place after enqueue, rather than disappearing from the discovery view.
- Discovery and enqueue are treated as separate operator steps: scanning finds candidates; enqueue starts processing.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

_Phase: 01-book-intake-and-pipeline-visibility_
_Context gathered: 2026-02-12_
