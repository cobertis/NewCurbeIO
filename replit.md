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
-   **Quotes Management System:** 3-step wizard for 11 product types, featuring Google Places Autocomplete, CMS Marketplace API integration for health insurance plans (including HHS Poverty Guidelines for APTC calculations), plan comparison, and professional credit card validation.
    -   **Quote Notes & Documents:** Internal notes system with categories, search, and image attachments. Document management for uploads, previews, and secure storage, linked to family members.
    -   **Quote Search:** Universal search functionality with OPTIONAL family member searching. By default searches only primary client; when checkbox is activated, includes spouses and dependents by name, email, and phone.
    -   **Quote Blocking:** Admins and superadmins can block/unblock quotes. Blocked quotes display yellow warning banner, lock icon on status badge, and prevent updates by agents. Audit trail tracks who blocked and when.
    -   **Quote Options Menu:** Complete functionality including Block/Unblock, New Reminder, Print Quote, Duplicate, Cancel Quote, Archive/Unarchive with confirmation dialogs.
-   **Policies Management System:** Converts quotes to policies, migrating all associated data. Provides **IDENTICAL functionality** to the Quotes module with comprehensive policy status management and agent assignment capabilities.
    -   **Policy Search:** Universal search functionality with OPTIONAL family member searching. By default searches only primary client; when checkbox is activated, includes spouses and dependents by name, email, and phone.
    -   **Policy Blocking:** Admins and superadmins can block/unblock policies. Blocked policies display yellow warning banner, lock icon on status badge, and prevent updates by agents. Audit trail tracks who blocked and when.
    -   **Policy Display:** Table shows carrier name + insurance type (e.g., "Ambetter - Health Insurance ACA"). Lock icon appears in status column when policy is blocked.
    -   **Policy Options Menu:** Complete functionality including Block/Unblock, New Reminder, Print Policy, Duplicate, Cancel Policy, Archive/Unarchive with confirmation dialogs.
-   **Consent Document System:** Generates legal consent documents, supports email/SMS/link delivery, and captures electronic signatures with a full digital audit trail.
-   **Calendar System:** Full-screen professional calendar displaying company-wide events including birthdays and reminders, with multi-tenant isolation.
-   **Reminder System:** Background scheduler (node-cron) runs every minute to:
    -   Create notifications for pending reminders due today (appears in notification bell)
    -   Restore snoozed reminders when snooze time expires
    -   Prevent duplicate notifications with date-based checking
    -   **ALL reminder notifications are in ENGLISH**
-   **Agent Assignment System:** Flexible agent reassignment for quotes and policies with agent-based filtering for admin users. When an agent is reassigned, the new agent automatically receives a notification: "New Quote/Policy Assigned - {AssignerName} assigned you the quote/policy for {ClientName}" with a clickable link. Delivered in real-time via WebSocket. **ALL notifications are in ENGLISH.**

### System Design Choices
The system uses PostgreSQL with Drizzle ORM, enforcing strict multi-tenancy. Security includes robust password management and 2FA. Dates are handled as `yyyy-MM-dd` strings to prevent timezone issues. A background scheduler (`node-cron`) manages reminder notifications. Quote family members display logic merges normalized and JSONB data.

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