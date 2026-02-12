# Pitfalls Research

**Domain:** Book Production Pipeline / Gutenberg Text Processing / KDP Publishing
**Researched:** 2026-02-12
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Insufficient Public Domain Differentiation Leading to Account Flags

**What goes wrong:**
Amazon KDP rejects undifferentiated public domain books and can flag accounts for repeated violations. A well-formatted book with a professional cover still gets rejected if it lacks required differentiation.

**Why it happens:**
Publishers assume good formatting and unique covers count as differentiation. KDP requires specific value-add: annotations, original illustrations (10+), or original translations. Formatting improvements, linked TOCs, and cover design don't count.

**How to avoid:**
- Add annotations: study guides, historical context, literary critique, author biography
- Add 10+ original illustrations (not sourced from other public domain)
- Include differentiation type in title: "(Annotated)" or "(Illustrated)"
- Summarize original contribution in product description (bullet format, max 80 chars)
- Never rely on formatting alone as differentiation

**Warning signs:**
- Upload rejected with "undifferentiated public domain content" message
- Free version of same title exists in Amazon store
- Product description doesn't explicitly state added value
- No annotations or illustrations visible in preview

**Phase to address:**
Phase 1 (Text Processing Pipeline) — Architect AI cleanup to generate annotations/study materials as differentiation. Phase 3 (Cover Integration) — Plan for original illustration generation if using Canva API.

**Consequences:**
- Immediate book rejection
- Account review/suspension for repeated violations
- Lost time on non-publishable books
- Only 35% royalty option available (not 70%)
- Ineligible for KDP Select

---

### Pitfall 2: Hard-Wrapped Text Misdetection Breaking Paragraph Structure

**What goes wrong:**
Gutenberg texts have hard line breaks every ~72 characters. Naive unwrapping joins lines that should be separate (poetry, dialogue, chapter headings) or leaves breaks that should be removed. AI cleanup then operates on malformed paragraphs, propagating errors.

**Why it happens:**
Simple regex-based unwrapping can't distinguish paragraph breaks from hard wraps. The best place to wrap often occurs at sentence ends where indentation should dominate as an indicator. Poetry and block quotes have intentional short lines that look like wrapped prose.

**How to avoid:**
- Detect paragraph boundaries before unwrapping: double line breaks, indentation patterns
- Preserve special formatting: poetry (short lines, rhythm), block quotes, chapter headings
- Use ML classifier to predict when lines should join vs. separate
- Test on diverse Gutenberg samples (prose, poetry, dialogue-heavy, technical)
- Manual review step for chapter detection before unwrapping

**Warning signs:**
- Poetry appears as continuous prose
- Chapter headings merged with previous paragraph
- Dialogue attribution separated from dialogue
- Inconsistent paragraph lengths (some 1 line, some 20 lines)
- AI cleanup output shows confusion about paragraph structure

**Phase to address:**
Phase 1 (Text Processing Pipeline) — Core text unwrapping logic must handle edge cases before AI cleanup.

**Consequences:**
- Poetry rendered unreadable
- Chapter structure lost
- AI cleanup makes incorrect corrections based on malformed input
- Manual cleanup required for every book

---

### Pitfall 3: AI Hallucination Introducing Factual Errors in OCR Corrections

**What goes wrong:**
AI text cleanup fixes "rn→m" and "l→1" OCR errors but also "corrects" legitimate character sequences. Example: "kernel" becomes "kemel", "mourn" becomes "moum", "barn" becomes "bam". Worse, AI may "improve" archaic spelling to modern ("colour" → "color"), changing author's voice.

**Why it happens:**
AI models are trained to make text "better" not "accurate to source". When given a prompt like "fix OCR errors", the model may over-correct. Without strict constraints, AI applies modern conventions to historical texts.

**How to avoid:**
- Prompt engineering: "Fix ONLY obvious OCR errors (rn→m, l→1). Preserve all legitimate spellings, archaic language, and author style."
- Provide examples of what NOT to change: "kernel is correct, do not change to kemel"
- Use confidence scoring: only apply corrections above 95% confidence
- Implement human-in-the-loop for ambiguous corrections
- Test on known-clean samples with intentional OCR errors inserted
- Version control: preserve original + corrected versions for comparison
- Batch similar corrections for review ("all instances of X→Y")

**Warning signs:**
- Legitimate words flagged as corrections
- Archaic spellings modernized ("connexion" → "connection")
- British spellings Americanized without instruction
- Proper nouns altered ("Willmington" → "Wilmington" when original is correct)
- Inconsistent corrections (same word corrected differently across book)

