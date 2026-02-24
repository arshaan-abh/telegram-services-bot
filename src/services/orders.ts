import { and, desc, eq } from "drizzle-orm";

import { REMINDER_DAYS_BEFORE_EXPIRY } from "../config/constants.js";
import { env } from "../config/env.js";
import { db } from "../db/client.js";
import { createAuditLog } from "../db/repositories/audit.js";
import {
  attachOrderProof,
  createOrderDraft,
  getOrderById,
  getOrderWithUserAndService,
  markOrderDismissed,
  setOrderAwaitingProof,
  submitOrderWithoutProof,
} from "../db/repositories/orders.js";
import { getReferralByInvitee } from "../db/repositories/referrals.js";
import {
  creditLedger,
  discountRedemptions,
  orders,
  subscriptions,
} from "../db/schema.js";
import { calculateSubscriptionEnd } from "../utils/date.js";
import { dbMoneyToMinor, minorToDbMoney } from "../utils/db-money.js";
import { createAndScheduleNotification } from "./notifications.js";
import { calculateReferralRewardMinor } from "./pricing.js";

export function shouldExtendExistingSubscription(
  existingEnd: Date,
  now: Date,
): boolean {
  return existingEnd > now;
}

export async function createDraftPurchaseOrder(input: {
  userId: string;
  serviceId: string;
  fieldProfileId: string | null;
  neededFieldValues: Record<string, string>;
  basePrice: string;
  discountAmount: string;
  creditAmount: string;
  payableAmount: string;
  discountedAmount: string;
  discountCodeId: string | null;
  discountCodeText: string | null;
}) {
  const order = await createOrderDraft({
    userId: input.userId,
    serviceId: input.serviceId,
    fieldProfileId: input.fieldProfileId,
    neededFieldValues: input.neededFieldValues,
    basePrice: input.basePrice,
    discountAmount: input.discountAmount,
    creditAmount: input.creditAmount,
    payableAmount: input.payableAmount,
    discountedAmount: input.discountedAmount,
    discountCodeId: input.discountCodeId,
    discountCodeText: input.discountCodeText,
  });

  if (dbMoneyToMinor(order.payableAmount) > 0n) {
    await setOrderAwaitingProof(order.id);
  } else {
    await submitOrderWithoutProof(order.id);
  }

  const saved = await getOrderById(order.id);
  if (!saved) {
    throw new Error("Failed to save order");
  }

  return saved;
}

export async function submitOrderProof(
  orderId: string,
  proof: { fileId: string; mimeType: string; sizeBytes: number | null },
) {
  const order = await getOrderById(orderId);
  if (!order || order.status !== "awaiting_proof") {
    throw new Error("Order is not waiting for proof");
  }

  const updated = await attachOrderProof(orderId, {
    proofFileId: proof.fileId,
    proofMime: proof.mimeType,
    proofSizeBytes: proof.sizeBytes,
  });

  if (!updated) {
    throw new Error("Failed to submit proof");
  }

  return updated;
}

export async function dismissOrderByAdmin(
  orderId: string,
  adminTelegramId: string,
  reason: string,
) {
  const order = await markOrderDismissed(orderId, adminTelegramId, reason);
  if (!order) {
    throw new Error("Order not found");
  }

  await createAuditLog({
    actorTelegramId: adminTelegramId,
    action: "order.dismiss",
    entityType: "order",
    entityId: orderId,
    metadata: {
      reason,
    },
  });

  return order;
}

