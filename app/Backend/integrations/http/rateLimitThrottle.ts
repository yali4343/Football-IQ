export interface RateLimitThrottle {
  wait(): Promise<void>;
}

// Each caller gets its own throttle instance with its own lastRequestAt —
// sharing one instance across two independent rate-limited APIs would
// wrongly couple their pacing together.
export function createRateLimitThrottle(minDelayMs: number): RateLimitThrottle {
  let lastRequestAt = 0;

  return {
    async wait(): Promise<void> {
      const elapsed = Date.now() - lastRequestAt;
      const remaining = minDelayMs - elapsed;

      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      lastRequestAt = Date.now();
    },
  };
}
