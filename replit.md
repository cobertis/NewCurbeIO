# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system designed to enhance operational efficiency and communication for businesses. It provides comprehensive customer relationship management, communication tools (iMessage/SMS/RCS), and an admin dashboard for managing Quotes, Policies, and Campaigns. The system aims to unify customer interactions, automate marketing, and streamline policy and quote management to improve customer engagement and operational efficiency.

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
- **Automation & Analytics:** Birthday Automation, Dashboard Analytics ("Policy Journeys"), Email Processing (IMAP bounce, exponential backoff).
- **Specialized Systems:** Landing Page Builder, Unified Contacts Directory, Tab Auto-Save, Duplicate Message Prevention, Custom Domain (White Label), Wallet System (Apple Wallet + Google Wallet).

**Telnyx WebRTC Configuration:**
All WebRTC implementations follow official Telnyx documentation, including programmatic audio element creation, `prefetchIceCandidates: true`, string ID for remote elements, specific call options (`audio: true`, `useStereo: true`, `preferred_codecs`), detailed audio settings, `userMediaError` handling, and `encrypted_media: null` (SRTP disabled) for compatibility. Key optimizations include pre-warming ICE candidates on login, early initialization, and using `iceCandidatePoolSize: 8`. RTCP-MUX is enabled on credential connections for WebRTC browser compatibility.

**Telnyx Call Control Architecture:**
Phone numbers are routed via a Call Control Application using the `connection_id` parameter (not `call_control_application_id`) for proper hangup using the Telnyx REST API. This involves webhook-driven call flow (`call.initiated` -> answer PSTN -> dial SIP -> `call.answered` -> bridge legs), and a specific hangup API call with `NORMAL_CLEARING (16)`. E911 must be disabled using a dedicated action endpoint before reassigning numbers.

**Telephony Billing Architecture:**
Includes immediate purchase billing for phone numbers and monthly recurring billing on the 1st of each month via `node-cron` for active numbers, CNAM, and E911 fees. Call billing is in 60-second increments.

**Security Architecture:**
Session security (`SESSION_SECRET`), webhook signature validation (Twilio, BulkVS, BlueBubbles), Zod schema validation for all public endpoints, open redirect protection via allowlist, unsubscribe token enforcement, user-scoped data isolation (BulkVS), iMessage webhook secret isolation, and multi-tenant session isolation for WhatsApp integration with real-time webhooks and secure media storage.

**Extension-to-Extension Calling:**
Enables internal calls between PBX extensions using pure WebRTC peer-to-peer over WebSocket signaling, integrated into PBX settings.

**SIP Forking Configuration:**
Implemented via `simultaneous_ringing: "enabled"` in Telnyx credential connection configuration to enable simultaneous ringing on all registered SIP devices. Uses a Dial+Bridge pattern (not transfer) for incoming calls.

**Wallet System Architecture:**
Supports both Apple Wallet (PKPass) and Google Wallet with Smart Links, analytics dashboard, APNs push notifications, and security features:

- **Database Tables:** `wallet_members`, `wallet_passes`, `wallet_links`, `wallet_events`, `wallet_devices`, `wallet_settings`
- **Services:** 
  - `wallet-pass-service.ts` - Core CRUD, analytics, member/pass management
  - `apple-wallet-service.ts` - PKPass generation using `passkit-generator`
  - `google-wallet-service.ts` - Generic Pass API integration
  - `apns-service.ts` - HTTP/2 APNs push notifications for dynamic pass updates
- **Routes:** 
  - Wallet API: `/api/wallet/*` (members, passes, analytics, settings)
  - PassKit Web Service: `/api/passkit/v1/*` (device registration, pass updates)
  - Smart Links: `/w/:slug` (OS detection for iOS/Android)
- **Frontend:** `/wallet-analytics` page with member management, pass generation, bulk alerts, and real-time analytics

