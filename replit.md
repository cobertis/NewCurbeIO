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
    -   **Google Places Business Autocomplete:** Smart business search with automatic data population:
        - Real-time business search with 400ms debounce
        - Automatic extraction of business details (name, phone, website, address)
        - **Suite/Apartment Number Support:** Extracts secondary address information (addressLine2) from Google Places API 'subpremise' component type
        - Populates all company fields including street address, suite/apt, city, state, zip, country
        - "My business is not listed" checkbox for manual entry fallback
        - Used in both registration flow and company creation dialog
    -   **Address Display:** Company listings and detail pages display full addresses with proper formatting:
        - Street address on first line
        - Suite/apartment number on second line (if present)
        - City, state, zip on third line
    -   **Company Slugs:** Auto-generated internally (not shown to users)
-   **Timezone System:** User-selected timezones for date displays, with intelligent fallbacks.
-   **Authentication & Security:** Bcrypt hashing, secure email activation, OTP-based 2FA, session-based authentication, login/failed attempt notifications for security monitoring, and enhanced account status management system:
    -   **User Status System:** Three distinct account states for clear lifecycle management:
        - `pending_activation`: New users awaiting email verification (password=null, isActive=false)
        - `active`: Fully activated users with access (password set, isActive=true)
        - `deactivated`: Disabled accounts (password preserved, isActive=false)
    -   **Status Synchronization:** Automatic sync between `status` and `isActive` fields:
        - Admin deactivation (`isActive=false`) automatically sets `status='deactivated'`
        - Admin reactivation (`isActive=true`) automatically sets `status='active'` (if password exists)
        - Legacy fallback: Login validates `isActive` and auto-corrects status if out of sync
    -   **Clear Error Messages:** Login flow provides specific, actionable feedback:
        - Pending activation → "Please activate your account first. Check your email for the activation link."
        - Deactivated account → "Your account has been deactivated. Please contact support for assistance."
        - Invalid credentials → Standard authentication error
-   **Multi-tenancy:** Strict data isolation using `companyId` for all non-superadmin access, with superadmins having cross-company oversight.
-   **Email System:** Global SMTP configuration, database-driven templates, and automated sending for system events.
-   **Modular Feature System:** Superadmins can define and assign features to different companies.
-   **Audit Logging:** Centralized service for tracking critical actions.
-   **Campaign System:** Unified interface for managing Email Campaigns, SMS Campaigns, and Contact Lists. Includes detailed reports, contact management with bulk operations, rich HTML editor for emails, targeted sending, and analytics.
-   **Real-Time Notifications:** Production-grade WebSocket-based notification system providing instant updates without polling:
    -   **100% WebSocket-Based:** All notifications delivered in real-time via WebSocket connection at `/ws/chat` - NO polling to prevent server saturation
    -   **Automatic Reconnection:** Client automatically reconnects with exponential backoff if connection drops (max 30s delay)
    -   **WebSocket Broadcasting:** All notification events broadcast immediately via WebSocket (`notification_update` messages)
    -   **Automatic Notifications:** System generates notifications for 14+ events including:
        - User creation and activation
        - Company creation and deactivation
        - Login attempts (successful, failed, and unactivated account attempts)
        - Payment processing (success and failure)
        - Trial subscription start
        - Campaign sends (success and failure)
        - User subscription to SMS
        - Contact list creation
    -   **Instant Client Updates:** Client-side WebSocket listener invalidates notification cache immediately upon receiving broadcast
    -   **Sound Notifications:** Pleasant double-beep audio alerts for new notifications via Web Audio API
    -   **Broadcast System:** Superadmin can send manual system-wide broadcasts to all users
