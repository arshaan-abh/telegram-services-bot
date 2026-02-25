import { redis } from "../adapters/upstash.js";

export async function reserveIdempotencyKey(
  key: string,
  ttlSeconds = 300,
): Promise<boolean> {
  const result = await redis.set(key, "1", {
    nx: true,
    ex: ttlSeconds,
  });

  return result === "OK" || result === "1";
}
