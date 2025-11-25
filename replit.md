# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system designed to enhance operational efficiency and communication for businesses. It offers comprehensive customer relationship management, communication tools (iMessage/SMS/RCS), and an admin dashboard for managing Quotes, Policies, and Campaigns. The system aims to provide a unified platform for managing customer interactions, automating marketing campaigns, and streamlining policy and quote management to increase operational efficiency and improve customer engagement.

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
- **User & Company Management:** CRUD operations, RBAC, 2FA, multi-tenancy.
- **Communication Systems:**
    - **Email System:** Global SMTP and database-driven templates.
    - **Campaign System:** Unified Email/SMS campaign and contact list management.
    - **BulkVS Chat System:** WhatsApp-style SMS/MMS messaging with real-time updates.
    - **WhatsApp Web Integration:** Comprehensive WhatsApp Web feature parity using whatsapp-web.js v1.34.2 with 100+ service functions and 80+ REST endpoints:
        - **Session Management:** QR code authentication, persistent multi-tenant sessions (isolated per company in .wwebjs_auth/{companyId}/), automatic reconnection with exponential backoff (2s, 4s, 8s, 16s, max 30s), real-time connection status.
        - **Client State & Presence:** getState, getWWebVersion, sendPresenceAvailable/Unavailable, getBlockedContacts, profile picture management (set/delete), setDisplayName, setStatus, addressbook operations (save/edit/delete contacts).
        - **Message Operations:** Send/receive text/media, reply, forward, delete (for everyone/for me), star/unstar, emoji reactions, download media, message info with read receipts, quoted messages display, edit messages, pin/unpin messages, reload messages, get reactions/mentions/poll votes, getMessageChat, getMessageContact, getMessageOrder, getMessagePayment.
        - **Chat Management:** Archive/unarchive, pin/unpin, mute/unmute (8hrs, 1 week, always), search messages, mark as unread, clear messages, delete chat, clearState, syncHistory, getPinnedMessages, changeChatLabels.
        - **Typing Indicators:** Real-time "typing..." and "recording audio..." indicators sent and received with clearState for immediate stop.
        - **Contact Operations:** Verify registered numbers, getNumberId, isRegisteredUser, block/unblock, getAbout, getCommonGroups, getCountryCode, getFormattedNumber, getContactDeviceCount, getContactChat, getContactLidAndPhone, filtered to show ONLY valid phone numbers.
        - **Label Operations (WhatsApp Business):** getLabels, getLabelById, getChatLabels, getChatsByLabelId, addOrRemoveLabels, changeChatLabels.
        - **Group Management:** createGroup, add/remove participants, promote/demote admins, edit group name/description, leave group, membership requests (get/approve/reject), admin-only settings (add members, edit info, messages-admins-only), group pictures (set/delete), invite info, acceptInvite, acceptGroupV4Invite.
        - **Channel Operations (22 functions):** Create/delete channels, subscribe/unsubscribe, fetch/send messages, settings (subject, description, picture, reactions), mute/unmute, get subscribers, admin management (invite/accept/revoke/demote/transfer ownership), search channels.
        - **Broadcast Operations:** Get all broadcasts, get broadcast chat/contact.
        - **Call Operations:** Reject incoming calls, createCallLink (voice/video).
        - **Auto-Download Settings:** Configure auto-download for audio/documents/photos/videos, background sync.
        - **Business Features:** getCustomerNote, addOrEditCustomerNote (chat/user level), sendResponseToScheduledEvent, editScheduledEvent, acceptMessageGroupV4Invite.
        - **Special Content:** Send location (with coordinates modal), send contact cards, emoji reactions (❤️ 😂 😮 😢 🙏 👍 🎉 🔥), create polls (with multi-option modal).
        - **UI Components:** Context menu on messages (reply/forward/react/star/delete/download/copy/info), chat header dropdown (pin/archive/mute/search/clear/delete/group info), GroupInfoSheet with participant management, location/poll modals, emoji picker, authentic WhatsApp Web styling.
        - **Status Indicators:** ✓ sent, ✓✓ delivered, ✓✓ blue read, star indicator (⭐), forwarded indicator, timestamps.
        - **Multi-Tenancy:** Each company maintains its own independent WhatsApp session with separate client instances, auth directories, and automatic recovery on disconnect/auth_failure.
    - **iMessage Integration (BlueBubbles):** Full Apple iMessage clone functionality with authentic bubble styling, reactions, reply-to threading, message effects, typing indicators, read receipts, multimedia support, message search, group conversations, message deletion, and native voice memo system.
    - **WebPhone WebRTC System:** Professional SIP-based calling with SIP.js, per-user configuration, call management (mute, hold, blind/attended transfer, recording, DND, call waiting), iPhone-style glassmorphism UI, responsive design, caller ID lookup, missed call notifications, call history, DTMF support, and automatic reconnection with exponential backoff (immediate first attempt, then 2s, 4s, 8s, 16s, max 30s).
- **Billing & Stripe Integration:** Automated customer and subscription management.
- **Quotes Management System:** 3-step wizard with Google Places Autocomplete, CMS Marketplace API integration, plan comparison, and document management.
- **Policies Management System:** Converts quotes to policies, manages statuses, assigns agents, identifies canonical clients, supports cursor-based pagination, and hybrid search. Includes a folder system with RBAC.
- **Consent Document System:** Generates legal consent documents, supports multi-channel delivery, and e-signatures.
- **Calendar & Reminder Systems:** Full-screen, multi-tenant display of company-wide events with background scheduler and manual event creation.
- **Landing Page Builder System:** SmartBio/Lynku.id-style bio link page creator with a 3-column editor, drag & drop, and real-time mobile preview.
- **Unified Contacts Directory:** Comprehensive contact management with automatic aggregation from all system sources (quotes, policies, leads, SMS, iMessage), non-destructive merge logic, filtering, CSV export, and bulk operations.
- **Tasks & Reminders Management System:** Unified task management with assignment, priority, status tracking, due dates, and advanced filtering.
- **Birthday Automation System:** Automated birthday greetings via Twilio SMS/MMS, aggregating birthdays from multiple sources.
- **Dashboard Analytics System:** All-time analytics counting unique people (not policy instances) with SSN > email > name+DOB deduplication. Multi-dimensional aggregation ensures people with policies in multiple states/statuses/carriers appear in all relevant dimensions. Company-scoped caching with 60-second TTL reduces response times from 3-7 seconds to sub-1-second on cache hits (75-80% improvement). Cache automatically invalidates on policy create/update/delete.
- **Policy Data Architecture:** Hybrid data sharing for Notes, Documents, Consents, Payment Methods (shared) and Reminders (per policy year).
- **CMS Marketplace Integration:** Pure pass-through system with Hybrid Filtering and Flexible Cost-Share Parsing.
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
- **WhatsApp Security:** Full multi-tenant session isolation with company-scoped auth directories (.wwebjs_auth/{companyId}/), separate client instances per company, all API endpoints company-scoped via authenticated user's companyId.
- **iMessage Security:** Webhook secret isolation, admin-only settings, feature gating, multi-tenant GUID scoping, and early-return guards for self-sent webhook duplicates.

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