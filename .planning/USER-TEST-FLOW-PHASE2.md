# Phase 2 User Test Flow

> End-to-end testing guide for Text Cleanup and Editorial Approval features

## Prerequisites

- [ ] BookZang dev server running (`npm run dev`)
- [ ] At least one Gutenberg `.txt` file available for import
- [ ] (Optional) `KIMI_API_KEY` set in Convex environment for AI cleanup testing

---

## Test Flow A: Import → Deterministic Cleanup → Review

### Step 1: Import a Book

1. Open BookZang dashboard at `http://localhost:5173`
2. Click **"Import Book"** button
3. Select **"Upload File"** tab
4. Choose a Gutenberg `.txt` file (or drag-drop)
5. Verify metadata extraction shows:
   - Title detected from Gutenberg header
   - Author detected
   - Source format: "upload"
6. Click **"Import"**

**Expected:** Book appears in Library with "imported" status

---

### Step 2: Start Cleanup

1. In Library, find the imported book
2. Click **"Start Cleanup"** button (or use action menu)
3. Observe cleanup job status:
   - Stage progresses: queued → loading_original → boilerplate_removal → chapter_detection → completed
   - Progress bar updates

**Expected:** Book status changes to "cleaned" when complete

**Backend verification:**
```bash
npx convex run cleanup:getReviewData '{"bookId":"<book-id>"}'
```
Should return: original content, cleaned revision, chapters array, flags array

---

### Step 3: Open Review Page

1. Click **"Review"** button on the cleaned book
2. Observe the side-by-side editor:
   - **Left pane (Original):** Read-only, shows source text
   - **Right pane (Cleaned):** Editable, shows cleaned text
   - **Diff highlighting:** Shows changes between versions

**Verify locked decisions:**
- [ ] Original pane cannot be edited
- [ ] Cleaned pane accepts edits
- [ ] Diff highlights at paragraph/line level

---

### Step 4: Edit Cleaned Text

1. Click in the **cleaned pane** (right side)
2. Make an edit (fix a typo, adjust punctuation)
3. Click **"Save"** button
4. Refresh the page

**Expected:** Your edit persists in the cleaned revision

**Backend verification:**
```bash
npx convex run cleanup:getReviewData '{"bookId":"<book-id>"}'
```
Should show new revision with `revisionNumber: 2`

---

### Step 5: Resolve Flags (if any)

If flags exist in the **Flags Panel** (right side of review page):

1. Review each flag:
   - **Type:** unlabeled_boundary, low_confidence_cleanup, ocr_corruption, ambiguous_punctuation
   - **Context:** Shows surrounding text
   - **Suggested action:** System recommendation

2. For **unlabeled boundary** flags:
   - Click **"Promote to Chapter"** → Enter title → Select type
   - OR click **"Keep as Section"** to dismiss

3. For **low-confidence cleanup** flags:
   - Click **"Accept"** to keep AI suggestion
   - Click **"Reject"** to revert to original
   - Click **"Override"** to keep your manual edit

4. Verify unresolved count updates after each resolution

---

## Test Flow B: AI Cleanup (if KIMI_API_KEY configured)

### Step 1: Run AI Cleanup

1. From Library, click **"AI Cleanup"** on a cleaned book
2. Observe processing:
   - Text chunked into segments
   - Progress updates
   - Patches applied

**Expected:** New revision created with AI improvements

### Step 2: Review AI Changes

1. Open Review page
2. Observe diff showing AI changes
3. Check Flags Panel for low-confidence items

### Step 3: Verify Flag Blocking

**Test the hard gate:**

1. Leave at least one flag **unresolved**
2. Click **"Approve"** button
3. Observe checklist dialog opens
4. Try to submit

**Expected:** Error message — "Cannot approve with unresolved flags"

---

## Test Flow C: Approval → Downstream Unlock

### Step 1: Resolve All Flags

1. In Review page, resolve all unresolved flags
2. Verify **Flags Panel** shows: "No unresolved flags"
3. Verify **Approval button** is now active

---

### Step 2: Checklist Approval

1. Click **"Approve"** button
2. **Checklist Dialog** opens with 4 items:
   - [ ] Boilerplate removed
   - [ ] Chapter structure verified
   - [ ] Punctuation normalized
   - [ ] Archaic spelling preserved
3. Check all 4 boxes
4. Click **"Confirm Approval"**

**Expected:** 
- Success message
- Approval status shows "Approved"
- Timestamp and reviewer recorded

---

### Step 3: Verify Downstream Unlock

