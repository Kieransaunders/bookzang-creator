# Phase 1: Book Intake and Pipeline Visibility - Research

**Researched:** 2026-02-12
**Domain:** Gutenberg ingestion and Convex-backed pipeline observability
**Confidence:** HIGH

## User Constraints

### Locked Decisions

- Existing stack remains React + Vite + TypeScript + Convex backend.
- Local 30GB Gutenberg library in project folder is the source of discovery.
- Processing is local-first; Convex stores metadata and artifacts.
- Product remains a single-user internal tool.
- Roadmap sequence is fixed: intake -> cleanup/review -> interior export -> batch packaging.
- KDP compliance gates are strict, but enforced in later phases.

### Claude's Discretion

- How to implement local discovery execution (UI-triggered worker/script shape).
- Exact Convex function boundaries for intake, metadata extraction, and job updates.
- Status model implementation details as long as user sees Queued/Running/Completed/Failed with progress and error visibility.

### Deferred Ideas (OUT OF SCOPE)

- Cleanup/review workflow details (Phase 2).
- Interior PDF export and KDP validation logic (Phase 3).
- Folder rename-to-done lifecycle, Canva, and batch packaging automation (Phase 4).

## Summary

Phase 1 should be implemented as two intake paths that converge on one ingestion pipeline: (1) manual `.txt` upload from dashboard and (2) local library discovery from `library/epub/<numeric-id>/pg*.txt`. Both paths should produce the same normalized `books` record and one `jobs` record, then run metadata extraction before marking import complete. This prevents drift between "manual import" and "discovered import" behavior.

For this stack, Convex already provides the primitives needed: upload URLs for browser file upload, actions for server-side file parsing/external work, scheduler-backed background execution, and reactive `useQuery` updates for dashboard visibility. Do not build custom queue infrastructure or custom realtime channels. Use Convex state transitions as the source of truth and let React subscriptions render job progress and errors.

The biggest planning risk in this phase is hidden inconsistency: status labels (`done/error` vs `Completed/Failed`), duplicate book creation from retried imports, and metadata extraction that depends on fragile assumptions. Plan explicit idempotency keys (`gutenbergId` + source path), normalized status enums, and deterministic fallback extraction rules from Project Gutenberg headers (`Title:`, `Author:`, `*** START...`).

**Primary recommendation:** Implement one idempotent ingestion service in Convex (metadata-first, job-tracked), then plug both manual upload and library discovery into it.

## Standard Stack

### Core

| Library    | Version | Purpose                                | Why Standard                                     |
| ---------- | ------- | -------------------------------------- | ------------------------------------------------ |
| React      | 19.2.1  | Dashboard UI, import flow, jobs UI     | Already in repo and integrated with Convex hooks |
| Convex     | 1.31.2  | DB, file storage, functions, realtime  | Native fit for status-driven pipeline UI         |
| TypeScript | 5.7.2   | Shared typing across UI/backend/worker | Reduces schema/status drift                      |
| Vite       | 6.2.0   | Frontend build/dev server              | Existing project standard                        |

### Supporting

| Library                                                    | Version         | Purpose                                                  | When to Use                                              |
| ---------------------------------------------------------- | --------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| `convex/browser` `ConvexHttpClient`                        | 1.31.2          | Worker/script calls to Convex mutations/actions          | Library discovery script running outside browser         |
| Convex File Storage (`generateUploadUrl`, `storage.store`) | Convex platform | Upload and persist raw text artifacts                    | Manual upload and imported text artifact lifecycle       |
| Convex Scheduler (`ctx.scheduler.runAfter`)                | Convex platform | Background job kickoff with transactional intent capture | Import mutation should enqueue extraction work           |
| `@convex-dev/auth`                                         | 0.0.80          | Existing auth integration                                | Keep current single-user auth behavior, no auth redesign |

### Alternatives Considered

