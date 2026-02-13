# Local-First Quality Mode Ingestion Verification

## Scope

Verify local-first quality-mode ingestion scaffolding with Convex as metadata plane and daemon worker loop in place.

## Automated Evidence

- `npm run test:ingest-local` -> PASS (9 tests)
- `npx tsc -p convex -noEmit --pretty false && npx tsc -p . -noEmit --pretty false` -> PASS
- `npx vite build` -> PASS

## Behavior Evidence Captured

- Source selection policy prefers EPUB before TXT (`convex/intakeSourceResolver.ts`).
- Intake queues quality-mode ingest metadata when Gutenberg ID is present (`convex/intake.ts`).
- Local artifact layout is deterministic under `Library/` (`scripts/daemon/localPaths.ts`).
- EPUB extraction preserves inline formatting markers (`scripts/daemon/epubExtract.ts`).
- Lease logic supports stale recovery and bounded polling backoff (`scripts/daemon/leaseLogic.ts`, `convex/ingestJobs.ts`).

## Remaining Work

- Replace daemon placeholder completion metadata with real downloader + filesystem writes.
- Wire resolver output from Gutenberg format probe into daemon processing path.
- Connect generated local extracted artifacts to cleanup/review entrypoint end-to-end.
