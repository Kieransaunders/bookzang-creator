# Plan 02-02 Summary: AI-Assisted Cleanup Adapter

## Execution Metadata

| Field | Value |
|-------|-------|
| **Plan ID** | 02-02 |
| **Phase** | 02-text-cleanup-and-editorial-approval |
| **Execution Date** | 2026-02-12 |
| **Status** | ✅ Completed |
| **Commits** | 3 |

## Changes Made

### Task 1: Install and scaffold AI cleanup adapter dependencies

**Commit:** `d3fe054`

- Added `openai` and `zod` dependencies for Kimi K2 integration
- Created `convex/cleanupAiClient.ts` with provider-adapter boundary
  - Environment-driven configuration (KIMI_API_KEY, KIMI_BASE_URL, KIMI_MODEL)
  - OpenAI-compatible SDK with Kimi K2 endpoint support
  - Structured response validation with Zod schemas
  - Mock client fallback for development without API key
- Created `convex/cleanupPrompts.ts` with:
  - Zod schemas for structured AI output (CleanupPatchSchema, CleanupResponseSchema)
  - Preservation-first system prompt enforcing locked decisions
  - Segment prompt builder for chunked processing
  - Response validation helpers

### Task 2: Implement structured AI patch generation and safe patch application

**Commit:** `0d0f275`

- Created `convex/cleanupAi.ts` - Internal action pipeline:
  - `runCleanupAiPass`: Main AI cleanup orchestration
  - Text segmentation for large books (8KB chunks with 200 char overlap)
  - Rate-limited API calls (500ms delay between segments)
  - Patch offset adjustment for full document coordinates
  - Error recovery - continues processing if one segment fails
  
- Created `convex/cleanupPatchApply.ts` - Safe patch application:
  - `applyPatchesAndCreateRevision`: Core safe-apply function
  - Patches applied in reverse order to preserve offsets
  - Text verification before/after each patch
  - Automatic revision incrementing with parent-child tracking
  - Chapter record copying for new revisions
  - `createManualRevision`: User-initiated revision creation
  - `rollbackToRevision`: Revert to previous revision
  - Patch validation utilities

### Task 3: Persist and expose low-confidence flags as approval blockers

**Commit:** `6aab5e0`

- Extended schema with `cleanupApprovals` table:
  - Tracks approved revision with checklist confirmation
  - Stores who approved and when
  - Required checklist: boilerplate, chapters, punctuation, archaic

- Added approval gating to `convex/cleanup.ts`:
  - `canApprove`: Query checks unresolved flags before approval
  - `approveRevision`: Mutation with hard flag check
  - `revokeApproval`: Handle post-approval edits

- Extended `convex/cleanupFlags.ts` with public queries:
  - `listReviewFlags`: List flags with status filter
  - `getUnresolvedFlagCount`: Count flags by type for gating

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  cleanupAi.ts   │────▶│ cleanupAiClient  │────▶│   Kimi K2 API   │
│   (orchestrate) │     │  (adapter layer) │     │  (AI provider)  │
└────────┬────────┘     └──────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│ cleanupPatchApply│────▶│ cleanupRevisions │
│  (safe apply)   │     │ (version storage)│
└────────┬────────┘     └──────────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│ cleanupFlags.ts │────▶│  canApprove?     │
│ (low-confidence)│     │ (approval gate)  │
└─────────────────┘     └──────────────────┘
```

## Files Created/Modified

| File | Type | Purpose |
|------|------|---------|
| `convex/cleanupAiClient.ts` | Created | Kimi K2 provider adapter boundary |
| `convex/cleanupPrompts.ts` | Created | Schemas, prompts, validation |
| `convex/cleanupAi.ts` | Created | AI cleanup pass orchestration |
| `convex/cleanupPatchApply.ts` | Created | Safe patch application |
| `convex/cleanup.ts` | Modified | Added approval mutations/queries |
| `convex/cleanupFlags.ts` | Modified | Added public flag queries |
| `convex/schema.ts` | Modified | Added cleanupApprovals table |
| `package.json` | Modified | Added openai, zod dependencies |

## Verification

All TypeScript compilation passes:
```bash
npm run lint  # ✅ Success
```

## Environment Configuration

Required environment variables for Kimi K2 integration:
```bash
KIMI_API_KEY=<your-kimi-api-key>
KIMI_BASE_URL=https://api.moonshot.cn/v1
KIMI_MODEL=kimi-k2-0710-preview
```

If not configured, the system falls back to mock mode (no AI processing).

## Key Decisions Enforced

1. **Immutable Originals**: Original text never changes; AI creates new revisions
2. **Versioned Revisions**: Each AI pass increments revision number with parent tracking
3. **Preservation-First**: AI prompt strictly forbids modernizing archaic language
4. **Confidence Gating**: Low-confidence AI patches create unresolved flags
5. **Approval Blocking**: Cannot approve while unresolved flags exist
6. **Checklist Required**: Approval requires explicit confirmation of 4 items

## Next Steps

Plan 02-03 (Review UI with CodeMirror merge editor) can now build on this foundation:
- AI-generated revisions are available for review
- Low-confidence flags are queryable for display
- Approval gating is enforced at the API level
