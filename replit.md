# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system designed for enterprise messaging, integrating iMessage/SMS/RCS via BlueBubbles to offer a WhatsApp Business-like experience. This admin dashboard provides comprehensive management for a superadmin overseeing multiple companies (tenants), each with role-assigned users (admin, member, viewer). The platform emphasizes efficient, data-rich multi-tenant management, Stripe-based billing, custom SMTP email notifications, and a scalable full-stack architecture.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend, built with React 18, TypeScript, and Vite, uses Shadcn/ui (New York style) with Radix UI for components and Tailwind CSS for styling. It features a custom theming system (light/dark modes) inspired by Linear and Vercel. Authentication pages share a cohesive design with gradient backgrounds, centered rounded cards, and consistent spacing. Key UI features include a dashboard, CRUD operations for users, companies (superadmin-only), plans (superadmin-only), and features (superadmin-only). It also supports invoice viewing, comprehensive settings, a secure login with 2FA, account activation, audit logs, and email template management.

**Page Headers:** All page title/description headers have been removed from the UI. Navigation context is provided solely through the sidebar, eliminating redundant page titles for a cleaner interface.

### Technical Implementations
**Frontend:** React 18, TypeScript, Vite, Wouter for routing, TanStack Query for state management.
**Backend:** Express.js and TypeScript, providing a RESTful API with session-based authentication (`express-session`) and role-based access control (RBAC).

**Feature Specifications:**
- **User Management:** CRUD operations for users with role-based access and phone number support for 2FA. Superadmins can manage company associations. Users can edit their profile picture by clicking on their avatar in the profile page, allowing them to paste an image URL or remove their current avatar. All contact/user displays consistently use the `avatar` field from the users table with Avatar/AvatarImage/AvatarFallback components showing profile pictures when available or initials as fallback.
  - **User Creation & Activation:** Users are created WITHOUT passwords. System automatically sends activation email with secure one-time token (32-byte hex, 7-day expiration). Users set their own password during activation. Shared helper function `sendActivationEmail()` handles token generation, storage, and email delivery for both user and company creation. Function never throws exceptions - returns boolean to allow user/company creation to succeed even if email fails. Frontend omits password field from user creation form.
- **Company Management (Superadmin-only):** CRUD operations, visual cards, and feature management. Company creation includes admin user setup with email-based activation using the same shared activation flow as regular user creation.
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
    - **Unified Interface with Tabs:** Campaigns, Contacts, and Lists integrated in a single page using Shadcn Tabs component for seamless navigation.
    - **Contact Management:** View and manage all subscribed users in a table format with search functionality, toggle subscription status per user with instant feedback.
    - **Advanced Contact List Management:**
        - **Smart Views:** "All Contacts" shows entire contact database, "Unsubscribed" filters non-subscribed users
        - **Custom Lists:** Create and manage segmented contact lists with name and description
        - **Three-column Layout:** Action buttons header, left sidebar (25%) for views/lists, main area (75%) for contact table
        - **Bulk Operations:** Select multiple contacts and move them between lists using "Move to List" button and list selector dialog
        - **Contact Actions:** Add individual contacts via dialog form, download all contacts as CSV, upload contacts via CSV (planned)
        - **Rich Contact Table:** Displays name, email, phone, company, subscription status with action buttons per row (message, edit, more options)
        - **Database Schema:** contact_lists and contact_list_members tables with proper foreign keys
    - **Campaign Creation:** CRUD operations for email campaigns with rich HTML editor featuring formatting toolbar (bold, italic, headings, lists, links) and live preview.
    - **Targeted Campaign Sending:** 
        - Optional "Target Audience" dropdown in campaign creation
        - Select specific contact lists or send to all subscribers
        - EmailCampaignService filters recipients to only subscribed users in selected list
        - Displays member count for each list in selection dropdown
        - Send confirmation dialog shows accurate recipient count with visual breakdown
    - **Campaign Deletion:** Secure deletion with confirmation dialog (AlertDialog) showing campaign subject, preventing accidental deletions (draft campaigns only).
    - **Mass Email Delivery:** Send campaigns to all subscribed users or targeted list members with personalized content and secure tokenized unsubscribe links.
    - **Secure Unsubscribe:** HMAC-SHA256 tokens using SESSION_SECRET with timing-safe verification, format validation, and graceful error handling.
    - **Backward Compatibility:** Legacy unsubscribe (email-only) supported for existing flows; tokens validated only when present.
    - **Public Unsubscribe Page:** No authentication required, accepts email and optional token, shows security warning for non-tokenized requests.
    - **Campaign-Specific Unsubscribe Tracking:**
        - **Database Table:** `campaign_unsubscribes` tracks which users unsubscribed from which campaigns with unique constraint on (campaignId, userId)
        - **Unsubscribe Links:** Include campaignId parameter to attribute unsubscribes to specific campaigns
        - **Idempotent Operations:** Multiple clicks on same unsubscribe link handled gracefully, no duplicate records created
        - **Statistics Display:** Campaign stats show "Unsubscribed from this campaign" count (not total system unsubscribes)
        - **Error Handling:** Graceful handling of unique constraint violations returns existing record
    - **Email Analytics:** Unique open tracking (1 per user), link click tracking, campaign-specific unsubscribe tracking, comprehensive statistics dashboard with charts and detailed metrics.
- **SMS Campaign System (Superadmin-only):**
    - **Tabbed Interface:** Dedicated SMS Campaigns tab integrated with Email Campaigns and Contact Lists for unified campaign management
    - **Backend Infrastructure:** Complete API endpoints for SMS campaign CRUD operations (`/api/sms-campaigns`) with Twilio integration for SMS delivery
    - **Database Schema:** `sms_campaigns` and `campaign_sms_messages` tables for campaign management and individual message tracking
    - **Message Management:** Create SMS campaigns with message validation (max 1600 characters for long SMS support), draft/sent status tracking
    - **Targeted Delivery:** Send to all contacts with phone numbers or specific contact lists, automatic filtering for recipients with valid phone numbers
    - **Twilio Integration:** Real-time SMS delivery via Twilio API with message SID tracking, delivery status updates, and error handling
    - **Delivery Tracking:** Individual SMS message status (sent/delivered/failed), Twilio Message SID for each SMS, error codes and messages for failed deliveries
    - **Campaign Statistics:** Track delivered count, failed count, recipient count per campaign with detailed per-message delivery status
    - **Background Processing:** Asynchronous SMS sending with status updates, non-blocking campaign sends that return immediately
    - **User Notifications:** Superadmins receive notifications when users activate accounts, providing real-time awareness of system activity
    - **Frontend UI:** Dedicated SMS tab with campaign overview, creation button, and coming soon placeholder for full SMS campaign management interface

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