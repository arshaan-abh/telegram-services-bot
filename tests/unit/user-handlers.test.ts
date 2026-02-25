import { beforeEach, describe, expect, it, vi } from "vitest";

const { listSubscriptionsByUserMock, reconcileExpiredSubscriptionsMock } =
  vi.hoisted(() => ({
    listSubscriptionsByUserMock: vi.fn(),
    reconcileExpiredSubscriptionsMock: vi.fn(),
  }));

vi.mock("../../src/db/repositories/subscriptions.js", () => ({
  listSubscriptionsByUser: listSubscriptionsByUserMock,
}));

vi.mock("../../src/services/subscriptions.js", () => ({
  reconcileExpiredSubscriptions: reconcileExpiredSubscriptionsMock,
}));

vi.mock("../../src/db/repositories/credits.js", () => ({
  getCreditBalance: vi.fn(),
}));

vi.mock("../../src/db/repositories/services.js", () => ({
  getServiceById: vi.fn(),
  listActiveServices: vi.fn(),
}));

vi.mock("../../src/db/repositories/users.js", () => ({
  getUserById: vi.fn(),
}));

import { sendMyServices } from "../../src/bot/handlers/user.js";

describe("user handlers", () => {
  beforeEach(() => {
    listSubscriptionsByUserMock.mockReset();
    reconcileExpiredSubscriptionsMock.mockReset();
  });

  it("reconciles expiry before rendering my services", async () => {
    listSubscriptionsByUserMock.mockResolvedValueOnce([
      {
        subscription: {
          id: "sub-1",
          startedAt: new Date("2026-01-01T00:00:00.000Z"),
          durationDays: 3,
          status: "expired",
        },
        service: {
          id: "svc-1",
          title: "Service A",
        },
      },
    ]);

    const ctx = {
      dbUserId: "user-1",
      t: (key: string) => key,
      reply: vi.fn(() => Promise.resolve({})),
    };

    await sendMyServices(ctx as never);

    expect(reconcileExpiredSubscriptionsMock).toHaveBeenCalledTimes(1);
    expect(listSubscriptionsByUserMock).toHaveBeenCalledWith("user-1");
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("expired"));
  });
});
