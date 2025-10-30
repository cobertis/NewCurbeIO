# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system with integrated iMessage/SMS/RCS capabilities, designed for enterprise messaging and customer relationship management. The admin dashboard provides superadmins with tools to manage companies (tenants) and their users, featuring role-based access, Stripe billing, custom SMTP notifications, and a scalable full-stack architecture.

## User Preferences
Preferred communication style: Simple, everyday language.
Design style: Extremely professional corporate design - NO bright colors, NO emojis, space-efficient mobile-responsive UI.

**Toast Notifications:**
- All toast notifications auto-dismiss after 3 seconds
- Users can still manually dismiss toasts before the timeout

**Loading State Pattern (MANDATORY):**
ALWAYS use centered full-screen loading states for async operations in sheets, dialogs, and major UI components. Pattern:
```tsx
if (isLoading || !data) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max_w-2xl flex items-center justify-center" side="right">
        <div className="flex flex_col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">Loading [description]...</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```
- User strongly prefers this pattern over skeleton loaders or inline spinners
- Shows large, centered spinner (h-12 w-12) with descriptive text
- Components open immediately and show loading state internally
- NO prefetching - let queries load naturally and show full-screen loading
- Apply consistently across all sheets, dialogs, and async components

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, Vite, Shadcn/ui (New York style), Radix UI, and Tailwind CSS, supporting custom theming (light/dark modes). It features a mobile-first responsive design, with primary navigation via a sidebar and a dynamic three-column layout for the SMS chat application. All interactions are optimized for mobile.

### Technical Implementations
The frontend uses Wouter for routing and TanStack Query for state management. The backend is built with Express.js and TypeScript, offering a RESTful API with session-based authentication and role-based access control.

**Unified Marketplace Plans System:**
Single reusable component (`marketplace-plans.tsx`) serves both Quotes and Policies modules with dynamic routing:
- Frontend routes: `/quotes/:id/marketplace-plans` and `/policies/:id/marketplace-plans`
- Backend endpoints: GET `/api/quotes/:id/marketplace-plans`, GET `/api/policies/:id/marketplace-plans`, POST `/api/quotes/:quoteId/select-plan`, POST `/api/policies/:policyId/select-plan`
- Component automatically detects context (quote vs policy) using URL path and adjusts all API calls dynamically with `basePath` variable
- All pricing displays use `formatCurrency()` helper with `Math.round()` for consistency between table and card views
- Never calculates/modifies pricing - uses exact API values with rounding for display only

**Key Features:**
-   **User & Company Management:** Comprehensive CRUD for users and companies, including RBAC, 2FA, profile management, and team features.
-   **Authentication & Security:** Bcrypt hashing, email activation, OTP-based 2FA, session management, and password resets.
-   **Multi-tenancy:** Strict data isolation per company, with superadmin oversight.
-   **Email System:** Global SMTP configuration and database-driven templates for system notifications.
-   **Modular Feature System:** Superadmins can assign features to companies.
-   **Audit Logging:** Centralized service for tracking critical actions.
-   **Campaign System:** Unified interface for managing Email/SMS Campaigns and Contact Lists.
-   **Real-Time Notifications:** WebSocket-based system for instant updates and superadmin broadcasts.
-   **SMS Chat Application:** Bidirectional, real-time SMS chat with conversation management and internal notes.
-   **Billing & Stripe Integration:** Automated customer/subscription management and a professional billing dashboard.
-   **Quotes Management System:** A comprehensive insurance quote management system with a 3-step wizard interface across 11 product types. Features Google Places Autocomplete, multi-tenant isolation, and 8-character short IDs. **CRITICAL: All sensitive data (SSN, income, immigration documents, payment methods) is stored in PLAIN TEXT without encryption or masking as per explicit user requirement.** Includes professional credit card validation (Luhn algorithm, type detection, dynamic formatting, CVV/expiration validation).
    -   **CMS Marketplace API Integration:** Real-time health insurance plan quotation from healthcare.gov, calculating household data and retrieving plans with pricing, deductibles, metal levels, and tax credit eligibility.
    -   **HHS Poverty Guidelines Integration:** Year-aware system using official HHS data for APTC eligibility calculations, displaying guidelines with dynamic percentage breakdowns.
    -   **Plan Comparison Feature:** Side-by-side comparison for up to 5 health insurance plans, showing premiums, deductibles, metal levels, and benefits in a professional table.
    -   **Plan Selection & Display:** Users can select a health insurance plan from the marketplace and save it to the quote. The selected plan is displayed using the identical card design from the marketplace plans page, positioned above the Family Members section. The card includes:
        - **Header Section:** Insurance carrier name, Plan ID, metal level badge, plan type badge, quality rating, and special feature badges (Dental Child/Adult, HSA Eligible, Simple Choice)
        - **Plan Name:** Full plan name displayed prominently
        - **Premium Details:** Shows monthly premium with APTC tax credit (displays "You Pay" price, savings total, and original price with strikethrough)
        - **Cost Sharing Grid:** Three-column layout showing Premium, Deductible, and Out-of-Pocket Maximum with detailed breakdowns
        - **Benefits Grid:** Six key benefits displayed in 2x3 grid: Primary Doctor visits, Specialist Visits, Urgent care, Emergencies, Mental health, Generic drugs
        - **Actions:** "Change Plan" button (navigates to marketplace) and "Remove Plan" button (clears selection)
        - **Data Mapping:** Uses identical logic as marketplace (`getBenefitCost()`, `formatCurrency()`, deductible extraction, MOOP calculation)
        - All plan data stored in `quotes.selectedPlan` JSONB column with complete plan object from CMS Marketplace API
