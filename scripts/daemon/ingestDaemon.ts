import { config as loadEnv } from "dotenv";
import crypto from "node:crypto";
import { IngestConvexClient } from "./convexClient";
import { computeNextLeaseDelayMs, sleep } from "./leaseLogic";

loadEnv({ path: ".env.local" });
loadEnv();

const envConvexUrl = process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;

if (!envConvexUrl) {
  throw new Error("Missing CONVEX_URL or VITE_CONVEX_URL in environment");
}
const convexUrl: string = envConvexUrl;

const workerId =
  process.env.INGEST_WORKER_ID ?? `${process.env.HOSTNAME ?? "local"}-daemon`;
const leaseMs = process.env.INGEST_LEASE_MS
  ? Number(process.env.INGEST_LEASE_MS)
  : 30_000;

function fakeChecksum(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function processLeasedJob(client: IngestConvexClient, ingestJobId: string) {
  await client.heartbeat({ ingestJobId, workerId, stage: "resolving_source", leaseMs });

  // Placeholder until resolver/downloader/extractor wiring lands.
  // This keeps lease lifecycle operational and testable.
  const selectedFormat = "epub.noimages";
  const sourceUrl = "https://www.gutenberg.org/ebooks/11.epub.noimages";
  const localSourcePath = "Library/epub/11/pg11.epub";
  const localExtractedPath = "Library/work/11/extracted/book.annotated.md";
  const checksum = fakeChecksum(`${ingestJobId}:${selectedFormat}`);

  await client.complete({
    ingestJobId,
    workerId,
    selectedFormat,
    sourceUrl,
    localSourcePath,
    localExtractedPath,
    checksum,
    warning: "Daemon scaffolding mode: placeholder artifact metadata.",
  });
}

async function run() {
  const client = new IngestConvexClient(convexUrl);
  let emptyLeaseLoops = 0;

  process.stdout.write(`[ingest-daemon] starting worker=${workerId}\n`);

  while (true) {
    await client.recoverStaleLeases();

    const leased = await client.leaseNext({ workerId, leaseMs });
    if (!leased) {
      emptyLeaseLoops += 1;
      await sleep(computeNextLeaseDelayMs(emptyLeaseLoops));
      continue;
    }

    emptyLeaseLoops = 0;
    const ingestJobId = String(leased);

    try {
      await processLeasedJob(client, ingestJobId);
      process.stdout.write(`[ingest-daemon] completed job=${ingestJobId}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await client.fail(ingestJobId, message, workerId);
      process.stderr.write(`[ingest-daemon] failed job=${ingestJobId}: ${message}\n`);
    }
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[ingest-daemon] fatal: ${message}\n`);
  process.exitCode = 1;
});
