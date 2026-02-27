import { Conversation } from "@grammyjs/conversations";

import { redis } from "../../adapters/upstash.js";
import { env } from "../../config/env.js";
import { getCreditBalance } from "../../db/repositories/credits.js";
import {
  getDiscountByCode,
  getDiscountServiceScope,
  getDiscountUsageCounts,
} from "../../db/repositories/discounts.js";
import {
  getLatestFieldProfile,
  upsertFieldProfile,
} from "../../db/repositories/profiles.js";
import { hasApprovedOrder } from "../../db/repositories/referrals.js";
import { getServiceById } from "../../db/repositories/services.js";
import { reserveIdempotencyKey } from "../../security/idempotency.js";
import { checkRateLimit } from "../../security/rate-limit.js";
import {
  createDraftPurchaseOrder,
  submitOrderProof,
} from "../../services/orders.js";
import {
  calculateOrderPricing,
  discountReasonToMessageKey,
  type DiscountRejectReason,
  evaluateDiscount,
} from "../../services/pricing.js";
import { validateProofMedia } from "../../services/proof-validation.js";
import { dbMoneyToMinor, minorToDbMoney } from "../../utils/db-money.js";
import { checksum } from "../../utils/hash.js";
import { decodeRedisJson } from "../../utils/redis-json.js";
import { normalizeDiscountCode } from "../../utils/telegram.js";
import type { BotContext } from "../context.js";
import { notifyAdminOrderQueued } from "../handlers/admin.js";

function stringifyNeededValues(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");
}

async function waitForText(
  conversation: Conversation<BotContext, BotContext>,
): Promise<string> {
  const update = await conversation.waitFor(":text");
  if (!update.message || !("text" in update.message)) {
    await update.reply(update.t("error-generic"));
    return "";
  }

  return update.message.text.trim();
}

type CachedDiscountDecision =
  | {
      ok: true;
      discountMinor: string;
      discountCodeId: string | null;
      discountCodeText: string | null;
    }
  | {
      ok: false;
      reason: DiscountRejectReason;
    };

