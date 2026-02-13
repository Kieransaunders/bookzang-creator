export type SourceFormat =
  | "epub3.images"
  | "epub.images"
  | "epub.noimages"
  | "txt";

export type SourceCandidate = {
  format: SourceFormat;
  url: string;
};

export const QUALITY_PRIORITY: SourceFormat[] = [
  "epub3.images",
  "epub.images",
  "epub.noimages",
  "txt",
];

export function selectPreferredSource(
  candidates: SourceCandidate[],
): SourceCandidate {
  for (const format of QUALITY_PRIORITY) {
    const match = candidates.find((candidate) => candidate.format === format);
    if (match) {
      return match;
    }
  }

  throw new Error("No supported source formats available");
}
