import { and, desc, eq } from "drizzle-orm";

import { db } from "../client.js";
import { orders, services, users } from "../schema.js";

export async function createOrderDraft(input: {
  userId: string;
  serviceId: string;
  fieldProfileId?: string | null;
  neededFieldValues: Record<string, string>;
  basePrice: string;
  discountAmount: string;
  creditAmount: string;
  payableAmount: string;
  discountedAmount: string;
  discountCodeId?: string | null;
  discountCodeText?: string | null;
}) {
  const rows = await db
    .insert(orders)
    .values({
      userId: input.userId,
      serviceId: input.serviceId,
      fieldProfileId: input.fieldProfileId ?? null,
      neededFieldValues: input.neededFieldValues,
      basePrice: input.basePrice,
      discountAmount: input.discountAmount,
      creditAmount: input.creditAmount,
      payableAmount: input.payableAmount,
      discountedAmount: input.discountedAmount,
      discountCodeId: input.discountCodeId ?? null,
      discountCodeText: input.discountCodeText ?? null,
      status: "draft",
    })
    .returning();

  const created = rows[0];
  if (!created) {
    throw new Error("Failed to create order draft");
  }

  return created;
}

export async function getOrderById(orderId: string) {
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return rows[0] ?? null;
}

export async function setOrderAwaitingProof(orderId: string) {
  const rows = await db
    .update(orders)
    .set({ status: "awaiting_proof", updatedAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning();

  return rows[0] ?? null;
}

export async function attachOrderProof(
  orderId: string,
  input: {
    proofFileId: string;
    proofMime: string;
    proofSizeBytes?: number | null;
  },
) {
  const rows = await db
    .update(orders)
    .set({
      proofFileId: input.proofFileId,
      proofMime: input.proofMime,
      proofSizeBytes: input.proofSizeBytes ?? null,
      status: "awaiting_admin_review",
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
    .returning();

  return rows[0] ?? null;
}

export async function submitOrderWithoutProof(orderId: string) {
  const rows = await db
    .update(orders)
    .set({
      status: "awaiting_admin_review",
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
    .returning();

  return rows[0] ?? null;
}

export async function listPendingOrders() {
  return db
    .select({
      order: orders,
      serviceTitle: services.title,
      userTelegramId: users.telegramId,
      username: users.username,
      firstName: users.firstName,
    })
    .from(orders)
    .innerJoin(services, eq(orders.serviceId, services.id))
    .innerJoin(users, eq(orders.userId, users.id))
    .where(eq(orders.status, "awaiting_admin_review"))
    .orderBy(desc(orders.submittedAt));
}

export async function getOrderWithUserAndService(orderId: string) {
  const rows = await db
    .select({
      order: orders,
      service: services,
      user: users,
    })
    .from(orders)
    .innerJoin(services, eq(orders.serviceId, services.id))
    .innerJoin(users, eq(orders.userId, users.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  return rows[0] ?? null;
}

export async function markOrderDismissed(
  orderId: string,
  adminTelegramId: string,
  reason: string,
) {
  const rows = await db
    .update(orders)
    .set({
      status: "dismissed",
      dismissReason: reason,
      dismissedAt: new Date(),
      adminActionBy: adminTelegramId,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
    .returning();

  return rows[0] ?? null;
}

export async function markOrderApproved(
  orderId: string,
  adminTelegramId: string,
) {
  const rows = await db
    .update(orders)
    .set({
      status: "approved",
      approvedAt: new Date(),
      adminActionBy: adminTelegramId,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
    .returning();

  return rows[0] ?? null;
}

export async function listOrdersByUserAndService(
  userId: string,
  serviceId: string,
) {
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.serviceId, serviceId)))
    .orderBy(desc(orders.createdAt));
}
