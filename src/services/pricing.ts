import { env } from "../config/env.js";
import { dbMoneyToMinor } from "../utils/db-money.js";
import { clampMoney, percentOf } from "../utils/money.js";

type DiscountRuleLike = {
  id: string;
  code: string;
  type: "percent" | "fixed";
  amount: string;
  minOrderAmount: string | null;
  maxDiscountAmount: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  totalUsageLimit: number | null;
  perUserUsageLimit: number | null;
  firstPurchaseOnly: boolean;
  isActive: boolean;
};

export type DiscountEvaluationInput = {
  discount: DiscountRuleLike | null;
  serviceScopedIds: string[];
  serviceId: string;
  orderBaseMinor: bigint;
  now: Date;
  usageCountTotal: number;
  usageCountForUser: number;
  userHasApprovedOrders: boolean;
};

export type DiscountEvaluationResult =
  | {
      ok: true;
      discountMinor: bigint;
      reason: null;
    }
  | {
      ok: false;
      discountMinor: 0n;
      reason: DiscountRejectReason;
    };

export type DiscountRejectReason =
  | "discount_not_found"
  | "discount_inactive"
  | "discount_not_started"
  | "discount_expired"
  | "discount_service_scope"
  | "discount_min_order"
  | "discount_total_usage_limit"
  | "discount_user_usage_limit"
  | "discount_first_purchase_only";

export function discountReasonToMessageKey(
  reason: DiscountRejectReason,
): string {
  const map: Record<DiscountRejectReason, string> = {
    discount_not_found: "discount-reason-not-found",
    discount_inactive: "discount-reason-inactive",
    discount_not_started: "discount-reason-not-started",
    discount_expired: "discount-reason-expired",
    discount_service_scope: "discount-reason-service-scope",
    discount_min_order: "discount-reason-min-order",
    discount_total_usage_limit: "discount-reason-total-usage-limit",
    discount_user_usage_limit: "discount-reason-user-usage-limit",
    discount_first_purchase_only: "discount-reason-first-purchase-only",
  };

  return map[reason];
}

export function evaluateDiscount(
  input: DiscountEvaluationInput,
): DiscountEvaluationResult {
  const { discount } = input;
  if (!discount) {
    return { ok: false, discountMinor: 0n, reason: "discount_not_found" };
  }

  if (!discount.isActive) {
    return { ok: false, discountMinor: 0n, reason: "discount_inactive" };
  }

  if (discount.startsAt && input.now < discount.startsAt) {
    return { ok: false, discountMinor: 0n, reason: "discount_not_started" };
  }

  if (discount.endsAt && input.now > discount.endsAt) {
    return { ok: false, discountMinor: 0n, reason: "discount_expired" };
  }

  if (
    input.serviceScopedIds.length > 0 &&
    !input.serviceScopedIds.includes(input.serviceId)
  ) {
    return { ok: false, discountMinor: 0n, reason: "discount_service_scope" };
  }

  if (discount.minOrderAmount) {
    const minOrderMinor = dbMoneyToMinor(discount.minOrderAmount);
    if (input.orderBaseMinor < minOrderMinor) {
      return { ok: false, discountMinor: 0n, reason: "discount_min_order" };
    }
  }

  if (
    discount.totalUsageLimit !== null &&
    input.usageCountTotal >= discount.totalUsageLimit
  ) {
    return {
      ok: false,
      discountMinor: 0n,
      reason: "discount_total_usage_limit",
    };
  }

  if (
    discount.perUserUsageLimit !== null &&
    input.usageCountForUser >= discount.perUserUsageLimit
  ) {
    return {
      ok: false,
      discountMinor: 0n,
      reason: "discount_user_usage_limit",
    };
  }

  if (discount.firstPurchaseOnly && input.userHasApprovedOrders) {
    return {
      ok: false,
      discountMinor: 0n,
      reason: "discount_first_purchase_only",
    };
  }

  const amountMinor = dbMoneyToMinor(discount.amount);
  let calculatedDiscountMinor =
    discount.type === "percent"
      ? percentOf(input.orderBaseMinor, Number(discount.amount))
      : amountMinor;

  if (discount.maxDiscountAmount) {
    const capMinor = dbMoneyToMinor(discount.maxDiscountAmount);
    if (calculatedDiscountMinor > capMinor) {
      calculatedDiscountMinor = capMinor;
    }
  }

  if (calculatedDiscountMinor > input.orderBaseMinor) {
    calculatedDiscountMinor = input.orderBaseMinor;
  }

  calculatedDiscountMinor = clampMoney(calculatedDiscountMinor);

  return {
    ok: true,
    discountMinor: calculatedDiscountMinor,
    reason: null,
  };
}

export type PricingInput = {
  basePriceMinor: bigint;
  discountMinor: bigint;
  availableCreditMinor: bigint;
};

export type PricingResult = {
  basePriceMinor: bigint;
  discountMinor: bigint;
  discountedMinor: bigint;
  creditUsedMinor: bigint;
  payableMinor: bigint;
};

export function calculateOrderPricing(input: PricingInput): PricingResult {
  const clampedDiscount =
    input.discountMinor > input.basePriceMinor
      ? input.basePriceMinor
      : input.discountMinor;
  const discountedMinor = input.basePriceMinor - clampedDiscount;
  const creditUsedMinor =
    input.availableCreditMinor > discountedMinor
      ? discountedMinor
      : input.availableCreditMinor;
  const payableMinor = discountedMinor - creditUsedMinor;

  return {
    basePriceMinor: input.basePriceMinor,
    discountMinor: clampedDiscount,
    discountedMinor,
    creditUsedMinor,
    payableMinor,
  };
}

export function calculateReferralRewardMinor(
  discountedAmountMinor: bigint,
): bigint {
  return percentOf(discountedAmountMinor, env.REFERRAL_PERCENT);
}
