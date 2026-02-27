import type { StorageAdapter } from "grammy";

import { decodeRedisJson } from "../utils/redis-json.js";
import { redis } from "./upstash.js";

export function createRedisSessionStorage<T>(
  prefix: string,
): StorageAdapter<T> {
  return {
    read: async (key) => {
      const namespacedKey = `${prefix}:${key}`;
      const value = await redis.get<unknown>(namespacedKey);
      const parsed = decodeRedisJson<T>(value);

      if (parsed === null) {
        if (value !== null && value !== undefined) {
          await redis.del(namespacedKey);
        }
        return undefined;
      }

      return parsed;
    },
    write: async (key, value) => {
      await redis.set(`${prefix}:${key}`, JSON.stringify(value));
    },
    delete: async (key) => {
      await redis.del(`${prefix}:${key}`);
    },
  };
}
