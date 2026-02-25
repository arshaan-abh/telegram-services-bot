import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAndDispatchImmediateNotificationMock,
  dismissOrderByAdminMock,
  getOrderWithUserAndServiceMock,
} = vi.hoisted(() => ({
  createAndDispatchImmediateNotificationMock: vi.fn(),
  dismissOrderByAdminMock: vi.fn(),
  getOrderWithUserAndServiceMock: vi.fn(),
}));

vi.mock("../../src/services/orders.js", () => ({
  dismissOrderByAdmin: dismissOrderByAdminMock,
}));

vi.mock("../../src/db/repositories/orders.js", () => ({
  getOrderWithUserAndService: getOrderWithUserAndServiceMock,
}));

vi.mock("../../src/services/notifications.js", () => ({
  createAndDispatchImmediateNotification:
    createAndDispatchImmediateNotificationMock,
}));

import { dismissOrderConversation } from "../../src/bot/conversations/dismiss-order.js";

function createConversation(messages: string[]) {
  const queue = [...messages];
  return {
    waitFor: vi.fn(() =>
      Promise.resolve({
        message: {
          text: queue.shift() ?? "",
        },
        t: (key: string) => key,
        reply: vi.fn(),
      }),
    ),
    external: <T>(fn: () => Promise<T> | T) => Promise.resolve(fn()),
  };
}

function createContext() {
  return {
    isAdmin: true,
    from: { id: 999 },
    reply: vi.fn(() => Promise.resolve({})),
    t: (key: string, params?: Record<string, string>) => {
      if (key === "admin-order-dismissed-user" && params?.reason) {
        return `dismissed: ${params.reason}`;
      }
      return key;
    },
    api: {
      sendMessage: vi.fn(() => Promise.resolve({})),
    },
  };
}

describe("dismiss order flow", () => {
  beforeEach(() => {
    createAndDispatchImmediateNotificationMock.mockReset();
    dismissOrderByAdminMock.mockReset();
    getOrderWithUserAndServiceMock.mockReset();
  });

  it("requires a non-empty dismissal reason", async () => {
    const conversation = createConversation(["   "]);
    const ctx = createContext();

    await dismissOrderConversation(
      conversation as never,
      ctx as never,
      "order-1",
    );

    expect(dismissOrderByAdminMock).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith("error-generic");
  });

  it("dismisses order and notifies user after confirmation", async () => {
    dismissOrderByAdminMock.mockResolvedValueOnce({ id: "order-1" });
    getOrderWithUserAndServiceMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        telegramId: "12345",
      },
    });

    const conversation = createConversation(["missing payment", "YES"]);
    const ctx = createContext();

    await dismissOrderConversation(
      conversation as never,
      ctx as never,
      "order-1",
    );

    expect(dismissOrderByAdminMock).toHaveBeenCalledWith(
      "order-1",
      "999",
      "missing payment",
    );
    expect(createAndDispatchImmediateNotificationMock).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        audience: "user",
        userId: "user-1",
        messageKey: "order_dismissed_user",
        messagePayload: { reason: "missing payment" },
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith("admin-dismiss-confirmed");
  });
});
