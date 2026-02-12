# Phase 2: Text Cleanup and Editorial Approval - Research

**Researched:** 2026-02-12
**Domain:** Gutenberg text normalization, chapter segmentation, human-in-the-loop editorial approval in Convex/React
**Confidence:** MEDIUM

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

### Chapter boundaries

- Always split on clearly labeled chapter headings.
- For unlabeled section breaks, require reviewer confirmation before treating them as chapter boundaries.
- If no chapter structure is detected, represent content as a single body chapter.
- Keep front/back matter (preface, introduction, notes, appendix) as separate labeled sections.
- Accept obvious OCR-corrupted chapter headings as boundaries when intent is clear.
- If heading style changes mid-book (Roman numerals vs numeric), continue splitting consistently across valid styles.
- Keep very short detected chapters as their own chapters.
- Normalize chapter title format instead of preserving raw source heading style.

### Cleanup boundaries

- Preserve archaic spelling/grammar by default; do not modernize language.
- Use balanced paragraph unwrapping: unwrap typical hard-wrap patterns while preserving ambiguous structure.
- Apply standard punctuation normalization when confidence is high.
- For low-confidence passages, apply best-effort cleanup and flag for reviewer attention.

### Review experience

- Default review mode is side-by-side panes.
- Original text is read-only reference; only cleaned text is editable.
- Default diff granularity is line/paragraph-level highlights.
- Manual edits are treated as part of cleaned text without separate visual markers.

### Approval behavior

- Approval unlocks the remaining book pipeline UI/actions for that title (including subsequent template/export flow when applicable).
- If cleaned text is edited after approval, prompt reviewer at save time to keep or revoke approval.
- Approval requires a checklist confirmation (not single-click only).
- Approval is blocked while low-confidence cleanup flags remain unresolved.

### Claude's Discretion

- Exact checklist items and wording for approval confirmation.
- Exact visual treatment of low-confidence flags and reviewer-confirmation prompts.
- Exact normalization style rules for chapter title formatting, as long as consistency is preserved.

### Deferred Ideas (OUT OF SCOPE)

None - discussion stayed within phase scope.
</user_constraints>

## Summary

Use a deterministic-first pipeline in Convex: boilerplate strip -> structural segmentation -> reversible normalization -> AI cleanup pass with bounded scope -> reviewer confirmation/edits -> explicit approval gate. Keep immutable original text and versioned cleaned text so approval can be revoked safely after edits without losing history.

For this phase, reliability matters more than "smart" automation. Chapter boundaries should be detected with explicit heading rules (including OCR-tolerant patterns), while ambiguous breaks become reviewer tasks, not auto-committed structure. This aligns directly with the locked decision to require human confirmation for unlabeled boundaries.

For UI, use a true merge/diff editor pattern rather than custom textarea math. `@codemirror/merge` supports split view and per-pane editability; pair it with `diff` for backend/preview deltas and conflict-safe persistence. Approval must be represented as explicit state with unresolved low-confidence flags hard-blocking completion.

**Primary recommendation:** Build a two-track cleanup system: deterministic transforms for guaranteed-safe edits, AI transforms only for bounded noisy spans with confidence flags, then enforce approval checklist + unresolved-flag gate before downstream pipeline unlock.

## Standard Stack

### Core

| Library             | Version           | Purpose                                                                 | Why Standard                                                                                                        |
| ------------------- | ----------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| convex              | ^1.31.2 (project) | Durable workflow orchestration, jobs, scheduling, auth-aware data layer | Native fit for existing backend, scheduled functions and internal actions already match this phase's async pipeline |
| `@codemirror/merge` | 6.11.2            | Side-by-side merge view with configurable read-only/editable panes      | Purpose-built diff/merge UI; avoids fragile custom synchronization                                                  |
| diff (jsdiff)       | 8.0.3             | Line/word/paragraph diffing using Myers-family algorithm                | Stable, widely used textual diff package with timeout/max edit controls                                             |
| openai              | 6.21.0            | OpenAI-compatible SDK client for AI cleanup provider calls              | Battle-tested retries/timeouts/error types; easier provider swap than custom fetch glue                             |

### Supporting