**Phase to address:**
Phase 1 (Text Processing Pipeline) — AI cleanup prompt engineering and confidence thresholds. Phase 2 (Review/Approval UI) — Build correction review interface before auto-applying changes.

**Consequences:**
- Factual inaccuracies introduced into public domain text
- Author's voice/style corrupted
- Legal issues if changes misrepresent original work
- Books flagged as low-quality due to obvious errors
- Complete re-processing required if discovered late

---

### Pitfall 4: Font Embedding Failures Causing KDP Upload Rejection

**What goes wrong:**
PDF uploads rejected with "unembedded fonts" error even though fonts appear embedded in local PDF viewer. Some fonts embed locally but fail KDP's commercial embedding check. Print Previewer shows different fonts than intended.

**Why it happens:**
Font licenses may allow embedding for viewing but prohibit commercial printing. PDF generation libraries have different default embedding behaviors. Subsetting fonts (only embedding used characters) can fail if not done correctly. System fonts may not be embedded by default.

**How to avoid:**
- Use only fonts with commercial embedding rights
- For PDF generation libraries (pdf-lib, PDFKit):
  - Explicitly embed all fonts (not just custom fonts)
  - Use full embedding, not subsetting (or test subsetting thoroughly)
  - Don't exclude "common system fonts" from embedding
- Export PDFs as PDF/X-1A format (optimal for KDP)
- Test uploads with KDP Print Previewer before batch processing
- Maintain allow-list of KDP-verified fonts
- Bundle font files with application, don't rely on system fonts

**Warning signs:**
- Local PDF shows correct fonts but KDP preview shows different fonts
- "Fonts not embedded" error on upload despite embedding flag set
- Fonts render correctly on Mac but fail on KDP (Linux-based system)
- Free/open fonts work but commercial fonts fail (license issue)

**Phase to address:**
Phase 1 (PDF Generation) — Font embedding architecture and testing. Phase 2 (Batch Processing) — Validation step to check font embedding before KDP upload.

**Consequences:**
- Immediate upload rejection
- Books uploaded but rejected at review stage
- Inconsistent typography in published books
- Re-generation of entire batch if discovered late

---

### Pitfall 5: Page Count-Based Gutter Margin Miscalculation

**What goes wrong:**
PDFs generated with fixed 0.375" gutter margin. Books over 150 pages are rejected for insufficient gutter. Thicker books (300+ pages) have text disappearing into spine.

**Why it happens:**
KDP requires gutter margins to scale with page count: 0.375" for 24-150 pages, 0.5" for 151-300 pages, 0.625" for 301-500 pages, 0.75" for 501-828 pages. Thicker books need larger gutters to accommodate binding depth. Most PDF generation examples use fixed margins.

**How to avoid:**
- Calculate page count BEFORE generating PDF
- Apply dynamic gutter margin formula:
  ```
  if (pages <= 150) gutter = 0.375"
  else if (pages <= 300) gutter = 0.5"
  else if (pages <= 500) gutter = 0.625"
  else if (pages <= 828) gutter = 0.75"
  ```
- Store margin requirements as configuration data
- Test with books at each threshold (149, 151, 299, 301 pages)
- Validate calculated margins before PDF generation

**Warning signs:**
- KDP Print Previewer flags margin violations
- Text too close to spine in preview
- Rejection message: "content extends into gutter area"
- Consistent failures for books over 150 pages

**Phase to address:**
Phase 1 (PDF Generation) — Implement dynamic margin calculation based on final page count.

**Consequences:**
- Upload rejection for books over 150 pages
- Published books with unreadable gutter text
- Entire batch needs regeneration if margin wrong

---

### Pitfall 6: Bleed/No-Bleed Inconsistency in PDF Dimensions

**What goes wrong:**
PDFs generated at 6"x9" trim size but contain images that should bleed to edge. KDP rejects for missing bleed. Conversely, PDFs with bleed (6.125"x9.25") uploaded for no-bleed book get rejected for wrong dimensions.

**Why it happens:**
Bleed requires extending images 0.125" beyond trim on all sides, making PDF 0.125" wider and 0.25" taller (bleed on top AND bottom). If ANY page needs bleed, ENTIRE PDF must be bleed-sized. Trim size selection in KDP must match PDF dimensions exactly.

