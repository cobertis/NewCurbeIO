# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system designed to enhance operational efficiency and communication for businesses. It provides comprehensive customer relationship management, communication tools (iMessage/SMS/RCS), and an admin dashboard for managing Quotes, Policies, and Campaigns. The system aims to unify customer interactions, automate marketing, and streamline policy and quote management to improve customer engagement and operational efficiency. Key capabilities include an AI-powered CRM engine (Pulse AI) and integrated telephony (Telnyx WebRTC) for managing customer interactions and automating billing processes.

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
The frontend utilizes React 18, TypeScript, Vite, Shadcn/ui (New York style), Radix UI, and Tailwind CSS. It supports custom theming (light/dark modes) and a mobile-first responsive design with sidebar navigation.

### System Design Choices
The backend is built with Express.js and TypeScript, offering a RESTful API with session-based authentication and role-based access control. Routing is managed by Wouter, and state by TanStack Query. Data is stored in PostgreSQL with Drizzle ORM, enforcing strict multi-tenancy, robust password management, and 2FA. Dates are handled as `yyyy-MM-dd` strings, and all message timestamps are normalized to UTC. A `node-cron` background scheduler manages reminder notifications, and performance is optimized with database indexes and aggressive caching.

**Key Features:**
- **Core Management:** User, Company, Quotes & Policies, Consent Documents, Tasks & Reminders, Plan Features, User Seat Limits.
- **Communication:** Email, SMS/MMS, iMessage, WhatsApp, RCS, Telegram, TikTok.
- **Billing & Integrations:** Stripe, Telnyx Phone System (white-label telephony, WebRTC, E911, call control, number port-in).
- **Automation & Analytics:** Birthday Automation, Dashboard Analytics ("Policy Journeys"), Email Processing.
- **Specialized Systems:** Landing Page Builder, Unified Contacts Directory, Tab Auto-Save, Duplicate Message Prevention, Custom Domain (White Label), Wallet System (Apple Wallet + Google Wallet).
- **Manual Call Recording:** Supports multi-language announcements (English/Spanish), integrates with WebPhone UI, stores MP3 recordings, and offers Super Admin control for announcement media.
- **Voicemail Activation:** WebPhone UI detects voicemail status and allows activation, creating Telnyx voicemail boxes and configuring forwarding.
- **Phone Number Port-In:** Multi-step wizard for porting existing numbers, including portability checks, order creation, document upload (LOA, carrier invoice), and FOC date selection.
- **Unified Usage Billing System:** Tracks and charges all billable services (voice, SMS, MMS, DIDs, E911, port-out, recording, CNAM) with dual pricing (customer/internal) and optional references.
- **Wallet System:** Supports Apple Wallet (PKPass) and Google Wallet with smart links, analytics, APNs, and lock-screen persistence.
- **Pulse AI (Intelligent CRM Engine):** AI-powered engine with Copilot (draft suggestions) and Autopilot (autonomous response generation with tool execution and approval workflow) modes. Features URL-based knowledge base ingestion, embedding generation, deduplication, and legal page filtering. Includes a tool registry for CRM actions, multi-tenant isolation, prompt injection protection, and tool whitelisting. Provides a dedicated UI for AI settings, knowledge base, usage metrics, and activity logs.
- **Meta WhatsApp Cloud API Integration:** Full multi-tenant WhatsApp Business API integration with Embedded Signup OAuth, integrated into the unified inbox, enforcing 24-hour messaging window, supporting templates, and handling media.
- **Instagram DM Integration:** Full Instagram Business messaging via Meta Graph API, supporting OAuth connection, profile pictures, and user names in the inbox. Includes `HUMAN_AGENT` mode for extended messaging windows.
- **Security Architecture:** Session security, webhook signature validation, Zod schema validation, open redirect protection, unsubscribe token enforcement, user-scoped data isolation, and token encryption for sensitive data.
- **Credential Storage:** All service credentials encrypted in `system_credentials` table with IV and key versioning, managed by Super Admins via a `credentialProvider` service with caching.
- **AWS SES Multi-Tenant Email System:** Per-tenant BYO domain email sending with DKIM verification, queue-based sending with retries and rate limits, event processing for delivery/bounce/complaints, auto-pausing for high bounce/complaint rates, and suppression lists.
- **Campaign Orchestrator Live Ops UI:** Real-time monitoring and control panel for multi-channel outreach campaigns, displaying campaign lists, detailed views, contact filtering, timelines, and allowing pause/resume of campaigns, stopping individual contacts, and requeueing failed jobs.
- **Experiment Framework (A/B Testing):** Supports A/B testing for campaign orchestration strategies with variant allocation, deterministic assignment, and metrics dashboard displaying "Metrics by Variant."
- **Auto-Tuning (Multi-armed Bandit):** Adaptive allocation for A/B test variants using an epsilon-greedy bandit algorithm, with configurable objectives, update frequency, epsilon, and allocation limits.
- **Auto-Tuning v1.1 (Auto-Apply + Kill Switch):** Automatic application of allocation recommendations with guardrails, including maximum delta, minimum sample size, maximum opt-out rate, and automatic rollback if performance drops. Global kill switch via environment variable.
- **Voice/Voicemail Adapter:** Provides a `VoiceAdapter` interface for campaign voice calls and voicemail drops, with `TelnyxVoiceAdapter` integrating with Telnyx Call Control API and a `MockVoiceAdapter` for testing.
- **Telnyx Call Webhook Handler:** Processes Telnyx call events and finalizes orchestrator jobs, mapping Telnyx events to normalized outcomes (`answered`, `no_answer`, `busy`, `failed`). Includes multi-tenant isolation.
- **Voice Analytics:** Integrates voice-specific metrics into campaign performance tracking, including call counts, answer rates, and failures, displayed in the campaign detail page and A/B test variant tables.
- **Call Outcome Normalizer:** Post-call summary webhook handler that normalizes voice call outcomes to semantic intents (e.g., `interested` → QUALIFIED, `not_interested` → STOPPED) and updates contact states accordingly.
- **Action Routing (Tasks):** System-generated tasks from call outcomes with orchestrator_tasks table. Interested intent creates followup tasks (due immediately), callback intent creates callback tasks (due in 24h). API endpoints for listing tasks, completing tasks, and marking contacts as BOOKED (state transition). Tasks UI section in campaign detail view with filter, complete, and mark-booked actions.
- **Orchestrator Control API:** Manual operation endpoints for campaign orchestration. POST /api/orchestrator/campaigns/:id/run-once runs orchestrator for a specific campaign. POST /api/orchestrator/jobs/run-once runs job runner. GET /api/orchestrator/system/health returns queue stats, stuck jobs, and recent audit errors. All endpoints enforce multi-tenant isolation.
- **Enroll API:** POST /api/orchestrator/campaigns/:id/enroll enrolls contacts to a campaign. Multi-tenant safe (verifies campaign and contacts belong to company), idempotent (uses UNIQUE constraint, skips existing enrollments), supports state override and startNow flag for immediate processing. Returns detailed response with created/skippedExisting/errors counts.
- **Enroll by Filter API:** POST /api/orchestrator/campaigns/:id/enroll-by-filter enrolls contacts matching filter criteria (createdAfter, hasPhone, hasEmail, tag, search, limit). Multi-tenant safe, idempotent, returns matched/attempted/created/skipped counts.

## External Dependencies

- **Database:** PostgreSQL, Drizzle ORM.
- **Email:** Nodemailer, AWS SES.
- **SMS/MMS/iMessage:** Twilio, BulkVS, BlueBubbles.
- **Payments:** Stripe.
- **Telephony:** Telnyx (WebRTC SDK, Call Control API). CRITICAL: ALL Telnyx operations MUST use managed account API key from company's wallet, NEVER fall back to master key. Each company has its own Telnyx managed account.
- **Address Autocomplete:** Geoapify Geocoding API.
- **Social Media/Messaging APIs:** Meta (WhatsApp Business Platform), TikTok, Telegram Bot API.
- **UI Components:** Radix UI, Shadcn/ui, Lucide React, CMDK, Embla Carousel.
- **Drag & Drop:** `@dnd-kit`.
- **Rich Text Editing:** TipTap.
- **Form Management & Validation:** React Hook Form, Zod.
- **Session Management:** `express-session`, `connect-pg-simple`.
- **Security:** Bcrypt.
- **Utilities:** `date-fns`.
- **Background Jobs:** `node-cron`.