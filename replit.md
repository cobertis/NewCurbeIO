# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system providing customer relationship management, communication tools, and an admin dashboard for superadmins. It integrates iMessage/SMS/RCS, role-based access, Stripe billing, and custom SMTP notifications. Key modules include Quotes, Policies, Campaigns, and a real-time SMS Chat application. The project's vision is to offer a comprehensive CRM that enhances operational efficiency and communication for businesses across various sectors.

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
- `fullScreen={true}` (default) for pages, `fullScreen={false}` for sheets/dialogs
- Apply consistently across ALL pages, sheets, dialogs, and async components
- This ensures a uniform user experience throughout the entire application
**CRITICAL: All sensitive data (SSN, income, immigration documents, payment methods) is stored in PLAIN TEXT without encryption or masking as per explicit user requirement.**

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, Vite, Shadcn/ui (New York style), Radix UI, and Tailwind CSS for custom theming (light/dark modes) and a mobile-first responsive design. Navigation is sidebar-based, with a dynamic three-column layout for the SMS chat application.

### Technical Implementations
The frontend uses Wouter for routing and TanStack Query for state management. The backend is Express.js with TypeScript, providing a RESTful API with session-based authentication and role-based access control.

**Key Features:**
- **User & Company Management:** CRUD, RBAC, 2FA.
- **Authentication & Security:** Bcrypt hashing, email activation, OTP 2FA, session management.
- **Multi-tenancy:** Strict data isolation.
- **Email System:** Global SMTP and database-driven templates.
- **Modular Feature System:** Superadmins assign features to companies.
- **Audit Logging:** Centralized action tracking.
- **Campaign System:** Unified Email/SMS Campaign and Contact List management.
- **Real-Time Notifications:** WebSocket-based updates.
- **BulkVS Chat System:** WhatsApp-style SMS/MMS messaging with dedicated phone numbers, real-time updates, and privacy isolation.
- **iMessage Integration (BlueBubbles) - COMPLETE IMPLEMENTATION:** Full Apple iMessage clone with BlueBubbles bridge integration. **UI Features:** (1) Complete 3-column layout matching Apple iMessage design with conversation list, message view, and contact details panel, (2) Blue bubbles for iMessage, green for SMS/RCS with authentic styling, (3) Message reactions/tapback system (❤️ 👍 👎 😂 !! ?) with right-click menu, (4) Reply-to-message threading with visual thread lines, (5) Message effects including slam, gentle, invisible ink, and loud animations, (6) Real-time typing indicators with animated dots, (7) Read receipts showing sent/delivered/read status, (8) Full multimedia support for photos/videos/files with upload/download endpoints, (9) Message search functionality across all conversations, (10) Group conversation support with multiple participants, (11) Message deletion (delete for me), (12) Notification system with browser notifications and unread badges. **Backend Implementation:** (1) Webhook endpoint `/api/imessage/webhook/:companySlug` with signature validation for incoming messages, (2) Attachment system with `/api/imessage/attachments/upload` (10MB limit) and `/api/imessage/attachments/:id` download endpoints, (3) Background polling service (server/bluebubbles-poller.ts) syncing every 30 seconds as fallback, (4) WebSocket broadcast methods: broadcastImessageNewMessage, broadcastImessageTyping, broadcastImessageReaction, broadcastImessageReadReceipt, (5) Contact synchronization linking iMessage conversations to unified contacts, (6) Complete storage layer with conversation and message management methods. **Configuration:** Superadmin-only panel via Companies → Manage Features → gear icon, webhook URL display with copy button, webhook secret generation and validation, multi-tenant isolation with company-scoped data. **Security:** HMAC webhook validation, attachment MIME type validation, feature gating on all routes, webhook secrets never exposed to non-admin users. Database: `imessage_conversations` and `imessage_messages` tables with full indexing.
- **Billing & Stripe Integration:** Automated customer/subscription management.
- **Quotes Management System:** 3-step wizard, Google Places Autocomplete, CMS Marketplace API integration, plan comparison, and document management.
- **Policies Management System:** Converts quotes to policies, status management, agent assignment, and canonical client identification, using cursor-based pagination. Search by family members feature uses server-side filtering via `searchTerm` and `includeFamilyMembers` parameters sent to backend, which performs LEFT JOIN with policy_members table to search across client AND family member data (names, emails, phones).
- **Policy Folders System:** Organizational folder system for policies with agency-shared and personal folders. Features include: (1) Agency folders visible to all company users with unique names per company, (2) Personal folders private to individual users, (3) Multi-select bulk operations to move policies between folders, (4) Folder management dialogs (create, rename, delete) with RBAC enforcement (admin+ for agency folders, creator-only for personal folders), (5) Sidebar navigation with collapsible folder sections showing real-time policy counts, (6) Filter policies by folder with support for "unassigned" view, (7) Context menus on each folder for quick actions. Backend uses partial unique indexes for folder name enforcement and one-to-one policy-folder assignments via `policy_folder_assignments` table. Activity logging tracks all folder CRUD operations. DELETE operations cascade to folder assignments, moving policies to unassigned state.
- **Consent Document System:** Generates legal consent documents, multi-channel delivery, e-signatures.
- **Calendar System:** Full-screen, multi-tenant display of company-wide events.
- **Reminder System:** Background scheduler for notifications, manual event creation, and appointment availability configuration.
- **Agent Assignment System:** Flexible reassignment for quotes and policies.
- **Policy Renewal System:** Automated renewal period activation with smart CMS Marketplace integration, validating state-based exchanges.
- **Landing Page Builder System:** SmartBio/Lynku.id-style bio link page creator with a 3-column editor, drag & drop, real-time mobile preview, and modern gradient themes.
- **Unified Contacts Directory:** Comprehensive contact management system aggregating contacts from Quotes, Policies, and Manual Contacts with deduplication, filtering, and CSV export.
- **Tasks & Reminders Management System:** Unified task management with assignment, priority levels, status tracking, due dates, and advanced filtering.
- **Birthday Automation System:** Automated birthday greetings via Twilio SMS/MMS, with customizable messages and image library, tracking sending history.
- **Navigation Prefetch System:** Preloads page data before navigation.
- **User-Level Data Visibility System:** Fine-grained data visibility controls allowing selective sharing of data between team members, configurable via UI switch.
- **Policy Data Architecture:** Hybrid data sharing model where Notes, Documents, Consents, and Payment Methods are shared across all client policies, while Reminders are isolated per policy year.
- **CMS Marketplace Integration:** Pure pass-through system returning exact CMS Marketplace API responses. Sends DOB (not calculated age), relationship fields, aptc_eligible, and has_mec flags per CMS spec. Includes a Hybrid Filtering System (backend for metal levels/issuers, frontend for premium/deductible/features) and a Flexible Cost-Share Parsing System for unified cost-share value handling. **CRITICAL MEDICAID LIMITATION:** CMS public API automatically returns `is_medicaid_chip: true` and `APTC: $0` when household income < 138% FPL in Medicaid expansion states (Nebraska, etc.), regardless of aptc_eligible flags. In NON-expansion states (Wyoming, Alabama, Tennessee, Texas, Florida, Mississippi, South Carolina, Kansas), the API correctly returns APTC for households in the "coverage gap" (income below 138% FPL but not eligible for Medicaid). The API does not have a public "Medicaid denied" override flag - broker/private APIs may have additional capabilities.
- **APTC Persistence System:** Intelligent tax credit management that saves and reuses APTC (Advanced Premium Tax Credit) values instead of recalculating. When a plan is selected, the system captures `household_aptc` from the CMS Marketplace API response and stores it with source tracking (aptcAmount, aptcSource, aptcCapturedAt). On subsequent plan searches, the saved APTC is passed as `aptc_override` to the CMS API, improving performance and consistency. Uses explicit null/undefined guards to properly handle $0 APTC values (common for low-income applicants). Skips expensive eligibility calculations when saved APTC is available.
- **Tab Auto-Save System:** Intelligent tab navigation with automatic data persistence. When switching between tabs in Edit Member or Add Member forms, the system validates current tab fields, auto-saves valid data, and shows inline feedback. Prevents data loss and ensures information is always up-to-date. Tabs are disabled during save operations to prevent race conditions. Implementation uses `shouldUnregister: false` in react-hook-form to keep all tab fields in form state, preventing validation failures when switching tabs. Auto-save is triggered both on tab change (with validation of current tab fields) and on sheet close (if form is dirty). Cache invalidation is optimized to target only specific member data, reducing save times from 5-6 seconds to < 500ms. If auto-save fails on sheet close, the sheet remains open to allow retry, preventing data loss.

