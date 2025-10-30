CREATE TABLE "activation_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "activation_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "billing_addresses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"full_name" text NOT NULL,
	"address_line_1" text NOT NULL,
	"address_line_2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"postal_code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_addresses_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "broadcast_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"sent_by" varchar NOT NULL,
	"total_recipients" integer DEFAULT 0 NOT NULL,
	"total_read" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_emails" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"bounced_at" timestamp,
	"unsubscribed_at" timestamp,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "campaign_sms_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"phone_number" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"twilio_message_sid" text,
	"error_code" text,
	"error_message" text,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"failed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "campaign_unsubscribes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"unsubscribed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_unsubscribes_campaign_id_user_id_unique" UNIQUE("campaign_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "company_features" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"feature_id" varchar NOT NULL,
	"enabled_at" timestamp DEFAULT now() NOT NULL,
	"enabled_by" varchar
);
--> statement-breakpoint
CREATE TABLE "consent_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quoteId" varchar(8) NOT NULL,
	"companyId" varchar NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"deliveryChannel" text,
	"deliveryTarget" text,
	"token" varchar(8) NOT NULL,
	"signedByName" text,
	"signedByEmail" text,
	"signedByPhone" text,
	"signatureImage" text,
	"signerIp" varchar,
	"signerUserAgent" text,
	"signerTimezone" varchar,
	"signerLocation" varchar,
	"signerPlatform" varchar,
	"signerBrowser" varchar,
	"sentAt" timestamp,
	"viewedAt" timestamp,
	"signedAt" timestamp,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" varchar NOT NULL,
	CONSTRAINT "consent_documents_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "consent_signature_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consentDocumentId" varchar NOT NULL,
	"eventType" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"occurredAt" timestamp DEFAULT now() NOT NULL,
	"actorId" varchar
);
--> statement-breakpoint
CREATE TABLE "contact_list_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contact_list_members_list_id_user_id_unique" UNIQUE("list_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "contact_lists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"html_content" text NOT NULL,
	"text_content" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"target_list_id" varchar,
	"sent_at" timestamp,
	"sent_by" varchar,
	"recipient_count" integer DEFAULT 0,
	"open_count" integer DEFAULT 0,
	"unique_open_count" integer DEFAULT 0,
	"click_count" integer DEFAULT 0,
	"unique_click_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_opens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"opened_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "features" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"description" text,
	"category" text,
	"icon" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "features_name_unique" UNIQUE("name"),
	CONSTRAINT "features_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "financial_support_tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"situation" text NOT NULL,
	"proposed_solution" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_response" text,
	"responded_by" varchar,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incoming_sms_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"twilio_message_sid" text NOT NULL,
	"from_phone" text NOT NULL,
	"to_phone" text NOT NULL,
	"message_body" text NOT NULL,
	"user_id" varchar,
	"company_id" varchar,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	CONSTRAINT "incoming_sms_messages_twilio_message_sid_unique" UNIQUE("twilio_message_sid")
);
--> statement-breakpoint
CREATE TABLE "link_clicks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"url" text NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"clicked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"code" text NOT NULL,
	"method" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outgoing_sms_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"twilio_message_sid" text,
	"to_phone" text NOT NULL,
	"from_phone" text NOT NULL,
	"message_body" text NOT NULL,
	"status" text DEFAULT 'sending' NOT NULL,
	"sent_by" varchar NOT NULL,
	"user_id" varchar,
	"company_id" varchar,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"error_code" text,
	"error_message" text,
	CONSTRAINT "outgoing_sms_messages_twilio_message_sid_unique" UNIQUE("twilio_message_sid")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"id" varchar(8) PRIMARY KEY NOT NULL,
	"company_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"effective_date" date NOT NULL,
	"agent_id" varchar,
	"product_type" text NOT NULL,
	"client_first_name" text NOT NULL,
	"client_middle_name" text,
	"client_last_name" text NOT NULL,
	"client_second_last_name" text,
	"client_email" text NOT NULL,
	"client_phone" text NOT NULL,
	"client_date_of_birth" date,
	"client_gender" text,
	"client_is_applicant" boolean DEFAULT false,
	"client_tobacco_user" boolean DEFAULT false,
	"client_pregnant" boolean DEFAULT false,
	"client_ssn" text,
	"client_preferred_language" text,
	"client_country_of_birth" text,
	"client_marital_status" text,
	"client_weight" text,
	"client_height" text,
	"annual_household_income" text,
	"family_group_size" integer,
	"spouses" jsonb DEFAULT '[]'::jsonb,
	"dependents" jsonb DEFAULT '[]'::jsonb,
	"physical_street" text,
	"physical_address_line_2" text,
	"physical_city" text,
	"physical_state" text,
	"physical_postal_code" text,
	"physical_county" text,
	"mailing_street" text,
	"mailing_address_line_2" text,
	"mailing_city" text,
	"mailing_state" text,
	"mailing_postal_code" text,
	"mailing_county" text,
	"billing_street" text,
	"billing_address_line_2" text,
	"billing_city" text,
	"billing_state" text,
	"billing_postal_code" text,
	"billing_county" text,
	"country" text DEFAULT 'United States' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"estimated_premium" text,
	"selected_plan" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_consent_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policyId" varchar(8) NOT NULL,
	"companyId" varchar NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"deliveryChannel" text,
	"deliveryTarget" text,
	"token" varchar(8) NOT NULL,
	"signedByName" text,
	"signedByEmail" text,
	"signedByPhone" text,
	"signatureImage" text,
	"signerIp" varchar,
	"signerUserAgent" text,
	"signerTimezone" varchar,
	"signerLocation" varchar,
	"signerPlatform" varchar,
	"signerBrowser" varchar,
	"sentAt" timestamp,
	"viewedAt" timestamp,
	"signedAt" timestamp,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" varchar NOT NULL,
	CONSTRAINT "policy_consent_documents_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "policy_consent_signature_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consentDocumentId" varchar NOT NULL,
	"eventType" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"occurredAt" timestamp DEFAULT now() NOT NULL,
	"actorId" varchar
);
--> statement-breakpoint
CREATE TABLE "policy_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" varchar(8) NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"description" text,
	"belongs_to" varchar,
	"company_id" varchar NOT NULL,
	"uploaded_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_member_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"member_id" varchar NOT NULL,
	"document_type" text NOT NULL,
	"document_name" text NOT NULL,
	"document_path" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"description" text,
	"uploaded_by" varchar NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_member_immigration" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"member_id" varchar NOT NULL,
	"citizenship_status" text,
	"immigration_status" text,
	"immigration_status_category" text,
	"visa_type" text,
	"visa_number" text,
	"green_card_number" text,
	"entry_date" timestamp,
	"visa_expiration_date" timestamp,
	"has_work_authorization" boolean DEFAULT false,
	"work_authorization_type" text,
	"work_authorization_expiration" timestamp,
	"i94_number" text,
	"uscis_number" text,
	"naturalization_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "policy_member_immigration_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
