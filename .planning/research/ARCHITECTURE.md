# Architecture Research

**Domain:** Book Production Pipeline (Local-to-Cloud Hybrid)
**Researched:** 2026-02-12
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     LOCAL FILESYSTEM                             │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  30GB Gutenberg Library (numbered folders)                 │  │
│  │  /12345/ → /Author - Title/ → /_done/                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              ↕ (scan, read, rename)              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │           LOCAL NODE.JS WORKER SCRIPT                       │  │
│  │  • Scans folders                                            │  │
│  │  • Reads .txt files                                         │  │
│  │  • Orchestrates pipeline steps                             │  │
│  │  • Handles folder renaming                                  │  │
│  │  • Calls Convex HTTP actions                               │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↕ (HTTP/HTTPS)
┌─────────────────────────────────────────────────────────────────┐
│                  CONVEX CLOUD BACKEND                            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │             HTTP Actions (Public Endpoints)                 │  │
│  │  • /api/pipeline/start                                      │  │
│  │  • /api/pipeline/update-progress                            │  │
│  │  • /api/pipeline/complete                                   │  │
│  └────┬───────────────────────────────────────────────────┬───┘  │
│       ↓                                                    ↓      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                 CONVEX ACTIONS (Node.js)                    │  │
│  │  • textCleanup (calls Kimi K2 API)                         │  │
│  │  • generatePDF (calls PDF library)                         │  │
│  │  • createCover (calls Canva API)                           │  │
│  │  • exportToDrive (calls Google Drive API)                  │  │
│  └────┬───────────────────────────────────────────────────┬───┘  │
│       ↓                                                    ↓      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │          MUTATIONS & QUERIES (Database Layer)              │  │
│  │  • books.create, books.updateStatus                        │  │
│  │  • jobs.create, jobs.updateStatus                          │  │
│  │  • files.upload, files.get                                 │  │
│  └────┬───────────────────────────────────────────────────────┘  │
│       ↓                                                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              CONVEX DATABASE & FILE STORAGE                │  │
│  │  Tables: books, jobs, templates                            │  │
│  │  Storage: text files, PDFs, metadata                       │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↕ (Realtime Subscription)
┌─────────────────────────────────────────────────────────────────┐
│                    REACT FRONTEND (Browser)                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Dashboard UI Components                        │  │
│  │  • LibraryPage (book grid with filters)                    │  │
│  │  • JobsPage (job queue monitor)                            │  │
│  │  • TemplatesPage (template selector)                       │  │
│  │  • JobDetailsDrawer (diff review UI)                       │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Local Node Worker | Filesystem operations, pipeline orchestration, folder management | Node.js script with fs, HTTP client |
| Convex HTTP Actions | Receive requests from local worker, coordinate processing | Convex httpRouter with HTTP action handlers |
| Convex Actions | Call external APIs (Kimi K2, Canva), generate PDFs, heavy processing | Convex actions with "use node" directive |
| Convex Mutations | Database writes, state transitions | Convex mutations with schema validation |
| Convex Queries | Database reads, realtime subscriptions | Convex queries with reactive updates |
| React Frontend | User interface, job monitoring, manual triggers | React 19 components with Convex hooks |
| Convex Storage | File persistence (text, PDFs, images) | Convex file storage API |

## Recommended Project Structure

```
bookzang-creator/
├── src/                       # React frontend
│   ├── components/
│   │   ├── Dashboard.tsx
│   │   ├── LibraryPage.tsx
│   │   ├── JobsPage.tsx
│   │   ├── JobDetailsDrawer.tsx    # Side-by-side diff review
│   │   └── TemplatesPage.tsx
│   └── lib/
│       └── utils.ts
├── convex/                    # Convex backend
│   ├── schema.ts              # Database schema
│   ├── http.ts                # HTTP router setup
│   ├── pipeline/              # NEW: Pipeline endpoints
│   │   ├── httpActions.ts     # HTTP endpoints for local worker
│   │   ├── actions.ts         # Text cleanup, PDF gen, Canva, Drive
│   │   └── mutations.ts       # Pipeline state management
│   ├── books.ts               # Book queries/mutations
│   ├── jobs.ts                # Job queue management
│   ├── templates.ts           # Template management
│   └── files.ts               # File storage operations
├── worker/                    # NEW: Local Node.js worker
│   ├── scanner.ts             # Scan Gutenberg folders
│   ├── orchestrator.ts        # Pipeline orchestration
│   ├── folderManager.ts       # Rename numbered → named → _done
│   ├── convexClient.ts        # HTTP client for Convex
│   └── config.ts              # Worker configuration
└── scripts/
    └── run-pipeline.ts        # CLI entry point
```

