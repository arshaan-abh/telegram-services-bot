export const CALLBACK_VERSION = "v1" as const;

export const CALLBACKS = {
  servicesList: (page: number) => `${CALLBACK_VERSION}:svc:list:${page}`,
  serviceView: (serviceId: string) =>
    `${CALLBACK_VERSION}:svc:view:${serviceId}`,
  serviceBuy: (serviceId: string) => `${CALLBACK_VERSION}:svc:buy:${serviceId}`,
  buyConfirm: (draftId: string) => `${CALLBACK_VERSION}:buy:confirm:${draftId}`,
  buyEdit: (draftId: string, fieldKey: string) =>
    `${CALLBACK_VERSION}:buy:edit:${draftId}:${fieldKey}`,
  buyCancel: (draftId: string) => `${CALLBACK_VERSION}:buy:cancel:${draftId}`,
  adminOrderView: (orderId: string) =>
    `${CALLBACK_VERSION}:admin:order:view:${orderId}`,
  adminOrderDone: (orderId: string) =>
    `${CALLBACK_VERSION}:admin:order:done:${orderId}`,
  adminOrderDismiss: (orderId: string) =>
    `${CALLBACK_VERSION}:admin:order:dismiss:${orderId}`,
  adminOrderContact: (orderId: string) =>
    `${CALLBACK_VERSION}:admin:order:contact:${orderId}`,
  discountApply: (draftId: string) =>
    `${CALLBACK_VERSION}:discount:apply:${draftId}`,
  notifyDismiss: (notificationId: string) =>
    `${CALLBACK_VERSION}:notify:dismiss:${notificationId}`,
} as const;

export const ORDER_STATUSES = {
  draft: "draft",
  awaitingProof: "awaiting_proof",
  awaitingAdminReview: "awaiting_admin_review",
  approved: "approved",
  dismissed: "dismissed",
  cancelled: "cancelled",
} as const;

export const SUBSCRIPTION_STATUSES = {
  active: "active",
  expired: "expired",
} as const;

export const NOTIFICATION_STATES = {
  pending: "pending",
  sent: "sent",
  failed: "failed",
  cancelled: "cancelled",
} as const;

export const DISCOUNT_TYPES = {
  percent: "percent",
  fixed: "fixed",
} as const;

export const CREDIT_TYPES = {
  referralReward: "referral_reward",
  spend: "spend",
  adminAdjustment: "admin_adjustment",
} as const;

export const AUDIT_ACTIONS = {
  serviceCreate: "service.create",
  serviceUpdate: "service.update",
  serviceDeactivate: "service.deactivate",
  orderApprove: "order.approve",
  orderDismiss: "order.dismiss",
  discountCreate: "discount.create",
  discountUpdate: "discount.update",
  discountDeactivate: "discount.deactivate",
  notificationCreate: "notification.create",
  notificationSend: "notification.send",
} as const;

export const ALLOWED_PROOF_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const REMINDER_DAYS_BEFORE_EXPIRY = 3;
