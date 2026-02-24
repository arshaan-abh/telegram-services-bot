import { describe, expect, it } from "vitest";

import {
  calculateOrderPricing,
  calculateReferralRewardMinor,
  evaluateDiscount,
} from "../../src/services/pricing.js";
import { dbMoneyToMinor } from "../../src/utils/db-money.js";

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
    const result = evaluateDiscount({
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
        perUserUsageLimit: 1,
        firstPurchaseOnly: false,
        isActive: true,
      },
      serviceScopedIds: ["svc_1"],
      serviceId: "svc_1",
      orderBaseMinor: dbMoneyToMinor("120.00"),
      now: new Date("2026-01-01"),
      usageCountTotal: 2,
      usageCountForUser: 0,
      userHasApprovedOrders: true,
    });

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
});
