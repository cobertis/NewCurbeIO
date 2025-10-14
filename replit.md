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
-   **Users:** CRUD operations with role-based access. Includes firstName, lastName, phone fields. Phone number required for SMS-based 2FA. Superadmins can view and assign company associations. User table displays full names (when available) and company column (superadmin-only).
-   **Companies (Superadmin-only):** CRUD operations, visual cards, and feature management. Each company card includes a button to manage assigned features through a modal dialog with checkboxes.
-   **Plans (Superadmin-only):** CRUD operations for subscription plans.
-   **Features (Superadmin-only):** Complete CRUD interface for system features with categorization, status management, and activation controls. Features can be created with unique keys and assigned to specific companies.
-   **Invoices:** View and download invoices with role-based access.
-   **Settings:** Comprehensive settings with tabs for Profile (includes phone number management), Preferences, Company Settings, System (SMTP, email templates), and Security.
-   **Login:** Two-factor authentication with user-selected delivery method (email or SMS) before code is sent.
-   **OTP Verification:** Two-step verification flow: (1) User selects delivery method (email/SMS), (2) Enters 6-digit code with device trust option and countdown timers.
-   **Audit Logs:** Timeline view of system actions with role-based filtering, including 2FA events.
-   **Email Templates:** Management interface with HTML editor and live preview (superadmin-only).

**Design System:**
Features a clean sidebar and header, with a Curbe.io logo, role-based navigation, and semantic color tokens adapting to light/dark modes. Leverages Shadcn/ui components for consistency.

### Backend

The backend uses Express.js and TypeScript, providing a RESTful API. It implements session-based authentication with `express-session` and enforces role-based access control (RBAC).

**Key API Endpoints:**
-   `/api/login`: Validates credentials and initiates 2FA flow (sets pendingUserId).
-   `/api/auth/send-otp`: Sends OTP code via email or SMS (requires pendingUserId).
-   `/api/auth/verify-otp`: Verifies OTP and grants full session (sets userId).
-   `/api/auth/resend-otp`: Resends OTP with 1-minute cooldown.
-   `/api/users`: User management with phone number support (company-scoped for admins).
-   `/api/companies`: Company management (superadmin only).
-   `/api/stats` & `/api/dashboard-stats`: User and dashboard statistics (access level-based).
-   `/api/plans`: Subscription plan management (superadmin only).
-   `/api/features`: System feature management (superadmin only).
-   `/api/companies/:companyId/features`: Get, assign, and remove features from companies.
-   `/api/invoices` & `/api/payments`: Invoice and payment management (role-based, company-filtered).
-   `/api/subscriptions`: Company subscription management.
-   `/api/stripe/webhooks`: Stripe webhook handling.
-   `/api/settings/profile`, `/api/settings/company`, `/api/settings/preferences`: Settings management with phone number updates.
-   `/api/email-templates`: CRUD for email templates (superadmin only).
-   `/api/email/test` & `/api/email/send-test`: SMTP test functionality (superadmin only).
-   `/api/audit-logs`: Access audit logs with role-based filtering.

### Security

-   **Password Security:** Bcrypt hashing for all passwords.
-   **Two-Factor Authentication (2FA):** OTP-based verification with user-selected delivery method.
    -   6-digit codes with 5-minute expiration
    -   User selects method (email or SMS) **before** code is sent - email always available, SMS requires phone number
    -   1-minute resend cooldown with countdown timer
    -   Optional device trust for 30 days (extends session duration to 30 days vs default 7 days)
    -   Two-stage session: `pendingUserId` → credential validation → `userId` after OTP verification
    -   All protected routes verify `userId` exists (not just session presence)
-   **Authentication:** Session-based with `express-session` and RBAC for protected routes.

### Data Models & Multi-Tenant Schema

Uses PostgreSQL with Drizzle ORM. Core multi-tenant entities include Companies, Company Settings, Users (with roles: superadmin, admin, member, viewer, phone number for 2FA), OTP Codes, Plans, Subscriptions, Invoices, Payments, Invitations, Activity Logs, API Keys, Notifications, Email Templates, Features, and Company Features (junction table).

**Multi-Tenancy Implementation:**
Strict data isolation is enforced by associating every non-superadmin user with a `companyId`. All data endpoints automatically filter results by the authenticated user's company, ensuring users only access their organization's data. Superadmins can access data across all companies, potentially using a `companyId` query parameter.

### Email Notification System

Features global SMTP configuration, pre-built email templates, email tracking, test email functionality, and automated sending on events. SMTP credentials are securely stored as environment variables.

### Modular Feature System

A flexible feature management system allows superadmins to define system-wide capabilities and selectively assign them to companies based on their specific needs. This enables different organizations to have different functionalities enabled (e.g., health insurance companies can have "consents" feature while churches don't).

**Feature Management:**
-   **Feature Definition:** Superadmins can create features with unique keys, names, descriptions, categories (general, communication, compliance, analytics, integration), optional icons, and active/inactive status.
-   **Company Assignment:** Features are assigned to companies through a many-to-many relationship using a junction table (`company_features`). Only active features can be assigned.
-   **Feature Check:** Backend provides `hasFeature(companyId, featureKey)` method to verify if a company has access to a specific feature.
-   **UI Management:** Companies page includes a "Manage Features" button for each company that opens a modal dialog with checkboxes for easy feature assignment/removal.

**Database Schema:**
-   `features` table: Stores system features with id, name, key (unique identifier), description, category, icon, isActive status, and timestamps.
-   `company_features` table: Junction table linking companies to features, tracking which user enabled each feature and when.

### Audit Logging System

Tracks critical actions with a centralized `LoggingService`. Automatically captures metadata (IP, user agent, timestamps, request context) and provides role-based access control for viewing logs. Key logged actions include authentication, user management, company management, and email template changes.

## External Dependencies

-   **Database:** Neon PostgreSQL (`@neondatabase/serverless`) and Drizzle ORM.
-   **Email:** Nodemailer for SMTP delivery (OTP codes, transactional emails).
-   **SMS:** Twilio for SMS delivery (OTP codes via SMS).
-   **Payments:** Stripe for subscription billing and invoicing.
-   **UI Components:** Radix UI, Shadcn/ui, Lucide React, CMDK, Embla Carousel.
-   **Form Management & Validation:** React Hook Form with Zod resolvers.
-   **Styling:** Tailwind CSS, PostCSS, Autoprefixer, Class Variance Authority (CVA), `clsx`, `tailwind-merge`.
-   **Session Management:** `express-session` with `connect-pg-simple`.
-   **Security:** Bcrypt for password hashing.
-   **Utilities:** `date-fns`, Zod.
-   **Development Tools:** TypeScript, ESBuild, TSX, Drizzle Kit.