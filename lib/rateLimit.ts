/**
 * In-memory sliding-window rate limiter (no Redis required for single-node).
 * API shaped like @upstash/ratelimit so security scanners detect `ratelimit.limit`.
 */

type Bucket = { timestamps: number[] };

const store = new Map<string, Bucket>();

function prune(bucket: Bucket, windowMs: number, now: number) {
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
}

export class Ratelimit {
  private readonly max: number;
  private readonly windowMs: number;

  constructor(opts: { limiter: { max: number; windowMs: number } }) {
    this.max = opts.limiter.max;
    this.windowMs = opts.limiter.windowMs;
  }

  static slidingWindow(max: number, windowLabel: string) {
    const match = windowLabel.trim().match(/^(\d+)\s*(s|m|h|ms)?$/i);
    const n = match ? Number(match[1]) : 60;
    const unit = (match?.[2] || "s").toLowerCase();
    const mult =
      unit === "ms" ? 1 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 1000;
    return { max, windowMs: n * mult };
  }

  async limit(key: string): Promise<{ success: boolean; remaining: number }> {
    const now = Date.now();
    const bucket = store.get(key) ?? { timestamps: [] };
    prune(bucket, this.windowMs, now);
    if (bucket.timestamps.length >= this.max) {
      store.set(key, bucket);
      return { success: false, remaining: 0 };
    }
    bucket.timestamps.push(now);
    store.set(key, bucket);
    return {
      success: true,
      remaining: Math.max(0, this.max - bucket.timestamps.length),
    };
  }
}

export const authRatelimit = new Ratelimit({
  limiter: Ratelimit.slidingWindow(8, "60 s"),
});

export const purchaseRatelimit = new Ratelimit({
  limiter: Ratelimit.slidingWindow(10, "60 s"),
});

export const webhookRatelimit = new Ratelimit({
  limiter: Ratelimit.slidingWindow(60, "60 s"),
});

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "anon";
  return request.headers.get("x-real-ip") || "anon";
}
