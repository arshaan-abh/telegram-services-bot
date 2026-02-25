import { Conversation } from "@grammyjs/conversations";
import { z } from "zod";

import { listAllServices } from "../../db/repositories/services.js";
import { getUserByTelegramId } from "../../db/repositories/users.js";
import type { BotContext } from "../context.js";
import { scheduleAdminNotification } from "../handlers/admin.js";

const audienceSchema = z.enum(["user", "all", "service_subscribers"]);
const isoDateTimeSchema = z.string().datetime({ offset: true });

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

export async function adminNotificationConversation(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
): Promise<void> {
  if (!ctx.isAdmin) {
    await ctx.reply(ctx.t("admin-denied"));
    return;
  }

  const audienceRaw = (
    await ask(conversation, ctx, ctx.t("notification-admin-audience-prompt"))
  ).toLowerCase();
  const parsedAudience = audienceSchema.safeParse(audienceRaw);
  if (!parsedAudience.success) {
    await ctx.reply(ctx.t("notification-admin-invalid-audience"));
    return;
  }
  const audience = parsedAudience.data;

  let targetUserId: string | undefined;
  let targetServiceId: string | undefined;

  if (audience === "user") {
    const telegramId = await ask(
      conversation,
      ctx,
      ctx.t("notification-admin-target-user-prompt"),
    );
    const user = await conversation.external(() =>
      getUserByTelegramId(telegramId),
    );
    if (!user) {
      await ctx.reply(ctx.t("notification-admin-user-not-found"));
      return;
    }
    targetUserId = user.id;
  }

  if (audience === "service_subscribers") {
    const services = await conversation.external(() => listAllServices());
    await ctx.reply(
      services.map((service) => `${service.id} | ${service.title}`).join("\n"),
    );
    const serviceId = await ask(
      conversation,
      ctx,
      ctx.t("notification-admin-service-id-prompt"),
    );
    targetServiceId = serviceId;
  }

  const text = await ask(
    conversation,
    ctx,
    ctx.t("notification-admin-text-prompt"),
  );
  const when = await ask(
    conversation,
    ctx,
    ctx.t("notification-admin-send-at-prompt"),
  );
  const immediate = when.toUpperCase() === "NOW";
  let sendAt = new Date();
  if (!immediate) {
    const parsedWhen = isoDateTimeSchema.safeParse(when);
    if (!parsedWhen.success) {
      await ctx.reply(ctx.t("notification-admin-invalid-datetime"));
      return;
    }
    sendAt = new Date(parsedWhen.data);
  }

  await conversation.external(() =>
    scheduleAdminNotification({
      ctx,
      audience,
      text,
      sendAt,
      immediate,
      userId: targetUserId,
      serviceId: targetServiceId,
    }),
  );
}
