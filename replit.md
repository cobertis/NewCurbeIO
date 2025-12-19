# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system designed to enhance operational efficiency and communication for businesses. It provides comprehensive customer relationship management, communication tools (iMessage/SMS/RCS), and an admin dashboard for managing Quotes, Policies, and Campaigns. The system aims to unify customer interactions, automate marketing, and streamline policy and quote management to improve customer engagement and operational efficiency. It focuses on improving customer engagement and operational efficiency with features like unified contacts, automated marketing, and streamlined policy/quote management.

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
The frontend uses React 18, TypeScript, Vite, Shadcn/ui (New York style), Radix UI, and Tailwind CSS. It supports custom theming (light/dark modes) and a mobile-first responsive design with sidebar navigation.

### System Design Choices
The backend is an Express.js application with TypeScript, providing a RESTful API with session-based authentication and role-based access control. Routing is handled by Wouter, and state management by TanStack Query. The system uses PostgreSQL with Drizzle ORM, enforcing strict multi-tenancy, robust password management, and 2FA. Dates are handled as `yyyy-MM-dd` strings, and all message timestamps are normalized to UTC. A `node-cron` background scheduler manages reminder notifications. Performance is optimized with database indexes and aggressive caching.

**Key Features:**
- **Core Management:** User, Company, Quotes & Policies, Consent Documents, Tasks & Reminders, Plan Features, User Seat Limits.
- **Communication:** Email, SMS/MMS, iMessage, WhatsApp.
- **Billing & Integrations:** Stripe, Telnyx Phone System (full white-label telephony, WebRTC, E911 management, call control application routing).
- **Automation & Analytics:** Birthday Automation, Dashboard Analytics ("Policy Journeys"), Email Processing.
- **Specialized Systems:** Landing Page Builder, Unified Contacts Directory, Tab Auto-Save, Duplicate Message Prevention, Custom Domain (White Label), Wallet System (Apple Wallet + Google Wallet).

**Telnyx WebRTC & Telephony:**
Implements Telnyx WebRTC following official documentation, including specific call options and audio settings. Critical dual SIP domain architecture is used: company subdomain for registration/inbound, and `sip.telnyx.com` for outbound PSTN calls. Call control is webhook-driven, and telephony billing includes immediate purchase and monthly recurring charges for numbers, CNAM, and E911. Extension-to-extension calling uses pure WebRTC, and SIP forking is enabled for simultaneous ringing.

**Wallet System Architecture:**
Supports Apple Wallet (PKPass) and Google Wallet with smart links, analytics, and APNs push notifications for proactive payment collection. Key components include dedicated services for Apple and Google Wallet, PassKit Web Service for device registration and updates, and a scheduler for daily payment reminders. The "Cenicienta Strategy" ensures lock-screen persistence for passes by setting `relevantDate` to the end of the day. Pass images are "baked in" and only text/data can be updated via push notifications.

**Security Architecture:**
Includes session security, webhook signature validation (Twilio, BulkVS, BlueBubbles), Zod schema validation, open redirect protection, unsubscribe token enforcement, user-scoped data isolation, iMessage webhook secret isolation, and multi-tenant WhatsApp session isolation.

## External Dependencies

- **Database:** PostgreSQL, Drizzle ORM, `postgres`.
- **Email:** Nodemailer.
- **SMS/MMS/iMessage:** Twilio, BulkVS, BlueBubbles.
- **Payments:** Stripe.
- **Telephony:** Telnyx (WebRTC SDK, Call Control API).
- **UI Components:** Radix UI, Shadcn/ui, Lucide React, CMDK, Embla Carousel.
- **Drag & Drop:** `@dnd-kit`.
- **Rich Text Editing:** TipTap.
- **Form Management & Validation:** React Hook Form, Zod.
- **Session Management:** `express-session`, `connect-pg-simple`.
- **Security:** Bcrypt.
- **Utilities:** `date-fns`.
- **Background Jobs:** `node-cron`.

## Recent Changes (December 19, 2025)

### MMS Media Persistence
- **Problem:** MMS images were stored in memory and lost on server restart.
- **Solution:** Added `mms_media_cache` database table for persistent storage.
- **Files Modified:**
  - `shared/schema.ts`: Added `mmsMediaCache` table (line ~6281)
  - `server/routes.ts`: Updated `/api/mms-file/:id` endpoint to query database, updated MMS fallback to save to database instead of memory Map

### PDF Attachment Display
- **Enhancement:** Professional card view for PDF attachments in inbox.
- **Features:**
  - Red gradient background with PDF icon
  - "PDF Document" label with description
  - Eye icon button to view in new tab
  - Download icon button to download directly
- **File Modified:** `client/src/pages/inbox.tsx` (media rendering section ~line 726)

### Optimistic UI for Message Sending
- **Enhancement:** Messages and attachments appear instantly in chat, input clears immediately.
- **Behavior:**
  - Message shows with "pending" status immediately
  - User can continue typing while previous message sends in background
  - If send fails, error toast appears and optimistic message is removed
- **File Modified:** `client/src/pages/inbox.tsx` (sendMessageMutation and handleSendMessage ~line 214, 336)

