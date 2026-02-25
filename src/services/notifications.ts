import { qstash } from "../adapters/upstash.js";
import { CALLBACKS } from "../config/constants.js";
import { env } from "../config/env.js";
import { createAuditLog } from "../db/repositories/audit.js";
import {
  cancelNotification,
  createNotification,
  findNotificationByIdempotencyKey,
  getNotificationById,
  markNotificationFailed,
  markNotificationSent,
} from "../db/repositories/notifications.js";
import { listSubscribersByService } from "../db/repositories/subscriptions.js";
import { getUserById, listAllUsers } from "../db/repositories/users.js";
import { checksum } from "../utils/hash.js";

function renderNotificationText(
  key: string,
  payload: Record<string, unknown>,
  language: "en" | "fa",
): string {
  if (key === "subscription_reminder") {
    return language === "fa"
      ? `يادآوري: اشتراک ${String(payload.serviceTitle)} شما 3 روز ديگر تمام مي شود.`
      : `Reminder: your ${String(payload.serviceTitle)} subscription expires in 3 days.`;
  }

  if (key === "subscription_ended") {
    return language === "fa"
      ? `اشتراک ${String(payload.serviceTitle)} شما به پايان رسيد.`
      : `Your ${String(payload.serviceTitle)} subscription has ended.`;
  }

  if (key === "order_queued_admin") {
    return language === "fa"
      ? `سفارش جديد در انتظار بررسي: ${String(payload.orderId)}`
      : `New order waiting review: ${String(payload.orderId)}`;
  }

  if (key === "order_approved_user") {
    return language === "fa"
      ? `سرويس شما فعال شد. تاريخ پايان: ${String(payload.expiry)}`
      : `Your service is active now. Expiry: ${String(payload.expiry)}`;
  }

  if (key === "order_dismissed_user") {
    return language === "fa"
      ? `سفارش شما رد شد. دليل: ${String(payload.reason)}`
      : `Your order was dismissed. Reason: ${String(payload.reason)}`;
  }

  return typeof payload.text === "string" ? payload.text : "";
}

type SendMessageOptions = {
  reply_markup?: {
    inline_keyboard: Array<
      Array<{
        text: string;
        callback_data: string;
      }>
    >;
  };
};

function renderNotificationOptions(
  key: string,
  payload: Record<string, unknown>,
  language: "en" | "fa",
): SendMessageOptions | undefined {
  if (key !== "order_queued_admin") {
    return undefined;
  }

  const orderIdRaw = payload.orderId;
  const orderId =
    typeof orderIdRaw === "string" && orderIdRaw.length > 0 ? orderIdRaw : null;
  if (!orderId) {
    return undefined;
  }

  const viewText = language === "fa" ? "مشاهده" : "View";
  const doneText = language === "fa" ? "انجام شد" : "Done";
  const dismissText = language === "fa" ? "رد" : "Dismiss";
  const contactText = language === "fa" ? "ارتباط" : "Contact";

  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: viewText, callback_data: CALLBACKS.adminOrderView(orderId) },
          { text: doneText, callback_data: CALLBACKS.adminOrderDone(orderId) },
        ],
        [
          {
            text: dismissText,
            callback_data: CALLBACKS.adminOrderDismiss(orderId),
          },
          {
            text: contactText,
            callback_data: CALLBACKS.adminOrderContact(orderId),
          },
        ],
      ],
    },
  };
}

export type CreateNotificationInput = {
  audience: "user" | "all" | "service_subscribers";
  userId?: string;
  serviceId?: string;
  messageKey: string;
  messagePayload: Record<string, unknown>;
  sendAt: Date;
  createdBy: string;
  skipQueue?: boolean;
};

