import { and, count, eq, sql } from "drizzle-orm";

import { db } from "../client.js";
import {
  discountCodeServices,
  discountCodes,
  discountRedemptions,
} from "../schema.js";

export async function getDiscountByCode(code: string) {
  const rows = await db
    .select()
    .from(discountCodes)
    .where(eq(discountCodes.code, code))
    .limit(1);
  return rows[0] ?? null;
}

export async function getDiscountServiceScope(discountCodeId: string) {
  const rows = await db
    .select({ serviceId: discountCodeServices.serviceId })
    .from(discountCodeServices)
    .where(eq(discountCodeServices.discountCodeId, discountCodeId));

  return rows.map((row) => row.serviceId);
}

export async function getDiscountUsageCounts(
  discountCodeId: string,
  userId: string,
) {
  const totalRows = await db
    .select({ value: count() })
    .from(discountRedemptions)
    .where(eq(discountRedemptions.discountCodeId, discountCodeId));

  const userRows = await db
    .select({ value: count() })
    .from(discountRedemptions)
    .where(
      and(
        eq(discountRedemptions.discountCodeId, discountCodeId),
        eq(discountRedemptions.userId, userId),
      ),
    );

  return {
    total: totalRows[0]?.value ?? 0,
    user: userRows[0]?.value ?? 0,
  };
}

export async function insertDiscountRedemption(params: {
  discountCodeId: string;
  orderId: string;
  userId: string;
  serviceId: string;
  discountAmount: string;
}) {
  const rows = await db
    .insert(discountRedemptions)
    .values({
      discountCodeId: params.discountCodeId,
      orderId: params.orderId,
      userId: params.userId,
      serviceId: params.serviceId,
      discountAmount: params.discountAmount,
    })
    .returning();

  const created = rows[0];
  if (!created) {
    throw new Error("Failed to create discount redemption");
  }

  return created;
}

export async function createDiscountCode(input: {
  code: string;
  type: "percent" | "fixed";
  amount: string;
  minOrderAmount?: string | null;
  maxDiscountAmount?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  totalUsageLimit?: number | null;
  perUserUsageLimit?: number | null;
  firstPurchaseOnly: boolean;
  isActive: boolean;
  createdBy: string;
  serviceIds: string[];
}) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(discountCodes)
      .values({
        code: input.code,
        type: input.type,
        amount: input.amount,
        minOrderAmount: input.minOrderAmount ?? null,
        maxDiscountAmount: input.maxDiscountAmount ?? null,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        totalUsageLimit: input.totalUsageLimit ?? null,
        perUserUsageLimit: input.perUserUsageLimit ?? null,
        firstPurchaseOnly: input.firstPurchaseOnly,
        isActive: input.isActive,
        createdBy: input.createdBy,
        updatedBy: input.createdBy,
      })
      .returning();

    const code = rows[0];
    if (!code) {
      throw new Error("Failed to create discount code");
    }

    if (input.serviceIds.length > 0) {
      await tx.insert(discountCodeServices).values(
        input.serviceIds.map((serviceId) => ({
          discountCodeId: code.id,
          serviceId,
        })),
      );
    }

    return code;
  });
}

export async function updateDiscountCode(
  id: string,
  patch: Partial<{
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
  }>,
  updatedBy: string,
  serviceIds?: string[],
) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(discountCodes)
      .set({
        ...patch,
        updatedBy,
        updatedAt: new Date(),
      })
      .where(eq(discountCodes.id, id))
      .returning();

    if (serviceIds) {
      await tx
        .delete(discountCodeServices)
        .where(eq(discountCodeServices.discountCodeId, id));
      if (serviceIds.length > 0) {
        await tx.insert(discountCodeServices).values(
          serviceIds.map((serviceId) => ({
            discountCodeId: id,
            serviceId,
          })),
        );
      }
    }

    return rows[0] ?? null;
  });
}

export async function listDiscountCodes() {
  return db
    .select()
    .from(discountCodes)
    .orderBy(sql`${discountCodes.createdAt} desc`);
}
