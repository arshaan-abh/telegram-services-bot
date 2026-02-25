import { describe, expect, it } from "vitest";

import {
  ALLOWED_PROOF_MIME,
  AUDIT_ACTIONS,
  CALLBACKS,
  CALLBACK_VERSION,
  CREDIT_TYPES,
  DISCOUNT_TYPES,
  NOTIFICATION_STATES,
  ORDER_STATUSES,
  REMINDER_DAYS_BEFORE_EXPIRY,
  SUBSCRIPTION_STATUSES,
} from "../../src/config/constants.js";

describe("constants", () => {
  it("builds versioned callback payloads", () => {
    expect(CALLBACK_VERSION).toBe("v1");
    expect(CALLBACKS.servicesList(2)).toBe("v1:svc:list:2");
    expect(CALLBACKS.serviceView("svc-1")).toBe("v1:svc:view:svc-1");
    expect(CALLBACKS.serviceBuy("svc-2")).toBe("v1:svc:buy:svc-2");
    expect(CALLBACKS.adminOrderView("order-1")).toBe(
      "v1:admin:order:view:order-1",
    );
    expect(CALLBACKS.adminOrderDone("order-1")).toBe(
      "v1:admin:order:done:order-1",
    );
    expect(CALLBACKS.adminOrderDismiss("order-1")).toBe(
      "v1:admin:order:dismiss:order-1",
    );
    expect(CALLBACKS.adminOrderContact("order-1")).toBe(
      "v1:admin:order:contact:order-1",
    );
    expect(CALLBACKS.notifyDismiss("notif-1")).toBe(
      "v1:notify:dismiss:notif-1",
    );
  });

  it("exposes status and type constants used by domain logic", () => {
    expect(ORDER_STATUSES).toEqual({
      draft: "draft",
      awaitingProof: "awaiting_proof",
      awaitingAdminReview: "awaiting_admin_review",
      approved: "approved",
      dismissed: "dismissed",
      cancelled: "cancelled",
    });

    expect(SUBSCRIPTION_STATUSES).toEqual({
      active: "active",
      expired: "expired",
    });

    expect(NOTIFICATION_STATES).toEqual({
      pending: "pending",
      sent: "sent",
      failed: "failed",
      cancelled: "cancelled",
    });

    expect(DISCOUNT_TYPES).toEqual({
      percent: "percent",
      fixed: "fixed",
    });

    expect(CREDIT_TYPES).toEqual({
      referralReward: "referral_reward",
      spend: "spend",
      adminAdjustment: "admin_adjustment",
    });

    expect(AUDIT_ACTIONS.notificationSend).toBe("notification.send");
    expect(ALLOWED_PROOF_MIME).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    expect(REMINDER_DAYS_BEFORE_EXPIRY).toBe(3);
  });
});