| Instead of                     | Could Use                                       | Tradeoff                                                                                   |
| ------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `ConvexHttpClient` from worker | Custom Convex HTTP actions for all worker calls | Extra routing/CORS complexity; Convex docs recommend HTTP client when caller is controlled |
| Upload URLs for browser files  | HTTP action file upload endpoint                | HTTP action request limit is 20MB; upload URL supports arbitrarily large files             |

**Installation:**

```bash
npm install -D tsx
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/             # Import modal, library list, jobs views
├── hooks/                  # Intake/discovery trigger hooks (optional)
└── lib/                    # UI helpers (status labels, formatting)

convex/
├── books.ts                # Book queries/mutations
├── jobs.ts                 # Job queries/mutations
├── intake.ts               # NEW: shared intake orchestration entrypoints
├── intakeMetadata.ts       # NEW: metadata extraction action/helpers
├── files.ts                # Upload URL mutation
└── schema.ts               # status enums + indexes

scripts/
└── discover-library.ts     # NEW: local library scanner using ConvexHttpClient
```

### Pattern 1: Unified Intake Command

**What:** Manual upload and library discovery call the same backend command with source metadata.
**When to use:** Always, to avoid duplicate business logic.
**Example:**

```typescript
// Source: https://docs.convex.dev/functions/actions + https://docs.convex.dev/scheduling/scheduled-functions
export const enqueueIntake = mutation({
  args: {
    source: v.union(v.literal("upload"), v.literal("library")),
    gutenbergId: v.optional(v.string()),
    fileId: v.id("_storage"),
    sourcePath: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // idempotency check first (by_gutenberg_id or sourcePath key)
    const jobId = await ctx.db.insert("jobs", {
      type: "import",
      status: "queued",
      progress: 0,
      logs: "Queued for metadata extraction",
      gutenbergId: args.gutenbergId,
    });
    await ctx.scheduler.runAfter(0, internal.intakeMetadata.extractAndPersist, {
      jobId,
      fileId: args.fileId,
      gutenbergId: args.gutenbergId,
      source: args.source,
      sourcePath: args.sourcePath,
    });
    return { jobId };
  },
});
```

### Pattern 2: Metadata Extraction in Action

**What:** Read stored text in an action and parse Gutenberg headers/body markers.
**When to use:** For ING-03 and for any uploaded/discovered raw text.
**Example:**

```typescript
// Source: https://docs.convex.dev/file-storage/serve-files (storage.get in ActionCtx)
export const extractAndPersist = internalAction({
  args: { jobId: v.id("jobs"), fileId: v.id("_storage") },
  handler: async (ctx, args) => {
    const blob = await ctx.storage.get(args.fileId);
    if (!blob) throw new Error("Missing uploaded file");
    const text = await blob.text();

    const title =
      text.match(/^Title:\s*(.+)$/m)?.[1]?.trim() ?? "Unknown Title";
    const author =
      text.match(/^Author:\s*(.+)$/m)?.[1]?.trim() ?? "Unknown Author";
    const startIdx = text.search(
      /^\*\*\* START OF THE PROJECT GUTENBERG EBOOK/m,
    );
    const endIdx = text.search(/^\*\*\* END OF THE PROJECT GUTENBERG EBOOK/m);
    const body =
      startIdx >= 0 && endIdx > startIdx ? text.slice(startIdx, endIdx) : text;

    // persist book + artifacts + job update via mutations
  },
});
```

### Pattern 3: Local Discovery Script with Controlled Caller Client

**What:** Node script scans `library/epub` numeric directories and enqueues intake via `ConvexHttpClient`.
**When to use:** ING-02 discovery trigger from dashboard/CLI.
**Example:**

```typescript
// Source: https://docs.convex.dev/client/javascript/node + Node fs docs
import { readdir } from "node:fs/promises";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const client = new ConvexHttpClient(process.env.CONVEX_URL!);
const dirs = await readdir("library/epub", { withFileTypes: true });
for (const d of dirs.filter((x) => x.isDirectory() && /^\d+$/.test(x.name))) {
  // resolve pg*.txt path, upload/store artifact if needed, enqueue intake once
  await client.mutation(api.intake.enqueueDiscovered, {
    gutenbergId: d.name,
    sourcePath: `library/epub/${d.name}`,
  });
}
```

