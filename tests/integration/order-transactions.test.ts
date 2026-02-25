import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  transactionMock,
  getOrderWithUserAndServiceMock,
  getReferralByInviteeMock,
  cancelPendingSubscriptionExpiryNotificationsMock,
  createAndScheduleNotificationMock,
  createAuditLogMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  getOrderWithUserAndServiceMock: vi.fn(),
  getReferralByInviteeMock: vi.fn(),
  cancelPendingSubscriptionExpiryNotificationsMock: vi.fn(),
  createAndScheduleNotificationMock: vi.fn(),
  createAuditLogMock: vi.fn(),
}));

vi.mock("../../src/db/client.js", () => ({
  db: {
    transaction: transactionMock,
  },
}));

vi.mock("../../src/db/repositories/orders.js", () => ({
  attachOrderProof: vi.fn(),
  createOrderDraft: vi.fn(),
  getOrderById: vi.fn(),
  getOrderWithUserAndService: getOrderWithUserAndServiceMock,
  markOrderDismissed: vi.fn(),
  setOrderAwaitingProof: vi.fn(),
  submitOrderWithoutProof: vi.fn(),
}));

vi.mock("../../src/db/repositories/referrals.js", () => ({
  getReferralByInvitee: getReferralByInviteeMock,
}));

vi.mock("../../src/db/repositories/notifications.js", () => ({
  cancelPendingSubscriptionExpiryNotifications:
    cancelPendingSubscriptionExpiryNotificationsMock,
}));

vi.mock("../../src/services/notifications.js", () => ({
  createAndScheduleNotification: createAndScheduleNotificationMock,
}));

vi.mock("../../src/db/repositories/audit.js", () => ({
  createAuditLog: createAuditLogMock,
}));

import { approveOrderByAdmin } from "../../src/services/orders.js";

type TxPlan = {
  updateReturns: unknown[][];
  selectReturns: unknown[][];
  insertReturns: unknown[][];
};

function createTx(plan: TxPlan) {
  let updateIdx = 0;
  let selectIdx = 0;
  let insertIdx = 0;

  return {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() =>
            Promise.resolve(plan.updateReturns[updateIdx++] ?? []),
          ),
        })),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() =>
              Promise.resolve(plan.selectReturns[selectIdx++] ?? []),
            ),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() =>
          Promise.resolve(plan.insertReturns[insertIdx++] ?? []),
        ),
      })),
    })),
  };
}

function setTransaction(tx: ReturnType<typeof createTx>) {
  transactionMock.mockImplementation(
    (callback: (tx: ReturnType<typeof createTx>) => Promise<unknown>) =>
      callback(tx),
  );
}

