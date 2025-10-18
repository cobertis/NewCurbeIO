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
-   **User & Company Management:** Comprehensive CRUD operations, role-based access, 2FA, profile management, and email activation. Includes Google Places Business Autocomplete for company data, and a robust account status system (`pending_activation`, `active`, `deactivated`).
-   **Timezone System:** User-selected timezones for date displays.
-   **Authentication & Security:** Bcrypt hashing, email activation, OTP-based 2FA, session-based authentication, and account status management with clear login feedback.
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
    -   **Professional Billing Dashboard:** Comprehensive `/billing` page with plan details, billing history, invoice downloads, and subscription management (changing/cancelling plans, applying coupons).
    -   **Trial Expiration Management:** Automatic account deactivation and redirection to `/select-plan` upon trial expiration.
    -   **Payment Method Management:** Add, view, set default, and delete multiple payment methods via Stripe Elements.
    -   **Billing Address Management:** Separate billing address storage with automatic Stripe customer updates.
    -   **Payment & Trial Notifications:** Real-time notifications for payment success/failure and trial start, informing relevant admins.
    -   **Customer Portal:** Self-service Stripe portal for payment method management and invoice access.
    -   **Superadmin Billing Dashboard:** Comprehensive billing tab in company details page for superadmin management of any company's billing.
    -   **Superadmin Invoice Management:** System-wide invoice viewing for superadmins, with filtering of $0.00 trial invoices from UI.
    -   **Automated Product/Price Synchronization:** `POST /api/plans/sync-from-stripe` (superadmin-only) to automatically import active Stripe products and prices, ensuring Stripe is the source of truth.

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