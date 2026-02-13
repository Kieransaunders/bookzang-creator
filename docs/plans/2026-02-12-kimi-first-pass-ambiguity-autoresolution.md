# Kimi First-Pass Ambiguity Auto-Resolution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let Kimi resolve ambiguity first, automatically applying confident fixes by ambiguity type, and escalate only low-confidence leftovers to reviewer flags.

**Architecture:** Add a per-ambiguity confidence policy in backend config, route AI/deterministic ambiguity outputs through a shared decision engine, and persist an auditable trail of auto-applied actions. Existing approval gating remains intact, but unresolved flags should now represent only below-threshold ambiguity. UI should show what Kimi auto-resolved so users trust the system and focus on edge cases.

**Tech Stack:** Convex (queries/mutations/actions), TypeScript, Zod, React, existing cleanup pipeline and flags system

---

### Task 1: Add test harness for cleanup decision engine

**Files:**

- Modify: `package.json`
- Create: `tsconfig.test.json`
- Create: `convex/__tests__/cleanupDecisionPolicy.test.ts`

**Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { decideAmbiguityAction } from "../cleanupDecisionPolicy";

test("punctuation auto-applies at configured threshold", () => {
  const result = decideAmbiguityAction({
    type: "ambiguous_punctuation",
    confidence: 0.86,
    thresholds: { ambiguous_punctuation: 0.8 },
  });
  assert.equal(result.action, "auto_apply");
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:cleanup-policy`
Expected: FAIL with missing module/function errors.

**Step 3: Write minimal implementation wiring for test command**

```json
{
  "scripts": {
    "test:cleanup-policy": "tsx --test convex/__tests__/cleanupDecisionPolicy.test.ts"
  }
}
```

**Step 4: Run test to verify command executes and still fails on logic**

Run: `npm run test:cleanup-policy`
Expected: FAIL at assertions/import until decision engine exists.

**Step 5: Commit**

```bash
git add package.json tsconfig.test.json convex/__tests__/cleanupDecisionPolicy.test.ts
git commit -m "test(cleanup): scaffold policy tests for ambiguity auto-resolution"
```

### Task 2: Implement per-ambiguity confidence policy model

**Files:**

- Create: `convex/cleanupDecisionPolicy.ts`
- Modify: `convex/cleanupPrompts.ts`
- Test: `convex/__tests__/cleanupDecisionPolicy.test.ts`

**Step 1: Write failing tests for per-type thresholds and fallback defaults**

```ts
test("falls back to defaults when threshold missing", () => {
  const result = decideAmbiguityAction({
    type: "low_confidence_cleanup",
    confidence: 0.9,
    thresholds: {},
  });
  assert.equal(result.action, "manual_review");
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:cleanup-policy`
Expected: FAIL with unmet expected actions.

**Step 3: Write minimal implementation**

```ts
export type AmbiguityType =
  | "ambiguous_punctuation"
  | "low_confidence_cleanup"
  | "unlabeled_boundary_candidate"
  | "ocr_corruption_detected"
  | "chapter_boundary_disputed";

export function decideAmbiguityAction(input: {
  type: AmbiguityType;
  confidence: number;
  thresholds: Partial<Record<AmbiguityType, number>>;
}) {
  // return { action: "auto_apply" | "manual_review", thresholdUsed: number }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:cleanup-policy`
Expected: PASS for threshold routing cases.

**Step 5: Commit**

```bash
git add convex/cleanupDecisionPolicy.ts convex/cleanupPrompts.ts convex/__tests__/cleanupDecisionPolicy.test.ts
git commit -m "feat(cleanup): add per-ambiguity confidence decision policy"
```

### Task 3: Extend AI patch schema to support numeric confidence

**Files:**

- Modify: `convex/cleanupPrompts.ts`
- Modify: `convex/cleanupAiClient.ts`
- Test: `convex/__tests__/cleanupDecisionPolicy.test.ts`

**Step 1: Write failing tests for confidence normalization**

```ts
test("normalizes high/low labels to numeric confidence", () => {
  // "high" -> 0.9, "low" -> 0.55 (initial mapping)
});
```

**Step 2: Run tests to verify failure**

Run: `npm run test:cleanup-policy`
Expected: FAIL until normalization helper exists.

**Step 3: Implement minimal schema + normalization helper**

```ts
// Add optional numeric confidenceScore: z.number().min(0).max(1).optional()
// Derive effectiveConfidence for policy decisions.
```

**Step 4: Run tests to verify pass**

Run: `npm run test:cleanup-policy`
Expected: PASS for normalization mappings.

**Step 5: Commit**

```bash
git add convex/cleanupPrompts.ts convex/cleanupAiClient.ts convex/__tests__/cleanupDecisionPolicy.test.ts
git commit -m "feat(cleanup): normalize ai confidence for threshold policy"
```

### Task 4: Persist auto-resolution audit trail in schema

**Files:**

- Modify: `convex/schema.ts`
- Create: `convex/cleanupAutoResolutions.ts`

**Step 1: Write failing test for audit record shape**

```ts
test("audit record stores before/after, confidence, rationale", () => {
  // validate helper payload shape for insertAutoResolution
});
```

**Step 2: Run tests to verify failure**

Run: `npm run test:cleanup-policy`
Expected: FAIL due to missing audit helper/schema fields.

**Step 3: Implement minimal schema + mutation**

```ts
cleanupAutoResolutions: defineTable({
  bookId: v.id("books"),
  revisionId: v.id("cleanupRevisions"),
  flagType: v.string(),
  startOffset: v.number(),
  endOffset: v.number(),
  beforeText: v.string(),
  afterText: v.string(),
  confidence: v.number(),
  thresholdUsed: v.number(),
  rationale: v.string(),
  createdAt: v.number(),
});
```

**Step 4: Run tests + Convex validation**

Run: `npm run test:cleanup-policy && npm run dev:backend -- --once`
Expected: PASS and schema accepted by Convex.

**Step 5: Commit**

```bash
git add convex/schema.ts convex/cleanupAutoResolutions.ts convex/__tests__/cleanupDecisionPolicy.test.ts
git commit -m "feat(cleanup): add auditable auto-resolution records"
```

### Task 5: Route deterministic ambiguity through policy engine

**Files:**

- Modify: `convex/cleanupPipeline.ts`
- Modify: `convex/cleanupFlags.ts`
- Modify: `convex/cleanup.ts`

**Step 1: Write failing tests for policy-driven flag suppression**

```ts
test("does not create flag when deterministic ambiguity is above threshold", () => {
  // expect auto-resolution record instead of unresolved flag
});
```

**Step 2: Run tests and verify failure**

Run: `npm run test:cleanup-policy`
Expected: FAIL because current implementation always inserts unresolved flags.

**Step 3: Implement minimal policy integration**

```ts
// In batchCreateFlagsFromResults:
// - evaluate each candidate with decideAmbiguityAction
// - insert cleanupFlag only for manual_review
// - insert cleanupAutoResolutions for auto_apply
```

**Step 4: Run tests and typecheck**

Run: `npm run test:cleanup-policy && npm run lint`
Expected: PASS with no TypeScript errors.

**Step 5: Commit**

```bash
git add convex/cleanupPipeline.ts convex/cleanupFlags.ts convex/cleanup.ts convex/__tests__/cleanupDecisionPolicy.test.ts
git commit -m "feat(cleanup): apply confidence policy to deterministic ambiguity routing"
```

### Task 6: Route Kimi ambiguity patches through same policy

**Files:**

- Modify: `convex/cleanupAiClient.ts`
- Modify: `convex/cleanup.ts`
- Modify: `convex/cleanupFlags.ts`

**Step 1: Write failing tests for AI patch routing**

```ts
test("ai high-confidence ambiguity auto-applies and logs", () => {
  // assert action path = auto_apply with audit insert
});
```

**Step 2: Run tests to verify failure**

Run: `npm run test:cleanup-policy`
Expected: FAIL before AI path integrates policy calls.

**Step 3: Implement minimal shared decision path**

```ts
// Convert each AI patch to policy decision input
// apply patch if auto_apply
// create unresolved flag if manual_review
// write audit record for auto_apply
```

**Step 4: Run tests/typecheck/build**

Run: `npm run test:cleanup-policy && npm run lint`
Expected: PASS.

**Step 5: Commit**

```bash
git add convex/cleanupAiClient.ts convex/cleanup.ts convex/cleanupFlags.ts convex/__tests__/cleanupDecisionPolicy.test.ts
git commit -m "feat(cleanup): apply confidence policy to kimi ambiguity handling"
```

### Task 7: Expose policy and auto-resolution summary to review UI

**Files:**

- Modify: `convex/cleanup.ts`
- Modify: `src/components/CleanupReviewPage.tsx`
- Modify: `src/components/CleanupFlagsPanel.tsx`

**Step 1: Write failing UI contract test (or shape assertion test)**

```ts
test("review data includes autoResolved counts by type", () => {
  // expect getReviewData payload to include autoResolvedSummary
});
```

**Step 2: Run tests to verify failure**

Run: `npm run test:cleanup-policy`
Expected: FAIL because payload currently omits auto-resolution summary.

**Step 3: Implement minimal UI + query updates**

```ts
// getReviewData returns autoResolvedSummary
// CleanupFlagsPanel displays "Kimi auto-resolved N items" with by-type breakdown
```

**Step 4: Run verification**

Run: `npm run lint`
Expected: PASS + frontend compiles.

**Step 5: Commit**

```bash
git add convex/cleanup.ts src/components/CleanupReviewPage.tsx src/components/CleanupFlagsPanel.tsx
git commit -m "feat(review): surface kimi auto-resolved ambiguity summary"
```

### Task 8: Add runtime-configurable per-type thresholds

**Files:**

- Create: `convex/cleanupPolicy.ts`
- Modify: `convex/schema.ts`
- Modify: `convex/cleanup.ts`

**Step 1: Write failing tests for default + override behavior**

```ts
test("policy query returns defaults when no override exists", () => {
  // expect known per-type defaults
});
```

**Step 2: Run tests to verify failure**

Run: `npm run test:cleanup-policy`
Expected: FAIL until policy storage/query exists.

**Step 3: Implement minimal policy storage/query**

```ts
cleanupPolicies: defineTable({
  scope: v.literal("global"),
  thresholds: v.object({
    ambiguous_punctuation: v.number(),
    low_confidence_cleanup: v.number(),
    unlabeled_boundary_candidate: v.number(),
    ocr_corruption_detected: v.number(),
    chapter_boundary_disputed: v.number(),
  }),
  updatedAt: v.number(),
});
```

**Step 4: Run verification**

Run: `npm run test:cleanup-policy && npm run dev:backend -- --once`
Expected: PASS with schema/function validation.

**Step 5: Commit**

```bash
git add convex/cleanupPolicy.ts convex/schema.ts convex/cleanup.ts convex/__tests__/cleanupDecisionPolicy.test.ts
git commit -m "feat(cleanup): add configurable per-ambiguity thresholds"
```

### Task 9: End-to-end verification for “Kimi first, user second” flow

**Files:**

- Modify: `Project docs/ideas.md` (or create execution notes)
- Optional Create: `docs/plans/2026-02-12-kimi-first-pass-ambiguity-autoresolution-verification.md`

**Step 1: Write failing verification checklist**

```md
- Start cleanup on a known noisy Gutenberg title
- Confirm high-confidence ambiguity does not appear in unresolved flags
- Confirm below-threshold ambiguity appears in unresolved flags
- Confirm auto-resolution records exist and are reviewable
```

**Step 2: Run flow and capture evidence**

Run: `npm run dev`
Expected: Can reproduce and verify behavior in Cleanup Review UI.

**Step 3: Run full repo checks**

Run: `npm run lint`
Expected: PASS.

**Step 4: Document outcomes + edge cases**

```md
Include thresholds used, unresolved flag delta before/after, and rollback notes.
```

**Step 5: Commit**

```bash
git add docs/plans/2026-02-12-kimi-first-pass-ambiguity-autoresolution-verification.md Project\ docs/ideas.md
git commit -m "docs(cleanup): verify kimi-first ambiguity auto-resolution behavior"
```

## Phase 2 hard exit note (stability gate)

Phase 2 is only considered complete when all four gates below are met and documented in a single evidence block.

### Gate criteria

- `Policy correctness`: Per-ambiguity threshold routing is active in both deterministic and Kimi ambiguity paths.
- `Stability`: No regression in unresolved-flag generation for below-threshold ambiguity; no silent drops in review payload.
- `Auditability`: Every auto-applied ambiguity writes an auditable record (`beforeText`, `afterText`, `confidence`, `thresholdUsed`, `rationale`, `createdAt`).
- `Operational readiness`: `npm run test:cleanup-policy` and `npm run lint` pass on the same commit.

### Required evidence block (must be filled at exit)

- Commit SHA for Phase 2 exit candidate.
- Test evidence: command + pass output for `npm run test:cleanup-policy`.
- Repo health evidence: command + pass output for `npm run lint`.
- Behavior evidence from one representative title:
  - count of auto-resolved ambiguities by type,
  - count of unresolved flags by type (below threshold),
  - at least one stored audit record excerpt.
- Risk callout: known limitations intentionally deferred to Phase 3.

If any gate fails or evidence is missing, Phase 2 remains `in_progress` and hardening continues.

## Default threshold recommendation (per your choice: per-ambiguity)

- `ambiguous_punctuation`: `0.80`
- `low_confidence_cleanup`: `0.92`
- `unlabeled_boundary_candidate`: `0.97`
- `ocr_corruption_detected`: `0.95`
- `chapter_boundary_disputed`: `0.98`

Rationale: punctuation can be safely automated earlier; structural boundaries stay conservative so user/editor still controls book structure.
