# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system designed to streamline customer relationship management and communication for businesses. It provides an admin dashboard for superadmins to manage companies and users, offering integrated iMessage/SMS/RCS capabilities, role-based access, Stripe billing, and custom SMTP notifications. Key modules include Quotes, Policies, Campaigns, and a real-time SMS Chat application, all built on a scalable full-stack architecture.

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
The frontend uses React 18, TypeScript, Vite, Shadcn/ui (New York style), Radix UI, and Tailwind CSS for custom theming (light/dark modes) and a mobile-first responsive design. Navigation is sidebar-based, with a dynamic three-column layout for the SMS chat application.

### Technical Implementations
The frontend uses Wouter for routing and TanStack Query for state management. The backend is Express.js with TypeScript, providing a RESTful API with session-based authentication and role-based access control.

**Key Features:**
-   **User & Company Management:** CRUD, RBAC, 2FA, team features.
-   **Authentication & Security:** Bcrypt hashing, email activation, OTP 2FA, session management.
-   **Multi-tenancy:** Strict data isolation.
-   **Email System:** Global SMTP and database-driven templates.
-   **Modular Feature System:** Superadmins assign features to companies.
-   **Audit Logging:** Centralized action tracking.
-   **Campaign System:** Unified Email/SMS Campaign and Contact List management.
-   **Real-Time Notifications:** WebSocket-based updates.
-   **SMS Chat Application:** Bidirectional, real-time chat.
-   **Billing & Stripe Integration:** Automated customer/subscription management.
-   **Quotes Management System:** 3-step wizard for 11 product types, Google Places Autocomplete, CMS Marketplace API integration (HHS Poverty Guidelines for APTC), plan comparison, credit card validation, notes, document management, universal search, blocking, and manual plan entry.
-   **Policies Management System:** Converts quotes to policies, maintaining similar functionality to Quotes, including status management, agent assignment, universal search, and blocking. Payment methods shared by client (SSN/email). Canonical client identification (SSN or email) prevents double-counting renewed policies and duplicate birthday events.
-   **Consent Document System:** Generates legal consent documents, supports multi-channel delivery, and captures e-signatures with a digital audit trail.
-   **Calendar System:** Full-screen, multi-tenant calendar displaying company-wide events, including deduplicated birthday events.
-   **Reminder System:** Background scheduler for notifications, snooze functionality, and duplicate prevention.
-   **Manual Event Creation:** Comprehensive event creation system for Birthday events (client birthdays), Reminder events (standalone reminders), and Appointment events (manual appointments). All manual events are company-scoped.
-   **Appointment Availability Configuration:** User-specific scheduling preferences via a dedicated `/appointment-settings` page, including weekly schedule, buffer time, appointment duration, minimum notice, maximum advance booking, and timezone selection.
-   **Agent Assignment System:** Flexible reassignment for quotes and policies with filtering and real-time notifications.
-   **Policy Renewal System:** Automated renewal period activation (October 1 - February 1) with dynamic year calculation and OEP filter management.
-   **Landing Page Builder System:** Professional SmartBio/Lynku.id-style bio link page creator with a 3-column editor, drag & drop, real-time mobile preview, and modern gradient themes. Each user gets one automatically created landing page supporting 14 block types (Basic: Link Button, Social Media, Video Embed, Text, Image, Divider, Contact; Advanced: Google Maps, Request Quote Form, Calendar/Appointment Scheduler, Testimonials/Reviews, FAQ Accordion, Stats/Metrics Counter).
    -   **Multi-Tenancy & User Isolation:** Each user has a unique landing page, filtered by userId, with global slug uniqueness.
    -   **Editor Interface:** Fixed header, editable URL with real-time validation, Undo/Redo, Desktop/Mobile preview, Publish button. iPhone 16 Pro Max frame preview with Dynamic Island, status bar, zoom, and SmartBio-style layout (sticky header, gradient hero, curved SVG, large overlapping circular profile photo at `-mt-48` with animated spinning gradient ring, horizontal social icons). Right panel with Design (themes, typography, custom colors, profile editor, Social Media Manager), Analytics (coming soon), and Settings (URL slug, SEO meta tags) tabs.
    -   **Live Preview System:** Editor preview displays identical content to the published page with fully functional interactive elements.
    -   **Smart Social Media Manager:** Auto-completes social media links by username (e.g., Instagram: instagram.com/).
    -   **Avatar Ring Animation:** Rotating gradient ring around the profile avatar (purple/violet/pink/blue, 3-second rotation).
    -   **Contact Display:** Phone number only (no email) with clickable `tel:` link, USA format `(XXX) XXX-XXXX` with automatic formatting.
    -   **Undo/Redo System:** Full undo/redo for all block operations using TanStack Query optimistic updates.
    -   **Theme System:** 8 modern gradient themes with visual previews.
    -   **Slug & Input Management:** User-based slug generation with debounced local state, real-time validation, and availability checking.
    -   **Block Styling:** SmartBio aesthetic with solid black circular social media blocks, blue "See Our Location" button for maps, globe icons for link buttons, and gray bio text.
    -   **Rich Text Editor:** TipTap-based rich text editor with full formatting capabilities (bold, italic, underline, lists, alignment, hyperlinks, color picker).
    -   **Image Upload System:** Direct file upload from user's computer with live preview; images converted to base64 data URLs.
    -   **Interactive Google Maps:** Map blocks use Google Maps JavaScript API for interactive maps with markers, integrated with Google Places API. Map data stored in JSONB (placeId, formattedAddress, latitude, longitude, zoomLevel).
    -   **Visual Design:** Fixed dark indigo/black gradient for both preview and public pages, specific avatar positioning (`-mt-48` with 220px header), compact spacing, and pure black profile name text to match SmartBio.
    -   **Quote Request Form:** Pre-configured lead capture form for insurance quote requests, storing submissions and triggering agent notifications.
    -   **Public Pages:** Accessible at `/:slug` and `/l/:slug` without authentication, featuring identical SmartBio layout, theme customization, SEO meta tags, and analytics tracking.

### System Design Choices
Uses PostgreSQL with Drizzle ORM, enforcing strict multi-tenancy. Security includes robust password management and 2FA. Dates are handled as `yyyy-MM-dd` strings to prevent timezone issues. A background scheduler (`node-cron`) manages reminder notifications. Quote family members display logic merges normalized and JSONB data. CMS Marketplace API integration correctly handles APTC eligibility, pregnancy status, and displays premium prices.

### Security Architecture
-   **Session Security:** `SESSION_SECRET` environment variable mandatory.
-   **Webhook Validation:** Twilio webhook signature validation.
-   **Input Validation:** Zod schema validation on all public-facing endpoints.
-   **Open Redirect Protection:** Tracking endpoint validates redirect URLs against an allowlist.
-   **Unsubscribe Token Enforcement:** Unsubscribe endpoint requires and validates security tokens.

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