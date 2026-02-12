---
phase: 02-text-cleanup-and-editorial-approval
plan: "01"
type: execute
subsystem: cleanup
autonomous: true
dependency-graph:
  requires: ["convex/schema"]
  provides: ["deterministic-cleanup", "chapter-detection", "review-flags"]
  affects: ["convex/cleanup", "convex/cleanupPipeline", "convex/cleanupChaptering", "convex/cleanupFlags"]
tech-stack:
  added: ["Convex internal actions", "Convex internal mutations", "text processing pipeline"]
  patterns: ["immutable revisions", "flag-based review workflow", "deterministic-first transforms"]
key-files:
  created:
    - convex/cleanup.ts
    - convex/cleanupPipeline.ts
    - convex/cleanupChaptering.ts
    - convex/cleanupFlags.ts
    - src/lib/cleanupText.ts
  modified:
    - convex/schema.ts
key-decisions:
  - Preserved archaic spelling/grammar by default (no modernization)
  - Unlabeled section breaks create review flags rather than auto-promoting to chapters
  - OCR-corrupted headings are accepted with medium confidence and flagged for review
  - Balanced paragraph unwrapping only when continuation signals are strong
  - Boilerplate stripping requires both start and end markers for high confidence
---

# Phase 2 Plan 1: Deterministic Cleanup Foundation — Summary

**Completed:** 2026-02-12  
**Duration:** ~15 minutes  
**Tasks:** 3/3  
**Status:** Complete

## One-liner

Immutable revision storage with deterministic Gutenberg text cleanup (boilerplate stripping, paragraph unwrapping, punctuation normalization) and chapter boundary detection with review flag generation for ambiguous content.

## What Was Built

### Schema Extensions (Task 1)

Extended `convex/schema.ts` with five new tables:

- **cleanupOriginals**: Immutable snapshots of source text
- **cleanupRevisions**: Versioned cleaned text with deterministic/AI-assisted flags
- **cleanupChapters**: Segmented book sections with type labels (chapter, preface, introduction, notes, appendix, body)
- **cleanupFlags**: Reviewer flags for ambiguous boundaries and low-confidence cleanup
- **cleanupJobs**: Pipeline progress tracking with stage/progress

All tables include proper indexes for efficient querying by book, revision, and status.

### Deterministic Pipeline (Task 2)

Implemented in `convex/cleanupPipeline.ts` and `src/lib/cleanupText.ts`:

**Gutenberg Boilerplate Stripping**
- Detects and removes Project Gutenberg start/end markers
- Flags missing markers for reviewer attention

**Balanced Paragraph Unwrapping**
- Unwraps hard-wrapped paragraphs when continuation signals are strong
- Preserves structure when ambiguous
- Never unwraps across chapter headings

**Punctuation Normalization**
- High-confidence transforms: double spaces, straight quotes, dashes, ellipsis
- Low-confidence patterns (archaic punctuation) flagged for review

**Chapter Boundary Detection** (cleanupChaptering.ts)
- Pattern matching for standard headings (Chapter, Preface, Introduction, etc.)
- Roman numeral and numeric chapter support
- OCR corruption detection with medium confidence acceptance
- Unlabeled section breaks create review flags (not auto-chapters)
- Single "body" chapter fallback for books without headings

### Public API (Task 3)

Created `convex/cleanup.ts` with:

- `startCleanup(bookId, preserveArchaic?)`: Queues cleanup job
- `getReviewData(bookId)`: Returns original + latest revision + chapters + flags
- `listReviewFlags(bookId, status?)`: Lists flags with optional status filter
- `resolveFlag(flagId, status, note?)`: Resolves a flag (confirmed/rejected/overridden)
- `promoteBoundaryToChapter(flagId, title, type)`: Promotes unlabeled break to chapter
- `getCleanupStatus(bookId)`: Gets current job status

## Verification

All functions compile and deploy successfully:
- `npm run lint` passes with TypeScript strict mode
- Convex schema validation successful
- All indexes defined per locked decisions

## Deviations from Plan

None — plan executed exactly as written.

## Commits

- `26455a6`: feat(02-01): deterministic cleanup foundation with chapter segmentation

## Next Steps

Plan 02-02 (AI cleanup adapter) can now build on this foundation. The deterministic pipeline provides:
- Immutable original text for reference
- Versioned revision storage for AI-assisted passes
- Flag system for low-confidence cleanup areas
- Chapter segmentation for per-chapter AI processing
