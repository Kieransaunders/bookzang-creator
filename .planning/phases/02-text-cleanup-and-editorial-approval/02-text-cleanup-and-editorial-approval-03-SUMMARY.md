# Plan 02-03 Summary: Side-by-Side Editorial Review UI

**Status:** COMPLETED  
**Executed:** 2026-02-12  
**Commits:** 2

---

## Commits

### Commit 1: Task 1 - CodeMirror Merge Editor
```
feat(02-03): Task 1 - Install CodeMirror merge deps and build side-by-side merge editor
```

**Hash:** `7006973`

**Changes:**
- Installed `@codemirror/merge`, `codemirror`, `diff`, `@types/diff`
- Created `CleanupMergeEditor.tsx` component
  - Side-by-side panes with original (read-only) and cleaned (editable)
  - Line/paragraph-level diff highlighting by default
  - Debounced change handling for performance on large documents
  - BookZang dark theme matching liquid glass aesthetic

---

### Commit 2: Tasks 2 & 3 - Review Page, Flags Panel, Navigation
```
feat(02-03): Tasks 2 & 3 - Review page, flags panel, and navigation wiring
```

**Hash:** `3f164a8`

**Changes:**

**Backend (`convex/cleanup.ts`):**
- Added `saveCleanedRevision` mutation for persisting editor changes
  - Creates new revision with incremented number
  - Records user as creator (createdBy: "user")
  - Inherits properties from parent revision

**Frontend Components:**
- `CleanupReviewPage.tsx` - Main review shell
  - Loads review data via `getReviewData` query
  - Side-by-side merge editor integration
  - Save functionality with error handling
  - Chapters sidebar tab
  - Flags sidebar tab with unresolved count
  - Approval status indicator

- `CleanupFlagsPanel.tsx` - Flag resolution panel
  - Displays unresolved flags by type with icons
  - Resolution actions: Accept, Reject, Override
  - Boundary promotion to chapter/body section
  - Reviewer note support
  - Real-time resolution feedback

- `Dashboard.tsx` updates
  - Added "cleanup-review" page mode
  - Review entry/exit navigation handlers

- `LibraryPage.tsx` updates  
  - "Review Cleanup" button for books with "cleaned" status
  - Entry point to review workflow

**Dependencies:**
- Added `@codemirror/theme-one-dark` for editor theming

---

## Artifacts Delivered

| File | Purpose |
|------|---------|
| `src/components/CleanupMergeEditor.tsx` | CodeMirror merge wrapper with read-only original pane and editable cleaned pane |
| `src/components/CleanupReviewPage.tsx` | Review shell that loads review payload, saves edits, houses diff/flags UI |
| `src/components/CleanupFlagsPanel.tsx` | Unresolved flag list with resolve actions for reviewer-confirmation workflow |
| `convex/cleanup.ts` | Added `saveCleanedRevision` mutation |
| `src/components/Dashboard.tsx` | Updated with cleanup-review routing |
| `src/components/LibraryPage.tsx` | Updated with review entry points |

---

## Locked Requirements Satisfied

From `02-03-PLAN.md` must-haves:

- ✅ **REVIEW-01:** Side-by-side panes - Original left (read-only), Cleaned right (editable)
- ✅ **REVIEW-02:** Default diff granularity is line/paragraph-level highlighting
- ✅ Manual edits become part of cleaned text directly (no separate marker system)
- ✅ Reviewer can inspect and resolve flags from same review workflow

---

## Verification

Build verification passed:
```bash
npm run lint  # TypeScript + Convex + Vite build all pass
```

---

## Key Implementation Decisions

1. **Debounced saves:** 300ms debounce on editor changes to prevent excessive revision creation during active typing

2. **Flag resolution optimism:** Flags are marked as resolved locally before server confirmation for responsive UI, with fallback on error

3. **Approval gating preparation:** `canApprove` computed in getReviewData based on unresolved flag count, ready for approval workflow in 02-04

4. **Chapter boundary promotion:** Dedicated UI flow for converting unlabeled boundary flags to actual chapters with title input

---

## API Contracts Used

| From | To | Via |
|------|-----|-----|
| `CleanupReviewPage.tsx` | `api.cleanup.getReviewData` | `useQuery` subscription |
| `CleanupMergeEditor.tsx` | `@codemirror/merge` | `MergeView` instantiation |
| `CleanupFlagsPanel.tsx` | `api.cleanup.resolveFlag` | `useMutation` action |
| `CleanupFlagsPanel.tsx` | `api.cleanup.promoteBoundaryToChapter` | `useMutation` action |
| `CleanupReviewPage.tsx` | `api.cleanup.saveCleanedRevision` | `useMutation` action |

---

## Next Steps (for Plan 02-04)

The review UI is ready for the approval gating layer:
- Approve button (blocked when flags unresolved)
- Checklist confirmation dialog
- Post-approval edit detection with keep/revoke prompt
- Book status transition to "ready" on approval