CREATE TABLE "policy_member_income" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"member_id" varchar NOT NULL,
	"employment_status" text,
	"employer_name" text,
	"job_title" text,
	"position" text,
	"employer_phone" text,
	"self_employed" boolean DEFAULT false,
	"years_employed" integer,
	"annual_income" text,
	"income_frequency" text,
	"total_annual_income" text,
	"has_additional_income" boolean DEFAULT false,
	"additional_income_sources" jsonb DEFAULT '[]'::jsonb,
	"tax_filing_status" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "policy_member_income_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
CREATE TABLE "policy_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"policy_id" varchar(8) NOT NULL,
	"role" text NOT NULL,
	"first_name" text NOT NULL,
	"middle_name" text,
	"last_name" text NOT NULL,
	"second_last_name" text,
	"date_of_birth" date,
	"ssn" text,
	"gender" text,
	"phone" text,
	"email" text,
	"is_applicant" boolean DEFAULT false,
	"is_primary_dependent" boolean DEFAULT false,
	"tobacco_user" boolean DEFAULT false,
	"pregnant" boolean DEFAULT false,
	"preferred_language" text,
	"country_of_birth" text,
	"marital_status" text,
	"weight" text,
	"height" text,
	"relation" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" varchar(8) NOT NULL,
	"note" text NOT NULL,
	"attachments" text[],
	"is_important" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"company_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_payment_methods" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"policy_id" varchar(8) NOT NULL,
	"payment_type" text NOT NULL,
	"card_number" text,
	"card_holder_name" text,
	"expiration_month" text,
	"expiration_year" text,
	"cvv" text,
	"billing_zip" text,
	"bank_name" text,
	"account_number" text,
	"routing_number" text,
	"account_holder_name" text,
	"account_type" text,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_reminders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"policy_id" varchar(8) NOT NULL,
	"created_by" varchar NOT NULL,
	"due_date" date NOT NULL,
	"due_time" text NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"reminder_before" text,
	"reminder_type" text NOT NULL,
	"notify_users" text[],
	"title" text,
	"description" text,
	"is_private" boolean DEFAULT false,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'medium',
	"completed_at" timestamp,
	"completed_by" varchar,
	"snoozed_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" varchar(8) NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"description" text,
	"belongs_to" varchar,
	"company_id" varchar NOT NULL,
	"uploaded_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_member_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"member_id" varchar NOT NULL,
	"document_type" text NOT NULL,
	"document_name" text NOT NULL,
	"document_path" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"description" text,
	"uploaded_by" varchar NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_member_immigration" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"member_id" varchar NOT NULL,
	"citizenship_status" text,
	"immigration_status" text,
	"immigration_status_category" text,
	"visa_type" text,
	"visa_number" text,
	"green_card_number" text,
	"entry_date" timestamp,
	"visa_expiration_date" timestamp,
	"has_work_authorization" boolean DEFAULT false,
	"work_authorization_type" text,
	"work_authorization_expiration" timestamp,
	"i94_number" text,
	"uscis_number" text,
	"naturalization_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quote_member_immigration_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
