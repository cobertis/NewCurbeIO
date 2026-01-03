# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system designed to enhance operational efficiency and communication for businesses. It provides comprehensive customer relationship management, communication tools (iMessage/SMS/RCS), and an admin dashboard for managing Quotes, Policies, and Campaigns. The system aims to unify customer interactions, automate marketing, and streamline policy and quote management to improve customer engagement and operational efficiency.

## User Preferences
Preferred communication style: Simple, everyday language.
Design style: Extremely professional corporate design - NO bright colors, NO emojis, space-efficient mobile-responsive UI.
**Toast Notifications:**
- All toast notifications auto-dismiss after 3 seconds
- Users can still manually dismiss toasts before the timeout
**Loading State Pattern (MANDATORY):**
ALWAYS use the standardized `LoadingSpinner` component for all loading states across the application.
- User strongly prefers consistent loading indicators across all pages
- Shows large, centered spinner (h-12 w-12) with descriptive text
- `fullScreen={true}` (default) for full page loading states
- `fullScreen={false}` REQUIRED for: buttons, dialogs, sheets, inline components - prevents full-screen overlay
- CRITICAL: All button loading states MUST use `fullScreen={false}` to avoid UI-blocking overlays
- Apply consistently across ALL pages, sheets, dialogs, and async components
- This ensures a uniform user experience throughout the entire application
**CRITICAL: All sensitive data (SSN, income, immigration documents, payment methods) is stored in PLAIN TEXT without encryption or masking as per explicit user requirement.**

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, Vite, Shadcn/ui (New York style), Radix UI, and Tailwind CSS. It supports custom theming (light/dark modes) and a mobile-first responsive design with sidebar navigation.

### System Design Choices
The backend is an Express.js application with TypeScript, providing a RESTful API with session-based authentication and role-based access control. Routing is handled by Wouter, and state management by TanStack Query. The system uses PostgreSQL with Drizzle ORM, enforcing strict multi-tenancy, robust password management, and 2FA. Dates are handled as `yyyy-MM-dd` strings, and all message timestamps are normalized to UTC. A `node-cron` background scheduler manages reminder notifications. Performance is optimized with database indexes and aggressive caching.

**Key Features:**
- **Core Management:** User, Company, Quotes & Policies, Consent Documents, Tasks & Reminders, Plan Features, User Seat Limits.
- **Communication:** Email, SMS/MMS, iMessage, WhatsApp, RCS, Telegram, TikTok.
- **Billing & Integrations:** Stripe, Telnyx Phone System (full white-label telephony, WebRTC, E911 management, call control application routing).
- **Automation & Analytics:** Birthday Automation, Dashboard Analytics ("Policy Journeys"), Email Processing.
- **Specialized Systems:** Landing Page Builder, Unified Contacts Directory, Tab Auto-Save, Duplicate Message Prevention, Custom Domain (White Label), Wallet System (Apple Wallet + Google Wallet).

**Telnyx WebRTC & Telephony:**
Implements Telnyx WebRTC with specific call options and audio settings. Uses a dual SIP domain architecture: company subdomain for registration/inbound, and `sip.telnyx.com` for outbound PSTN calls. Call control is webhook-driven, and telephony billing includes immediate purchase and monthly recurring charges. Extension-to-extension calling uses pure WebRTC, and SIP forking is enabled.

**Manual Call Recording:**
- **Language Selection**: When starting recording, agent selects English or Spanish; plays corresponding audio announcement to both parties
- **WebPhone UI**: Record button in call controls grid (5 buttons: mute, keypad, record, transfer, hold)
- **API Endpoints**: POST `/api/calls/:callControlId/recording/start` and `/recording/stop`
- **Recording Format**: MP3, dual channel, custom announcement audio (no beep)
- **Storage**: Recording URLs stored in `call_logs.recordingUrl` via `call.recording.saved` webhook
- **Playback**: Blue play button in call history (Recents tab) for calls with recordings
- **Announcement Media Management (Super Admin Only):**
  - **UI**: Super Admin page at `/admin/recording-media` to upload/replace/delete audio files
  - **Database Table**: `recording_announcement_media` stores 4 slots: start_en, start_es, stop_en, stop_es
  - **API Endpoints**: GET/POST/DELETE `/api/admin/recording-media` (superadmin role required)
  - **Telnyx Integration**: Audio files uploaded to Telnyx Media Storage, referenced by `media_name` in playback_start API
  - **Fallback**: If no media configured for a slot, recording start returns error; recording stop skips announcement