### RCS (Rich Communication Services) Implementation
- **Feature:** Added RCS messaging channel support via Telnyx API.
- **Backend Routes (server/routes.ts):**
  - GET /api/rcs/agents - List RCS agents
  - GET /api/rcs/agents/:agentId - Get single agent details
  - PATCH /api/rcs/agents/:agentId - Update agent settings
  - POST /api/rcs/check-capabilities - Check if phone supports RCS
  - POST /api/rcs/agents/:agentId/test-numbers - Add test number
  - POST /api/rcs/send - Send RCS message
- **Files Modified:**
  - `shared/schema.ts`: Added 'rcs' to telnyxMessageChannelEnum
  - `server/services/telnyx-messaging-service.ts`: Added sendRcsMessage function
  - `client/src/components/compliance-tab.tsx`: Added RCS Agents management card
  - `client/src/pages/inbox.tsx`: Added RCS channel icon (purple) and color support

### TikTok Login Kit OAuth Integration (COMPLETED)
- **Feature:** TikTok OAuth flow for connecting TikTok accounts.
- **Database Schema (`shared/schema.ts`):**
  - Added "tiktok" to `channelTypeEnum` and `oauthProviderEnum`
  - Added TikTok-specific fields to `channelConnections`: tiktokOpenId, tiktokUsername, tiktokDisplayName, tiktokAvatarUrl, tiktokRefreshTokenEnc
- **Backend OAuth Routes (`server/routes.ts`):**
  - POST /api/integrations/tiktok/start - Generates OAuth URL with CSRF nonce
  - GET /api/integrations/tiktok/callback - Handles TikTok callback, validates state, stores tokens
  - GET /api/integrations/tiktok/status - Returns connection status
  - POST /api/integrations/tiktok/disconnect - Marks connection as revoked
- **Frontend UI (`client/src/pages/integrations.tsx`):**
  - TikTokCard component with OAuth flow, status badges, and error handling
- **Redirect URI:** https://8bb41dbe-f08e-48eb-a4e6-b7cff9250c1a-00-2vhiuc4jpu1u6.worf.replit.dev/api/integrations/tiktok/callback

### Social Media API Credentials in System Settings (COMPLETED)
- **Feature:** Configurable Meta and TikTok API credentials via /system-settings > API Credentials tab.
- **Schema (`shared/schema.ts`):**
  - Added "meta" and "tiktok" to `apiProviders` array
- **Backend (`server/routes.ts`):**
  - Added Meta provider config with keys: app_id, app_secret
  - Added TikTok provider config with keys: client_key, client_secret
- **Credential Provider (`server/services/credential-provider.ts`):**
  - Added `getMeta()` returning { appId, appSecret }
  - Added `getTiktok()` returning { clientKey, clientSecret }
  - Both methods use DB credentials with env var fallback
- **OAuth Routes Refactored:**
  - TikTok and Meta/WhatsApp OAuth routes now use credentialProvider for dynamic credential fetching

### WhatsApp Cloud API OAuth Integration (IN PROGRESS)
- **Feature:** Meta Embedded Signup OAuth flow for WhatsApp Business Platform connection.
- **Database Schema (`shared/schema.ts`):**
  - Added `oauthProviderEnum` ("meta_whatsapp", "meta_instagram", "meta_facebook")
  - Added `oauthStates` table for anti-CSRF OAuth flow with 10-min expiry
  - Updated `channelConnections` with WhatsApp-specific fields
- **Token Encryption (`server/crypto.ts`):**
  - `encryptToken(plaintext)` and `decryptToken(encrypted)` using AES-256-GCM
  - Falls back to SECRETS_MASTER_KEY if TOKEN_ENCRYPTION_KEY_BASE64 not set
- **Backend OAuth Routes (`server/routes.ts` ~lines 25985-26450):**
  - POST /api/integrations/meta/whatsapp/start - Generates OAuth URL with CSRF nonce
  - GET /api/integrations/meta/whatsapp/callback - Handles Meta callback, validates state, encrypts token
  - GET /api/integrations/whatsapp/status - Returns connection status (admin-safe, no tokens)
  - POST /api/integrations/whatsapp/connect - Manual connect (admin only)
  - POST /api/integrations/whatsapp/disconnect - Marks connection as revoked
- **Frontend UI (`client/src/pages/integrations.tsx`):**
  - OAuth flow with "Connect WhatsApp" button
  - Collapsible "Need help?" section with requirements
  - Tooltips for Connect button and Status field
  - Error handling with localized Spanish messages for:
    - Connection cancelled, Permission required, Number already connected
    - Number not eligible, Connection failed
  - Disconnect confirmation modal with Spanish copy
  - Coming Soon cards for Instagram/Facebook with Spanish descriptions
- **ENV VARS NEEDED:**
  - META_APP_ID, META_APP_SECRET
  - META_REDIRECT_URI (optional, defaults to BASE_URL + callback path)
  - META_GRAPH_VERSION (optional, defaults to v21.0)
  - META_WEBHOOK_VERIFY_TOKEN (for webhooks - TODO)
- **PENDING:** Webhooks with tenant routing by phone_number_id