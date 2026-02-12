# Project Research Summary

**Project:** BookZang Creator
**Domain:** Automated public-domain book production pipeline (Project Gutenberg to KDP paperback)
**Researched:** 2026-02-12
**Confidence:** HIGH

## Executive Summary

BookZang Creator is best built as a hybrid pipeline: a local Node.js worker handles filesystem-heavy Gutenberg ingestion and folder lifecycle, while Convex manages cloud job state, API orchestration, and realtime UI updates. The recommended production path is text-first and compliance-first: clean and structure Gutenberg text, apply constrained typography templates, generate KDP-ready PDFs with embedded fonts, and gate export through strict validation.

The strongest technical approach is Puppeteer + CSS Paged Media for primary interior rendering, with PDFKit available for low-level edge cases. Kimi K2 is a meaningful differentiator for OCR cleanup and editorial assist, but only after deterministic preprocessing (header/footer removal, hard-wrap unwrapping) and with human-review controls to prevent over-correction. Architecture should keep actions independent and idempotent, with worker orchestration rather than deep action chaining.

The biggest risks are not just technical; they are publishing-policy and production-quality risks. KDP public-domain differentiation rules can cause rejection even when files are technically perfect, and common print failures (font embedding, gutter sizing, bleed mismatch) can invalidate entire batches. The mitigation strategy is explicit: build compliance checks into the core phases, require preflight gates, and prioritize reviewability and resumability before scaling batch throughput.

## Key Findings

### Recommended Stack

Research converges on a pragmatic stack that favors maintainability and KDP compatibility over custom rendering complexity. The baseline is modern web rendering (HTML/CSS -> PDF) with Node-based orchestration and Convex as the state/control plane.

**Core technologies:**

- `puppeteer` (`^24.37.2`): Primary HTML-to-PDF engine for print layouts using CSS `@page` and mirrored margins.
- `pdfkit` (`^0.17.2`): Fallback for low-level PDF manipulation and niche layout/compliance adjustments.
- `openai` (`^4.x`) with Moonshot base URL: Client for Kimi K2 long-context cleanup and enrichment workflows.
- `googleapis` (`^171.4.0`): Official Google Drive integration for export and artifact organization.
- `fs-extra` (`^11.3.3`) + `glob` (`^11.x`): Reliable local filesystem operations and Gutenberg folder scanning.
- `fontkit` (`^2.0.4`): Font metrics/subsetting support to improve embed quality and PDF size control.
- Convex Node runtime (`"use node"`): Required for Puppeteer/PDF libraries and external service orchestration in actions.

**Critical version/runtime requirements:**

- Node `20+` is the safe baseline (required by `chokidar@5` if used, aligns with Convex Node runtime needs).
- Convex actions have timeout/memory constraints, so long operations must be chunked and checkpointed.
- Chromium bundle size and cold starts are real operational costs; design deployment around them.

### Expected Features

Feature research clearly separates launch-critical pipeline capabilities from scale/polish enhancements. The MVP must reliably produce KDP-ready interiors; differentiators should accelerate throughput and cleanup quality without expanding scope into unrelated publishing tools.

**Must have (table stakes):**

- Gutenberg import + boilerplate removal + hard-wrap normalization.
- Basic chapter detection and structure tagging.
- Template CRUD/application and essential typography controls.
- KDP trim-size-aware PDF generation with embedded fonts.
- PDF preview + KDP validation gate before export.
- Job queue integration for long-running steps.

**Should have (competitive):**

- AI-assisted OCR cleanup with reviewable change logs.
- Batch processing for overnight multi-book throughput.
- Quality scoring dashboard and automated preflight warnings.
- Auto-TOC, smart quote conversion, template cloning/variants.
- Canva cover import + validation (not cover creation).

**Defer (v2+):**

- ML-heavy chapter/paragraph classification.
- Advanced typography automation (widow/orphan, smart hyphenation, ornamental systems).
- EPUB/hardcover and other cross-format scope expansions.
- Built-in cover design or collaborative editing.

### Architecture Approach

Architecture should follow a local-to-cloud bridge: local worker for file I/O and folder state, Convex HTTP actions for ingress/orchestration, Convex actions for external APIs/heavy processing, and Convex mutations/queries for job and book state. Keep text and PDF artifacts in file storage (ID references in tables), enforce idempotent HTTP endpoints, and let the worker orchestrate phase transitions with resumable job boundaries.

**Major components:**

1. Local worker (`worker/*`) — scans Gutenberg folders, reads files, manages renames (`numbered -> named -> _done`), triggers cloud pipeline.
2. Convex pipeline APIs (`convex/pipeline/*`) — HTTP ingress, action execution (AI/PDF/integrations), mutation-driven state transitions.
3. React dashboard (`src/components/*`) — observability and intervention UI for jobs, diffs, templates, and validation outcomes.
4. Convex storage/database — durable artifact storage + normalized metadata for books/jobs/templates.

### Critical Pitfalls

1. **KDP differentiation failures** — Mitigate by adding explicit original value (annotations/illustrations), labeling contribution in title/description, and validating policy compliance pre-export.
2. **Hard-wrap and structure corruption** — Mitigate with deterministic paragraph-boundary detection before AI cleanup, special handling for poetry/dialogue, and manual override pathways.
3. **AI over-correction/hallucination** — Mitigate with strict prompts, high-confidence thresholds, diff review UI, and preservation of source text lineage.
4. **Font embedding rejection** — Mitigate with curated embeddable font allow-list, explicit embedding checks, and KDP preview validation before batch release.
5. **Dynamic layout compliance misses (gutter/bleed/page count)** — Mitigate with page-count-aware gutter rules and consistent bleed sizing decisions before rendering.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Pipeline Foundation and Compliance Baseline

