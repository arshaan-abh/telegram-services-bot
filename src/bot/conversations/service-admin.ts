import { Conversation } from "@grammyjs/conversations";

import { createAuditLog } from "../../db/repositories/audit.js";
import {
  createService,
  deactivateService,
  listAllServices,
  updateService,
} from "../../db/repositories/services.js";
import type { BotContext } from "../context.js";

async function ask(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
  prompt: string,
): Promise<string> {
  await ctx.reply(prompt);
  const update = await conversation.waitFor(":text");
  if (!update.message || !("text" in update.message)) {
    await update.reply(update.t("error-generic"));
    return "";
  }

  return update.message.text.trim();
}

export async function createServiceConversation(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
): Promise<void> {
  if (!ctx.isAdmin) {
    await ctx.reply(ctx.t("admin-denied"));
    return;
  }

  const title = await ask(conversation, ctx, "Service title:");
  const price = await ask(conversation, ctx, "Price (numeric):");
  const descriptionInput = await ask(
    conversation,
    ctx,
    "Description (optional, send - to skip):",
  );
  const notesInput = await ask(conversation, ctx, "Notes (comma separated):");
  const fieldsInput = await ask(
    conversation,
    ctx,
    "Needed fields (comma separated):",
  );
  const durationInput = await ask(
    conversation,
    ctx,
    "Duration in days (1..255):",
  );

  const durationDays = Number(durationInput);
  if (
    !Number.isInteger(durationDays) ||
    durationDays < 1 ||
    durationDays > 255
  ) {
    await ctx.reply("Invalid duration");
    return;
  }

  const notes = notesInput
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const neededFields = fieldsInput
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

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
    await ctx.reply("Failed to create service.");
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

  await ctx.reply(`Service created: ${service.title}`);
}

export async function editServiceConversation(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
): Promise<void> {
  if (!ctx.isAdmin) {
    await ctx.reply(ctx.t("admin-denied"));
    return;
  }

  const services = await conversation.external(() => listAllServices());
  if (services.length === 0) {
    await ctx.reply("No services to edit.");
    return;
  }

  await ctx.reply(
    services
      .map(
        (service) =>
          `${service.id} | ${service.title} | active=${service.isActive}`,
      )
      .join("\n"),
  );

  const serviceId = await ask(conversation, ctx, "Send service id:");
  const field = await ask(
    conversation,
    ctx,
    "Field to edit (title|price|description|notes|neededFields|durationDays):",
  );
  const value = await ask(conversation, ctx, "New value:");

  const patch: Record<string, unknown> = {};
  if (field === "title") patch.title = value;
  if (field === "price") patch.price = value;
  if (field === "description") patch.description = value === "-" ? null : value;
  if (field === "notes")
    patch.notes = value.split(",").map((item) => item.trim());
  if (field === "neededFields")
    patch.neededFields = value.split(",").map((item) => item.trim());
  if (field === "durationDays") patch.durationDays = Number(value);

  if (Object.keys(patch).length === 0) {
    await ctx.reply("Invalid field");
    return;
  }

  const updated = await conversation.external(() =>
    updateService(serviceId, patch, String(ctx.from?.id)),
  );

  if (!updated) {
    await ctx.reply("Service not found.");
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

  await ctx.reply(`Service updated: ${updated.title}`);
}

export async function deactivateServiceConversation(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
): Promise<void> {
  if (!ctx.isAdmin) {
    await ctx.reply(ctx.t("admin-denied"));
    return;
  }

  const services = await conversation.external(() => listAllServices());
  if (services.length === 0) {
    await ctx.reply("No services to deactivate.");
    return;
  }

  await ctx.reply(
    services
      .map(
        (service) =>
          `${service.id} | ${service.title} | active=${service.isActive}`,
      )
      .join("\n"),
  );

  const serviceId = await ask(
    conversation,
    ctx,
    "Send service id to deactivate:",
  );
  const confirmation = (
    await ask(conversation, ctx, "Type YES to confirm: ")
  ).toLowerCase();

  if (!["yes", "y", "بله", "اره"].includes(confirmation)) {
    await ctx.reply("Cancelled.");
    return;
  }

  const updated = await conversation.external(() =>
    deactivateService(serviceId, String(ctx.from?.id)),
  );

  if (!updated) {
    await ctx.reply("Service not found.");
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

  await ctx.reply(`Service deactivated: ${updated.title}`);
}
