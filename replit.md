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
- **User & Company Management:** CRUD operations, RBAC, 2FA, multi-tenancy.
- **Communication Systems:**
    - **Email System:** Global SMTP and database-driven templates.
    - **Campaign System:** Unified Email/SMS campaign and contact list management.
    - **BulkVS Chat System:** WhatsApp-style SMS/MMS messaging with real-time updates.
    - **iMessage Integration (BlueBubbles):** Full Apple iMessage clone functionality with authentic bubble styling, reactions, reply-to threading, message effects, typing indicators, read receipts, multimedia support, message search, group conversations, message deletion, and native voice memo system.
    - **WebPhone WebRTC System:** Professional SIP-based calling with SIP.js, per-user configuration, call management (mute, hold, blind/attended transfer, recording, DND, call waiting), iPhone-style glassmorphism UI, responsive design, caller ID lookup, missed call notifications, call history, and DTMF support.
- **Billing & Stripe Integration:** Automated customer and subscription management.
- **Quotes Management System:** 3-step wizard with Google Places Autocomplete, CMS Marketplace API integration, plan comparison, and document management.
- **Policies Management System:** Converts quotes to policies, manages statuses, assigns agents, identifies canonical clients, supports cursor-based pagination, and hybrid search. Includes a folder system with RBAC.
- **Consent Document System:** Generates legal consent documents, supports multi-channel delivery, and e-signatures.
- **Calendar & Reminder Systems:** Full-screen, multi-tenant display of company-wide events with background scheduler and manual event creation.
- **Landing Page Builder System:** SmartBio/Lynku.id-style bio link page creator with a 3-column editor, drag & drop, and real-time mobile preview.
- **Unified Contacts Directory:** Comprehensive contact management with automatic aggregation from all system sources (quotes, policies, leads, SMS, iMessage), non-destructive merge logic, filtering, CSV export, and bulk operations.
- **Tasks & Reminders Management System:** Unified task management with assignment, priority, status tracking, due dates, and advanced filtering.
- **Birthday Automation System:** Automated birthday greetings via Twilio SMS/MMS, aggregating birthdays from multiple sources.
- **Dashboard Year Filter:** Global year filter for dashboard statistics across multiple endpoints.
- **Policy Data Architecture:** Hybrid data sharing for Notes, Documents, Consents, Payment Methods (shared) and Reminders (per policy year).
- **CMS Marketplace Integration:** Pure pass-through system with Hybrid Filtering and Flexible Cost-Share Parsing.
- **Tab Auto-Save System:** Intelligent tab navigation with automatic data persistence.
- **Duplicate Message Prevention System:** Robust transactional claim system for campaign messages.

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