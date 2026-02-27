import { describe, expect, it } from "vitest";

import { decodeRedisJson } from "../../src/utils/redis-json.js";

describe("decodeRedisJson", () => {
  it("returns null for nullish values", () => {
    expect(decodeRedisJson(null)).toBeNull();
    expect(decodeRedisJson(undefined)).toBeNull();
  });

  it("parses string JSON payloads", () => {
    expect(decodeRedisJson<{ x: number }>('{"x":1}')).toEqual({ x: 1 });
  });

  it("returns object payloads as-is", () => {
    expect(decodeRedisJson<{ x: number }>({ x: 2 })).toEqual({ x: 2 });
  });

  it("returns null for invalid JSON strings", () => {
    expect(decodeRedisJson("{bad_json")).toBeNull();
  });
});