-   **Quote Notes System:** Internal notes system for quotes with professional UI, categorization, pinning, urgent/resolved statuses, search/filtering, user attribution, and image attachments.
-   **Quote Documents System:** Professional document management system for quotes, supporting upload, preview, download, and deletion of various file types with categorization, search, and secure storage.
-   **Policies Management System:** Complete quote-to-policy conversion system that migrates quotes with selected health insurance plans into a separate Policies module. Features:
    -   **Database Structure:** 11 PostgreSQL tables mirroring quote structure (policies, policy_members, policy_member_income, policy_member_immigration, policy_member_documents, policy_documents, policy_payment_methods, policy_reminders, policy_notes, policy_consent_documents, policy_consent_signature_events)
    -   **Quote Conversion:** "Submit Policy" button (green, visible when selectedPlan exists) converts quote to policy and removes from quotes list
    -   **Data Migration:** Sequential copy operation (Neon HTTP driver limitation - no transaction support) copying all quote data, family members, documents, payment methods, reminders, notes, and consent documents to policy tables
    -   **Policy Management:** Identical functionality to Quotes module with same UI components, endpoints (~54 API routes), and features
    -   **Menu Organization:** Policies appears before Quotes in sidebar navigation
    -   **8-Character Short IDs:** Policies use same ID generation system as quotes for easy reference

### System Design Choices
The system uses PostgreSQL with Drizzle ORM, enforcing strict multi-tenancy. Security includes robust password management, account activation, and 2FA. Dates are handled as `yyyy-MM-dd` strings (PostgreSQL `date` type) to prevent timezone issues.

**Quote Family Members Display Logic:**
Displays merged family member data from `quote_members` (normalized) and JSONB columns (`quotes.spouses`, `quotes.dependents`), showing full details for normalized records and basic data for JSONB entries.

**Quote Notes System:**
Features a clean, corporate design with a single-column layout, search toolbar, and categorized notes (General, Important, Follow Up, Decision, Issue). Includes pin, urgent, and resolved statuses, real-time search, CRUD operations, user attribution, and image attachment support (drag-and-drop, paste, validation). Pinned notes are sorted first, then by creation date (newest first).

**Quote Documents System:**
Provides a wide Sheet layout with a professional table for documents, supporting uploads, previews, and deletions. Categories include Passport, Driver's License, State ID, Birth Certificate, Parole, Permanent Residence, Work Permit, I-94, and Other. Features real-time search, filter by category, and robust security measures. Documents can be linked to specific family members via the "Belongs To" field, which displays the member's name and role in the documents table. Clicking the Eye icon opens a preview dialog for viewing documents directly instead of downloading them. The upload form includes an optional dropdown to select which family member the document belongs to, populated from the quote's family members list.

**Quote Reminders System:**
Comprehensive reminder management with scheduled notifications powered by node-cron. When a reminder is snoozed, a background scheduler running every minute automatically creates notifications when the snooze period expires. Features include pending reminders counter badge, compact Actions dropdown menu, and automatic state management from "snoozed" back to "pending" after notification is sent. Background service runs in `server/reminder-scheduler.ts` and starts automatically with the server.

**Consent Document System:**
Legal consent document generation and electronic signature system with full audit trail compliance. Features include:
- Document generation with company logo and data (agent name, NPN, company name)
- Three delivery methods: Email (SMTP), SMS (Twilio), or shareable Link
- Public signature page at `/consent/:token` (no authentication required)
- Comprehensive digital audit trail: IP address, timezone, platform, browser, user agent, geolocation, signature timestamp
- Status tracking: draft → sent → viewed → signed
- Event logging for all consent lifecycle events
- Secure token-based access with 30-day expiration
- Uses existing email (Nodemailer) and SMS (Twilio) services

**Calendar System:**
Full-screen professional calendar displaying company-wide events with visual differentiation:
- **Birthday Events:** Automatically displays all family member birthdays (primary clients, spouses, dependents) from all quotes in the company. Shows annually recurring birthdays with cake icon in blue.
- **Reminder Events:** Displays all active reminders (pending/snoozed) with bell icon. Color-coded by priority: urgent (red), high (orange), medium (yellow), low (gray).
- **Event Details:** Hover tooltips show full information including person name, role, reminder time, and priority level.
- **Navigation:** Month-by-month navigation with "Today" quick jump button.
- **Data Source:** GET `/api/calendar/events` endpoint aggregates birthdays from `quotes.clientDateOfBirth` and `quote_members.dateOfBirth`, plus reminders from `quote_reminders` table.
- **Multi-tenant Isolation:** Events filtered by company, ensuring strict data isolation.

## External Dependencies

-   **Database:** Neon PostgreSQL, Drizzle ORM.
-   **Email:** Nodemailer.
-   **SMS:** Twilio.
-   **Payments:** Stripe.
-   **UI Components:** Radix UI, Shadcn/ui, Lucide React, CMDK, Embla Carousel.
-   **Form Management & Validation:** React Hook Form, Zod.
-   **Session Management:** `express-session`, `connect-pg-simple`.
-   **Security:** Bcrypt.
-   **Utilities:** `date-fns`, `node-cron`.
-   **Background Jobs:** Node-cron for scheduled tasks.