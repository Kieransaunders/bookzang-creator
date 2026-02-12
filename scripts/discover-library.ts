import path from "node:path";
import { open, readdir, stat } from "node:fs/promises";
import { config as loadEnv } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

loadEnv({ path: ".env.local" });
loadEnv();

const convexUrl = process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "Missing CONVEX_URL or VITE_CONVEX_URL in environment (.env.local)",
  );
}

type Candidate = {
  gutenbergId: string;
  sourcePath: string;
  title?: string;
  author?: string;
  warning?: string;
};

type Totals = {
  scanned: number;
  created: number;
  existing: number;
  updated: number;
};

const TITLE_REGEX = /^Title:\s*(.+)$/im;
const AUTHOR_REGEX = /^Author:\s*(.+)$/im;
const HEADER_FALLBACK_REGEX =
  /Project Gutenberg eBook of\s+([^,\n]+),\s+by\s+([^\n]+)/i;

const resolveEpubRoot = async () => {
  const candidates = [
    path.resolve("library", "epub"),
    path.resolve("Library", "epub"),
  ];

  for (const dir of candidates) {
    try {
      const info = await stat(dir);
      if (info.isDirectory()) {
        return dir;
      }
    } catch {
      continue;
    }
  }

  throw new Error("Could not find library/epub or Library/epub directory");
};

const parseMetadata = (text: string) => {
  const title = text.match(TITLE_REGEX)?.[1]?.trim();
  const author = text.match(AUTHOR_REGEX)?.[1]?.trim();

  if (title || author) {
    return { title, author };
  }

  const fallback = text.match(HEADER_FALLBACK_REGEX);
  if (!fallback) {
    return { title: undefined, author: undefined };
  }

  return {
    title: fallback[1]?.trim(),
    author: fallback[2]?.trim(),
  };
};

const readPreview = async (filePath: string, bytes = 120_000) => {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
    return buffer.toString("utf8", 0, bytesRead);
  } finally {
    await handle.close();
  }
};

const discoverLimit = process.env.DISCOVER_LIMIT
  ? Number(process.env.DISCOVER_LIMIT)
  : undefined;

const buildCandidate = async (
  epubRoot: string,
  gutenbergId: string,
): Promise<Candidate | null> => {
  const folderPath = path.join(epubRoot, gutenbergId);
  const files = await readdir(folderPath, { withFileTypes: true });
  const textFile = files.find(
    (entry) => entry.isFile() && /^pg\d+.*\.txt$/i.test(entry.name),
  );

  if (!textFile) {
    return null;
  }

  const absoluteFilePath = path.join(folderPath, textFile.name);
  const preview = await readPreview(absoluteFilePath);
  const parsed = parseMetadata(preview);

  const missing: string[] = [];
  if (!parsed.title) {
    missing.push("title");
  }
  if (!parsed.author) {
    missing.push("author");
  }

  return {
    gutenbergId,
    sourcePath: path.relative(process.cwd(), absoluteFilePath),
    title: parsed.title,
    author: parsed.author,
    warning: missing.length
      ? `Low-confidence metadata: missing ${missing.join(" and ")}`
      : undefined,
  };
};

const pushChunk = async (
  client: ConvexHttpClient,
  chunk: Candidate[],
  totals: Totals,
) => {
  if (chunk.length === 0) {
    return;
  }

  const result = await client.mutation(api.intake.createDiscoveryCandidates, {
    limit: chunk.length,
    candidates: chunk,
  });

  totals.created += result.created;
  totals.existing += result.existing;
  totals.updated += result.updated ?? 0;
};

const scanAndPush = async (client: ConvexHttpClient): Promise<Totals> => {
  const epubRoot = await resolveEpubRoot();
  const dirEntries = await readdir(epubRoot, { withFileTypes: true });
  const numericDirs = dirEntries
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => Number(a) - Number(b));

  const totals: Totals = {
    scanned: 0,
    created: 0,
    existing: 0,
    updated: 0,
  };
  const batch: Candidate[] = [];
  const chunkSize = 200;

  for (const gutenbergId of numericDirs) {
    if (discoverLimit && totals.scanned >= discoverLimit) {
      break;
    }

    const candidate = await buildCandidate(epubRoot, gutenbergId);
    if (!candidate) {
      continue;
    }

    totals.scanned += 1;
    batch.push(candidate);

    if (batch.length >= chunkSize) {
      await pushChunk(client, batch, totals);
      batch.length = 0;
      process.stdout.write(`Processed ${totals.scanned} candidates...\n`);
    }
  }

  await pushChunk(client, batch, totals);
  return totals;
};

const run = async () => {
  const client = new ConvexHttpClient(convexUrl);
  const totals = await scanAndPush(client);

  if (totals.scanned === 0) {
    console.log("No matching pg*.txt files found under library/epub.");
    return;
  }

  console.log(
    `Discovery complete: scanned=${totals.scanned}, created=${totals.created}, updated=${totals.updated}, existing=${totals.existing}`,
  );
};

run().catch((error) => {
  console.error("Discovery script failed:", error);
  process.exitCode = 1;
});
