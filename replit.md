# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system designed for enterprise messaging, integrating iMessage/SMS/RCS via BlueBubbles to offer a WhatsApp Business-like experience. This admin dashboard enables superadmins to manage multiple companies (tenants) and their users with role-based access. Key features include multi-tenant management, Stripe-based billing, custom SMTP email notifications, and a scalable full-stack architecture, aiming to provide a robust platform for enterprise-grade messaging and customer relationship management.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18, TypeScript, Vite, Shadcn/ui (New York style), Radix UI, and Tailwind CSS, featuring a custom theming system (light/dark modes). It employs a mobile-first responsive design, adapting layouts and element visibility across devices. Navigation is primarily handled by a sidebar, and the SMS chat application uses a dynamic three-column layout.

### Technical Implementations
The frontend uses React 18, TypeScript, Vite, Wouter for routing, and TanStack Query for state management. The backend is built with Express.js and TypeScript, providing a RESTful API with session-based authentication and role-based access control (RBAC).

**Key Features:**
-   **User & Company Management:** Comprehensive CRUD operations, role-based access, 2FA, profile management, and email activation. Includes Google Places Business Autocomplete for company data, and a robust account status system (`pending_activation`, `active`, `deactivated`). User profiles include Insurance Profile Information fields for insurance industry users (agent internal code, instruction level, national producer number, federally facilitated marketplace, and referral tracking). Company profiles include Business Category and Business Niche fields with 30 comprehensive categories and 300+ specific niches organized by industry.
    -   **Settings Page:** Comprehensive multi-tab interface with optimized tab organization (Profile → Company → Team → Security → Preferences → Notifications). Features automatic data freshness with 60s staleTime via React Query and WebSocket integration.
        -   **Profile Tab:** Personal information editing, Insurance Profile fields, Account Information display with Created date and Last Login (relative time), and 2FA status indicators (Email/SMS Active/Inactive).
        -   **Company Tab:** 5 sections (Company Information, Physical Address, Business Profile, Authorized Representative, Branding) with individual Save buttons. Read-only company slug, editable business categorization (30 categories), and extensive niche selection (organized by industry).
        -   **Team Tab:** Advanced user management with real-time search (null-safe), role/status filters, UserDetailsDialog for editing member details. Dialog features editable timezone selector with comprehensive timezone list (50+ zones across all continents), role selector, and simplified Account Information section showing Created, Last Login, Email 2FA status, and SMS 2FA status.
        -   **Last Login Tracking:** Automatic `lastLoginAt` update on successful OTP verification (routes.ts), with full storage support for the field.
    -   **Last Login Implementation:** Field automatically updates at `/api/auth/verify-otp` endpoint after successful OTP verification. Storage method `updateUser` includes mapping for `lastLoginAt` field. Displayed in user details dialog as relative time (e.g., "2 hours ago") or "Never" for users who haven't logged in.
-   **Timezone System:** User-selected timezones for date displays.
-   **Authentication & Security:** Bcrypt hashing, email activation, OTP-based 2FA, session-based authentication, password reset, and account status management with clear login feedback.
    -   **Password Reset System:** Secure password reset flow following activation pattern. Features include:
        -   Email-based reset request from login page "Forgot password?" link
        -   Secure token generation (32-byte random hex) with 1-hour expiration
        -   Email template with reset link sent via SMTP (slug: password-reset)
        -   Token validation before showing reset form
        -   Password complexity validation matching activation requirements
        -   Single-use tokens (marked as used after successful reset)
        -   Security enhancement: After password change, ALL active sessions and trusted devices are automatically cleared, forcing re-authentication with 2FA on all devices
        -   Audit logging for password reset requests and completions, including session/device clearing
        -   Security best practice: Always returns success message to prevent email enumeration
        -   Database table: password_reset_tokens (user_id, token, expires_at, used, used_at)
        -   Routes: POST /api/auth/request-password-reset, GET /api/auth/validate-password-reset-token, POST /api/auth/reset-password
        -   Pages: /forgot-password (request reset), /reset-password (enter new password with token)
    -   **Active Sessions Management:** Comprehensive session visibility in Settings page Security tab. Users can view all active sessions across devices with device information (user agent) and IP address. Features include:
        -   Auto-refreshing session list (every 30 seconds) with compact display
        -   Clear visual distinction between current session and other devices
        -   Last active timestamps shown using relative time (e.g., "2 hours ago")
        -   "Sign Out of All Other Sessions" button to remotely terminate all sessions except current one
        -   Device info and IP captured at OTP verification during login
        -   Direct PostgreSQL session table queries for real-time session data
        -   Session metadata stored in connect-pg-simple session structure
