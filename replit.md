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
- **Policies Management System:** Converts quotes to policies, status management, agent assignment, and canonical client identification. Uses cursor-based pagination for efficient handling of 10,000+ policies with <500ms load times.
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
- **Birthday Automation System:** Automated birthday greeting system with superadmin-managed image library, per-user customizable messages and settings, Twilio SMS/MMS delivery at 9 AM local time, and comprehensive sending history tracking. Sends birthday greetings to all contacts from quotes, policies, manual contacts, and team members using the same deduplication logic as the calendar system. Configurable via Settings > Automations tab.
- **Navigation Prefetch System**: System that preloads page data before navigation to improve user experience.
- **User-Level Data Visibility System (Nov 2025):** Fine-grained data visibility controls allowing selective sharing of policies, quotes, contacts, tasks, and calendar events between team members. Admins can toggle the `viewAllCompanyData` permission via UI switch in Settings > Team. When enabled, users see all company data; when disabled, users only see data they own or are assigned to. Superadmins always have full company visibility regardless of the flag.
- **Policy Data Architecture (Nov 2025):** Implements a hybrid data sharing model to balance client continuity with policy-year specificity:
  - **Shared Across All Client Policies:** Notes, Documents, and Consents use `getCanonicalPolicyIds()` to aggregate data across all policy years for the same client, ensuring continuity of client records and documentation.
  - **Isolated Per Policy Year:** Payment Methods and Reminders are strictly scoped to individual policy IDs, as each policy year maintains independent billing arrangements and renewal schedules.
- **CMS Marketplace Integration (Nov 2025):** Pure pass-through system that returns EXACTLY what the CMS Marketplace API returns without any modifications. Separate payload builders for quotes vs policies. `buildCMSPayloadFromPolicy()` respects the `isApplicant` field for all members (client, spouses, dependents) to ensure accurate APTC/CSR calculations. Spouses and dependents with `isApplicant=true` are marked as `aptc_eligible=true`, while those with `isApplicant=false` get `aptc_eligible=false` and `has_mec=true`. This allows households with multiple applicants (e.g., client + spouse both needing insurance) to receive correct subsidy calculations from the CMS API. `fetchMarketplacePlans()` is a pass-through that calls `fetchSinglePage()` and returns the exact API response without deduplication, APTC recalculation, or data transformation. Frontend displays exact household_aptc, premiums, and totals as provided by CMS. Pagination handled client-side with page/pageSize parameters.
  - **Hybrid Filtering System (Nov 2025):** Implements a dual-layer filtering approach for CMS Marketplace plans. Backend filters (sent to CMS API): metal levels, issuers (carriers), disease management programs. Frontend filters (client-side post-processing): max premium, max deductible, networks (PPO/HMO/POS/EPO), plan features (dental child/adult, HSA eligible, simple choice). This hybrid architecture optimizes performance by reducing network payload with CMS-native filters while providing instant UI response for premium/deductible/feature filters. Filter state included in TanStack Query key for proper cache invalidation. All filters automatically reset pagination to page 1.

### System Design Choices
Uses PostgreSQL with Drizzle ORM, enforcing strict multi-tenancy. Security includes robust password management and 2FA. Dates are handled as `yyyy-MM-dd` strings to prevent timezone issues. A background scheduler (`node-cron`) manages reminder notifications. Centralized phone utilities (`shared/phone.ts`) standardize phone number formatting to 11-digit (with "1" prefix) for consistency with BulkVS API. All message timestamps are normalized using `parseISO()` to explicitly parse as UTC before converting to user's local timezone with `toZonedTime()`.

**Policies Pagination System (Nov 2025):**
The policies system uses cursor-based pagination to efficiently handle large datasets (10,000+ policies) with sub-500ms load times:
- **Database Indexes:** 4 composite B-tree indexes on policies table: (company_id, agent_id), (company_id, effective_date DESC), (company_id, product_type, effective_date DESC), (company_id, status)
- **Backend:** `getPoliciesList()` function uses single-query optimization with agent JOIN (eliminates N+1 queries), cursor format: "effectiveDate,id", max 200 items per page. Supports server-side search filtering by client name, email, and phone before applying limit (Nov 2025 optimization).
- **Frontend:** Sends searchQuery as `searchTerm` query parameter to backend for server-side filtering. TanStack Query key includes searchQuery for proper cache invalidation.
- **Performance:** Initial load fetches 200 policies, server-side search ensures all matching results appear regardless of total count

**Policies Page Performance Optimization (Nov 2025):**
The policies page implements aggressive caching to prevent repeated expensive queries:
- **Stats Queries Caching:** Both `/api/policies/stats` and `/api/policies/oep-stats` queries cache results for 5 minutes (`staleTime: 5 * 60 * 1000`) and disable refetch on window focus
- **Impact:** First load may take ~5-6 seconds for stats calculation, but subsequent navigations to /policies are instant (data served from cache)
- **Known Issue:** Backend stats endpoints load ALL policies into memory for aggregation (inefficient for 10k+ policies). Future optimization: implement SQL-native aggregation queries with proper indexes.
- **User Experience:** After initial page load, navigating away and back to /policies is nearly instantaneous due to caching

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