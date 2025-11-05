# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system with integrated iMessage/SMS/RCS capabilities, providing an admin dashboard for superadmins to manage companies and users. It features role-based access, Stripe billing, custom SMTP notifications, and a scalable full-stack architecture. Key modules include Quotes, Policies, Campaigns, and a real-time SMS Chat application, all aimed at streamlining customer relationship management and communication for businesses.

## User Preferences
Preferred communication style: Simple, everyday language.
Design style: Extremely professional corporate design - NO bright colors, NO emojis, space-efficient mobile-responsive UI.

**Toast Notifications:**
- All toast notifications auto-dismiss after 3 seconds
- Users can still manually dismiss toasts before the timeout

**Loading State Pattern (MANDATORY):**
ALWAYS use the standardized `LoadingSpinner` component for all loading states across the application:
```tsx
import { LoadingSpinner } from "@/components/loading-spinner";

// For full-screen loading (pages, major components):
if (isLoading) {
  return <LoadingSpinner message="Loading data..." />;
}

// For smaller containers (sheets, dialogs):
if (isLoading) {
  return <LoadingSpinner message="Loading..." fullScreen={false} />;
}
```
- User strongly prefers consistent loading indicators across all pages
- Shows large, centered spinner (h-12 w-12) with descriptive text
- `fullScreen={true}` (default) for pages, `fullScreen={false}` for sheets/dialogs
- NO prefetching - let queries load naturally and show loading state
- Apply consistently across ALL pages, sheets, dialogs, and async components
- This ensures a uniform user experience throughout the entire application

**CRITICAL: All sensitive data (SSN, income, immigration documents, payment methods) is stored in PLAIN TEXT without encryption or masking as per explicit user requirement.**

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18, TypeScript, Vite, Shadcn/ui (New York style), Radix UI, and Tailwind CSS, supporting custom theming (light/dark modes) and a mobile-first responsive design. Navigation is primarily via a sidebar, with a dynamic three-column layout for the SMS chat application optimized for mobile.

### Technical Implementations
The frontend uses Wouter for routing and TanStack Query for state management. The backend is built with Express.js and TypeScript, offering a RESTful API with session-based authentication and role-based access control. A unified marketplace plans component dynamically handles routing and API calls for Quotes and Policies.

