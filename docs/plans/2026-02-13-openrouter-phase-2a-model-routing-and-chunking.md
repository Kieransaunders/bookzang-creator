# OpenRouter Phase 2A Model Routing and Chunking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a safe, observable OpenRouter path that supports model override, automatic fallback to `deepseek/deepseek-v3.2`, user-visible model telemetry, and strict chunked processing for long books.

**Architecture:** Keep ambiguity policy behavior unchanged in this phase and focus only on transport reliability and context safety. All AI cleanup calls go through one OpenRouter client path with deterministic model selection (`user override` -> `default` -> `deepseek/deepseek-v3.2`). Long text is processed in bounded chunks with overlap, and each cleanup run stores requested/resolved model plus chunk stats for UI visibility and audits.

**Tech Stack:** Convex actions/mutations/queries, TypeScript, Zod, React UI, OpenRouter Chat Completions API

---

### Task 1: Add failing tests for model fallback and chunk planner

**Files:**

- Modify: `package.json`
- Create: `convex/__tests__/openrouterRouting.test.ts`
- Create: `convex/__tests__/chunkPlanner.test.ts`

**Step 1: Write the failing tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { resolveModelWithFallback } from "../cleanupAiClient";

test("falls back to deepseek/deepseek-v3.2 on model failure", async () => {
  const result = await resolveModelWithFallback({
    requestedModel: "openrouter/free",
    simulatePrimaryFailure: true,
  });
  assert.equal(result.resolvedModel, "deepseek/deepseek-v3.2");
  assert.equal(result.fallbackUsed, true);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:cleanup-policy`
Expected: FAIL with missing helper/module errors.

**Step 3: Add test command wiring if missing**

```json
{
  "scripts": {
    "test:cleanup-policy": "tsx --test convex/__tests__/*.test.ts"
  }
}
```

**Step 4: Run tests to verify command executes and still fails on logic**

Run: `npm run test:cleanup-policy`
Expected: FAIL on fallback/chunk assertions.

**Step 5: Commit**

```bash
git add package.json convex/__tests__/openrouterRouting.test.ts convex/__tests__/chunkPlanner.test.ts
git commit -m "test(cleanup): add fallback and chunk planner failing tests"
```

### Task 2: Implement OpenRouter model resolution with fallback chain

**Files:**

- Modify: `convex/cleanupAiClient.ts`
- Modify: `convex/cleanup.ts`
- Test: `convex/__tests__/openrouterRouting.test.ts`

**Step 1: Write failing tests for explicit model priority**

```ts
test("uses user-selected model when valid", async () => {
  // expect requestedModel to be used before defaults
});

test("uses deepseek/deepseek-v3.2 when primary model fails", async () => {
  // expect fallback and telemetry flags
});
```

**Step 2: Run tests to verify failure**

Run: `npm run test:cleanup-policy`
Expected: FAIL until fallback logic is implemented.

**Step 3: Write minimal implementation**

```ts
type ModelResolution = {
  requestedModel: string;
  resolvedModel: string;
  fallbackUsed: boolean;
};

const FALLBACK_MODEL = "deepseek/deepseek-v3.2";

// Resolve order:
// 1) user-provided model input
// 2) configured default model
// 3) FALLBACK_MODEL
```

**Step 4: Run tests to verify pass**

Run: `npm run test:cleanup-policy`
Expected: PASS for model selection/fallback cases.

**Step 5: Commit**

```bash
git add convex/cleanupAiClient.ts convex/cleanup.ts convex/__tests__/openrouterRouting.test.ts
git commit -m "feat(cleanup): add openrouter model resolution and deepseek fallback"
```

### Task 3: Implement bounded chunk planner for long-book cleanup

**Files:**

- Create: `convex/chunkPlanner.ts`
- Modify: `convex/cleanupAiClient.ts`
- Test: `convex/__tests__/chunkPlanner.test.ts`

**Step 1: Write failing tests for chunk boundaries and overlap**

```ts
test("splits long text into bounded chunks", () => {
  // assert each chunk size <= maxChunkChars
});

test("applies overlap between adjacent chunks", () => {
  // assert overlapChars continuity
});
```

**Step 2: Run tests to verify failure**

Run: `npm run test:cleanup-policy`
Expected: FAIL until planner exists.

**Step 3: Write minimal implementation**

```ts
export function planChunks(input: {
  text: string;
  maxChunkChars: number;
  overlapChars: number;
}): Array<{ index: number; start: number; end: number; text: string }> {
  // deterministic bounded windows with overlap
}
```

**Step 4: Run tests to verify pass**

Run: `npm run test:cleanup-policy`
Expected: PASS for chunk size and overlap rules.

**Step 5: Commit**

```bash
git add convex/chunkPlanner.ts convex/cleanupAiClient.ts convex/__tests__/chunkPlanner.test.ts
git commit -m "feat(cleanup): add bounded chunk planner for openrouter requests"
```

### Task 4: Persist model telemetry and chunk stats per cleanup run

**Files:**

- Modify: `convex/schema.ts`
- Modify: `convex/cleanup.ts`
- Modify: `convex/cleanupAiClient.ts`

**Step 1: Write failing test for run metadata shape**

```ts
test("stores requested/resolved model and chunk stats", () => {
  // expect requestedModel, resolvedModel, fallbackUsed, chunkCount, maxChunkChars
});
```

**Step 2: Run tests to verify failure**

Run: `npm run test:cleanup-policy`
Expected: FAIL due to missing schema fields.

**Step 3: Write minimal implementation**

```ts
// Add cleanup run metadata fields (on cleanupRevisions or cleanupRuns table):
// requestedModel: v.string()
// resolvedModel: v.string()
// fallbackUsed: v.boolean()
// chunkCount: v.number()
// maxChunkChars: v.number()
```

**Step 4: Run tests and Convex validation**

Run: `npm run test:cleanup-policy && npm run dev:backend -- --once`
Expected: PASS and schema validation succeeds.

**Step 5: Commit**

```bash
git add convex/schema.ts convex/cleanup.ts convex/cleanupAiClient.ts convex/__tests__/openrouterRouting.test.ts
git commit -m "feat(cleanup): persist model telemetry and chunk stats"
```

### Task 5: Add UI model override input and active-model alert

**Files:**

- Modify: `src/components/CleanupReviewPage.tsx`
- Modify: `src/components/CleanupFlagsPanel.tsx`
- Create: `src/components/CleanupModelOverrideInput.tsx`
- Modify: `convex/cleanup.ts`

**Step 1: Write failing UI contract test (or payload shape test)**

```ts
test("review payload exposes model telemetry for display", () => {
  // getReviewData includes requestedModel/resolvedModel/fallbackUsed
});
```

**Step 2: Run tests to verify failure**

Run: `npm run test:cleanup-policy`
Expected: FAIL until payload and UI wiring exist.

**Step 3: Write minimal implementation**

```ts
// Add optional text input for model override:
// - validate non-empty, max length, safe charset
// - helper text: "Advanced: OpenRouter model id"
// Display run banner:
// - "Model used: <resolvedModel>"
// - "Fallback activated" when fallbackUsed=true
```

**Step 4: Run verification**

Run: `npm run lint`
Expected: PASS with frontend compile success.

**Step 5: Commit**

```bash
git add src/components/CleanupReviewPage.tsx src/components/CleanupFlagsPanel.tsx src/components/CleanupModelOverrideInput.tsx convex/cleanup.ts
git commit -m "feat(review): add model override input and active-model alert"
```

### Task 6: Verify Phase 2A behavior with `openrouter/free` test model

**Files:**

- Create: `docs/plans/2026-02-13-openrouter-phase-2a-verification.md`

**Step 1: Write failing verification checklist**

```md
- Run cleanup with explicit model override (valid id)
- Simulate primary model failure and verify deepseek fallback
- Verify UI displays resolved model and fallback state
- Verify long input is chunked (record chunkCount and maxChunkChars)
```

**Step 2: Run test suite with test model**

Run: `OPENROUTER_MODEL=openrouter/free npm run test:cleanup-policy`
Expected: PASS.

**Step 3: Run repo checks**

Run: `npm run lint`
Expected: PASS.

**Step 4: Document evidence**

```md
Record:

- requestedModel/resolvedModel/fallbackUsed
- chunkCount/maxChunkChars
- one representative cleanup run id
```

**Step 5: Commit**

```bash
git add docs/plans/2026-02-13-openrouter-phase-2a-verification.md
git commit -m "docs(cleanup): verify phase 2a openrouter model routing and chunk safety"
```

## Phase 2A hard exit criteria

- `Fallback correctness`: Failed primary model retries through `deepseek/deepseek-v3.2`.
- `Model visibility`: Review UI shows resolved model and fallback status.
- `Context safety`: Requests are chunked; no full-book OpenRouter payloads.
- `Operational readiness`: `OPENROUTER_MODEL=openrouter/free npm run test:cleanup-policy` and `npm run lint` pass on same commit.

## Default runtime parameters

- `fallbackModel`: `deepseek/deepseek-v3.2`
- `testModel`: `openrouter/free`
- `maxChunkChars`: `12000` (initial)
- `overlapChars`: `800` (initial)

Rationale: conservative chunking protects context limits while preserving boundary continuity.
