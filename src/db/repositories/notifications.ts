import { and, eq, lte } from "drizzle-orm";

import { db } from "../client.js";
import { notifications } from "../schema.js";

export async function createNotification(input: {
  audience: "user" | "all" | "service_subscribers";
  userId?: string | null;
  serviceId?: string | null;
  messageKey: string;
  messagePayload: Record<string, unknown>;
  sendAt: Date;
  idempotencyKey: string;
  createdBy: string;
}) {
  const rows = await db
    .insert(notifications)
    .values({
      state: "pending",
      audience: input.audience,
      userId: input.userId ?? null,
      serviceId: input.serviceId ?? null,
      messageKey: input.messageKey,
      messagePayload: input.messagePayload,
      sendAt: input.sendAt,
      idempotencyKey: input.idempotencyKey,
      createdBy: input.createdBy,
    })
    .returning();

  const created = rows[0];
  if (!created) {
    throw new Error("Failed to create notification");
  }

  return created;
}

export async function getNotificationById(id: string) {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listDueNotifications(now: Date) {
  return db
    .select()
    .from(notifications)
    .where(
      and(eq(notifications.state, "pending"), lte(notifications.sendAt, now)),
    );
}

export async function markNotificationSent(
  id: string,
  qstashMessageId?: string | null,
) {
  const rows = await db
    .update(notifications)
    .set({
      state: "sent",
      sentAt: new Date(),
      qstashMessageId: qstashMessageId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(notifications.id, id))
    .returning();

  return rows[0] ?? null;
}

export async function markNotificationFailed(id: string, reason: string) {
  const rows = await db
    .update(notifications)
    .set({
      state: "failed",
      failureReason: reason,
      failedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(notifications.id, id))
    .returning();

  return rows[0] ?? null;
}

export async function cancelNotification(id: string) {
  const rows = await db
    .update(notifications)
    .set({
      state: "cancelled",
      updatedAt: new Date(),
    })
    .where(eq(notifications.id, id))
    .returning();

  return rows[0] ?? null;
}
