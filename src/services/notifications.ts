import { qstash } from "../adapters/upstash.js";
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

  return typeof payload.text === "string" ? payload.text : "";
}

export async function createAndScheduleNotification(input: {
  audience: "user" | "all" | "service_subscribers";
  userId?: string;
  serviceId?: string;
  messageKey: string;
  messagePayload: Record<string, unknown>;
  sendAt: Date;
  createdBy: string;
  skipQueue?: boolean;
}): Promise<{ id: string }> {
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
    sendMessage: (chatId: string | number, text: string) => Promise<unknown>;
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

      await bot.api.sendMessage(user.telegramId, text);
    }

    if (notification.audience === "all") {
      const users = await listAllUsers();
      for (const user of users) {
        await bot.api.sendMessage(user.telegramId, text);
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
          await bot.api.sendMessage(user.telegramId, text);
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
