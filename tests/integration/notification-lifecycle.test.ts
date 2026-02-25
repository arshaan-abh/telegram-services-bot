import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAuditLogMock,
  getNotificationByIdMock,
  markNotificationFailedMock,
  markNotificationSentMock,
  getUserByIdMock,
} = vi.hoisted(() => ({
  createAuditLogMock: vi.fn(),
  getNotificationByIdMock: vi.fn(),
  markNotificationFailedMock: vi.fn(),
  markNotificationSentMock: vi.fn(),
  getUserByIdMock: vi.fn(),
}));

vi.mock("../../src/db/repositories/audit.js", () => ({
  createAuditLog: createAuditLogMock,
}));

vi.mock("../../src/db/repositories/notifications.js", () => ({
  cancelNotification: vi.fn(),
  createNotification: vi.fn(),
  findNotificationByIdempotencyKey: vi.fn(),
  getNotificationById: getNotificationByIdMock,
  markNotificationFailed: markNotificationFailedMock,
  markNotificationSent: markNotificationSentMock,
  cancelPendingSubscriptionExpiryNotifications: vi.fn(),
}));

vi.mock("../../src/db/repositories/users.js", () => ({
  getUserById: getUserByIdMock,
  listAllUsers: vi.fn(),
}));

vi.mock("../../src/db/repositories/subscriptions.js", () => ({
  listSubscribersByService: vi.fn(),
}));

import { dispatchNotificationById } from "../../src/services/notifications.js";

describe("notification lifecycle", () => {
  beforeEach(() => {
    createAuditLogMock.mockReset();
    getNotificationByIdMock.mockReset();
    markNotificationFailedMock.mockReset();
    markNotificationSentMock.mockReset();
    getUserByIdMock.mockReset();
  });

  it("transitions pending notification to sent", async () => {
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

    const sendMessage = vi.fn().mockResolvedValueOnce({});
    await dispatchNotificationById({ api: { sendMessage } }, "n1", {
      retryCount: 0,
      qstashMessageId: "msg-1",
    });

    expect(markNotificationSentMock).toHaveBeenCalledWith("n1", "msg-1");
    expect(markNotificationFailedMock).not.toHaveBeenCalled();
  });

  it("transitions pending notification to failed with retry metadata on send error", async () => {
    getNotificationByIdMock.mockResolvedValueOnce({
      id: "n2",
      state: "pending",
      audience: "user",
      userId: "u2",
      serviceId: null,
      messageKey: "admin_custom",
      messagePayload: { text: "hello" },
      createdBy: "admin",
    });
    getUserByIdMock.mockResolvedValueOnce({
      id: "u2",
      telegramId: "99999",
    });

    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error("network_error"));
    await dispatchNotificationById({ api: { sendMessage } }, "n2", {
      retryCount: 3,
      qstashMessageId: "msg-2",
    });

    expect(markNotificationFailedMock).toHaveBeenCalledTimes(1);
    const reason = markNotificationFailedMock.mock.calls[0]?.[1] as string;
    expect(reason).toContain("retry=3");
    expect(reason).toContain("network_error");
  });
});