| Library    | Version | Purpose                                                      | When to Use                                                   |
| ---------- | ------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| zod        | 4.3.6   | Validate structured AI output (changes + confidence + flags) | Always at AI boundary before writing cleanup results          |
| codemirror | 6.0.2   | Editor base setup used by merge view                         | Use with merge editor construction and keyboard/edit behavior |

### Alternatives Considered

| Instead of          | Could Use                                   | Tradeoff                                                                                               |
| ------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `@codemirror/merge` | Custom split panes + handcrafted diff spans | Faster initial coding, but high long-term bug risk on scroll sync, selection mapping, and large texts  |
| `diff`              | `diff-match-patch`                          | Good library too, but `diff` already covers line/word modes and patch utilities needed here            |
| openai SDK          | Raw `fetch` wrapper                         | Fewer dependencies, but you lose typed errors, retries, timeout controls, and request-ID observability |

**Installation:**

```bash
npm install @codemirror/merge codemirror diff openai zod
```

## Architecture Patterns

### Recommended Project Structure

```
convex/
├── cleanup.ts                 # public mutations/queries for phase entry + review saves
├── cleanupPipeline.ts         # internal mutations for deterministic transforms
├── cleanupAi.ts               # internal action(s) calling Kimi K2
├── cleanupChaptering.ts       # chapter detection + normalization helpers
└── cleanupFlags.ts            # unresolved-flag lifecycle + approval checks

src/components/
├── CleanupReviewPage.tsx      # side-by-side review shell
├── CleanupMergeEditor.tsx     # CodeMirror merge view wrapper
├── CleanupFlagsPanel.tsx      # unresolved low-confidence items
└── ApprovalChecklistDialog.tsx# required checklist confirmation flow
```

### Pattern 1: Mutation Captures Intent, Schedules Async Cleanup

**What:** Create/update job + cleanup state in a mutation, then schedule internal action(s) for AI or heavy work.
**When to use:** Any operation that calls external model APIs or may time out.
**Example:**

```typescript
// Source: https://docs.convex.dev/functions/actions
// Source: https://docs.convex.dev/scheduling/scheduled-functions
export const startCleanup = mutation({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    const jobId = await ctx.db.insert("jobs", {
      type: "clean",
      status: "queued",
      bookId,
      queuedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.cleanupAi.runCleanup, {
      bookId,
      jobId,
    });
    return { jobId };
  },
});
```

### Pattern 2: Immutable Source + Versioned Cleaned Text

**What:** Keep original source untouched; store each cleaned revision and approval metadata separately.
**When to use:** Always; this is required for rollback and post-approval edit handling.
**Example:**

```typescript
// Source: Convex ID/reference guidance
// https://docs.convex.dev/database/document-ids
type CleanupVersion = {
  bookId: Id<"books">;
  originalText: string; // write once
  cleanedText: string;
  revision: number;
  approval: {
    status: "unapproved" | "approved";
    approvedAt?: number;
    approvedBy?: Id<"users">;
  };
};
```

### Pattern 3: Confidence-Gated AI Edits

**What:** AI returns bounded edit proposals with confidence and span offsets; low-confidence entries create blocking reviewer flags.
**When to use:** All AI cleanup invocations.
**Example:**

```typescript
// Source: https://zod.dev/
import { z } from "zod";

const CleanupPatchSchema = z.object({
  start: z.number(),
  end: z.number(),
  replacement: z.string(),
  confidence: z.enum(["high", "low"]),
  reason: z.string(),
});

const CleanupResponseSchema = z.object({
  patches: z.array(CleanupPatchSchema),
});
```

### Pattern 4: Read-Only Original Pane + Editable Cleaned Pane

**What:** Render split merge editor with `original` read-only and cleaned pane editable.
**When to use:** Default review experience (locked requirement).
**Example:**

```typescript
// Source: https://github.com/codemirror/merge/blob/main/README.md
import { MergeView } from "@codemirror/merge";
import { EditorView } from "codemirror";
import { EditorState } from "@codemirror/state";

new MergeView({
  a: { doc: cleanedText, extensions: [] },
  b: {
    doc: originalText,
    extensions: [EditorView.editable.of(false), EditorState.readOnly.of(true)],
  },
  parent,
});
```

