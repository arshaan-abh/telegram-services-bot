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
import type { BotContext, ConversationContext } from "../context.js";

const discountTypeSchema = z.enum(["percent", "fixed"]);
const moneySchema = z.string().regex(/^\d+(\.\d{1,2})?$/);
const isoDateTimeSchema = z.iso.datetime({ offset: true });
const usageLimitSchema = z.coerce.number().int().positive();

const CONFIRM_YES = new Set(["yes", "y", "بله", "اره"]);
const TRUE_SET = new Set(["yes", "y", "true", "1", "بله", "اره"]);

const EDITABLE_FIELDS = new Set([
  "code",
  "type",
  "amount",
  "minOrderAmount",
  "maxDiscountAmount",
  "startsAt",
  "endsAt",
  "totalUsageLimit",
  "perUserUsageLimit",
  "firstPurchaseOnly",
  "isActive",
  "serviceScope",
]);

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
  normalize: (raw: string) => unknown = (raw) => raw,
): Promise<T> {
  while (true) {
    const raw = await ask(conversation, ctx, promptKey);
    const parsed = schema.safeParse(normalize(raw));
    if (parsed.success) {
      return parsed.data;
    }

    await ctx.reply(ctx.t(errorKey));
  }
}

async function askOptionalMoney(
  conversation: Conversation<BotContext, ConversationContext>,
  ctx: ConversationContext,
  promptKey: string,
): Promise<string | null> {
  while (true) {
    const raw = await ask(conversation, ctx, promptKey);
    if (raw === "-") {
      return null;
    }

    if (moneySchema.safeParse(raw).success) {
      return raw;
    }

    await ctx.reply(ctx.t("discount-admin-error-money"));
  }
}

async function askOptionalDate(
  conversation: Conversation<BotContext, ConversationContext>,
  ctx: ConversationContext,
  promptKey: string,
): Promise<Date | null> {
  while (true) {
    const raw = await ask(conversation, ctx, promptKey);
    if (raw === "-") {
      return null;
    }

    const parsed = isoDateTimeSchema.safeParse(raw);
    if (parsed.success) {
      return new Date(parsed.data);
    }

    await ctx.reply(ctx.t("discount-admin-error-datetime"));
  }
}

async function askOptionalUsageLimit(
  conversation: Conversation<BotContext, ConversationContext>,
  ctx: ConversationContext,
  promptKey: string,
): Promise<number | null> {
  while (true) {
    const raw = await ask(conversation, ctx, promptKey);
    if (raw === "-") {
      return null;
    }

    const parsed = usageLimitSchema.safeParse(raw);
    if (parsed.success) {
      return parsed.data;
    }

    await ctx.reply(ctx.t("discount-admin-error-usage-limit"));
  }
}

async function askDiscountCode(
  conversation: Conversation<BotContext, ConversationContext>,
  ctx: ConversationContext,
  promptKey: string,
): Promise<string> {
  while (true) {
    const normalized = normalizeDiscountCode(
      await ask(conversation, ctx, promptKey),
    );
    if (normalized.length > 0) {
      return normalized;
    }

    await ctx.reply(ctx.t("discount-admin-error-code"));
  }
}

function parseServiceScope(raw: string): string[] {
  if (raw === "-") {
    return [];
  }

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function isAffirmative(raw: string): boolean {
  return CONFIRM_YES.has(raw.toLowerCase());
}

function isTruthy(raw: string): boolean {
  return TRUE_SET.has(raw.toLowerCase());
}

function isUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("discount_codes_code_key") ||
    message.toLowerCase().includes("duplicate key value")
  );
}

function formatServiceList(
  ctx: ConversationContext,
  services: Array<{ id: string; title: string }>,
): string {
  if (services.length === 0) {
    return ctx.t("discount-admin-service-row-empty");
  }

  return services
    .map((service) =>
      ctx.t("discount-admin-service-row", {
        id: service.id,
        title: service.title,
      }),
    )
    .join("\n");
}

