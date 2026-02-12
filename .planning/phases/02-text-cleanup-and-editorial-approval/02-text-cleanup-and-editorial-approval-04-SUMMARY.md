# Phase 02 Plan 04: Approval Gating and Downstream Unlock - Summary

**Completed:** 2026-02-12
**Status:** ✅ Complete

## Overview

Implemented approval gating and downstream unlock behavior per CLEAN-03 and REVIEW-03 requirements. This plan ensures only reviewer-approved cleaned text can progress to template/export workflows, with backend enforcement and per-title approval state management.

## Tasks Completed

### Task 1: Backend Approval Mutations with Hard Gate
**Commit:** `bd48e0c`

- Added `getApprovalState` query with revision-aware approval validity checking
- Updated `saveCleanedRevision` mutation with `keepApproval` parameter for post-approval edit handling
- Added `getDownstreamReadiness` and `listReadyBooks` queries to books.ts for per-title unlock state
- Backend enforces unresolved-flag gate in `approveRevision` mutation (returns error if flags exist)
- Approval records include checklist confirmation and revision metadata

**Files Modified:**
- `convex/cleanup.ts` - Added getApprovalState query, enhanced saveCleanedRevision
- `convex/books.ts` - Added getDownstreamReadiness, listReadyBooks queries

### Task 2: Checklist Confirmation Dialog and Approval Controls
**Commit:** `53adc3a`

- Created `ApprovalChecklistDialog` component with 4 required checkboxes:
  - Boilerplate Removed
  - Chapter Boundaries Verified
  - Punctuation Reviewed
  - Archaic Language Preserved
- Integrated approval flow into `CleanupReviewPage`:
  - Approval button in header (disabled when blocked)
  - Status indicators showing approval state
  - Post-approval edit prompt with keep/revoke choices
- Added modal dialog for post-approval edits allowing reviewer to:
  - Keep approval (minor fixes, export remains unlocked)
  - Revoke approval (substantive changes, requires re-approval)

**Files Created/Modified:**
- `src/components/ApprovalChecklistDialog.tsx` - New checklist dialog component
- `src/components/CleanupReviewPage.tsx` - Integrated approval flow and prompts

### Task 3: Downstream UI Unlock Behavior
**Commit:** `46f02a2`

- Updated `TemplatesPage` with approval-based lock/unlock:
  - Shows ready books selector for approved titles
  - Locks template cards when no books are approved
  - Clear messaging on why actions are blocked
- Added collapsible "Why are my books locked?" section with 3-step workflow:
  1. Import and Cleanup
  2. Review and Resolve
  3. Approve

**Files Modified:**
- `src/components/TemplatesPage.tsx` - Added readiness status, book selection, lock states

## Key Implementation Details

### Approval State Model

```typescript
// Approval validity is revision-aware
approvalValid = latestApproval.revisionId === latestRevision._id

// Post-approval edits require explicit choice
if (hasActiveApproval && keepApproval === undefined) {
  // Prompt reviewer for keep/revoke decision
}
```

### Backend Enforcement

The `approveRevision` mutation enforces the hard gate:

```typescript
// CRITICAL: Check for unresolved flags - this is the approval gate
const unresolvedFlags = await ctx.db
  .query("cleanupFlags")
  .withIndex("by_book_status", q => 
    q.eq("bookId", args.bookId).eq("status", "unresolved"))
  .collect();

if (unresolvedFlags.length > 0) {
  return {
    success: false,
    error: `Cannot approve: ${unresolvedFlags.length} unresolved flag(s) require review.`
  };
}
```

### Checklist Confirmation

Approval requires explicit confirmation of all 4 quality items:
- ✅ Boilerplate Removed
- ✅ Chapter Boundaries Verified  
- ✅ Punctuation Reviewed
- ✅ Archaic Language Preserved

No one-click approve path exists; all items must be checked.

## Verification

All lint checks pass:
```bash
npm run lint
# TypeScript compilation: ✓
# Convex deployment: ✓
# Vite build: ✓
```

## Compliance with Requirements

| Requirement | Implementation |
|-------------|----------------|
| Approval blocked by unresolved flags | ✅ Backend hard gate in approveRevision mutation |
| Checklist confirmation required | ✅ 4-item checklist dialog, no one-click path |
| Post-approval edit handling | ✅ Keep/revoke prompt on save after approval |
| Downstream unlock per-title | ✅ listReadyBooks query, TemplatesPage book selection |
| Clear blocking messaging | ✅ Status indicators, "Why locked" section |

## Next Steps

Phase 02 (Text Cleanup and Editorial Approval) is now complete. Phase 03 (PDF Generation and KDP Export) can begin.

---
*Phase 02-04 completed as part of the BookZang text cleanup pipeline.*
