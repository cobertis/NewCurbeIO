# Admin Dashboard - Curbe

## Overview

**Curbe** is a multi-tenant CRM system for enterprise messaging that integrates iMessage/SMS/RCS through BlueBubbles, offering a WhatsApp Business-like interface for managing customer communications.

This admin dashboard provides comprehensive management capabilities for the platform. It supports a superadmin role capable of overseeing multiple companies (tenants), with each company having its own users assigned various roles (admin, member, viewer). The application focuses on delivering an efficient, data-rich experience with robust multi-tenant management, billing/invoicing through Stripe, email notifications via custom SMTP, and a scalable full-stack architecture.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**October 14, 2025 - Email Templates Management System**
- Implemented comprehensive email templates management system
- Added emailTemplates table with schema: name, slug, subject, htmlContent, textContent, variables, isActive
- Created 4 base templates: Welcome Email, Password Reset, Invoice Notification, Custom Notifications
- Built complete CRUD backend endpoints (superadmin-only access)
- Developed Email Templates Manager UI with HTML editor and live preview
- Added Email Templates tab in Settings (superadmin-only visibility)
- Full support for template variables and active/inactive status

**October 14, 2025 - Login UI Redesign**
- Completely redesigned login page to match user's custom design
- Clean gradient background (sky-100 to indigo-100)
- Curbe.io logo in top-left corner
- Centered white card with modern styling
- Login icon at the top
- Professional copy: "Sign in with email" and tagline about platform power
- Input fields with icons (email, password with visibility toggle)
- "Forgot password?" link aligned right
- Gray Sign In button with proper hover states
- "Don't have an account? Register here" call-to-action

**October 14, 2025 - Settings Profile Form Fix**
- Fixed profile editing issue where changes weren't reflected after save
- Converted form inputs from uncontrolled (defaultValue) to controlled (value with state)
- Added useState for profileForm state management
- Added useEffect to sync form state when user data changes
- Form now properly updates after successful save

**October 14, 2025 - Standardized Page Layouts**
- Updated all pages to use consistent layout format: `flex flex-col gap-6 p-6`
- Removed all max-width restrictions and side margins (`max-w-[1600px] mx-auto`)
- All pages now match the invoices page format for full-width content
- Updated pages: dashboard, users, companies, settings, analytics, support
- Plans and invoices pages already had the correct format

## System Architecture

### Frontend

The frontend is built with React 18, TypeScript, and Vite. It uses Wouter for routing and Shadcn/ui (New York style) with Radix UI for components, styled using Tailwind CSS. State management is handled by TanStack Query for server state and React hooks for local state. A custom theming system supports light/dark modes with a design aesthetic inspired by Linear and Vercel.

Key UI features:
- **Dashboard:** Displays real-time statistics, various charts (bar, donut), and recent activity.
- **Users:** Comprehensive CRUD operations for user management with role-based access and filtering.
- **Companies (Superadmin-only):** Full CRUD operations for companies, including detailed profiles and visual cards.
- **Plans (Superadmin-only):** Full CRUD operations for subscription plans with pricing and features.
- **Invoices:** View and download invoices with role-based access.
- **Settings:** Comprehensive settings management with tabs for:
  - Profile: Update personal information (name, email, role display)
  - Preferences: Email notification preferences and alert settings
  - Company Settings: Branding configuration (admin/superadmin only)
  - System: SMTP/Email configuration, testing, and full email templates management with HTML editor and live preview (superadmin only)
  - Security: Password management and session control
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
- `/api/dashboard-stats`: Comprehensive dashboard statistics including user counts, billing info, revenue, and growth rate (filtered by company).
- `/api/plans`: Manages subscription plans (superadmin only).
- `/api/invoices`: Lists and downloads invoices (role-based access, filtered by company).
- `/api/payments`: Lists payments (filtered by company).
- `/api/subscriptions`: Creates and manages company subscriptions.
- `/api/stripe/webhooks`: Handles Stripe webhook events.
- `/api/settings/profile`: Update own profile information (any authenticated user).
- `/api/settings/company`: Get and update company settings (admin/superadmin).
- `/api/settings/preferences`: Manage user notification preferences.
- `/api/email-templates`: Full CRUD operations for email templates (superadmin only).

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
- **Email Templates:** Reusable email templates with HTML/text content, variables, and active status.

Multi-Tenant Role-Based Access Control:
- **Superadmin:** Global system access across all companies.
- **Admin:** Manages users within their assigned company.
- **Member:** Standard user access within their company.
- **Viewer:** Read-only access within their company.

**Multi-Tenancy Implementation:**

The application implements strict data isolation between companies:

1. **User Association:** Every user (except superadmin) is associated with a company via `companyId` field
2. **Automatic Filtering:** All data endpoints automatically filter results by the authenticated user's company
3. **Endpoint Behavior:**
   - **Superadmin:** Can access data across all companies (may require `companyId` query parameter)
   - **Admin/Member/Viewer:** Automatically restricted to their own company's data
4. **Filtered Endpoints:**
   - `/api/stats` - User statistics scoped to company
   - `/api/dashboard-stats` - Dashboard metrics (users, revenue, growth) scoped to company
   - `/api/users` - User list filtered by company for admins
   - `/api/invoices` - Invoices filtered by company
   - `/api/payments` - Payments filtered by company
   - `/api/subscription` - Subscription for specific company
   - `/api/notifications` - Notifications for specific user

This ensures complete data isolation: users can only see and manage data belonging to their organization.

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