**How to avoid:**
- Decide bleed vs. no-bleed BEFORE PDF generation
- If bleed: generate PDF at trim + bleed dimensions
  - 6"x9" book → 6.125"x9.25" PDF
  - 5"x8" book → 5.125"x8.25" PDF
- Extend background images/colors 0.125" past trim lines
- If no-bleed: generate PDF at exact trim size, ensure no images touch edges
- Validate: "Does this book have any full-page images, background colors, or decorative elements?"
- Test upload for both bleed and no-bleed books

**Warning signs:**
- KDP shows "incorrect trim size" despite selecting correct size
- Print Previewer flags white borders around full-page images
- Rejection: "dimensions do not match selected trim size"
- Background colors don't reach edge in preview

**Phase to address:**
Phase 1 (PDF Generation) — Bleed detection and PDF sizing logic. Phase 3 (Cover Integration) — Coordinate cover bleed with interior bleed settings.

**Consequences:**
- Upload rejection
- Published books with white borders on full-page images
- Covers don't align with interior bleed settings

---

### Pitfall 7: Memory Exhaustion in Batch Processing 30GB Library

**What goes wrong:**
Batch processing script loads entire 30GB library into memory and crashes. Or processes one book at a time correctly but crashes midway through batch when memory accumulates. Mac Mini runs out of memory processing 1000+ books sequentially.

**Why it happens:**
Node.js has default heap limit (~2GB on 64-bit, ~4GB with --max-old-space-size). Loading entire books via fs.readFile accumulates memory. PDF generation libraries hold rendered pages in memory. File handles not closed properly cause descriptor leaks. Streaming not used for large files (>50MB).

**How to avoid:**
- Use streams for all file operations over 1MB
- Process in fixed-size batches (e.g., 50 books at a time)
- Clear references after each book: `processedBook = null; global.gc?.()`
- Use worker threads for parallel processing with isolated memory
- Set appropriate heap limit: `--max-old-space-size=8192` for 8GB
- Monitor memory usage: `process.memoryUsage().heapUsed`
- Implement checkpointing: save progress, restart after N books
- Close file handles explicitly: `stream.close()`
- For large files (>50MB), use streaming PDF generation

**Warning signs:**
- "JavaScript heap out of memory" error
- Process memory usage grows linearly with each book processed
- Mac Mini becomes unresponsive during batch processing
- Crashes after processing X books (memory leak)
- File descriptor limit errors

**Phase to address:**
Phase 2 (Batch Processing) — Memory-efficient architecture with streaming and batching.

**Consequences:**
- Batch processing fails partway through
- Data loss if no checkpointing
- Mac Mini crashes requiring restart
- Processing 1000 books takes days instead of hours

---

### Pitfall 8: Chapter Detection Failure on Non-Standard Headings

**What goes wrong:**
AI chapter detection works for "Chapter 1" but fails for "I.", "PART THE FIRST", "Book II", "Section A", numbered-only chapters, or books without chapter markers. Table of contents generation misses chapters or creates false chapters from random capitalized lines.

**Why it happens:**
Gutenberg texts have inconsistent chapter heading formats across eras and authors. 18th-century books use "CHAP. I.", Victorian books use "CHAPTER THE FIRST", modern books use "1." without "Chapter" prefix. Some books have parts/sections/books as divisions above chapters. Poetry collections use poem titles as chapter equivalents.

**How to avoid:**
- Train AI on diverse chapter heading patterns from multiple eras
- Fallback heuristics: all-caps lines, centered text, short lines followed by blank lines
- Detect hierarchy: Part > Chapter > Section
- Manual chapter marker override option in UI
- Confidence scoring: flag low-confidence chapter boundaries for review
- Test on diverse samples: Victorian novel, 18th-century essay, poetry collection, technical treatise
- Preserve original structure: don't force "Chapter 1" if original uses "I."

**Warning signs:**
- TOC has 100+ chapters (likely detecting every heading)
- TOC missing obvious chapters visible in preview
- Random sentences appearing as chapter headings in TOC
- Poetry titles not appearing in TOC
- Hierarchy flattened (Parts showing as chapters)

**Phase to address:**
Phase 1 (Text Processing) — Chapter detection algorithm with pattern recognition. Phase 2 (Review UI) — Manual chapter marker adjustment interface.

