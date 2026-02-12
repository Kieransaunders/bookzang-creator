

**BookZang**

Out of Copyright Creator

Internal Production Tool

iConnectIT LTD

February 2026

# **What This Is**

BookZang is an internal production tool for iConnectIT. It takes public domain books from Project Gutenberg, cleans up the raw text, applies professional book templates, and outputs print-ready PDFs and ePubs for sale on Amazon KDP, Etsy, and other marketplaces.

This is not a SaaS product (for now). It’s a content production pipeline — a machine for turning free raw material into sellable products. The goal is to build a catalogue of well-formatted classic books that generate passive income through online marketplaces.

# **The Opportunity**

There are over 76,000 public domain books on Project Gutenberg. The texts are free and legal to republish commercially. Thousands of sellers already do this on Amazon KDP, but most produce low-quality, poorly formatted editions. The opportunity is in quality and speed:

**Quality gap:** Most public domain KDP books are ugly — bad formatting, no chapter structure, generic covers. A well-designed edition with proper typography stands out and commands better reviews.

**Speed advantage:** With an automated pipeline, you can produce a finished book in minutes rather than hours. That means you can build a large catalogue quickly and test which titles sell.

**Zero content cost:** The raw material is free. Your only costs are the tooling (which you’re building yourself) and marketplace fees.

# **Production Workflow**

| 1 | Pick a Book Browse the synced Gutenberg catalogue in the dashboard. Filter by genre, popularity, author, or era. Identify titles with high demand and low competition on KDP. |
| :---: | :---- |
| **2** | **Clean & Structure** The pipeline fetches the raw text, strips boilerplate, fixes line wrapping, detects chapters, and corrects OCR errors. You review the structured output and make any manual tweaks. |
| **3** | **Apply Template** Choose a book template that suits the genre — classic serif for fiction, clean modern for essays, large print for accessibility. The template controls every detail: fonts, margins, headers, drop caps, page numbers. |
| **4** | **Generate & Export** One click produces a print-ready PDF (and optionally ePub). The output meets KDP’s formatting requirements. Add your cover, write a description, and upload directly to your marketplace. |

# **Amazon KDP Considerations**

Publishing public domain books on KDP is well-trodden ground. Amazon has specific policies and practical realities you need to work with:

**Duplicate content filtering:** Amazon flags near-identical public domain uploads. To pass review, your editions need to demonstrate “added value” — professional formatting, a custom cover, an introduction, footnotes, or a curated selection. BookZang’s professional templates and clean typography are your differentiator here.

**Cover design matters enormously:** The cover is what sells the book. You’ll need unique covers for every title. Consider a separate workflow for cover generation — AI-generated artwork, Canva templates, or commissioning a batch from a designer. Budget for this.

**Pricing sweet spot:** Public domain paperbacks typically sell for £4.99–£8.99 on KDP. Kindle editions at £0.99–£2.99. The margins are thin per unit but the volume potential is high with a large catalogue.

**Categories and keywords:** Proper categorisation drives discoverability. Each book needs targeted keywords and the right BISAC categories. This is manual work but high-leverage — worth doing properly for each title.

**Print-ready PDF specs:** KDP has specific requirements for interior files: no crop marks, embedded fonts, correct trim size (typically 5” x 8” or 6” x 9” for trade paperback), minimum 24pt margins in the gutter. BookZang templates need to be built to these specs from day one.

**Other marketplaces:** Don’t limit to KDP. Etsy (physical and digital), Lulu, IngramSpark, Barnes & Noble Press, and your own Shopify store are all viable channels. Each has slightly different format requirements, but the same cleaned text and templates can serve all of them.

# **The Cleanup Problem**

This is where most of the engineering effort goes. Gutenberg text files are functional but ugly. Every book arrives with problems:

| Licence boilerplate | Every file has a Project Gutenberg header and footer. Must be stripped completely — legally required for commercial use and Amazon won’t accept it. |
| :---- | :---- |
| **Hard-wrapped lines** | Text is wrapped at 72 characters, splitting sentences mid-word. Needs joining back into proper paragraphs. |
| **Chapter detection** | Chapter headings aren’t tagged. The system must find “Chapter I”, “PART TWO”, Roman numerals, and similar patterns. |
| **OCR errors** | Many texts were scanned from old books. Characters get misread: “rn” becomes “m”, “l” becomes “1”. |
| **Punctuation** | Straight quotes to smart quotes. Hyphens to proper dashes. Consistent spacing after full stops. |
| **Paragraph breaks** | Some books double-space everything. Others have no breaks at all. Needs normalising. |

The basic automated pipeline handles roughly 80% of issues. For the remaining edge cases, an AI-assisted cleanup step can catch subtler problems. After cleanup, you review the structured output in the dashboard and make any final tweaks before generating the PDF.

Over time, as you process more books, you’ll build up a library of cleanup rules and patterns that improve the pipeline’s accuracy. Each book you fix teaches the system.

# **Template Library**

Templates are designed around specific output channels. The KDP Trade Paperback and Kindle Interior templates are the priority — they need to meet exact marketplace specs from day one. Other templates expand the range of products you can sell.

| Template | Style | Use Case |
| :---- | :---- | :---- |
| **Classic** | Serif fonts, generous margins, chapter ornaments, drop caps | Fiction, literature |
| **Modern Minimal** | Clean sans-serif, wide margins, whitespace | Essays, philosophy |
| **Trade Paperback** | 5” x 8” or 6” x 9”, KDP-ready margins and gutter | Amazon KDP print |
| **Kindle Interior** | Reflowable layout optimised for e-readers | Kindle/ePub digital |
| **Large Print** | 16pt+, high contrast, extra line spacing | Accessibility niche |
| **Poetry** | Centred text, preserved line breaks, wider margins | Poetry collections |