-   **Multi-tenancy:** Strict data isolation using `companyId` for all non-superadmin access, with superadmins having cross-company oversight.
-   **Email System:** Global SMTP configuration, database-driven templates, and automated sending for system events.
-   **Modular Feature System:** Superadmins can define and assign features to companies.
-   **Audit Logging:** Centralized service for tracking critical actions.
-   **Campaign System:** Unified interface for managing Email Campaigns, SMS Campaigns, and Contact Lists, with reports, bulk operations, and analytics.
-   **Real-Time Notifications:** Production-grade WebSocket-based notification system for instant updates, automatic reconnection, sound alerts, and a superadmin broadcast system.
-   **SMS Chat Application:** Bidirectional, real-time SMS chat with a three-column layout, WebSocket updates, contact integration, conversation management, and internal notes.
-   **SMS Subscription Management:** `smsSubscribed` field, automatic unsubscribe via Twilio webhook, and manual toggle.
-   **Billing & Stripe Integration:**
    -   **Automated Customer & Subscription Creation:** Stripe customers created upon company creation, and actual Stripe subscriptions upon plan selection.
    -   **Webhook Processing:** Handles Stripe events (subscriptions, invoices, payments) for synchronization.
    -   **Skip Trial Pre-Authorization:** Single transaction flow - creates PaymentIntent with `capture_method: 'manual'`, captures it for actual charge, then ends trial with `proration_behavior: 'none'` to prevent double billing.
    -   **Subscription Reactivation:** Users can cancel scheduled cancellations via "Keep Subscription" button in billing dashboard, which reactivates the subscription before period end.
    -   **Professional Billing Dashboard:** Comprehensive `/billing` page with tabbed interface separating subscription management from payment/billing information:
        -   **Subscriptions Tab:** Subscription details (plan name, price, status, trial info), quick actions (Change Plan, Skip Trial, Cancel), and billing history with nested tabs for Invoices and Payments tables.
        -   **Transactions Tab:** Complete transaction history displaying all invoices and payments in a clean, organized format with nested tabs for easy navigation between invoice and payment data.
        -   **Payments Tab:** Payment methods management (add, view, remove cards with CardBrandLogo component) and billing address form with Google Places autocomplete.
    -   **Trial Expiration Management:** Automatic account deactivation and redirection to `/select-plan` upon trial expiration.
    -   **Payment Method Management:** Add, view, set default, and delete multiple payment methods via Stripe Elements.
    -   **Billing Address Management:** Separate billing address storage with automatic Stripe customer updates and Google Places autocomplete for easy data entry.
    -   **Payment & Trial Notifications:** Real-time notifications for payment success/failure and trial start, informing relevant admins.
    -   **Automated Payment Emails:** Automatic email confirmations for successful payments and payment failures, with professional templates and actionable next steps.
    -   **Customer Portal:** Self-service Stripe portal for payment method management and invoice access.
    -   **Superadmin Billing Dashboard:** Comprehensive billing tab in company details page for superadmin management of any company's billing.
    -   **Superadmin Invoice Management:** System-wide invoice viewing for superadmins, with filtering of $0.00 trial invoices from UI.
    -   **Automated Product/Price Synchronization:** `POST /api/plans/sync-from-stripe` (superadmin-only) to automatically import active Stripe products and prices, ensuring Stripe is the source of truth.
    -   **Integrated Financial Support System:** Financial support request system fully integrated within Modify Subscription dialog, with view navigation between main options, financial ineligibility notice, support request form, and downgrade/cancel flows. All superadmins receive real-time WebSocket notifications for new financial support tickets.
    -   **Subscription Cancellation with Auto-Deactivation:** Clear cancellation dialog warning users about account access loss after subscription end date. Automatic company and user deactivation via Stripe webhook (`customer.subscription.deleted`) when subscription expires - sets company `isActive: false` and all users `status: 'deactivated'`.

### System Design Choices
The system utilizes PostgreSQL with Drizzle ORM for data management and enforces strict multi-tenancy. Security is paramount, implemented through robust password management, account activation, and 2FA. The modular feature system ensures flexibility and extensibility.

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