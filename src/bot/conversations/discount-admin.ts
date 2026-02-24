import { Conversation } from "@grammyjs/conversations";

import { createAuditLog } from "../../db/repositories/audit.js";
import {
  createDiscountCode,
  listDiscountCodes,
  updateDiscountCode,
} from "../../db/repositories/discounts.js";
import { listAllServices } from "../../db/repositories/services.js";
import { normalizeDiscountCode } from "../../utils/telegram.js";
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

export async function createDiscountConversation(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
): Promise<void> {
  if (!ctx.isAdmin) {
    await ctx.reply(ctx.t("admin-denied"));
    return;
  }

  const code = normalizeDiscountCode(await ask(conversation, ctx, "Code:"));
  const typeRaw = (
    await ask(conversation, ctx, "Type (percent/fixed):")
  ).toLowerCase();
  if (typeRaw !== "percent" && typeRaw !== "fixed") {
    await ctx.reply("Invalid type.");
    return;
  }

  const amount = await ask(conversation, ctx, "Amount:");
  const minOrderAmount = await ask(
    conversation,
    ctx,
    "Min order amount (or -):",
  );
  const maxDiscountAmount = await ask(
    conversation,
    ctx,
    "Max discount amount (or -):",
  );
  const startsAtRaw = await ask(
    conversation,
    ctx,
    "Starts at ISO datetime (or -):",
  );
  const endsAtRaw = await ask(
    conversation,
    ctx,
    "Ends at ISO datetime (or -):",
  );
  const totalUsage = await ask(conversation, ctx, "Total usage limit (or -):");
  const userUsage = await ask(
    conversation,
    ctx,
    "Per-user usage limit (or -):",
  );
  const firstPurchaseOnly = (
    await ask(conversation, ctx, "First purchase only? (yes/no):")
  ).toLowerCase();

  const services = await conversation.external(() => listAllServices());
  await ctx.reply(
    `Services:\n${services.map((service) => `${service.id} | ${service.title}`).join("\n")}\nSend comma-separated service ids or - for all services.`,
  );
  const serviceIdsRaw = await ask(conversation, ctx, "Service scope:");
  const serviceIds =
    serviceIdsRaw === "-"
      ? []
      : serviceIdsRaw
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0);

  const discount = await conversation.external(() =>
    createDiscountCode({
      code,
      type: typeRaw,
      amount,
      minOrderAmount: minOrderAmount === "-" ? null : minOrderAmount,
      maxDiscountAmount: maxDiscountAmount === "-" ? null : maxDiscountAmount,
      startsAt: startsAtRaw === "-" ? null : new Date(startsAtRaw),
      endsAt: endsAtRaw === "-" ? null : new Date(endsAtRaw),
      totalUsageLimit: totalUsage === "-" ? null : Number(totalUsage),
      perUserUsageLimit: userUsage === "-" ? null : Number(userUsage),
      firstPurchaseOnly: ["yes", "y", "بله", "اره"].includes(firstPurchaseOnly),
      isActive: true,
      createdBy: String(ctx.from?.id),
      serviceIds,
    }),
  );

  await conversation.external(() =>
    createAuditLog({
      actorTelegramId: String(ctx.from?.id),
      actorUserId: ctx.dbUserId,
      action: "discount.create",
      entityType: "discount",
      entityId: discount.id,
      metadata: {
        code: discount.code,
      },
    }),
  );

  await ctx.reply(`Discount created: ${discount.code}`);
}

export async function editDiscountConversation(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
): Promise<void> {
  if (!ctx.isAdmin) {
    await ctx.reply(ctx.t("admin-denied"));
    return;
  }

  const discounts = await conversation.external(() => listDiscountCodes());
  if (discounts.length === 0) {
    await ctx.reply("No discount codes yet.");
    return;
  }

  await ctx.reply(
    discounts
      .map((d) => `${d.id} | ${d.code} | active=${d.isActive}`)
      .join("\n"),
  );

  const id = await ask(conversation, ctx, "Discount id:");
  const field = await ask(
    conversation,
    ctx,
    "Field (amount|minOrderAmount|maxDiscountAmount|startsAt|endsAt|totalUsageLimit|perUserUsageLimit|firstPurchaseOnly|isActive):",
  );
  const value = await ask(conversation, ctx, "Value:");

  const patch: Record<string, unknown> = {};
  if (field === "amount") patch.amount = value;
  if (field === "minOrderAmount")
    patch.minOrderAmount = value === "-" ? null : value;
  if (field === "maxDiscountAmount")
    patch.maxDiscountAmount = value === "-" ? null : value;
  if (field === "startsAt")
    patch.startsAt = value === "-" ? null : new Date(value);
  if (field === "endsAt") patch.endsAt = value === "-" ? null : new Date(value);
  if (field === "totalUsageLimit")
    patch.totalUsageLimit = value === "-" ? null : Number(value);
  if (field === "perUserUsageLimit")
    patch.perUserUsageLimit = value === "-" ? null : Number(value);
  if (field === "firstPurchaseOnly")
    patch.firstPurchaseOnly = ["yes", "y", "بله", "اره"].includes(
      value.toLowerCase(),
    );
  if (field === "isActive")
    patch.isActive = ["yes", "y", "true", "1", "بله", "اره"].includes(
      value.toLowerCase(),
    );

  if (Object.keys(patch).length === 0) {
    await ctx.reply("Invalid field");
    return;
  }

  const updated = await conversation.external(() =>
    updateDiscountCode(id, patch, String(ctx.from?.id)),
  );

  if (!updated) {
    await ctx.reply("Discount not found.");
    return;
  }

  await conversation.external(() =>
    createAuditLog({
      actorTelegramId: String(ctx.from?.id),
      actorUserId: ctx.dbUserId,
      action: "discount.update",
      entityType: "discount",
      entityId: updated.id,
      metadata: patch,
    }),
  );

  await ctx.reply(`Discount updated: ${updated.code}`);
}
