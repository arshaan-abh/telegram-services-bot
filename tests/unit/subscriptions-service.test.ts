import { beforeEach, describe, expect, it, vi } from "vitest";

const { listActiveSubscriptionsMock, updateSubscriptionDurationMock } =
  vi.hoisted(() => ({
    listActiveSubscriptionsMock: vi.fn(),
    updateSubscriptionDurationMock: vi.fn(),
  }));

vi.mock("../../src/db/repositories/subscriptions.js", () => ({
  listActiveSubscriptions: listActiveSubscriptionsMock,
  updateSubscriptionDuration: updateSubscriptionDurationMock,
}));

import {
  isSubscriptionExpired,
  reconcileExpiredSubscriptions,
} from "../../src/services/subscriptions.js";

describe("subscriptions service", () => {
  beforeEach(() => {
    listActiveSubscriptionsMock.mockReset();
    updateSubscriptionDurationMock.mockReset();
  });

  it("detects expiry based on start date + duration", () => {
    const now = new Date("2026-01-05T00:00:00.000Z");

    expect(
      isSubscriptionExpired(new Date("2026-01-01T00:00:00.000Z"), 4, now),
    ).toBe(true);
    expect(
      isSubscriptionExpired(new Date("2026-01-01T00:00:00.000Z"), 5, now),
    ).toBe(false);
  });

  it("marks only expired active subscriptions", async () => {
    listActiveSubscriptionsMock.mockResolvedValueOnce([
      {
        id: "sub-expired",
        startedAt: new Date("2026-01-01T00:00:00.000Z"),
        durationDays: 3,
      },
      {
        id: "sub-active",
        startedAt: new Date("2026-01-03T00:00:00.000Z"),
        durationDays: 10,
      },
    ]);
    updateSubscriptionDurationMock.mockResolvedValueOnce({
      id: "sub-expired",
      status: "expired",
    });

    const changed = await reconcileExpiredSubscriptions(
      new Date("2026-01-05T00:00:00.000Z"),
    );

    expect(changed).toBe(1);
    expect(updateSubscriptionDurationMock).toHaveBeenCalledTimes(1);
    expect(updateSubscriptionDurationMock).toHaveBeenCalledWith("sub-expired", {
      status: "expired",
    });
  });

  it("returns zero when there are no expired subscriptions", async () => {
    listActiveSubscriptionsMock.mockResolvedValueOnce([
      {
        id: "sub-active",
        startedAt: new Date("2026-01-04T00:00:00.000Z"),
        durationDays: 10,
      },
    ]);

    const changed = await reconcileExpiredSubscriptions(
      new Date("2026-01-05T00:00:00.000Z"),
    );

    expect(changed).toBe(0);
    expect(updateSubscriptionDurationMock).not.toHaveBeenCalled();
  });
});