**Wallet System Architecture:**
Supports Apple Wallet (PKPass) and Google Wallet with smart links, analytics, and APNs push notifications for proactive payment collection. Key components include dedicated services, PassKit Web Service, and a scheduler for daily payment reminders. The "Cenicienta Strategy" ensures lock-screen persistence for passes by setting `relevantDate` to the end of the day. Pass images are "baked in," with only text/data updated via push notifications.

**Pulse AI (Intelligent CRM Engine):**
AI-powered operational engine with knowledge base management and intelligent response capabilities. Tagline: "From message to action."
- **Branding:** Use "Pulse AI" (with space) in UI. Use "Pulse" in buttons ("Suggest with Pulse", "Pulse Autopilot").
- **Knowledge Base Management:** URL-based document ingestion with Jina Reader for JS-rendered sites, text chunking (1500 tokens), and embedding generation via OpenAI text-embedding-3-small. Content deduplication via SHA256 hashing with version tracking and automatic obsolete chunk cleanup. Auto-filters legal pages (privacy policies, terms of service) with toggle control.
- **Database Tables:** `ai_assistant_settings`, `ai_kb_sources`, `ai_kb_documents`, `ai_kb_chunks`, `ai_runs`, `ai_action_logs`, `ai_outbox_messages`.
- **Copilot Mode:** Generates draft reply suggestions for agents with intent detection, confidence scoring, and citation references. "Suggest with Pulse" button in inbox composer triggers drafts. Interactive Copilot panel in inbox right sidebar (tabbed: Details | Pulse AI) allows agents to ask questions about conversations with chat-style Q&A, "Insert and edit" to populate composer, and "Start new conversation" to reset.
- **Autopilot Mode:** Autonomous response generation with tool execution capabilities. Includes approval workflow for human review when confidence is low or escalation is needed. Integrated with webchat and SMS/MMS for automatic visitor responses.
- **Per-Conversation AI Settings:** Each conversation can override company-wide Copilot/Autopilot settings via `autopilotEnabled` and `copilotEnabled` fields in `telnyxConversations`. Toggle controls in inbox details panel allow agents to enable/disable AI per conversation.
- **Thread Summary Feature:** POST `/api/ai/thread-summary` generates AI-powered conversation summaries with 3 clickable response suggestions (Offer, Encourage, Suggest). Accessible via "Thread Summary" button in inbox.
- **Tool Registry:** 10 built-in tools - `search_knowledge_base`, `get_customer_info`, `transfer_to_human`, `create_task`, `update_conversation_status`, `send_message`, `create_ticket`, `update_contact_field`, `assign_conversation`, `tag_conversation`.
- **Pulse Levels:** Level 1 (send_message, transfer_to_human), Level 2 (+assign_conversation, tag_conversation), Level 3 (+create_ticket, update_contact_field).
- **Approval Workflow:** Runs pending approval when: confidence below threshold, needsHuman flag true, or escalation rules apply. Human agents can approve (sends message) or reject with reason.
- **Idempotency:** Run states (completed, pending_approval, approved_sent, rejected, send_failed) with atomic transitions. Outbox table with UNIQUE(run_id) prevents duplicate sends.
- **Security:** Multi-tenant isolation (companyId from session only), prompt injection protection (KB marked as untrusted), tool whitelist per mode/level with runtime validation, blocked tools auto-escalate to human.
- **Metrics Dashboard:** Performance metrics (approval rate, rejection reasons, intent distribution, daily stats), token usage, feedback loop tracking (wasEdited, editRate).
- **Activity Logs:** Comprehensive audit trail of all AI runs with input/output text, intent, confidence, tokens used, latency, and action logs.
- **Settings UI:** Located at `/pulse-ai` with tabs for Settings (Copilot/Autopilot toggles), Knowledge Base (source management), Usage (metrics dashboard), and Activity (audit logs).
- **Key Services:** `ai-desk-service.ts`, `ai-openai-service.ts`, `ai-ingestion-service.ts`, `ai-tool-registry.ts`, `ai-autopilot-service.ts`.

