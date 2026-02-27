import { Conversation } from "@grammyjs/conversations";
import { z } from "zod";

import { createAuditLog } from "../../db/repositories/audit.js";
import {
  createService,
  deactivateService,
  listAllServices,
  updateService,
} from "../../db/repositories/services.js";
import type { BotContext, ConversationContext } from "../context.js";

const moneySchema = z.string().regex(/^\d+(\.\d{1,2})?$/);
const durationSchema = z.coerce.number().int().min(1).max(255);
const titleSchema = z.string().min(2);

const CONFIRM_YES = new Set(["yes", "y", "بله", "اره"]);

async function ask(
  conversation: Conversation<BotContext, ConversationContext>,
  ctx: ConversationContext,
  promptKey: string,
): Promise<string> {
  await ctx.reply(ctx.t(promptKey));
  const update = await conversation.waitFor(":text");
  if (!update.message || !("text" in update.message)) {
    await update.reply(update.t("error-generic"));
    return "";
  }

  return update.message.text.trim();
}

async function askWithSchema<T>(
  conversation: Conversation<BotContext, ConversationContext>,
  ctx: ConversationContext,
  promptKey: string,
  schema: z.ZodType<T>,
  errorKey: string,
): Promise<T> {
  while (true) {
    const raw = await ask(conversation, ctx, promptKey);
    const parsed = schema.safeParse(raw);
    if (parsed.success) {
      return parsed.data;
    }
    await ctx.reply(ctx.t(errorKey));
  }
}

function isAffirmative(value: string): boolean {
  return CONFIRM_YES.has(value.toLowerCase());
}

