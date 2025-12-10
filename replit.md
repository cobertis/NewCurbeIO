# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system designed to enhance operational efficiency and communication for businesses. It offers comprehensive customer relationship management, communication tools (iMessage/SMS/RCS), and an admin dashboard for managing Quotes, Policies, and Campaigns. The system aims to provide a unified platform for managing customer interactions, automating marketing campaigns, and streamlining policy and quote management to increase operational efficiency and improve customer engagement.

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
The frontend is built with React 18, TypeScript, Vite, Shadcn/ui (New York style), Radix UI, and Tailwind CSS. It supports custom theming (light/dark modes) and a mobile-first responsive design with sidebar-based navigation.

### Technical Implementations
The frontend uses Wouter for routing and TanStack Query for state management. The backend is an Express.js application with TypeScript, providing a RESTful API with session-based authentication and role-based access control.

**Key Features:**
- **User & Company Management:** CRUD, RBAC, 2FA, multi-tenancy.
- **Communication Systems:** Email, SMS/MMS (BulkVS), iMessage (BlueBubbles), WhatsApp (Evolution API v2).
- **Billing & Stripe Integration:** Automated customer and subscription management.
- **Quotes Management System:** 3-step wizard with Google Places Autocomplete, CMS Marketplace API integration, plan comparison, and document management.
- **Policies Management System:** Converts quotes to policies, manages statuses, assigns agents, supports cursor-based pagination, and hybrid search.
- **Consent Document System:** Generates legal consent documents, supports multi-channel delivery, and e-signatures.
- **Calendar & Reminder Systems:** Full-screen, multi-tenant display of company-wide events.
- **Landing Page Builder System:** Bio link page creator with drag & drop and real-time mobile preview.
- **Unified Contacts Directory:** Aggregated contact management with deduplication, filtering, and bulk operations.
- **Tasks & Reminders Management System:** Unified task management with assignment, priority, and status tracking.
- **Birthday Automation System:** Automated birthday greetings via Twilio SMS/MMS.
- **Dashboard Analytics System:** SugarCRM-style "Policy Journeys" design with agent avatars, workflow board, recent policies, and policy status donut charts. Features all-time analytics with unique people counting and company-scoped caching.
- **Plan Features Management System:** Database-driven plan features for public pricing page. Master `plan_features` table with sortable, active/inactive features. `plan_feature_assignments` table for per-plan feature toggles with green/red status indicators. Superadmin can manage features via /plans page with tabbed form (Basic Info | Pricing | Features).
- **User Seat Limits System:** Plans have `maxUsers` field (null=unlimited). Backend enforces limits via `canCompanyAddUsers()` utility. Frontend shows SeatLimitCard with progress bar, warning states, and invite button gating. API endpoint `/api/users/limits` returns seat availability.
- **Email Bounce Processing System:** IMAP-based bounce email processor runs every 5 minutes via `node-cron`. Monitors `rebotes@auth.curbe.io` mailbox, extracts bounced recipient emails, marks contacts as `email_bounced=true`, and auto-deletes processed emails. Credentials stored encrypted in `system_api_credentials` table.
- **Email Retry System:** All outbound emails (including OTP codes) use exponential backoff retry logic. Automatically retries up to 3 times on transient SMTP errors (timeout, connection reset, greeting never received). Delays: 1s → 2s → 4s. Handles error codes: ETIMEDOUT, ECONNRESET, ECONNREFUSED, EAI_AGAIN, ETEMP. Ensures reliable OTP delivery even during temporary SMTP issues.
- **Stripe Annual Billing:** Plans support both monthly and annual pricing with automatic 20% discount. `syncPlanWithStripe()` creates both monthly and annual Stripe prices via API. Annual price = Monthly × 12 × 0.8. Frontend displays original price struck through in red, showing savings clearly. Pricing page shows Monthly/Yearly toggle with "Save 20%" badge. Endpoint `/api/plans/:id/sync-stripe` (superadmin only) generates Stripe products and prices automatically.
- **Policy Data Architecture:** Hybrid data sharing for Notes, Documents, Consents, Payment Methods (shared) and Reminders (per policy year).
- **Tab Auto-Save System:** Intelligent tab navigation with automatic data persistence.
- **Duplicate Message Prevention System:** Robust transactional claim system for campaign messages.
- **Company Detail Page (Superadmin):** Comprehensive 6-tab view for managing all aspects of a company - Basic Details, Users, Billing, Features & Limits, Advanced Settings, and Calendar Settings.
- **Custom Domain (White Label) System:** Allows organizations to connect custom domains via Cloudflare for SaaS. Admin-only functionality accessible in Settings > Overview tab. Supports domain connection, CNAME DNS instructions, SSL status monitoring, domain refresh, and disconnection. Cloudflare credentials stored in `system_api_credentials` table (provider: `cloudflare`, keys: `api_token`, `zone_id`). Companies table extended with `custom_domain`, `custom_domain_status`, and `cloudflare_hostname_id` fields. API endpoints: POST/GET/DELETE `/api/organization/domain`, POST `/api/organization/domain/refresh`.
- **Telnyx Phone System Integration:** Full white-label telephony using Telnyx Managed Accounts with rollup billing. Features: wallet-based balance display (Curbe as "the bank"), phone number purchase, E911 emergency address registration, and automatic WebRTC provisioning. **CRITICAL SECURITY: Wallet Balance Verification** - POST `/api/webrtc/token` enforces minimum $0.50 wallet balance before issuing WebRTC credentials. Clients with insufficient funds receive 403 INSUFFICIENT_BALANCE error and cannot make calls. Prevents unauthorized telephony usage without wallet coverage. **WebRTC Call Logging:** POST `/api/webrtc/call-log` persists WebRTC calls to `call_logs` table with direction, status, duration, and auto-matched contact names. Called when calls become active and when they complete. **WebRTC Auto-Provisioning:** When a company purchases a phone number, the system automatically provisions WebRTC infrastructure via TelephonyProvisioningService with 5-step orchestration: (1) Outbound Voice Profile, (2) TeXML Application, (3) Messaging Profile, (4) Call Queue, (5) Phone number assignment. Status tracking in `telephony_settings` table with states: not_started, pending, in_progress, completed, failed. Auto-provisioning triggers for not_started/failed states, skips for pending/in_progress/completed to prevent duplicate jobs. API endpoints: POST `/api/telnyx/provisioning/trigger`, GET `/api/telnyx/provisioning/status`. E911 endpoints: POST `/api/e911/validate`, POST `/api/e911/register`, GET `/api/e911/addresses`. **Inbound Call Routing:** TeXML webhook routes inbound calls to WebRTC clients via SIP URI (sip:username@sip.telnyx.com). Credential connections configured with `sip_uri_calling_preference: "unrestricted"` at root level. **CRITICAL BILLING: answerOnBridge="true"** - TeXML Dial uses answerOnBridge to prevent early answer billing. PSTN leg stays ringing until WebRTC client answers, ensuring billing starts only when user accepts call (not during ring time). Direction inference compares destinationNumber with SIP username to detect inbound calls. **Enterprise WebPhone Features:** (1) DTMF Keypad - 12-button grid overlay during active calls with visual press feedback, sends tones via `call.dtmf()`. (2) Visual Mute - Button with red background when muted, animated "MUTED" badge overlay on caller info. (3) Transfer Dialog - Dual-tab interface for Blind Transfer (direct) and Attended Transfer (consult-first with complete/cancel options). (4) Network Quality Indicator - Traffic light display (green/yellow/red) with tooltip showing MOS, jitter, packet loss; polls every 5 seconds during active calls. Zustand store extended with `consultCall`, `isConsulting`, `networkQuality` states for full transfer lifecycle management.

