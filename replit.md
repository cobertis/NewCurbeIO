# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system designed to enhance operational efficiency and communication for businesses. It provides comprehensive customer relationship management, communication tools (iMessage/SMS/RCS), and an admin dashboard for managing Quotes, Policies, and Campaigns. The system aims to unify customer interactions, automate marketing, and streamline policy and quote management to improve customer engagement and operational efficiency. It includes advanced features like an AI-powered CRM engine (Pulse AI) and integrated telephony (Telnyx WebRTC) to manage customer interactions and automate billing processes.

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
- **Billing & Integrations:** Stripe, Telnyx Phone System (full white-label telephony, WebRTC, E911 management, call control application routing, phone number port-in).
- **Automation & Analytics:** Birthday Automation, Dashboard Analytics ("Policy Journeys"), Email Processing.
- **Specialized Systems:** Landing Page Builder, Unified Contacts Directory, Tab Auto-Save, Duplicate Message Prevention, Custom Domain (White Label), Wallet System (Apple Wallet + Google Wallet).
- **Manual Call Recording:** Supports multi-language announcements (English/Spanish), integrates with WebPhone UI, uses specific API endpoints for start/stop, stores MP3 recordings, and offers Super Admin control for announcement media.
- **Voicemail Activation:** WebPhone Voicemail tab automatically detects if voicemail is enabled for selected number. If not, shows activation UI that creates a Telnyx voicemail box and configures the number to forward to voicemail. Uses `ensureVoicemailBox()` and `enableVoicemail()` in telnyx-numbers-service. API: `GET/POST /api/voicemail/status|enable/:phoneNumberId`.
- **Phone Number Port-In:** Multi-step wizard in Phone System page for porting existing numbers from other carriers. Workflow includes portability check, order creation, end-user info collection (business name, authorized person, carrier account details, service address), document upload (LOA and carrier invoice), FOC date selection, and order submission. Uses Telnyx Porting API via `telnyx-porting-service.ts`. Webhook handler at `/webhooks/telnyx/porting` for status updates. Database: `telnyx_porting_orders` table. API: `/api/telnyx/porting/*`.
- **Unified Usage Billing System:** All billable services (voice, SMS, MMS, DIDs, E911, port-out, recording, CNAM) are tracked and charged through `usage-billing-service.ts`. Uses `usage_items` table with resource type, dual pricing (customer/internal), and optional references. Helper functions: `chargeCallUsage()`, `chargeSmsUsage()`, `chargeMmsUsage()`, `chargeDidMonthly()`, `chargeE911()`, `chargePortOut()`. All rates from `telnyxGlobalPricing` table.
- **Wallet System:** Supports Apple Wallet (PKPass) and Google Wallet with smart links, analytics, APNs, and a "Cenicienta Strategy" for lock-screen persistence.
- **Pulse AI (Intelligent CRM Engine):**
    - AI-powered operational engine for knowledge base management and intelligent responses.
    - **Modes:** Copilot (draft suggestions with intent detection) and Autopilot (autonomous response generation with tool execution and approval workflow).
    - **Knowledge Base:** URL-based document ingestion, embedding generation, deduplication, and legal page filtering.
    - **Tool Registry:** 10 built-in tools for CRM actions (e.g., `search_knowledge_base`, `create_task`).
    - **Security:** Multi-tenant isolation, prompt injection protection, tool whitelisting, and escalation for blocked tools.
    - **Settings UI:** Dedicated management for AI settings, knowledge base, usage metrics, and activity logs.
- **Meta WhatsApp Cloud API Integration:** Full multi-tenant WhatsApp Business API integration via Meta Cloud API with Embedded Signup OAuth. Integrates into the unified inbox, enforces 24-hour messaging window, supports templates, and handles media.
- **Instagram DM Integration:** Full Instagram Business messaging via Meta Graph API. Supports OAuth connection, profile pictures, and user names in inbox. **HUMAN_AGENT mode** allows 7-day messaging window (vs standard 24h) for support conversations. Toggle in inbox sidebar enables `tag: HUMAN_AGENT` for Meta compliance. Validates `lastInboundAt` timestamp to ensure messages are within 7-day window.
- **Security Architecture:** Includes session security, webhook signature validation, Zod schema validation, open redirect protection, unsubscribe token enforcement, user-scoped data isolation, and token encryption for sensitive data.
- **Credential Storage:** All service credentials encrypted in the `system_credentials` database table with IV and key versioning, managed by Super Admins via a `credentialProvider` service with caching.
- **AWS SES Multi-Tenant Email System:** Per-tenant BYO domain email sending with DKIM verification, queue-based sending with retries and rate limits, event processing for delivery/bounce/complaints, auto-pausing for high bounce/complaint rates, and suppression lists.
- **Campaign Orchestrator Live Ops UI:** Real-time monitoring and control panel for multi-channel outreach campaigns at `/orchestrator-campaigns`. Features include: campaign list with status/stats, campaign detail view, contacts filtered by state (NEW/ATTEMPTING/ENGAGED/STOPPED/DNC/UNREACHABLE), contact timeline with events and jobs merged chronologically, pause/resume campaigns, stop individual contacts, and requeue failed jobs. API endpoints use strict multi-tenant isolation via `requireActiveCompany` middleware with campaign-scoped validation. PII masking applied to phone numbers (+1******1234 format).

## External Dependencies

- **Database:** PostgreSQL, Drizzle ORM, `postgres`.
- **Email:** Nodemailer, AWS SES.
- **SMS/MMS/iMessage:** Twilio, BulkVS, BlueBubbles.
- **Payments:** Stripe.
- **Telephony:** Telnyx (WebRTC SDK, Call Control API). **CRITICAL: ALL Telnyx operations MUST use managed account API key from company's wallet, NEVER fall back to master key. Each company has its own Telnyx managed account.**
- **Address Autocomplete:** Geoapify Geocoding API (replaced Google Places).
- **Social Media/Messaging APIs:** Meta (WhatsApp Business Platform), TikTok, Telegram Bot API.
- **UI Components:** Radix UI, Shadcn/ui, Lucide React, CMDK, Embla Carousel.
- **Drag & Drop:** `@dnd-kit`.
- **Rich Text Editing:** TipTap.
- **Form Management & Validation:** React Hook Form, Zod.
- **Session Management:** `express-session`, `connect-pg-simple`.
- **Security:** Bcrypt.
- **Utilities:** `date-fns`.
- **Background Jobs:** `node-cron`.