### Anti-Patterns to Avoid

- **Split intake logic per source:** Causes different metadata quality and status transitions.
- **Client-side `setTimeout` fake jobs:** Current placeholder behavior is non-durable and violates OPS visibility reliability.
- **Ad-hoc status strings in UI:** Leads to `done/error` vs `Completed/Failed` mismatch.
- **Custom websocket/polling service:** Duplicates Convex realtime query subscriptions.

## Don't Hand-Roll

| Problem                          | Don't Build                              | Use Instead                                     | Why                                                        |
| -------------------------------- | ---------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| Browser file upload pipeline     | Custom multipart backend                 | Convex upload URL flow                          | Built-in secure flow, short-lived URLs, scales better      |
| Controlled worker-to-backend API | Custom HTTP router + CORS for everything | `ConvexHttpClient`                              | Convex docs explicitly recommend it for controlled callers |
| Background queue orchestration   | Bespoke queue tables/worker semantics    | Mutation + `ctx.scheduler.runAfter` + job table | Transactional intent capture and durable scheduling        |
| Realtime status updates          | Custom sockets/SSE infra                 | `useQuery` reactive subscriptions               | Native Convex caching/reactivity/consistency               |

**Key insight:** Phase 1 is mostly integration and state discipline, not infrastructure invention.

## Common Pitfalls

### Pitfall 1: Status Taxonomy Drift

**What goes wrong:** Backend stores `done/error` but UI/requirements expect `Completed/Failed` semantics.
**Why it happens:** No normalized internal enum + display mapping.
**How to avoid:** Keep canonical internal status enum (`queued|running|completed|failed`) and a single renderer map.
**Warning signs:** Jobs appear with mixed labels or filters miss records.

### Pitfall 2: Non-idempotent Discovery

**What goes wrong:** Re-triggering discovery creates duplicate books/jobs for same Gutenberg folder.
**Why it happens:** No uniqueness strategy keyed by `gutenbergId`/`sourcePath`.
**How to avoid:** Add indexed lookup and upsert-style guard before insert.
**Warning signs:** Same ID appears multiple times in Library/Jobs after retries.

### Pitfall 3: Parsing Metadata from Entire File Blindly

**What goes wrong:** Title/author extracted from preface content instead of header, or body includes license boilerplate.
**Why it happens:** Parser does not anchor to Gutenberg header markers.
**How to avoid:** Parse `Title:`/`Author:` lines first; then isolate body between `*** START` and `*** END` markers.
**Warning signs:** Books named "The Project Gutenberg eBook of..." or "Unknown Author" too often.

### Pitfall 4: Wrong Upload Path for Large Files

**What goes wrong:** Using HTTP action upload for larger files and hitting 20MB request limit.
**Why it happens:** Confusing HTTP action upload with upload URL flow.
**How to avoid:** Browser/manual upload should always use generated upload URLs.
**Warning signs:** Intermittent 413/timeouts on larger text artifacts.

### Pitfall 5: Action Directly Triggered from UI Without Intent Record

**What goes wrong:** Job fails/retries without durable tracking; dashboard misses transitions.
**Why it happens:** Action invoked directly from client bypassing mutation-backed intent.
**How to avoid:** Client calls mutation that writes job + schedules action.
**Warning signs:** Completed work with no corresponding job history.

## Code Examples

Verified patterns from official sources:

### Browser Upload via Convex Upload URL

```typescript
// Source: https://docs.convex.dev/file-storage/upload-files
const postUrl = await generateUploadUrl();
const result = await fetch(postUrl, {
  method: "POST",
  headers: { "Content-Type": file.type },
  body: file,
});
const { storageId } = await result.json();
await createBookFromFile({ fileId: storageId });
```

### Mutation Schedules Background Work

```typescript
// Source: https://docs.convex.dev/scheduling/scheduled-functions
await ctx.scheduler.runAfter(0, internal.intakeMetadata.extractAndPersist, {
  jobId,
  fileId,
});
```