### Structure Rationale

- **convex/pipeline/**: Isolates pipeline-specific logic from existing CRUD operations
- **worker/**: Separate Node process for filesystem access (browser/Convex can't do this)
- **httpActions.ts**: Bridge between local worker and cloud backend using Convex HTTP actions
- **actions.ts**: Heavy processing with external APIs using "use node" for PDF/image libraries
- **mutations.ts**: State management separate from actions for better error handling

## Architectural Patterns

### Pattern 1: Local-to-Cloud Bridge via HTTP Actions

**What:** Local Node.js script communicates with Convex cloud backend via public HTTP endpoints

**When to use:** When you need to access local filesystem but want cloud-based state management

**Trade-offs:**
- ✅ Convex can't access local files → worker script handles filesystem
- ✅ Browser can't do batch operations → worker script handles orchestration
- ✅ HTTP actions are public endpoints → no complex auth needed for single-user tool
- ❌ Two separate processes to run (worker + Convex)
- ❌ Network latency for each step

**Example:**
```typescript
// worker/convexClient.ts
export async function startPipelineJob(data: {
  gutenbergId: string;
  textContent: string;
}) {
  const response = await fetch(`${CONVEX_URL}/api/pipeline/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return await response.json();
}

// convex/pipeline/httpActions.ts
import { httpRouter } from "convex/server";
import { httpAction } from "../_generated/server";

const http = httpRouter();

http.route({
  path: "/api/pipeline/start",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const { gutenbergId, textContent } = await request.json();

    // Create book record
    const bookId = await ctx.runMutation(api.books.create, {
      title: "Title from metadata",
      author: "Author from metadata",
      gutenbergId,
    });

    // Create job
    const jobId = await ctx.runMutation(api.jobs.create, {
      type: "import",
      bookId,
    });

    // Store text file
    const blob = new Blob([textContent], { type: 'text/plain' });
    const storageId = await ctx.storage.store(blob);

    return new Response(JSON.stringify({ success: true, jobId, bookId }), {
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
```

### Pattern 2: Action Orchestration for External APIs

**What:** Convex actions with "use node" call external APIs (Kimi K2, Canva) and handle retries

**When to use:** When you need to call third-party services that require Node.js libraries

**Trade-offs:**
- ✅ Actions can call any Node.js library
- ✅ Actions run in cloud → no local dependencies
- ✅ Can use fetch for HTTP requests
- ❌ 10-minute timeout (need chunking for long texts)
- ❌ No automatic retries (must implement manually)

**Example:**
```typescript
// convex/pipeline/actions.ts
"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

export const cleanTextWithKimi = action({
  args: {
    jobId: v.id("jobs"),
    bookId: v.id("books"),
    rawText: v.string(),
  },
  handler: async (ctx, args) => {
    // Update job status
    await ctx.runMutation(api.jobs.updateStatus, {
      jobId: args.jobId,
      status: "running",
      progress: 0,
      logs: "Starting AI cleanup with Kimi K2...",
    });

    // Chunk text for API limits (Kimi K2 may have token limits)
    const chunks = chunkText(args.rawText, 10000); // 10k chars per chunk
    const cleanedChunks: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Retry logic with exponential backoff
      let retries = 3;
      let cleaned = "";

      while (retries > 0) {
        try {
          const response = await fetch("https://api.kimi.moonshot.cn/v1/cleanup", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.KIMI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: chunk,
              instructions: "Remove Gutenberg headers/footers, fix OCR errors",
            }),
          });

          if (!response.ok) throw new Error(`API error: ${response.status}`);

          const result = await response.json();
          cleaned = result.cleanedText;
          break; // Success

        } catch (error) {
          retries--;
          if (retries === 0) throw error;

          // Exponential backoff: 2^(3-retries) seconds
          await new Promise(resolve =>
            setTimeout(resolve, Math.pow(2, 3 - retries) * 1000)
          );
        }
      }

      cleanedChunks.push(cleaned);

      // Update progress
      const progress = Math.round(((i + 1) / chunks.length) * 100);
      await ctx.runMutation(api.jobs.updateStatus, {
        jobId: args.jobId,
        status: "running",
        progress,
        logs: `Cleaned chunk ${i + 1}/${chunks.length}`,
      });
    }

    const finalText = cleanedChunks.join("\n\n");

    // Store cleaned text
    const blob = new Blob([finalText], { type: 'text/plain' });
    const storageId = await ctx.storage.store(blob);

    // Update book with cleaned file
    await ctx.runMutation(api.books.patch, {
      bookId: args.bookId,
      status: "cleaned",
      cleanedFileId: storageId,
    });

    await ctx.runMutation(api.jobs.updateStatus, {
      jobId: args.jobId,
      status: "done",
      progress: 100,
      logs: "Text cleaning complete!",
    });

    return { storageId, textLength: finalText.length };
  },
});

function chunkText(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    // Try to break at paragraph boundary
    let end = start + maxChars;
    if (end < text.length) {
      const breakPoint = text.lastIndexOf("\n\n", end);
      if (breakPoint > start) end = breakPoint;
    }

    chunks.push(text.slice(start, end).trim());
    start = end;
  }

  return chunks;
}
```

### Pattern 3: Worker-Managed Folder State + Cloud Job State

**What:** Local worker handles folder renaming (numbered → named → _done), Convex tracks job status

**When to use:** When you need to coordinate local filesystem changes with cloud state

**Trade-offs:**
- ✅ Single source of truth for processing state (Convex jobs table)
- ✅ Folder names provide visual progress indicator
- ✅ Easy to restart/resume (worker scans current folder names)
- ❌ Two state systems to keep in sync
- ❌ Folder rename errors must be handled

**Example:**
```typescript
// worker/folderManager.ts
import fs from 'fs/promises';
import path from 'path';

export class FolderManager {
  constructor(private basePath: string) {}

  async renameToDone(gutenbergId: string, title: string, author: string) {
    const numberedPath = path.join(this.basePath, gutenbergId);
    const namedPath = path.join(this.basePath, `${author} - ${title}`);
    const donePath = path.join(this.basePath, `_done/${author} - ${title}`);

    // First rename: numbered → named
    const currentPath = await fs.stat(numberedPath)
      .then(() => numberedPath)
      .catch(() => namedPath); // Already renamed

    if (currentPath === numberedPath) {
      await fs.rename(numberedPath, namedPath);
      console.log(`Renamed: ${gutenbergId} → ${author} - ${title}`);
    }

    // Second rename: named → _done (when job completes)
    // This happens after all pipeline steps succeed
  }

  async moveToDone(title: string, author: string) {
    const namedPath = path.join(this.basePath, `${author} - ${title}`);
    const donePath = path.join(this.basePath, `_done/${author} - ${title}`);

    // Ensure _done directory exists
    await fs.mkdir(path.join(this.basePath, '_done'), { recursive: true });

    await fs.rename(namedPath, donePath);
    console.log(`Moved to _done: ${author} - ${title}`);
  }

  async scanNumberedFolders(): Promise<string[]> {
    const entries = await fs.readdir(this.basePath, { withFileTypes: true });

    return entries
      .filter(entry => entry.isDirectory() && /^\d+$/.test(entry.name))
      .map(entry => entry.name);
  }
}

// worker/orchestrator.ts
import { FolderManager } from './folderManager';
import { ConvexClient } from './convexClient';

export class PipelineOrchestrator {
  constructor(
    private folderManager: FolderManager,
    private convexClient: ConvexClient,
  ) {}

  async processBook(gutenbergId: string) {
    // 1. Read raw text from numbered folder
    const textPath = path.join(
      this.folderManager.basePath,
      gutenbergId,
      `${gutenbergId}.txt`
    );
    const rawText = await fs.readFile(textPath, 'utf-8');

    // Extract metadata (simple example - real parser would be more robust)
    const title = extractTitle(rawText);
    const author = extractAuthor(rawText);

    // 2. Rename folder: numbered → named
    await this.folderManager.renameToDone(gutenbergId, title, author);

    // 3. Start Convex pipeline via HTTP action
    const { jobId, bookId } = await this.convexClient.startPipelineJob({
      gutenbergId,
      title,
      author,
      textContent: rawText,
    });

    console.log(`Started job ${jobId} for book ${bookId}`);

    // 4. Poll job status until complete
    while (true) {
      const job = await this.convexClient.getJobStatus(jobId);

      console.log(`Job ${jobId}: ${job.status} (${job.progress}%)`);

      if (job.status === "done") {
        // 5. Move folder to _done
        await this.folderManager.moveToDone(title, author);
        console.log(`Pipeline complete for: ${title}`);
        break;
      }

      if (job.status === "error") {
        console.error(`Pipeline failed: ${job.error}`);
        break;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}
```

### Pattern 4: PDF Generation as Convex Action

**What:** Generate PDFs in Convex action using Node.js libraries (PDFKit, Puppeteer)

**When to use:** When you want PDF generation in the cloud (not local machine)

**Trade-offs:**
- ✅ PDFs stored directly in Convex storage
- ✅ No local dependencies for PDF libraries
- ✅ Can run alongside other actions
- ❌ 10-minute timeout for very large books
- ❌ 512MB memory limit (may need chunking for huge PDFs)
- ❌ Slower than local generation (network latency)

**Example:**
```typescript
// convex/pipeline/actions.ts
"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import PDFDocument from 'pdfkit';

export const generateKDPInterior = action({
  args: {
    bookId: v.id("books"),
    templateId: v.id("templates"),
    cleanedText: v.string(),
  },
  handler: async (ctx, args) => {
    // Load template settings
    const template = await ctx.runQuery(api.templates.get, {
      id: args.templateId
    });

    if (!template) throw new Error("Template not found");

    // Create PDF with PDFKit
    const doc = new PDFDocument({
      size: [6 * 72, 9 * 72], // 6x9 inches (KDP standard)
      margins: {
        top: template.settings.margins.top * 72,
        bottom: template.settings.margins.bottom * 72,
        left: template.settings.margins.left * 72,
        right: template.settings.margins.right * 72,
      },
    });

    // Collect PDF chunks
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));

    // Add content
    doc.fontSize(template.settings.fontSize)
       .lineGap(template.settings.lineHeight);

    // Split into chapters (example - real implementation would be more robust)
    const chapters = args.cleanedText.split(/\n\nCHAPTER \d+\n\n/);

    for (const chapter of chapters) {
      doc.addPage().text(chapter, {
        align: 'justify',
        indent: 0.5 * 72, // First line indent
      });
    }

    doc.end();

    // Wait for PDF to finish
    await new Promise((resolve) => doc.on('end', resolve));

    // Combine chunks into single buffer
    const pdfBuffer = Buffer.concat(chunks);

    // Store in Convex
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    const storageId = await ctx.storage.store(blob);

    // Update book record
    await ctx.runMutation(api.books.patch, {
      bookId: args.bookId,
      pdfFileId: storageId,
      status: "ready",
    });

    return { storageId, pdfSize: pdfBuffer.length };
  },
});
```

**Alternative: Local PDF Generation**
For very large books or faster processing, generate PDFs in the local worker script:
```typescript
// worker/pdfGenerator.ts
import PDFDocument from 'pdfkit';
import fs from 'fs';

export async function generatePDFLocal(
  cleanedText: string,
  outputPath: string,
  template: TemplateSettings
): Promise<void> {
  const doc = new PDFDocument({ /* same config */ });
  const stream = fs.createWriteStream(outputPath);

  doc.pipe(stream);
  // ... same PDF generation logic ...
  doc.end();

  await new Promise(resolve => stream.on('finish', resolve));
}

