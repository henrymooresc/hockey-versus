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

const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;

/**
 * Rate-limited fetch wrapper with timeout and retry on transient network errors.
 * Drop-in replacement for global fetch().
 */
export async function rateLimitedFetch(
  input: string | URL | Request,
  init?: RequestInit,
  attempt = 0
): Promise<Response> {
  await globalLimiter.acquire();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    // Retry on transient network errors (connection reset, timeout, etc.)
    if (attempt < MAX_RETRIES) {
      const backoff = Math.min(2 ** attempt * 1000, 10_000);
      console.warn(
        `Network error on ${String(input)} (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${backoff / 1000}s...`
      );
      await new Promise((resolve) => setTimeout(resolve, backoff));
      return rateLimitedFetch(input, init, attempt + 1);
    }
    throw err;
  }
  clearTimeout(timer);

  if (response.status === 429) {
    if (attempt < MAX_RETRIES) {
      const backoff = Math.min(2 ** attempt * 2000, 60_000);
      console.warn(`Rate limited on ${String(input)}, waiting ${backoff / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, backoff));
      return rateLimitedFetch(input, init, attempt + 1);
    }
    throw new Error(`Rate limited after ${MAX_RETRIES} retries on ${String(input)}`);
  }

  return response;
}
