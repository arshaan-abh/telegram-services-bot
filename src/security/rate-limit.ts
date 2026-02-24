import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "../adapters/upstash.js";

type RateLimiterName = "global" | "proof" | "discount" | "admin";

const limiters: Record<RateLimiterName, Ratelimit> = {
  global: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "rl:global",
  }),
  proof: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(8, "10 m"),
    prefix: "rl:proof",
  }),
  discount: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "10 m"),
    prefix: "rl:discount",
  }),
  admin: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(80, "1 m"),
    prefix: "rl:admin",
  }),
};

export async function checkRateLimit(
  limiter: RateLimiterName,
  identity: string,
) {
  return limiters[limiter].limit(identity);
}
