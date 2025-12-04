# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system designed to enhance operational efficiency and communication for businesses. It offers comprehensive customer relationship management, communication tools (iMessage/SMS/RCS/WhatsApp), and an admin dashboard for managing Quotes, Policies, and Campaigns. The system aims to provide a unified platform for managing customer interactions, automating marketing campaigns, and streamlining policy and quote management to increase operational efficiency and improve customer engagement.

## User Preferences
Preferred communication style: Simple, everyday language.
Design style: Extremely professional corporate design - NO bright colors, NO emojis, space-efficient mobile-responsive UI.
**Toast Notifications:**
- All toast notifications auto-dismiss after 3 seconds
- Users can still manually dismiss toasts before the timeout
**Loading State Pattern (MANDATORY):**
ALWAYS use the standardized `LoadingSpinner` component for all loading states across the application.
- User strongly prefers consistent loading indicators across all pages
- Shows large, centered spinner (h-12 w-12) with descriptive text
- `fullScreen={true}` (default) for full page loading states
- `fullScreen={false}` REQUIRED for: buttons, dialogs, sheets, inline components - prevents full-screen overlay
- CRITICAL: All button loading states MUST use `fullScreen={false}` to avoid UI-blocking overlays
- Apply consistently across ALL pages, sheets, dialogs, and async components
- This ensures a uniform user experience throughout the entire application
**CRITICAL: All sensitive data (SSN, income, immigration documents, payment methods) is stored in PLAIN TEXT without encryption or masking as per explicit user requirement.**

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, TypeScript, Vite, Shadcn/ui (New York style), Radix UI, and Tailwind CSS. It supports custom theming (light/dark modes) and a mobile-first responsive design with sidebar-based navigation.

### Technical Implementations
The frontend uses Wouter for routing and TanStack Query for state management. The backend is an Express.js application with TypeScript, providing a RESTful API with session-based authentication and role-based access control.

**Key Features:**
- **User & Company Management:** CRUD, RBAC, 2FA, multi-tenancy.
- **Communication Systems:** Email, SMS/MMS (BulkVS), iMessage (BlueBubbles), and comprehensive WhatsApp Web integration (whatsapp-web.js) with session management, message operations, chat/contact/group management, call features, and real-time notifications.
- **Billing & Stripe Integration:** Automated customer and subscription management.
- **Quotes Management System:** 3-step wizard with Google Places Autocomplete, CMS Marketplace API integration, plan comparison, and document management.
- **Policies Management System:** Converts quotes to policies, manages statuses, assigns agents, supports cursor-based pagination, and hybrid search.
- **Consent Document System:** Generates legal consent documents, supports multi-channel delivery, and e-signatures.
- **Calendar & Reminder Systems:** Full-screen, multi-tenant display of company-wide events.
- **Landing Page Builder System:** Bio link page creator with drag & drop and real-time mobile preview.
- **Unified Contacts Directory:** Aggregated contact management with deduplication, filtering, and bulk operations.
- **Tasks & Reminders Management System:** Unified task management with assignment, priority, and status tracking.
- **Birthday Automation System:** Automated birthday greetings via Twilio SMS/MMS.
- **Dashboard Analytics System:** SugarCRM-style "Policy Journeys" design with agent avatars, workflow board, recent policies, and policy status donut charts. Features all-time analytics with unique people counting and company-scoped caching.
- **Policy Data Architecture:** Hybrid data sharing for Notes, Documents, Consents, Payment Methods (shared) and Reminders (per policy year).
- **Tab Auto-Save System:** Intelligent tab navigation with automatic data persistence.
- **Duplicate Message Prevention System:** Robust transactional claim system for campaign messages.

### System Design Choices
The system uses PostgreSQL with Drizzle ORM, enforcing strict multi-tenancy. Security includes robust password management and 2FA. Dates are handled as `yyyy-MM-dd` strings to prevent timezone issues. A `node-cron` background scheduler manages reminder notifications. Phone numbers are standardized using centralized phone utilities. All message timestamps are normalized to UTC. Policies are ordered by most recently edited first with cursor-based pagination. Performance is optimized with database indexes and aggressive caching.

