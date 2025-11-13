# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system designed to enhance operational efficiency and communication for businesses. It provides comprehensive customer relationship management, communication tools (iMessage/SMS/RCS), and an admin dashboard for superadmins. Key capabilities include managing Quotes, Policies, and Campaigns, alongside a real-time SMS Chat application. The system also integrates role-based access, Stripe billing, and custom SMTP notifications.

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
- `fullScreen={true}` (default) for pages, `fullScreen={false}` for sheets/dialogs
- Apply consistently across ALL pages, sheets, dialogs, and async components
- This ensures a uniform user experience throughout the entire application
**CRITICAL: All sensitive data (SSN, income, immigration documents, payment methods) is stored in PLAIN TEXT without encryption or masking as per explicit user requirement.**

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, TypeScript, Vite, Shadcn/ui (New York style), Radix UI, and Tailwind CSS, supporting custom theming (light/dark modes) and a mobile-first responsive design. Navigation is sidebar-based, featuring a dynamic three-column layout for the SMS chat application.

### Technical Implementations
The frontend utilizes Wouter for routing and TanStack Query for state management. The backend is an Express.js application with TypeScript, offering a RESTful API with session-based authentication and role-based access control.

**Key Features:**
- **User & Company Management:** CRUD operations, RBAC, 2FA.
- **Authentication & Security:** Bcrypt hashing, email activation, OTP 2FA, session management.
- **Multi-tenancy:** Strict data isolation between tenants.
- **Email System:** Global SMTP and database-driven templates.
- **Modular Feature System:** Superadmins can assign features to companies.
- **Audit Logging:** Centralized action tracking.
- **Campaign System:** Unified Email/SMS campaign and contact list management.
- **Real-Time Notifications:** WebSocket-based updates.
- **BulkVS Chat System:** WhatsApp-style SMS/MMS messaging with real-time updates.
- **iMessage Integration (BlueBubbles):** Full Apple iMessage clone functionality, including a 3-column layout, authentic bubble styling (blue for iMessage, green for SMS/RCS), reactions, reply-to threading, message effects, typing indicators, read receipts, multimedia support, message search, group conversations, and message deletion. Features a native voice memo system with progressive waveform recording, WebM→CAF/Opus conversion, and novel waveform visualization. Secure webhook integration and contact synchronization are included. **Attachment Persistence System:** All iMessage attachments (images, videos, audio) are immediately downloaded from BlueBubbles upon webhook receipt and permanently stored in local filesystem (`uploads/imessage/`). This ensures media persists indefinitely regardless of BlueBubbles server restarts or cache purges. Includes automatic "healing" mechanism that backfills old attachments on first access.
- **Billing & Stripe Integration:** Automated customer and subscription management.
- **Quotes Management System:** A 3-step wizard with Google Places Autocomplete, CMS Marketplace API integration, plan comparison, and document management.
- **Policies Management System:** Converts quotes to policies, manages statuses, assigns agents, and identifies canonical clients. Supports cursor-based pagination and a hybrid search approach (client-side for primary data, server-side for family members).
- **Policy Folders System:** Organizational folder system for policies, supporting agency-shared and personal folders with RBAC, bulk operations, and real-time policy counts.
- **Consent Document System:** Generates legal consent documents, supports multi-channel delivery, and e-signatures.
- **Calendar System:** Full-screen, multi-tenant display of company-wide events.
- **Reminder System:** Background scheduler for notifications, manual event creation, and appointment availability configuration.
- **Agent Assignment System:** Flexible reassignment for quotes and policies.
- **Policy Renewal System:** Automated renewal period activation with CMS Marketplace integration.
- **Landing Page Builder System:** A SmartBio/Lynku.id-style bio link page creator with a 3-column editor, drag & drop, real-time mobile preview, and modern gradient themes.
- **Unified Contacts Directory:** Comprehensive contact management system with deduplication, filtering, and CSV export. Includes contact list management with member assignment and a "No List" filter to view contacts not assigned to any list.
- **Tasks & Reminders Management System:** Unified task management with assignment, priority levels, status tracking, due dates, and advanced filtering.
- **Birthday Automation System:** Automated birthday greetings via Twilio SMS/MMS.
- **Navigation Prefetch System:** Preloads page data before navigation.
- **User-Level Data Visibility System:** Fine-grained data visibility controls.
- **Policy Data Architecture:** Hybrid data sharing where Notes, Documents, Consents, and Payment Methods are shared across all client policies, while Reminders are isolated per policy year.
- **CMS Marketplace Integration:** Pure pass-through system for CMS Marketplace API responses, including a Hybrid Filtering System and Flexible Cost-Share Parsing. Manages APTC persistence.
- **Tab Auto-Save System:** Intelligent tab navigation with automatic data persistence and inline feedback, preventing data loss.

### System Design Choices
The system uses PostgreSQL with Drizzle ORM, enforcing strict multi-tenancy. Security includes robust password management and 2FA. Dates are handled as `yyyy-MM-dd` strings to prevent timezone issues. A `node-cron` background scheduler manages reminder notifications. Phone numbers are standardized using centralized phone utilities. All message timestamps are normalized to UTC before converting to the user's local timezone. Policies are ordered by most recently edited first with cursor-based pagination for efficient handling of large datasets, using a 3-field composite key. Performance is optimized with database indexes and aggressive caching.

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