export async function createAndScheduleNotification(
  input: CreateNotificationInput,
): Promise<{ id: string }> {
  const idempotencyKey = checksum({
    audience: input.audience,
    userId: input.userId ?? null,
    serviceId: input.serviceId ?? null,
    messageKey: input.messageKey,
    messagePayload: input.messagePayload,
    sendAt: input.sendAt.toISOString(),
  });

  const existing = await findNotificationByIdempotencyKey(idempotencyKey);
  if (existing) {
    return { id: existing.id };
  }

  const notification = await createNotification({
    audience: input.audience,
    userId: input.userId,
    serviceId: input.serviceId,
    messageKey: input.messageKey,
    messagePayload: input.messagePayload,
    sendAt: input.sendAt,
    idempotencyKey,
    createdBy: input.createdBy,
  });

  if (!input.skipQueue) {
    await qstash.publishJSON({
      url: `${env.APP_BASE_URL}/api/qstash/dispatch`,
      body: {
        notificationId: notification.id,
      },
      notBefore: input.sendAt.getTime(),
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  return { id: notification.id };
}

type BotLike = {
  api: {
    sendMessage: (
      chatId: string | number,
      text: string,
      options?: SendMessageOptions,
    ) => Promise<unknown>;
  };
};

type DispatchMetadata = {
  retryCount?: number;
  qstashMessageId?: string | null;
};

function decorateFailureReason(
  reason: string,
  metadata?: DispatchMetadata,
): string {
  const parts: string[] = [];
  if (typeof metadata?.retryCount === "number") {
    parts.push(`retry=${metadata.retryCount}`);
  }
  if (metadata?.qstashMessageId) {
    parts.push(`qstash_message_id=${metadata.qstashMessageId}`);
  }
  parts.push(reason);
  return parts.join("; ");
}

export async function dispatchNotificationById(
  bot: BotLike,
  notificationId: string,
  metadata?: DispatchMetadata,
): Promise<void> {
  const notification = await getNotificationById(notificationId);
  if (!notification || notification.state !== "pending") {
    return;
  }

  const language = env.BOT_LANGUAGE;
  const text = renderNotificationText(
    notification.messageKey,
    notification.messagePayload,
    language,
  );
  const options = renderNotificationOptions(
    notification.messageKey,
    notification.messagePayload,
    language,
  );

  const sendMessage = async (chatId: string | number): Promise<void> => {
    if (options) {
      await bot.api.sendMessage(chatId, text, options);
      return;
    }
    await bot.api.sendMessage(chatId, text);
  };

  try {
    if (notification.audience === "user") {
      if (!notification.userId) {
        await markNotificationFailed(
          notification.id,
          decorateFailureReason("missing_user_id", metadata),
        );
        return;
      }

      const user = await getUserById(notification.userId);
      if (!user) {
        await markNotificationFailed(
          notification.id,
          decorateFailureReason("user_not_found", metadata),
        );
        return;
      }

      await sendMessage(user.telegramId);
    }

    if (notification.audience === "all") {
      const users = await listAllUsers();
      for (const user of users) {
        await sendMessage(user.telegramId);
      }
    }

    if (notification.audience === "service_subscribers") {
      if (!notification.serviceId) {
        await markNotificationFailed(
          notification.id,
          decorateFailureReason("missing_service_id", metadata),
        );
        return;
      }

      const subscribers = await listSubscribersByService(
        notification.serviceId,
      );
      for (const subscriber of subscribers) {
        const user = await getUserById(subscriber.userId);
        if (user) {
          await sendMessage(user.telegramId);
        }
      }
    }

    await markNotificationSent(
      notification.id,
      metadata?.qstashMessageId ?? null,
    );
    await createAuditLog({
      actorTelegramId: notification.createdBy,
      action: "notification.send",
      entityType: "notification",
      entityId: notification.id,
      metadata: {
        audience: notification.audience,
        messageKey: notification.messageKey,
        retryCount: metadata?.retryCount ?? 0,
        qstashMessageId: metadata?.qstashMessageId ?? null,
      },
    });
  } catch (error) {
    const message = decorateFailureReason((error as Error).message, metadata);
    await markNotificationFailed(notification.id, message);
    await createAuditLog({
      actorTelegramId: notification.createdBy,
      action: "notification.fail",
      entityType: "notification",
      entityId: notification.id,
      metadata: {
        reason: message,
        retryCount: metadata?.retryCount ?? 0,
        qstashMessageId: metadata?.qstashMessageId ?? null,
      },
    });
  }
}

export async function dismissPendingNotification(id: string): Promise<void> {
  await cancelNotification(id);
}

export async function createAndDispatchImmediateNotification(
  bot: BotLike,
  input: Omit<CreateNotificationInput, "sendAt" | "skipQueue"> & {
    sendAt?: Date;
    metadata?: DispatchMetadata;
  },
): Promise<{ id: string }> {
  const created = await createAndScheduleNotification({
    audience: input.audience,
    userId: input.userId,
    serviceId: input.serviceId,
    messageKey: input.messageKey,
    messagePayload: input.messagePayload,
    sendAt: input.sendAt ?? new Date(),
    createdBy: input.createdBy,
    skipQueue: true,
  });

  await dispatchNotificationById(bot, created.id, input.metadata);
  return created;
}