### Worker Script Calls Convex Without Custom HTTP Endpoint

```typescript
// Source: https://docs.convex.dev/client/javascript
import { ConvexHttpClient } from "convex/browser";
const client = new ConvexHttpClient(process.env.CONVEX_URL!);
await client.mutation(api.intake.enqueueDiscovered, { gutenbergId: "1342" });
```

## State of the Art

| Old Approach                                     | Current Approach                                                    | When Changed                                             | Impact                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| UI calls actions directly for long-running work  | Mutation captures intent, then schedules action                     | Current Convex best-practice guidance                    | Durable job history, safer retries, better observability |
| Build custom HTTP endpoints for internal scripts | Use `ConvexHttpClient` for controlled callers                       | Current Convex HTTP actions guidance                     | Less routing/CORS complexity, faster delivery            |
| Parse entire Gutenberg text naively              | Header/marker-aware extraction (`Title`, `Author`, `*** START/END`) | Ongoing corpus practice; validated on local `pg1342.txt` | Higher metadata accuracy and cleaner body extraction     |

**Deprecated/outdated:**

- Calling long-running actions directly from client as default control plane.
- Using HTTP action upload path for general browser uploads when upload URLs are available.

## Open Questions

1. **What file-size envelope should manual import support in Phase 1?**
   - What we know: Current UI enforces 10MB; Convex upload URL itself supports arbitrarily large files with 2-minute POST timeout.
   - What's unclear: Whether 10MB is product policy or placeholder.
   - Recommendation: Keep 10MB for first implementation; document as configurable setting.

2. **Should discovery create book records immediately or only when queued for import?**
   - What we know: Success criteria require "candidate books appear for processing" and pipeline status visibility.
   - What's unclear: Desired UX for discovered-but-not-enqueued rows.
   - Recommendation: Create `books` in `discovered`/`imported` state with linked `jobs` only when user confirms enqueue.

3. **How strict should dedupe be across manual upload and discovered Gutenberg ID?**
   - What we know: Duplicate pipeline runs are expensive and confusing.
   - What's unclear: Whether user should be allowed multiple editions of same Gutenberg ID.
   - Recommendation: Default block duplicates by `gutenbergId`; allow override with explicit "import anyway" option.

## Sources

### Primary (HIGH confidence)

- https://docs.convex.dev/file-storage/upload-files - upload URL flow, limits, 3-step pattern
- https://docs.convex.dev/file-storage/serve-files - `storage.getUrl` and `storage.get` usage scopes
- https://docs.convex.dev/functions/actions - runtime, limits, anti-pattern notes
- https://docs.convex.dev/functions/http-actions - limits, guidance on `ConvexHttpClient`
- https://docs.convex.dev/scheduling/scheduled-functions - scheduler durability and semantics
- https://docs.convex.dev/functions/query-functions - reactivity/caching/consistency model
- https://docs.convex.dev/client/javascript - `ConvexHttpClient` usage
- https://docs.convex.dev/client/javascript/node - Node usage details
- https://docs.convex.dev/database/schemas - schema/index/validation guidance
- https://nodejs.org/api/fs.html - canonical filesystem APIs for discovery scripts
- Local corpus sample: `library/epub/1342/pg1342.txt` and marker check (`*** START/END...`)
- Local codebase: `src/components/ImportModal.tsx`, `src/components/JobsPage.tsx`, `convex/books.ts`, `convex/jobs.ts`, `convex/schema.ts`

### Secondary (MEDIUM confidence)

- https://www.gutenberg.org/help/copyright.html - current public-domain context and policy framing
- https://www.gutenberg.org/cache/epub/1342/pg1342.txt - real-world metadata/header structure example

### Tertiary (LOW confidence)

- None used for critical claims.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - directly verified from repository `package.json` and Convex official docs
- Architecture: HIGH - anchored in Convex official patterns plus current project structure
- Pitfalls: MEDIUM-HIGH - validated against current code gaps and Convex limits; some parser heuristics remain implementation-dependent

**Research date:** 2026-02-12
**Valid until:** 2026-03-14