describe("order transactions", () => {
  beforeEach(() => {
    transactionMock.mockReset();
    getOrderWithUserAndServiceMock.mockReset();
    getReferralByInviteeMock.mockReset();
    cancelPendingSubscriptionExpiryNotificationsMock.mockReset();
    createAndScheduleNotificationMock.mockReset();
    createAuditLogMock.mockReset();
  });

  it("fails approval when order does not exist", async () => {
    getOrderWithUserAndServiceMock.mockResolvedValueOnce(null);

    await expect(approveOrderByAdmin("missing-order", "999")).rejects.toThrow(
      "Order not found",
    );
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("fails approval when order is not awaiting admin review", async () => {
    getOrderWithUserAndServiceMock.mockResolvedValueOnce({
      order: {
        id: "order-invalid",
        userId: "user-1",
        serviceId: "service-1",
        fieldProfileId: null,
        status: "approved",
        creditAmount: "0.00",
        discountCodeId: null,
        discountAmount: "0.00",
        discountedAmount: "100.00",
      },
      service: {
        id: "service-1",
        title: "Service A",
        durationDays: 30,
      },
      user: {
        id: "user-1",
        telegramId: "12345",
      },
    });

    await expect(approveOrderByAdmin("order-invalid", "999")).rejects.toThrow(
      "Order is not ready for admin approval",
    );
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("approves and extends existing matching active subscription", async () => {
    getOrderWithUserAndServiceMock.mockResolvedValueOnce({
      order: {
        id: "order-1",
        userId: "user-1",
        serviceId: "service-1",
        fieldProfileId: "profile-1",
        status: "awaiting_admin_review",
        creditAmount: "0.00",
        discountCodeId: null,
        discountAmount: "0.00",
        discountedAmount: "100.00",
      },
      service: {
        id: "service-1",
        title: "Service A",
        durationDays: 30,
      },
      user: {
        id: "user-1",
        telegramId: "12345",
      },
    });
    getReferralByInviteeMock.mockResolvedValueOnce(null);

    const approvedOrder = {
      id: "order-1",
      userId: "user-1",
      serviceId: "service-1",
      fieldProfileId: "profile-1",
      creditAmount: "0.00",
      discountCodeId: null,
      discountAmount: "0.00",
      discountedAmount: "100.00",
    };
    const existingSubscription = {
      id: "sub-1",
      startedAt: new Date("2030-01-01T00:00:00.000Z"),
      durationDays: 15,
    };
    const extendedSubscription = {
      id: "sub-1",
      durationDays: 45,
    };

    const tx = createTx({
      updateReturns: [[approvedOrder], [extendedSubscription]],
      selectReturns: [[existingSubscription]],
      insertReturns: [],
    });
    setTransaction(tx);

    const result = await approveOrderByAdmin("order-1", "999");

    expect(result.subscriptionId).toBe("sub-1");
    expect(
      cancelPendingSubscriptionExpiryNotificationsMock,
    ).toHaveBeenCalledWith({
      userId: "user-1",
      serviceId: "service-1",
    });
    expect(createAndScheduleNotificationMock).toHaveBeenCalledTimes(2);
  });

  it("approves and creates a new parallel subscription for different profile", async () => {
    getOrderWithUserAndServiceMock.mockResolvedValueOnce({
      order: {
        id: "order-2",
        userId: "user-2",
        serviceId: "service-1",
        fieldProfileId: "profile-2",
        status: "awaiting_admin_review",
        creditAmount: "0.00",
        discountCodeId: null,
        discountAmount: "0.00",
        discountedAmount: "50.00",
      },
      service: {
        id: "service-1",
        title: "Service A",
        durationDays: 20,
      },
      user: {
        id: "user-2",
        telegramId: "67890",
      },
    });
    getReferralByInviteeMock.mockResolvedValueOnce(null);

    const approvedOrder = {
      id: "order-2",
      userId: "user-2",
      serviceId: "service-1",
      fieldProfileId: "profile-2",
      creditAmount: "0.00",
      discountCodeId: null,
      discountAmount: "0.00",
      discountedAmount: "50.00",
    };
    const createdSubscription = {
      id: "sub-new",
      durationDays: 20,
    };

    const tx = createTx({
      updateReturns: [[approvedOrder]],
      selectReturns: [[]],
      insertReturns: [[createdSubscription]],
    });
    setTransaction(tx);

    const result = await approveOrderByAdmin("order-2", "999");

    expect(result.subscriptionId).toBe("sub-new");
    expect(createAndScheduleNotificationMock).toHaveBeenCalledTimes(2);
  });

  it("fails approval when order credit exceeds user wallet balance", async () => {
    getOrderWithUserAndServiceMock.mockResolvedValueOnce({
      order: {
        id: "order-credit",
        userId: "user-credit",
        serviceId: "service-1",
        fieldProfileId: null,
        status: "awaiting_admin_review",
        creditAmount: "10.00",
        discountCodeId: null,
        discountAmount: "0.00",
        discountedAmount: "50.00",
      },
      service: {
        id: "service-1",
        title: "Service A",
        durationDays: 10,
      },
      user: {
        id: "user-credit",
        telegramId: "4444",
      },
    });

    const approvedOrder = {
      id: "order-credit",
      userId: "user-credit",
      serviceId: "service-1",
      fieldProfileId: null,
      creditAmount: "10.00",
      discountCodeId: null,
      discountAmount: "0.00",
      discountedAmount: "50.00",
    };
    const tx = createTx({
      updateReturns: [[approvedOrder]],
      selectReturns: [[{ balanceAfter: "5.00" }]],
      insertReturns: [],
    });
    setTransaction(tx);

    await expect(approveOrderByAdmin("order-credit", "999")).rejects.toThrow(
      "Insufficient credit balance at approval time",
    );
    expect(createAndScheduleNotificationMock).not.toHaveBeenCalled();
  });

  it("skips reminder notification when expiry is too close", async () => {
    getOrderWithUserAndServiceMock.mockResolvedValueOnce({
      order: {
        id: "order-short",
        userId: "user-short",
        serviceId: "service-1",
        fieldProfileId: null,
        status: "awaiting_admin_review",
        creditAmount: "0.00",
        discountCodeId: null,
        discountAmount: "0.00",
        discountedAmount: "30.00",
      },
      service: {
        id: "service-1",
        title: "Service A",
        durationDays: 2,
      },
      user: {
        id: "user-short",
        telegramId: "5555",
      },
    });
    getReferralByInviteeMock.mockResolvedValueOnce(null);

    const approvedOrder = {
      id: "order-short",
      userId: "user-short",
      serviceId: "service-1",
      fieldProfileId: null,
      creditAmount: "0.00",
      discountCodeId: null,
      discountAmount: "0.00",
      discountedAmount: "30.00",
    };
    const tx = createTx({
      updateReturns: [[approvedOrder]],
      selectReturns: [[]],
      insertReturns: [[{ id: "sub-short", durationDays: 2 }]],
    });
    setTransaction(tx);

    await approveOrderByAdmin("order-short", "999");

    expect(createAndScheduleNotificationMock).toHaveBeenCalledTimes(1);
    expect(createAndScheduleNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messageKey: "subscription_ended",
      }),
    );
  });

  it("writes spend, discount redemption, and referral reward entries", async () => {
    getOrderWithUserAndServiceMock.mockResolvedValueOnce({
      order: {
        id: "order-full",
        userId: "buyer-1",
        serviceId: "service-1",
        fieldProfileId: null,
        status: "awaiting_admin_review",
        creditAmount: "2.00",
        discountCodeId: "discount-1",
        discountAmount: "5.00",
        discountedAmount: "100.00",
      },
      service: {
        id: "service-1",
        title: "Service A",
        durationDays: 15,
      },
      user: {
        id: "buyer-1",
        telegramId: "7777",
      },
    });
    getReferralByInviteeMock.mockResolvedValueOnce({
      id: "ref-1",
      inviterUserId: "inviter-1",
      inviteeUserId: "buyer-1",
    });

    const approvedOrder = {
      id: "order-full",
      userId: "buyer-1",
      serviceId: "service-1",
      fieldProfileId: null,
      creditAmount: "2.00",
      discountCodeId: "discount-1",
      discountAmount: "5.00",
      discountedAmount: "100.00",
    };
    const tx = createTx({
      updateReturns: [[approvedOrder]],
      selectReturns: [
        [{ balanceAfter: "10.00" }],
        [],
        [{ balanceAfter: "1.00" }],
      ],
      insertReturns: [[{ id: "sub-full", durationDays: 15 }]],
    });
    setTransaction(tx);

    const result = await approveOrderByAdmin("order-full", "999");

    expect(result.subscriptionId).toBe("sub-full");
    expect(tx.insert).toHaveBeenCalledTimes(4);
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "order.approve",
        entityId: "order-full",
      }),
    );
  });
});
