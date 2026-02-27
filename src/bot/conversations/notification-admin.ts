import { Conversation } from "@grammyjs/conversations";
import { z } from "zod";

import { listAllServices } from "../../db/repositories/services.js";
import { getUserByTelegramId } from "../../db/repositories/users.js";
import type { BotContext, ConversationContext } from "../context.js";
import { scheduleAdminNotification } from "../handlers/admin.js";

const audienceSchema = z.enum(["user", "all", "service_subscribers"]);
const isoDateTimeSchema = z.string().datetime({ offset: true });

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

export async function adminNotificationConversation(
  conversation: Conversation<BotContext, ConversationContext>,
  ctx: ConversationContext,
): Promise<void> {
  if (!ctx.isAdmin) {
    await ctx.reply(ctx.t("admin-denied"));
    return;
  }

  let audience: z.infer<typeof audienceSchema>;
  while (true) {
    const audienceRaw = (
      await ask(conversation, ctx, "notification-admin-audience-prompt")
    ).toLowerCase();
    const parsedAudience = audienceSchema.safeParse(audienceRaw);
    if (parsedAudience.success) {
      audience = parsedAudience.data;
      break;
    }
    await ctx.reply(ctx.t("notification-admin-invalid-audience"));
  }

  let targetUserId: string | undefined;
  let targetServiceId: string | undefined;

  if (audience === "user") {
    while (true) {
      const telegramId = await ask(
        conversation,
        ctx,
        "notification-admin-target-user-prompt",
      );
      const user = await conversation.external(() =>
        getUserByTelegramId(telegramId),
      );
      if (user) {
        targetUserId = user.id;
        break;
      }

      await ctx.reply(ctx.t("notification-admin-user-not-found"));
    }
  }

  if (audience === "service_subscribers") {
    const services = await conversation.external(() => listAllServices());
    const rows =
      services.length === 0
        ? ctx.t("notification-admin-service-list-empty")
        : services
            .map((service) =>
              ctx.t("notification-admin-service-row", {
                id: service.id,
                title: service.title,
              }),
            )
            .join("\n");
    await ctx.reply(rows);

    targetServiceId = await ask(
      conversation,
      ctx,
      "notification-admin-service-id-prompt",
    );
  }

  const text = await ask(conversation, ctx, "notification-admin-text-prompt");

  let immediate = false;
  let sendAt = new Date();
  while (true) {
    const when = await ask(
      conversation,
      ctx,
      "notification-admin-send-at-prompt",
    );
    if (when.toUpperCase() === "NOW") {
      immediate = true;
      sendAt = new Date();
      break;
    }

    const parsedWhen = isoDateTimeSchema.safeParse(when);
    if (parsedWhen.success) {
      sendAt = new Date(parsedWhen.data);
      immediate = false;
      break;
    }

    await ctx.reply(ctx.t("notification-admin-invalid-datetime"));
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