### System Design Choices
The system uses PostgreSQL with Drizzle ORM, enforcing strict multi-tenancy. Security includes robust password management and 2FA. Dates are handled as `yyyy-MM-dd` strings to prevent timezone issues. A `node-cron` background scheduler manages reminder notifications. Phone numbers are standardized using centralized phone utilities. All message timestamps are normalized to UTC. Policies are ordered by most recently edited first with cursor-based pagination. Performance is optimized with database indexes and aggressive caching.

### Security Architecture
- **Session Security:** Relies on `SESSION_SECRET`.
- **Webhook Validation:** Twilio, BulkVS, and BlueBubbles webhook signature validation.
- **Input Validation:** Zod schema validation on all public-facing endpoints.
- **Open Redirect Protection:** Tracking endpoint validates redirect URLs against an allowlist.
- **Unsubscribe Token Enforcement:** Unsubscribe endpoint requires and validates security tokens.
- **BulkVS Security:** User-scoped data isolation, `BULKVS_WEBHOOK_SECRET` validation, E.164 phone normalization, 5MB file upload limit.
- **iMessage Security:** Webhook secret isolation, admin-only settings, feature gating, multi-tenant GUID scoping, and early-return guards for self-sent webhook duplicates.
- **WhatsApp Integration:** Evolution API v2 integration with multi-tenant session isolation, QR code authentication, real-time webhooks (MESSAGES_UPSERT, CONNECTION_UPDATE, QRCODE_UPDATED), company-scoped instances, Business Profile hydration for @lid contacts (extracts senderPn from messages for reliable phone number capture), automatic media download via getBase64FromMediaMessage (workaround for SaaS webhookBase64 limitation), syncFullHistory enabled for full chat history sync on QR scan, sendMediaMessage with base64 normalization and data URI stripping, full-screen image preview dialog. **Media Storage:** Uses Data URI format (data:mimetype;base64,...) stored directly in database due to Object Storage permission constraints. Webhook auto-downloads media when messages arrive. Sync intervals: 30s for active chat, 60s for global sync.

## External Dependencies

- **Database:** PostgreSQL, Drizzle ORM, `postgres`.
- **Email:** Nodemailer.
- **SMS/MMS/iMessage:** Twilio, BulkVS, BlueBubbles.
- **Payments:** Stripe.
- **UI Components:** Radix UI, Shadcn/ui, Lucide React, CMDK, Embla Carousel.
- **Drag & Drop:** @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities.
- **Rich Text Editing:** TipTap.
- **Form Management & Validation:** React Hook Form, Zod.
- **Session Management:** `express-session`, `connect-pg-simple`.
- **Security:** Bcrypt.
- **Utilities:** `date-fns`.
- **Background Jobs:** `node-cron`.