**Key Features:**
-   **User & Company Management:** Comprehensive CRUD, RBAC, 2FA, team features.
-   **Authentication & Security:** Bcrypt hashing, email activation, OTP 2FA, session management.
-   **Multi-tenancy:** Strict data isolation per company.
-   **Email System:** Global SMTP configuration and database-driven templates.
-   **Modular Feature System:** Superadmins assign features to companies.
-   **Audit Logging:** Centralized action tracking.
-   **Campaign System:** Unified Email/SMS Campaign and Contact List management.
-   **Real-Time Notifications:** WebSocket-based updates.
-   **SMS Chat Application:** Bidirectional, real-time chat.
-   **Billing & Stripe Integration:** Automated customer/subscription management.
-   **Quotes Management System:** 3-step wizard for 11 product types, Google Places Autocomplete, CMS Marketplace API integration (HHS Poverty Guidelines for APTC), plan comparison, credit card validation, internal notes, document management, universal search, blocking, and manual plan entry.
-   **Policies Management System:** Converts quotes to policies, migrating data with similar functionality to Quotes, including status management, agent assignment, universal search, and blocking. Payment methods are shared by client (SSN/email). Canonical client identification (SSN or email) prevents double-counting renewed policies and duplicate birthday events in statistics and calendar.
-   **Consent Document System:** Generates legal consent documents, supports multi-channel delivery, and captures e-signatures with a digital audit trail.
-   **Calendar System:** Full-screen, multi-tenant calendar displaying company-wide events, including deduplicated birthday events using canonical client identification.
-   **Reminder System:** Background scheduler for notifications, snooze functionality, and duplicate prevention.
-   **Appointment Availability Configuration:** User-specific scheduling preferences accessible via "Configurar Citas" button in /calendar page. Features weekly schedule configuration with customizable hours per day, buffer time between appointments (5-30 minutes), appointment duration options (30/60 minutes), and automatic integration with booking system to respect configured availability.
-   **Agent Assignment System:** Flexible reassignment for quotes and policies with filtering and real-time English notifications.
-   **Policy Renewal System:** Automated renewal period activation (October 1 - February 1) with dynamic year calculation and OEP filter management. Prevents double-counting renewed policies in statistics using canonical client identification.
-   **Landing Page Builder System:** Professional SmartBio/Lynku.id-style bio link page creator with a 3-column editor interface, drag & drop block management, real-time mobile preview, and modern gradient themes. Each user gets one automatically created landing page supporting 14 block types (Basic: Link Button, Social Media, Video Embed, Text, Image, Divider, Contact; Advanced: Google Maps, Request Quote Form, Calendar/Appointment Scheduler, Testimonials/Reviews, FAQ Accordion, Stats/Metrics Counter).
    -   **Multi-Tenancy & User Isolation:** Each user has their own unique landing page filtered by userId. Users can only view and edit their own landing pages. Slug uniqueness is enforced globally across all users.
    -   **Editor Interface:** Fixed header with logo, editable URL with real-time availability validation, Undo/Redo, Desktop/Mobile preview, Publish button. Center preview area features an iPhone 16 Pro Max frame with Dynamic Island, status bar, zoom, and SmartBio-style layout (sticky header with 220px height, gradient hero, curved SVG, large overlapping circular profile photo at `-mt-48` with animated spinning gradient ring, horizontal social icons in black circles) with functional drag-and-drop. Right panel with Design (themes, typography, custom colors, profile editor, **Social Media Manager**), Analytics (coming soon), and Settings (URL slug, SEO meta tags) tabs.
    -   **Smart Social Media Manager:** Dedicated section in the Design panel featuring a smart URL builder that auto-completes social media links. Users only enter their username, and the system automatically constructs the full platform-specific URL (Instagram: instagram.com/, Facebook: facebook.com/, Twitter: twitter.com/, LinkedIn: linkedin.com/in/, YouTube: youtube.com/@, TikTok: tiktok.com/@). Displays all social accounts with colored platform icons, URLs, and delete options. Dialog-based add interface with platform selector, username input with contextual prefix hints (in/, @), real-time URL preview, and Enter-key support for quick addition.
    -   **Avatar Ring Animation:** Rotating gradient ring (purple/violet/pink/blue) that completes a full rotation every 3 seconds around the profile avatar, matching SmartBio's premium aesthetic.
    -   **Contact Display:** Phone number only (no email) displayed below bio with clickable tel: link and phone icon. USA format `(XXX) XXX-XXXX` with automatic formatting while typing in the editor.
    -   **Undo/Redo System:** Full undo/redo for all block operations using TanStack Query optimistic updates with automatic server persistence.
    -   **Theme System:** 8 modern gradient themes with visual previews and filters.
    -   **Slug & Input Management:** User-based slug generation (firstName or email prefix) with debounced local state, real-time validation, and regex enforcement for slug format. Real-time slug availability checking with visual feedback (green checkmark if available, red X if taken) and error messages. Slug validation API endpoint prevents duplicate slugs across all users.
    -   **Block Styling:** SmartBio aesthetic with solid black circular social media blocks, blue "See Our Location" button for maps, globe icons for link buttons, and gray bio text.
    -   **Rich Text Editor:** Text blocks feature a comprehensive TipTap-based rich text editor with full formatting capabilities: bold, italic, underline, bullet/numbered lists, text alignment (left/center/right), hyperlinks, and color picker. Content stored as HTML in JSONB and rendered with proper sanitization in both editor preview and public pages.
    -   **Image Upload System:** Image blocks allow direct file upload from user's computer with live preview. Images are converted to base64 data URLs and stored in block content (no external URLs needed). Simple click-to-upload interface with "Change Image" button for easy replacement. No URL fields shown to user for cleaner UX.
    -   **Interactive Google Maps:** Map blocks use Google Maps JavaScript API (dynamically loaded via backend loader script) for interactive, zoomable maps with markers. Integration with existing Google Places API infrastructure. Users select addresses via GooglePlacesAddressAutocomplete component, which fetches location coordinates (latitude/longitude) and placeId. Map data stored in block content (JSONB): placeId, formattedAddress, latitude, longitude, zoomLevel. Shared MapBlockDisplay component renders maps in both editor preview and public pages with graceful error handling, loading states, and automatic cleanup on unmount. Backend endpoint `/api/google-maps-js-loader` serves a loader script that dynamically injects the Maps JS API script tag to keep GOOGLE_PLACES_API_KEY secure.
    -   **Visual Design:** Fixed dark indigo/black gradient for both preview and public pages, specific avatar positioning (`-mt-48` with 220px header), compact spacing, and pure black profile name text to match SmartBio.
    -   **Quote Request Form:** Pre-configured lead capture form specifically designed for insurance quote requests. Captures full name, email, phone number, and insurance needs. Form submissions are stored in the database and trigger notifications to the agent. Default configuration: "Request a Free Quote" title with professional messaging.
    -   **Public Pages:** Accessible at `/:slug` and `/l/:slug` without authentication, featuring identical SmartBio layout as the editor preview, theme customization, SEO meta tags, and analytics tracking. Auto-creation on first visit, auto-save, slug uniqueness validation, multi-tenant isolation, and dedicated database tables for leads/appointments with security logging. All confirmation dialogs and messages are in English.

