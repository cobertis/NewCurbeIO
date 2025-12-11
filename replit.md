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
- **Communication Systems:** Email, SMS/MMS, iMessage, WhatsApp.
- **Billing & Stripe Integration:** Automated customer and subscription management.
- **Quotes & Policies Management Systems:** 3-step wizard for quotes, conversion to policies, agent assignment, pagination, and hybrid search.
- **Consent Document System:** Generates legal consent documents with multi-channel delivery and e-signatures.
- **Calendar & Reminder Systems:** Multi-tenant display of company-wide events.
- **Landing Page Builder System:** Bio link page creator with drag & drop and real-time preview.
- **Unified Contacts Directory:** Aggregated contact management with deduplication.
- **Tasks & Reminders Management System:** Unified task management with assignment, priority, and status tracking.
- **Birthday Automation System:** Automated birthday greetings via Twilio SMS/MMS.
- **Dashboard Analytics System:** SugarCRM-style "Policy Journeys" with analytics, unique people counting, and company-scoped caching.
- **Plan Features Management System:** Database-driven plan features with superadmin management.
- **User Seat Limits System:** Enforces user seat limits based on plan.
- **Email Processing Systems:** IMAP-based bounce processing and exponential backoff retry for outbound emails.
- **Policy Data Architecture:** Hybrid data sharing for related policy elements.
- **Tab Auto-Save System:** Intelligent tab navigation with automatic data persistence.
- **Duplicate Message Prevention System:** Robust transactional claim system for campaign messages.
- **Company Detail Page (Superadmin):** Comprehensive 6-tab view for company management.
- **Custom Domain (White Label) System:** Allows organizations to connect custom domains via Cloudflare.
- **Telnyx Phone System Integration:** Full white-label telephony with managed accounts, wallet-based billing, phone number purchase, E911, WebRTC provisioning, inbound call routing, DTMF keypad, visual mute, transfer dialogs, and network quality indicator.

### Telnyx WebRTC Configuration (Per Official Docs)
All WebRTC implementations follow official Telnyx documentation:
- **Audio Elements:** Created PROGRAMMATICALLY outside React via `ensureTelnyxAudioElements()` to prevent React Fiber references (`__reactFiber$`) that cause "circular structure to JSON" serialization errors in the SDK
- **Client Options:** `prefetchIceCandidates: true` per [IClientOptions docs](https://developers.telnyx.com/docs/voice/webrtc/js-sdk/interfaces/iclientoptions)
- **Remote Element:** `client.remoteElement` set to STRING ID (`"telnyx-remote-audio"`) per [npm docs](https://www.npmjs.com/package/@telnyx/webrtc) - SDK uses `document.getElementById` internally
- **Call Options:** `audio: true`, `useStereo: true`, `preferred_codecs` (PCMU/PCMA) per [ICallOptions docs](https://developers.telnyx.com/docs/voice/webrtc/js-sdk/interfaces/icalloptions)
- **Audio Settings:** `setAudioSettings({echoCancellation, noiseSuppression, autoGainControl})` per [TelnyxRTC docs](https://developers.telnyx.com/docs/voice/webrtc/js-sdk/classes/telnyxrtc#setaudiosettings)
- **Error Handling:** `userMediaError` event for microphone issues per [Error Handling docs](https://developers.telnyx.com/docs/voice/webrtc/js-sdk/error-handling)
- **SRTP Disabled:** `encrypted_media: null` for WebRTC compatibility per Telnyx OpenAPI spec

### Telnyx Call Control Application Architecture (Dec 2024)
**TWO ROUTING OPTIONS AVAILABLE:**
1. **Credential Connection Routing (Legacy):** Phone numbers assigned directly to Credential Connection for zero-latency but with SDK hangup bug (busy tone).
2. **Call Control Application Routing (New):** Uses Call Control API for proper hangup via REST API.

**Call Control Application Flow:**
- Phone numbers assigned to Call Control App via `call_control_application_id` (NOT `connection_id`)
- Webhook endpoint: `/webhooks/telnyx/call-control/:companyId`
- Flow: `call.initiated` → answer PSTN leg → dial to SIP credential → `call.answered` → bridge legs
- Hangup uses REST API: `POST /v2/calls/{call_control_id}/actions/hangup` with NORMAL_CLEARING (16)
- SIP username cache with 5-min TTL for <200ms webhook response
- `anchorsite_override: "Latency"` for optimal audio routing

**Migration Endpoint:** `POST /api/telephony/migrate-to-call-control`
- Creates Call Control Application if not exists
- Reassigns phone numbers using `{ call_control_application_id: appId, connection_id: null }`
- Stores `callControlAppId` in `telephonySettings` table

**Repair Routine Logic:**
- If `callControlAppId` exists → assign numbers to Call Control App
- Otherwise → assign to Credential Connection (backward compatible)

### System Design Choices
The system uses PostgreSQL with Drizzle ORM, enforcing strict multi-tenancy. Security includes robust password management and 2FA. Dates are handled as `yyyy-MM-dd` strings. A `node-cron` background scheduler manages reminder notifications. Phone numbers are standardized, and all message timestamps are normalized to UTC. Performance is optimized with database indexes and aggressive caching.

### Security Architecture
- **Session Security:** Relies on `SESSION_SECRET`.
- **Webhook Validation:** Signature validation for Twilio, BulkVS, and BlueBubbles.
- **Input Validation:** Zod schema validation on all public-facing endpoints.
- **Open Redirect Protection:** Tracking endpoint validates redirect URLs against an allowlist.
- **Unsubscribe Token Enforcement:** Unsubscribe endpoint requires and validates security tokens.
- **BulkVS Security:** User-scoped data isolation, webhook secret validation, E.164 phone normalization, 5MB file upload limit.
- **iMessage Security:** Webhook secret isolation, admin-only settings, feature gating, multi-tenant GUID scoping, and early-return guards.
- **WhatsApp Integration:** Multi-tenant session isolation, QR code authentication, real-time webhooks, company-scoped instances, business profile hydration, automatic media download, full chat history sync, and media storage in Data URI format within the database.

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
### Telnyx WebRTC SDK Hangup Bug Workaround (Dec 2024)
- **BUG DISCOVERED**: The Telnyx WebRTC SDK has a hardcoded bug in `BaseCall.ts` lines 386-387 where `hangup()` ALWAYS sends `cause: 'USER_BUSY'` and `causeCode: 17` (SIP 486) instead of respecting the parameters passed.
- **IMPACT**: When the agent hangs up an inbound call, the caller sees "User Busy" instead of normal call termination.
- **WORKAROUND**: For inbound calls, the system captures `telnyxLegId` when the call becomes active, then uses the Telnyx Call Control REST API (`POST /v2/calls/{call_control_id}/actions/hangup`) instead of the SDK's `hangup()` method.
- **ENDPOINT**: `/api/webrtc/call-control-hangup` accepts `{ telnyxLegId }` and terminates the call with proper NORMAL_CLEARING (16).
- **SOURCE**: https://github.com/team-telnyx/webrtc/blob/main/packages/js/src/Modules/Verto/webrtc/BaseCall.ts
