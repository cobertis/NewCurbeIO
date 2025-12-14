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
- **Specialized Systems:** Landing Page Builder, Unified Contacts Directory, Tab Auto-Save, Duplicate Message Prevention, Custom Domain (White Label), Apple Wallet VIP Pass System.

**Telnyx WebRTC Configuration:**
All WebRTC implementations follow official Telnyx documentation, including programmatic audio element creation, `prefetchIceCandidates: true`, string ID for remote elements, specific call options (`audio: true`, `useStereo: true`, `preferred_codecs`), detailed audio settings, `userMediaError` handling, and `encrypted_media: null` (SRTP disabled) for compatibility.

**Telnyx Call Control Architecture:**
Phone numbers are routed via a Call Control Application for proper hangup using the Telnyx REST API. This involves webhook-driven call flow (`call.initiated` -> answer PSTN -> dial SIP -> `call.answered` -> bridge legs), and a specific hangup API call with `NORMAL_CLEARING (16)`. E911 must be disabled using a dedicated action endpoint before reassigning numbers to the Call Control Application.

**Telephony Billing Architecture (Dec 2024):**
- **Immediate Purchase Billing:** Phone numbers are charged to company wallet immediately upon purchase (first month fee)
- **Monthly Recurring Billing:** Runs on the 1st of each month via `node-cron` scheduler, charges active numbers + CNAM fees + E911 fees
- **Monthly Fee Structure:**
  - Phone Number Rental: $1.00/month per local number, $1.50/month per toll-free number
  - CNAM Listing: $0.50/month per phone number (if enabled)
  - E911 Service: $2.00/month per emergency address
- **Call Billing:** 60-second increments (matches Telnyx), includes base rate + recording cost + CNAM lookup cost
- **Transaction Types:** `NUMBER_PURCHASE`, `NUMBER_RENTAL`, `CNAM_MONTHLY`, `E911_MONTHLY`, `CALL_COST`, `MONTHLY_FEE`
- **Billing Fields:** `telnyx_phone_numbers` table includes `numberType`, `retailMonthlyRate`, `telnyxMonthlyCost`, `lastBilledAt`, `nextBillingAt`

**Security Architecture:**
Session security (`SESSION_SECRET`), webhook signature validation (Twilio, BulkVS, BlueBubbles), Zod schema validation for all public endpoints, open redirect protection via allowlist, unsubscribe token enforcement, user-scoped data isolation (BulkVS), iMessage webhook secret isolation, and multi-tenant session isolation for WhatsApp integration with real-time webhooks and secure media storage.

### Apple Wallet VIP Pass System:
A multi-tenant system for creating, issuing, and managing Apple Wallet VIP Passes with per-company branding and APNs push notifications. It includes dedicated database tables for pass designs, instances, devices, and notifications, along with backend services for pass generation (`passkit-generator`) and APNs, and follows Apple's PassKit Web Service endpoints for device and pass management.

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
- **Apple Wallet:** `passkit-generator`.
### WebRTC ICE Optimization (Dec 2024)
**GOAL:** Reduce call connection latency from 1.3-5s to <1s

**CHANGES IMPLEMENTED:**
1. **Pre-warm ICE on login** - `preWarm()` method in TelnyxWebRTCManager starts ICE gathering when agent logs in, not when call arrives
2. **Early initialization in App.tsx** - Triggers pre-warm as soon as user has Telnyx number
3. **iceCandidatePoolSize: 8** - Pre-allocates candidate pool for faster gathering
4. **Prefetch ICE candidates** - SDK option `prefetchIceCandidates: true` enabled
5. **AnchorSite: "Latency"** - Uses automatic latency-based routing to nearest Telnyx POP

**ARCHITECTURE:**
- Pre-warm runs in parallel with SDK initialization
- Uses STUN servers (stun.telnyx.com, stun.l.google.com) for candidate gathering
- SDK manages TURN credentials internally (no hardcoded credentials)
- Pre-warm timeout: 3 seconds (continues if exceeded)

### Real-Time Phone Number Assignment (Dec 2024)
**GOAL:** Auto-connect assignee's WebRTC phone when admin assigns a number

**IMPLEMENTATION:**
1. `broadcastTelnyxNumberAssigned(userId, phoneNumber, telnyxPhoneNumberId)` - WebSocket broadcast to specific user only
2. Server endpoint `POST /api/telnyx/assign-number/:phoneNumberId` calls broadcast after DB update
3. Frontend App.tsx listens for `telnyx_number_assigned` event and invalidates queries
4. WebPhoneFloatingWindow auto-initializes WebRTC when `hasTelnyxNumber` changes to true