### Anti-Patterns to Avoid

- **Calling AI actions directly from client:** Convex docs flag this as anti-pattern; persist intent in mutation first.
- **Single mutable text field:** Breaks rollback/audit and makes approval revocation logic brittle.
- **Auto-accepting ambiguous boundaries:** Violates locked decision; must create reviewer confirmation tasks.
- **Approval as boolean only:** Needs checklist artifact + unresolved-flag check, not just `approved: true`.

## Don't Hand-Roll

| Problem                               | Don't Build                                             | Use Instead                                      | Why                                                                                 |
| ------------------------------------- | ------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Visual diff/merge UI                  | Custom split panes with manual scroll and token mapping | `@codemirror/merge`                              | Merge UIs are edge-case heavy (selection, folding, huge docs, synchronized cursors) |
| Text diff algorithm                   | Ad hoc line diff loops                                  | `diff`                                           | Myers-style minimal edit scripts and timeout/max edit controls already implemented  |
| AI API transport/retry/error taxonomy | Manual provider wrapper via raw `fetch`                 | `openai` SDK (with provider-compatible base URL) | Better retries, timeouts, request IDs, typed errors                                 |
| AI output validation                  | Regex-only parsing of model text                        | `zod` schemas                                    | Prevents malformed patches from corrupting cleaned text                             |

**Key insight:** The expensive failures in this phase are almost all edge-case failures (bad diffs, malformed AI edits, approval state drift), not "happy-path" failures. Use battle-tested primitives for those boundaries.

## Common Pitfalls

### Pitfall 1: Over-aggressive boilerplate stripping

**What goes wrong:** Legitimate front matter (preface/introduction) gets removed with header/footer patterns.
**Why it happens:** Marker matching that assumes one Gutenberg header style.
**How to avoid:** Detect canonical start/end markers first; only strip inside known license/header envelope; keep front/back matter as labeled sections.
**Warning signs:** First retained section starts mid-sentence, missing "Preface" or chapter 1 appears improbably early.

### Pitfall 2: Paragraph unwrap destroys poetry/dialogue spacing

**What goes wrong:** Intentional line breaks collapse into prose blocks.
**Why it happens:** Unwrap rule ignores line-length and punctuation continuation cues.
**How to avoid:** Balanced unwrap heuristic: unwrap only when previous line does not end terminal punctuation and next line appears continuation-like.
**Warning signs:** Sudden long paragraphs in verse blocks; repeated reviewer reversions in same section types.

### Pitfall 3: Approval state drift after edits

**What goes wrong:** Book remains approved after substantive cleaned-text changes.
**Why it happens:** Save flow doesn't compare revision against approved revision.
**How to avoid:** On save after approval, force explicit keep/revoke choice and persist decision with revision number.
**Warning signs:** ApprovedAt older than current cleaned revision; downstream pipeline unlocked with unresolved review changes.

### Pitfall 4: Large text diff performance stalls

**What goes wrong:** UI freezes or API latency spikes for long books.
**Why it happens:** Full-document word diffs on every keystroke.
**How to avoid:** Compute line/paragraph diff incrementally and debounce; use `diff` timeout/max edit constraints for server-side operations.
**Warning signs:** Input lag over 150ms, browser main-thread blocks, repeated worker timeout logs.

### Pitfall 5: Low-confidence flags not truly blocking

**What goes wrong:** Users can approve while unresolved uncertainty remains.
**Why it happens:** Gate implemented only in UI, not backend mutation.
**How to avoid:** Enforce unresolved-flag count check in approval mutation transaction.
**Warning signs:** Approval records exist with non-zero unresolved flag rows.

## Code Examples

Verified patterns from official sources:

### Schedule Action After Mutation Commit

```typescript
// Source: https://docs.convex.dev/scheduling/scheduled-functions
await ctx.scheduler.runAfter(0, internal.cleanupAi.runCleanup, {
  bookId,
  jobId,
});
```

### Build Read-Only Reference Pane in Merge View