function formatDiscountList(
  ctx: ConversationContext,
  discounts: Array<{ id: string; code: string; isActive: boolean }>,
): string {
  return discounts
    .map((discount) =>
      ctx.t("discount-admin-discount-row", {
        id: discount.id,
        code: discount.code,
        isActive: discount.isActive
          ? ctx.t("common-active")
          : ctx.t("common-inactive"),
      }),
    )
    .join("\n");
}

export async function createDiscountConversation(
  conversation: Conversation<BotContext, ConversationContext>,
  ctx: ConversationContext,
): Promise<void> {
  if (!ctx.isAdmin) {
    await ctx.reply(ctx.t("admin-denied"));
    return;
  }

  const code = await askDiscountCode(
    conversation,
    ctx,
    "discount-admin-create-code-prompt",
  );
  const type = await askWithSchema(
    conversation,
    ctx,
    "discount-admin-create-type-prompt",
    discountTypeSchema,
    "discount-admin-error-type",
    (raw) => raw.toLowerCase(),
  );
  const amount = await askWithSchema(
    conversation,
    ctx,
    "discount-admin-create-amount-prompt",
    moneySchema,
    "discount-admin-error-money",
  );
  const minOrderAmountValue = await askOptionalMoney(
    conversation,
    ctx,
    "discount-admin-create-min-order-prompt",
  );
  const maxDiscountAmountValue = await askOptionalMoney(
    conversation,
    ctx,
    "discount-admin-create-max-discount-prompt",
  );
  const startsAtValue = await askOptionalDate(
    conversation,
    ctx,
    "discount-admin-create-starts-at-prompt",
  );
  const endsAtValue = await askOptionalDate(
    conversation,
    ctx,
    "discount-admin-create-ends-at-prompt",
  );
  const totalUsageValue = await askOptionalUsageLimit(
    conversation,
    ctx,
    "discount-admin-create-total-usage-prompt",
  );
  const userUsageValue = await askOptionalUsageLimit(
    conversation,
    ctx,
    "discount-admin-create-per-user-usage-prompt",
  );
  const firstPurchaseOnly = isAffirmative(
    await ask(conversation, ctx, "discount-admin-create-first-purchase-prompt"),
  );

  const services = await conversation.external(() => listAllServices());
  await ctx.reply(
    ctx.t("discount-admin-service-scope-help", {
      services: formatServiceList(ctx, services),
    }),
  );
  const serviceIds = parseServiceScope(
    await ask(conversation, ctx, "discount-admin-create-service-scope-prompt"),
  );

  let discount: Awaited<ReturnType<typeof createDiscountCode>>;
  try {
    discount = await conversation.external(() =>
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
        firstPurchaseOnly,
        isActive: true,
        createdBy: String(ctx.from?.id),
        serviceIds,
      }),
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      await ctx.reply(ctx.t("discount-admin-error-code-exists"));
      return;
    }
    throw error;
  }

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

  await ctx.reply(
    ctx.t("discount-admin-created", {
      code: discount.code,
    }),
  );
}