### Security Architecture
- **Session Security:** Relies on `SESSION_SECRET`.
- **Webhook Validation:** Twilio, BulkVS, and BlueBubbles webhook signature validation.
- **Input Validation:** Zod schema validation on all public-facing endpoints.
- **Open Redirect Protection:** Tracking endpoint validates redirect URLs against an allowlist.
- **Unsubscribe Token Enforcement:** Unsubscribe endpoint requires and validates security tokens.
- **BulkVS Security:** User-scoped data isolation, `BULKVS_WEBHOOK_SECRET` validation, E.164 phone normalization, 5MB file upload limit.
- **WhatsApp Security:** Full multi-tenant session isolation with company-scoped auth directories, separate client instances per company, all API endpoints company-scoped via authenticated user's companyId. Critical: Global mutex serializes client initialization to prevent whatsapp-web.js LocalAuth bootstrap race conditions that cause "Target closed" errors.
- **iMessage Security:** Webhook secret isolation, admin-only settings, feature gating, multi-tenant GUID scoping, and early-return guards for self-sent webhook duplicates.

## Production Deployment Notes

### WhatsApp Multi-Tenant Browser Requirements (CRITICAL)
**Problem Solved (Dec 2024):** Ubuntu's Chromium snap package creates a global `SingletonLock` at `/root/snap/chromium/common/chromium/` that prevents multiple browser instances from running simultaneously, regardless of `--user-data-dir` settings. This blocked concurrent WhatsApp sessions for different companies.

**Solution:** Replace Chromium snap with Google Chrome official .deb package.

**Production Server Setup Commands:**
```bash
# 1. Stop application and kill browser processes
pm2 stop curbe-admin
pkill -9 -f chromium || true

# 2. Remove Chromium snap
snap remove chromium

# 3. Install Google Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
dpkg -i google-chrome-stable_current_amd64.deb
apt-get install -f -y

# 4. Verify installation
google-chrome-stable --version

# 5. Clean up snap artifacts
rm -rf /root/snap/chromium

# 6. Restart application
pm2 restart curbe-admin
```

**Browser Detection Priority:** The `getChromiumPath()` function prioritizes Google Chrome over Chromium snap:
1. `/usr/bin/google-chrome-stable` (PREFERRED)
2. `/usr/bin/google-chrome`
3. `/opt/google/chrome/google-chrome`
4. `/usr/bin/chromium-browser` (apt-based)
5. `/snap/bin/chromium` (LAST RESORT - has SingletonLock issues)

**Session Isolation Architecture:**
- Each company has isolated directories: `.wwebjs_auth/{companyId}/` and `.chromium-profiles/{companyId}/`
- `LocalAuth` strategy with `clientId` parameter for session persistence
- `--user-data-dir` Chromium flag for browser profile isolation
- Global mutex prevents initialization race conditions

**Known Limitations:**
- `LocalAuth` is NOT compatible with Puppeteer's `userDataDir` config option (use `--user-data-dir` flag instead)
- Chromium snap CANNOT run multiple instances (use Google Chrome or apt-based Chromium)

## External Dependencies

- **Database:** PostgreSQL, Drizzle ORM, `postgres`.
- **Email:** Nodemailer.
- **SMS/MMS/iMessage/WhatsApp:** Twilio, BulkVS, BlueBubbles, whatsapp-web.js.
- **Payments:** Stripe.
- **UI Components:** Radix UI, Shadcn/ui, Lucide React, CMDK, Embla Carousel.
- **Drag & Drop:** @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities.
- **Rich Text Editing:** TipTap.
- **Form Management & Validation:** React Hook Form, Zod.
- **Session Management:** `express-session`, `connect-pg-simple`.
- **Security:** Bcrypt.
- **Utilities:** `date-fns`.
- **Background Jobs:** `node-cron`.