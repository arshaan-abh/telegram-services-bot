import { InlineKeyboard } from "grammy";

import { CALLBACKS } from "../../config/constants.js";
import { env } from "../../config/env.js";
import {
  createAuditLog,
  listRecentAuditLogs,
} from "../../db/repositories/audit.js";
import { listPendingOrders } from "../../db/repositories/orders.js";
import {
  getUserByTelegramId,
  upsertTelegramUser,
} from "../../db/repositories/users.js";
import {
  createAndDispatchImmediateNotification,
  createAndScheduleNotification,
  dispatchNotificationById,
} from "../../services/notifications.js";
import type { BotContext } from "../context.js";
import { formatAdminOrderFields, withProcessingMessage } from "../messages.js";

export function ensureAdmin(ctx: BotContext): boolean {
  if (!ctx.isAdmin) {
    void ctx.reply(ctx.t("admin-denied"));
    return false;
  }

  return true;
}

export async function sendPendingOrders(ctx: BotContext): Promise<void> {
  if (!ensureAdmin(ctx)) {
    return;
  }

  await withProcessingMessage(ctx, async () => {
    const pending = await listPendingOrders();
    if (pending.length === 0) {
      await ctx.reply(ctx.t("admin-pending-empty"));
      return;
    }

    await ctx.reply(ctx.t("admin-pending-title"));

    for (const entry of pending) {
      const fields = formatAdminOrderFields(entry.order.neededFieldValues);
      const userName = entry.username ?? entry.firstName;
      const mentionLink = `tg://user?id=${entry.userTelegramId}`;
      const discountCode = entry.order.discountCodeText ?? "-";
      const proofSummary = entry.order.proofFileId
        ? ctx.t("admin-proof-summary", {
            mime: entry.order.proofMime ?? "image",
            size: String(entry.order.proofSizeBytes ?? "-"),
          })
        : ctx.t("common-none");

      const text = ctx.t("admin-order-card", {
        orderId: entry.order.id,
        user: `${userName} (${entry.userTelegramId})`,
        service: entry.serviceTitle,
        base: entry.order.basePrice,
        discount: entry.order.discountAmount,
        credit: entry.order.creditAmount,
        payable: entry.order.payableAmount,
        unit: env.PRICE_UNIT,
        fields,
      });
      const enrichedText = `${text}\n${ctx.t("admin-order-extra", {
        username: entry.username ?? "-",
        link: mentionLink,
        discountCode,
        proof: proofSummary,
      })}`;

      const keyboard = new InlineKeyboard()
        .text(
          ctx.t("admin-action-done"),
          CALLBACKS.adminOrderDone(entry.order.id),
        )
        .text(
          ctx.t("admin-action-dismiss"),
          CALLBACKS.adminOrderDismiss(entry.order.id),
        )
        .row()
        .text(
          ctx.t("admin-action-contact"),
          CALLBACKS.adminOrderContact(entry.order.id),
        );

      await ctx.reply(enrichedText, {
        reply_markup: keyboard,
      });

      if (entry.order.proofFileId && ctx.chat?.id) {
        try {
          await ctx.api.sendPhoto(ctx.chat.id, entry.order.proofFileId, {
            caption: ctx.t("admin-proof-caption", { orderId: entry.order.id }),
          });
        } catch {
          await ctx.api.sendDocument(ctx.chat.id, entry.order.proofFileId, {
            caption: ctx.t("admin-proof-caption", { orderId: entry.order.id }),
          });
        }
      }
    }
  });
}

export async function notifyAdminOrderQueued(
  ctx: BotContext,
  orderId: string,
): Promise<void> {
  let admin = await getUserByTelegramId(env.ADMIN_TELEGRAM_ID);
  if (!admin) {
    admin = await upsertTelegramUser({
      telegramId: env.ADMIN_TELEGRAM_ID,
      firstName: "Admin",
      lastName: null,
      username: null,
    });
  }

  await createAndDispatchImmediateNotification(ctx, {
    audience: "user",
    userId: admin.id,
    messageKey: "order_queued_admin",
    messagePayload: { orderId },
    createdBy: String(ctx.from?.id ?? env.ADMIN_TELEGRAM_ID),
    metadata: {
      retryCount: 0,
      qstashMessageId: null,
    },
  });
}

export async function sendAuditQuickView(ctx: BotContext): Promise<void> {
  if (!ensureAdmin(ctx)) {
    return;
  }

  const logs = await listRecentAuditLogs(10);
  if (logs.length === 0) {
    await ctx.reply(ctx.t("admin-audit-empty"));
    return;
  }

  const lines = logs.map(
    (log) =>
      `${log.createdAt.toISOString()} | ${log.action} | ${log.entityType}:${log.entityId}`,
  );
  await ctx.reply(lines.join("\n"));
}

export async function scheduleAdminNotification(input: {
  ctx: BotContext;
  audience: "user" | "all" | "service_subscribers";
  text: string;
  sendAt: Date;
  immediate?: boolean;
  userId?: string;
  serviceId?: string;
}) {
  if (!ensureAdmin(input.ctx)) {
    return;
  }

  const created = await createAndScheduleNotification({
    audience: input.audience,
    userId: input.userId,
    serviceId: input.serviceId,
    messageKey: "admin_custom",
    messagePayload: {
      text: input.text,
    },
    sendAt: input.sendAt,
    createdBy: String(input.ctx.from?.id ?? env.ADMIN_TELEGRAM_ID),
    skipQueue: input.immediate === true,
  });

  if (input.immediate) {
    await dispatchNotificationById(input.ctx, created.id, {
      retryCount: 0,
      qstashMessageId: null,
    });
  }

  await createAuditLog({
    actorTelegramId: String(input.ctx.from?.id ?? env.ADMIN_TELEGRAM_ID),
    actorUserId: input.ctx.dbUserId,
    action: "notification.create",
    entityType: "notification",
    entityId: "manual",
    metadata: {
      audience: input.audience,
      sendAt: input.sendAt.toISOString(),
      immediate: input.immediate === true,
    },
  });

  await input.ctx.reply(
    input.immediate
      ? input.ctx.t("notification-sent")
      : input.ctx.t("notification-created"),
  );
}