**Consequences:**
- Broken table of contents in final book
- Navigation impossible in e-reader
- Unprofessional appearance
- Manual TOC creation required for every book

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip AI cleanup, only remove PG boilerplate | Faster processing, no API costs | Books have OCR errors ("rn" → "m"), look low-quality | Never — OCR errors flag books as unprofessional |
| Use fixed 0.375" gutter for all books | Simple implementation | Books over 150 pages rejected by KDP | Never — violates KDP specs |
| Load entire book into memory with readFile | Simple code, works for small files | Crashes on large books, can't batch process | Only for books <1MB (rare in 30GB library) |
| Use system fonts without embedding | Works on local machine | KDP rejection, font substitution | Never — KDP requires embedding |
| Skip differentiation, rely on formatting | Less work, faster uploads | Account flagged, all books rejected | Never — violates KDP policy |
| Generate 6"x9" trim only, ignore 5"x8" option | One template, simpler workflow | Miss best trim for certain books (novellas better at 5x8) | Acceptable for MVP — add later |
| Skip widow/orphan control in PDF generation | Faster PDF generation | Unprofessional typography, visible in preview | Acceptable for MVP — add in polish phase |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Kimi K2 API (AI cleanup) | Single prompt for entire book (token limit exceeded) | Chunk by chapter, send sequential API calls with context |
| Kimi K2 API | No retry logic for rate limits | Implement exponential backoff, queue system for batches |
| Canva API (cover generation) | Assume cover dimensions = interior trim | Cover width = spine width + 2×(trim width + bleed), calculate spine from page count |
| Convex DB | Store entire book text in single field | Chunk by chapter, store metadata separately, use file storage for raw text |
| KDP Upload API (if automated) | Upload without validating PDF first | Use KDP Print Previewer API to check before upload |
| File System (30GB library) | Scan entire directory into memory | Use streaming directory traversal, pagination for UI |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous PDF generation blocking UI | React app freezes during PDF generation | Use web worker or Convex action for PDF generation | First book processed |
| Loading all 1000 books into React state | UI becomes unresponsive, pagination broken | Virtual scrolling, load 50 at a time | >100 books in library |
| Regenerating PDF on every preview | Preview takes 30+ seconds | Cache generated PDFs, regenerate only on text/settings change | First preview attempt |
| No progress tracking for batch operations | User closes tab, loses all progress | Store batch progress in Convex, resumable jobs | First multi-hour batch |
| Font re-embedding on every PDF generation | Slow PDF generation (10+ seconds per book) | Load and cache font files once at startup | Processing 10+ books |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing Kimi K2 API key in client-side code | API key exposed in browser, quota theft | Store in Convex environment variables, call from backend action |
| No rate limiting on AI cleanup endpoint | API quota exhausted by accidental infinite loop | Implement per-user rate limits in Convex |
| Allowing arbitrary file paths from UI | Path traversal attack reading system files | Validate all paths are within designated library folder |
| No validation of uploaded Gutenberg files | Malicious files executed during processing | Validate file type, scan for malware, sandbox processing |
| Exposing full file system paths in URLs | Information disclosure about system structure | Use opaque IDs, resolve to paths server-side only |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visual feedback during 5-minute AI cleanup | User thinks app crashed | Real-time progress: "Processing chapter 3/20...", streaming updates |
| Batch processing 1000 books with no progress bar | No way to know how long it will take | Show: "Book 45/1000, estimated 2h 15m remaining" |
| PDF preview loads entire PDF into browser | Browser crashes on 500-page book | Render first 10 pages only, "Load more" button |
| No way to cancel long-running AI cleanup | User stuck waiting, must close app | Cancel button that terminates Convex action |
| Error message: "PDF generation failed" | User doesn't know what to fix | "Font embedding failed: Arial not licensed for commercial use. Use Liberation Sans instead." |
| Batch operation fails on book 500/1000, no recovery | User must restart from beginning, loses progress | Checkpoint every 50 books, "Resume from last checkpoint" option |

## "Looks Done But Isn't" Checklist

