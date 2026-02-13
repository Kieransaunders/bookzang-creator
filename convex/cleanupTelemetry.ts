/**
 * Cleanup telemetry utilities for tracking model usage and chunking statistics
 */

export type CleanupTelemetryInput = {
  requestedModel: string;
  resolvedModel: string;
  fallbackUsed?: boolean;
  chunkCount?: number;
  maxChunkChars?: number;
  overlapChars?: number;
  totalInputChars?: number;
  processingStartedAt?: number;
  processingCompletedAt?: number;
};

export type CleanupTelemetryInsert = {
  requestedModel: string;
  resolvedModel: string;
  fallbackUsed: boolean;
  chunkCount: number;
  maxChunkChars: number;
  overlapChars: number;
  totalInputChars: number;
  processingStartedAt?: number;
  processingCompletedAt?: number;
};

function normalizeNonNegativeInt(value: number | undefined): number {
  if (value === undefined || value === null) {
    return 0;
  }
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function normalizeModelName(value: string | undefined): string {
  if (value === undefined || value === null) {
    return "unknown";
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "unknown";
}

/**
 * Normalizes telemetry input for safe insertion into the database
 * - Trims model names, defaults empty to "unknown"
 * - Coerces boolean fallbackUsed to false if undefined
 * - Clamps numeric values to non-negative integers
 * - Preserves optional timestamp fields
 */
export function normalizeTelemetryInsert(
  input: CleanupTelemetryInput,
): CleanupTelemetryInsert {
  const requestedModel = normalizeModelName(input.requestedModel);
  const resolvedModel = normalizeModelName(input.resolvedModel);

  if (requestedModel === "unknown" && resolvedModel === "unknown") {
    throw new Error("At least one model name must be provided");
  }

  return {
    requestedModel,
    resolvedModel,
    fallbackUsed: input.fallbackUsed ?? false,
    chunkCount: normalizeNonNegativeInt(input.chunkCount),
    maxChunkChars: normalizeNonNegativeInt(input.maxChunkChars),
    overlapChars: normalizeNonNegativeInt(input.overlapChars),
    totalInputChars: normalizeNonNegativeInt(input.totalInputChars),
    processingStartedAt: input.processingStartedAt,
    processingCompletedAt: input.processingCompletedAt,
  };
}

/**
 * Calculates processing duration from telemetry timestamps
 * Returns undefined if timestamps are missing or invalid
 */
export function calculateProcessingDuration(
  telemetry: Pick<
    CleanupTelemetryInsert,
    "processingStartedAt" | "processingCompletedAt"
  >,
): number | undefined {
  if (
    telemetry.processingStartedAt === undefined ||
    telemetry.processingCompletedAt === undefined
  ) {
    return undefined;
  }

  const duration =
    telemetry.processingCompletedAt - telemetry.processingStartedAt;

  // Reject negative or non-finite durations
  if (!Number.isFinite(duration) || duration < 0) {
    return undefined;
  }

  return duration;
}
