CREATE TABLE "appointment_availability" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"appointment_duration" integer DEFAULT 30 NOT NULL,
	"buffer_time" integer DEFAULT 0 NOT NULL,
	"min_advance_time" integer DEFAULT 60 NOT NULL,
	"max_advance_days" integer DEFAULT 30 NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"weekly_availability" jsonb DEFAULT '{"monday":{"enabled":true,"slots":[{"start":"09:00","end":"17:00"}]},"tuesday":{"enabled":true,"slots":[{"start":"09:00","end":"17:00"}]},"wednesday":{"enabled":true,"slots":[{"start":"09:00","end":"17:00"}]},"thursday":{"enabled":true,"slots":[{"start":"09:00","end":"17:00"}]},"friday":{"enabled":true,"slots":[{"start":"09:00","end":"17:00"}]},"saturday":{"enabled":false,"slots":[]},"sunday":{"enabled":false,"slots":[]}}'::jsonb NOT NULL,
	"date_overrides" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"client_name" text NOT NULL,
	"appointment_date" text NOT NULL,
	"appointment_time" text NOT NULL,
	"phone" text,
	"email" text,
	"notes" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "birthday_greeting_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"company_id" varchar NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_phone" text NOT NULL,
	"recipient_date_of_birth" text NOT NULL,
	"message" text NOT NULL,
	"image_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"twilio_message_sid" text,
	"twilio_image_sid" text,
	"error_message" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "birthday_images" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"image_url" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"uploaded_by" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "birthday_pending_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"greeting_history_id" varchar NOT NULL,
	"mms_sid" text,
	"sms_body" text NOT NULL,
	"recipient_phone" text NOT NULL,
	"recipient_name" text NOT NULL,
	"image_url" text,
	"status" text DEFAULT 'pending_mms' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "birthday_pending_messages_mms_sid_unique" UNIQUE("mms_sid")
);
--> statement-breakpoint
CREATE TABLE "bulkvs_campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"name" text NOT NULL,
	"provider_id" text,
	"brand_id" text,
	"use_case" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulkvs_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" varchar NOT NULL,
	"direction" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"from" text NOT NULL,
	"to" text NOT NULL,
	"body" text,
	"media_url" text,
	"media_type" text,
	"provider_msg_id" text,
	"error_code" text,
	"error_message" text,
	"read_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulkvs_phone_numbers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"company_id" varchar NOT NULL,
	"did" text NOT NULL,
	"display_name" text,
	"cnam" text,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"mms_enabled" boolean DEFAULT false NOT NULL,
	"campaign_id" text,
	"webhook_name" text,
	"webhook_token" text,
	"webhook_url" text,
	"call_forward_enabled" boolean DEFAULT false NOT NULL,
	"call_forward_number" text,
	"area_code" text,
	"rate_center" text,
	"state" text,
	"status" text DEFAULT 'active' NOT NULL,
	"monthly_price" text DEFAULT '10.00' NOT NULL,
	"stripe_subscription_id" text,
	"stripe_product_id" text,
	"stripe_price_id" text,
	"next_billing_date" timestamp,
	"billing_status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bulkvs_phone_numbers_did_unique" UNIQUE("did")
);
--> statement-breakpoint
CREATE TABLE "bulkvs_threads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"company_id" varchar NOT NULL,
	"external_phone" text NOT NULL,
	"display_name" text,
	"labels" text[] DEFAULT '{}',
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"is_muted" boolean DEFAULT false NOT NULL,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone,
	"last_message_preview" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imessage_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"chat_guid" text NOT NULL,
	"display_name" text,
	"participants" text[],
	"contact_name" text,
	"contact_phone" text,
	"contact_email" text,
	"status" text DEFAULT 'active' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_group" boolean DEFAULT false NOT NULL,
	"is_imessage" boolean DEFAULT true,
	"assigned_to" varchar,
	"last_message_text" text,
	"last_message_at" timestamp,
	"last_message_from_me" boolean DEFAULT false,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "imessage_conversations_company_id_chat_guid_unique" UNIQUE("company_id","chat_guid")
);
--> statement-breakpoint
CREATE TABLE "imessage_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"company_id" varchar NOT NULL,
	"message_guid" text NOT NULL,
	"chat_guid" text NOT NULL,
	"text" text,
	"subject" text,
	"from_me" boolean DEFAULT false NOT NULL,
	"sender_handle" text,
	"sender_name" text,
	"status" text DEFAULT 'sent' NOT NULL,
	"error_message" text,
	"is_imessage" boolean DEFAULT true,
	"has_attachments" boolean DEFAULT false NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"expressive_type" text,
	"reaction_type" text,
	"reply_to_guid" text,
	"date_sent" timestamp,
	"date_read" timestamp,
	"date_delivered" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "imessage_messages_company_id_message_guid_unique" UNIQUE("company_id","message_guid")
);
--> statement-breakpoint
CREATE TABLE "landing_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"landing_page_id" varchar NOT NULL,
	"block_id" varchar,
	"event_type" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landing_appointments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"landing_page_id" varchar NOT NULL,
	"block_id" varchar,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"appointment_date" text NOT NULL,
	"appointment_time" text NOT NULL,
	"duration" integer DEFAULT 30 NOT NULL,
	"notes" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landing_blocks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"landing_page_id" varchar NOT NULL,
	"type" text NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb,
	"position" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landing_leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"landing_page_id" varchar NOT NULL,
	"block_id" varchar,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"message" text,
	"form_data" jsonb DEFAULT '{}'::jsonb,
	"source" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landing_pages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"profile_name" text,
	"profile_bio" text,
	"profile_photo" text,
	"profile_phone" text,
	"profile_email" text,
	"theme" jsonb DEFAULT '{"layout":"list","primaryColor":"#8B5CF6","backgroundColor":"#ffffff","textColor":"#1a1a1a","fontFamily":"Inter","fontWeight":"regular","buttonStyle":"rounded","buttonColor":"#8B5CF6","buttonTextColor":"#ffffff","backgroundImage":null,"backgroundGradient":null}'::jsonb,
	"seo" jsonb DEFAULT '{"title":"","description":"","ogImage":null}'::jsonb,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_password_protected" boolean DEFAULT false NOT NULL,
	"password" text,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "landing_pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "manual_birthdays" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"client_name" text NOT NULL,
	"date_of_birth" date NOT NULL,
	"role" text NOT NULL,
	"quote_id" varchar(8),
	"policy_id" varchar(8),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_folder_assignments" (
	"policy_id" varchar(8) PRIMARY KEY NOT NULL,
	"folder_id" varchar NOT NULL,
	"assigned_by" varchar NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_folders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" varchar(8) NOT NULL,
	"company_id" varchar NOT NULL,
	"source" text DEFAULT 'marketplace' NOT NULL,
	"plan_data" jsonb NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standalone_reminders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"due_date" date NOT NULL,
	"due_time" text NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"set_reminder_before" text,
	"reminder_type" text NOT NULL,
	"notify_user_ids" text[],
	"is_private" boolean DEFAULT false NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"quote_id" varchar(8),
	"policy_id" varchar(8),
	"completed_at" timestamp,
	"completed_by" varchar,
	"snoozed_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"creator_id" varchar NOT NULL,
	"assignee_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"due_date" text NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_birthday_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"selected_image_id" varchar,
	"custom_message" text DEFAULT 'Happy Birthday! Wishing you a wonderful day filled with joy and happiness!',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_birthday_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "policies" ALTER COLUMN "status" SET DEFAULT 'new';--> statement-breakpoint
