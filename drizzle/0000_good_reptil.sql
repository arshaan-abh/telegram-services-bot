CREATE TYPE "public"."credit_ledger_type" AS ENUM('referral_reward', 'spend', 'admin_adjustment');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('percent', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."notification_audience" AS ENUM('user', 'all', 'service_subscribers');--> statement-breakpoint
CREATE TYPE "public"."notification_state" AS ENUM('pending', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('draft', 'awaiting_proof', 'awaiting_admin_review', 'approved', 'dismissed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'expired');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_telegram_id" text NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "credit_ledger_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"balance_after" numeric(12, 2) NOT NULL,
	"order_id" uuid,
	"note" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_ledger_balance_non_negative" CHECK ("credit_ledger"."balance_after" >= 0)
);
--> statement-breakpoint
CREATE TABLE "discount_code_services" (
	"discount_code_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discount_code_services_discount_code_id_service_id_pk" PRIMARY KEY("discount_code_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "discount_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"type" "discount_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"min_order_amount" numeric(12, 2),
	"max_discount_amount" numeric(12, 2),
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"total_usage_limit" integer,
	"per_user_usage_limit" integer,
	"first_purchase_only" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discount_codes_code_unique" UNIQUE("code"),
	CONSTRAINT "discount_codes_amount_non_negative" CHECK ("discount_codes"."amount" >= 0),
	CONSTRAINT "discount_codes_total_usage_limit_positive" CHECK ("discount_codes"."total_usage_limit" is null or "discount_codes"."total_usage_limit" > 0),
	CONSTRAINT "discount_codes_per_user_usage_limit_positive" CHECK ("discount_codes"."per_user_usage_limit" is null or "discount_codes"."per_user_usage_limit" > 0),
	CONSTRAINT "discount_codes_max_discount_non_negative" CHECK ("discount_codes"."max_discount_amount" is null or "discount_codes"."max_discount_amount" >= 0),
	CONSTRAINT "discount_codes_min_order_non_negative" CHECK ("discount_codes"."min_order_amount" is null or "discount_codes"."min_order_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "discount_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discount_code_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"discount_amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" "notification_state" DEFAULT 'pending' NOT NULL,
	"audience" "notification_audience" NOT NULL,
	"user_id" uuid,
	"service_id" uuid,
	"message_key" text NOT NULL,
	"message_payload" jsonb NOT NULL,
	"send_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_reason" text,
	"qstash_message_id" text,
	"idempotency_key" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"field_profile_id" uuid,
	"status" "order_status" DEFAULT 'draft' NOT NULL,
	"needed_field_values" jsonb NOT NULL,
	"base_price" numeric(12, 2) NOT NULL,
	"discount_amount" numeric(12, 2) NOT NULL,
	"credit_amount" numeric(12, 2) NOT NULL,
	"payable_amount" numeric(12, 2) NOT NULL,
	"discounted_amount" numeric(12, 2) NOT NULL,
	"discount_code_id" uuid,
	"discount_code_text" text,
	"proof_file_id" text,
	"proof_mime" text,
	"proof_size_bytes" integer,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"dismiss_reason" text,
	"admin_action_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_base_price_non_negative" CHECK ("orders"."base_price" >= 0),
	CONSTRAINT "orders_discount_amount_non_negative" CHECK ("orders"."discount_amount" >= 0),
	CONSTRAINT "orders_credit_amount_non_negative" CHECK ("orders"."credit_amount" >= 0),
	CONSTRAINT "orders_payable_amount_non_negative" CHECK ("orders"."payable_amount" >= 0),
	CONSTRAINT "orders_discounted_amount_non_negative" CHECK ("orders"."discounted_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inviter_user_id" uuid NOT NULL,
	"invitee_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referrals_invitee_user_id_unique" UNIQUE("invitee_user_id"),
	CONSTRAINT "referrals_invitee_unique" UNIQUE("invitee_user_id")
);
--> statement-breakpoint
CREATE TABLE "service_field_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"values" jsonb NOT NULL,
	"checksum" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_field_profiles_user_service_checksum_unique" UNIQUE("user_id","service_id","checksum")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"description" text,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"needed_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"duration_days" smallint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_price_non_negative" CHECK ("services"."price" >= 0),
	CONSTRAINT "services_duration_days_bounds" CHECK ("services"."duration_days" between 1 and 255)
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"field_profile_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"duration_days" smallint NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_duration_bounds" CHECK ("subscriptions"."duration_days" between 1 and 255)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_id" text NOT NULL,
	"username" text,
	"first_name" text NOT NULL,
	"last_name" text,
	"referral_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id"),
	CONSTRAINT "users_referral_token_unique" UNIQUE("referral_token")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_code_services" ADD CONSTRAINT "discount_code_services_discount_code_id_discount_codes_id_fk" FOREIGN KEY ("discount_code_id") REFERENCES "public"."discount_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_code_services" ADD CONSTRAINT "discount_code_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_discount_code_id_discount_codes_id_fk" FOREIGN KEY ("discount_code_id") REFERENCES "public"."discount_codes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_field_profile_id_service_field_profiles_id_fk" FOREIGN KEY ("field_profile_id") REFERENCES "public"."service_field_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_code_id_discount_codes_id_fk" FOREIGN KEY ("discount_code_id") REFERENCES "public"."discount_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_invitee_user_id_users_id_fk" FOREIGN KEY ("invitee_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_field_profiles" ADD CONSTRAINT "service_field_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_field_profiles" ADD CONSTRAINT "service_field_profiles_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_field_profile_id_service_field_profiles_id_fk" FOREIGN KEY ("field_profile_id") REFERENCES "public"."service_field_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "credit_ledger_user_idx" ON "credit_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "discount_code_services_service_idx" ON "discount_code_services" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "discount_codes_code_idx" ON "discount_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "discount_redemptions_user_discount_idx" ON "discount_redemptions" USING btree ("user_id","discount_code_id");--> statement-breakpoint
CREATE INDEX "discount_redemptions_discount_idx" ON "discount_redemptions" USING btree ("discount_code_id");--> statement-breakpoint
CREATE INDEX "notifications_state_send_at_idx" ON "notifications" USING btree ("state","send_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_service_idx" ON "orders" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "orders_pending_admin_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "referrals_inviter_idx" ON "referrals" USING btree ("inviter_user_id");--> statement-breakpoint
CREATE INDEX "service_field_profiles_user_service_idx" ON "service_field_profiles" USING btree ("user_id","service_id");--> statement-breakpoint
CREATE INDEX "services_active_idx" ON "services" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "subscriptions_active_idx" ON "subscriptions" USING btree ("status","user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_service_idx" ON "subscriptions" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "users_telegram_id_idx" ON "users" USING btree ("telegram_id");