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
    - **Full Chat Interface:** Bidirectional SMS chat with three-column layout (conversations list | chat area | contact info panel).
    - **Real-Time Updates:** WebSocket-based notifications (path: `/ws/chat`) eliminate inefficient polling, updating UI only when messages arrive or are sent.
    - **Contact Integration:** Displays contact name and profile picture from users table when phone number matches a registered contact; shows initials as fallback for contacts, phone digits for non-contacts.
    - **Message Display:** Chronological messages with timestamps, auto-scroll, instant updates via WebSocket events.
    - **Conversation Management:** Send SMS, mark as read, search conversations, delete conversations (with confirmation), create new conversations with any phone number.
    - **Contact Information Panel:** Right sidebar displaying contact details (name, email, phone, company), company users list (first 5), and internal notes section.
    - **Internal Notes System:** Complete CRUD for conversation-specific notes visible only to internal users; stored in `sms_chat_notes` table with `companyId`, `phoneNumber`, `note`, `createdBy`, and timestamps; superadmin-only access.
    - **Multi-Tenancy:** All tables (`incoming_sms_messages`, `outgoing_sms_messages`, `sms_chat_notes`) include `companyId` for strict data isolation; all queries filter by company to prevent cross-tenant data access.
    - **Backend Integration:** APIs for retrieving conversations with contact enrichment (name, email, avatar), message history, sending SMS, marking as read, conversation deletion, and notes CRUD; superadmins can optionally filter by `companyId` query parameter.
    - **Database:** `outgoing_sms_messages` table for manual replies; `sms_chat_notes` table for internal notes; conversations built from incoming and outgoing messages; all tables enforce company-level isolation.
    - **WebSocket Service:** Broadcasts `conversation_update` events when Twilio receives messages or when SMS is sent, triggering frontend cache invalidation.
    - **SMS Notifications:** Incoming SMS messages automatically create in-app notifications for all superadmins, displayed in the header notification bell with sender name (or phone number), message preview, and direct link to SMS chat.
- **SMS Subscription Management:**
    - **User Field:** `smsSubscribed` boolean field (default true) tracks SMS subscription status independently from email subscriptions.
    - **Automatic Unsubscribe:** Twilio webhook processes STOP keywords (STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT) from incoming messages and automatically unsubscribes users.
    - **Contact List View:** "SMS Unsubscribed" view in Contact Lists displays users who opted out of SMS communications.
    - **Manual Toggle:** Superadmin endpoint (PATCH `/api/users/:userId/sms-subscription`) allows manual subscription management with Zod validation.

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