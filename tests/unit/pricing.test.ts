import { describe, expect, it } from "vitest";

import {
  calculateOrderPricing,
  calculateReferralRewardMinor,
  discountReasonToMessageKey,
  evaluateDiscount,
  type DiscountEvaluationInput,
} from "../../src/services/pricing.js";
import { dbMoneyToMinor } from "../../src/utils/db-money.js";

function baseDiscountInput(): DiscountEvaluationInput {
  return {
    discount: {
      id: "d1",
      code: "OFF20",
      type: "percent",
      amount: "20",
      minOrderAmount: "100.00",
      maxDiscountAmount: "15.00",
      startsAt: new Date("2020-01-01"),
      endsAt: new Date("2030-01-01"),
      totalUsageLimit: 10,
      perUserUsageLimit: 2,
      firstPurchaseOnly: false,
      isActive: true,
    },
    serviceScopedIds: ["svc_1"],
    serviceId: "svc_1",
    orderBaseMinor: dbMoneyToMinor("120.00"),
    now: new Date("2026-01-01"),
    usageCountTotal: 2,
    usageCountForUser: 0,
    userHasApprovedOrders: false,
  };
}

describe("pricing", () => {
  it("applies discount first then credit", () => {
    const result = calculateOrderPricing({
      basePriceMinor: dbMoneyToMinor("100.00"),
      discountMinor: dbMoneyToMinor("20.00"),
      availableCreditMinor: dbMoneyToMinor("50.00"),
    });

    expect(result.discountedMinor).toBe(dbMoneyToMinor("80.00"));
    expect(result.creditUsedMinor).toBe(dbMoneyToMinor("50.00"));
    expect(result.payableMinor).toBe(dbMoneyToMinor("30.00"));
  });

  it("clamps payable at zero when credit exceeds discounted amount", () => {
    const result = calculateOrderPricing({
      basePriceMinor: dbMoneyToMinor("10.00"),
      discountMinor: dbMoneyToMinor("5.00"),
      availableCreditMinor: dbMoneyToMinor("20.00"),
    });

    expect(result.creditUsedMinor).toBe(dbMoneyToMinor("5.00"));
    expect(result.payableMinor).toBe(0n);
  });

  it("validates advanced discount constraints", () => {
    const result = evaluateDiscount(baseDiscountInput());

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.discountMinor).toBe(dbMoneyToMinor("15.00"));
  });

  it("calculates referral reward from discounted amount", () => {
    const reward = calculateReferralRewardMinor(dbMoneyToMinor("200.00"));
    expect(reward).toBe(dbMoneyToMinor("20.00"));
  });

  it("maps discount rejection reasons to stable message keys", () => {
    expect(discountReasonToMessageKey("discount_not_found")).toBe(
      "discount-reason-not-found",
    );
    expect(discountReasonToMessageKey("discount_service_scope")).toBe(
      "discount-reason-service-scope",
    );
  });

  it("applies deterministic rounding (minor-unit truncation) for percent discount", () => {
    const result = evaluateDiscount({
      ...baseDiscountInput(),
      discount: {
        ...baseDiscountInput().discount!,
        amount: "17",
        minOrderAmount: null,
        maxDiscountAmount: null,
      },
      orderBaseMinor: dbMoneyToMinor("12.34"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.discountMinor).toBe(dbMoneyToMinor("2.09"));
  });

  it("rejects when discount is not found", () => {
    const result = evaluateDiscount({
      ...baseDiscountInput(),
      discount: null,
    });

    expect(result).toEqual({
      ok: false,
      discountMinor: 0n,
      reason: "discount_not_found",
    });
  });

  it("rejects inactive discount before other checks", () => {
    const input = baseDiscountInput();
    const result = evaluateDiscount({
      ...input,
      discount: {
        ...input.discount!,
        isActive: false,
      },
      usageCountTotal: 99,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("discount_inactive");
    }
  });

  it("rejects when current time is before start date", () => {
    const input = baseDiscountInput();
    const result = evaluateDiscount({
      ...input,
      now: new Date("2010-01-01"),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("discount_not_started");
    }
  });

  it("rejects when current time is after end date", () => {
    const input = baseDiscountInput();
    const result = evaluateDiscount({
      ...input,
      now: new Date("2040-01-01"),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("discount_expired");
    }
  });

  it("rejects when service is out of scope", () => {
    const input = baseDiscountInput();
    const result = evaluateDiscount({
      ...input,
      serviceId: "svc_2",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("discount_service_scope");
    }
  });

  it("rejects when order is below minimum", () => {
    const input = baseDiscountInput();
    const result = evaluateDiscount({
      ...input,
      orderBaseMinor: dbMoneyToMinor("99.99"),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("discount_min_order");
    }
  });

  it("rejects when total usage limit is reached", () => {
    const input = baseDiscountInput();
    const result = evaluateDiscount({
      ...input,
      usageCountTotal: 10,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("discount_total_usage_limit");
    }
  });

  it("rejects when per-user usage limit is reached", () => {
    const input = baseDiscountInput();
    const result = evaluateDiscount({
      ...input,
      usageCountForUser: 2,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("discount_user_usage_limit");
    }
  });

  it("rejects first-purchase-only code for returning users", () => {
    const input = baseDiscountInput();
    const result = evaluateDiscount({
      ...input,
      discount: {
        ...input.discount!,
        firstPurchaseOnly: true,
      },
      userHasApprovedOrders: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("discount_first_purchase_only");
    }
  });
});
