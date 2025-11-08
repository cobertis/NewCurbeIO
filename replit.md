# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system designed for businesses, offering customer relationship management, communication, and an admin dashboard for superadmins. It integrates iMessage/SMS/RCS, role-based access, Stripe billing, and custom SMTP notifications. Key modules include Quotes, Policies, Campaigns, and a real-time SMS Chat application, all built on a scalable full-stack architecture. The project aims to streamline operations and enhance communication capabilities for its users with a business vision to provide a comprehensive, multi-tenant CRM that enhances operational efficiency and communication for businesses across various sectors.

## User Preferences
Preferred communication style: Simple, everyday language.
Design style: Extremely professional corporate design - NO bright colors, NO emojis, space-efficient mobile-responsive UI.

**Toast Notifications:**
- All toast notifications auto-dismiss after 3 seconds
- Users can still manually dismiss toasts before the timeout

**Loading State Pattern (MANDATORY):**
ALWAYS use the standardized `LoadingSpinner` component for all loading states across the application:
```tsx
import { LoadingSpinner } from "@/components/loading-spinner";

// For full-screen loading (pages, major components):
if (isLoading) {
  return <LoadingSpinner message="Loading data..." />;
}

// For smaller containers (sheets, dialogs):
if (isLoading) {
  return <LoadingSpinner message="Loading..." fullScreen={false} />;
}
```
- User strongly prefers consistent loading indicators across all pages
- Shows large, centered spinner (h-12 w-12) with descriptive text
- `fullScreen={true}` (default) for pages, `fullScreen={false}` for sheets/dialogs
- Navigation prefetch enabled to improve UX (see Navigation Prefetch System below)
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
- **BulkVS Chat System:** WhatsApp-style SMS/MMS messaging with dedicated phone numbers, real-time updates, privacy isolation, and automated webhook management. Includes message status, read receipts, labels/tags, pin/mute/archive, unread counters, thread search, and default avatars. Supports new message creation, thread deletion, number provisioning, billing, and number reactivation.
- **Billing & Stripe Integration:** Automated customer/subscription management.
- **Quotes Management System:** 3-step wizard for 11 product types, Google Places Autocomplete, CMS Marketplace API integration, plan comparison, and document management.
- **Policies Management System:** Converts quotes to policies, status management, agent assignment, and canonical client identification.
- **Consent Document System:** Generates legal consent documents, multi-channel delivery, e-signatures.
- **Calendar System:** Full-screen, multi-tenant display of company-wide events.
- **Reminder System:** Background scheduler for notifications.
- **Manual Event Creation:** For Birthday, Reminder, and Appointment events.
- **Appointment Availability Configuration:** User-specific scheduling.
- **Agent Assignment System:** Flexible reassignment for quotes and policies.
- **Policy Renewal System:** Automated renewal period activation.
- **Landing Page Builder System:** SmartBio/Lynku.id-style bio link page creator with a 3-column editor, drag & drop, real-time mobile preview, and modern gradient themes.
- **Unified Contacts Directory:** Comprehensive contact management system aggregating contacts from Quotes, Policies, and Manual Contacts (excludes BulkVS SMS contacts). Features intelligent deduplication, advanced filtering, search, CSV export (with SSN masking for non-superadmins), and role-based access control. Manual contacts can be added from SMS chat.
- **Tasks & Reminders Management System:** Unified task management with assignment, priority levels, status tracking, due dates, descriptions, search, and advanced filtering. Superadmins have cross-company visibility.
- **Navigation Prefetch System**: System that preloads page data before navigation to improve user experience.

### System Design Choices
Uses PostgreSQL with Drizzle ORM, enforcing strict multi-tenancy. Security includes robust password management and 2FA. Dates are handled as `yyyy-MM-dd` strings to prevent timezone issues. A background scheduler (`node-cron`) manages reminder notifications. Centralized phone utilities (`shared/phone.ts`) standardize phone number formatting to 11-digit (with "1" prefix) for consistency with BulkVS API. All message timestamps are normalized using `parseISO()` to explicitly parse as UTC before converting to user's local timezone with `toZonedTime()`.

### Security Architecture
- **Session Security:** `SESSION_SECRET` environment variable mandatory.
- **Webhook Validation:** Twilio and BulkVS webhook signature validation.
- **Input Validation:** Zod schema validation on all public-facing endpoints.
- **Open Redirect Protection:** Tracking endpoint validates redirect URLs against an allowlist.
- **Unsubscribe Token Enforcement:** Unsubscribe endpoint requires and validates security tokens.
- **BulkVS Security:** User-scoped data isolation, `BULKVS_WEBHOOK_SECRET` validation, E.164 phone normalization, 5MB file upload limit.

## External Dependencies

- **Database:** PostgreSQL (local production server), Drizzle ORM, `postgres` package for raw SQL queries.
- **Email:** Nodemailer.
- **SMS/MMS:** Twilio (system notifications), BulkVS (individual user chat).
- **Payments:** Stripe.
- **UI Components:** Radix UI, Shadcn/ui, Lucide React, CMDK, Embla Carousel.
- **Drag & Drop:** @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities.
- **Rich Text Editing:** TipTap (React, StarterKit, Underline, TextAlign, Link, Color, TextStyle extensions).
- **Form Management & Validation:** React Hook Form, Zod.
- **Session Management:** `express-session`, `connect-pg-simple`.
- **Security:** Bcrypt.
- **Utilities:** `date-fns`.
- **Background Jobs:** `node-cron`.