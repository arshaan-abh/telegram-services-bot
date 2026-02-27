import { Conversation } from "@grammyjs/conversations";

import { env } from "../../config/env.js";
import { getOrderWithUserAndService } from "../../db/repositories/orders.js";
import { createAndDispatchImmediateNotification } from "../../services/notifications.js";
import { dismissOrderByAdmin } from "../../services/orders.js";
import type { BotContext, ConversationContext } from "../context.js";

async function waitForText(
  conversation: Conversation<BotContext, ConversationContext>,
): Promise<string> {
  const update = await conversation.waitFor(":text");
  if (!update.message || !("text" in update.message)) {
    await update.reply(update.t("error-generic"));
    return "";
  }

  return update.message.text.trim();
}

export async function dismissOrderConversation(
  conversation: Conversation<BotContext, ConversationContext>,
  ctx: ConversationContext,
  orderId: string,
): Promise<void> {
  if (!ctx.isAdmin) {
    await ctx.reply(ctx.t("admin-denied"));
    return;
  }

  await ctx.reply(ctx.t("admin-dismiss-reason-ask"));
  const reason = await waitForText(conversation);

  if (reason.length === 0) {
    await ctx.reply(ctx.t("error-generic"));
    return;
  }

  await ctx.reply(
    `${ctx.t("admin-dismiss-confirm")}\n\n${reason}\n\n${ctx.t("confirm-yes-prompt")}`,
  );
  const confirmation = (await waitForText(conversation)).toLowerCase();

  if (!["yes", "y", "بله", "اره"].includes(confirmation)) {
    await ctx.reply(ctx.t("dismiss-cancelled"));
    return;
  }

  const order = await conversation.external(() =>
    dismissOrderByAdmin(orderId, String(ctx.from?.id), reason),
  );
  const orderContext = await conversation.external(() =>
    getOrderWithUserAndService(order.id),
  );

  if (orderContext) {
    await conversation.external(() =>
      createAndDispatchImmediateNotification(ctx, {
        audience: "user",
        userId: orderContext.user.id,
        messageKey: "order_dismissed_user",
        messagePayload: {
          reason,
        },
        createdBy: String(ctx.from?.id ?? env.ADMIN_TELEGRAM_ID),
        metadata: {
          retryCount: 0,
          qstashMessageId: null,
        },
      }),
    );
  }

  await ctx.reply(ctx.t("admin-dismiss-confirmed"));
}
