# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system with integrated iMessage/SMS/RCS capabilities, designed for enterprise messaging and customer relationship management. The admin dashboard provides superadmins with tools to manage companies (tenants) and their users, featuring role-based access, Stripe billing, custom SMTP notifications, and a scalable full-stack architecture. It includes comprehensive modules for Quotes, Policies, Campaigns, and a real-time SMS Chat application. The system aims to streamline customer relationship management and communication for businesses.

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
The frontend uses React 18, TypeScript, Vite, Shadcn/ui (New York style), Radix UI, and Tailwind CSS, supporting custom theming (light/dark modes). It features a mobile-first responsive design, with primary navigation via a sidebar and a dynamic three-column layout for the SMS chat application, optimized for mobile interactions.

### Technical Implementations
The frontend uses Wouter for routing and TanStack Query for state management. The backend is built with Express.js and TypeScript, offering a RESTful API with session-based authentication and role-based access control. The system employs a unified marketplace plans component for dynamic routing and API calls across Quotes and Policies.

**Key Features:**
-   **User & Company Management:** Comprehensive CRUD for users and companies, including RBAC, 2FA, and team features.
-   **Authentication & Security:** Bcrypt hashing, email activation, OTP-based 2FA, session management.
-   **Multi-tenancy:** Strict data isolation per company with superadmin oversight.
-   **Email System:** Global SMTP configuration and database-driven templates.
-   **Modular Feature System:** Superadmins can assign features to companies.
-   **Audit Logging:** Centralized service for tracking critical actions.
-   **Campaign System:** Unified interface for managing Email/SMS Campaigns and Contact Lists.
-   **Real-Time Notifications:** WebSocket-based system for instant updates.
-   **SMS Chat Application:** Bidirectional, real-time SMS chat with conversation management.
-   **Billing & Stripe Integration:** Automated customer/subscription management.
-   **Quotes Management System:** A 3-step wizard for 11 product types, featuring Google Places Autocomplete, CMS Marketplace API integration for health insurance plans (including HHS Poverty Guidelines for APTC calculations), plan comparison, and professional credit card validation. Includes internal notes, document management, universal search with optional family member searching, and blocking functionality. Quotes have a comprehensive options menu. Manual plan entry is supported for states without marketplace API connectivity.
-   **Policies Management System:** Converts quotes to policies, migrating all associated data, with identical functionality to the Quotes module. Provides comprehensive policy status management and agent assignment capabilities, including universal search with optional family member searching and blocking functionality. Policy payment methods are shared across policies belonging to the same client (identified by SSN/email). The "Other policies of the applicant" section displays related policies in a full table layout. Manual plan entry is supported. **Statistics and calendar events use canonical client identification (SSN or email) to prevent double-counting renewed policies and duplicate birthday events** - ensuring accurate reporting across policy renewal years.
-   **Consent Document System:** Generates legal consent documents, supports email/SMS/link delivery, and captures electronic signatures with a full digital audit trail.
-   **Calendar System:** Full-screen professional calendar displaying company-wide events including birthdays and reminders, with multi-tenant isolation. **Birthday events are deduplicated across renewed policies using canonical client identification** (SSN+DOB or email+DOB), preventing the same person from appearing multiple times.
-   **Reminder System:** Background scheduler creates notifications for pending reminders, restores snoozed reminders, and prevents duplicate notifications. All notifications are in English.
-   **Agent Assignment System:** Flexible agent reassignment for quotes and policies with agent-based filtering and real-time, English-language notifications to new agents.
-   **Policy Renewal System:** Automated renewal period activation (October 1 - February 1) with dynamic year calculation. Renewal buttons and OEP filters automatically show/hide based on current date. System prevents double-counting of renewed policies in statistics by using canonical client identification (SSN or email) to track unique individuals across policy years.
-   **Landing Page Builder System:** Professional SmartBio/Lynku.id-style bio link page creator with **3-column editor interface** featuring drag & drop block management (@dnd-kit), real-time mobile preview, and modern gradient themes. **1 landing page per user** - automatically created on first access. Supports **14 professional block types**:
    - **Basic Blocks**: Link Button, Social Media (Instagram/Facebook/Twitter/LinkedIn/YouTube/TikTok), Video Embed (YouTube/Vimeo), Text, Image, Divider, Contact (Phone/Email/WhatsApp)
    - **Advanced Blocks**: Google Maps Location (embedded maps with address), Lead Capture Form (customizable fields with CRM integration), Calendar/Appointment Scheduler (with availability validation), Testimonials/Reviews (carousel/grid layouts with ratings), FAQ Accordion (expandable Q&A), Stats/Metrics Counter (dynamic statistics display)
    
    **Editor Interface (SmartBio Design):**
    - **Fixed Header**: Logo, editable URL input with dynamic domain detection, Undo/Redo buttons (stubs), Desktop/Mobile preview toggle, prominent Publish button
    - **Left Sidebar (Dark, 280px)**: "Add Blocks" section with 2-column grid of colorful block buttons (Text, Calendar, Link, Image, Video, Social, Map, Newsletter), "See Another Blocks" button, and Social Media manager with 6 platforms (Instagram, Facebook, Twitter, LinkedIn, YouTube, TikTok) supporting quick add/delete
    - **Center Preview Area**: CSS dotted background pattern, mobile device frame (375x812px) with realistic shadows and iPhone-style notch, zoom control (90%/100%/110%), fully functional drag-and-drop block reordering within frame, profile section with avatar/name/bio
    - **Right Panel (350px) with Tabs**:
      - **Design Tab**: "Select Theme" with visual gradient thumbnails (8 predefined themes across All/Light/Dark categories in 2x2 grid), "See All Themes" button, Typography controls (Font Weight/Style dropdowns), Custom Colors (Primary/Background/Text color pickers), Profile editor (Name/Bio inputs)
      - **Analytics Tab**: "Coming soon" placeholder for future analytics
      - **Settings Tab**: URL slug configuration, password protection toggle, SEO meta tags (title/description), quick action buttons
    
    **Theme System**: 8 modern gradient themes (Purple Dream, Pink Sunset, Ocean Blue, Dark Night, Mint Fresh, Orange Glow, Forest Green, Royal Purple) with visual previews, categorized by All/Light/Dark filters, instant preview updates via mutation system.
    
    **Slug & Input Management**: User-based slug generation (firstName or email prefix) ensures each user has a unique landing page URL. All editable fields (slug, SEO title, SEO description) use local state with 500ms debouncing to prevent excessive API calls during typing. Real-time validation feedback with color-coded borders (green for valid, red for invalid), check/X icons, and contextual error messages. Slug validation enforces lowercase letters, numbers, and hyphens only (min 3 chars, max 50 chars) via regex `/^[a-z0-9-]{3,50}$/`.
    
    Features complete theme customization (colors, fonts, gradients, button styles), password protection, SEO meta tags, and comprehensive analytics tracking (page views, block clicks, lead captures, appointments). Public pages accessible at both `/:slug` and `/l/:slug` (e.g., `app.curbe.io/claudia` or `app.curbe.io/l/claudia`) without authentication, with automatic domain detection for "Open Landing Page" button. Mobile-responsive SmartBio-inspired design featuring large circular avatars, professional iconography, smooth transitions, and modern shadows. System includes auto-creation on first visit, auto-save with debounce, slug uniqueness validation, multi-tenant company isolation, and dedicated database tables for leads and appointments with IP tracking and user agent logging for security.

