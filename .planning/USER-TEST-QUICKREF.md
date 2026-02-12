# Phase 2 Quick Test Reference

## 5-Minute Smoke Test

```
1. Import Book → Verify metadata extracted
2. Start Cleanup → Wait for "cleaned" status  
3. Open Review → Verify side-by-side panes
4. Edit Cleaned → Save → Verify persists
5. Resolve Flags → Verify count updates
6. Approve → Check all 4 boxes → Confirm
7. Check Templates → Verify "Apply Template" unlocked
```

## Key Verification Commands

```bash
# Check book status
npx convex run books:get '{"bookId":"<id>"}'

# Check review data
npx convex run cleanup:getReviewData '{"bookId":"<id>"}'

# Check flags
npx convex run cleanup:listReviewFlags '{"bookId":"<id>","status":"unresolved"}'

# Check approval state
npx convex run cleanup:getApprovalState '{"bookId":"<id>"}'
```

## Expected Status Flow

```
Import:   discovered → importing → imported
Cleanup:  queued → loading → boilerplate → chapters → completed → cleaned
Review:   (edits create new revisions: 1, 2, 3...)
Approve:  cleaned → ready (when approved)
```

## Locked Decisions Checklist

| Decision | Test |
|----------|------|
| Archaic preserved | Edit has "thee/thou" → stays after cleanup |
| No auto-chapters | `***` break → flag created, NOT chapter |
| Original immutable | Edit original pane → should fail |
| Flags block approval | Leave flag → approval rejected |
| Checklist required | Click approve → 4 checkboxes appear |

## Common Issues

| Symptom | Fix |
|---------|-----|
| Cleanup stuck | Check `cleanupJobs` table for error |
| No AI cleanup | Set `KIMI_API_KEY` in Convex env |
| Can't approve | Resolve ALL flags first |
| Template locked | Approve book first |
