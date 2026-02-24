import { desc, eq } from "drizzle-orm";

import { db } from "../client.js";
import { services } from "../schema.js";

export type ServiceUpsertInput = {
  title: string;
  price: string;
  description: string | null;
  notes: string[];
  neededFields: string[];
  durationDays: number;
};

export async function listActiveServices() {
  return db
    .select()
    .from(services)
    .where(eq(services.isActive, true))
    .orderBy(desc(services.createdAt));
}

export async function listAllServices() {
  return db.select().from(services).orderBy(desc(services.createdAt));
}

export async function getServiceById(serviceId: string) {
  const rows = await db
    .select()
    .from(services)
    .where(eq(services.id, serviceId))
    .limit(1);
  return rows[0] ?? null;
}

export async function createService(
  input: ServiceUpsertInput,
  adminTelegramId: string,
) {
  const rows = await db
    .insert(services)
    .values({
      title: input.title,
      price: input.price,
      description: input.description,
      notes: input.notes,
      neededFields: input.neededFields,
      durationDays: input.durationDays,
      createdBy: adminTelegramId,
      updatedBy: adminTelegramId,
    })
    .returning();

  const created = rows[0];
  if (!created) {
    throw new Error("Failed to create service");
  }

  return created;
}

export async function updateService(
  serviceId: string,
  patch: Partial<ServiceUpsertInput>,
  adminTelegramId: string,
) {
  const rows = await db
    .update(services)
    .set({
      ...patch,
      updatedBy: adminTelegramId,
      updatedAt: new Date(),
    })
    .where(eq(services.id, serviceId))
    .returning();

  return rows[0] ?? null;
}

export async function deactivateService(
  serviceId: string,
  adminTelegramId: string,
) {
  const rows = await db
    .update(services)
    .set({
      isActive: false,
      updatedBy: adminTelegramId,
      updatedAt: new Date(),
    })
    .where(eq(services.id, serviceId))
    .returning();

  return rows[0] ?? null;
}
