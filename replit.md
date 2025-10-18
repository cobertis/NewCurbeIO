# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system that integrates iMessage/SMS/RCS via BlueBubbles for enterprise messaging, aiming for a WhatsApp Business-like experience. This admin dashboard empowers superadmins to manage multiple companies (tenants) and their role-assigned users. Its core capabilities include efficient multi-tenant management, Stripe-based billing, custom SMTP email notifications, and a scalable full-stack architecture. The project aims to provide a robust and flexible platform for enterprise-grade messaging and customer relationship management.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, TypeScript, Vite, Shadcn/ui (New York style), Radix UI, and Tailwind CSS, featuring a custom theming system (light/dark modes). It employs a mobile-first responsive design, adapting layouts and element visibility across mobile, tablet, and desktop breakpoints. Navigation is primarily handled by a sidebar, eliminating redundant page titles. The SMS chat application features a dynamic three-column layout that adjusts based on screen size, optimizing conversation and contact information display.

### Technical Implementations
The frontend uses React 18, TypeScript, Vite, Wouter for routing, and TanStack Query for state management. The backend is built with Express.js and TypeScript, providing a RESTful API with session-based authentication and role-based access control (RBAC).

**Key Features:**
-   **User & Company Management:** Comprehensive CRUD operations for users and companies, including role-based access, 2FA, profile management, and email-based activation flows. Superadmins manage companies and assign subscription plans.
-   **Timezone System:** User-selected timezones for date displays, with intelligent fallbacks.
-   **Authentication & Security:** Bcrypt hashing, secure email activation, OTP-based 2FA, session-based authentication, and login/failed attempt notifications for security monitoring.
-   **Multi-tenancy:** Strict data isolation using `companyId` for all non-superadmin access, with superadmins having cross-company oversight.
-   **Email System:** Global SMTP configuration, database-driven templates, and automated sending for system events.
-   **Modular Feature System:** Superadmins can define and assign features to different companies.
-   **Audit Logging:** Centralized service for tracking critical actions.
-   **Campaign System:** Unified interface for managing Email Campaigns, SMS Campaigns, and Contact Lists. Includes detailed reports, contact management with bulk operations, rich HTML editor for emails, targeted sending, and analytics.
-   **SMS Chat Application:** Bidirectional, real-time SMS chat with a three-column layout, WebSocket-based updates, contact integration, conversation management (search, delete, new), unread badge system, and internal notes for conversations. Includes comprehensive backend APIs for chat functionalities.
-   **SMS Subscription Management:** `smsSubscribed` field, automatic unsubscribe via Twilio webhook (STOP keywords), and manual toggle for superadmins.
-   **Billing & Stripe Integration:** 
    -   **Automatic Customer Creation:** Stripe customer created immediately when a company is created, with complete business information (company name in `metadata.business_name` field, representative details, billing address).
    -   **First Login Plan Selection:** Non-superadmin users without subscription are redirected to `/select-plan` page showing all active plans with Stripe prices.
    -   **Real Subscription Creation:** Creates actual Stripe subscriptions using existing customer when plan is selected or assigned by superadmin.
    -   **Webhook Processing:** Handles Stripe events (subscriptions, invoices, payments) for automatic synchronization with fallback methods for invoice association.
    -   **Professional Billing Dashboard:** Comprehensive billing page at `/billing` featuring:
        - Trial countdown with visual progress bar
        - Current plan details with pricing
        - Next billing date and amount
        - Payment history table
        - Invoice list with download links
        - Billing period toggle (monthly/yearly with 20% annual discount)
    -   **Subscription Management:** Full control over subscriptions:
        - Skip trial period (immediate billing)
        - Change plans with automatic proration
        - Cancel subscription (immediate or at period end)
        - Apply coupon/promo codes (with promotion code resolution)
    -   **Customer Portal:** Self-service Stripe portal for payment method management and invoice access.
    -   **Superadmin Multi-Tenancy:** All billing endpoints support superadmin management of any company's subscription via companyId parameters.

### System Design Choices
The system is built on a clear separation of concerns, utilizing PostgreSQL with Drizzle ORM for data management and strict multi-tenancy. Security is enforced through robust password management, account activation, and 2FA. The modular feature system provides high flexibility and extensibility.

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