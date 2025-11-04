# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system with integrated iMessage/SMS/RCS capabilities, designed for enterprise messaging and customer relationship management. The admin dashboard provides superadmins with tools to manage companies (tenants) and their users, featuring role-based access, Stripe billing, custom SMTP notifications, and a scalable full-stack architecture. It includes comprehensive modules for Quotes, Policies, Campaigns, and a real-time SMS Chat application. The system aims to streamline customer relationship management and communication for businesses.

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

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, Vite, Shadcn/ui (New York style), Radix UI, and Tailwind CSS, supporting custom theming (light/dark modes). It features a mobile-first responsive design, with primary navigation via a sidebar and a dynamic three-column layout for the SMS chat application, optimized for mobile interactions.

### Technical Implementations
The frontend uses Wouter for routing and TanStack Query for state management. The backend is built with Express.js and TypeScript, offering a RESTful API with session-based authentication and role-based access control. The system employs a unified marketplace plans component for dynamic routing and API calls across Quotes and Policies.

**Key Features:**
-   **User & Company Management:** Comprehensive CRUD for users and companies, including RBAC, 2FA, and team features.
-   **Authentication & Security:** Bcrypt hashing, email activation, OTP-based 2FA, session management.
-   **Multi-tenancy:** Strict data isolation per company with superadmin oversight.
-   **Email System:** Global SMTP configuration and database-driven templates.
-   **Modular Feature System:** Superadmins can assign features to companies.
-   **Audit Logging:** Centralized service for tracking critical actions.
-   **Campaign System:** Unified interface for managing Email/SMS Campaigns and Contact Lists.
-   **Real-Time Notifications:** WebSocket-based system for instant updates.
-   **SMS Chat Application:** Bidirectional, real-time SMS chat with conversation management.
-   **Billing & Stripe Integration:** Automated customer/subscription management.
-   **Quotes Management System:** A 3-step wizard for 11 product types, featuring Google Places Autocomplete, CMS Marketplace API integration for health insurance plans (including HHS Poverty Guidelines for APTC calculations), plan comparison, and professional credit card validation. Includes internal notes, document management, universal search with optional family member searching, and blocking functionality. Quotes have a comprehensive options menu. Manual plan entry is supported for states without marketplace API connectivity.
-   **Policies Management System:** Converts quotes to policies, migrating all associated data, with identical functionality to the Quotes module. Provides comprehensive policy status management and agent assignment capabilities, including universal search with optional family member searching and blocking functionality. Policy payment methods are shared across policies belonging to the same client (identified by SSN/email). The "Other policies of the applicant" section displays related policies in a full table layout. Manual plan entry is supported. **Statistics and calendar events use canonical client identification (SSN or email) to prevent double-counting renewed policies and duplicate birthday events** - ensuring accurate reporting across policy renewal years.
-   **Consent Document System:** Generates legal consent documents, supports email/SMS/link delivery, and captures electronic signatures with a full digital audit trail.
-   **Calendar System:** Full-screen professional calendar displaying company-wide events including birthdays and reminders, with multi-tenant isolation. **Birthday events are deduplicated across renewed policies using canonical client identification** (SSN+DOB or email+DOB), preventing the same person from appearing multiple times.
-   **Reminder System:** Background scheduler creates notifications for pending reminders, restores snoozed reminders, and prevents duplicate notifications. All notifications are in English.
-   **Agent Assignment System:** Flexible agent reassignment for quotes and policies with agent-based filtering and real-time, English-language notifications to new agents.
-   **Policy Renewal System:** Automated renewal period activation (October 1 - February 1) with dynamic year calculation. Renewal buttons and OEP filters automatically show/hide based on current date. System prevents double-counting of renewed policies in statistics by using canonical client identification (SSN or email) to track unique individuals across policy years.

### System Design Choices
The system uses PostgreSQL with Drizzle ORM, enforcing strict multi-tenancy. Security includes robust password management and 2FA. Dates are handled as `yyyy-MM-dd` strings to prevent timezone issues. A background scheduler (`node-cron`) manages reminder notifications. Quote family members display logic merges normalized and JSONB data.

**CMS Marketplace API Integration:** 
- APTC eligibility logic uses the `isApplicant` field to distinguish between dependents who need insurance (isApplicant=true → aptc_eligible=true, has_mec=false) vs those with Medicaid/CHIP (isApplicant=false → aptc_eligible=false, has_mec=true)
- Request structure follows exact CMS API specifications
- All required fields are sent correctly: dob, aptc_eligible, has_mec, gender, uses_tobacco, is_pregnant, relationship, effective_date, has_married_couple
- Pregnancy status is forwarded accurately for all family members (client, spouses, dependents)
- APTC calculations properly extract household APTC from Silver plans
- Frontend displays premium prices with cents (e.g., $79.50) when not zero, and without cents when zero (e.g., $0)
- Plan year badge is displayed on each plan card showing the coverage year

### Security Architecture
-   **Session Security:** `SESSION_SECRET` environment variable is mandatory to prevent session hijacking.
-   **Webhook Validation:** Twilio webhook signature validation is fully enabled.
-   **Input Validation:** All public-facing endpoints enforce Zod schema validation.
-   **Open Redirect Protection:** Tracking endpoint validates redirect URLs against a strict allowlist.
-   **Unsubscribe Token Enforcement:** Unsubscribe endpoint requires and validates security tokens.
-   **Code Organization:** Shared carrier/product type data is centralized in `shared/carriers.ts`.

## External Dependencies

-   **Database:** Neon PostgreSQL, Drizzle ORM.
-   **Email:** Nodemailer.
-   **SMS:** Twilio.
-   **Payments:** Stripe.
-   **UI Components:** Radix UI, Shadcn/ui, Lucide React, CMDK, Embla Carousel.
-   **Form Management & Validation:** React Hook Form, Zod.
-   **Session Management:** `express-session`, `connect-pg-simple`.
-   **Security:** Bcrypt.
-   **Utilities:** `date-fns`.
-   **Background Jobs:** `node-cron`.