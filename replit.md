# Admin Dashboard - Curbe

## Overview

This project is a modern multi-tenant admin dashboard for Curbe, designed to provide a comprehensive management solution for businesses. It supports a superadmin role capable of overseeing multiple companies, with each company having its own users assigned various roles (admin, member, viewer). The application focuses on delivering an efficient, data-rich experience with robust multi-tenant management, advanced data visualization, and a scalable full-stack architecture, drawing inspiration from leading SaaS platforms.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React 18, TypeScript, and Vite. It uses Wouter for routing and Shadcn/ui (New York style) with Radix UI for components, styled using Tailwind CSS. State management is handled by TanStack Query for server state and React hooks for local state. A custom theming system supports light/dark modes with a design aesthetic inspired by Linear and Vercel.

Key UI features:
- **Dashboard:** Displays real-time statistics, various charts (bar, donut), and recent activity.
- **Users:** Comprehensive CRUD operations for user management with role-based access and filtering.
- **Companies (Superadmin-only):** Full CRUD operations for companies, including detailed profiles and visual cards.
- **Plans (Superadmin-only):** Full CRUD operations for subscription plans with pricing and features.
- **Invoices:** View and download invoices with role-based access.
- **Login:** Session-based authentication with role-based access.

### Design System

The application features a clean, professional sidebar and header layout inspired by modern SaaS platforms:
- **Sidebar:** Features the Curbe.io logo, organized navigation with role-based visibility, and consistent spacing
- **Header:** Minimal design with sidebar toggle, notifications, theme switcher, and user avatar
- **Colors:** Uses semantic tokens (background, foreground, primary, muted, accent, border) that adapt to light/dark modes
- **Components:** Leverages Shadcn/ui components (Avatar, Button, Sidebar) for consistency

### Backend

The backend uses Express.js and TypeScript, offering a RESTful API. It implements session-based authentication with `express-session` and enforces role-based access control (RBAC) across all protected endpoints.

API Endpoints:
- `/api/users`: Manages users, scoped by company for admins.
- `/api/companies`: Manages companies (superadmin only).
- `/api/stats`: Provides user statistics based on access level.
- `/api/plans`: Manages subscription plans (superadmin only).
- `/api/invoices`: Lists and downloads invoices (role-based access).
- `/api/subscriptions`: Creates and manages company subscriptions.
- `/api/stripe/webhooks`: Handles Stripe webhook events.

### Security

**Password Security:**
- All passwords are hashed using bcrypt before storage
- Login authentication uses bcrypt.compare() for secure verification
- Passwords are never exposed in API responses or logs
- User update endpoints do not allow password changes (use dedicated password reset flow)
- Migration script safely converts legacy plaintext passwords to hashed versions

**Authentication:**
- Session-based authentication with express-session
- Protected routes verify user authentication and role-based permissions
- Admin users can only manage users within their company
- Superadmin has global access across all companies

### Data Models & Multi-Tenant Schema

The application uses PostgreSQL with Drizzle ORM and features a multi-tenant schema that includes:
- **Companies:** Core multi-tenant organizations.
- **Company Settings:** Per-company configurations.
- **Users:** Multi-tenant users with roles (superadmin, admin, member, viewer) and company association.
- **Plans:** Subscription plans with pricing, features, trial periods, and setup fees.
- **Subscriptions:** Company subscriptions with Stripe integration.
- **Invoices:** Billing invoices with status tracking and downloadable PDFs.
- **Invoice Items:** Line items for invoices (subscription charges, setup fees, usage-based billing).
- **Payments:** Payment records linked to invoices with transaction details.
- **Invitations:** System for inviting users to companies.
- **Activity Logs:** Audit trail.
- **API Keys:** Manages programmatic access per company.
- **Notifications:** User-specific notifications.

Multi-Tenant Role-Based Access Control:
- **Superadmin:** Global system access.
- **Admin:** Manages users within their assigned company.
- **Member:** Standard user access within their company.
- **Viewer:** Read-only access within their company.

### System Design Choices

The application emphasizes clean design, efficient multi-tenant management, and data visualization. It adheres to modern UI/UX principles with a consistent design system, including custom color palettes, spacing, and elevation. Technical decisions prioritize type safety (TypeScript), performance (Vite), and accessibility (Radix UI).

## Email Notification System

The application includes a comprehensive SMTP-based email notification system:

**Features:**
- Global SMTP configuration using custom server credentials
- Pre-built email templates (welcome, password reset, invoice, general notifications)
- Email tracking in database (sent status and timestamp)
- Test email functionality for superadmins
- Automated email sending on specific events

**API Endpoints:**
- `GET /api/email/test`: Verify SMTP connection (superadmin only)
- `POST /api/email/send-test`: Send test email (superadmin only)
- `GET /api/notifications`: Get user notifications
- `POST /api/notifications`: Create notification with optional email
- `PATCH /api/notifications/:id/read`: Mark notification as read
- `POST /api/notifications/mark-all-read`: Mark all user notifications as read

**Configuration:**
SMTP credentials are stored securely as environment variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL, SMTP_FROM_NAME

## External Dependencies

- **Database:** Neon PostgreSQL (via `@neondatabase/serverless`) and Drizzle ORM.
- **Email:** Nodemailer for SMTP email delivery.
- **Payments:** Stripe for subscription billing and invoicing.
- **UI Components:** Radix UI, Shadcn/ui, Lucide React, CMDK, Embla Carousel.
- **Form Management & Validation:** React Hook Form with Zod resolvers.
- **Styling:** Tailwind CSS, PostCSS, Autoprefixer, Class Variance Authority (CVA), `clsx`, `tailwind-merge`.
- **Session Management:** `express-session` with `connect-pg-simple`.
- **Security:** Bcrypt for password hashing.
- **Utilities:** `date-fns`, Zod.
- **Development Tools:** TypeScript, ESBuild, TSX, Drizzle Kit.