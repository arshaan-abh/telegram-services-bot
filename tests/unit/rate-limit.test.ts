import { beforeEach, describe, expect, it, vi } from "vitest";

const { limitMock, slidingWindowMock } = vi.hoisted(() => ({
  limitMock:
    vi.fn<
      (
        prefix: string,
        identity: string,
      ) => Promise<{ success: boolean; remaining: number }>
    >(),
  slidingWindowMock: vi.fn(),
}));

vi.mock("../../src/adapters/upstash.js", () => ({
  redis: {},
}));

vi.mock("@upstash/ratelimit", () => {
  class FakeRatelimit {
    static slidingWindow = slidingWindowMock;

    private readonly prefix: string;

    constructor(config: { prefix: string }) {
      this.prefix = config.prefix;
    }

    limit(identity: string) {
      return limitMock(this.prefix, identity);
    }
  }

  return {
    Ratelimit: FakeRatelimit,
  };
});

import { checkRateLimit } from "../../src/security/rate-limit.js";

describe("rate limit checks", () => {
  beforeEach(() => {
    limitMock.mockReset();
    slidingWindowMock.mockReset();
  });

  it("uses proof limiter prefix for proof checks", async () => {
    limitMock.mockResolvedValueOnce({ success: true, remaining: 7 });

    const result = await checkRateLimit("proof", "user-1");

    expect(result).toEqual({ success: true, remaining: 7 });
    expect(limitMock).toHaveBeenCalledWith("rl:proof", "user-1");
  });

  it("uses admin limiter prefix for admin checks", async () => {
    limitMock.mockResolvedValueOnce({ success: false, remaining: 0 });

    const result = await checkRateLimit("admin", "admin-telegram-id");

    expect(result).toEqual({ success: false, remaining: 0 });
    expect(limitMock).toHaveBeenCalledWith("rl:admin", "admin-telegram-id");
  });
});