### System Design Choices
Uses PostgreSQL with Drizzle ORM, enforcing strict multi-tenancy. Security includes robust password management and 2FA. Dates are handled as `yyyy-MM-dd` strings to prevent timezone issues. A background scheduler (`node-cron`) manages reminder notifications. Centralized phone utilities standardize 11-digit phone number formatting. All message timestamps are normalized using `parseISO()` to explicitly parse as UTC before converting to user's local timezone with `toZonedTime()`.
The policies system uses cursor-based pagination with database indexes for efficient handling of large datasets. **Policies are ordered by most recently edited first** using `ORDER BY COALESCE(updatedAt, createdAt) DESC, effectiveDate::date DESC, id DESC`. This ensures agents see their active work at the top. The system implements a **hybrid search approach**: client-side filtering for instant results when searching primary client data, and server-side filtering with 500ms debounce when searching family members. Cursor pagination uses a 3-field composite key (updatedAt, effectiveDate, id) to maintain ordering consistency across pages. Performance is optimized with `policies_updated_at_idx` index and aggressive caching of stats queries.

### Security Architecture
- **Session Security:** `SESSION_SECRET` environment variable mandatory.
- **Webhook Validation:** Twilio, BulkVS, and BlueBubbles webhook signature validation.
- **Input Validation:** Zod schema validation on all public-facing endpoints.
- **Open Redirect Protection:** Tracking endpoint validates redirect URLs against an allowlist.
- **Unsubscribe Token Enforcement:** Unsubscribe endpoint requires and validates security tokens.
- **BulkVS Security:** User-scoped data isolation, `BULKVS_WEBHOOK_SECRET` validation, E.164 phone normalization, 5MB file upload limit.
- **iMessage Security:** Webhook secret isolation (never exposed to non-admin users), admin-only settings access, feature gating on all routes, multi-tenant GUID scoping to prevent cross-company data leakage.

## External Dependencies

- **Database:** PostgreSQL, Drizzle ORM, `postgres`.
- **Email:** Nodemailer.
- **SMS/MMS/iMessage:** Twilio, BulkVS, BlueBubbles (iMessage bridge).
- **Payments:** Stripe.
- **UI Components:** Radix UI, Shadcn/ui, Lucide React, CMDK, Embla Carousel.
- **Drag & Drop:** @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities.
- **Rich Text Editing:** TipTap.
- **Form Management & Validation:** React Hook Form, Zod.
- **Session Management:** `express-session`, `connect-pg-simple`.
- **Security:** Bcrypt.
- **Utilities:** `date-fns`.
- **Background Jobs:** `node-cron`.