1. Navigate to **Templates** page
2. Find the approved book

**Expected:**
- Book shows "Approved" badge
- **"Apply Template"** button is active
- Clicking opens template selection

**Test blocking:**

1. Find an unapproved book in Templates
2. **Expected:** "Apply Template" disabled with tooltip "Approval required"

---

### Step 4: Post-Approval Edit Handling

1. Return to Review page for approved book
2. Make an edit in cleaned pane
3. Click **"Save"**

**Expected:** Dialog prompts:
- **"Keep Approval"** — save edit, maintain approval
- **"Revoke Approval"** — save edit, require re-approval

4. Test both paths

---

## Edge Cases to Test

### Case 1: No Chapter Headings

1. Import a book with no detectable chapter headings
2. Run cleanup

**Expected:** Single "Body" chapter created with all content

---

### Case 2: OCR-Corrupted Headings

1. Import a book with mangled chapter headings (e.g., "CHPTER I", "CHAPTR II")
2. Run cleanup

**Expected:**
- Chapters detected with medium confidence
- OCR flags created for reviewer verification
- Normalized titles generated ("Chapter I", "Chapter II")

---

### Case 3: Unlabeled Section Breaks

1. Import a book with `***` or `---` separators
2. Run cleanup

**Expected:**
- Section breaks flagged as "unlabeled_boundary_candidate"
- NOT auto-promoted to chapters
- Reviewer must explicitly confirm

---

### Case 4: Large File Handling

1. Import a book >100KB
2. Run AI cleanup (if configured)

**Expected:**
- Text chunked into 8KB segments
- Progress updates per segment
- No timeout errors

---

## Backend State Verification

### Check Book Status
```bash
npx convex run books:get '{"bookId":"<id>"}'
```

Expected statuses:
- `imported` — After import, before cleanup
- `cleaned` — After cleanup complete
- `ready` — After approval (downstream unlocked)

### Check Revisions
```bash
npx convex run cleanup:getReviewData '{"bookId":"<id>"}'
```

Verify:
- [ ] Original content preserved
- [ ] Latest revision has highest revisionNumber
- [ ] Revisions track `isDeterministic`, `isAiAssisted` flags

### Check Approval State
```bash
npx convex run cleanup:getApprovalState '{"bookId":"<id>"}'
```

When approved:
- `isApproved: true`
- `approvedAt: timestamp`
- `approvedRevisionId: <revision>`

---

## Success Criteria Checklist

### CLEAN-01: Boilerplate Removal
- [ ] Gutenberg start/end markers stripped
- [ ] Content between markers preserved
- [ ] Missing markers flagged for review

### CLEAN-02: Chapter Detection
- [ ] Standard headings split into chapters
- [ ] Preface/Introduction/Notes/Appendix labeled correctly
- [ ] OCR-corrupted headings accepted with flags
- [ ] No chapters → single "Body" chapter

### CLEAN-03: AI Cleanup (if configured)
- [ ] OCR improvements applied
- [ ] Punctuation normalized
- [ ] Archaic spelling preserved
- [ ] Low-confidence patches flagged

### CLEAN-04/CLEAN-05: Review Controls
- [ ] Side-by-side diff works
- [ ] Original read-only, cleaned editable
- [ ] Manual edits saved to new revision

### REVIEW-01/REVIEW-02: Review Experience
- [ ] Default side-by-side view
- [ ] Line/paragraph diff granularity
- [ ] Flags visible and resolvable

### REVIEW-03: Approval Gating
- [ ] Unresolved flags block approval
- [ ] Checklist required (4 items)
- [ ] No one-click approval path
- [ ] Post-approval edits prompt keep/revoke
- [ ] Downstream actions unlock after approval

---

## Troubleshooting

### Cleanup Job Stuck
```bash
npx convex run cleanup:getCleanupStatus '{"bookId":"<id>"}'
```
Check `status`, `stage`, `error` fields.

### No Flags Created When Expected
- Check `preserveArchaic` setting (if true, fewer punctuation flags)
- Verify text has ambiguous content for flagging

### AI Cleanup Not Available
- Verify `KIMI_API_KEY` in Convex dashboard
- Check `cleanupAiClient.ts` mock fallback mode

---

## Sign-Off

Tester: _________________ Date: _______

- [ ] All Test Flows A-C completed
- [ ] All Edge Cases tested
- [ ] Backend state verified
- [ ] Success criteria met

**Phase 2 Status:** ☐ Ready for production ☐ Needs fixes (document below)

Issues Found:
_____________________________________________
_____________________________________________
