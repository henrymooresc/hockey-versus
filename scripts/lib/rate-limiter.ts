/**
 * Token-bucket rate limiter for NHL API requests.
 * Allows bursts up to `maxTokens` and refills at `refillRate` tokens/sec.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number = 20,
    private refillRate: number = 20
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens < 1) {
      const waitMs = ((1 - this.tokens) / this.refillRate) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      this.refill();
    }
    this.tokens -= 1;
  }
}

const globalLimiter = new RateLimiter(3, 3);

/**
 * Rate-limited fetch wrapper. Drop-in replacement for global fetch().
 */
export async function rateLimitedFetch(
  url: string,
  init?: RequestInit,
  attempt = 0
): Promise<Response> {
  await globalLimiter.acquire();
  const response = await fetch(url, init);

  if (response.status === 429) {
    const backoff = Math.min(2 ** attempt * 2000, 60000);
    console.warn(`Rate limited on ${url}, waiting ${backoff / 1000}s...`);
    await new Promise((resolve) => setTimeout(resolve, backoff));
    return rateLimitedFetch(url, init, attempt + 1);
  }

  return response;
}
