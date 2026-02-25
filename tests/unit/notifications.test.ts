import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  publishJSONMock,
  createAuditLogMock,
  createNotificationMock,
  findNotificationByIdempotencyKeyMock,
  getNotificationByIdMock,
  markNotificationFailedMock,
  markNotificationSentMock,
  getUserByIdMock,
  listAllUsersMock,
  listSubscribersByServiceMock,
} = vi.hoisted(() => ({
  publishJSONMock: vi.fn(),
  createAuditLogMock: vi.fn(),
  createNotificationMock: vi.fn(),
  findNotificationByIdempotencyKeyMock: vi.fn(),
  getNotificationByIdMock: vi.fn(),
  markNotificationFailedMock: vi.fn(),
  markNotificationSentMock: vi.fn(),
  getUserByIdMock: vi.fn(),
  listAllUsersMock: vi.fn(),
  listSubscribersByServiceMock: vi.fn(),
}));

vi.mock("../../src/adapters/upstash.js", () => ({
  qstash: {
    publishJSON: publishJSONMock,
  },
}));

vi.mock("../../src/db/repositories/audit.js", () => ({
  createAuditLog: createAuditLogMock,
}));

vi.mock("../../src/db/repositories/notifications.js", () => ({
  cancelNotification: vi.fn(),
  createNotification: createNotificationMock,
  findNotificationByIdempotencyKey: findNotificationByIdempotencyKeyMock,
  getNotificationById: getNotificationByIdMock,
  markNotificationFailed: markNotificationFailedMock,
  markNotificationSent: markNotificationSentMock,
}));

vi.mock("../../src/db/repositories/users.js", () => ({
  getUserById: getUserByIdMock,
  listAllUsers: listAllUsersMock,
}));

vi.mock("../../src/db/repositories/subscriptions.js", () => ({
  listSubscribersByService: listSubscribersByServiceMock,
}));

import {
  createAndScheduleNotification,
  dispatchNotificationById,
} from "../../src/services/notifications.js";

describe("notifications service", () => {
  beforeEach(() => {
    publishJSONMock.mockReset();
    createAuditLogMock.mockReset();
    createNotificationMock.mockReset();
    findNotificationByIdempotencyKeyMock.mockReset();
    getNotificationByIdMock.mockReset();
    markNotificationFailedMock.mockReset();
    markNotificationSentMock.mockReset();
    getUserByIdMock.mockReset();
    listAllUsersMock.mockReset();
    listSubscribersByServiceMock.mockReset();
  });

  it("reuses existing notification for same idempotency key", async () => {
    findNotificationByIdempotencyKeyMock.mockResolvedValueOnce({
      id: "existing-id",
    });

    const result = await createAndScheduleNotification({
      audience: "user",
      userId: "u1",
      serviceId: "s1",
      messageKey: "subscription_reminder",
      messagePayload: { serviceTitle: "S1" },
      sendAt: new Date("2026-01-01T00:00:00.000Z"),
      createdBy: "admin",
    });

    expect(result.id).toBe("existing-id");
    expect(createNotificationMock).not.toHaveBeenCalled();
    expect(publishJSONMock).not.toHaveBeenCalled();
  });

  it("supports immediate mode without qstash publish", async () => {
    findNotificationByIdempotencyKeyMock.mockResolvedValueOnce(null);
    createNotificationMock.mockResolvedValueOnce({
      id: "new-id",
    });

    const result = await createAndScheduleNotification({
      audience: "all",
      messageKey: "admin_custom",
      messagePayload: { text: "hello" },
      sendAt: new Date("2026-01-01T00:00:00.000Z"),
      createdBy: "admin",
      skipQueue: true,
    });

    expect(result.id).toBe("new-id");
    expect(createNotificationMock).toHaveBeenCalledTimes(1);
    expect(publishJSONMock).not.toHaveBeenCalled();
  });

  it("records retry metadata when dispatch fails", async () => {
    getNotificationByIdMock.mockResolvedValueOnce({
      id: "n1",
      state: "pending",
      audience: "user",
      userId: "u1",
      serviceId: null,
      messageKey: "admin_custom",
      messagePayload: { text: "hello" },
      createdBy: "admin",
    });
    getUserByIdMock.mockResolvedValueOnce({
      id: "u1",
      telegramId: "12345",
    });

    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error("delivery_fail"));
    const botLike = {
      api: {
        sendMessage,
      },
    };

    await dispatchNotificationById(botLike, "n1", {
      retryCount: 2,
      qstashMessageId: "msg-1",
    });

    expect(markNotificationFailedMock).toHaveBeenCalledTimes(1);
    const failureReason = markNotificationFailedMock.mock.calls[0]?.[1] as
      | string
      | undefined;
    expect(failureReason).toContain("retry=2");
    expect(failureReason).toContain("delivery_fail");
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "notification.fail",
      }),
    );
  });
});