CREATE TABLE "quote_member_income" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"member_id" varchar NOT NULL,
	"employment_status" text,
	"employer_name" text,
	"job_title" text,
	"position" text,
	"employer_phone" text,
	"self_employed" boolean DEFAULT false,
	"years_employed" integer,
	"annual_income" text,
	"income_frequency" text,
	"total_annual_income" text,
	"has_additional_income" boolean DEFAULT false,
	"additional_income_sources" jsonb DEFAULT '[]'::jsonb,
	"tax_filing_status" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quote_member_income_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
CREATE TABLE "quote_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"quote_id" varchar(8) NOT NULL,
	"role" text NOT NULL,
	"first_name" text NOT NULL,
	"middle_name" text,
	"last_name" text NOT NULL,
	"second_last_name" text,
	"date_of_birth" date,
	"ssn" text,
	"gender" text,
	"phone" text,
	"email" text,
	"is_applicant" boolean DEFAULT false,
	"is_primary_dependent" boolean DEFAULT false,
	"tobacco_user" boolean DEFAULT false,
	"pregnant" boolean DEFAULT false,
	"preferred_language" text,
	"country_of_birth" text,
	"marital_status" text,
	"weight" text,
	"height" text,
	"relation" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" varchar(8) NOT NULL,
	"note" text NOT NULL,
	"attachments" text[],
	"is_important" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"company_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_payment_methods" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"quote_id" varchar(8) NOT NULL,
	"payment_type" text NOT NULL,
	"card_number" text,
	"card_holder_name" text,
	"expiration_month" text,
	"expiration_year" text,
	"cvv" text,
	"billing_zip" text,
	"bank_name" text,
	"account_number" text,
	"routing_number" text,
	"account_holder_name" text,
	"account_type" text,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_reminders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"quote_id" varchar(8) NOT NULL,
	"created_by" varchar NOT NULL,
	"due_date" date NOT NULL,
	"due_time" text NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"reminder_before" text,
	"reminder_type" text NOT NULL,
	"notify_users" text[],
	"title" text,
	"description" text,
	"is_private" boolean DEFAULT false,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'medium',
	"completed_at" timestamp,
	"completed_by" varchar,
	"snoozed_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" varchar(8) PRIMARY KEY NOT NULL,
	"company_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"effective_date" date NOT NULL,
	"agent_id" varchar,
	"product_type" text NOT NULL,
	"client_first_name" text NOT NULL,
	"client_middle_name" text,
	"client_last_name" text NOT NULL,
	"client_second_last_name" text,
	"client_email" text NOT NULL,
	"client_phone" text NOT NULL,
	"client_date_of_birth" date,
	"client_gender" text,
	"client_is_applicant" boolean DEFAULT false,
	"client_tobacco_user" boolean DEFAULT false,
	"client_pregnant" boolean DEFAULT false,
	"client_ssn" text,
	"client_preferred_language" text,
	"client_country_of_birth" text,
	"client_marital_status" text,
	"client_weight" text,
	"client_height" text,
	"annual_household_income" text,
	"family_group_size" integer,
	"spouses" jsonb DEFAULT '[]'::jsonb,
	"dependents" jsonb DEFAULT '[]'::jsonb,
	"physical_street" text,
	"physical_address_line_2" text,
	"physical_city" text,
	"physical_state" text,
	"physical_postal_code" text,
	"physical_county" text,
	"mailing_street" text,
	"mailing_address_line_2" text,
	"mailing_city" text,
	"mailing_state" text,
	"mailing_postal_code" text,
	"mailing_county" text,
	"billing_street" text,
	"billing_address_line_2" text,
	"billing_city" text,
	"billing_state" text,
	"billing_postal_code" text,
	"billing_county" text,
	"country" text DEFAULT 'United States' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"estimated_premium" text,
	"selected_plan" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"target_list_id" varchar,
	"sent_at" timestamp,
	"sent_by" varchar,
	"recipient_count" integer,
	"delivered_count" integer DEFAULT 0,
	"failed_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_chat_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" text NOT NULL,
	"note" text NOT NULL,
	"company_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_discounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" varchar NOT NULL,
	"company_id" varchar NOT NULL,
	"stripe_coupon_id" text,
	"stripe_promotion_code" text,
	"discount_percentage" integer NOT NULL,
	"discount_months" integer NOT NULL,
	"discount_end_date" timestamp NOT NULL,
	"applied_by" varchar,
	"applied_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "trusted_devices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"device_token" text NOT NULL,
	"device_name" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trusted_devices_device_token_unique" UNIQUE("device_token")
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "address_line_2" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "legal_name" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "currency" text DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "api_key" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "country" text DEFAULT 'United States';--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "platform_language" text DEFAULT 'English (United States)';--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "outbound_language" text DEFAULT 'Spanish (United States)';--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "business_type" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "business_category" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "business_niche" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "registration_id_type" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "registration_number" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "is_not_registered" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "regions_of_operation" text[];--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "representative_first_name" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "representative_last_name" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "representative_email" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "representative_position" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "representative_phone" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "stripe_payment_method_id" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "broadcast_id" varchar;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "stripe_product_id" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "stripe_annual_price_id" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "stripe_setup_fee_price_id" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "annual_price" integer;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "billing_cycle" text DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferred_language" text DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" text DEFAULT 'America/New_York';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "agent_internal_code" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "instruction_level" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "national_producer_number" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "federally_facilitated_marketplace" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referred_by" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_subscribed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sms_subscribed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_notifications" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invoice_alerts" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_email_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_sms_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "activation_tokens" ADD CONSTRAINT "activation_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_addresses" ADD CONSTRAINT "billing_addresses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_notifications" ADD CONSTRAINT "broadcast_notifications_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_emails" ADD CONSTRAINT "campaign_emails_campaign_id_email_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."email_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_emails" ADD CONSTRAINT "campaign_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_sms_messages" ADD CONSTRAINT "campaign_sms_messages_campaign_id_sms_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."sms_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_sms_messages" ADD CONSTRAINT "campaign_sms_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_unsubscribes" ADD CONSTRAINT "campaign_unsubscribes_campaign_id_email_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."email_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_unsubscribes" ADD CONSTRAINT "campaign_unsubscribes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_features" ADD CONSTRAINT "company_features_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_features" ADD CONSTRAINT "company_features_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_features" ADD CONSTRAINT "company_features_enabled_by_users_id_fk" FOREIGN KEY ("enabled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_documents" ADD CONSTRAINT "consent_documents_quoteId_quotes_id_fk" FOREIGN KEY ("quoteId") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_documents" ADD CONSTRAINT "consent_documents_companyId_companies_id_fk" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_documents" ADD CONSTRAINT "consent_documents_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_signature_events" ADD CONSTRAINT "consent_signature_events_consentDocumentId_consent_documents_id_fk" FOREIGN KEY ("consentDocumentId") REFERENCES "public"."consent_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_signature_events" ADD CONSTRAINT "consent_signature_events_actorId_users_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_list_members" ADD CONSTRAINT "contact_list_members_list_id_contact_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."contact_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_list_members" ADD CONSTRAINT "contact_list_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_lists" ADD CONSTRAINT "contact_lists_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_target_list_id_contact_lists_id_fk" FOREIGN KEY ("target_list_id") REFERENCES "public"."contact_lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_opens" ADD CONSTRAINT "email_opens_campaign_id_email_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."email_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_opens" ADD CONSTRAINT "email_opens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_support_tickets" ADD CONSTRAINT "financial_support_tickets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_support_tickets" ADD CONSTRAINT "financial_support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_support_tickets" ADD CONSTRAINT "financial_support_tickets_responded_by_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incoming_sms_messages" ADD CONSTRAINT "incoming_sms_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incoming_sms_messages" ADD CONSTRAINT "incoming_sms_messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_clicks" ADD CONSTRAINT "link_clicks_campaign_id_email_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."email_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_clicks" ADD CONSTRAINT "link_clicks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outgoing_sms_messages" ADD CONSTRAINT "outgoing_sms_messages_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outgoing_sms_messages" ADD CONSTRAINT "outgoing_sms_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outgoing_sms_messages" ADD CONSTRAINT "outgoing_sms_messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_consent_documents" ADD CONSTRAINT "policy_consent_documents_policyId_policies_id_fk" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_consent_documents" ADD CONSTRAINT "policy_consent_documents_companyId_companies_id_fk" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_consent_documents" ADD CONSTRAINT "policy_consent_documents_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_consent_signature_events" ADD CONSTRAINT "policy_consent_signature_events_consentDocumentId_policy_consent_documents_id_fk" FOREIGN KEY ("consentDocumentId") REFERENCES "public"."policy_consent_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_consent_signature_events" ADD CONSTRAINT "policy_consent_signature_events_actorId_users_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_documents" ADD CONSTRAINT "policy_documents_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_documents" ADD CONSTRAINT "policy_documents_belongs_to_policy_members_id_fk" FOREIGN KEY ("belongs_to") REFERENCES "public"."policy_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_documents" ADD CONSTRAINT "policy_documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_documents" ADD CONSTRAINT "policy_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_member_documents" ADD CONSTRAINT "policy_member_documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_member_documents" ADD CONSTRAINT "policy_member_documents_member_id_policy_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."policy_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_member_documents" ADD CONSTRAINT "policy_member_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_member_immigration" ADD CONSTRAINT "policy_member_immigration_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_member_immigration" ADD CONSTRAINT "policy_member_immigration_member_id_policy_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."policy_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_member_income" ADD CONSTRAINT "policy_member_income_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_member_income" ADD CONSTRAINT "policy_member_income_member_id_policy_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."policy_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_members" ADD CONSTRAINT "policy_members_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_members" ADD CONSTRAINT "policy_members_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_notes" ADD CONSTRAINT "policy_notes_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_notes" ADD CONSTRAINT "policy_notes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_notes" ADD CONSTRAINT "policy_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_payment_methods" ADD CONSTRAINT "policy_payment_methods_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_payment_methods" ADD CONSTRAINT "policy_payment_methods_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_reminders" ADD CONSTRAINT "policy_reminders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_reminders" ADD CONSTRAINT "policy_reminders_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_reminders" ADD CONSTRAINT "policy_reminders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_reminders" ADD CONSTRAINT "policy_reminders_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_documents" ADD CONSTRAINT "quote_documents_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_documents" ADD CONSTRAINT "quote_documents_belongs_to_quote_members_id_fk" FOREIGN KEY ("belongs_to") REFERENCES "public"."quote_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_documents" ADD CONSTRAINT "quote_documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_documents" ADD CONSTRAINT "quote_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_member_documents" ADD CONSTRAINT "quote_member_documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_member_documents" ADD CONSTRAINT "quote_member_documents_member_id_quote_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."quote_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_member_documents" ADD CONSTRAINT "quote_member_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_member_immigration" ADD CONSTRAINT "quote_member_immigration_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_member_immigration" ADD CONSTRAINT "quote_member_immigration_member_id_quote_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."quote_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_member_income" ADD CONSTRAINT "quote_member_income_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_member_income" ADD CONSTRAINT "quote_member_income_member_id_quote_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."quote_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_members" ADD CONSTRAINT "quote_members_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_members" ADD CONSTRAINT "quote_members_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_notes" ADD CONSTRAINT "quote_notes_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_notes" ADD CONSTRAINT "quote_notes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_notes" ADD CONSTRAINT "quote_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_payment_methods" ADD CONSTRAINT "quote_payment_methods_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_payment_methods" ADD CONSTRAINT "quote_payment_methods_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_reminders" ADD CONSTRAINT "quote_reminders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_reminders" ADD CONSTRAINT "quote_reminders_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_reminders" ADD CONSTRAINT "quote_reminders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_reminders" ADD CONSTRAINT "quote_reminders_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_campaigns" ADD CONSTRAINT "sms_campaigns_target_list_id_contact_lists_id_fk" FOREIGN KEY ("target_list_id") REFERENCES "public"."contact_lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_campaigns" ADD CONSTRAINT "sms_campaigns_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_chat_notes" ADD CONSTRAINT "sms_chat_notes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_chat_notes" ADD CONSTRAINT "sms_chat_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_discounts" ADD CONSTRAINT "subscription_discounts_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_discounts" ADD CONSTRAINT "subscription_discounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_discounts" ADD CONSTRAINT "subscription_discounts_applied_by_users_id_fk" FOREIGN KEY ("applied_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_stripe_product_id_unique" UNIQUE("stripe_product_id");--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_company_id_unique" UNIQUE("company_id");