export async function approveOrderByAdmin(
  orderId: string,
  adminTelegramId: string,
) {
  const context = await getOrderWithUserAndService(orderId);
  if (!context) {
    throw new Error("Order not found");
  }

  if (context.order.status !== "awaiting_admin_review") {
    throw new Error("Order is not ready for admin approval");
  }

  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const approvedRows = await tx
      .update(orders)
      .set({
        status: "approved",
        approvedAt: now,
        adminActionBy: adminTelegramId,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId))
      .returning();

    const approvedOrder = approvedRows[0];
    if (!approvedOrder) {
      throw new Error("Failed to approve order");
    }

    const creditUsedMinor = dbMoneyToMinor(approvedOrder.creditAmount);
    if (creditUsedMinor > 0n) {
      const balanceRows = await tx
        .select({ balanceAfter: creditLedger.balanceAfter })
        .from(creditLedger)
        .where(eq(creditLedger.userId, approvedOrder.userId))
        .orderBy(desc(creditLedger.createdAt))
        .limit(1);

      const currentBalanceMinor = dbMoneyToMinor(
        balanceRows[0]?.balanceAfter ?? "0.00",
      );
      if (currentBalanceMinor < creditUsedMinor) {
        throw new Error("Insufficient credit balance at approval time");
      }

      const newBalance = currentBalanceMinor - creditUsedMinor;

      await tx.insert(creditLedger).values({
        userId: approvedOrder.userId,
        type: "spend",
        amount: minorToDbMoney(-creditUsedMinor),
        balanceAfter: minorToDbMoney(newBalance),
        orderId: approvedOrder.id,
        note: "Credit used for order",
        createdBy: adminTelegramId,
      });
    }

    let subscriptionId: string;
    const existingByProfile =
      approvedOrder.fieldProfileId === null
        ? null
        : ((
            await tx
              .select()
              .from(subscriptions)
              .where(
                and(
                  eq(subscriptions.userId, approvedOrder.userId),
                  eq(subscriptions.serviceId, approvedOrder.serviceId),
                  eq(
                    subscriptions.fieldProfileId,
                    approvedOrder.fieldProfileId,
                  ),
                  eq(subscriptions.status, "active"),
                ),
              )
              .orderBy(desc(subscriptions.updatedAt))
              .limit(1)
          )[0] ?? null);

    if (existingByProfile) {
      const existingEnd = calculateSubscriptionEnd(
        existingByProfile.startedAt,
        existingByProfile.durationDays,
      );

      if (shouldExtendExistingSubscription(existingEnd, now)) {
        const extendedRows = await tx
          .update(subscriptions)
          .set({
            durationDays:
              existingByProfile.durationDays + context.service.durationDays,
            status: "active",
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, existingByProfile.id))
          .returning();
        const extended = extendedRows[0] ?? null;
        if (!extended) {
          throw new Error("Failed to extend subscription");
        }
        subscriptionId = extended.id;
      } else {
        const createdRows = await tx
          .insert(subscriptions)
          .values({
            userId: approvedOrder.userId,
            serviceId: approvedOrder.serviceId,
            orderId: approvedOrder.id,
            fieldProfileId: approvedOrder.fieldProfileId,
            startedAt: now,
            durationDays: context.service.durationDays,
            status: "active",
          })
          .returning();
        const created = createdRows[0];
        if (!created) {
          throw new Error("Failed to create subscription");
        }
        subscriptionId = created.id;
      }
    } else {
      const createdRows = await tx
        .insert(subscriptions)
        .values({
          userId: approvedOrder.userId,
          serviceId: approvedOrder.serviceId,
          orderId: approvedOrder.id,
          fieldProfileId: approvedOrder.fieldProfileId,
          startedAt: now,
          durationDays: context.service.durationDays,
          status: "active",
        })
        .returning();
      const created = createdRows[0];
      if (!created) {
        throw new Error("Failed to create subscription");
      }
      subscriptionId = created.id;
    }

    if (
      approvedOrder.discountCodeId &&
      dbMoneyToMinor(approvedOrder.discountAmount) > 0n
    ) {
      await tx.insert(discountRedemptions).values({
        discountCodeId: approvedOrder.discountCodeId,
        orderId: approvedOrder.id,
        userId: approvedOrder.userId,
        serviceId: approvedOrder.serviceId,
        discountAmount: approvedOrder.discountAmount,
      });
    }

    const referral = await getReferralByInvitee(approvedOrder.userId);
    if (referral) {
      const rewardMinor = calculateReferralRewardMinor(
        dbMoneyToMinor(approvedOrder.discountedAmount),
      );
      if (rewardMinor > 0n) {
        const inviterBalanceRows = await tx
          .select({ balanceAfter: creditLedger.balanceAfter })
          .from(creditLedger)
          .where(eq(creditLedger.userId, referral.inviterUserId))
          .orderBy(desc(creditLedger.createdAt))
          .limit(1);

        const inviterCurrent = dbMoneyToMinor(
          inviterBalanceRows[0]?.balanceAfter ?? "0.00",
        );
        const inviterNext = inviterCurrent + rewardMinor;

        await tx.insert(creditLedger).values({
          userId: referral.inviterUserId,
          type: "referral_reward",
          amount: minorToDbMoney(rewardMinor),
          balanceAfter: minorToDbMoney(inviterNext),
          orderId: approvedOrder.id,
          note: `Referral reward (${env.REFERRAL_PERCENT}%)`,
          createdBy: adminTelegramId,
        });
      }
    }

    await createAuditLog({
      actorTelegramId: adminTelegramId,
      action: "order.approve",
      entityType: "order",
      entityId: approvedOrder.id,
      metadata: {
        subscriptionId,
      },
    });

    return {
      order: approvedOrder,
      subscriptionId,
      startedAt: now,
      durationDays: context.service.durationDays,
      serviceTitle: context.service.title,
      userId: approvedOrder.userId,
    };
  });

  const endDate = calculateSubscriptionEnd(
    result.startedAt,
    result.durationDays,
  );
  const reminderDate = new Date(endDate);
  reminderDate.setDate(reminderDate.getDate() - REMINDER_DAYS_BEFORE_EXPIRY);

  if (reminderDate > now) {
    await createAndScheduleNotification({
      audience: "user",
      userId: result.userId,
      messageKey: "subscription_reminder",
      messagePayload: {
        serviceTitle: result.serviceTitle,
      },
      sendAt: reminderDate,
      createdBy: adminTelegramId,
    });
  }

  await createAndScheduleNotification({
    audience: "user",
    userId: result.userId,
    messageKey: "subscription_ended",
    messagePayload: {
      serviceTitle: result.serviceTitle,
    },
    sendAt: endDate,
    createdBy: adminTelegramId,
  });

  return result;
}