- [ ] **AI Cleanup:** Often missing confidence scoring — verify corrections above 95% confidence before auto-applying
- [ ] **PDF Generation:** Often missing font embedding validation — verify fonts actually embedded, not just flag set
- [ ] **KDP Upload:** Often missing Print Previewer check — validate with KDP API before considering "upload ready"
- [ ] **Chapter Detection:** Often missing hierarchy support — verify Parts/Chapters/Sections detected, not flattened
- [ ] **Batch Processing:** Often missing error recovery — verify failed books logged, batch resumable from checkpoint
- [ ] **Gutenberg Cleanup:** Often missing poetry detection — verify special formatting preserved, not all converted to prose
- [ ] **Margin Calculation:** Often missing page count dependency — verify gutter recalculated if content changes page count
- [ ] **Bleed Detection:** Often missing consistency check — verify ALL pages use same bleed setting, not mixed
- [ ] **Memory Management:** Often missing stream cleanup — verify file handles closed, references cleared after processing
- [ ] **Public Domain Differentiation:** Often missing annotation generation — verify AI-generated study notes count as "original annotations" per KDP policy

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Undifferentiated public domain upload | HIGH | Regenerate with AI-generated annotations, re-upload all rejected books, appeal account review |
| Hard-wrapped text misdetection | HIGH | Manually review paragraph structure, re-run unwrapping with corrected logic, re-process through AI cleanup |
| AI hallucination introducing errors | MEDIUM | Compare against original Gutenberg text, manual correction of errors, retrain AI with better prompts |
| Font embedding failure | LOW | Switch to KDP-approved fonts, regenerate PDFs with correct embedding settings, re-upload |
| Gutter margin miscalculation | MEDIUM | Recalculate based on page count, regenerate all PDFs with correct margins, re-upload affected books |
| Bleed/no-bleed inconsistency | MEDIUM | Determine correct bleed setting, resize PDFs or regenerate, re-upload with matching trim size |
| Memory exhaustion in batch | LOW | Restart batch from last checkpoint, reduce batch size, increase heap limit |
| Chapter detection failure | MEDIUM | Manual chapter marker correction in UI, re-run TOC generation, regenerate PDF |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Insufficient public domain differentiation | Phase 1 (AI Cleanup) | Generated annotations visible in preview, "(Annotated)" in title |
| Hard-wrapped text misdetection | Phase 1 (Text Processing) | Poetry samples render correctly, chapter headings not merged |
| AI hallucination errors | Phase 1 (AI Integration) | Spot-check 50 corrections, <1% error rate on known-clean sample |
| Font embedding failure | Phase 1 (PDF Generation) | Test upload to KDP Print Previewer, fonts show correctly |
| Gutter margin miscalculation | Phase 1 (PDF Generation) | Test books at 149, 151, 299, 301, 501 pages, all pass KDP validation |
| Bleed inconsistency | Phase 1 (PDF Generation) | Test bleed and no-bleed books, dimensions match KDP calculator |
| Memory exhaustion | Phase 2 (Batch Processing) | Process 100-book batch, memory usage stays under 4GB |
| Chapter detection failure | Phase 1 (Text Processing) + Phase 2 (Review UI) | TOC matches human review on 20 diverse books |

## Domain-Specific Edge Cases

### Gutenberg Text Quirks

**Character Encoding Issues:**
- Gutenberg uses UTF-8 but some older texts have Latin-1 or Windows-1252 encoding
- Smart quotes may be represented as `\``, `''`, or actual curly quotes depending on source
- Em-dashes represented as `--` (double hyphen) need conversion to proper em-dash
- Ellipses as `...` (three periods) vs. proper ellipsis character

**Structural Anomalies:**
- Books with multiple tables of contents (original TOC + Gutenberg-added TOC)
- Footnotes at end of chapter vs. bottom of page vs. end of book
- Illustrations referenced but not included in text file (separate image files)
- Multi-volume works split across multiple Gutenberg files
- Plays with character names in all-caps before dialogue

### KDP Policy Edge Cases

**Borderline Differentiation:**
- AI-generated annotations: KDP policy says "original annotations" — unclear if AI-generated counts
- Reformatted poetry: changing line breaks = new formatting or insufficient differentiation?
- Combined public domain works: anthology of 3 PD books = collection (rejected) or compilation (allowed)?
- Translated back to English from foreign translation: is this "original translation"?

**Metadata Requirements:**
- Title must include "(Annotated)" but KDP auto-capitalizes to "(ANNOTATED)" — does this violate spec?
- Product description must "summarize original contribution in bullet format" — how many bullets required?
- "Proof of public domain status" — what documentation is sufficient for 1900s books?

### Typography Edge Cases

**Widow/Orphan in Special Cases:**
- Chapter ending with single line on new page (widow or acceptable end-of-chapter?)
- Poetry stanza with single line appearing alone (orphan or intentional poetic structure?)
- Block quote ending with single line (widow or preserve quote integrity?)
- Dialogue attribution alone on line (orphan or preserve dialogue structure?)

