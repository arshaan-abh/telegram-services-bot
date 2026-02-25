import { qstash } from "../adapters/upstash.js";
import { i18n } from "../bot/i18n.js";
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
import { reconcileExpiredSubscriptions } from "./subscriptions.js";

function renderNotificationText(
  key: string,
  payload: Record<string, unknown>,
  language: "en" | "fa",
): string {
  if (key === "subscription_reminder") {
    return i18n.t(language, "notification-subscription-reminder", {
      serviceTitle: String(payload.serviceTitle),
    });
  }

  if (key === "subscription_ended") {
    return i18n.t(language, "notification-subscription-ended", {
      serviceTitle: String(payload.serviceTitle),
    });
  }

  if (key === "order_queued_admin") {
    return i18n.t(language, "notification-order-queued-admin", {
      orderId: String(payload.orderId),
    });
  }

  if (key === "order_approved_user") {
    return i18n.t(language, "notification-order-approved-user", {
      expiry: String(payload.expiry),
    });
  }

  if (key === "order_dismissed_user") {
    return i18n.t(language, "notification-order-dismissed-user", {
      reason: String(payload.reason),
    });
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

  const viewText = i18n.t(language, "admin-action-view");
  const doneText = i18n.t(language, "admin-action-done");
  const dismissText = i18n.t(language, "admin-action-dismiss");
  const contactText = i18n.t(language, "admin-action-contact");

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

function requiredString(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getPayloadError(messageKey: string, payload: Record<string, unknown>) {
  if (messageKey === "subscription_reminder") {
    return requiredString(payload, "serviceTitle")
      ? null
      : "subscription_reminder.serviceTitle";
  }

  if (messageKey === "subscription_ended") {
    return requiredString(payload, "serviceTitle")
      ? null
      : "subscription_ended.serviceTitle";
  }

  if (messageKey === "order_queued_admin") {
    return requiredString(payload, "orderId")
      ? null
      : "order_queued_admin.orderId";
  }

  if (messageKey === "order_approved_user") {
    return requiredString(payload, "expiry")
      ? null
      : "order_approved_user.expiry";
  }

  if (messageKey === "order_dismissed_user") {
    return requiredString(payload, "reason")
      ? null
      : "order_dismissed_user.reason";
  }

  return null;
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
  await reconcileExpiredSubscriptions();

  const notification = await getNotificationById(notificationId);
  if (!notification || notification.state !== "pending") {
    return;
  }

  const payloadError = getPayloadError(
    notification.messageKey,
    notification.messagePayload,
  );
  if (payloadError) {
    await markNotificationFailed(
      notification.id,
      decorateFailureReason(`invalid_payload.${payloadError}`, metadata),
    );
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

export type DismissNotificationResult =
  | "dismissed"
  | "not_found"
  | "not_pending";

export async function dismissPendingNotification(
  id: string,
): Promise<DismissNotificationResult> {
  const notification = await getNotificationById(id);
  if (!notification) {
    return "not_found";
  }

  if (notification.state !== "pending") {
    return "not_pending";
  }

  await cancelNotification(id);
  return "dismissed";
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
