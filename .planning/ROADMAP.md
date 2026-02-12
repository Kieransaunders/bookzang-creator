# Roadmap: BookZang

## Overview

This roadmap turns BookZang from a scaffolded dashboard into a production pipeline that can take Gutenberg text to KDP-ready paperback assets with operator control and compliance checks. Phases are organized by delivery boundaries in the actual workflow: intake and visibility, cleanup and approval, interior formatting/export, then packaging and throughput automation. Completion means one person can reliably process single titles first, then scale across the local library.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Book Intake and Pipeline Visibility** - Local text intake and job observability are working end to end.
- [ ] **Phase 2: Text Cleanup and Editorial Approval** - Gutenberg cleanup and human approval flow produce trusted final text.
- [ ] **Phase 3: Typography Templates and KDP Interior Export** - Approved text renders into validated KDP-ready interior PDFs.
- [ ] **Phase 4: Cover Packaging and Batch Automation** - Folder lifecycle, Canva cover workflow, and local batch runs support production throughput.

## Phase Details

### Phase 1: Book Intake and Pipeline Visibility

**Goal**: User can bring books into the system and monitor pipeline execution status from the dashboard.
**Depends on**: Nothing (first phase)
**Requirements**: ING-01, ING-02, ING-03, OPS-01, OPS-02
**Success Criteria** (what must be TRUE):

1. User can import a single local `.txt` file from the dashboard and see a created book entry.
2. User can trigger discovery from `library/` and see candidate books appear for processing.
3. Imported/discovered books show extracted title and author metadata from Gutenberg text.
4. Pipeline jobs show Queued, Running, Completed, or Failed states with per-job progress and error logs in the dashboard.

**Plans**: TBD

Plans:

- [ ] 01-01: TBD during phase planning

### Phase 2: Text Cleanup and Editorial Approval

**Goal**: User can transform noisy Gutenberg text into high-quality, approved production text with full review control.
**Depends on**: Phase 1
**Requirements**: CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04, CLEAN-05, REVIEW-01, REVIEW-02, REVIEW-03
**Success Criteria** (what must be TRUE):

1. Cleaned text removes Project Gutenberg boilerplate and preserves readable paragraph structure.
2. Chapter boundaries are detected and represented so chaptered formatting can be applied later.
3. AI cleanup improves OCR and punctuation quality while preserving source voice, with original and cleaned versions retained.
4. User can review original vs cleaned content in a side-by-side diff and make manual edits.
5. User can explicitly approve cleaned text to unlock template and export steps.

**Plans**: TBD

Plans:

- [ ] 02-01: TBD during phase planning

### Phase 3: Typography Templates and KDP Interior Export

**Goal**: User can apply typography templates and produce validated, re-downloadable KDP interior PDFs.
**Depends on**: Phase 2
**Requirements**: TPL-01, TPL-02, TPL-03, TPL-04, TPL-05, OUT-01, OUT-02, OUT-04
**Success Criteria** (what must be TRUE):

1. User can apply a template preset and configure typography controls (font, size, line height, margins, headers, page numbers).
2. Interior generation supports 5"x8" and 6"x9" trim sizes and applies page-count-aware gutter rules.
3. Generated interior PDFs embed required fonts and pass KDP-critical checks for trim and margins.
4. User can download stored interior export artifacts for reuse and KDP upload.

**Plans**: TBD

Plans:

- [ ] 03-01: TBD during phase planning

### Phase 4: Cover Packaging and Batch Automation

**Goal**: User can run high-throughput local processing with completed folder lifecycle and cover packaging.
**Depends on**: Phase 3
**Requirements**: ING-04, ING-05, OUT-03, OPS-03
**Success Criteria** (what must be TRUE):

1. After metadata extraction, source folders are renamed from numeric IDs to `AuthorName-BookTitle`.
2. After successful pipeline completion, processed folders move to a `_done` marker state.
3. User can generate and attach a paperback full cover/back PDF workflow via Canva integration.
4. User can run a local Node batch worker to process discovered library books automatically.

**Plans**: TBD

Plans:

- [ ] 04-01: TBD during phase planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase                                           | Plans Complete | Status      | Completed |
| ----------------------------------------------- | -------------- | ----------- | --------- |
| 1. Book Intake and Pipeline Visibility          | 0/TBD          | Not started | -         |
| 2. Text Cleanup and Editorial Approval          | 0/TBD          | Not started | -         |
| 3. Typography Templates and KDP Interior Export | 0/TBD          | Not started | -         |
| 4. Cover Packaging and Batch Automation         | 0/TBD          | Not started | -         |
