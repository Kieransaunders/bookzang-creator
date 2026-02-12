# Feature Research: Book Production Pipeline / Automated KDP Publishing

**Domain:** Book production pipeline for public domain texts to KDP paperback
**Researched:** 2026-02-12
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or tool is unusable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Text Import from Local Gutenberg Library** | Core input for the workflow | LOW | File picker, path scanning for 30GB local library |
| **PG Header/Footer Removal** | Every Gutenberg text has this boilerplate | LOW | Standard pattern matching, well-documented markers |
| **Hard-wrapped Line Unwrapping** | Gutenberg texts use 65-70 char hard wraps | MEDIUM | Distinguish paragraphs from intentional breaks (poetry, lists) |
| **Chapter Detection & Tagging** | Books need structure for TOC and navigation | MEDIUM | Regex patterns for "Chapter I", "Chapter 1", "CHAPTER ONE", etc. |
| **Basic PDF Generation** | Core output format for KDP paperback | MEDIUM | 300 DPI, embedded fonts, correct trim size, no bleed initially |
| **KDP Trim Size Selection** | Standard sizes required by KDP specs | LOW | Dropdown with common sizes (5x8, 5.5x8.5, 6x9) |
| **Template Application** | Apply consistent formatting to all books | MEDIUM | Typography presets (font, size, margins, spacing) |
| **Book CRUD Operations** | Manage multiple books in pipeline | LOW | Already scaffolded in existing app |
| **Job Queue for Processing** | Text cleanup and PDF generation take time | MEDIUM | Already scaffolded, needs integration with processing steps |
| **Basic Typography Controls** | Font family, size, line height, margins | LOW | Essential for readable books |
| **PDF Preview** | See output before finalizing | MEDIUM | Embed PDF viewer or download for external review |
| **Export to KDP-spec PDF** | Final output must meet KDP requirements | HIGH | 300 DPI, embedded fonts, correct margins based on page count, proper trim |

### Differentiators (Competitive Advantage)

Features that set product apart. Not expected, but valuable for speed and quality.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **AI-Assisted Text Cleanup** | Kimi K2 API fixes OCR errors, inconsistent punctuation, typos | HIGH | Core competitive advantage - most competitors use manual cleanup |
| **Smart Chapter Detection** | ML/heuristics to handle variant chapter heading formats | MEDIUM | Better than regex-only; handles "Part I", "Book First", etc. |
| **Paragraph Type Recognition** | Distinguish dialogue, poetry, block quotes, lists | HIGH | Enables better formatting decisions automatically |
| **Batch Book Processing** | Process 10+ books overnight | MEDIUM | Speed advantage for 50+ book goal |
| **Template Cloning & Variants** | Create genre-specific templates (fiction, poetry, essays) | LOW | Reuse formatting decisions across similar books |
| **Smart Hyphenation** | Context-aware hyphenation for professional typography | MEDIUM | Avoids awkward breaks, respects word boundaries |
| **Widow/Orphan Prevention** | Automatic adjustment to avoid single-line paragraphs | MEDIUM | Professional book design standard |
| **Quality Score Dashboard** | Visual indicators of text quality issues before processing | MEDIUM | Flags excessive caps, missing chapters, OCR problems |
| **One-Click Cover Integration** | Import from Canva, auto-resize to KDP specs | LOW | Workflow efficiency, since covers done in Canva |
| **Advanced Typography Presets** | Drop caps, ornamental breaks, chapter headers | MEDIUM | Visual differentiation from low-quality competitors |
| **Auto-Generated TOC** | Based on detected chapter structure | LOW | Professional feature, KDP requirement for ebooks |
| **Metadata Extraction** | Pull title, author, year from Gutenberg records | LOW | Pre-fill KDP upload fields, save manual entry time |
| **Validation Against KDP Specs** | Pre-flight check before export | MEDIUM | Margin validation by page count, DPI check, font embedding check |
| **Processing History Log** | Audit trail of AI cleanup decisions | LOW | Transparency into what was changed, rollback capability |
| **Smart Quote Conversion** | Straight quotes to curly quotes with context awareness | LOW | Professional typography, handles apostrophes correctly |