**FLOW:**
Admin assigns number → DB update → WebSocket broadcast to assignee → Query invalidation → WebRTC auto-init → Toast notification

### Extension-to-Extension Calling (Dec 2024)
**GOAL:** Enable internal calls between PBX extensions without SIP costs

**ARCHITECTURE:**
- Pure WebRTC peer-to-peer calling over WebSocket signaling
- WebSocket path: `/ws/pbx` for PBX call signaling
- Backend service: `server/services/extension-call-service.ts`
- Frontend component: `client/src/components/extension-phone.tsx`
- Integrated into PBX Settings under "Calling" tab

**SIGNALING FLOW:**
1. Extension registers via WebSocket with session authentication
2. Server sends online extensions list (company-scoped)
3. Caller creates offer → sends to callee via WebSocket
4. Callee answers with SDP answer → relayed back
5. ICE candidates exchanged bidirectionally
6. Media flows peer-to-peer (no server relay)

**KEY IMPLEMENTATION DETAILS:**
- Uses callIdRef to track call ID in ICE candidate handler (avoids stale closure)
- STUN servers: stun.l.google.com, stun.telnyx.com

### SIP Forking Configuration (Dec 2024)
**GOAL:** Enable simultaneous ringing on all registered SIP devices (webphone + physical phones)

**THE PROBLEM (SOLVED):**
Using generic `sip.telnyx.com` domain ignores credential connection rules (simultaneous_ringing).
Telnyx's switch finds the fastest route (WebSocket) and ignores UDP-registered devices (Yealink).

**THE SOLUTION:**
Use company-specific SIP domain (e.g., `curbe.sip.telnyx.com`) instead of generic `sip.telnyx.com`.
This forces Telnyx to load the credential connection configuration INCLUDING `simultaneous_ringing: "enabled"`.

**CONFIGURATION:**
1. **Telnyx Portal:** Voice API Applications → Inbound → SIP subdomain → Set unique name (e.g., `curbe`)
2. **Database:** Store domain in `telephony_settings.sip_domain` (e.g., `curbe.sip.telnyx.com`)
3. **Credential Connection:** Enable `simultaneous_ringing: "enabled"` in Inbound settings

**IMPLEMENTATION:**
- Helper function `getCompanySipDomain(companyId)` retrieves SIP domain from `telephony_settings`
- All SIP URI constructions use: `sip:${username}@${sipDomain}` (NOT `sip:${username}@sip.telnyx.com`)
- Falls back to `sip.telnyx.com` if company has no custom domain configured

**AFFECTED FUNCTIONS in `call-control-webhook-service.ts`:**
- `transferToAssignedUser()` - Direct calls to assigned user
- `routeToQueue()` - Ring-all queue routing
- `routeToExtension()` - Extension-based routing
- `handleAgentAcceptQueueCall()` - Queue accept via WebSocket
- `retryQueueDial()` - Queue retry logic
- `routeToAssignedUser()` - Alternative assigned user routing

**KEY FILES:**
- `server/services/call-control-webhook-service.ts` - All transfer/dial functions use `getCompanySipDomain()`
- `shared/schema.ts` - `telephony_settings.sipDomain` field
- Credential connection ID stored in `telephony_settings.credential_connection_id`

**YEALINK CONFIGURATION:**
- SIP Server: Use company-specific domain (e.g., `curbe.sip.telnyx.com`)
- UDP Keep Alive: Set to 15-30 seconds to prevent NAT timeout
- RTP Encryption (SRTP): Set to Optional or Compulsory for WebRTC compatibility

**CRITICAL ROUTING FIX (Dec 2024):**
SIP Forking ONLY works for INBOUND calls directly to Credential Connection.
Calls routed through Call Control App are OUTBOUND transfers which bypass simultaneous_ringing.

**Routing Logic in `repairPhoneNumberRouting()`:**
- Numbers WITH IVR (`ivrId !== 'unassigned'`) → Call Control App (for IVR menu)
- Numbers WITHOUT IVR (including `ownerUserId`) → Credential Connection (SIP Forking enabled)

This ensures both WebRTC and physical phones (Yealink) ring simultaneously for direct user calls.
