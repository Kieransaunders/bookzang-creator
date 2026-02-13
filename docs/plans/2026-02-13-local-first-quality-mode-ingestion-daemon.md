# Local-First Quality Mode Ingestion Daemon Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a quality-first ingestion pipeline that prefers Gutenberg EPUB, writes source/extracted artifacts to local `Library/`, and keeps Convex as metadata/control plane only.

**Architecture:** Introduce a daemonized local worker that leases ingestion jobs from Convex, resolves best source format (`epub3`/`epub` before `txt`), downloads/extracts content locally, then reports status and file pointers back to Convex. Keep existing UI reactive through Convex queries while moving heavy payloads out of cloud storage. Preserve inline semantics (italics/small caps markers) in annotated markdown for downstream cleanup and typography.

**Tech Stack:** TypeScript, Convex (metadata only), Node.js filesystem/network APIs, `node:test`, `tsx`, EPUB unzip/parse library (e.g. `adm-zip` + XML parser), macOS `launchd`

---

### Task 1: Create test harness for local ingestion modules

**Files:**

- Modify: `package.json`
- Modify: `tsconfig.test.json`
- Create: `convex/__tests__/ingestSourcePolicy.test.ts`
- Create: `scripts/daemon/__tests__/localPathLayout.test.ts`

**Step 1: Write the failing tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { selectPreferredSource } from "../../convex/intakeSourceResolver";