```typescript
// Source: https://github.com/codemirror/merge/blob/main/README.md
extensions: [EditorView.editable.of(false), EditorState.readOnly.of(true)];
```

### Generate Line-Level Diff with Operational Guardrails

```typescript
// Source: https://github.com/kpdecker/jsdiff/blob/master/README.md
import { diffLines } from "diff";

const changes = diffLines(oldText, newText, {
  timeout: 300,
  maxEditLength: 20000,
});
```

### Validate AI Response Before Persisting

```typescript
// Source: https://zod.dev/
const parsed = CleanupResponseSchema.parse(modelResponse);
```

## State of the Art

| Old Approach                                 | Current Approach                          | When Changed                            | Impact                                                              |
| -------------------------------------------- | ----------------------------------------- | --------------------------------------- | ------------------------------------------------------------------- |
| Client directly invokes long-running AI work | Mutation records intent, schedules action | Current Convex guidance                 | Better consistency, recoverability, and auth-safe state transitions |
| Homegrown diff rendering in React            | Dedicated merge/diff editor components    | Matured in modern editor ecosystems     | Fewer rendering bugs and better large-text behavior                 |
| Trust model free-form text output            | Structured output + schema validation     | Standardized in modern LLM app practice | Lower corruption risk and clearer reviewer flags                    |

**Deprecated/outdated:**

- Treating approval as a one-click boolean: replaced by checklist + unresolved-flag gate + revision-aware keep/revoke prompt.

## Open Questions

1. **Kimi K2 production endpoint/model naming in this environment**
   - What we know: Requirement mandates Kimi K2; OpenAI-compatible SDK path is implementation-friendly.
   - What's unclear: Official, current Kimi K2 API endpoint/auth and exact model IDs were not conclusively retrievable from accessible docs in this session.
   - Recommendation: Resolve via provider account docs before implementation; keep AI client behind `cleanupAiClient.ts` adapter so endpoint/model can change without pipeline rewrite.

2. **Canonical chapter title normalization style details**
   - What we know: Must normalize titles consistently; exact style is discretionary.
   - What's unclear: Preferred final casing and numbering format (e.g., `Chapter 12`, `CHAPTER XII`, mixed with labels like `Book I`).
   - Recommendation: Pick one deterministic style guide (suggested: `Chapter N: Title` with arabic numbering for numeric headings, preserve named sections like `Preface`) and encode as pure function + tests.

## Sources

### Primary (HIGH confidence)

- https://docs.convex.dev/functions/actions - action patterns, anti-pattern note on client-called actions
- https://docs.convex.dev/scheduling/scheduled-functions - atomic scheduling from mutations, execution guarantees, auth caveats
- https://docs.convex.dev/file-storage - storage patterns for source/derived text files
- https://docs.convex.dev/database/document-ids - ID/reference modeling guidance
- https://github.com/kpdecker/jsdiff/blob/master/README.md - diff algorithm behavior and APIs
- https://github.com/codemirror/merge/blob/main/README.md - merge view setup and read-only pane pattern
- https://zod.dev/ - schema validation patterns
- https://raw.githubusercontent.com/openai/openai-node/master/README.md - SDK retries/timeouts/error handling and usage
- https://www.gutenberg.org/policy/license - license/header constraints and plain-vanilla text format context
- https://www.gutenberg.org/files/1342/1342-0.txt - observed canonical start marker format in Gutenberg plain text

### Secondary (MEDIUM confidence)

- https://codemirror.net/docs/ref/#merge - full merge API reference (large page, partially truncated in retrieval but consistent with README)

### Tertiary (LOW confidence)

- Kimi K2 provider endpoint specifics: not confirmed from an official accessible doc in this session; must validate before build.

## Metadata

**Confidence breakdown:**

- Standard stack: MEDIUM - Strong for Convex/diff/merge/validation; Kimi K2 endpoint details still unresolved.
- Architecture: HIGH - Directly grounded in Convex official patterns and locked user decisions.
- Pitfalls: MEDIUM - Backed by known text-processing failure modes and tool docs, but some domain-specific thresholds need calibration on real corpus.

**Research date:** 2026-02-12
**Valid until:** 2026-03-14 (30 days, unless Kimi provider docs change earlier)
