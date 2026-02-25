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

  it("publishes scheduled notifications to qstash when queue is enabled", async () => {
    const sendAt = new Date("2026-03-01T10:20:30.000Z");
    findNotificationByIdempotencyKeyMock.mockResolvedValueOnce(null);
    createNotificationMock.mockResolvedValueOnce({
      id: "scheduled-id",
    });

    const result = await createAndScheduleNotification({
      audience: "service_subscribers",
      serviceId: "service-1",
      messageKey: "subscription_ended",
      messagePayload: { serviceTitle: "Service A" },
      sendAt,
      createdBy: "admin",
    });

    expect(result.id).toBe("scheduled-id");
    expect(publishJSONMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { notificationId: "scheduled-id" },
        notBefore: sendAt.getTime(),
      }),
    );
  });

  it("returns without side effects for missing or non-pending notifications", async () => {
    const sendMessage = vi.fn();
    const botLike = {
      api: {
        sendMessage,
      },
    };

    getNotificationByIdMock.mockResolvedValueOnce(null);
    await dispatchNotificationById(botLike, "missing");

    getNotificationByIdMock.mockResolvedValueOnce({
      id: "sent-id",
      state: "sent",
      audience: "all",
      userId: null,
      serviceId: null,
      messageKey: "admin_custom",
      messagePayload: { text: "already handled" },
      createdBy: "admin",
    });
    await dispatchNotificationById(botLike, "sent-id");

    expect(sendMessage).not.toHaveBeenCalled();
    expect(markNotificationSentMock).not.toHaveBeenCalled();
    expect(markNotificationFailedMock).not.toHaveBeenCalled();
  });

  it("marks user-targeted notification as failed when user id is missing", async () => {
    getNotificationByIdMock.mockResolvedValueOnce({
      id: "n-missing-user",
      state: "pending",
      audience: "user",
      userId: null,
      serviceId: null,
      messageKey: "admin_custom",
      messagePayload: { text: "hello" },
      createdBy: "admin",
    });

    const botLike = {
      api: {
        sendMessage: vi.fn(),
      },
    };

    await dispatchNotificationById(botLike, "n-missing-user", {
      retryCount: 1,
    });

    expect(markNotificationFailedMock).toHaveBeenCalledWith(
      "n-missing-user",
      expect.stringContaining("missing_user_id"),
    );
  });

  it("marks user-targeted notification as failed when user is not found", async () => {
    getNotificationByIdMock.mockResolvedValueOnce({
      id: "n-user-not-found",
      state: "pending",
      audience: "user",
      userId: "u-missing",
      serviceId: null,
      messageKey: "admin_custom",
      messagePayload: { text: "hello" },
      createdBy: "admin",
    });
    getUserByIdMock.mockResolvedValueOnce(null);

    const botLike = {
      api: {
        sendMessage: vi.fn(),
      },
    };

    await dispatchNotificationById(botLike, "n-user-not-found");

    expect(markNotificationFailedMock).toHaveBeenCalledWith(
      "n-user-not-found",
      "user_not_found",
    );
  });

  it("dispatches to all users and records sent audit entry", async () => {
    getNotificationByIdMock.mockResolvedValueOnce({
      id: "n-all",
      state: "pending",
      audience: "all",
      userId: null,
      serviceId: null,
      messageKey: "admin_custom",
      messagePayload: { text: "broadcast" },
      createdBy: "admin",
    });
    listAllUsersMock.mockResolvedValueOnce([
      { id: "u1", telegramId: "111" },
      { id: "u2", telegramId: "222" },
    ]);

    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const botLike = {
      api: {
        sendMessage,
      },
    };

    await dispatchNotificationById(botLike, "n-all", {
      qstashMessageId: "msg-22",
    });

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(markNotificationSentMock).toHaveBeenCalledWith("n-all", "msg-22");
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "notification.send",
        entityId: "n-all",
      }),
    );
  });

  it("marks service-subscriber notification as failed when service id is missing", async () => {
    getNotificationByIdMock.mockResolvedValueOnce({
      id: "n-service-missing",
      state: "pending",
      audience: "service_subscribers",
      userId: null,
      serviceId: null,
      messageKey: "admin_custom",
      messagePayload: { text: "targeted" },
      createdBy: "admin",
    });

    const botLike = {
      api: {
        sendMessage: vi.fn(),
      },
    };

    await dispatchNotificationById(botLike, "n-service-missing");

    expect(markNotificationFailedMock).toHaveBeenCalledWith(
      "n-service-missing",
      "missing_service_id",
    );
  });

  it("dispatches to service subscribers with existing user records only", async () => {
    getNotificationByIdMock.mockResolvedValueOnce({
      id: "n-subscribers",
      state: "pending",
      audience: "service_subscribers",
      userId: null,
      serviceId: "svc-1",
      messageKey: "subscription_reminder",
      messagePayload: { serviceTitle: "Service A" },
      createdBy: "admin",
    });
    listSubscribersByServiceMock.mockResolvedValueOnce([
      { userId: "u1" },
      { userId: "u2" },
    ]);
    getUserByIdMock.mockResolvedValueOnce({ id: "u1", telegramId: "111" });
    getUserByIdMock.mockResolvedValueOnce(null);

    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const botLike = {
      api: {
        sendMessage,
      },
    };

    await dispatchNotificationById(botLike, "n-subscribers");

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      "111",
      expect.stringContaining("expires in 3 days"),
    );
    expect(markNotificationSentMock).toHaveBeenCalledWith(
      "n-subscribers",
      null,
    );
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
