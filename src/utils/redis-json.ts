export function decodeRedisJson<T>(value: unknown): T | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  if (typeof value === "object") {
    return value as T;
  }

  return null;
}