function parseCommaList(input: string): string[] {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export async function createServiceConversation(
  conversation: Conversation<BotContext, ConversationContext>,
  ctx: ConversationContext,
): Promise<void> {
  if (!ctx.isAdmin) {
    await ctx.reply(ctx.t("admin-denied"));
    return;
  }

  const title = await askWithSchema(
    conversation,
    ctx,
    "service-admin-create-title-prompt",
    titleSchema,
    "service-admin-error-title-min",
  );
  const price = await askWithSchema(
    conversation,
    ctx,
    "service-admin-create-price-prompt",
    moneySchema,
    "service-admin-error-price-format",
  );
  const descriptionInput = await ask(
    conversation,
    ctx,
    "service-admin-create-description-prompt",
  );
  const notesInput = await ask(
    conversation,
    ctx,
    "service-admin-create-notes-prompt",
  );
  const fieldsInput = await ask(
    conversation,
    ctx,
    "service-admin-create-fields-prompt",
  );
  const durationDays = await askWithSchema(
    conversation,
    ctx,
    "service-admin-create-duration-prompt",
    durationSchema,
    "service-admin-error-duration-range",
  );

  const notes = parseCommaList(notesInput);
  const neededFields = parseCommaList(fieldsInput);

  const service = await conversation.external(() =>
    createService(
      {
        title,
        price,
        description: descriptionInput === "-" ? null : descriptionInput,
        notes,
        neededFields,
        durationDays,
      },
      String(ctx.from?.id),
    ),
  );

  if (!service) {
    await ctx.reply(ctx.t("service-admin-create-failed"));
    return;
  }

  await conversation.external(() =>
    createAuditLog({
      actorTelegramId: String(ctx.from?.id),
      actorUserId: ctx.dbUserId,
      action: "service.create",
      entityType: "service",
      entityId: service.id,
      metadata: {
        title: service.title,
      },
    }),
  );

  await ctx.reply(
    ctx.t("service-admin-created", {
      title: service.title,
    }),
  );
}

export async function editServiceConversation(
  conversation: Conversation<BotContext, ConversationContext>,
  ctx: ConversationContext,
): Promise<void> {
  if (!ctx.isAdmin) {
    await ctx.reply(ctx.t("admin-denied"));
    return;
  }

  const services = await conversation.external(() => listAllServices());
  if (services.length === 0) {
    await ctx.reply(ctx.t("service-admin-edit-empty"));
    return;
  }

  await ctx.reply(
    services
      .map((service) =>
        ctx.t("service-admin-service-row", {
          id: service.id,
          title: service.title,
          isActive: service.isActive
            ? ctx.t("common-active")
            : ctx.t("common-inactive"),
        }),
      )
      .join("\n"),
  );

  const serviceId = await ask(
    conversation,
    ctx,
    "service-admin-edit-id-prompt",
  );
  const field = await ask(conversation, ctx, "service-admin-edit-field-prompt");
  const value = await ask(conversation, ctx, "service-admin-edit-value-prompt");

  const patch: Record<string, unknown> = {};
  if (field === "title") {
    if (!titleSchema.safeParse(value).success) {
      await ctx.reply(ctx.t("service-admin-error-title-min"));
      return;
    }
    patch.title = value;
  }
  if (field === "price") {
    if (!moneySchema.safeParse(value).success) {
      await ctx.reply(ctx.t("service-admin-error-price-format"));
      return;
    }
    patch.price = value;
  }
  if (field === "description") {
    patch.description = value === "-" ? null : value;
  }
  if (field === "notes") {
    patch.notes = parseCommaList(value);
  }
  if (field === "neededFields") {
    patch.neededFields = parseCommaList(value);
  }
  if (field === "durationDays") {
    const durationParsed = durationSchema.safeParse(value);
    if (!durationParsed.success) {
      await ctx.reply(ctx.t("service-admin-error-duration-range"));
      return;
    }
    patch.durationDays = durationParsed.data;
  }

  if (Object.keys(patch).length === 0) {
    await ctx.reply(ctx.t("service-admin-error-field"));
    return;
  }

  await ctx.reply(
    ctx.t("service-admin-edit-confirm-preview", {
      field,
      value,
    }),
  );
  const confirmation = (
    await ask(conversation, ctx, "service-admin-edit-confirm-prompt")
  ).toLowerCase();
  if (!isAffirmative(confirmation)) {
    await ctx.reply(ctx.t("action-cancelled"));
    return;
  }

  const updated = await conversation.external(() =>
    updateService(serviceId, patch, String(ctx.from?.id)),
  );

  if (!updated) {
    await ctx.reply(ctx.t("service-admin-not-found"));
    return;
  }

  await conversation.external(() =>
    createAuditLog({
      actorTelegramId: String(ctx.from?.id),
      actorUserId: ctx.dbUserId,
      action: "service.update",
      entityType: "service",
      entityId: updated.id,
      metadata: patch,
    }),
  );

  await ctx.reply(
    ctx.t("service-admin-updated", {
      title: updated.title,
    }),
  );
}

export async function deactivateServiceConversation(
  conversation: Conversation<BotContext, ConversationContext>,
  ctx: ConversationContext,
): Promise<void> {
  if (!ctx.isAdmin) {
    await ctx.reply(ctx.t("admin-denied"));
    return;
  }

  const services = await conversation.external(() => listAllServices());
  if (services.length === 0) {
    await ctx.reply(ctx.t("service-admin-deactivate-empty"));
    return;
  }

  await ctx.reply(
    services
      .map((service) =>
        ctx.t("service-admin-service-row", {
          id: service.id,
          title: service.title,
          isActive: service.isActive
            ? ctx.t("common-active")
            : ctx.t("common-inactive"),
        }),
      )
      .join("\n"),
  );

  const serviceId = await ask(
    conversation,
    ctx,
    "service-admin-deactivate-id-prompt",
  );
  const confirmation = (
    await ask(conversation, ctx, "service-admin-deactivate-confirm-prompt")
  ).toLowerCase();

  if (!isAffirmative(confirmation)) {
    await ctx.reply(ctx.t("action-cancelled"));
    return;
  }

  const updated = await conversation.external(() =>
    deactivateService(serviceId, String(ctx.from?.id)),
  );

  if (!updated) {
    await ctx.reply(ctx.t("service-admin-not-found"));
    return;
  }

  await conversation.external(() =>
    createAuditLog({
      actorTelegramId: String(ctx.from?.id),
      actorUserId: ctx.dbUserId,
      action: "service.deactivate",
      entityType: "service",
      entityId: updated.id,
      metadata: { title: updated.title },
    }),
  );

  await ctx.reply(
    ctx.t("service-admin-deactivated", {
      title: updated.title,
    }),
  );
}