ALTER TABLE "policy_consent_documents" ALTER COLUMN "token" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "imessage_settings" jsonb DEFAULT '{"serverUrl":"","password":"","isEnabled":false,"webhookSecret":""}'::jsonb;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "member_id" text;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "npn_marketplace" text;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "sale_type" text;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "marketplace_id" text;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "ffm_marketplace" text;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "special_enrollment_reason" text;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "cancellation_date" date;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "special_enrollment_date" date;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "documents_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "payment_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "aptc_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "aptc_source" text;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "aptc_captured_at" timestamp;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "is_blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "blocked_by" varchar;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "blocked_at" timestamp;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "renewal_target_year" integer;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "renewal_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "renewed_from_policy_id" varchar(8);--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "renewed_to_policy_id" varchar(8);--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "renewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "documents_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "payment_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "aptc_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "aptc_source" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "aptc_captured_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "view_all_company_data" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment_availability" ADD CONSTRAINT "appointment_availability_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_greeting_history" ADD CONSTRAINT "birthday_greeting_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_greeting_history" ADD CONSTRAINT "birthday_greeting_history_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_images" ADD CONSTRAINT "birthday_images_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_pending_messages" ADD CONSTRAINT "birthday_pending_messages_greeting_history_id_birthday_greeting_history_id_fk" FOREIGN KEY ("greeting_history_id") REFERENCES "public"."birthday_greeting_history"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulkvs_campaigns" ADD CONSTRAINT "bulkvs_campaigns_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulkvs_messages" ADD CONSTRAINT "bulkvs_messages_thread_id_bulkvs_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."bulkvs_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulkvs_phone_numbers" ADD CONSTRAINT "bulkvs_phone_numbers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulkvs_phone_numbers" ADD CONSTRAINT "bulkvs_phone_numbers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulkvs_threads" ADD CONSTRAINT "bulkvs_threads_phone_number_id_bulkvs_phone_numbers_id_fk" FOREIGN KEY ("phone_number_id") REFERENCES "public"."bulkvs_phone_numbers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulkvs_threads" ADD CONSTRAINT "bulkvs_threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulkvs_threads" ADD CONSTRAINT "bulkvs_threads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imessage_conversations" ADD CONSTRAINT "imessage_conversations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imessage_conversations" ADD CONSTRAINT "imessage_conversations_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imessage_messages" ADD CONSTRAINT "imessage_messages_conversation_id_imessage_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."imessage_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imessage_messages" ADD CONSTRAINT "imessage_messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_analytics" ADD CONSTRAINT "landing_analytics_landing_page_id_landing_pages_id_fk" FOREIGN KEY ("landing_page_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_analytics" ADD CONSTRAINT "landing_analytics_block_id_landing_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."landing_blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_appointments" ADD CONSTRAINT "landing_appointments_landing_page_id_landing_pages_id_fk" FOREIGN KEY ("landing_page_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_appointments" ADD CONSTRAINT "landing_appointments_block_id_landing_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."landing_blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_blocks" ADD CONSTRAINT "landing_blocks_landing_page_id_landing_pages_id_fk" FOREIGN KEY ("landing_page_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_leads" ADD CONSTRAINT "landing_leads_landing_page_id_landing_pages_id_fk" FOREIGN KEY ("landing_page_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_leads" ADD CONSTRAINT "landing_leads_block_id_landing_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."landing_blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_birthdays" ADD CONSTRAINT "manual_birthdays_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_birthdays" ADD CONSTRAINT "manual_birthdays_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_birthdays" ADD CONSTRAINT "manual_birthdays_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_birthdays" ADD CONSTRAINT "manual_birthdays_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_contacts" ADD CONSTRAINT "manual_contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_contacts" ADD CONSTRAINT "manual_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_folder_assignments" ADD CONSTRAINT "policy_folder_assignments_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_folder_assignments" ADD CONSTRAINT "policy_folder_assignments_folder_id_policy_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."policy_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_folder_assignments" ADD CONSTRAINT "policy_folder_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_folders" ADD CONSTRAINT "policy_folders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_folders" ADD CONSTRAINT "policy_folders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_plans" ADD CONSTRAINT "policy_plans_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_plans" ADD CONSTRAINT "policy_plans_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standalone_reminders" ADD CONSTRAINT "standalone_reminders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standalone_reminders" ADD CONSTRAINT "standalone_reminders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standalone_reminders" ADD CONSTRAINT "standalone_reminders_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standalone_reminders" ADD CONSTRAINT "standalone_reminders_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standalone_reminders" ADD CONSTRAINT "standalone_reminders_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_birthday_settings" ADD CONSTRAINT "user_birthday_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_birthday_settings" ADD CONSTRAINT "user_birthday_settings_selected_image_id_birthday_images_id_fk" FOREIGN KEY ("selected_image_id") REFERENCES "public"."birthday_images"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "imessage_conversations_company_id_idx" ON "imessage_conversations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "imessage_conversations_chat_guid_idx" ON "imessage_conversations" USING btree ("chat_guid");--> statement-breakpoint
CREATE INDEX "imessage_conversations_assigned_to_idx" ON "imessage_conversations" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "imessage_conversations_updated_at_idx" ON "imessage_conversations" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "imessage_messages_conversation_id_idx" ON "imessage_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "imessage_messages_company_id_idx" ON "imessage_messages" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "imessage_messages_chat_guid_idx" ON "imessage_messages" USING btree ("chat_guid");--> statement-breakpoint
CREATE INDEX "imessage_messages_company_message_guid_idx" ON "imessage_messages" USING btree ("company_id","message_guid");--> statement-breakpoint
CREATE INDEX "imessage_messages_date_sent_idx" ON "imessage_messages" USING btree ("date_sent");--> statement-breakpoint
CREATE INDEX "imessage_messages_conversation_date_idx" ON "imessage_messages" USING btree ("conversation_id","date_sent");--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_blocked_by_users_id_fk" FOREIGN KEY ("blocked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_renewed_from_policy_id_policies_id_fk" FOREIGN KEY ("renewed_from_policy_id") REFERENCES "public"."policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_renewed_to_policy_id_policies_id_fk" FOREIGN KEY ("renewed_to_policy_id") REFERENCES "public"."policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "policies_updated_at_idx" ON "policies" USING btree ("updated_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_slug_unique" UNIQUE("slug");