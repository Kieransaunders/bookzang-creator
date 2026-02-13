# Local Ingest Daemon (Mac Mini)

This app now follows a local-first ingestion model:

- Convex stores metadata, job state, and pointers only.
- Source and extracted book artifacts live under `Library/`.
- Quality mode is default and prefers EPUB when available.

## Local Artifact Contract

- `Library/epub/<id>/pg<id>.txt`
- `Library/epub/<id>/pg<id>.epub`
- `Library/work/<id>/extracted/book.annotated.md`
- `Library/work/<id>/derived/chapters.json`
- `Library/work/<id>/manifest.json`
- `Library/work/<id>/exports/`

## Runtime Components

- Frontend: `npm run dev:frontend`
- Convex dev backend: `npm run dev:backend` (must run in an interactive terminal)
- Daemon worker: `npx tsx scripts/daemon/ingestDaemon.ts`

## launchd Service Management

- Install + start: `npm run daemon:install`
- Uninstall + stop: `npm run daemon:uninstall`
- Manual run: `npm run daemon:ingest`

The installer writes launchd config to:

- `~/Library/LaunchAgents/com.bookzang.ingest.daemon.plist`

And daemon logs to:

- `~/Library/Logs/bookzang/bookzang-ingest.out.log`
- `~/Library/Logs/bookzang/bookzang-ingest.err.log`

## Quality Mode Behavior

- Upload path queues ingest metadata with mode `quality` when Gutenberg ID is present.
- Source resolver priority:
  1. `epub3.images`
  2. `epub.images`
  3. `epub.noimages`
  4. `txt`
- EPUB extraction preserves inline markers:
  - emphasis (`<em>`, `<i>`) -> `*text*`
  - small caps spans -> `{smallcaps:text}`

## Verification Commands

- `npm run test:ingest-local`
- `npx tsc -p convex -noEmit --pretty false && npx tsc -p . -noEmit --pretty false`
- `npx vite build`

## Current Limitations

- Daemon currently runs with scaffolded completion metadata and placeholder source paths while downstream downloader/extractor wiring is being finished.
- Convex `npm run lint` includes `convex dev --once`, which requires interactive prompt handling in this environment.
