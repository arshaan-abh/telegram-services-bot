import { beforeEach, describe, expect, it, vi } from "vitest";

const { setMock } = vi.hoisted(() => ({
  setMock: vi.fn(),
}));

vi.mock("../../src/adapters/upstash.js", () => ({
  redis: {
    set: setMock,
  },
}));

import { reserveIdempotencyKey } from "../../src/security/idempotency.js";

describe("idempotency guard", () => {
  beforeEach(() => {
    setMock.mockReset();
  });

  it("reserves key when it does not exist yet", async () => {
    setMock.mockResolvedValueOnce("OK");

    const reserved = await reserveIdempotencyKey("idem:test", 120);

    expect(reserved).toBe(true);
    expect(setMock).toHaveBeenCalledWith("idem:test", "1", {
      nx: true,
      ex: 120,
    });
  });

  it("returns false when key already exists", async () => {
    setMock.mockResolvedValueOnce(null);

    const reserved = await reserveIdempotencyKey("idem:test", 120);

    expect(reserved).toBe(false);
  });
});
