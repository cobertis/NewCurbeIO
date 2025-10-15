# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system designed for enterprise messaging, integrating iMessage/SMS/RCS via BlueBubbles to offer a WhatsApp Business-like experience. This admin dashboard provides comprehensive management for a superadmin overseeing multiple companies (tenants), each with role-assigned users (admin, member, viewer). The platform emphasizes efficient, data-rich multi-tenant management, Stripe-based billing, custom SMTP email notifications, and a scalable full-stack architecture.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend, built with React 18, TypeScript, and Vite, uses Shadcn/ui (New York style) with Radix UI for components and Tailwind CSS for styling. It features a custom theming system (light/dark modes) inspired by Linear and Vercel. Authentication pages share a cohesive design with gradient backgrounds, centered rounded cards, and consistent spacing. Key UI features include a dashboard, CRUD operations for users, companies (superadmin-only), plans (superadmin-only), and features (superadmin-only). It also supports invoice viewing, comprehensive settings, a secure login with 2FA, account activation, audit logs, and email template management.

### Technical Implementations
**Frontend:** React 18, TypeScript, Vite, Wouter for routing, TanStack Query for state management.
**Backend:** Express.js and TypeScript, providing a RESTful API with session-based authentication (`express-session`) and role-based access control (RBAC).

**Feature Specifications:**
- **User Management:** CRUD operations for users with role-based access and phone number support for 2FA. Superadmins can manage company associations. Users can edit their profile picture by clicking on their avatar in the profile page, allowing them to paste an image URL or remove their current avatar.
- **Company Management (Superadmin-only):** CRUD operations, visual cards, and feature management. Company creation includes admin user setup with email-based activation.
- **Plans & Features (Superadmin-only):** CRUD interfaces for subscription plans and system features, allowing categorization and selective assignment to companies.
- **Authentication & Security:**
    - Password hashing (Bcrypt) with strong requirements and real-time strength indicators.
    - Secure email-based account activation with one-time use tokens.
    - OTP-based Two-Factor Authentication (2FA) with user-selected delivery method (email/SMS), resend cooldown, and trusted device functionality to bypass OTP.
    - Session-based authentication with `express-session` and `connect-pg-simple`.
- **Multi-tenancy:** Strict data isolation using `companyId` for all non-superadmin data access. Superadmins can access data across companies.
- **Email System:** Global SMTP configuration, database-driven templates with variable replacement, test email functionality, and automated sending for events like OTP and activation.
- **Modular Feature System:** Allows superadmins to define system-wide features and selectively assign them to companies, enabling tailored functionalities per organization.
- **Phone Number Formatting:** Standardized formatting (`+1 (415) 555-2671`) across the system, with functions for input, display, and E.164 conversion for backend/Twilio.
- **Audit Logging:** Centralized `LoggingService` tracks critical actions with metadata, supporting role-based access for viewing logs.
- **Company Activation/Deactivation:** Superadmins can activate/deactivate companies, immediately logging out all users of that company on their next API request, enforced by `requireActiveCompany` middleware.
- **Email Campaign System (Superadmin-only):**
    - **Contact Management:** View and manage all subscribed users, toggle subscription status per user.
    - **Campaign Creation:** CRUD operations for email campaigns with rich HTML editor featuring formatting toolbar (bold, italic, headings, lists, links) and live preview.
    - **Mass Email Delivery:** Send campaigns to all subscribed users with personalized content and secure tokenized unsubscribe links.
    - **Secure Unsubscribe:** HMAC-SHA256 tokens using SESSION_SECRET with timing-safe verification, format validation, and graceful error handling.
    - **Backward Compatibility:** Legacy unsubscribe (email-only) supported for existing flows; tokens validated only when present.
    - **Public Unsubscribe Page:** No authentication required, accepts email and optional token, shows security warning for non-tokenized requests.

### System Design Choices
The system employs a clear separation of concerns between frontend and backend. Data models are designed for multi-tenancy in PostgreSQL using Drizzle ORM, ensuring strict data isolation. Security is paramount, with comprehensive measures for password management, account activation, and 2FA. The modular feature system provides flexibility for customizing tenant functionalities.

## External Dependencies

-   **Database:** Neon PostgreSQL (`@neondatabase/serverless`) and Drizzle ORM.
-   **Email:** Nodemailer for SMTP delivery.
-   **SMS:** Twilio for SMS delivery.
-   **Payments:** Stripe for subscription billing and invoicing.
-   **UI Components:** Radix UI, Shadcn/ui, Lucide React, CMDK, Embla Carousel.
-   **Form Management & Validation:** React Hook Form with Zod resolvers.
-   **Styling:** Tailwind CSS, PostCSS, Autoprefixer, Class Variance Authority (CVA), `clsx`, `tailwind-merge`.
-   **Session Management:** `express-session` with `connect-pg-simple`.
-   **Security:** Bcrypt for password hashing.
-   **Utilities:** `date-fns`, Zod.