### Anti-Features (Deliberately NOT Building)

Features that seem good but create problems or scope creep.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Built-in Cover Designer** | Canva already handles this well, UI complexity explosion | Import from Canva, validate KDP specs (bleed, spine calc) |
| **Ebook (EPUB) Export** | Scope creep; paperback-first strategy for public domain | Focus on paperback PDFs; EPUB can be future milestone |
| **Direct KDP Upload API** | Amazon doesn't provide public KDP API; would require fragile web automation | Export KDP-ready PDF, metadata CSV for batch upload preparation |
| **Multi-user Collaboration** | Single-user internal tool for iConnectIT | Keep it simple; no auth complexity, permissions, conflicts |
| **OCR from Scanned Images** | Gutenberg already provides text; OCR is separate problem domain | Accept text input only from existing Gutenberg library |
| **Real-time Collaborative Editing** | Unnecessary complexity for single-user batch workflow | Standard CRUD with save/load, no WebSocket overhead |
| **Advanced Page Layout Designer** | InDesign-level complexity not needed for text-heavy books | Template-based approach with constrained controls |
| **Custom Font Uploads** | Licensing nightmare, KDP font embedding risks | Curated list of safe, embeddable, professional book fonts |
| **Hardcover Support** | KDP paperback specs different from hardcover; adds complexity | Paperback-only initially; hardcover can be future milestone |
| **Print Preview with Page Flip Animation** | Gimmick; static PDF preview is sufficient | Standard PDF viewer embed or download |

## Feature Dependencies

```
Text Import
    └──requires──> Local File System Access
    └──enables──> PG Header/Footer Removal
                      └──enables──> Hard-wrapped Line Unwrapping
                                       └──enables──> AI-Assisted Text Cleanup
                                                        └──enables──> Chapter Detection
                                                                         └──enables──> Auto-Generated TOC

Template Management
    └──requires──> Typography Controls
    └──enables──> Template Application
                    └──requires──> Chapter Detection (for structure)

PDF Generation
    └──requires──> Template Application
    └──requires──> KDP Trim Size Selection
    └──requires──> Embedded Fonts
    └──enables──> PDF Preview
                    └──enables──> Export to KDP-spec PDF
                                     └──requires──> Validation Against KDP Specs

Batch Processing
    └──requires──> Job Queue
    └──requires──> All individual processing features

Quality Assurance
    └──requires──> Validation Against KDP Specs
    └──enhances──> Quality Score Dashboard
```

### Dependency Notes

- **AI-Assisted Text Cleanup requires prior unwrapping:** Can't effectively process hard-wrapped lines; unwrap first, then send to AI
- **Chapter Detection enhances PDF Generation:** Structured content enables better page breaks, TOC, headers
- **Validation blocks Export:** Don't allow export of PDFs that will fail KDP review
- **Batch Processing is last:** Requires all individual steps working correctly first

## MVP Definition

### Launch With (v1.0 - Core Pipeline)

Minimum viable product to start producing KDP-ready books.

- [x] Text Import from Local Gutenberg Library
- [x] PG Header/Footer Removal
- [x] Hard-wrapped Line Unwrapping
- [x] Basic Chapter Detection (regex patterns)
- [x] AI-Assisted Text Cleanup via Kimi K2
- [x] Template Management (create, edit, apply)
- [x] Basic Typography Controls (font, size, margins, line height)
- [x] PDF Generation (300 DPI, embedded fonts, KDP trim sizes)
- [x] PDF Preview
- [x] Export to KDP-spec PDF
- [x] Validation Against KDP Specs (margins, DPI, fonts)
- [x] Job Queue Integration for long-running tasks

**Rationale:** This is the minimum to go from Gutenberg text → KDP-ready PDF with professional formatting that stands out from competitors.

### Add After Initial Production (v1.1-1.3)

