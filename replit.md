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

**Wallet System Architecture:**
Supports Apple Wallet (PKPass) and Google Wallet with smart links, analytics, and APNs push notifications for proactive payment collection. Key components include dedicated services, PassKit Web Service, and a scheduler for daily payment reminders. The "Cenicienta Strategy" ensures lock-screen persistence for passes by setting `relevantDate` to the end of the day. Pass images are "baked in," with only text/data updated via push notifications.

**Security Architecture:**
Includes session security, webhook signature validation (Twilio, BulkVS, BlueBubbles), Zod schema validation, open redirect protection, unsubscribe token enforcement, user-scoped data isolation, iMessage webhook secret isolation, multi-tenant WhatsApp session isolation, and token encryption for sensitive data.

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