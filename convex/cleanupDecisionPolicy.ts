export type AmbiguityKind =
  | "ambiguous_punctuation"
  | "low_confidence_cleanup"
  | "unlabeled_boundary_candidate"
  | "ocr_corruption_detected"
  | "chapter_boundary_disputed";

export type AmbiguityThresholds = Partial<Record<AmbiguityKind, number>>;

export const DEFAULT_AMBIGUITY_THRESHOLDS: Record<AmbiguityKind, number> = {
  ambiguous_punctuation: 0.8,
  low_confidence_cleanup: 0.92,
  unlabeled_boundary_candidate: 0.97,
  ocr_corruption_detected: 0.95,
  chapter_boundary_disputed: 0.98,
};

type DecideAmbiguityActionArgs = {
  type: AmbiguityKind;
  confidence: number;
  thresholds?: AmbiguityThresholds;
};

type AmbiguityAction = "auto_apply" | "manual_review";

type AmbiguityDecision = {
  action: AmbiguityAction;
  thresholdUsed: number;
  clampedConfidence: number;
};

function clampUnitInterval(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeConfidence(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  if (value === Number.POSITIVE_INFINITY) {
    return 1;
  }
  if (value === Number.NEGATIVE_INFINITY) {
    return 0;
  }
  return clampUnitInterval(value);
}

function normalizeThreshold(value: number, fallback: number): number {
  if (Number.isNaN(value)) {
    return clampUnitInterval(fallback);
  }
  if (value === Number.POSITIVE_INFINITY) {
    return 1;
  }
  if (value === Number.NEGATIVE_INFINITY) {
    return 0;
  }
  return clampUnitInterval(value);
}

export function decideAmbiguityAction(
  args: DecideAmbiguityActionArgs,
): AmbiguityDecision {
  const defaultThreshold = DEFAULT_AMBIGUITY_THRESHOLDS[args.type];
  const thresholdUsed = normalizeThreshold(
    args.thresholds?.[args.type] ?? defaultThreshold,
    defaultThreshold,
  );
  const clampedConfidence = normalizeConfidence(args.confidence);
  const action: AmbiguityAction =
    clampedConfidence >= thresholdUsed ? "auto_apply" : "manual_review";

  return {
    action,
    thresholdUsed,
    clampedConfidence,
  };
}