// Then upload to Convex:
const pdfBuffer = await fs.readFile(outputPath);
const blob = new Blob([pdfBuffer]);
const storageId = await convexClient.uploadFile(blob);
```

## Data Flow

### End-to-End Pipeline Flow

```
[1. SCAN] Local Worker scans numbered folders
    ↓
[2. READ] Worker reads /12345/12345.txt
    ↓
[3. EXTRACT] Worker parses metadata (title, author)
    ↓
[4. RENAME #1] Worker renames /12345/ → /Author - Title/
    ↓
[5. UPLOAD] Worker POSTs to /api/pipeline/start
    ├─ HTTP Action creates book record
    ├─ HTTP Action creates job (type: "import", status: "queued")
    └─ HTTP Action stores raw text in Convex storage
    ↓
[6. TEXT CLEANUP] Worker triggers cleanTextWithKimi action
    ├─ Action chunks text (10k chars/chunk)
    ├─ Action calls Kimi K2 API for each chunk (with retries)
    ├─ Action updates job progress (0-100%)
    ├─ Action stores cleaned text in Convex storage
    └─ Action updates book status: "imported" → "cleaned"
    ↓
[7. CHAPTER DETECTION] Worker triggers detectChapters action
    ├─ Action analyzes cleaned text structure
    ├─ Action identifies chapter boundaries
    └─ Action stores chapter metadata
    ↓
[8. PDF GENERATION] Worker triggers generateKDPInterior action
    ├─ Action loads template settings
    ├─ Action generates PDF with PDFKit
    ├─ Action stores PDF in Convex storage
    └─ Action updates book status: "cleaned" → "ready"
    ↓
[9. COVER DESIGN] Worker triggers createCover action (optional)
    ├─ Action calls Canva API with title/author
    ├─ Action downloads cover image
    └─ Action stores cover in Convex storage
    ↓
[10. EXPORT] Worker triggers exportToDrive action (optional)
    ├─ Action downloads PDF from Convex storage
    ├─ Action uploads to Google Drive
    └─ Action stores Drive link in book record
    ↓
[11. RENAME #2] Worker moves folder to /_done/Author - Title/
    ↓
[12. COMPLETE] Job status → "done", book status → "ready"
```

### Request Flow (Local → Cloud)

```
Local Worker (Node.js)
    ↓ HTTP POST
Convex HTTP Action (receives request)
    ↓ ctx.runMutation()
Convex Mutation (writes to database)
    ↓ reactively updates
React Frontend (useQuery hook receives update)
```

### State Management

```
[BOOKS TABLE]
status: "imported" → "cleaned" → "ready"
         ↑              ↑           ↑
    (raw upload)  (AI cleanup)  (PDF ready)

[JOBS TABLE]
status: "queued" → "running" → "done" / "error"
progress: 0% → ... → 100%
logs: "Starting..." → "Cleaned chunk 1/5..." → "Complete!"
```

### Key Data Flows

1. **Local → Cloud (Upload):** Worker reads local file → HTTP POST to /api/pipeline/start → Convex stores in database + storage
2. **Cloud → Cloud (Processing):** HTTP action schedules action → Action calls external API → Action updates database via mutation
3. **Cloud → Browser (Monitoring):** Database mutation → Reactive query → React component re-renders with new state
4. **Cloud → Local (Completion):** Worker polls job status → When "done", worker renames folder → Process repeats for next book

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-100 books | Single worker script, sequential processing, current architecture is fine |
| 100-1000 books | Parallel workers (5-10), batch API calls to Kimi K2, consider local PDF generation for speed |
| 1000+ books | Distributed workers, message queue (BullMQ), caching for Canva templates, database for worker coordination |

### Scaling Priorities

1. **First bottleneck:** AI API rate limits
   - Kimi K2 likely has rate limits (e.g., 100 requests/minute)
   - **Fix:** Implement token bucket pattern, queue requests, use multiple API keys

2. **Second bottleneck:** PDF generation time
   - Large books (500+ pages) take 30-60 seconds each
   - **Fix:** Move to local generation, parallelize across multiple workers

3. **Third bottleneck:** Convex action timeout (10 minutes)
   - Very large books may exceed timeout
   - **Fix:** Split into smaller actions (e.g., one action per chapter), use scheduled actions to chain work

### Single-User Optimization

Since BookZang is an internal tool for one user:
- **Simplicity > scalability:** Don't over-engineer for distributed systems
- **Sequential is fine:** Process 1 book at a time, no need for complex queuing
- **Local when faster:** PDF generation local = faster feedback loop
- **Cloud for state:** Convex tracks progress = can monitor from anywhere

## Anti-Patterns

### Anti-Pattern 1: Storing Large Text in Mutations

**What people do:** Pass entire book text (500KB+) as mutation argument

**Why it's wrong:**
- Convex mutation arguments are limited (typically <10MB total request size)
- Slow network transfer
- Mutation logs become huge and hard to debug

**Do this instead:** Store text in Convex file storage, pass storageId as reference
```typescript
// ❌ BAD: Passing large text directly
await ctx.runMutation(api.books.setCleanedText, {
  bookId,
  cleanedText: "500KB of text...", // Too large!
});

// ✅ GOOD: Store in file storage, reference by ID
const blob = new Blob([cleanedText], { type: 'text/plain' });
const storageId = await ctx.storage.store(blob);
await ctx.runMutation(api.books.patch, {
  bookId,
  cleanedFileId: storageId, // Just an ID reference
});
```

### Anti-Pattern 2: Calling Actions from Actions

**What people do:** Action A calls Action B directly using `ctx.runAction()`

**Why it's wrong:**
- Actions have 10-minute timeout → chained actions compound timeout risk
- No automatic retries → failure in Action B fails entire chain
- Hard to debug which action failed
- Difficult to resume from failure point

**Do this instead:** Use job queue pattern with mutations tracking state
```typescript
// ❌ BAD: Action calling action
export const processBook = action({
  handler: async (ctx, args) => {
    const cleaned = await ctx.runAction(api.pipeline.cleanText, { ... });
    const pdf = await ctx.runAction(api.pipeline.generatePDF, { ... });
    const cover = await ctx.runAction(api.pipeline.createCover, { ... });
  },
});

// ✅ GOOD: Worker orchestrates via job state
// Worker:
await convexClient.startCleanup(bookId);
await pollUntilComplete(jobId);
await convexClient.startPDFGeneration(bookId);
await pollUntilComplete(jobId2);
await convexClient.startCoverGeneration(bookId);

// Each action is independent, can retry individually
```

### Anti-Pattern 3: Polling the Database Every Second

**What people do:** Worker script polls `jobs.get(jobId)` every 1 second to check status

**Why it's wrong:**
- Wastes Convex query credits
- Unnecessary database load
- Creates "chatty" network traffic
- 1-second polling still has lag → not truly realtime

**Do this instead:** Use Convex's realtime subscriptions or poll less frequently
```typescript
// ❌ BAD: Aggressive polling
while (true) {
  const job = await convexClient.getJobStatus(jobId);
  if (job.status === "done") break;
  await sleep(1000); // Every second!
}

// ✅ GOOD: Reasonable polling interval
while (true) {
  const job = await convexClient.getJobStatus(jobId);
  if (job.status === "done") break;
  await sleep(5000); // Every 5 seconds is plenty
}

// ✅ BETTER: Use Convex subscriptions (if worker can maintain WebSocket)
// Or combine with webhooks: Convex calls worker when job completes
```

### Anti-Pattern 4: No Idempotency in HTTP Actions

**What people do:** HTTP action that creates records without checking duplicates

**Why it's wrong:**
- Network failures → worker retries → duplicate books created
- No way to safely restart failed pipeline
- Race conditions if worker runs twice

**Do this instead:** Use unique keys and check-before-insert pattern
```typescript
// ❌ BAD: No duplicate checking
http.route({
  path: "/api/pipeline/start",
  handler: httpAction(async (ctx, request) => {
    const { gutenbergId, title } = await request.json();

    // Always creates new book, even if already exists!
    const bookId = await ctx.runMutation(api.books.create, {
      title, gutenbergId
    });
  }),
});

// ✅ GOOD: Idempotent - safe to retry
http.route({
  path: "/api/pipeline/start",
  handler: httpAction(async (ctx, request) => {
    const { gutenbergId, title } = await request.json();

    // Check if book already exists
    let book = await ctx.runQuery(api.books.getByGutenbergId, {
      gutenbergId
    });

    if (!book) {
      // Only create if doesn't exist
      const bookId = await ctx.runMutation(api.books.create, {
        title, gutenbergId
      });
      book = await ctx.runQuery(api.books.get, { id: bookId });
    }

    return new Response(JSON.stringify({ bookId: book._id }));
  }),
});
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Kimi K2 API | Convex action via fetch with retry logic | Rate limits likely, implement exponential backoff |
| Canva API | Convex action via Canva Connect APIs | Use Design Editing API for cover generation |
| Google Drive API | Convex action via Drive REST API | OAuth for auth, consider service account |
| PDF Generation | Convex action with PDFKit (or local worker) | Local = faster, Convex = simpler deployment |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Worker ↔ Convex | HTTP (POST to HTTP actions) | Worker initiates, Convex responds with job IDs |
| Convex HTTP Action ↔ Mutations | ctx.runMutation() | HTTP action orchestrates, mutation writes data |
| Convex Action ↔ External API | fetch() with retries | Action handles rate limits and errors |
| React ↔ Convex | useQuery/useMutation hooks | Realtime subscriptions for job monitoring |
| Worker ↔ Filesystem | fs/promises | Worker manages folder state (rename, move) |

## Build Order Implications

### Dependencies Between Components

```
MUST BUILD FIRST:
1. Enhanced schema (add cleanedFileId, pdfFileId, etc.)
2. Job state mutations (create, updateStatus, progress tracking)

THEN BUILD:
3. HTTP actions for worker communication (/api/pipeline/start, etc.)
4. Local worker script (scanner, folder manager, Convex client)

THEN BUILD (parallel):
5a. Text cleanup action (Kimi K2 integration)
5b. PDF generation action (PDFKit integration)
5c. Canva action (cover design)

FINALLY BUILD:
6. Side-by-side diff review UI (React component)
7. Google Drive export (optional feature)
```

### Recommended Phase Structure

**Phase 1: Core Infrastructure (Week 1)**
- Update Convex schema for pipeline fields
- Create HTTP actions for worker↔Convex communication
- Build basic local worker script (scan + upload)
- Test: Worker can scan folder, upload to Convex, create book record

**Phase 2: Text Processing (Week 2)**
- Implement Kimi K2 action with chunking + retries
- Add job progress tracking UI in React
- Build folder renaming logic in worker
- Test: Complete flow from raw text → cleaned text

**Phase 3: PDF Generation (Week 3)**
- Choose PDF strategy (local vs Convex action)
- Implement PDFKit with template settings
- Add chapter detection logic
- Test: Cleaned text → formatted PDF

**Phase 4: Polish & Optional Features (Week 4)**
- Build side-by-side diff review UI
- Add Canva cover integration
- Google Drive export (if needed)
- Error recovery and resume logic

## Sources

**Convex Architecture (HIGH confidence):**
- [Convex Actions Documentation](https://docs.convex.dev/functions/actions) - Official documentation on actions, external API calls, Node.js runtime
- [Convex HTTP API](https://docs.convex.dev/http-api/) - How external systems call Convex functions
- [Convex HTTP Actions](https://docs.convex.dev/functions/http-actions) - Building public HTTP endpoints in Convex

**PDF Generation Patterns (MEDIUM confidence):**
- [Scalable PDF Generation Architecture](https://medium.com/@jarsaniatirth/scalable-pdf-generation-architecture-high-level-design-for-enterprise-grade-solutions-f4d99be60d1b) - Enterprise patterns for PDF generation
- [Best PDF APIs for 2026](https://pdfgeneratorapi.com/blog/best-pdf-apis-2026) - API-driven PDF generation trends
- [Top PDF Generators for Node.js in 2026](https://slashdot.org/software/pdf-generators/for-node.js/) - Library comparison

**Integration Orchestration (MEDIUM confidence):**
- [APIs for AI Agents: Integration Patterns (2026)](https://composio.dev/blog/apis-ai-agents-integration-patterns) - AI API orchestration patterns
- [AI Agent Orchestration Guide](https://fast.io/resources/ai-agent-orchestration/) - Patterns for coordinating AI workflows

**Job Queue Architecture (HIGH confidence):**
- [Web-Queue-Worker Architecture Style](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/web-queue-worker) - Microsoft Azure pattern documentation
- [Queue-Based Load Leveling Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/queue-based-load-leveling) - Official Azure pattern

**Text Processing Pipelines (MEDIUM confidence):**
- [Chunking Strategies for RAG](https://weaviate.io/blog/chunking-strategies-for-rag) - Text chunking best practices for LLMs
- [Building Long-Running TTS Pipelines with LangGraph](https://vadim.blog/2026/01/18/langgraph-tts-therapeutic-audio-architecture) - Pipeline architecture for long-form processing

**Canva API Integration (HIGH confidence):**
- [Canva Connect APIs Documentation](https://www.canva.dev/docs/connect/) - Official Canva developer documentation
- [Smarter design, connected content: Canva's biggest API update](https://www.canva.com/newsroom/news/new-apis-data-connectors/) - Latest API capabilities

**Book Production Workflow (LOW confidence):**
- [Automated Publishing Workflows, Explained](https://medium.com/hederis-app/automated-publishing-workflows-explained-58c5da5fb3fe) - Publishing automation patterns
- [MPS Books Production Workflow](https://www.mpslimited.com/books-production-workflow-and-tracking/) - Enterprise book production systems

---
*Architecture research for: BookZang Creator (Book Production Pipeline)*
*Researched: 2026-02-12*
*Overall confidence: HIGH for Convex patterns, MEDIUM for AI/PDF integration, HIGH for worker architecture*
