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
-   **User & Company Management:** CRUD, RBAC, 2FA, team features.
-   **Authentication & Security:** Bcrypt hashing, email activation, OTP 2FA, session management.
-   **Multi-tenancy:** Strict data isolation.
-   **Email System:** Global SMTP and database-driven templates.
-   **Modular Feature System:** Superadmins assign features to companies.
-   **Audit Logging:** Centralized action tracking.
-   **Campaign System:** Unified Email/SMS Campaign and Contact List management.
-   **Real-Time Notifications:** WebSocket-based updates.
-   **BulkVS Chat System:** WhatsApp-style SMS/MMS messaging platform with dedicated phone numbers per user, real-time updates, and full privacy isolation.
    -   **Architecture:** Dual messaging system - Twilio for system notifications, BulkVS for individual user chat with dedicated phone numbers.
    -   **UI:** 3-column desktop layout (thread list, message panel, contact details), responsive mobile design.
    -   **Features:** SMS/MMS with file upload (5MB limit), emoji picker, message status, read receipts, labels/tags, pin/mute/archive, unread counters, thread search, real-time updates via WebSocket.
    -   **Number Provisioning:** Simplified area code search, 3-step wizard. Each user can only provision one phone number.
    -   **Billing System:** Automatic Stripe subscription creation ($10/month per number), recurring every 30 days. Allows reactivation of cancelled numbers.
    -   **Phone Number Reactivation:** Cancelled numbers preserved with inactive status. Reactivation available via:
        - **Billing Page:** "Reactivate" button next to cancelled numbers (greyed-out styling, crossed-out price)
        - **Chat Page:** Special empty state when user has no active number but has cancelled number, showing previously cancelled number with "Reactivate" (primary) and "Get a New Number" (secondary) buttons
        - Both methods create new Stripe subscription and restore service. One-number-per-user limit enforced.
    -   **Phone Settings:** View number, configuration, call forwarding, billing info, deactivation.
    -   **CNAM (Caller ID Name):** Automatically sanitized and updated to max 15 alphanumeric characters.
    -   **Call Forwarding:** Configurable via BulkVS API.
    -   **Security:** User-scoped data isolation, webhook signature validation, E.164 phone number normalization.
-   **Billing & Stripe Integration:** Automated customer/subscription management.
-   **Quotes Management System:** 3-step wizard for 11 product types, Google Places Autocomplete, CMS Marketplace API integration (HHS Poverty Guidelines for APTC), plan comparison, credit card validation, notes, document management, universal search, blocking, and manual plan entry.
-   **Policies Management System:** Converts quotes to policies, similar functionality to Quotes, including status management, agent assignment, universal search, and blocking. Canonical client identification (SSN or email).
-   **Consent Document System:** Generates legal consent documents, supports multi-channel delivery, and captures e-signatures.
-   **Calendar System:** Full-screen, multi-tenant calendar displaying company-wide events, including deduplicated birthday events.
-   **Reminder System:** Background scheduler for notifications, snooze functionality, and duplicate prevention.
-   **Manual Event Creation:** Comprehensive event creation for Birthday, Reminder, and Appointment events. All manual events are company-scoped.
-   **Appointment Availability Configuration:** User-specific scheduling preferences via a dedicated `/appointment-settings` page.
-   **Agent Assignment System:** Flexible reassignment for quotes and policies with filtering and real-time notifications.
-   **Policy Renewal System:** Automated renewal period activation (October 1 - February 1) with dynamic year calculation and OEP filter management.
-   **Landing Page Builder System:** Professional SmartBio/Lynku.id-style bio link page creator with a 3-column editor, drag & drop, real-time mobile preview, and modern gradient themes. Each user gets one automatically created landing page.
    -   **Editor Interface:** Fixed header, editable URL, Undo/Redo, Desktop/Mobile preview, Publish button. iPhone 16 Pro Max frame preview with SmartBio-style layout (sticky header, gradient hero, curved SVG, large overlapping circular profile photo with animated spinning gradient ring, horizontal social icons). Right panel with Design (themes, typography, custom colors, profile editor, Social Media Manager), Analytics (coming soon), and Settings (URL slug, SEO meta tags) tabs.
    -   **Live Preview System:** Editor preview displays identical content to the published page with fully functional interactive elements.
    -   **Block Types:** Supports 14 block types (Basic: Link Button, Social Media, Video Embed, Text, Image, Divider, Contact; Advanced: Google Maps, Request Quote Form, Calendar/Appointment Scheduler, Testimonials/Reviews, FAQ Accordion, Stats/Metrics Counter).
    -   **Image Upload System:** Direct file upload from user's computer with live preview; images converted to base64 data URLs.
    -   **Interactive Google Maps:** Map blocks use Google Maps JavaScript API for interactive maps with markers, integrated with Google Places API.
    -   **Public Pages:** Accessible at `/:slug` and `/l/:slug` without authentication, featuring identical SmartBio layout, theme customization, SEO meta tags, and analytics tracking.

### System Design Choices
Uses PostgreSQL with Drizzle ORM, enforcing strict multi-tenancy. Security includes robust password management and 2FA. Dates are handled as `yyyy-MM-dd` strings to prevent timezone issues. A background scheduler (`node-cron`) manages reminder notifications.

### Security Architecture
-   **Session Security:** `SESSION_SECRET` environment variable mandatory.
-   **Webhook Validation:** Twilio and BulkVS webhook signature validation.
-   **Input Validation:** Zod schema validation on all public-facing endpoints.
-   **Open Redirect Protection:** Tracking endpoint validates redirect URLs against an allowlist.
-   **Unsubscribe Token Enforcement:** Unsubscribe endpoint requires and validates security tokens.
-   **BulkVS Security:** User-scoped data isolation, `BULKVS_WEBHOOK_SECRET` validation, E.164 phone normalization, 5MB file upload limit.

## External Dependencies

-   **Database:** Neon PostgreSQL, Drizzle ORM.
-   **Email:** Nodemailer.
-   **SMS/MMS:** Twilio (system notifications), BulkVS (individual user chat).
-   **Payments:** Stripe.
-   **UI Components:** Radix UI, Shadcn/ui, Lucide React, CMDK, Embla Carousel.
-   **Drag & Drop:** @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities.
-   **Rich Text Editing:** TipTap (React, StarterKit, Underline, TextAlign, Link, Color, TextStyle extensions).
-   **Form Management & Validation:** React Hook Form, Zod.
-   **Session Management:** `express-session`, `connect-pg-simple`.
-   **Security:** Bcrypt.
-   **Utilities:** `date-fns`.
-   **Background Jobs:** `node-cron`.