Features to add once core pipeline proves viable with first 10-20 books.

- [ ] Batch Book Processing (process 5-10 books overnight)
- [ ] Quality Score Dashboard (pre-processing validation)
- [ ] Smart Quote Conversion
- [ ] Auto-Generated TOC
- [ ] Template Cloning & Variants
- [ ] Metadata Extraction from Gutenberg
- [ ] Processing History Log (audit trail)
- [ ] One-Click Cover Integration from Canva

**Trigger for adding:** Successfully produced and uploaded 10+ books manually; identified repetitive pain points.

### Future Consideration (v2.0+)

Features to defer until production workflow is mature and scaling.

- [ ] Smart Chapter Detection (ML-based, handles variants)
- [ ] Paragraph Type Recognition (dialogue, poetry, quotes)
- [ ] Advanced Typography (drop caps, ornamental breaks, widow/orphan prevention)
- [ ] Smart Hyphenation (context-aware)
- [ ] Ebook (EPUB) Export
- [ ] Hardcover Support
- [ ] Advanced Cover Tools (spine calculator for varying page counts)

**Why defer:** Complexity doesn't justify value until high-volume production (50+ books). MVP proves concept first.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| PG Header/Footer Removal | HIGH | LOW | P1 |
| Hard-wrapped Line Unwrapping | HIGH | MEDIUM | P1 |
| AI-Assisted Text Cleanup | HIGH | HIGH | P1 |
| Basic Chapter Detection | HIGH | MEDIUM | P1 |
| Template Application | HIGH | MEDIUM | P1 |
| PDF Generation (KDP-spec) | HIGH | MEDIUM | P1 |
| Validation Against KDP Specs | HIGH | MEDIUM | P1 |
| PDF Preview | HIGH | MEDIUM | P1 |
| Batch Processing | HIGH | MEDIUM | P2 |
| Quality Score Dashboard | MEDIUM | MEDIUM | P2 |
| Smart Quote Conversion | MEDIUM | LOW | P2 |
| Auto-Generated TOC | MEDIUM | LOW | P2 |
| Template Cloning | MEDIUM | LOW | P2 |
| Metadata Extraction | LOW | LOW | P2 |
| Processing History Log | LOW | LOW | P2 |
| Cover Integration | MEDIUM | LOW | P2 |
| Smart Chapter Detection (ML) | MEDIUM | HIGH | P3 |
| Paragraph Type Recognition | MEDIUM | HIGH | P3 |
| Advanced Typography | LOW | HIGH | P3 |
| Smart Hyphenation | LOW | MEDIUM | P3 |
| Widow/Orphan Prevention | LOW | MEDIUM | P3 |
| EPUB Export | LOW | HIGH | P3 |
| Hardcover Support | LOW | MEDIUM | P3 |

