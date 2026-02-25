import { Conversation } from "@grammyjs/conversations";
import { z } from "zod";

import { createAuditLog } from "../../db/repositories/audit.js";
import {
  createDiscountCode,
  listDiscountCodes,
  updateDiscountCode,
} from "../../db/repositories/discounts.js";
import { listAllServices } from "../../db/repositories/services.js";
import { normalizeDiscountCode } from "../../utils/telegram.js";
import type { BotContext } from "../context.js";

const discountTypeSchema = z.enum(["percent", "fixed"]);
const moneySchema = z.string().regex(/^\d+(\.\d{1,2})?$/);
const isoDateTimeSchema = z.string().datetime({ offset: true });
const usageLimitSchema = z.coerce.number().int().positive();

function parseOptionalMoney(input: string): string | null {
  if (input === "-") {
    return null;
  }
  if (!moneySchema.safeParse(input).success) {
    throw new Error("invalid_money");
  }
  return input;
}

function parseOptionalDate(input: string): Date | null {
  if (input === "-") {
    return null;
  }

  const parsed = isoDateTimeSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("invalid_datetime");
  }
  return new Date(parsed.data);
}

function parseOptionalUsageLimit(input: string): number | null {
  if (input === "-") {
    return null;
  }

  const parsed = usageLimitSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("invalid_usage_limit");
  }
  return parsed.data;
}

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
  const typeParsed = discountTypeSchema.safeParse(typeRaw);
  if (!typeParsed.success) {
    await ctx.reply("Invalid type.");
    return;
  }
  const type = typeParsed.data;

  const amount = await ask(conversation, ctx, "Amount:");
  if (!moneySchema.safeParse(amount).success) {
    await ctx.reply("Invalid amount.");
    return;
  }
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

  let minOrderAmountValue: string | null;
  let maxDiscountAmountValue: string | null;
  let startsAtValue: Date | null;
  let endsAtValue: Date | null;
  let totalUsageValue: number | null;
  let userUsageValue: number | null;

  try {
    minOrderAmountValue = parseOptionalMoney(minOrderAmount);
    maxDiscountAmountValue = parseOptionalMoney(maxDiscountAmount);
    startsAtValue = parseOptionalDate(startsAtRaw);
    endsAtValue = parseOptionalDate(endsAtRaw);
    totalUsageValue = parseOptionalUsageLimit(totalUsage);
    userUsageValue = parseOptionalUsageLimit(userUsage);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "invalid_money") {
      await ctx.reply("Invalid amount format.");
      return;
    }
    if (message === "invalid_datetime") {
      await ctx.reply(
        "Invalid datetime. Use ISO datetime with timezone (example: 2026-03-01T10:20:30Z).",
      );
      return;
    }
    if (message === "invalid_usage_limit") {
      await ctx.reply("Usage limit must be a positive integer.");
      return;
    }
    throw error;
  }

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
      type,
      amount,
      minOrderAmount: minOrderAmountValue,
      maxDiscountAmount: maxDiscountAmountValue,
      startsAt: startsAtValue,
      endsAt: endsAtValue,
      totalUsageLimit: totalUsageValue,
      perUserUsageLimit: userUsageValue,
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
    "Field (code|type|amount|minOrderAmount|maxDiscountAmount|startsAt|endsAt|totalUsageLimit|perUserUsageLimit|firstPurchaseOnly|isActive|serviceScope):",
  );
  const value = await ask(conversation, ctx, "Value:");

  const patch: Record<string, unknown> = {};
  let serviceIds: string[] | undefined;
  if (field === "code") {
    const normalized = normalizeDiscountCode(value);
    if (normalized.length === 0) {
      await ctx.reply("Invalid field");
      return;
    }
    patch.code = normalized;
  }
  if (field === "type") {
    const normalizedType = value.toLowerCase();
    if (!discountTypeSchema.safeParse(normalizedType).success) {
      await ctx.reply("Invalid type.");
      return;
    }
    patch.type = normalizedType;
  }
  if (field === "amount") {
    if (!moneySchema.safeParse(value).success) {
      await ctx.reply("Invalid amount format.");
      return;
    }
    patch.amount = value;
  }
  if (field === "minOrderAmount") {
    try {
      patch.minOrderAmount = parseOptionalMoney(value);
    } catch {
      await ctx.reply("Invalid amount format.");
      return;
    }
  }
  if (field === "maxDiscountAmount") {
    try {
      patch.maxDiscountAmount = parseOptionalMoney(value);
    } catch {
      await ctx.reply("Invalid amount format.");
      return;
    }
  }
  if (field === "startsAt") {
    try {
      patch.startsAt = parseOptionalDate(value);
    } catch {
      await ctx.reply(
        "Invalid datetime. Use ISO datetime with timezone (example: 2026-03-01T10:20:30Z).",
      );
      return;
    }
  }
  if (field === "endsAt") {
    try {
      patch.endsAt = parseOptionalDate(value);
    } catch {
      await ctx.reply(
        "Invalid datetime. Use ISO datetime with timezone (example: 2026-03-01T10:20:30Z).",
      );
      return;
    }
  }
  if (field === "totalUsageLimit") {
    try {
      patch.totalUsageLimit = parseOptionalUsageLimit(value);
    } catch {
      await ctx.reply("Usage limit must be a positive integer.");
      return;
    }
  }
  if (field === "perUserUsageLimit") {
    try {
      patch.perUserUsageLimit = parseOptionalUsageLimit(value);
    } catch {
      await ctx.reply("Usage limit must be a positive integer.");
      return;
    }
  }
  if (field === "firstPurchaseOnly")
    patch.firstPurchaseOnly = ["yes", "y", "بله", "اره"].includes(
      value.toLowerCase(),
    );
  if (field === "isActive")
    patch.isActive = ["yes", "y", "true", "1", "بله", "اره"].includes(
      value.toLowerCase(),
    );
  if (field === "serviceScope") {
    serviceIds =
      value === "-"
        ? []
        : value
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
  }

  if (Object.keys(patch).length === 0 && serviceIds === undefined) {
    await ctx.reply("Invalid field");
    return;
  }

  let updated: Awaited<ReturnType<typeof updateDiscountCode>>;
  try {
    updated = await conversation.external(() =>
      updateDiscountCode(id, patch, String(ctx.from?.id), serviceIds),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("discount_codes_code_key") ||
      message.toLowerCase().includes("duplicate key value")
    ) {
      await ctx.reply("Discount code already exists.");
      return;
    }
    throw error;
  }

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

export async function deactivateDiscountConversation(
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

  const id = await ask(conversation, ctx, "Discount id to deactivate:");
  const confirmation = (
    await ask(conversation, ctx, "Type YES to confirm:")
  ).toLowerCase();
  if (!["yes", "y", "بله", "اره"].includes(confirmation)) {
    await ctx.reply("Cancelled.");
    return;
  }

  const updated = await conversation.external(() =>
    updateDiscountCode(id, { isActive: false }, String(ctx.from?.id)),
  );
  if (!updated) {
    await ctx.reply("Discount not found.");
    return;
  }

  await conversation.external(() =>
    createAuditLog({
      actorTelegramId: String(ctx.from?.id),
      actorUserId: ctx.dbUserId,
      action: "discount.deactivate",
      entityType: "discount",
      entityId: updated.id,
      metadata: { code: updated.code },
    }),
  );

  await ctx.reply(`Discount deactivated: ${updated.code}`);
}
