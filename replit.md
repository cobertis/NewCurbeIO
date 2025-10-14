# Admin Dashboard - Curbe

## Overview

Curbe is a multi-tenant CRM system for enterprise messaging, integrating iMessage/SMS/RCS through BlueBubbles to offer a WhatsApp Business-like interface. This admin dashboard provides comprehensive management capabilities, supporting a superadmin role for overseeing multiple companies (tenants), each with role-assigned users (admin, member, viewer). The platform focuses on efficient, data-rich multi-tenant management, Stripe-based billing, custom SMTP email notifications, and a scalable full-stack architecture.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

Built with React 18, TypeScript, and Vite, the frontend uses Wouter for routing, Shadcn/ui (New York style) with Radix UI for components, and Tailwind CSS for styling. State management is handled by TanStack Query for server state. It features a custom theming system supporting light/dark modes, inspired by Linear and Vercel.

**Key UI Features:**
-   **Dashboard:** Real-time statistics, charts, and recent activity.
-   **Users:** CRUD operations with role-based access. Includes firstName, lastName fields. Superadmins can view and assign company associations. User table displays full names (when available) and company column (superadmin-only).
-   **Companies (Superadmin-only):** CRUD operations and visual cards.
-   **Plans (Superadmin-only):** CRUD operations for subscription plans.
-   **Invoices:** View and download invoices with role-based access.
-   **Settings:** Comprehensive settings with tabs for Profile, Preferences, Company Settings, System (SMTP, email templates), and Security.
-   **Login:** Session-based authentication with role-based access.
-   **Audit Logs:** Timeline view of system actions with role-based filtering.
-   **Email Templates:** Management interface with HTML editor and live preview (superadmin-only).

**Design System:**
Features a clean sidebar and header, with a Curbe.io logo, role-based navigation, and semantic color tokens adapting to light/dark modes. Leverages Shadcn/ui components for consistency.

### Backend

The backend uses Express.js and TypeScript, providing a RESTful API. It implements session-based authentication with `express-session` and enforces role-based access control (RBAC).

**Key API Endpoints:**
-   `/api/users`: User management (company-scoped for admins).
-   `/api/companies`: Company management (superadmin only).
-   `/api/stats` & `/api/dashboard-stats`: User and dashboard statistics (access level-based).
-   `/api/plans`: Subscription plan management (superadmin only).
-   `/api/invoices` & `/api/payments`: Invoice and payment management (role-based, company-filtered).
-   `/api/subscriptions`: Company subscription management.
-   `/api/stripe/webhooks`: Stripe webhook handling.
-   `/api/settings/profile`, `/api/settings/company`, `/api/settings/preferences`: Settings management.
-   `/api/email-templates`: CRUD for email templates (superadmin only).
-   `/api/email/test` & `/api/email/send-test`: SMTP test functionality (superadmin only).
-   `/api/audit-logs`: Access audit logs with role-based filtering.

### Security

-   **Password Security:** Bcrypt hashing for all passwords.
-   **Authentication:** Session-based with `express-session` and RBAC for protected routes.

### Data Models & Multi-Tenant Schema

Uses PostgreSQL with Drizzle ORM. Core multi-tenant entities include Companies, Company Settings, Users (with roles: superadmin, admin, member, viewer), Plans, Subscriptions, Invoices, Payments, Invitations, Activity Logs, API Keys, Notifications, and Email Templates.

**Multi-Tenancy Implementation:**
Strict data isolation is enforced by associating every non-superadmin user with a `companyId`. All data endpoints automatically filter results by the authenticated user's company, ensuring users only access their organization's data. Superadmins can access data across all companies, potentially using a `companyId` query parameter.

### Email Notification System

Features global SMTP configuration, pre-built email templates, email tracking, test email functionality, and automated sending on events. SMTP credentials are securely stored as environment variables.

### Audit Logging System

Tracks critical actions with a centralized `LoggingService`. Automatically captures metadata (IP, user agent, timestamps, request context) and provides role-based access control for viewing logs. Key logged actions include authentication, user management, company management, and email template changes.

## External Dependencies

-   **Database:** Neon PostgreSQL (`@neondatabase/serverless`) and Drizzle ORM.
-   **Email:** Nodemailer for SMTP delivery.
-   **Payments:** Stripe for subscription billing and invoicing.
-   **UI Components:** Radix UI, Shadcn/ui, Lucide React, CMDK, Embla Carousel.
-   **Form Management & Validation:** React Hook Form with Zod resolvers.
-   **Styling:** Tailwind CSS, PostCSS, Autoprefixer, Class Variance Authority (CVA), `clsx`, `tailwind-merge`.
-   **Session Management:** `express-session` with `connect-pg-simple`.
-   **Security:** Bcrypt for password hashing.
-   **Utilities:** `date-fns`, Zod.
-   **Development Tools:** TypeScript, ESBuild, TSX, Drizzle Kit.