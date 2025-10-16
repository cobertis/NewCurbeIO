# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system integrating iMessage/SMS/RCS via BlueBubbles for enterprise messaging, offering a WhatsApp Business-like experience. This admin dashboard enables superadmins to manage multiple companies (tenants) with role-assigned users. Key features include efficient multi-tenant management, Stripe-based billing, custom SMTP email notifications, and a scalable full-stack architecture.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, Vite, Shadcn/ui (New York style), Radix UI, and Tailwind CSS, featuring a custom theming system (light/dark modes). Authentication pages share a cohesive design. Navigation context is provided solely through the sidebar, removing redundant page titles.

### Technical Implementations
**Frontend:** React 18, TypeScript, Vite, Wouter for routing, TanStack Query for state management.
**Backend:** Express.js and TypeScript, providing a RESTful API with session-based authentication and role-based access control (RBAC).

**Feature Specifications:**
- **User Management:** CRUD operations with role-based access, 2FA, and profile picture management. User creation involves an email-based activation flow where users set their own passwords.
- **Company Management (Superadmin-only):** CRUD operations for companies and feature management, including admin user setup with email-based activation.
- **Plans & Features (Superadmin-only):** CRUD interfaces for subscription plans and system features, allowing categorization and assignment to companies.
- **Authentication & Security:** Bcrypt password hashing, secure email-based activation, OTP-based 2FA with trusted device functionality, and session-based authentication.
- **Multi-tenancy:** Strict data isolation using `companyId` for non-superadmin access; superadmins have cross-company access.
- **Email System:** Global SMTP configuration, database-driven templates with variable replacement, and automated sending for events.
- **Modular Feature System:** Superadmins define and assign features to companies.
- **Phone Number Formatting:** Standardized formatting across the system with E.164 conversion.
- **Audit Logging:** Centralized `LoggingService` tracks critical actions with metadata.
- **Company Activation/Deactivation:** Superadmins can activate/deactivate companies, immediately logging out users.
- **Campaign System (Superadmin-only):**
    - **Unified Interface:** Tabs for Reports, Email Campaigns, SMS Campaigns, and Contact Lists.
    - **Reports Dashboard:** Overview of campaigns, recipients, and contacts.
    - **Contact Management:** View, search, and manage subscribed users; create custom contact lists with bulk operations.
    - **Email Campaign Creation:** CRUD for email campaigns with rich HTML editor and live preview. Targeted sending to contact lists or all subscribers with personalized content and secure unsubscribe links. Campaign-specific unsubscribe tracking and email analytics (opens, clicks).
- **SMS Campaign System (Superadmin-only):**
    - **Integrated Interface:** Dedicated SMS Campaigns tab.
    - **Backend & Database:** API endpoints for CRUD operations and Twilio integration.
    - **Message Management:** Create SMS campaigns with message validation, draft/sending/sent status tracking.
    - **Targeted Delivery:** Send to contacts with phone numbers or specific lists, filtering for valid numbers.
    - **Twilio Integration:** Real-time SMS delivery with message SID tracking and delivery status updates.
    - **Campaign Statistics:** Detailed metrics for sent campaigns with real-time updates and message details.
    - **Twilio Webhooks:** Status callback webhook for delivery updates and incoming message webhook for SMS replies, with automatic URL configuration.
- **SMS Chat Application (`/incoming-sms`):**
    - **Full Chat Interface:** Bidirectional SMS chat with two-column layout (conversations list, chat area).
    - **Message Display:** Chronological messages with timestamps, auto-scroll, real-time updates for conversations and messages.
    - **Management:** Send SMS, mark as read, search conversations.
    - **Backend Integration:** APIs for retrieving conversations, message history, sending SMS, and marking as read.
    - **Database:** `outgoing_sms_messages` table for manual replies; conversations built from incoming and outgoing messages.

### System Design Choices
The system maintains a clear separation of concerns. Data models use PostgreSQL with Drizzle ORM for multi-tenancy and strict data isolation. Security measures include password management, account activation, and 2FA. The modular feature system offers flexibility.

## External Dependencies

-   **Database:** Neon PostgreSQL and Drizzle ORM.
-   **Email:** Nodemailer.
-   **SMS:** Twilio.
-   **Payments:** Stripe.
-   **UI Components:** Radix UI, Shadcn/ui, Lucide React, CMDK, Embla Carousel.
-   **Form Management & Validation:** React Hook Form with Zod.
-   **Session Management:** `express-session` with `connect-pg-simple`.
-   **Security:** Bcrypt.
-   **Utilities:** `date-fns`, Zod.