**Rationale:** Every downstream feature depends on stable ingestion, schema, and job-state orchestration.
**Delivers:** Enhanced Convex schema, idempotent pipeline HTTP actions, local worker scan/upload, initial job lifecycle.
**Addresses:** Text import, book/job CRUD integration, queue integration, basic observability.
**Avoids:** Duplicate records, oversized mutation payloads, brittle orchestration.

### Phase 2: Deterministic Text Processing and Safe AI Cleanup

**Rationale:** Cleanup quality is the highest-leverage determinant of output quality and AI reliability.
**Delivers:** PG boilerplate removal, hard-wrap normalization, regex chapter detection, Kimi cleanup with chunking/retries/confidence, correction diffs.
**Addresses:** Core text pipeline + AI differentiator.
**Avoids:** Paragraph corruption, chapter loss, hallucinated edits.

### Phase 3: KDP-Ready PDF Rendering and Validation Gate

**Rationale:** Rendering and compliance are the publishability bottleneck; failures here invalidate all prior work.
**Delivers:** Template application, typography controls, Puppeteer-based interior PDFs, dynamic gutter logic, bleed/no-bleed handling, font embedding checks, export gate.
**Uses:** `puppeteer`, `fontkit`, optional `pdfkit` fallback.
**Implements:** Convex action pipeline + storage artifacts + validation reporting.

### Phase 4: Review UX, Cover Integration, and Export Packaging

**Rationale:** Human review and packaging reduce rejection/rework and improve operator throughput.
**Delivers:** Job details diff UI, preflight checklist UX, Canva cover import/validation, metadata export package, optional Drive export.
**Addresses:** Preview, final QA flow, cover-to-interior consistency.
**Avoids:** "Looks done but isn't" release mistakes and late-stage upload failures.

### Phase 5: Batch Throughput and Operational Hardening

**Rationale:** Scale should come only after single-book correctness is proven.
**Delivers:** Batch runs, checkpoint/resume, retry policy, memory-safe streaming, concurrency/rate-limit controls.
**Addresses:** Overnight processing goals and large-library reliability.
**Avoids:** Memory exhaustion, API quota thrash, unrecoverable long-run failures.

### Phase Ordering Rationale

- Dependency-first ordering: ingestion/state -> text integrity -> render/compliance -> operator UX -> throughput.
- Architecture alignment: worker-cloud contract stabilizes early, enabling independent action modules later.
- Risk-first sequencing: highest-rejection failure modes (policy, typography, PDF specs) are handled before scale features.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 2:** AI correction policy, confidence calibration, and review thresholds for historical text preservation.
- **Phase 3:** KDP technical compliance edge cases (PDF/X handling, true embedding verification across fonts, bleed interactions).
- **Phase 4:** Public-domain differentiation interpretation (especially AI-generated annotations) and Canva API workflow constraints.

Phases with standard patterns (skip research-phase):

- **Phase 1:** Convex schema/mutation/job-state + worker HTTP bridge patterns are well documented.
- **Phase 5 (core mechanics):** Batch retry/checkpoint/memory strategies are mature engineering patterns.

## Confidence Assessment

| Area         | Confidence  | Notes                                                                                                        |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------------------ |
| Stack        | HIGH        | Core packages, versions, and runtime constraints validated with official docs/npm sources.                   |
| Features     | HIGH        | Strong alignment with KDP requirements and competitive product baselines.                                    |
| Architecture | MEDIUM-HIGH | Convex/worker patterns are solid; some PDF and long-action decisions still need implementation validation.   |
| Pitfalls     | HIGH        | Critical policy/spec pitfalls are clear and repeatedly evidenced; edge-case remedies need empirical testing. |

**Overall confidence:** HIGH

### Gaps to Address

- **Public-domain differentiation ambiguity:** Validate whether AI-generated annotations satisfy KDP "original contribution" expectations before scaling uploads.
- **PDF compliance verification depth:** Decide exact validation stack (automated checks + KDP preview protocol) for font embedding/PDF profile confidence.
- **Puppeteer vs PDFKit boundary:** Finalize default renderer and fallback trigger criteria with benchmarked quality and performance data.
- **Chapter detection robustness:** Define acceptance metrics on a diverse Gutenberg corpus and include manual override UX from day one.
- **Operational limits:** Establish concrete rate/memory budgets for batch runs (API quotas, action timeout behavior, local heap limits).

## Sources

### Primary (HIGH confidence)

- Official Amazon KDP documentation — public-domain policy, trim/margin/bleed requirements, formatting rejection criteria.
- Convex official docs — actions, HTTP actions, runtimes, orchestration constraints.
- Official package/docs sources (`puppeteer`, `pdfkit`, `googleapis`, `fontkit`, Canva Connect docs, Moonshot API docs).

### Secondary (MEDIUM confidence)

- Industry and practitioner analyses of PDF generation libraries, publishing workflows, and typography practices.
- Comparative tooling research (Atticus/Reedsy ecosystem and KDP formatting guides).

### Tertiary (LOW confidence)

- Community forum threads and blog posts on edge-case failures and workflow workarounds; useful signals but require local validation.

---

_Research completed: 2026-02-12_
_Ready for roadmap: yes_