**Priority key:**
- **P1**: Must have for MVP launch (can't produce KDP-ready books without it)
- **P2**: Should have for efficiency (manual workarounds exist but slow)
- **P3**: Nice to have for quality/scale (future enhancements)

## Text Cleanup & Processing Features (Detailed Analysis)

### What Transformations Do Gutenberg Texts Need?

Based on research into Gutenberg text processing tools and common patterns:

**1. Metadata Removal (Table Stakes)**
- Remove PG header (between `*** START OF THE PROJECT GUTENBERG...` and first content)
- Remove PG footer (from `*** END OF THE PROJECT GUTENBERG...` to EOF)
- Strip "Produced by" credits
- Remove transcriber notes (often in brackets)

**2. Line Unwrapping (Table Stakes)**
- Gutenberg texts use hard wraps at 65-70 characters
- Must distinguish:
  - **Paragraphs:** Join wrapped lines into single paragraph
  - **Intentional breaks:** Preserve poetry, lists, chapter headings, section breaks
  - **Dialogue:** Maintain paragraph boundaries
- Algorithm: Join lines unless followed by blank line, indentation change, or caps heading

**3. OCR Error Correction (Differentiator - AI-Assisted)**
- Common OCR errors in Gutenberg texts:
  - `rn` misread as `m` (or vice versa)
  - `l` (lowercase L) vs `1` (number one) vs `I` (capital i)
  - Smart quote encoding issues (`â€™` instead of apostrophe)
  - Spurious hyphens mid-word
  - Missing spaces after punctuation
- AI approach (Kimi K2): Send paragraph context, flag suspicious words, get corrections

**4. Punctuation Normalization (Differentiator)**
- Straight quotes (`"` `'`) → Curly quotes (`"` `"` `'` `'`)
- Context-aware apostrophes (don't, it's, '90s)
- Double hyphens (`--`) → Em dashes (`—`)
- Ellipses (`...` or `. . .`) → Proper ellipsis (`…`)
- Smart spacing around punctuation

**5. Chapter Structure Detection (Table Stakes)**
- Regex patterns to match:
  - `Chapter [IVXLC]+` (Roman numerals)
  - `Chapter [0-9]+` (Arabic numerals)
  - `CHAPTER ONE`, `CHAPTER TWO`, etc. (spelled out)
  - `Part I`, `Book First`, etc. (subdivisions)
- Extract chapter title/number
- Tag for TOC generation
- Insert page breaks before chapters in PDF

**6. Special Formatting Detection (Differentiator - Future)**
- Poetry (short lines, intentional line breaks)
- Block quotes (indented paragraphs)
- Letters/documents within text
- Scene breaks (often `* * *` or similar)
- Footnotes/endnotes (numbered references)

## PDF/Book Formatting Features (Detailed Analysis)

### What Typography Controls Matter for Professional Books?

Based on research into professional book design standards:

**1. Font Selection (Table Stakes)**
- **Body text:** Serif fonts for readability (Garamond, Baskerville, Palatino, Century)
- **Headings:** Same serif or complementary sans-serif
- **Size:** 11-12pt for body text (adjust for font and trim size)
- **Embedding:** All fonts must be embedded in PDF for KDP

**2. Margins (Table Stakes - KDP Spec Driven)**
- KDP margin requirements vary by page count:
  - 24-150 pages: 0.375" inside margin
  - 151-300 pages: 0.5" inside margin
  - 301-500 pages: 0.625" inside margin
  - 501-700 pages: 0.75" inside margin
  - 701-828 pages: 0.875" inside margin
- **Top/Bottom/Outside:** Minimum 0.5", recommended 0.75"
- **Gutter (inside):** Larger to account for binding
- **Classic ratio:** 1:1:2:3 (inner:top:outer:bottom)

**3. Line Spacing & Leading (Table Stakes)**
- **Line height:** 1.2-1.5x font size (120%-150%)
- **Paragraph spacing:** 0-6pt between paragraphs OR first-line indent (not both)
- **First-line indent:** 0.25"-0.5" for new paragraphs
- **No indent:** First paragraph after chapter heading or section break

**4. Characters Per Line (Quality Standard)**
- Optimal: 65-70 characters (including spaces)
- Achieved by balancing: trim size, margins, font size, font choice
- Too few = choppy reading; too many = eye fatigue

**5. Hyphenation (Differentiator)**
- Enable hyphenation for justified text
- Limit consecutive hyphens to 2-3 lines
- Avoid hyphenating last word on page
- Manual hyphen control for awkward breaks

**6. Widows & Orphans (Differentiator - Professional Polish)**
- **Widow:** Last line of paragraph at top of page
- **Orphan:** First line of paragraph at bottom of page
- **Fix:** Adjust spacing or tracking slightly to pull/push lines

**7. Running Headers (Table Stakes)**
- Book title or author on verso (left) pages
- Chapter title on recto (right) pages
- Page numbers (footer or header, inside or outside)
- First page of chapter: no header, page number in footer (optional)

**8. Chapter Opening Pages (Differentiator - Visual Quality)**
- Start chapters on recto (right-hand) page
- Extra whitespace before chapter title (1/3 down page)
- Optional drop cap for first paragraph
- Optional ornamental break/decoration

**9. Trim Size Selection (Table Stakes)**
- Common KDP sizes:
  - 5" x 8" (standard fiction)
  - 5.5" x 8.5" (popular fiction)
  - 6" x 9" (common for nonfiction, also good for classic literature)
  - 8.5" x 11" (large format, rare for novels)
- Must match exactly in PDF

**10. Bleed (Optional for Interior)**
- KDP allows interior bleed (0.125" on all sides)
- Only needed if images/graphics extend to edge
- Text-only books: no bleed required (saves margin space)

## Template Management Features (Detailed Analysis)

### What Do Book Designers Need to Control?

**1. Template CRUD (Table Stakes)**
- Create new template
- Edit existing template
- Delete template
- Clone template for variations
- Set default template

**2. Typography Presets (Table Stakes)**
- Font family (body, headings, page numbers)
- Font size (body, headings, subheadings)
- Line height / leading
- Character spacing / tracking
- Word spacing
- Paragraph indent
- Paragraph spacing

**3. Margin Presets (Table Stakes)**
- Top, bottom, inside (gutter), outside
- Different for odd/even pages (mirrored margins)
- Different for chapter opening pages
- Override for specific content types (poetry, block quotes)

**4. Header/Footer Configuration (Table Stakes)**
- Include/exclude headers
- Include/exclude page numbers
- Position (top/bottom, inside/outside, center)
- Text content (static or dynamic from chapter title)
- Font and size
- First page exceptions

**5. Chapter Formatting (Table Stakes)**
- Start chapter on recto/any page
- Whitespace above chapter title
- Chapter title font, size, alignment
- Chapter number format (Roman, Arabic, spelled out)
- Decorative elements (rules, ornaments)

**6. Content Type Rules (Differentiator)**
- Paragraph: normal formatting
- Poetry: preserve line breaks, center or indent
- Block quote: indent, italic, smaller font
- Dialogue: standard paragraph with optional indent variation
- Scene break: ornament or extra space

**7. Preview & Test (Table Stakes)**
- Preview template applied to sample text
- Generate test PDF with representative content
- Side-by-side comparison of templates

**8. Import/Export Templates (Nice-to-Have)**
- Export template as JSON for backup
- Import template from file
- Share templates (single-user, so low priority)

## Batch Processing Features (Detailed Analysis)

### What Does a Book Production Queue Need?

**1. Job Queue System (Table Stakes)**
- Already scaffolded in existing app
- Integration points:
  - Text cleanup (AI calls, I/O-bound)
  - PDF generation (CPU-bound)
  - Validation (quick, sync)

**2. Batch Job Creation (Core Feature)**
- Select multiple books from library
- Apply same template to all
- Choose processing steps (cleanup, format, generate PDF)
- Set priority for urgent books

**3. Job Status Tracking (Table Stakes)**
- States: Queued, Processing, Completed, Failed, Cancelled
- Progress indicators (current step, % complete)
- Estimated time remaining
- Real-time updates (WebSocket or polling)

**4. Error Handling & Retry (Critical)**
- API failures (Kimi K2 rate limits, timeouts)
- PDF generation failures (font embedding, memory)
- Validation failures (margin violations)
- Retry logic with exponential backoff
- Manual retry trigger

**5. Job Results & Artifacts (Table Stakes)**
- Download generated PDF
- View processing log
- Compare before/after text
- Access cleanup decisions (what AI changed)

**6. Batch Operations (Efficiency)**
- Pause all jobs
- Cancel job
- Re-run failed jobs
- Delete completed jobs
- Archive old jobs

**7. Resource Management (Performance)**
- Concurrent job limits (avoid API rate limits)
- CPU throttling for PDF generation
- Disk space monitoring (PDFs add up)
- Cleanup old artifacts after export

**8. Notifications (Nice-to-Have)**
- Desktop notification when batch completes
- Email summary (overkill for single-user)
- In-app toast notifications

## Quality Assurance Features (Detailed Analysis)

### How Do You Verify Output Meets KDP Specs?

**1. Pre-Processing Validation (Prevent Garbage In)**
- Text file encoding check (UTF-8)
- Minimum content length (KDP requires 24 pages minimum)
- Gutenberg header/footer present (if not, manual import)
- Character set issues (unusual Unicode, control characters)
- Chapter detection confidence score

**2. Post-Processing Validation (Ensure Quality)**
- Text quality metrics:
  - Avg paragraph length (flag if too short/long)
  - Suspicious patterns (excessive caps, repeated characters)
  - Missing chapters (if TOC expected but not detected)
  - Incomplete sentences (dangling punctuation)
- Formatting validation:
  - Page count (min 24, max 828 for KDP)
  - Margin compliance (varies by page count)
  - Font size (min 7pt per KDP)
  - Characters per line (readability)

**3. PDF Technical Validation (KDP Spec Compliance)**
- **Image resolution:** All images 300 DPI minimum
- **Font embedding:** All fonts embedded (KDP rejects unembedded)
- **File size:** Under 650 MB limit
- **Trim size:** Matches selected KDP size exactly
- **Bleed:** If enabled, 0.125" on all sides
- **Color space:** Grayscale or CMYK (RGB discouraged)
- **Transparency:** All transparencies flattened
- **Metadata:** No crop marks, color bars, software watermarks

**4. Visual Validation (Human Review)**
- PDF preview with zoom
- Page-flip through chapters
- Spot-check margins, headers, page numbers
- Verify TOC links work (for ebooks; paperback doesn't need links)

**5. Preflight Checklist (Export Gate)**
Before allowing export, require user confirmation:
- [ ] Text cleanup reviewed and approved
- [ ] Chapter structure correct
- [ ] Typography settings finalized
- [ ] PDF preview reviewed
- [ ] All validation checks passed
- [ ] Cover design ready (external)
- [ ] Metadata prepared (title, author, description)

**6. Validation Reporting (Dashboard)**
- Color-coded status: Green (pass), Yellow (warning), Red (fail)
- Detailed error messages with remediation steps
- Historical validation results (track improvements)

## Cover Design Workflow Features

### Integration with Canva (Not Replacement)

Since BookZang uses Canva for cover design (per project context), features focus on **integration** not **creation**.

**1. Cover Import (Table Stakes)**
- Upload PDF cover from Canva
- Validate cover dimensions match book specs:
  - **Formula:** `Cover width = (2 × trim width) + spine width + (2 × 0.125" bleed)`
  - **Spine width:** Based on page count and paper type
- Detect if bleed is included (0.125" all sides)

**2. Spine Width Calculator (Tool/Helper)**
- Input: page count, paper type (white or cream), binding (paperback)
- Output: spine width in inches
- **KDP formula:** `Spine width = page count × 0.002252` (cream) or `× 0.0025` (white)
- Min 79 pages for spine text

**3. Cover Validation (Critical)**
- Dimensions match calculated size
- Resolution: 300 DPI minimum
- Color space: CMYK or RGB (RGB converts to CMYK in print)
- Bleed included (0.125")
- Safe zones respected (0.125" from spine, 0.0625" from edges)
- Format: PDF (flattened, embedded fonts)

**4. Cover-to-Interior Linkage (Metadata)**
- Associate cover PDF with book project
- Store spine width, trim size, page count
- Re-validate if page count changes during edits

**5. Cover Preview (Nice-to-Have)**
- 3D mockup preview (could use external service)
- Print preview (front, spine, back separated)

**Anti-Feature:** Built-in cover designer would be massive scope creep. Canva already does this well.

## Export & Marketplace Integration Features

### KDP Upload Preparation (Not Direct Upload)

**1. Export KDP-Ready PDF (Table Stakes)**
- Interior PDF: Matches selected trim size, embedded fonts, 300 DPI
- Filename convention: `BookTitle_Interior_TrimSize.pdf`
- Embedded metadata: title, author
- Optimized file size (KDP 650 MB limit, but smaller is better)

**2. Export Cover PDF (Table Stakes)**
- Import from Canva (already created externally)
- Filename convention: `BookTitle_Cover_TrimSize_PageCount.pdf`
- Validate against KDP cover specs

**3. Metadata Export (Efficiency)**
- CSV or JSON with KDP fields:
  - Title, subtitle
  - Author name
  - Description (from Gutenberg or user-entered)
  - Keywords (genre, themes)
  - Categories (BISAC codes)
  - Language
  - Publication date (original and reprint)
  - ISBN (if applicable; KDP provides free ISBN)
  - Pricing (suggested based on page count and comp titles)
- Allows batch upload preparation

**4. File Organization (Workflow)**
- Organized folder structure for export:
  - `/exports/BookTitle/Interior.pdf`
  - `/exports/BookTitle/Cover.pdf`
  - `/exports/BookTitle/Metadata.json`
- ZIP archive for easy transfer

**5. Upload Checklist (Guidance)**
- Printable or on-screen checklist for KDP upload:
  - [ ] Title and subtitle entered
  - [ ] Author name and contributor roles
  - [ ] Description (up to 4000 characters)
  - [ ] Keywords (up to 7)
  - [ ] Categories (up to 2 BISAC)
  - [ ] Rights (public domain)
  - [ ] Pricing set
  - [ ] Interior file uploaded (PDF)
  - [ ] Cover file uploaded (PDF)
  - [ ] Preview book reviewed (KDP previewer)
  - [ ] ISBN assigned (free KDP ISBN or purchased)
  - [ ] Distribution channels selected
  - [ ] Publish clicked

**Anti-Feature: Direct KDP Upload API**
- Amazon doesn't provide public KDP API
- Automation would require brittle web scraping
- Manual upload via KDP web interface is acceptable for 50-book scale
- Focus on preparing perfect files, not automating upload

**Future Integration (v3.0+):**
- Monitor for official KDP API (hasn't existed as of 2026 research)
- Aggregate publishing services (PublishDrive, Draft2Digital) for multi-platform
- Amazon Advertising API for post-publish marketing

## Competitive Feature Analysis

Based on research into existing book production and KDP formatting tools:

| Feature Category | Atticus | Reedsy Studio | BookZang (Our Approach) |
|------------------|---------|---------------|-------------------------|
| **Text Cleanup** | Manual editing | Manual editing | AI-assisted (Kimi K2) - DIFFERENTIATOR |
| **Gutenberg Import** | Not specialized | Not specialized | Optimized for PG texts - DIFFERENTIATOR |
| **Template System** | 17 templates + theme builder | Limited presets | Genre-specific + cloneable - COMPETITIVE |
| **PDF Export** | KDP-ready PDF | KDP-ready PDF | KDP-ready PDF - TABLE STAKES |
| **Batch Processing** | One book at a time | One book at a time | Batch overnight processing - DIFFERENTIATOR |
| **Typography Controls** | Granular (fonts, spacing, alignment) | Basic | Constrained but sufficient - TABLE STAKES |
| **Cover Design** | Basic cover creator | Not included | Canva integration (better tool) - SMART CHOICE |
| **Ebook Export** | EPUB + PDF | EPUB + PDF | PDF only (paperback focus) - SCOPE CONTROL |
| **Collaboration** | Multi-user | Cloud-based | Single-user (internal tool) - SCOPE CONTROL |
| **AI Features** | Auto-flow, style checks | None | OCR error correction, paragraph detection - DIFFERENTIATOR |
| **Pricing** | $147/year | Free (basic), paid (advanced) | Internal tool (no cost) | N/A |

**Key Competitive Advantages:**
1. **AI-assisted Gutenberg cleanup:** Competitors require manual editing; we automate OCR fixes
2. **Batch processing:** Process 10+ books overnight vs one-at-a-time
3. **Public domain specialization:** Optimized workflow for PG texts, not general manuscripts
4. **Speed:** Goal is 50+ books quickly; designed for volume

**Acceptable Gaps:**
1. **No built-in cover design:** Canva is better; integration is sufficient
2. **No ebook export:** Paperback-first strategy; EPUB is future milestone
3. **No collaboration:** Internal tool for single user; unnecessary complexity

## Sources

### Official KDP Documentation
- [KDP Paperback Submission Guidelines](https://kdp.amazon.com/en_US/help/topic/G201857950) - Official technical specs
- [KDP Publishing Public Domain Content](https://kdp.amazon.com/en_US/help/topic/G200743940) - Public domain requirements
- [KDP Cover Creator](https://kdp.amazon.com/en_US/help/topic/G201953020) - Cover specifications
- [KDP Content Quality Guide](https://kdp.amazon.com/en_US/help/topic/G200952510) - Quality standards

### Book Formatting Tools & Software
- [Best KDP Formatting Software 2026 - BookBeam](https://bookbeam.io/blog/best-kdp-formatting-software/) - Tool comparison
- [Book Formatting Software - Kindlepreneur](https://kindlepreneur.com/book-formatting-software/) - Atticus, Reedsy, Scrivener features
- [Book Formatting Essentials - The Book Designer](https://www.thebookdesigner.com/book-formatting-essentials/) - Professional typography standards
- [Desktop Publishing Software 2026](https://topbusinesssoftware.com/categories/desktop-publishing/) - InDesign, Affinity, QuarkXPress

### Gutenberg Text Processing
- [Chapterize GitHub](https://github.com/JonathanReeve/chapterize) - Chapter detection and cleanup tool
- [gutenberg_cleaner GitHub](https://github.com/kiasar/gutenberg_cleaner) - Python package for PG text cleanup
- [Gutenberg Text Preprocessing Discussion - MobileRead](https://www.mobileread.com/forums/showthread.php?t=15751) - Community cleanup strategies

### Book Design & Typography Standards
- [Book Design Basics: Margins and Leading - Speakipedia](https://speakipedia.com/book-design-part-1/) - Margin standards
- [Basic Book Design: Margins - Wikibooks](https://en.wikibooks.org/wiki/Basic_Book_Design/Margins) - Classic ratio (1:1:2:3)
- [Book Interior Design Guide - Illumination Graphics](https://illuminationgraphics.com/complete-guide-book-interior-design-layout-fonts-formatting/) - Typography best practices
- [10 Typesetting Rules for Books](https://selfpublishingadvice.org/10-typesetting-rules-for-indie-authors/) - Professional standards

### Automation & Production Workflows
- [Publishing Workflow Automation - Bookalope](https://bookalope.net/about.html) - AI-assisted book production
- [Automated Publishing Workflows - Hederis](https://medium.com/hederis-app/automated-publishing-workflows-explained-58c5da5fb3fe) - Workflow patterns
- [Production Queue Management - Print Planr](https://www.printplanr.com/print-job-management-software/) - Job tracking for book production

### Quality Assurance
- [IBPA Industry Standards Checklist](https://www.ibpa-online.org/page/standards-checklist-download) - Professional publishing QA
- [Quality Assurance in Publishing - Scribe](https://scribenet.com/articles/2014/11/04/quality-assurance-and-quality-control.html) - QA/QC best practices

### AI & NLP for Text Processing
- [Spark NLP Spelling Correction - John Snow Labs](https://www.johnsnowlabs.com/easily-correcting-typos-and-spelling-errors-on-texts-with-spark-nlp-and-python/) - AI typo correction
- [NLP for Publishers - KnowledgeWorks](https://www.kwglobal.com/blog/ai-and-nlp-for-publishers/) - AI in publishing workflows

**Confidence Level:** HIGH - Verified with official KDP docs, existing tool research, and professional book design standards. Public domain publishing requirements confirmed from Amazon official sources.

---

*Research completed: 2026-02-12*
*Domain: Book production pipeline for automated KDP publishing*
*Focus: Feature landscape for public domain Gutenberg texts to professional paperbacks*