**Hyphenation Edge Cases:**
- Hyphenating proper nouns (London-based vs. London based)
- Hyphenating across page breaks (av-oid or avoid?)
- Compound words with hyphens (re-enter vs. reenter) — preserve original or modernize?
- Em-dash at line break — does it count as hyphenation for widow/orphan rules?

## Sources

### Official Documentation (HIGH confidence)
- [Amazon KDP: Publishing Public Domain Content](https://kdp.amazon.com/en_US/help/topic/G200743940)
- [Amazon KDP: Set Trim Size, Bleed, and Margins](https://kdp.amazon.com/en_US/help/topic/GVBQ3CMEQW3W2VL6)
- [Amazon KDP: Fix Paperback and Hardcover Formatting Issues](https://kdp.amazon.com/en_US/help/topic/G201834260)
- [Amazon KDP: Content Guidelines](https://kdp.amazon.com/en_US/help/topic/G200672390)

### Technical References (MEDIUM confidence)
- [Project Gutenberg: Scanning FAQ](https://www.gutenberg.org/attic/scanning_faq.html)
- [Project Gutenberg: Errata and Bug Reports](https://www.gutenberg.org/help/errata.html)
- [GitHub: How to scrape Project Gutenberg](https://gist.github.com/mbforbes/cee3fd5bb3a797b059524fe8c8ccdc2b)
- [A Standardized Project Gutenberg Corpus for Statistical Analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC7516435/)
- [Node.js File System Production Guide 2026](https://thelinuxcode.com/nodejs-file-system-in-practice-a-production-grade-guide-for-2026/)
- [Node.js Memory Limits Documentation](https://nodejs.org/en/learn/diagnostics/memory/understanding-and-tuning-memory)

### PDF Generation References (MEDIUM confidence)
- [LibPDF: TypeScript PDF Library](https://documenso.com/blog/introducing-libpdf-the-pdf-library-typescript-deserves)
- [PDF-Lib Documentation](https://pdf-lib.js.org/)
- [PDFKit Documentation](https://pdfkit.org/)
- [Common Issues in HTML-to-PDF Printing](https://www.customjs.space/blog/html-to-pdf-issues/)
- [How to Embed Fonts in PDF](https://smallpdf.com/blog/embed-fonts-in-pdf-document)
- [Fonts in PDF files](https://www.prepressure.com/pdf/basics/fonts)

### Typography References (MEDIUM confidence)
- [Widows and Orphans Explained](https://www.printedpagestudios.com/blog/what-the-heck-are-widows-and-orphans)
- [Book Formatting Issues](https://www.48hrbooks.com/publishing-resources/blog/100/widows-orphans-and-other-book-formatting-issues)
- [Butterick's Practical Typography](https://practicaltypography.com/)
- [The Ultimate Guide to Justified Text](https://www.numberanalytics.com/blog/ultimate-guide-to-justified-text)
- [20 Typography Rules for 2026](https://inkbotdesign.com/typography-rules/)

### AI and Batch Processing (MEDIUM confidence)
- [Batch Processing Error Handling 2026](https://oneuptime.com/blog/post/2026-01-30-batch-processing-error-handling/view)
- [Batch Processing Optimization](https://markaicode.com/batch-processing-optimization-concurrent-requests/)
- [AI Text Cleanup Issues](https://gregraiz.com/blog/cleaning-ai-generated-text/)
- [AI Document Processing 2026](https://unstract.com/blog/ai-document-processing-with-unstract/)

### Community Resources (LOW to MEDIUM confidence)
- [MobileRead: What Cleaning Do Gutenberg Texts Need](https://www.mobileread.com/forums/showthread.php?t=15751)
- [KDP Community: Failed Manuscript Upload](https://www.kdpcommunity.com/s/question/0D5f400001f2UDyCAM/pdf-will-not-upload-solved)
- [Kindlepreneur: How to Publish Public Domain Books](https://kindlepreneur.com/how-to-publish-public-domain-books-and-why-you-should/)
- [Text Unwrap Tool](https://www.easecloud.io/tools/text/text-unwrap/)
- [Building a Text UnWrapper](https://medium.com/dsmli/building-a-text-unwrapper-an-example-of-feature-engineering-4fa3b9866880)

---
*Pitfalls research for: BookZang Creator — Gutenberg to KDP Pipeline*
*Researched: 2026-02-12*
*Research mode: Domain-specific pitfalls for milestone planning*