**Apple Wallet Pass Structure (storeCard type):**
```
Pass Layout (Insurance Mode):
┌─────────────────────────────────┐
│ [LOGO]           STATUS: ACTIVE │  ← headerFields (notification trigger)
├─────────────────────────────────┤
│      [STRIP IMAGE]              │  ← strip.png (1280x168 @2x)
│         MEMBER                  │
│     JAVIER LAZO                 │  ← primaryFields (large name)
├─────────────────────────────────┤
│ INSURANCE CARRIER               │
│ UnitedHealthcare                │  ← secondaryFields (carrier + plan)
│ PLAN: Silver HMO $0 Deductible  │
├─────────────────────────────────┤
│ PLAN ID: 68398FL0030  $132.44/mo│  ← auxiliaryFields (plan ID + premium)
└─────────────────────────────────┘
   (NO BARCODE - clean design)

Pass Layout (Alert Mode - when notification is active):
┌─────────────────────────────────┐
│ [LOGO]              STATUS: NEW │  ← headerFields (triggers notification)
├─────────────────────────────────┤
│      [STRIP IMAGE]              │
│         MEMBER                  │
│     JAVIER LAZO                 │
├─────────────────────────────────┤
│ URGENT NOTICE                   │
│ Your payment is overdue...      │  ← secondaryFields (alert replaces plan)
├─────────────────────────────────┤
│ PLAN ID: 68398FL0030  $132.44/mo│
└─────────────────────────────────┘
```

**Wallet Member Fields:**
- `fullName` - Member name displayed on pass
- `memberId` - Unique member identifier
- `contactId` - Link to CRM contact (optional)
- `carrierName` - Insurance carrier (e.g., "UnitedHealthcare")
- `planId` - Plan identifier (e.g., "68398FL0030040")
- `planName` - Full plan name (e.g., "Silver HMO $0 Deductible")
- `monthlyPremium` - Monthly premium amount (e.g., "132.44")

**CRITICAL: Apple Wallet Notification Rules:**
1. **changeMessage MUST be in headerFields or primaryFields** for lock-screen preview to appear
2. **Never send the same text twice** - Apple suppresses duplicate notifications silently
3. **webServiceURL must be `/api/passkit`** (NOT `/api/passkit/v1`) - Apple appends `/v1/` automatically
4. **If-Modified-Since header** must be respected - return 304 if pass unchanged
5. **Each notification must have unique text** - append timestamp or ID for testing

**APNs Push Notification Flow:**
1. Update `lastNotification` field in database (`wallet_passes` table)
2. Update `updatedAt` timestamp (triggers pass refresh)
3. Send empty APNs push to device token (HTTP/2 to `api.push.apple.com`)
4. iOS queries `/api/passkit/v1/devices/.../registrations/...` for updated serials
5. iOS fetches updated pass from `/api/passkit/v1/passes/.../[serialNumber]`
6. If field with `changeMessage: "%@"` changed, lock-screen preview appears

**Endpoints:**
- `POST /api/wallet/passes/:id/alert` - Send alert to single pass
- `POST /api/wallet/alerts/bulk` - Send alert to all company passes
- `POST /api/passkit/v1/devices/:deviceId/registrations/:passTypeId/:serial` - Device registration
- `GET /api/passkit/v1/devices/:deviceId/registrations/:passTypeId` - List updated passes
- `GET /api/passkit/v1/passes/:passTypeId/:serial` - Download updated pass
- `DELETE /api/passkit/v1/devices/:deviceId/registrations/:passTypeId/:serial` - Unregister device

**Pass Images:**
- `attached_assets/pass-icon.png` / `pass-icon@2x.png` - Pass icon
- `attached_assets/pass-logo.png` / `pass-logo@2x.png` - Company logo
- `attached_assets/strip.png` / `strip@2x.png` - Header strip image (1280x168 for @2x)

**Security:**
- Encrypted auth tokens using AES-256-CBC with `ENCRYPTION_KEY_32BYTES`
- Push tokens encrypted in database
- All configuration stored in `wallet_settings` table (NO environment variables)
- WWDR certificate at `server/certs/AppleWWDRCAG4.pem`

## External Dependencies

- **Database:** PostgreSQL, Drizzle ORM, `postgres`.
- **Email:** Nodemailer.
- **SMS/MMS/iMessage:** Twilio, BulkVS, BlueBubbles.
- **Payments:** Stripe.
- **Telephony:** Telnyx (WebRTC SDK, Call Control API).
- **UI Components:** Radix UI, Shadcn/ui, Lucide React, CMDK, Embla Carousel.
- **Drag & Drop:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
- **Rich Text Editing:** TipTap.
- **Form Management & Validation:** React Hook Form, Zod.
- **Session Management:** `express-session`, `connect-pg-simple`.
- **Security:** Bcrypt.
- **Utilities:** `date-fns`.
- **Background Jobs:** `node-cron`.