### System Design Choices
Uses PostgreSQL with Drizzle ORM, enforcing strict multi-tenancy. Security includes robust password management and 2FA. Dates are handled as `yyyy-MM-dd` strings to prevent timezone issues. A background scheduler (`node-cron`) manages reminder notifications. Quote family members display logic merges normalized and JSONB data.

**CMS Marketplace API Integration:**
-   APTC eligibility logic distinguishes between applicants and dependents with Medicaid/CHIP.
-   Request structure follows exact CMS API specifications with all required fields (dob, aptc_eligible, has_mec, gender, uses_tobacco, is_pregnant, relationship, effective_date, has_married_couple).
-   Pregnancy status forwarded accurately.
-   APTC calculations properly extract household APTC from Silver plans.
-   Frontend displays premium prices with cents when not zero, and without cents when zero.
-   Plan year badge displayed on each plan card.

### Security Architecture
-   **Session Security:** `SESSION_SECRET` environment variable mandatory.
-   **Webhook Validation:** Twilio webhook signature validation enabled.
-   **Input Validation:** Zod schema validation on all public-facing endpoints.
-   **Open Redirect Protection:** Tracking endpoint validates redirect URLs against an allowlist.
-   **Unsubscribe Token Enforcement:** Unsubscribe endpoint requires and validates security tokens.
-   **Code Organization:** Shared carrier/product type data centralized in `shared/carriers.ts`.

## External Dependencies

-   **Database:** Neon PostgreSQL, Drizzle ORM.
-   **Email:** Nodemailer.
-   **SMS:** Twilio.
-   **Payments:** Stripe.
-   **UI Components:** Radix UI, Shadcn/ui, Lucide React, CMDK, Embla Carousel.
-   **Drag & Drop:** @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities.
-   **Rich Text Editing:** TipTap (React, StarterKit, Underline, TextAlign, Link, Color, TextStyle extensions).
-   **Form Management & Validation:** React Hook Form, Zod.
-   **Session Management:** `express-session`, `connect-pg-simple`.
-   **Security:** Bcrypt.
-   **Utilities:** `date-fns`.
-   **Background Jobs:** `node-cron`.