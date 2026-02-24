import type { StorageAdapter } from "grammy";

import { redis } from "./upstash.js";

export function createRedisSessionStorage<T>(
  prefix: string,
): StorageAdapter<T> {
  return {
    read: async (key) => {
      const value = await redis.get<string>(`${prefix}:${key}`);
      if (!value) {
        return undefined;
      }

      return JSON.parse(value) as T;
    },
    write: async (key, value) => {
      await redis.set(`${prefix}:${key}`, JSON.stringify(value));
    },
    delete: async (key) => {
      await redis.del(`${prefix}:${key}`);
    },
  };
}
