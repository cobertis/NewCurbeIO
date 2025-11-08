# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system designed for businesses, offering customer relationship management, communication, and an admin dashboard for superadmins. It integrates iMessage/SMS/RCS, role-based access, Stripe billing, and custom SMTP notifications. Key modules include Quotes, Policies, Campaigns, and a real-time SMS Chat application, all built on a scalable full-stack architecture. The project aims to streamline operations and enhance communication capabilities for its users.

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
- NO prefetching - let queries load naturally and show loading state
- Apply consistently across ALL pages, sheets, dialogs, and async components
- This ensures a uniform user experience throughout the entire application

**CRITICAL: All sensitive data (SSN, income, immigration documents, payment methods) is stored in PLAIN TEXT without encryption or masking as per explicit user requirement.**

## Recent Critical Fixes (November 2025)

**Quotes Page Crash Fix (November 8, 2025):**
- **Problem:** Quotes page showed blank screen when opening a quote
- **Root Cause:** Line 5048 attempted `.map()` on `quoteDetail.members` when it was `undefined`
- **Error:** "Cannot read properties of undefined (reading 'map')"
- **Solution:** Added guard `quoteDetail && quoteDetail.members` and return empty array `{ members: [] }` instead of `undefined`
- **Result:** Preserves data structure for downstream code, prevents crash, shows empty state gracefully
- **Implementation:** `client/src/pages/quotes.tsx` line 5051-5053

**Dashboard Real-Time WebSocket Implementation (November 8, 2025):**
- **Problem:** Dashboard stats (especially Failed Login counter) took up to 2 minutes to update after new events
- **Previous Approach:** Polling every 30 seconds (wasteful: 120 requests/hour per user)
- **Final Solution:** WebSocket-based real-time updates - updates ONLY when events occur
- **Architecture:**
  1. Dashboard subscribes to WebSocket messages (`notification_update`, `dashboard_update`, `data_invalidation`)
  2. Backend broadcasts WebSocket message when events occur (login failed, task created, etc.)
  3. Dashboard invalidates query cache and refetches only when needed
  4. Fallback: 5-minute polling interval (only if WebSocket fails)
- **Benefits:**
  - ✅ Zero resource waste - no unnecessary polling
  - ✅ Instant updates when events occur
  - ✅ Scalable to thousands of concurrent users
  - ✅ Existing `notificationService` methods already broadcast updates
- **Implementation:** `client/src/pages/dashboard.tsx` lines 7-8, 39-62

**Calendar Week List View (November 8, 2025):**
- **Feature:** Added complete week list view alongside existing month view
- **URL Parameter:** `?initialView=listWeek` to open directly in week view
- **UI Components:** Month/Week toggle buttons, day-by-day event cards with full details
- **Navigation:** Adaptive prev/next buttons (months for month view, weeks for week view)
- **Integration:** Dashboard "Birthdays this week" card now links to week view
- **Implementation:** `client/src/pages/calendar.tsx`

**Dashboard Failed Login Counter Fix:**
- **Problem:** Dashboard "Failed Login Attempts" card always showed "0" despite failed login notifications
- **Root Causes:** 
  1. Dashboard searched for `login_failed` but logs stored as `auth_login_failed` (with `auth_` prefix)
  2. Activity logs had `company_id = NULL` for authentication events, preventing company-filtered queries
- **Solution:** 
  1. Updated dashboard query to search for `auth_login_failed` action
  2. Added `companyId` parameter to `logAuth()` method in `logging-service.ts`
  3. Updated all `logger.logAuth()` calls to pass user's `companyId`
  4. Migrated 5,327 historical records to populate `company_id` using `user_id` and `entity_id`
- **Implementation:** `server/routes.ts` lines 2834, 934, 952, 965, 980, 995, 1012; `server/logging-service.ts` line 77
- **Pattern:** All authentication actions stored with `auth_` prefix (e.g., `auth_login`, `auth_login_failed`, `auth_logout`)

**Settings Page Race Condition Fix:**
- **Problem:** Intermittent blank company data (Business Profile, Company Logo) in Settings page
- **Root Cause:** Page rendered before company data finished loading (race condition)
- **Solution:** Added robust data readiness gate: `isCompanyDataReady = !user?.companyId || (!!companyData?.company && !isLoadingCompany)`
- **Implementation:** `client/src/pages/settings.tsx` lines 444-449
- **Pattern:** ALWAYS verify data exists, not just loading state

**Database Connection Fix:**
- **Problem:** Production errors "Failed to parse URL from https://api.208.158.174/sql"
- **Root Cause:** Used Neon HTTP driver (`@neondatabase/serverless`) for regular PostgreSQL
- **Solution:** Replaced with `postgres` package in `/api/user/sessions`, `/api/logout-all-sessions`, `/api/password-reset`
- **Added:** try/finally blocks to prevent connection leaks
- **Implementation:** `server/routes.ts`

**Method Name Conflict Fix:**
- **Problem:** Duplicate `updatePolicyPlan` methods causing build warnings
- **Solution:** Renamed to distinguish purposes:
  - `updatePolicySelectedPlan` - Updates Policy's selectedPlan field
  - `updatePolicyPlan` - CRUD operations for PolicyPlan table
- **Implementation:** `server/storage.ts` lines 653, 4313, 5697; `server/routes.ts` line 14522

**User Phone Number Creation Fix:**
- **Problem:** Phone numbers not saved when creating new users in Team Settings
- **Root Cause:** Frontend converted empty string to `undefined`: `phone: data.phone ? formatE164(data.phone) : undefined`
- **Impact:** When phone field left empty, `undefined` value caused backend to skip field entirely
- **Solution:** Changed to `phone: data.phone && data.phone.trim() ? formatE164(data.phone) : null`
- **Result:** Empty phone fields now save as `null`, and filled fields save correctly in E.164 format
- **Implementation:** `client/src/pages/settings.tsx` line 2739

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