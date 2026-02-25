import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  attachOrderProofMock,
  cancelPendingSubscriptionExpiryNotificationsMock,
  createAndScheduleNotificationMock,
  createAuditLogMock,
  createOrderDraftMock,
  getOrderByIdMock,
  getOrderWithUserAndServiceMock,
  getReferralByInviteeMock,
  markOrderDismissedMock,
  setOrderAwaitingProofMock,
  submitOrderWithoutProofMock,
  transactionMock,
} = vi.hoisted(() => ({
  attachOrderProofMock: vi.fn(),
  cancelPendingSubscriptionExpiryNotificationsMock: vi.fn(),
  createAndScheduleNotificationMock: vi.fn(),
  createAuditLogMock: vi.fn(),
  createOrderDraftMock: vi.fn(),
  getOrderByIdMock: vi.fn(),
  getOrderWithUserAndServiceMock: vi.fn(),
  getReferralByInviteeMock: vi.fn(),
  markOrderDismissedMock: vi.fn(),
  setOrderAwaitingProofMock: vi.fn(),
  submitOrderWithoutProofMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("../../src/db/client.js", () => ({
  db: {
    transaction: transactionMock,
  },
}));

vi.mock("../../src/db/repositories/audit.js", () => ({
  createAuditLog: createAuditLogMock,
}));

vi.mock("../../src/db/repositories/notifications.js", () => ({
  cancelPendingSubscriptionExpiryNotifications:
    cancelPendingSubscriptionExpiryNotificationsMock,
}));

vi.mock("../../src/db/repositories/orders.js", () => ({
  attachOrderProof: attachOrderProofMock,
  createOrderDraft: createOrderDraftMock,
  getOrderById: getOrderByIdMock,
  getOrderWithUserAndService: getOrderWithUserAndServiceMock,
  markOrderDismissed: markOrderDismissedMock,
  setOrderAwaitingProof: setOrderAwaitingProofMock,
  submitOrderWithoutProof: submitOrderWithoutProofMock,
}));

vi.mock("../../src/db/repositories/referrals.js", () => ({
  getReferralByInvitee: getReferralByInviteeMock,
}));

vi.mock("../../src/services/notifications.js", () => ({
  createAndScheduleNotification: createAndScheduleNotificationMock,
}));

import {
  createDraftPurchaseOrder,
  dismissOrderByAdmin,
  shouldExtendExistingSubscription,
  submitOrderProof,
} from "../../src/services/orders.js";

describe("orders service (non-transactional paths)", () => {
  beforeEach(() => {
    attachOrderProofMock.mockReset();
    cancelPendingSubscriptionExpiryNotificationsMock.mockReset();
    createAndScheduleNotificationMock.mockReset();
    createAuditLogMock.mockReset();
    createOrderDraftMock.mockReset();
    getOrderByIdMock.mockReset();
    getOrderWithUserAndServiceMock.mockReset();
    getReferralByInviteeMock.mockReset();
    markOrderDismissedMock.mockReset();
    setOrderAwaitingProofMock.mockReset();
    submitOrderWithoutProofMock.mockReset();
    transactionMock.mockReset();
  });

  it("detects whether an active subscription should be extended", () => {
    expect(
      shouldExtendExistingSubscription(
        new Date("2026-02-02T00:00:00.000Z"),
        new Date("2026-02-01T23:59:59.999Z"),
      ),
    ).toBe(true);
    expect(
      shouldExtendExistingSubscription(
        new Date("2026-02-01T00:00:00.000Z"),
        new Date("2026-02-01T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("creates payable drafts in awaiting_proof status", async () => {
    createOrderDraftMock.mockResolvedValueOnce({
      id: "order-1",
      payableAmount: "15.00",
    });
    getOrderByIdMock.mockResolvedValueOnce({
      id: "order-1",
      status: "awaiting_proof",
    });

    const result = await createDraftPurchaseOrder({
      userId: "user-1",
      serviceId: "service-1",
      fieldProfileId: null,
      neededFieldValues: { username: "alice" },
      basePrice: "20.00",
      discountAmount: "0.00",
      creditAmount: "5.00",
      payableAmount: "15.00",
      discountedAmount: "20.00",
      discountCodeId: null,
      discountCodeText: null,
    });

    expect(setOrderAwaitingProofMock).toHaveBeenCalledWith("order-1");
    expect(submitOrderWithoutProofMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: "order-1",
      status: "awaiting_proof",
    });
  });

  it("creates zero-payable drafts directly in admin review queue", async () => {
    createOrderDraftMock.mockResolvedValueOnce({
      id: "order-2",
      payableAmount: "0.00",
    });
    getOrderByIdMock.mockResolvedValueOnce({
      id: "order-2",
      status: "awaiting_admin_review",
    });

    const result = await createDraftPurchaseOrder({
      userId: "user-1",
      serviceId: "service-1",
      fieldProfileId: "profile-1",
      neededFieldValues: { username: "alice" },
      basePrice: "10.00",
      discountAmount: "10.00",
      creditAmount: "0.00",
      payableAmount: "0.00",
      discountedAmount: "0.00",
      discountCodeId: "discount-1",
      discountCodeText: "FREE",
    });

    expect(submitOrderWithoutProofMock).toHaveBeenCalledWith("order-2");
    expect(setOrderAwaitingProofMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: "order-2",
      status: "awaiting_admin_review",
    });
  });

  it("fails draft creation when order cannot be reloaded", async () => {
    createOrderDraftMock.mockResolvedValueOnce({
      id: "order-3",
      payableAmount: "0.00",
    });
    getOrderByIdMock.mockResolvedValueOnce(null);

    await expect(
      createDraftPurchaseOrder({
        userId: "user-1",
        serviceId: "service-1",
        fieldProfileId: null,
        neededFieldValues: {},
        basePrice: "10.00",
        discountAmount: "0.00",
        creditAmount: "0.00",
        payableAmount: "0.00",
        discountedAmount: "10.00",
        discountCodeId: null,
        discountCodeText: null,
      }),
    ).rejects.toThrow("Failed to save order");
  });

  it("accepts proof only for orders awaiting proof", async () => {
    getOrderByIdMock.mockResolvedValueOnce({
      id: "order-4",
      status: "awaiting_proof",
    });
    attachOrderProofMock.mockResolvedValueOnce({
      id: "order-4",
      status: "awaiting_admin_review",
    });

    const result = await submitOrderProof("order-4", {
      fileId: "f-1",
      mimeType: "image/png",
      sizeBytes: 123,
    });

    expect(attachOrderProofMock).toHaveBeenCalledWith("order-4", {
      proofFileId: "f-1",
      proofMime: "image/png",
      proofSizeBytes: 123,
    });
    expect(result).toEqual({
      id: "order-4",
      status: "awaiting_admin_review",
    });
  });

  it("rejects proof when order is not awaiting proof", async () => {
    getOrderByIdMock.mockResolvedValueOnce({
      id: "order-5",
      status: "draft",
    });

    await expect(
      submitOrderProof("order-5", {
        fileId: "f-2",
        mimeType: "image/jpeg",
        sizeBytes: null,
      }),
    ).rejects.toThrow("Order is not waiting for proof");
  });

  it("fails proof submission when attachment update fails", async () => {
    getOrderByIdMock.mockResolvedValueOnce({
      id: "order-6",
      status: "awaiting_proof",
    });
    attachOrderProofMock.mockResolvedValueOnce(null);

    await expect(
      submitOrderProof("order-6", {
        fileId: "f-3",
        mimeType: "image/webp",
        sizeBytes: null,
      }),
    ).rejects.toThrow("Failed to submit proof");
  });

  it("dismisses order and records audit metadata", async () => {
    markOrderDismissedMock.mockResolvedValueOnce({
      id: "order-7",
      status: "dismissed",
    });

    const result = await dismissOrderByAdmin(
      "order-7",
      "999999",
      "Payment proof mismatch",
    );

    expect(result).toEqual({
      id: "order-7",
      status: "dismissed",
    });
    expect(createAuditLogMock).toHaveBeenCalledWith({
      actorTelegramId: "999999",
      action: "order.dismiss",
      entityType: "order",
      entityId: "order-7",
      metadata: {
        reason: "Payment proof mismatch",
      },
    });
  });

  it("fails dismissal for unknown order id", async () => {
    markOrderDismissedMock.mockResolvedValueOnce(null);

    await expect(
      dismissOrderByAdmin("missing-order", "999999", "reason"),
    ).rejects.toThrow("Order not found");
  });
});
