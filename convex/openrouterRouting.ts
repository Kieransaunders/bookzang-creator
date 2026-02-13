export type OpenRouterRoutingPlanArgs = {
  primaryModel: string;
  fallbackModels: string[];
};

export type ShouldFallbackArgs = {
  statusCode: number;
  attemptIndex: number;
  totalModels: number;
};

const RATE_LIMIT_STATUS_CODE = 429;
const RETRYABLE_SERVER_ERROR_MIN = 500;
const RETRYABLE_SERVER_ERROR_MAX = 599;

export function isRetryableProviderFailure(statusCode: number): boolean {
  if (!Number.isFinite(statusCode) || statusCode <= 0) {
    return false;
  }

  return (
    statusCode === RATE_LIMIT_STATUS_CODE ||
    (statusCode >= RETRYABLE_SERVER_ERROR_MIN &&
      statusCode <= RETRYABLE_SERVER_ERROR_MAX)
  );
}

function isValidFallbackArgs(args: ShouldFallbackArgs): boolean {
  return (
    Number.isInteger(args.attemptIndex) &&
    Number.isInteger(args.totalModels) &&
    args.attemptIndex >= 0 &&
    args.totalModels > 0
  );
}

export function planOpenRouterModelOrder(
  args: OpenRouterRoutingPlanArgs,
): string[] {
  const orderedModels = [args.primaryModel, ...args.fallbackModels]
    .map((model) => model.trim())
    .filter((model) => model.length > 0);
  const seen = new Set<string>();

  return orderedModels.filter((model) => {
    if (seen.has(model)) {
      return false;
    }

    seen.add(model);
    return true;
  });
}

export function shouldFallbackToNextModel(args: ShouldFallbackArgs): boolean {
  if (!isValidFallbackArgs(args)) {
    return false;
  }

  const hasAnotherModel = args.attemptIndex < args.totalModels - 1;

  return hasAnotherModel && isRetryableProviderFailure(args.statusCode);
}
