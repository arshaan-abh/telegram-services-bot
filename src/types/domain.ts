export type Role = "user" | "admin";

export type OrderStatus =
  | "draft"
  | "awaiting_proof"
  | "awaiting_admin_review"
  | "approved"
  | "dismissed"
  | "cancelled";

export type SubscriptionStatus = "active" | "expired";

export type NotificationState = "pending" | "sent" | "failed" | "cancelled";

export type DiscountType = "percent" | "fixed";

export type Service = {
  id: string;
  title: string;
  price: string;
  priceUnit: string;
  description: string | null;
  notes: string[];
  neededFields: string[];
  durationDays: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type NeededFieldValues = Record<string, string>;

export type NotificationAudience =
  | { type: "user"; userId: string }
  | { type: "all" }
  | { type: "service_subscribers"; serviceId: string };
