# Phase 2: Text Cleanup and Editorial Approval - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform noisy Gutenberg source text into trusted production text by removing boilerplate, preserving readable structure, detecting chapter boundaries, running AI-assisted cleanup, enabling side-by-side review with manual edits, and requiring explicit approval before downstream template/export steps.

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<specifics>
## Specific Ideas

- Chapter handling should prioritize structural reliability for downstream formatting, with explicit human confirmation for ambiguous boundaries.
- Cleanup should improve readability and punctuation quality without rewriting author-era language.
- Review should stay focused and lightweight: side-by-side comparison and direct cleaned-text editing without extra annotation overhead.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

_Phase: 02-text-cleanup-and-editorial-approval_
_Context gathered: 2026-02-12_