**Meta WhatsApp Cloud API Integration:**
Full multi-tenant WhatsApp Business API integration via Meta Cloud API with Embedded Signup OAuth flow. WhatsApp is fully integrated into the unified inbox alongside SMS, iMessage, Telegram, and Live Chat.
- **OAuth Flow:** POST `/api/integrations/meta/whatsapp/start` generates nonce, GET `/api/integrations/meta/whatsapp/callback` exchanges code for token, captures `businessId`, `wabaId`, `phoneNumberId`, and automatically calls `POST /{WABA-ID}/subscribed_apps` to subscribe for webhooks. Hardcoded fallback redirect URI: `https://app.curbe.io/api/integrations/meta/whatsapp/callback`.
- **Unified Inbox Integration:** WhatsApp conversations use `telnyxConversations` (channel="whatsapp") and `telnyxMessages` for unified inbox display. Frontend shows WhatsApp icon (SiWhatsapp) with emerald-500 color.
- **Webhooks:** GET `/api/webhooks/meta/whatsapp` for hub.challenge verification, POST with HMAC X-Hub-Signature-256 validation using app secret. Multi-tenant routing by `phone_number_id` lookup. Inbound messages upsert to `telnyxConversations`.
- **24-Hour Window Enforcement:** Free-form messages blocked outside 24h window with clear error directing users to template feature. Messages only saved to database after successful Meta API response.
- **Messaging:** POST `/api/inbox/conversations/:id/messages` with WhatsApp channel routing. Tracks `wamid` for delivery status updates via webhook.
- **Templates CRUD:** GET/POST/DELETE `/api/whatsapp/meta/templates` for managing message templates per WABA.
- **Media:** POST `/api/whatsapp/meta/media/upload` (multipart with size limits), GET `/api/whatsapp/meta/media/:mediaId`, POST `/api/whatsapp/meta/send-media`.
- **Database Tables:** `channelConnections` (with `businessId`, `wabaId`, `phoneNumberId`, encrypted access token), `waWebhookLogs`. Conversations/messages in `telnyxConversations`/`telnyxMessages`.
- **Security:** HMAC signature validation, multi-tenant isolation by companyId, conversation ownership verification on send endpoints.
- **Webhook URL for Meta Dashboard:** `https://app.curbe.io/api/webhooks/meta/whatsapp`
- **Verify Token:** Configured via `META_WEBHOOK_VERIFY_TOKEN` environment variable.

**Security Architecture:**
Includes session security, webhook signature validation (Twilio, BulkVS, BlueBubbles, Meta WhatsApp), Zod schema validation, open redirect protection, unsubscribe token enforcement, user-scoped data isolation, iMessage webhook secret isolation, multi-tenant WhatsApp session isolation, and token encryption for sensitive data.

**Credential Storage:**
All service credentials (Stripe, Telnyx, AWS SES, Twilio, BulkVS, Telegram, etc.) are stored encrypted in the `system_credentials` database table with IV and key versioning. Super admins manage credentials via System Settings > API Credentials. The `credentialProvider` service provides a unified abstraction with 5-minute caching and cache invalidation on updates. Environment variables serve as fallback only.

**AWS SES Multi-Tenant Email System:**
Implements per-tenant BYO (Bring Your Own) domain email sending via AWS SES. Key components:
- **Domain Identity Management:** Per-company sending domains with DKIM verification, MAIL FROM configuration, and SES configuration sets.
- **Queue-Based Sending:** Asynchronous email queue with exponential backoff retry logic, per-tenant rate limits (daily/hourly/minute), and warm-up stages.
- **Event Processing:** Webhook endpoint (`/api/webhooks/ses-events`) handles SNS notifications for delivery, bounce, and complaint events.
- **Auto-Pause:** Automatically pauses sending when bounce rate exceeds 5% or complaint rate exceeds 0.1% (configurable per tenant).
- **Suppression Lists:** Automatic suppression for hard bounces and complaints, with manual addition/removal via API.
- **UI:** Domain onboarding wizard at `/settings/email` with DNS records display, verification status, metrics dashboard, and suppression list management.
- **Database Tables:** `company_email_settings`, `ses_email_messages`, `ses_email_events`, `company_email_suppression`, `ses_email_queue`.
- **Scheduler:** Runs every 10 seconds to process email queue.

## External Dependencies

- **Database:** PostgreSQL, Drizzle ORM, `postgres`.
- **Email:** Nodemailer, AWS SES (multi-tenant BYO domain).
- **SMS/MMS/iMessage:** Twilio, BulkVS, BlueBubbles.
- **Payments:** Stripe.
- **Telephony:** Telnyx (WebRTC SDK, Call Control API).
- **Social Media/Messaging APIs:** Meta (WhatsApp Business Platform), TikTok, Telegram Bot API.
- **UI Components:** Radix UI, Shadcn/ui, Lucide React, CMDK, Embla Carousel.
- **Drag & Drop:** `@dnd-kit`.
- **Rich Text Editing:** TipTap.
- **Form Management & Validation:** React Hook Form, Zod.
- **Session Management:** `express-session`, `connect-pg-simple`.
- **Security:** Bcrypt.
- **Utilities:** `date-fns`.
- **Background Jobs:** `node-cron`.
