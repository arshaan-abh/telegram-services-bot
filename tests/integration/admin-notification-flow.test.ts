import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getUserByTelegramIdMock,
  listAllServicesMock,
  scheduleAdminNotificationMock,
} = vi.hoisted(() => ({
  getUserByTelegramIdMock: vi.fn(),
  listAllServicesMock: vi.fn(),
  scheduleAdminNotificationMock: vi.fn(),
}));

vi.mock("../../src/db/repositories/users.js", () => ({
  getUserByTelegramId: getUserByTelegramIdMock,
}));

vi.mock("../../src/db/repositories/services.js", () => ({
  listAllServices: listAllServicesMock,
}));

vi.mock("../../src/bot/handlers/admin.js", () => ({
  scheduleAdminNotification: scheduleAdminNotificationMock,
}));

import { adminNotificationConversation } from "../../src/bot/conversations/notification-admin.js";

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
    t: (key: string) => key,
  };
}

describe("admin notification flow", () => {
  beforeEach(() => {
    getUserByTelegramIdMock.mockReset();
    listAllServicesMock.mockReset();
    scheduleAdminNotificationMock.mockReset();
  });

  it("re-prompts invalid datetime and schedules when corrected", async () => {
    const conversation = createConversation([
      "all",
      "Hello users",
      "2026-03-01 10:20:30",
      "2026-03-01T10:20:30Z",
    ]);
    const ctx = createContext();

    await adminNotificationConversation(conversation as never, ctx as never);

    expect(ctx.reply).toHaveBeenCalledWith(
      "notification-admin-invalid-datetime",
    );
    expect(scheduleAdminNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: "all",
        text: "Hello users",
        immediate: false,
      }),
    );
  });

  it("accepts NOW for immediate notifications", async () => {
    const conversation = createConversation(["all", "Hello users", "NOW"]);
    const ctx = createContext();

    await adminNotificationConversation(conversation as never, ctx as never);

    expect(scheduleAdminNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: "all",
        text: "Hello users",
        immediate: true,
      }),
    );
  });
});