test("quality mode prefers epub over txt", () => {
  const picked = selectPreferredSource([
    { format: "txt", url: "https://www.gutenberg.org/ebooks/11.txt.utf-8" },
    {
      format: "epub.noimages",
      url: "https://www.gutenberg.org/ebooks/11.epub.noimages",
    },
  ]);
  assert.equal(picked.format, "epub.noimages");
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:ingest-local`
Expected: FAIL with missing module/function errors.

**Step 3: Add minimal test command wiring**

```json
{
  "scripts": {
    "test:ingest-local": "tsx --tsconfig tsconfig.test.json --test convex/__tests__/ingestSourcePolicy.test.ts scripts/daemon/__tests__/localPathLayout.test.ts"
  }
}
```

**Step 4: Re-run tests and verify command executes**

Run: `npm run test:ingest-local`
Expected: FAIL at assertions/imports (harness works).

**Step 5: Commit**

```bash
git add package.json tsconfig.test.json convex/__tests__/ingestSourcePolicy.test.ts scripts/daemon/__tests__/localPathLayout.test.ts
git commit -m "test(ingest): scaffold local-first quality mode test harness"
```

### Task 2: Add metadata schema for local artifacts and daemon leases

**Files:**

- Modify: `convex/schema.ts`
- Create: `convex/ingestJobs.ts`
- Test: `convex/__tests__/ingestSourcePolicy.test.ts`

**Step 1: Write failing tests for metadata shape and lease transitions**

```ts
test("lease transition queued -> leased -> completed is valid", () => {
  // assert transition helper allows only expected states
});
```

**Step 2: Run test to verify failure**

Run: `npm run test:ingest-local`
Expected: FAIL because transition helpers/schema fields do not exist.

**Step 3: Implement minimal schema + metadata API**

```ts
ingestJobs: defineTable({
  bookId: v.id("books"),
  gutenbergId: v.string(),
  mode: v.union(v.literal("quality"), v.literal("fast")),
  status: v.union(
    v.literal("queued"),
    v.literal("leased"),
    v.literal("completed"),
    v.literal("failed"),
  ),
  leaseOwner: v.optional(v.string()),
  leaseExpiresAt: v.optional(v.number()),
  stage: v.optional(v.string()),
  selectedFormat: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
  localSourcePath: v.optional(v.string()),
  localExtractedPath: v.optional(v.string()),
  checksum: v.optional(v.string()),
  warning: v.optional(v.string()),
  error: v.optional(v.string()),
  queuedAt: v.number(),
  updatedAt: v.number(),
}).index("by_status", ["status"]);
```

**Step 4: Run verification**

Run: `npm run test:ingest-local && npm run lint`
Expected: PASS for new schema/types and transition helpers.

**Step 5: Commit**

```bash
git add convex/schema.ts convex/ingestJobs.ts convex/__tests__/ingestSourcePolicy.test.ts
git commit -m "feat(ingest): add metadata schema and lease API for local daemon"
```

### Task 3: Implement Gutenberg source resolver with quality priority

**Files:**

- Create: `convex/intakeSourceResolver.ts`
- Create: `convex/__tests__/intakeSourceResolver.test.ts`
- Modify: `package.json`

**Step 1: Write failing tests for format selection order**

```ts
test("source order: epub3.images > epub.images > epub.noimages > txt", () => {
  // assert selection from mixed input list
});
```

**Step 2: Run tests to verify failure**

Run: `npm run test:ingest-local`
Expected: FAIL until resolver is implemented.

**Step 3: Implement minimal resolver**

```ts
export const QUALITY_PRIORITY = [
  "epub3.images",
  "epub.images",
  "epub.noimages",
  "txt",
] as const;

export function selectPreferredSource(
  formats: Array<{ format: string; url: string }>,
) {
  for (const format of QUALITY_PRIORITY) {
    const hit = formats.find((f) => f.format === format);
    if (hit) return hit;
  }
  throw new Error("No supported source formats available");
}
```

**Step 4: Run tests**

Run: `npm run test:ingest-local`
Expected: PASS for selection and fallback cases.

**Step 5: Commit**

```bash
git add convex/intakeSourceResolver.ts convex/__tests__/intakeSourceResolver.test.ts package.json
git commit -m "feat(ingest): add quality-mode Gutenberg source resolver"
```

### Task 4: Build local path contract and artifact manifest writer

**Files:**

- Create: `scripts/daemon/localPaths.ts`
- Create: `scripts/daemon/manifest.ts`
- Test: `scripts/daemon/__tests__/localPathLayout.test.ts`

**Step 1: Write failing tests for deterministic paths**

```ts
test("book 11 paths map into Library/epub and Library/work", () => {
  // assert source, extracted, derived, exports, manifest paths
});
```

**Step 2: Run tests to verify failure**

Run: `npm run test:ingest-local`
Expected: FAIL until path helpers exist.

**Step 3: Implement minimal path + manifest helpers**

```ts
export function buildLocalPaths(root: string, gutenbergId: string) {
  return {
    txtPath: `${root}/epub/${gutenbergId}/pg${gutenbergId}.txt`,
    epubPath: `${root}/epub/${gutenbergId}/pg${gutenbergId}.epub`,
    extractedPath: `${root}/work/${gutenbergId}/extracted/book.annotated.md`,
    derivedPath: `${root}/work/${gutenbergId}/derived/chapters.json`,
    manifestPath: `${root}/work/${gutenbergId}/manifest.json`,
    exportsDir: `${root}/work/${gutenbergId}/exports`,
  };
}
```

**Step 4: Run tests**

Run: `npm run test:ingest-local`
Expected: PASS for path and manifest serialization tests.

**Step 5: Commit**

```bash
git add scripts/daemon/localPaths.ts scripts/daemon/manifest.ts scripts/daemon/__tests__/localPathLayout.test.ts
git commit -m "feat(daemon): add deterministic local artifact path contract"
```

### Task 5: Add EPUB extraction preserving inline formatting markers

**Files:**

- Create: `scripts/daemon/epubExtract.ts`
- Create: `scripts/daemon/__tests__/epubExtract.test.ts`
- Modify: `package.json`

**Step 1: Write failing tests for italics/small-caps preservation**

```ts
test("xhtml emphasis maps to annotated markdown markers", async () => {
  // <em>Hello</em> -> *Hello*
  // <span class='smallcaps'>Rome</span> -> {smallcaps:Rome}
});
```

**Step 2: Run tests to verify failure**

Run: `npm run test:ingest-local`
Expected: FAIL until extraction and mapping exist.

**Step 3: Implement minimal extractor + mapper**

```ts
// Parse OPF + spine order
// Extract chapter XHTML
// Normalize whitespace
// Preserve inline semantics:
//   <em>/<i> => *text*
//   .smallcaps spans => {smallcaps:text}
// Emit combined annotated markdown + chapter JSON
```

**Step 4: Run tests**

Run: `npm run test:ingest-local`
Expected: PASS for inline marker and chapter ordering tests.

**Step 5: Commit**

```bash
git add scripts/daemon/epubExtract.ts scripts/daemon/__tests__/epubExtract.test.ts package.json
git commit -m "feat(ingest): extract epub to annotated markdown preserving inline semantics"
```

### Task 6: Implement daemon lease loop and Convex reporting

**Files:**

- Create: `scripts/daemon/ingestDaemon.ts`
- Create: `scripts/daemon/convexClient.ts`
- Modify: `package.json`
- Modify: `convex/ingestJobs.ts`

**Step 1: Write failing tests for lease lifecycle + idempotent retries**

```ts
test("daemon renews lease and requeues stale jobs", async () => {
  // simulate lease expiration and assert queue recovery
});
```

**Step 2: Run tests to verify failure**

Run: `npm run test:ingest-local`
Expected: FAIL before daemon loop and lease API complete.

**Step 3: Implement minimal daemon loop**

```ts
while (running) {
  const job = await leaseNextJob(workerId);
  if (!job) {
    await sleep(2000);
    continue;
  }
  await reportStage(job._id, "resolving_source");
  // fetch source -> extract -> write local artifacts
  await completeJob(job._id, metadata);
}
```

**Step 4: Run tests + typecheck**

Run: `npm run test:ingest-local && npm run lint`
Expected: PASS; daemon and Convex APIs compile cleanly.

**Step 5: Commit**

```bash
git add scripts/daemon/ingestDaemon.ts scripts/daemon/convexClient.ts package.json convex/ingestJobs.ts
git commit -m "feat(daemon): add long-lived lease worker for local quality ingestion"
```

### Task 7: Wire intake flow to queue quality-mode ingest jobs

**Files:**

- Modify: `convex/intake.ts`
- Modify: `convex/books.ts`
- Modify: `src/components/ImportModal.tsx`
- Create: `convex/__tests__/intakeQueueQualityMode.test.ts`

**Step 1: Write failing tests for quality-mode enqueue behavior**

```ts
test("enqueueUpload defaults to quality mode and queues ingestJobs row", () => {
  // assert ingestJobs row created with mode=quality
});
```

**Step 2: Run tests to verify failure**

Run: `npm run test:ingest-local`
Expected: FAIL until intake wiring exists.

**Step 3: Implement minimal queue wiring + UI indicator**

```ts
// intake.enqueueUpload -> create ingestJobs status=queued, mode="quality"
// ImportModal copy: "Quality mode: prefer EPUB when available"
// books status remains importing until daemon completes extraction metadata
```

**Step 4: Run verification**

Run: `npm run test:ingest-local && npm run lint`
Expected: PASS; UI and backend compile.

**Step 5: Commit**

```bash
git add convex/intake.ts convex/books.ts src/components/ImportModal.tsx convex/__tests__/intakeQueueQualityMode.test.ts
git commit -m "feat(intake): queue quality-mode local ingestion jobs"
```

### Task 8: Add local operations docs and launchd service setup

**Files:**

- Create: `scripts/daemon/bookzang.ingest.daemon.plist`
- Create: `docs/ops/local-ingest-daemon.md`
- Modify: `package.json`

**Step 1: Write failing runbook checklist**

```md
- daemon starts at login
- restarts on crash
- writes heartbeat every 30s
- uses LIBRARY_ROOT and CONVEX_URL from env
```

**Step 2: Verify current setup fails checklist**

Run: `launchctl list | grep bookzang.ingest`
Expected: no service registered.

**Step 3: Add minimal service and ops scripts**

```json
{
  "scripts": {
    "daemon:ingest": "tsx scripts/daemon/ingestDaemon.ts",
    "daemon:install": "bash scripts/daemon/install-launchd.sh",
    "daemon:uninstall": "bash scripts/daemon/uninstall-launchd.sh"
  }
}
```

**Step 4: Run verification**

Run: `npm run lint`
Expected: PASS. Manual verification in runbook confirms `launchd` load/start/stop.

**Step 5: Commit**

```bash
git add scripts/daemon/bookzang.ingest.daemon.plist docs/ops/local-ingest-daemon.md package.json
git commit -m "docs(ops): add launchd-managed local ingest daemon runbook"
```

### Task 9: End-to-end quality mode proof on real Gutenberg ID

**Files:**

- Create: `docs/plans/2026-02-13-local-first-quality-mode-ingestion-verification.md`
- Modify: `Project docs/ideas.md`

**Step 1: Write failing verification checklist**

```md
- Queue Gutenberg ID 77920 in quality mode
- Verify source selection chooses EPUB when available
- Verify local files written under Library/work/77920
- Verify annotated markdown preserves italics/small-caps markers
- Verify Convex ingestJobs row completed with local paths and checksum
```

**Step 2: Run flow and capture evidence**

Run: `npm run daemon:ingest` (in one terminal) and app intake flow (in another)
Expected: job reaches `completed`; artifacts and metadata present.

**Step 3: Run full checks**

Run: `npm run test:ingest-local && npm run lint`
Expected: PASS.

**Step 4: Document outcomes and fallback behavior**

```md
Include selected source format, artifact paths, parser warnings, and TXT fallback evidence for one EPUB-missing ID.
```

**Step 5: Commit**

```bash
git add docs/plans/2026-02-13-local-first-quality-mode-ingestion-verification.md Project\ docs/ideas.md
git commit -m "docs(ingest): verify local-first quality mode daemon workflow"
```

## Required Quality Gate Before Phase 3 Typography Work

- `EPUB-first`: For IDs with EPUB available, resolver must pick EPUB and record `selectedFormat`.
- `Local artifacts only`: extracted content and derived chapters are stored under `Library/work/<id>/`.
- `Convex metadata only`: Convex stores pointers, checksums, statuses; no large extracted payloads.
- `Preserved semantics`: annotated markdown contains emphasis/small-caps markers from EPUB.
- `Daemon reliability`: lease heartbeat and stale-job requeue verified.
- `Operational readiness`: `npm run test:ingest-local` and `npm run lint` pass on same commit.

If any gate fails, Phase 3 typography work remains blocked until corrected.