# **Legal Position**

**The texts are free to use commercially.** Books on Project Gutenberg whose US copyright has expired can be reformatted and sold without permission or royalties. This is established and uncontroversial.

**Strip all PG branding.** You must remove all Project Gutenberg headers, footers, and licence text. The pipeline does this automatically. Never mention Project Gutenberg in your Amazon listings or book interiors.

**UK copyright is different.** Not all US public domain books are free in the UK. The safe rule: stick to works where the author died before 1955 (70 years \+ current year). For the US-only titles, you’re publishing through US-based platforms (KDP) to US customers, which is fine, but worth understanding the nuance.

**You can’t claim copyright on the text.** US law is clear: formatting and cleanup of public domain text doesn’t create a new copyright. Your copyright is in your cover designs, introductions, and any original content you add — not the text itself.

**Amazon will accept it.** Thousands of sellers publish public domain books on KDP. Amazon’s concern is quality and duplication, not legality. Professional formatting and unique covers solve both.

**Action:** Quick legal sense-check from a copyright-literate solicitor before first publication. £300–500 one-off. Cheap insurance.

# **Unit Economics**

The appeal of this model is near-zero marginal cost per book. Here’s how the numbers work:

**Cost Per Book**

| Item | Without AI | With AI Cleanup |
| :---- | :---- | :---- |
| **Raw text** | Free | Free |
| **Text cleanup (compute)** | \~£0.00 | \~£0.05–£0.15 |
| **PDF generation (compute)** | \~£0.01 | \~£0.01 |
| **Cover design (per title)** | £5–15 (AI/Canva) | £5–15 (AI/Canva) |
| **Your time (with automation)** | 15–30 min | 10–20 min |
| **Your time (without automation)** | 2–4 hours | N/A |

**Revenue Per Book (KDP Paperback)**

| Typical retail price | £6.99 |
| :---- | :---- |
| **KDP printing cost (200-page book)** | \~£2.50 |
| **Your royalty (60% list price minus print cost)** | \~£1.69 |
| **Books needed to earn £500/month** | \~296 sales |
| **With 50-title catalogue averaging 6 sales/month each** | £507/month |

The maths improves significantly with Kindle editions (70% royalty at £2.99+) and by selling on multiple platforms simultaneously. A 50-title catalogue is achievable within the first couple of months with an automated pipeline.

# **MVP Scope**

Get the core pipeline working end-to-end. Everything else is iteration.

| ✅  MVP (Build Now) | ➡️  Later |
| :---- | :---- |
| Local Synced catalogue of popular English public domain books /  | AI-powered deep text cleanup |
| Text fetch and automated cleanup pipeline | Cover generation workflow |
| Chapter detection and structured text output | Direct KDP upload integration |
| Manual review/edit step in the dashboard | Batch processing (queue 20+ books) |
| 2 KDP-ready templates (Trade Paperback, Kindle) | Additional templates (Poetry, Large Print, etc.) |
| PDF and ePub generation | Sales tracking dashboard |
| Job queue with progress tracking | Open as SaaS to other publishers |
| Library of completed books for re-export |  |

## **Build Plan**

| Week 1–2 | Catalogue sync from Gutenberg OR FILE UPLOAD, book browser UI, data model |
| :---- | :---- |
| **Week 3–4** | Text cleanup pipeline: fetch, strip, unwrap, detect chapters |
| **Week 5–6** | PDF/ePub generation, KDP-spec templates, review interface |
| **Week 7** | Job queue, progress tracking, completed book library |
| **Week 8** | Test with 10 real books end-to-end, fix edge cases, first KDP uploads |

# **Risks**

| Risk | Likelihood | Mitigation | Residual |
| :---- | :---- | :---- | :---- |
| **Text quality varies wildly** | High | Some books are very messy. Build a quality rating into the pipeline — flag books that need manual attention vs ones that clean up well. Start with the cleanest, most popular titles. | Medium |
| **KDP duplicate rejection** | Medium | Amazon may reject near-identical public domain editions. Mitigate with unique covers, professional formatting, and adding light editorial value (brief introduction, author bio). Track which titles already have strong KDP competition. | Low |
| **Time sink on edge cases** | Medium | Some books will eat hours of manual cleanup time. Set a rule: if a book takes more than 30 minutes of manual work, skip it and move on. There are 76,000 to choose from. | Low |
| **Cover design bottleneck** | Medium | Every book needs a unique cover. This is outside BookZang’s scope but will bottleneck production. Batch-produce covers using AI tools or Canva templates. Budget £5–15 per cover. | Low |
| **Gutenberg rate limiting** | Low | PG blocks aggressive scrapers. Use their robot harvest endpoint, cache everything, and pre-sync the catalogue. | Very Low |

# **Success Metrics (First 3 Months)**

| Metric | Target | Stretch |
| :---- | :---- | :---- |
| **Books published on KDP** | 20 | 50 |
| **Average time per book (end-to-end)** | 30 min | 15 min |
| **Books that pass KDP review first time** | 80% | 95% |
| **Monthly revenue from catalogue** | £100 | £500 |
| **Pipeline completion rate (no manual rescue)** | 70% | 90% |

# **Future: SaaS Pivot Option**

If the internal tool proves the pipeline works reliably, there’s a clear path to opening it up as a SaaS product for other self-publishers. The architecture supports this — add auth, payments, and usage limits and you have a product. But that’s a decision for later, once you’ve validated the core workflow and built a revenue-generating catalogue.