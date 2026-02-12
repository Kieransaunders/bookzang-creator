# BookZang

## What This Is

BookZang is an internal production tool for iConnectIT that turns public domain books from Project Gutenberg into print-ready KDP paperbacks. It processes a local 30GB Gutenberg library — cleaning raw text with AI, applying professional book templates with full typographic control, and generating KDP-spec interior PDFs and cover artwork via Canva. Single-user tool built for speed: the goal is to produce a large catalogue of well-formatted classic books for passive income on Amazon KDP.

## Core Value

Take a raw Gutenberg text file and produce a KDP-ready paperback interior PDF with professional typography — fast enough to process hundreds of books.

## Requirements

### Validated

- ✓ User authentication (email/password + anonymous) — existing
- ✓ Dashboard UI with sidebar navigation — existing
- ✓ Book management CRUD (list, create, update, delete) — existing
- ✓ Job queue system with progress tracking — existing
- ✓ Template system with multiple presets (Classic, Modern, Large Print) — existing
- ✓ File upload and storage — existing
- ✓ Import modal (Gutenberg ID/URL + file upload) — existing

### Active

- [ ] Local library folder scanning — read books from `library/` folder on disk
- [ ] Folder management — rename numbered folders to `AuthorName-BookTitle`, mark `_done` when processed
- [ ] Manual text file upload — import individual .txt files through the UI
- [ ] Gutenberg text parsing — extract title, author, and body from raw Gutenberg text files
- [ ] AI-assisted text cleanup — strip PG boilerplate, unwrap hard-wrapped lines, detect chapters, fix OCR errors, normalize punctuation (via Kimi K2 API)
- [ ] Side-by-side diff review — compare original vs cleaned text, allow manual edits before finalizing
- [ ] KDP-spec PDF generation — interior PDF with correct trim size (5"x8" or 6"x9"), gutter margins, embedded fonts, drop caps, running headers, page numbers
- [ ] Template engine with full typographic control — fonts, margins, line height, drop caps, chapter ornaments, headers/footers
- [ ] Cover/back PDF generation via Canva API integration
- [ ] Batch processing — local Node script to scan `library/` folder and process books automatically
- [ ] Google Drive export — optional push of finished PDFs to Google Drive for storage

### Out of Scope

- SaaS/multi-user — internal single-user tool only, SaaS pivot is a future decision
- Kindle eBook format (DOCX/KPF) — paperback PDF first, Kindle format in a future milestone
- ePub generation — not needed for KDP paperback workflow
- Direct KDP upload integration — manual upload to KDP for now
- Sales tracking dashboard — track sales externally
- Cover design AI generation — use Canva for covers, not AI image generation
- Real-time chat or collaboration — single user, no collaboration features
- Mobile app — desktop/web only

## Context

**Business model:** Zero marginal cost publishing. 76,000+ free public domain texts, professional formatting is the differentiator. Target: 50-title catalogue in first few months, £500/month passive income.

**Existing codebase:** React 19 + Vite + TypeScript frontend with Convex serverless backend. Dashboard, auth, book CRUD, job system, and template management are scaffolded but the core processing pipeline (text cleanup, PDF generation) is not yet functional.

**Local library:** ~30GB Gutenberg collection downloaded to `library/` folder. Books organized in numbered folders (e.g., `library/12345/`) without meaningful names. Pipeline needs to extract metadata and rename folders.

**KDP specs:** Interior PDF requires embedded fonts, correct trim size (trade paperback 5"x8" or 6"x9"), minimum 24pt gutter margins, no crop marks. Cover is a separate PDF. Amazon flags low-quality and duplicate public domain books — professional formatting is the value-add.

**Legal:** Public domain texts are free to republish commercially. Must strip all Project Gutenberg branding. Copyright applies only to original additions (covers, introductions), not the text itself.

## Constraints

- **AI API**: Kimi K2 API for text cleanup — pay-per-use, need to handle rate limits and costs
- **Local processing**: 30GB library on disk, processing must handle filesystem operations (Mac Mini)
- **KDP compliance**: PDF output must meet Amazon's exact print specifications or uploads will be rejected
- **Single user**: No multi-tenancy, no auth complexity beyond what exists
- **Canva API**: Cover generation depends on Canva API availability and capabilities
- **n8n available**: Existing n8n server available for automation workflows if needed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Local library processing over Gutenberg API | Already downloaded 30GB library, avoid rate limiting, faster processing | — Pending |
| Kimi K2 for AI text cleanup | User has existing API access, cost-effective for batch processing | — Pending |
| Cloud Convex for metadata, local files on disk | DB only stores small metadata, 30GB stays on filesystem | — Pending |
| Node.js for batch processing script | Consistent with existing TypeScript stack, shares Convex client | — Pending |
| Canva API for covers | Professional cover templates, user preference | — Pending |
| PDF-first (no Kindle DOCX in MVP) | Paperback is the primary revenue channel, Kindle format deferred | — Pending |
| Side-by-side diff for review | Allows quality control without slowing down the pipeline | — Pending |

---
*Last updated: 2026-02-12 after initialization*
