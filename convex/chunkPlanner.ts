export type CleanupChunk = {
  start: number;
  end: number;
  text: string;
};

export type PlanCleanupChunksArgs = {
  text: string;
  maxChunkChars: number;
  overlapChars: number;
};

export function planCleanupChunks(args: PlanCleanupChunksArgs): CleanupChunk[] {
  const { text, maxChunkChars, overlapChars } = args;

  if (!Number.isFinite(maxChunkChars) || !Number.isInteger(maxChunkChars)) {
    throw new Error("maxChunkChars must be a finite integer");
  }

  if (!Number.isFinite(overlapChars) || !Number.isInteger(overlapChars)) {
    throw new Error("overlapChars must be a finite integer");
  }

  if (maxChunkChars <= 0) {
    throw new Error("maxChunkChars must be greater than 0");
  }

  if (overlapChars < 0 || overlapChars >= maxChunkChars) {
    throw new Error("overlapChars must be >= 0 and less than maxChunkChars");
  }

  // Policy: empty input yields no chunks to avoid pointless downstream work.
  if (text.length === 0) {
    return [];
  }

  if (text.length <= maxChunkChars) {
    return [
      {
        start: 0,
        end: text.length,
        text,
      },
    ];
  }

  const chunks: CleanupChunk[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChunkChars, text.length);
    chunks.push({
      start,
      end,
      text: text.slice(start, end),
    });

    if (end === text.length) {
      break;
    }

    start = end - overlapChars;
  }

  return chunks;
}
