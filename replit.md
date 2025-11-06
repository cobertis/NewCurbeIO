# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system designed to streamline customer relationship management and communication for businesses. It provides an admin dashboard for superadmins to manage companies and users, offering integrated iMessage/SMS/RCS capabilities, role-based access, Stripe billing, and custom SMTP notifications. Key modules include Quotes, Policies, Campaigns, and a real-time SMS Chat application, all built on a scalable full-stack architecture.

## User Preferences
Preferred communication style: Simple, everyday language.
Design style: Extremely professional corporate design - NO bright colors, NO emojis, space-efficient mobile-responsive UI.

**Toast Notifications:**
- All toast notifications auto-dismiss after 3 seconds
- Users can still manually dismiss toasts before the timeout

**SMS Notifications:**
- Landing page appointment bookings send SMS confirmations to customers
- Message format in Spanish includes agent name, company name, date/time of appointment
- SMS sent via Twilio after successful appointment creation

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
- NO prefetching - let queries load naturally and show loading state
- Apply consistently across ALL pages, sheets, dialogs, and async components
- This ensures a uniform user experience throughout the entire application

**CRITICAL: All sensitive data (SSN, income, immigration documents, payment methods) is stored in PLAIN TEXT without encryption or masking as per explicit user requirement.**

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, Vite, Shadcn/ui (New York style), Radix UI, and Tailwind CSS for custom theming (light/dark modes) and a mobile-first responsive design. Navigation is sidebar-based, with a dynamic three-column layout for the SMS chat application.

### Technical Implementations
The frontend uses Wouter for routing and TanStack Query for state management. The backend is Express.js with TypeScript, providing a RESTful API with session-based authentication and role-based access control.

**Key Features:**
- **User & Company Management:** CRUD, RBAC, 2FA, team features.
- **Authentication & Security:** Bcrypt hashing, email activation, OTP 2FA, session management.
- **Multi-tenancy:** Strict data isolation.
- **Email System:** Global SMTP and database-driven templates.
- **Modular Feature System:** Superadmins assign features to companies.
- **Audit Logging:** Centralized action tracking.
- **Campaign System:** Unified Email/SMS Campaign and Contact List management.
- **Real-Time Notifications:** WebSocket-based updates.
- **BulkVS Chat System:** WhatsApp-style SMS/MMS messaging platform with dedicated phone numbers per user, real-time updates, full privacy isolation, and automated webhook management. Features include SMS/MMS with file upload, emoji picker, message status, read receipts, labels/tags, pin/mute/archive, unread counters, thread search, real-time updates via WebSocket, WhatsApp-style chronological message ordering, thread deletion with confirmation dialog, and professional default avatars for contacts without names.
    - **New Message Feature:** WhatsApp-style modal with phone number formatting, validation, and automatic thread creation.
    - **Delete Thread:** Complete thread deletion removes thread and all associated messages with CASCADE cleanup. Includes confirmation dialog to prevent accidental deletions. Authorization ensures users can only delete their own threads.
    - **Default Avatars:** Professional generic user avatar icon displayed for contacts without display names across thread list, message bubbles, and contact details. Contacts with names show initials in colored circles.
    - **Number Provisioning:** Simplified area code search, 3-step wizard. Each user can only provision one phone number (toll-free numbers prohibited).
    - **Billing System:** Automatic Stripe subscription creation ($10/month per number), recurring every 30 days, allows reactivation of cancelled numbers.
    - **Phone Number Reactivation:** Cancelled numbers can be reactivated via Billing or Chat page interfaces.
    - **Phone Settings:** View number, configuration, call forwarding, billing info, deactivation, CNAM configuration.
    - **Webhook System:** Automated webhook creation and assignment during number provisioning/reactivation, with secure token-based URLs. Incoming messages process BulkVS payload, create/update threads, save messages, and broadcast via WebSocket.
- **Billing & Stripe Integration:** Automated customer/subscription management with phone numbers included in invoices.
- **Quotes Management System:** 3-step wizard for 11 product types, Google Places Autocomplete, CMS Marketplace API integration, plan comparison, credit card validation, notes, document management, universal search.
- **Policies Management System:** Converts quotes to policies, includes status management, agent assignment, universal search, and canonical client identification.
- **Consent Document System:** Generates legal consent documents, supports multi-channel delivery, and captures e-signatures.
- **Calendar System:** Full-screen, multi-tenant calendar displaying company-wide events.
- **Reminder System:** Background scheduler for notifications, snooze functionality, and duplicate prevention.
- **Manual Event Creation:** Comprehensive event creation for Birthday, Reminder, and Appointment events.
- **Appointment Availability Configuration:** User-specific scheduling preferences.
- **Agent Assignment System:** Flexible reassignment for quotes and policies with filtering and real-time notifications.
- **Policy Renewal System:** Automated renewal period activation with dynamic year calculation and OEP filter management.
- **Landing Page Builder System:** SmartBio/Lynku.id-style bio link page creator with a 3-column editor, drag & drop, real-time mobile preview, and modern gradient themes. Each user gets one automatically created landing page. Supports 14 block types including interactive Google Maps and direct image uploads. Public pages accessible without authentication.
- **Unified Contacts Directory:** Comprehensive contact management system aggregating contacts from Quotes, Policies, and BulkVS SMS Threads (excluding system users/employees). Features intelligent deduplication with centralized displayName generation (priority: firstName+lastName > companyName > null), advanced filtering, search functionality, CSV export (with SSN masking for non-superadmins), and role-based access control. The system uses a helper function to ensure consistent name formatting across all contact sources, with empty string normalization and recalculation during deduplication merges.

### System Design Choices
Uses PostgreSQL with Drizzle ORM, enforcing strict multi-tenancy. Security includes robust password management and 2FA. Dates are handled as `yyyy-MM-dd` strings to prevent timezone issues. A background scheduler (`node-cron`) manages reminder notifications. Centralized phone utilities (`shared/phone.ts`) standardize phone number formatting across the application - ALL numbers stored in 11-digit format (with "1" prefix) for consistency with BulkVS API.

### Security Architecture
- **Session Security:** `SESSION_SECRET` environment variable mandatory.
- **Webhook Validation:** Twilio and BulkVS webhook signature validation.
- **Input Validation:** Zod schema validation on all public-facing endpoints.
- **Open Redirect Protection:** Tracking endpoint validates redirect URLs against an allowlist.
- **Unsubscribe Token Enforcement:** Unsubscribe endpoint requires and validates security tokens.
- **BulkVS Security:** User-scoped data isolation, `BULKVS_WEBHOOK_SECRET` validation, E.164 phone normalization, 5MB file upload limit.

## External Dependencies

- **Database:** Neon PostgreSQL, Drizzle ORM.
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