# Requirements: BookZang

**Defined:** 2026-02-12
**Core Value:** Take a raw Gutenberg text file and produce a KDP-ready paperback interior PDF with professional typography — fast enough to process hundreds of books.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Library Ingestion

- [ ] **ING-01**: User can import a single local `.txt` file from the dashboard.
- [ ] **ING-02**: System can scan `library/` for numbered Gutenberg folders and discover candidate books.
- [ ] **ING-03**: System can extract title and author metadata from imported Gutenberg text.
- [ ] **ING-04**: System can rename source folder from numeric ID to `AuthorName-BookTitle` after successful metadata extraction.
- [ ] **ING-05**: System can move completed source folders to a `_done` marker state after successful pipeline completion.

### Text Cleanup

- [ ] **CLEAN-01**: System removes Project Gutenberg header, footer, and license boilerplate from raw text.
- [ ] **CLEAN-02**: System unwraps hard-wrapped lines into readable paragraph structure while preserving intentional line breaks.
- [ ] **CLEAN-03**: System detects chapter boundaries and outputs structured chapter metadata.
- [ ] **CLEAN-04**: System performs AI-assisted cleanup via Kimi K2 for OCR errors and punctuation normalization without rewriting author voice.
- [ ] **CLEAN-05**: System stores original and cleaned versions for comparison and rollback.

### Review and Approval

- [ ] **REVIEW-01**: User can review original vs cleaned text in a side-by-side diff UI.
- [ ] **REVIEW-02**: User can manually edit cleaned text before final formatting.
- [ ] **REVIEW-03**: User can approve cleaned content to continue to template and export steps.

### Templates and Typography

- [ ] **TPL-01**: User can apply a template preset to a book interior.
- [ ] **TPL-02**: System supports KDP trim sizes for paperback interiors (including 5"x8" and 6"x9").
- [ ] **TPL-03**: System applies page-count-aware gutter margin rules required by KDP.
- [ ] **TPL-04**: System embeds all fonts used in generated interior PDFs.
- [ ] **TPL-05**: User can control core typography settings (font, size, line height, margins, headers, page numbers).

### Output and Compliance

- [ ] **OUT-01**: System generates a KDP-ready interior paperback PDF from approved cleaned text and selected template.
- [ ] **OUT-02**: System validates generated interior PDF against KDP-critical checks (trim size, margin rules, embedded fonts).
- [ ] **OUT-03**: User can generate and attach a paperback full cover/back PDF workflow via Canva integration.
- [ ] **OUT-04**: System stores generated export artifacts and allows re-download for re-upload.

### Operations

- [ ] **OPS-01**: System tracks pipeline jobs with statuses (Queued, Running, Completed, Failed).
- [ ] **OPS-02**: User can view per-job progress and error logs from the dashboard.
- [ ] **OPS-03**: User can run local batch processing over discovered library books using a Node-based worker script.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Distribution and Scale

- **DIST-01**: User can export finished artifacts automatically to Google Drive.
- **DIST-02**: System supports direct marketplace upload automation when stable APIs are available.

### Advanced Production

- **ADV-01**: System generates Kindle DOCX/KPF outputs in addition to paperback PDFs.
- **ADV-02**: System supports additional template families (Poetry, Large Print, specialty layouts).
- **ADV-03**: System adds advanced typographic polish (widow/orphan control, smart hyphenation, richer ornaments).

### Product Expansion

- **EXP-01**: System supports multi-user collaboration and permissions.
- **EXP-02**: System supports external SaaS accounts and billing.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature                 | Reason                                                                 |
| ----------------------- | ---------------------------------------------------------------------- |
| Built-in cover designer | Canva integration is preferred; avoid duplicating a mature design tool |
| EPUB-first pipeline     | MVP is paperback-first for KDP print economics                         |
| Mobile app              | Desktop/web workflow is sufficient for internal single-user use        |
| Real-time collaboration | Tool is single-user for this milestone                                 |
| OCR from scanned images | Input source is text-based Gutenberg files, not image scans            |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status  |
| ----------- | ----- | ------- |
| ING-01      | 1     | Pending |
| ING-02      | 1     | Pending |
| ING-03      | 1     | Pending |
| ING-04      | 4     | Pending |
| ING-05      | 4     | Pending |
| CLEAN-01    | 2     | Pending |
| CLEAN-02    | 2     | Pending |
| CLEAN-03    | 2     | Pending |
| CLEAN-04    | 2     | Pending |
| CLEAN-05    | 2     | Pending |
| REVIEW-01   | 2     | Pending |
| REVIEW-02   | 2     | Pending |
| REVIEW-03   | 2     | Pending |
| TPL-01      | 3     | Pending |
| TPL-02      | 3     | Pending |
| TPL-03      | 3     | Pending |
| TPL-04      | 3     | Pending |
| TPL-05      | 3     | Pending |
| OUT-01      | 3     | Pending |
| OUT-02      | 3     | Pending |
| OUT-03      | 4     | Pending |
| OUT-04      | 3     | Pending |
| OPS-01      | 1     | Pending |
| OPS-02      | 1     | Pending |
| OPS-03      | 4     | Pending |

**Coverage:**

- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---

_Requirements defined: 2026-02-12_
_Last updated: 2026-02-12 after roadmap mapping_
