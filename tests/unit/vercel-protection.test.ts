import { describe, expect, it } from "vitest";

import {
  addVercelProtectionBypassToUrl,
  createVercelProtectionBypassHeaders,
} from "../../src/utils/vercel-protection.js";

describe("vercel protection helpers", () => {
  it("does not change URL when bypass secret is missing", () => {
    const input = "https://example.com/api/health";
    const output = addVercelProtectionBypassToUrl(input);

    expect(output).toBe(input);
  });

  it("adds bypass query parameter when bypass secret is provided", () => {
    const output = addVercelProtectionBypassToUrl(
      "https://example.com/api/health",
      "secret-1",
    );

    expect(output).toBe(
      "https://example.com/api/health?x-vercel-protection-bypass=secret-1",
    );
  });

  it("preserves existing query parameters while adding bypass secret", () => {
    const output = addVercelProtectionBypassToUrl(
      "https://example.com/api/qstash/dispatch?foo=bar",
      "secret-2",
    );

    const parsed = new URL(output);
    expect(parsed.searchParams.get("foo")).toBe("bar");
    expect(parsed.searchParams.get("x-vercel-protection-bypass")).toBe(
      "secret-2",
    );
  });

  it("returns empty headers when bypass secret is missing", () => {
    expect(createVercelProtectionBypassHeaders()).toEqual({});
  });

  it("returns bypass header when bypass secret is provided", () => {
    expect(createVercelProtectionBypassHeaders("secret-3")).toEqual({
      "x-vercel-protection-bypass": "secret-3",
    });
  });
});
