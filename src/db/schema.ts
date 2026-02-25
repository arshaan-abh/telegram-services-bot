import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const orderStatusEnum = pgEnum("order_status", [
  "draft",
  "awaiting_proof",
  "awaiting_admin_review",
  "approved",
  "dismissed",
  "cancelled",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "expired",
]);

export const notificationStateEnum = pgEnum("notification_state", [
  "pending",
  "sent",
  "failed",
  "cancelled",
]);

export const discountTypeEnum = pgEnum("discount_type", ["percent", "fixed"]);

export const creditLedgerTypeEnum = pgEnum("credit_ledger_type", [
  "referral_reward",
  "spend",
  "admin_adjustment",
]);

export const notificationAudienceEnum = pgEnum("notification_audience", [
  "user",
  "all",
  "service_subscribers",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    telegramId: text("telegram_id").notNull().unique(),
    username: text("username"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    referralToken: text("referral_token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("users_telegram_id_idx").on(table.telegramId)],
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    description: text("description"),
    notes: jsonb("notes")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    neededFields: jsonb("needed_fields")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    durationDays: smallint("duration_days").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: text("created_by").notNull(),
    updatedBy: text("updated_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("services_active_idx").on(table.isActive),
    check("services_price_non_negative", sql`${table.price} >= 0`),
    check(
      "services_duration_days_bounds",
      sql`${table.durationDays} between 1 and 255`,
    ),
  ],
);

export const serviceFieldProfiles = pgTable(
  "service_field_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    values: jsonb("values").$type<Record<string, string>>().notNull(),
    checksum: text("checksum").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("service_field_profiles_user_service_idx").on(
      table.userId,
      table.serviceId,
    ),
    unique("service_field_profiles_user_service_checksum_unique").on(
      table.userId,
      table.serviceId,
      table.checksum,
    ),
  ],
);

export const discountCodes = pgTable(
  "discount_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull().unique(),
    type: discountTypeEnum("type").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    minOrderAmount: numeric("min_order_amount", { precision: 12, scale: 2 }),
    maxDiscountAmount: numeric("max_discount_amount", {
      precision: 12,
      scale: 2,
    }),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    totalUsageLimit: integer("total_usage_limit"),
    perUserUsageLimit: integer("per_user_usage_limit"),
    firstPurchaseOnly: boolean("first_purchase_only").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: text("created_by").notNull(),
    updatedBy: text("updated_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("discount_codes_code_idx").on(table.code),
    check("discount_codes_amount_non_negative", sql`${table.amount} >= 0`),
    check(
      "discount_codes_total_usage_limit_positive",
      sql`${table.totalUsageLimit} is null or ${table.totalUsageLimit} > 0`,
    ),
    check(
      "discount_codes_per_user_usage_limit_positive",
      sql`${table.perUserUsageLimit} is null or ${table.perUserUsageLimit} > 0`,
    ),
    check(
      "discount_codes_max_discount_non_negative",
      sql`${table.maxDiscountAmount} is null or ${table.maxDiscountAmount} >= 0`,
    ),
    check(
      "discount_codes_min_order_non_negative",
      sql`${table.minOrderAmount} is null or ${table.minOrderAmount} >= 0`,
    ),
    check(
      "discount_codes_percent_amount_range",
      sql`${table.type} <> 'percent' or (${table.amount} >= 0 and ${table.amount} <= 100)`,
    ),
  ],
);

export const discountCodeServices = pgTable(
  "discount_code_services",
  {
    discountCodeId: uuid("discount_code_id")
      .notNull()
      .references(() => discountCodes.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.discountCodeId, table.serviceId] }),
    index("discount_code_services_service_idx").on(table.serviceId),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    fieldProfileId: uuid("field_profile_id").references(
      () => serviceFieldProfiles.id,
      {
        onDelete: "set null",
      },
    ),
    status: orderStatusEnum("status").notNull().default("draft"),
    neededFieldValues: jsonb("needed_field_values")
      .$type<Record<string, string>>()
      .notNull(),
    basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull(),
    discountAmount: numeric("discount_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    creditAmount: numeric("credit_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    payableAmount: numeric("payable_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    discountedAmount: numeric("discounted_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    discountCodeId: uuid("discount_code_id").references(
      () => discountCodes.id,
      {
        onDelete: "set null",
      },
    ),
    discountCodeText: text("discount_code_text"),
    proofFileId: text("proof_file_id"),
    proofMime: text("proof_mime"),
    proofSizeBytes: integer("proof_size_bytes"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    dismissReason: text("dismiss_reason"),
    adminActionBy: text("admin_action_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("orders_user_idx").on(table.userId),
    index("orders_service_idx").on(table.serviceId),
    index("orders_pending_admin_idx").on(table.status, table.createdAt),
    check("orders_base_price_non_negative", sql`${table.basePrice} >= 0`),
    check(
      "orders_discount_amount_non_negative",
      sql`${table.discountAmount} >= 0`,
    ),
    check("orders_credit_amount_non_negative", sql`${table.creditAmount} >= 0`),
    check(
      "orders_payable_amount_non_negative",
      sql`${table.payableAmount} >= 0`,
    ),
    check(
      "orders_discounted_amount_non_negative",
      sql`${table.discountedAmount} >= 0`,
    ),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fieldProfileId: uuid("field_profile_id").references(
      () => serviceFieldProfiles.id,
      {
        onDelete: "set null",
      },
    ),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    durationDays: smallint("duration_days").notNull(),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("subscriptions_active_idx").on(table.status, table.userId),
    index("subscriptions_service_idx").on(table.serviceId),
    check(
      "subscriptions_duration_bounds",
      sql`${table.durationDays} between 1 and 255`,
    ),
  ],
);

export const discountRedemptions = pgTable(
  "discount_redemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discountCodeId: uuid("discount_code_id")
      .notNull()
      .references(() => discountCodes.id, { onDelete: "restrict" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    discountAmount: numeric("discount_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("discount_redemptions_user_discount_idx").on(
      table.userId,
      table.discountCodeId,
    ),
    index("discount_redemptions_discount_idx").on(table.discountCodeId),
  ],
);

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: creditLedgerTypeEnum("type").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    balanceAfter: numeric("balance_after", {
      precision: 12,
      scale: 2,
    }).notNull(),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("credit_ledger_user_idx").on(table.userId, table.createdAt),
    check(
      "credit_ledger_balance_non_negative",
      sql`${table.balanceAfter} >= 0`,
    ),
  ],
);

export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    inviterUserId: uuid("inviter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviteeUserId: uuid("invitee_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("referrals_inviter_idx").on(table.inviterUserId),
    unique("referrals_invitee_unique").on(table.inviteeUserId),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    state: notificationStateEnum("state").notNull().default("pending"),
    audience: notificationAudienceEnum("audience").notNull(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    serviceId: uuid("service_id").references(() => services.id, {
      onDelete: "set null",
    }),
    messageKey: text("message_key").notNull(),
    messagePayload: jsonb("message_payload")
      .$type<Record<string, unknown>>()
      .notNull(),
    sendAt: timestamp("send_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    qstashMessageId: text("qstash_message_id"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("notifications_state_send_at_idx").on(table.state, table.sendAt),
    index("notifications_user_idx").on(table.userId),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorTelegramId: text("actor_telegram_id").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("audit_logs_action_idx").on(table.action, table.createdAt)],
);

export type DbUser = typeof users.$inferSelect;
export type DbService = typeof services.$inferSelect;
export type DbOrder = typeof orders.$inferSelect;
export type DbSubscription = typeof subscriptions.$inferSelect;
export type DbNotification = typeof notifications.$inferSelect;