export async function editDiscountConversation(
  conversation: Conversation<BotContext, ConversationContext>,
  ctx: ConversationContext,
): Promise<void> {
  if (!ctx.isAdmin) {
    await ctx.reply(ctx.t("admin-denied"));
    return;
  }

  const discounts = await conversation.external(() => listDiscountCodes());
  if (discounts.length === 0) {
    await ctx.reply(ctx.t("discount-admin-empty"));
    return;
  }

  await ctx.reply(formatDiscountList(ctx, discounts));

  const id = await ask(conversation, ctx, "discount-admin-edit-id-prompt");
  const field = await ask(
    conversation,
    ctx,
    "discount-admin-edit-field-prompt",
  );

  if (!EDITABLE_FIELDS.has(field)) {
    await ctx.reply(ctx.t("discount-admin-error-field"));
    return;
  }

  const patch: Record<string, unknown> = {};
  let serviceIds: string[] | undefined;

  if (field === "code") {
    patch.code = await askDiscountCode(
      conversation,
      ctx,
      "discount-admin-edit-value-prompt",
    );
  }

  if (field === "type") {
    patch.type = await askWithSchema(
      conversation,
      ctx,
      "discount-admin-edit-value-prompt",
      discountTypeSchema,
      "discount-admin-error-type",
      (raw) => raw.toLowerCase(),
    );
  }

  if (field === "amount") {
    patch.amount = await askWithSchema(
      conversation,
      ctx,
      "discount-admin-edit-value-prompt",
      moneySchema,
      "discount-admin-error-money",
    );
  }

  if (field === "minOrderAmount") {
    patch.minOrderAmount = await askOptionalMoney(
      conversation,
      ctx,
      "discount-admin-edit-value-prompt",
    );
  }

  if (field === "maxDiscountAmount") {
    patch.maxDiscountAmount = await askOptionalMoney(
      conversation,
      ctx,
      "discount-admin-edit-value-prompt",
    );
  }

  if (field === "startsAt") {
    patch.startsAt = await askOptionalDate(
      conversation,
      ctx,
      "discount-admin-edit-value-prompt",
    );
  }

  if (field === "endsAt") {
    patch.endsAt = await askOptionalDate(
      conversation,
      ctx,
      "discount-admin-edit-value-prompt",
    );
  }

  if (field === "totalUsageLimit") {
    patch.totalUsageLimit = await askOptionalUsageLimit(
      conversation,
      ctx,
      "discount-admin-edit-value-prompt",
    );
  }

  if (field === "perUserUsageLimit") {
    patch.perUserUsageLimit = await askOptionalUsageLimit(
      conversation,
      ctx,
      "discount-admin-edit-value-prompt",
    );
  }

  if (field === "firstPurchaseOnly") {
    const raw = await ask(
      conversation,
      ctx,
      "discount-admin-edit-value-prompt",
    );
    patch.firstPurchaseOnly = isAffirmative(raw);
  }

  if (field === "isActive") {
    const raw = await ask(
      conversation,
      ctx,
      "discount-admin-edit-value-prompt",
    );
    patch.isActive = isTruthy(raw);
  }

  if (field === "serviceScope") {
    serviceIds = parseServiceScope(
      await ask(conversation, ctx, "discount-admin-edit-value-prompt"),
    );
  }

  if (Object.keys(patch).length === 0 && serviceIds === undefined) {
    await ctx.reply(ctx.t("discount-admin-error-field"));
    return;
  }

  let updated: Awaited<ReturnType<typeof updateDiscountCode>>;
  try {
    updated = await conversation.external(() =>
      updateDiscountCode(id, patch, String(ctx.from?.id), serviceIds),
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      await ctx.reply(ctx.t("discount-admin-error-code-exists"));
      return;
    }
    throw error;
  }

  if (!updated) {
    await ctx.reply(ctx.t("discount-admin-not-found"));
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

  await ctx.reply(
    ctx.t("discount-admin-updated", {
      code: updated.code,
    }),
  );
}

export async function deactivateDiscountConversation(
  conversation: Conversation<BotContext, ConversationContext>,
  ctx: ConversationContext,
): Promise<void> {
  if (!ctx.isAdmin) {
    await ctx.reply(ctx.t("admin-denied"));
    return;
  }

  const discounts = await conversation.external(() => listDiscountCodes());
  if (discounts.length === 0) {
    await ctx.reply(ctx.t("discount-admin-empty"));
    return;
  }

  await ctx.reply(formatDiscountList(ctx, discounts));

  const id = await ask(
    conversation,
    ctx,
    "discount-admin-deactivate-id-prompt",
  );
  const confirmation = await ask(
    conversation,
    ctx,
    "discount-admin-deactivate-confirm-prompt",
  );

  if (!isAffirmative(confirmation)) {
    await ctx.reply(ctx.t("action-cancelled"));
    return;
  }

  const updated = await conversation.external(() =>
    updateDiscountCode(id, { isActive: false }, String(ctx.from?.id)),
  );
  if (!updated) {
    await ctx.reply(ctx.t("discount-admin-not-found"));
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

  await ctx.reply(
    ctx.t("discount-admin-deactivated", {
      code: updated.code,
    }),
  );
}
