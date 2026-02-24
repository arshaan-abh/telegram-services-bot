import { and, desc, eq } from "drizzle-orm";

import { db } from "../client.js";
import { serviceFieldProfiles, services, subscriptions } from "../schema.js";

export async function listSubscriptionsByUser(userId: string) {
  return db
    .select({
      subscription: subscriptions,
      service: services,
    })
    .from(subscriptions)
    .innerJoin(services, eq(subscriptions.serviceId, services.id))
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt));
}

export async function getActiveSubscriptionByProfile(
  userId: string,
  serviceId: string,
  fieldProfileId: string,
) {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.serviceId, serviceId),
        eq(subscriptions.fieldProfileId, fieldProfileId),
        eq(subscriptions.status, "active"),
      ),
    )
    .orderBy(desc(subscriptions.updatedAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function createSubscription(input: {
  userId: string;
  serviceId: string;
  orderId: string;
  fieldProfileId?: string | null;
  startedAt: Date;
  durationDays: number;
}) {
  const rows = await db
    .insert(subscriptions)
    .values({
      userId: input.userId,
      serviceId: input.serviceId,
      orderId: input.orderId,
      fieldProfileId: input.fieldProfileId ?? null,
      startedAt: input.startedAt,
      durationDays: input.durationDays,
      status: "active",
    })
    .returning();

  const created = rows[0];
  if (!created) {
    throw new Error("Failed to create subscription");
  }

  return created;
}

export async function updateSubscriptionDuration(
  subscriptionId: string,
  patch: {
    startedAt?: Date;
    durationDays?: number;
    status?: "active" | "expired";
  },
) {
  const rows = await db
    .update(subscriptions)
    .set({
      ...patch,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscriptionId))
    .returning();

  return rows[0] ?? null;
}

export async function listActiveSubscriptions() {
  return db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.status, "active"));
}

export async function getSubscriptionFieldProfile(subscriptionId: string) {
  const rows = await db
    .select({ profile: serviceFieldProfiles })
    .from(subscriptions)
    .innerJoin(
      serviceFieldProfiles,
      eq(subscriptions.fieldProfileId, serviceFieldProfiles.id),
    )
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);

  return rows[0]?.profile ?? null;
}

export async function listSubscribersByService(serviceId: string) {
  return db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.serviceId, serviceId),
        eq(subscriptions.status, "active"),
      ),
    );
}
