import { describe, expect, it } from "vitest";

import { shouldExtendExistingSubscription } from "../../src/services/orders.js";
import { calculateSubscriptionEnd } from "../../src/utils/date.js";

describe("subscription policy", () => {
  it("extends existing subscription when it is still active", () => {
    const now = new Date("2026-01-10T00:00:00.000Z");
    const existingEnd = new Date("2026-01-15T00:00:00.000Z");

    expect(shouldExtendExistingSubscription(existingEnd, now)).toBe(true);
  });

  it("creates parallel/new subscription when existing one is expired", () => {
    const now = new Date("2026-01-10T00:00:00.000Z");
    const existingEnd = new Date("2026-01-01T00:00:00.000Z");

    expect(shouldExtendExistingSubscription(existingEnd, now)).toBe(false);
  });

  it("calculates subscription end from start + duration days", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = calculateSubscriptionEnd(start, 30);

    expect(end.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });
});
