import { Conversation } from "@grammyjs/conversations";

import { listAllServices } from "../../db/repositories/services.js";
import { getUserByTelegramId } from "../../db/repositories/users.js";
import type { BotContext } from "../context.js";
import { scheduleAdminNotification } from "../handlers/admin.js";

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
    await ask(conversation, ctx, "Audience (user|all|service_subscribers):")
  ).toLowerCase();
  if (!["user", "all", "service_subscribers"].includes(audienceRaw)) {
    await ctx.reply("Invalid audience");
    return;
  }

  let targetUserId: string | undefined;
  let targetServiceId: string | undefined;

  if (audienceRaw === "user") {
    const telegramId = await ask(conversation, ctx, "Target user telegram id:");
    const user = await conversation.external(() =>
      getUserByTelegramId(telegramId),
    );
    if (!user) {
      await ctx.reply("User not found");
      return;
    }
    targetUserId = user.id;
  }

  if (audienceRaw === "service_subscribers") {
    const services = await conversation.external(() => listAllServices());
    await ctx.reply(
      services.map((service) => `${service.id} | ${service.title}`).join("\n"),
    );
    const serviceId = await ask(conversation, ctx, "Service id:");
    targetServiceId = serviceId;
  }

  const text = await ask(conversation, ctx, "Notification text:");
  const when = await ask(conversation, ctx, "Send at (ISO date) or NOW:");
  const immediate = when.toUpperCase() === "NOW";
  const sendAt = immediate ? new Date() : new Date(when);

  await conversation.external(() =>
    scheduleAdminNotification({
      ctx,
      audience: audienceRaw as "user" | "all" | "service_subscribers",
      text,
      sendAt,
      immediate,
      userId: targetUserId,
      serviceId: targetServiceId,
    }),
  );
}
