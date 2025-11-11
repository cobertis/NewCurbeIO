# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system providing customer relationship management, communication tools, and an admin dashboard for superadmins. It integrates iMessage/SMS/RCS, role-based access, Stripe billing, and custom SMTP notifications. Key modules include Quotes, Policies, Campaigns, and a real-time SMS Chat application. The project's vision is to offer a comprehensive CRM that enhances operational efficiency and communication for businesses across various sectors.

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
The frontend uses React 18, TypeScript, Vite, Shadcn/ui (New York style), Radix UI, and Tailwind CSS for custom theming (light/dark modes) and a mobile-first responsive design. Navigation is sidebar-based, with a dynamic three-column layout for the SMS chat application.

### Technical Implementations
The frontend uses Wouter for routing and TanStack Query for state management. The backend is Express.js with TypeScript, providing a RESTful API with session-based authentication and role-based access control.

**Key Features:**
- **User & Company Management:** CRUD, RBAC, 2FA.
- **Authentication & Security:** Bcrypt hashing, email activation, OTP 2FA, session management.
- **Multi-tenancy:** Strict data isolation.
- **Email System:** Global SMTP and database-driven templates.
- **Modular Feature System:** Superadmins assign features to companies.
- **Audit Logging:** Centralized action tracking.
- **Campaign System:** Unified Email/SMS Campaign and Contact List management.
- **Real-Time Notifications:** WebSocket-based updates.
- **BulkVS Chat System:** WhatsApp-style SMS/MMS messaging with dedicated phone numbers, real-time updates, and privacy isolation.
- **Billing & Stripe Integration:** Automated customer/subscription management.
- **Quotes Management System:** 3-step wizard, Google Places Autocomplete, CMS Marketplace API integration, plan comparison, and document management.
- **Policies Management System:** Converts quotes to policies, status management, agent assignment, and canonical client identification, using cursor-based pagination. Search by family members feature uses server-side filtering via `searchTerm` and `includeFamilyMembers` parameters sent to backend, which performs LEFT JOIN with policy_members table to search across client AND family member data (names, emails, phones).
- **Consent Document System:** Generates legal consent documents, multi-channel delivery, e-signatures.
- **Calendar System:** Full-screen, multi-tenant display of company-wide events.
- **Reminder System:** Background scheduler for notifications, manual event creation, and appointment availability configuration.
- **Agent Assignment System:** Flexible reassignment for quotes and policies.
- **Policy Renewal System:** Automated renewal period activation with smart CMS Marketplace integration, validating state-based exchanges.
- **Landing Page Builder System:** SmartBio/Lynku.id-style bio link page creator with a 3-column editor, drag & drop, real-time mobile preview, and modern gradient themes.
- **Unified Contacts Directory:** Comprehensive contact management system aggregating contacts from Quotes, Policies, and Manual Contacts with deduplication, filtering, and CSV export.
- **Tasks & Reminders Management System:** Unified task management with assignment, priority levels, status tracking, due dates, and advanced filtering.
- **Birthday Automation System:** Automated birthday greetings via Twilio SMS/MMS, with customizable messages and image library, tracking sending history.
- **Navigation Prefetch System:** Preloads page data before navigation.
- **User-Level Data Visibility System:** Fine-grained data visibility controls allowing selective sharing of data between team members, configurable via UI switch.
- **Policy Data Architecture:** Hybrid data sharing model where Notes, Documents, Consents, and Payment Methods are shared across all client policies, while Reminders are isolated per policy year.
- **CMS Marketplace Integration:** Pure pass-through system returning exact CMS Marketplace API responses. Includes a Hybrid Filtering System (backend for metal levels/issuers, frontend for premium/deductible/features) and a Flexible Cost-Share Parsing System for unified cost-share value handling.
- **Tab Auto-Save System:** Intelligent tab navigation with automatic data persistence. When switching between tabs in Edit Member or Add Member forms, the system validates current tab fields, auto-saves valid data, and shows inline feedback. Prevents data loss and ensures information is always up-to-date. Tabs are disabled during save operations to prevent race conditions.

### System Design Choices
Uses PostgreSQL with Drizzle ORM, enforcing strict multi-tenancy. Security includes robust password management and 2FA. Dates are handled as `yyyy-MM-dd` strings to prevent timezone issues. A background scheduler (`node-cron`) manages reminder notifications. Centralized phone utilities standardize 11-digit phone number formatting. All message timestamps are normalized using `parseISO()` to explicitly parse as UTC before converting to user's local timezone with `toZonedTime()`.
The policies system uses cursor-based pagination with database indexes for efficient handling of large datasets and server-side search filtering. **Policies are always ordered by most recent effectiveDate first** using PostgreSQL `::date` cast in ORDER BY to ensure chronological sorting despite text column storing mixed formats (ISO "2025-02-12" and non-ISO "2025-2-12"). Policy page performance is optimized with aggressive caching of stats queries.

### Security Architecture
- **Session Security:** `SESSION_SECRET` environment variable mandatory.
- **Webhook Validation:** Twilio and BulkVS webhook signature validation.
- **Input Validation:** Zod schema validation on all public-facing endpoints.
- **Open Redirect Protection:** Tracking endpoint validates redirect URLs against an allowlist.
- **Unsubscribe Token Enforcement:** Unsubscribe endpoint requires and validates security tokens.
- **BulkVS Security:** User-scoped data isolation, `BULKVS_WEBHOOK_SECRET` validation, E.164 phone normalization, 5MB file upload limit.

## External Dependencies

- **Database:** PostgreSQL, Drizzle ORM, `postgres`.
- **Email:** Nodemailer.
- **SMS/MMS:** Twilio, BulkVS.
- **Payments:** Stripe.
- **UI Components:** Radix UI, Shadcn/ui, Lucide React, CMDK, Embla Carousel.
- **Drag & Drop:** @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities.
- **Rich Text Editing:** TipTap.
- **Form Management & Validation:** React Hook Form, Zod.
- **Session Management:** `express-session`, `connect-pg-simple`.
- **Security:** Bcrypt.
- **Utilities:** `date-fns`.
- **Background Jobs:** `node-cron`.