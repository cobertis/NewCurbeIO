# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system designed to enhance operational efficiency and communication for businesses. It offers comprehensive customer relationship management, communication tools (iMessage/SMS/RCS), and an admin dashboard. Key capabilities include managing Quotes, Policies, and Campaigns, alongside a real-time SMS Chat application. The system integrates role-based access, Stripe billing, and custom SMTP notifications. The business vision is to provide a unified platform for businesses to manage customer interactions, automate marketing campaigns, and streamline policy and quote management, thereby increasing operational efficiency and improving customer engagement.

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
**WebPhone Configuration:**
- Each user can configure their own SIP credentials (extension, password, server)
- Default SIP server: wss://pbx.curbe.io:8089/ws
- SIP domain/realm: pbx.curbe.io
- WebPhone auto-initializes when user has valid SIP credentials
- Configuration stored per-user in database (sipExtension, sipPassword, sipServer, sipEnabled)
**CRITICAL AUDIO FIX**: Session delegate (including onSessionDescriptionHandler) is now configured when incoming call arrives, not when user answers. This follows Browser-Phone pattern and ensures audio tracks are registered immediately upon accepting the call, eliminating the ~5 second delay that occurred when delegate was configured after accept()

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, TypeScript, Vite, Shadcn/ui (New York style), Radix UI, and Tailwind CSS. It supports custom theming (light/dark modes) and a mobile-first responsive design. Navigation is sidebar-based, featuring a dynamic three-column layout for the SMS chat application.

### Technical Implementations
The frontend uses Wouter for routing and TanStack Query for state management. The backend is an Express.js application with TypeScript, providing a RESTful API with session-based authentication and role-based access control.

**Key Features:**
- **User & Company Management:** CRUD operations, RBAC, 2FA.
- **Multi-tenancy:** Strict data isolation between tenants.
- **Email System:** Global SMTP and database-driven templates.
- **Campaign System:** Unified Email/SMS campaign and contact list management.
- **Real-Time Notifications:** WebSocket-based updates.
- **BulkVS Chat System:** WhatsApp-style SMS/MMS messaging with real-time updates.
- **iMessage Integration (BlueBubbles):** Full Apple iMessage clone functionality with authentic bubble styling, reactions, reply-to threading, message effects, typing indicators, read receipts, multimedia support, message search, group conversations, message deletion, and native voice memo system. All iMessage attachments are persistently stored locally.
- **WebPhone WebRTC System:** Professional SIP-based calling with complete Browser-Phone integration. Features include:
  - **Core SIP Integration:** SIP.js library, singleton pattern for persistent calls, WebSocket proxy for session-authenticated connections
  - **Per-User Configuration:** Database-stored SIP credentials (extension, password, server), auto-initialization on login
  - **Call Management:** Full call control with mute, hold, blind transfer, attended transfer, call recording, Do Not Disturb, Call Waiting
  - **Transfer Implementation:** Both blind and attended transfer follow Browser-Phone reference pattern. Blind transfer uses `UserAgent.makeURI()` to create proper SIP URI objects with percent-encoding. Attended transfer passes the consultation session object to preserve Replaces headers for proper server-side transfer handling.
  - **UI/UX:** iPhone-style glassmorphism design, 3-zone fixed layout (header, scrollable content, fixed bottom menu), incoming call modal with ringtone
  - **Call History:** Color-coded status (red for missed, green for answered), localStorage persistence with proper Date deserialization
  - **Audio System:** Automatic audio element registration, modern iPhone ringtone for incoming calls, professional ringback tone (US/Canada standard 440Hz+480Hz) for outbound calls, remote audio stream handling
  - **DTMF Support:** Full dialpad with tone generation for IVR navigation
- **Billing & Stripe Integration:** Automated customer and subscription management.
- **Quotes Management System:** A 3-step wizard with Google Places Autocomplete, CMS Marketplace API integration, plan comparison, and document management.
- **Policies Management System:** Converts quotes to policies, manages statuses, assigns agents, and identifies canonical clients. Supports cursor-based pagination and a hybrid search.
- **Policy Folders System:** Organizational folder system for policies with RBAC and bulk operations.
- **Consent Document System:** Generates legal consent documents, supports multi-channel delivery, and e-signatures.
- **Calendar System:** Full-screen, multi-tenant display of company-wide events.
- **Reminder System:** Background scheduler for notifications, manual event creation, and appointment availability configuration.
- **Landing Page Builder System:** A SmartBio/Lynku.id-style bio link page creator with a 3-column editor, drag & drop, and real-time mobile preview.
- **Unified Contacts Directory:** Comprehensive contact management with deduplication, filtering, CSV export, contact list management, and bulk operations.
- **Tasks & Reminders Management System:** Unified task management with assignment, priority levels, status tracking, due dates, and advanced filtering.
- **Birthday Automation System:** Automated birthday greetings via Twilio SMS/MMS.
- **Policy Data Architecture:** Hybrid data sharing where Notes, Documents, Consents, and Payment Methods are shared across all client policies, while Reminders are isolated per policy year.
- **CMS Marketplace Integration:** Pure pass-through system for CMS Marketplace API responses, including a Hybrid Filtering System and Flexible Cost-Share Parsing, managing APTC persistence.
- **Tab Auto-Save System:** Intelligent tab navigation with automatic data persistence and inline feedback.
- **Duplicate Message Prevention System:** Robust transactional claim system with recovery sweep to prevent duplicate campaign messages.

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