export async function buyConversation(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
  serviceId: string,
): Promise<void> {
  if (!ctx.dbUserId) {
    await ctx.reply(ctx.t("error-generic"));
    return;
  }

  const service = await conversation.external(() => getServiceById(serviceId));
  if (!service || !service.isActive) {
    await ctx.reply(ctx.t("services-empty"));
    return;
  }

  await ctx.reply(ctx.t("buy-start"));

  const latestProfile = await conversation.external(() =>
    getLatestFieldProfile(ctx.dbUserId!, service.id),
  );

  const neededValues: Record<string, string> = latestProfile
    ? { ...latestProfile.values }
    : {};

  if (!latestProfile) {
    for (const field of service.neededFields) {
      await ctx.reply(ctx.t("buy-enter-field", { field }));
      let value = "";
      while (value.length === 0) {
        const text = await waitForText(conversation);
        if (text.length > 0) {
          value = text;
        } else {
          await ctx.reply(ctx.t("error-generic"));
        }
      }
      neededValues[field] = value;
    }
  }

  let confirmed = false;
  while (!confirmed) {
    await ctx.reply(
      `${ctx.t("buy-confirm-values")}\n${stringifyNeededValues(neededValues)}`,
    );
    await ctx.reply(ctx.t("buy-confirm-ok"));
    const answer = (await waitForText(conversation)).toLowerCase();

    if (["yes", "y", "ok", "confirm", "بله", "اره"].includes(answer)) {
      confirmed = true;
      continue;
    }

    await ctx.reply(ctx.t("buy-edit-ask"));
    const fieldToEdit = await waitForText(conversation);

    if (!service.neededFields.includes(fieldToEdit)) {
      await ctx.reply(ctx.t("error-generic"));
      continue;
    }

    await ctx.reply(ctx.t("buy-enter-field", { field: fieldToEdit }));
    const newValue = await waitForText(conversation);
    neededValues[fieldToEdit] = newValue;
  }

  let discountCodeId: string | null = null;
  let discountCodeText: string | null = null;
  let discountMinor = 0n;

  await ctx.reply(ctx.t("buy-discount-ask"));
  const discountInput = await waitForText(conversation);
  if (discountInput.toUpperCase() !== "SKIP") {
    const discountKey = `discount:${ctx.from?.id ?? "unknown"}`;
    const rate = await conversation.external(() =>
      checkRateLimit("discount", discountKey),
    );
    if (!rate.success) {
      await ctx.reply(ctx.t("rate-limit"));
    } else {
      const normalizedCode = normalizeDiscountCode(discountInput);
      const discountAttemptChecksum = checksum({
        userId: ctx.dbUserId,
        serviceId: service.id,
        normalizedCode,
        neededValues,
        basePrice: service.price,
      });
      const lockKey = `discount:apply:lock:${discountAttemptChecksum}`;
      const resultKey = `discount:apply:result:${discountAttemptChecksum}`;

      let cachedDecision: CachedDiscountDecision | null = null;
      const reserved = await conversation.external(() =>
        reserveIdempotencyKey(lockKey, 1800),
      );
      if (!reserved) {
        const cachedRaw = await conversation.external(() =>
          redis.get<unknown>(resultKey),
        );
        cachedDecision = decodeRedisJson<CachedDiscountDecision>(cachedRaw);
      }

      if (cachedDecision) {
        if (cachedDecision.ok) {
          discountMinor = BigInt(cachedDecision.discountMinor);
          discountCodeId = cachedDecision.discountCodeId;
          discountCodeText = cachedDecision.discountCodeText;
          await ctx.reply(
            ctx.t("buy-discount-applied", {
              amount: minorToDbMoney(discountMinor),
              unit: env.PRICE_UNIT,
            }),
          );
        } else {
          await ctx.reply(
            ctx.t("buy-discount-invalid", {
              reason: ctx.t(discountReasonToMessageKey(cachedDecision.reason)),
            }),
          );
        }
      } else {
        const discount = await conversation.external(() =>
          getDiscountByCode(normalizedCode),
        );
        const scopeIds = discount
          ? await conversation.external(() =>
              getDiscountServiceScope(discount.id),
            )
          : [];
        const usage = discount
          ? await conversation.external(() =>
              getDiscountUsageCounts(discount.id, ctx.dbUserId!),
            )
          : { total: 0, user: 0 };
        const userHasApprovedOrders = await conversation.external(() =>
          hasApprovedOrder(ctx.dbUserId!),
        );

        const discountEval = evaluateDiscount({
          discount,
          serviceScopedIds: scopeIds,
          serviceId: service.id,
          orderBaseMinor: dbMoneyToMinor(service.price),
          now: new Date(),
          usageCountTotal: usage.total,
          usageCountForUser: usage.user,
          userHasApprovedOrders,
        });

        if (discountEval.ok) {
          discountMinor = discountEval.discountMinor;
          discountCodeId = discount?.id ?? null;
          discountCodeText = discount?.code ?? null;
          await conversation.external(() =>
            redis.set(
              resultKey,
              JSON.stringify({
                ok: true,
                discountMinor: discountEval.discountMinor.toString(),
                discountCodeId,
                discountCodeText,
              } as CachedDiscountDecision),
              { ex: 1800 },
            ),
          );
          await ctx.reply(
            ctx.t("buy-discount-applied", {
              amount: minorToDbMoney(discountEval.discountMinor),
              unit: env.PRICE_UNIT,
            }),
          );
        } else {
          await conversation.external(() =>
            redis.set(
              resultKey,
              JSON.stringify({
                ok: false,
                reason: discountEval.reason,
              } as CachedDiscountDecision),
              { ex: 1800 },
            ),
          );
          await ctx.reply(
            ctx.t("buy-discount-invalid", {
              reason: ctx.t(discountReasonToMessageKey(discountEval.reason)),
            }),
          );
        }
      }
    }
  }

  const creditBalance = await conversation.external(() =>
    getCreditBalance(ctx.dbUserId!),
  );
  const pricing = calculateOrderPricing({
    basePriceMinor: dbMoneyToMinor(service.price),
    discountMinor,
    availableCreditMinor: dbMoneyToMinor(creditBalance),
  });

  await ctx.reply(
    ctx.t("buy-pricing", {
      base: minorToDbMoney(pricing.basePriceMinor),
      discount: minorToDbMoney(pricing.discountMinor),
      credit: minorToDbMoney(pricing.creditUsedMinor),
      payable: minorToDbMoney(pricing.payableMinor),
      unit: env.PRICE_UNIT,
    }),
  );

  const profile = await conversation.external(() =>
    upsertFieldProfile(ctx.dbUserId!, service.id, neededValues),
  );
  if (!profile) {
    await ctx.reply(ctx.t("error-generic"));
    return;
  }

  const order = await conversation.external(() =>
    createDraftPurchaseOrder({
      userId: ctx.dbUserId!,
      serviceId: service.id,
      fieldProfileId: profile.id,
      neededFieldValues: neededValues,
      basePrice: minorToDbMoney(pricing.basePriceMinor),
      discountAmount: minorToDbMoney(pricing.discountMinor),
      creditAmount: minorToDbMoney(pricing.creditUsedMinor),
      payableAmount: minorToDbMoney(pricing.payableMinor),
      discountedAmount: minorToDbMoney(pricing.discountedMinor),
      discountCodeId,
      discountCodeText,
    }),
  );

  if (pricing.payableMinor > 0n) {
    await ctx.reply(
      ctx.t("buy-proof-required", {
        card: env.CARD_NUMBER,
      }),
    );

    while (true) {
      const update = await conversation.wait();
      if (!update.message) {
        continue;
      }

      const proofKey = `proof:${ctx.from?.id ?? "unknown"}`;
      const proofRate = await conversation.external(() =>
        checkRateLimit("proof", proofKey),
      );
      if (!proofRate.success) {
        await update.reply(ctx.t("rate-limit"));
        continue;
      }

      const proof = validateProofMedia(update.message);
      if (!proof.ok) {
        if (proof.reason === "too_large") {
          await update.reply(ctx.t("buy-proof-too-large"));
        } else {
          await update.reply(ctx.t("buy-proof-invalid"));
        }
        continue;
      }

      await conversation.external(() =>
        submitOrderProof(order.id, {
          fileId: proof.fileId,
          mimeType: proof.mimeType,
          sizeBytes: proof.sizeBytes,
        }),
      );

      await update.reply(ctx.t("buy-proof-saved"));
      break;
    }
  } else {
    await ctx.reply(ctx.t("buy-zero-payable"));
  }

  await conversation.external(() => notifyAdminOrderQueued(ctx, order.id));
  await ctx.reply(ctx.t("order-sent-admin"));
}
