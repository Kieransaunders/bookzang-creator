const BASE_POLL_MS = 2_000;
const MAX_POLL_MS = 10_000;
const STEP_MS = 500;

export function shouldRecoverStaleLease(
  leaseExpiresAt: number,
  now: number = Date.now(),
): boolean {
  return leaseExpiresAt < now;
}

export function computeNextLeaseDelayMs(emptyLeaseLoops: number): number {
  if (emptyLeaseLoops <= 0) {
    return BASE_POLL_MS;
  }

  const delay = BASE_POLL_MS + emptyLeaseLoops * STEP_MS;
  return Math.min(delay, MAX_POLL_MS);
}

export async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
