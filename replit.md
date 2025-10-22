# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system integrating iMessage/SMS/RCS, designed to provide an enterprise-grade messaging experience. The admin dashboard enables superadmins to manage multiple companies (tenants) and their users with role-based access. Key features include multi-tenant management, Stripe-based billing, custom SMTP email notifications, and a scalable full-stack architecture, positioning it as a robust platform for enterprise messaging and customer relationship management.

## User Preferences
Preferred communication style: Simple, everyday language.
Design style: Extremely professional corporate design - NO bright colors, NO emojis, space-efficient mobile-responsive UI.

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
The frontend utilizes React 18, TypeScript, Vite, Shadcn/ui (New York style), Radix UI, and Tailwind CSS, featuring a custom theming system (light/dark modes). It employs a mobile-first responsive design, adapting layouts and element visibility across devices. Navigation is primarily handled by a sidebar, and the SMS chat application uses a dynamic three-column layout. All mobile interactions are optimized for a smooth user experience.

### Technical Implementations
The frontend uses Wouter for routing and TanStack Query for state management. The backend is built with Express.js and TypeScript, providing a RESTful API with session-based authentication and role-based access control (RBAC).

**Key Features:**
-   **User & Company Management:** Comprehensive CRUD operations for users and companies, including role-based access, 2FA, profile management, email activation, and account status tracking. Features Google Places Business Autocomplete and industry-specific fields. Team management allows company admins to add new members with specific roles (Admin/Member/Viewer).
-   **Authentication & Security:** Bcrypt hashing, email activation, OTP-based 2FA, session-based authentication, password reset with token validation and complexity checks, and active session management.
-   **Multi-tenancy:** Strict data isolation using `companyId` for non-superadmin access, with superadmins having cross-company oversight.
-   **Email System:** Global SMTP configuration, database-driven templates, and automated sending for system events.
-   **Modular Feature System:** Superadmins can define and assign features to companies.
-   **Audit Logging:** Centralized service for tracking critical actions.
-   **Campaign System:** Unified interface for managing Email and SMS Campaigns, and Contact Lists, with reports and analytics.
-   **Real-Time Notifications:** Production-grade WebSocket-based system for instant updates, including sound alerts and superadmin broadcast capabilities.
-   **SMS Chat Application:** Bidirectional, real-time SMS chat with a three-column layout, WebSocket updates, contact integration, conversation management, and internal notes. Includes SMS subscription management.
-   **Billing & Stripe Integration:** Automated customer and subscription creation, webhook processing for Stripe events, and a professional billing dashboard for subscription and payment management. Includes a Superadmin Billing Dashboard for company oversight.
-   **Quotes Management System:** A comprehensive insurance quote management system with a streamlined 3-step wizard interface for creating and managing client quotes across 11 insurance product types. Features visual step indicators, automated effective date defaults, integrated Google Places Address Autocomplete with automatic county detection, and multi-tenant isolation. Uses 8-character short IDs for better usability. Includes a normalized data model with 5 tables (`quote_members`, `quote_member_income`, `quote_member_immigration`, `quote_member_documents`, `quote_payment_methods`). **CRITICAL: ALL sensitive data including SSN, income, immigration documents, and payment methods (credit cards, bank accounts) is stored in PLAIN TEXT without encryption or masking per explicit user requirement.** Secure REST API endpoints for all CRUD operations on quote members, income, immigration, documents, and payment methods, with multi-tenant authorization and file upload validation. Payment methods system supports credit/debit cards (card number, CVV, expiration, billing zip) and bank accounts (account number, routing number, account type) with Zod validation but NO encryption.

### System Design Choices
The system uses PostgreSQL with Drizzle ORM for data management and enforces strict multi-tenancy. Security features include robust password management, account activation, and 2FA. The modular feature system ensures flexibility and extensibility. All dates throughout the system are handled as `yyyy-MM-dd` strings to prevent timezone conversion issues, storing pure dates without time components in the database (PostgreSQL `date` type).

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