-   **SMS Chat Application:** Bidirectional, real-time SMS chat with a three-column layout, WebSocket-based updates, contact integration, conversation management (search, delete, new), unread badge system, and internal notes for conversations. Includes comprehensive backend APIs for chat functionalities.
-   **SMS Subscription Management:** `smsSubscribed` field, automatic unsubscribe via Twilio webhook (STOP keywords), and manual toggle for superadmins.
-   **Billing & Stripe Integration:** 
    -   **Automatic Customer Creation:** Stripe customer created immediately when a company is created, with complete business information (company name in `metadata.business_name` field, representative details, billing address).
    -   **First Login Plan Selection:** Non-superadmin users without subscription are redirected to `/select-plan` page showing all active plans with Stripe prices.
    -   **Real Subscription Creation:** Creates actual Stripe subscriptions using existing customer when plan is selected or assigned by superadmin.
    -   **Webhook Processing:** Handles Stripe events (subscriptions, invoices, payments) for automatic synchronization with fallback methods for invoice association.
    -   **Professional Billing Dashboard:** Comprehensive billing page at `/billing` featuring:
        - Current plan details with pricing
        - Next billing date and amount
        - Payment history table
        - Invoice list with download links
        - Billing period toggle (monthly/yearly with 20% annual discount)
    -   **Subscription Management:** Full control over subscriptions:
        - Skip trial period (immediate billing)
        - **Change plans:** When changing plans, the current subscription is canceled and a new subscription is created with the new plan (only one active subscription at a time)
        - **Trial Preservation:** Trial period is preserved when changing plans - trial dates remain from original activation and do not reset
        - **Duplicate Prevention:** Webhook handler `handleSubscriptionCreated` checks for existing subscriptions and updates them instead of creating duplicates
        - **Query Optimization:** `getSubscriptionByCompany` orders by `updated_at DESC` to always return the most recent subscription
        - Cancel subscription (immediate or at period end)
        - Apply coupon/promo codes (with promotion code resolution)
    -   **Trial Expiration Management:** Automatic account deactivation system:
        - Middleware checks trial expiration on every authenticated request
        - When trial period ends (trialEnd < current date):
            - Subscription status automatically updated to 'past_due'
            - Company account is deactivated (isActive = false)
            - HTTP 402 response returned with trialExpired flag
        - Frontend ProtectedRoute component detects trial expiration:
            - Intercepts HTTP 402 responses
            - Automatically redirects users to /select-plan page
            - Also redirects on 'past_due' subscription status
        - Users must select and activate a paid plan to reactivate account
        - Ensures no service access without valid subscription
    -   **Payment Method Management:** Comprehensive multi-card management system:
        - Add multiple payment methods via Stripe Elements
        - View all saved cards with brand logos (Visa, Mastercard, Amex, Discover)
        - Set any card as primary/default payment method
        - Delete non-primary cards with protection against removing default card
        - Modal dialog interface for managing all payment methods
    -   **Billing Address Management:** Separate billing address storage system:
        - Initially displays company data in billing form
        - When user modifies billing information, saves to separate billingAddresses table
        - Automatically updates Stripe customer with new billing information
        - Form has controlled inputs with save/cancel handlers
        - Fallback to company data when no custom address exists
    -   **Payment Notifications:** Real-time payment processing notifications:
        - Automatic notifications when payments are successfully processed
        - Automatic notifications when payments fail
        - Notifies all admins and superadmins of the company
        - Includes formatted payment amounts and invoice numbers
        - Links directly to billing page for action
        - Deduplication logic to prevent duplicate notifications from Stripe events
    -   **Trial Notifications:** Automatic notifications when trial subscriptions start:
        - Notifies all admins and superadmins of the company
        - Displays days remaining in trial period
        - Only triggered for subscriptions in 'trialing' status with valid trial end date
        - Appears in notification panel (not just toast)
    -   **Customer Portal:** Self-service Stripe portal for payment method management and invoice access.
    -   **Superadmin Multi-Tenancy:** All billing endpoints support superadmin management of any company's subscription via companyId parameters.
    -   **Superadmin Billing Dashboard:** Comprehensive billing tab in company details page (`/companies/:id`) featuring:
        - Tab-based interface with "Overview" and "Billing" tabs
        - Complete billing information for any company including subscription details, payment methods, invoices, payments, and billing address
        - Real-time status badges for subscriptions, invoices, and payments
        - Billing period display (monthly/yearly)
        - All billing data restricted to superadmin role via backend authorization
    -   **Superadmin Invoice Management:** System-wide invoice viewing at `/invoices`:
        - Superadmin sees all invoices from all companies in one view
        - Company name column displayed for superadmin to identify invoice origin
        - Regular users see only their company's invoices
        - Efficient frontend mapping using company data for name display
    -   **Invoice Filtering:** Smart filtering of trial invoices from billing history:
        - $0.00 invoices (trial period invoices) are hidden from billing history UI
        - All invoices preserved in database for audit compliance
        - Filtering applied at API layer in `/api/billing/invoices` endpoint
        - Filter logic: `invoices.filter(invoice => invoice.total > 0)`
        - Maintains clean billing history while ensuring complete audit trail

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