### System Design Choices
The system uses PostgreSQL with Drizzle ORM, enforcing strict multi-tenancy. Security includes robust password management and 2FA. Dates are handled as `yyyy-MM-dd` strings to prevent timezone issues. A background scheduler (`node-cron`) manages reminder notifications. Quote family members display logic merges normalized and JSONB data.

**CMS Marketplace API Integration:** 
- APTC eligibility logic uses the `isApplicant` field to distinguish between dependents who need insurance (isApplicant=true → aptc_eligible=true, has_mec=false) vs those with Medicaid/CHIP (isApplicant=false → aptc_eligible=false, has_mec=true)
- Request structure follows exact CMS API specifications
- All required fields are sent correctly: dob, aptc_eligible, has_mec, gender, uses_tobacco, is_pregnant, relationship, effective_date, has_married_couple
- Pregnancy status is forwarded accurately for all family members (client, spouses, dependents)
- APTC calculations properly extract household APTC from Silver plans
- Frontend displays premium prices with cents (e.g., $79.50) when not zero, and without cents when zero (e.g., $0)
- Plan year badge is displayed on each plan card showing the coverage year

### Security Architecture
-   **Session Security:** `SESSION_SECRET` environment variable is mandatory to prevent session hijacking.
-   **Webhook Validation:** Twilio webhook signature validation is fully enabled.
-   **Input Validation:** All public-facing endpoints enforce Zod schema validation.
-   **Open Redirect Protection:** Tracking endpoint validates redirect URLs against a strict allowlist.
-   **Unsubscribe Token Enforcement:** Unsubscribe endpoint requires and validates security tokens.
-   **Code Organization:** Shared carrier/product type data is centralized in `shared/carriers.ts`.

## External Dependencies

-   **Database:** Neon PostgreSQL, Drizzle ORM.
-   **Email:** Nodemailer.
-   **SMS:** Twilio.
-   **Payments:** Stripe.
-   **UI Components:** Radix UI, Shadcn/ui, Lucide React, CMDK, Embla Carousel.
-   **Drag & Drop:** @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities.
-   **Form Management & Validation:** React Hook Form, Zod.
-   **Session Management:** `express-session`, `connect-pg-simple`.
-   **Security:** Bcrypt.
-   **Utilities:** `date-fns`.
-   **Background Jobs:** `node-cron`.