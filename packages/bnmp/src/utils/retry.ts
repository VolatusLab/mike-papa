export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function exponentialBackoff(attempt: number, baseMs: number, capMs = 30_000): number {
  const exp = baseMs * 2 ** Math.max(0, attempt - 1);
  return Math.min(exp, capMs);
}

/** ±25% jitter to avoid thundering herd on simultaneous retries. */
export function jitter(ms: number, ratio = 0.25): number {
  const delta = ms * ratio;
  return Math.round(ms - delta + Math.random() * delta * 2);
}
