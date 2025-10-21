# Admin Dashboard - Curbe

## Overview
Curbe is a multi-tenant CRM system integrating iMessage/SMS/RCS to provide an enterprise-grade messaging experience similar to WhatsApp Business. The admin dashboard allows superadmins to manage multiple companies (tenants) and their users with role-based access, offering features like multi-tenant management, Stripe-based billing, custom SMTP email notifications, and a scalable full-stack architecture. The project aims to be a robust platform for enterprise messaging and customer relationship management.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, Vite, Shadcn/ui (New York style), Radix UI, and Tailwind CSS, featuring a custom theming system (light/dark modes). It employs a mobile-first responsive design, adapting layouts and element visibility across devices. Navigation is primarily handled by a sidebar, and the SMS chat application uses a dynamic three-column layout.

### Technical Implementations
The frontend uses React 18, TypeScript, Vite, Wouter for routing, and TanStack Query for state management. The backend is built with Express.js and TypeScript, providing a RESTful API with session-based authentication and role-based access control (RBAC).

**Key Features:**
-   **User & Company Management:** Comprehensive CRUD operations for users and companies, including role-based access, 2FA, profile management, email activation, and account status tracking. Features Google Places Business Autocomplete and includes industry-specific fields for insurance and business categorization.
    -   **Settings Page:** Multi-tab interface (Profile, Company, Team, Security, Preferences, Notifications) with real-time data freshness and WebSocket integration. Includes detailed user and company profile editing, advanced user management with search and filters, and a comprehensive timezone selector.
        -   **Team Management:** Company admins can add new team members using a professional form that matches the superadmin user creation interface. The "Add Team Member" form includes: First Name, Last Name, Email, Phone Number (with format validation and helper text), Date of Birth, Preferred Language (English/Spanish), and Role (Admin/Member/Viewer). Multi-tenant enforcement automatically assigns new users to the admin's company (server-side), with no superadmin role option for security. Uses shared `insertUserSchema.omit({ password: true })` for validation consistency. **Critical fix (2025-10-21):** Server now converts `dateOfBirth` string to Date object before Drizzle insertion to prevent "toISOString is not a function" error in both POST /api/users and PATCH /api/users/:id endpoints.
    -   **Last Login Tracking:** Automatic `lastLoginAt` updates upon successful OTP verification, displayed in relative time.
-   **Authentication & Security:** Bcrypt hashing, email activation, OTP-based 2FA, session-based authentication, password reset, and active session management with device and IP tracking. Password reset functionality includes token validation, complexity checks, session clearing, and real-time notifications for admins.
-   **Multi-tenancy:** Strict data isolation using `companyId` for non-superadmin access, with superadmins having cross-company oversight.
-   **Email System:** Global SMTP configuration, database-driven templates, and automated sending for system events.
-   **Modular Feature System:** Superadmins can define and assign features to companies.
-   **Audit Logging:** Centralized service for tracking critical actions.
-   **Campaign System:** Unified interface for managing Email and SMS Campaigns, and Contact Lists, with reports and analytics.
-   **Real-Time Notifications:** Production-grade WebSocket-based system for instant updates, including sound alerts and superadmin broadcast capabilities. WebSocket connections are authenticated using session cookies and only establish after user authentication is confirmed to prevent connection errors.
-   **SMS Chat Application:** Bidirectional, real-time SMS chat with a three-column layout, WebSocket updates, contact integration, conversation management, and internal notes.
-   **SMS Subscription Management:** `smsSubscribed` field with automatic unsubscribe via Twilio webhook and manual toggle.
-   **Billing & Stripe Integration:** Automated customer and subscription creation, webhook processing for Stripe events, and a professional billing dashboard for subscription and payment management. Includes trial expiration management, payment method and billing address management, and automated payment notifications. Features a Superadmin Billing Dashboard for company billing oversight, automated product/price synchronization, an integrated financial support system, and subscription cancellation with automatic account deactivation.
-   **Quotes Management System:** A comprehensive insurance quote management system with a streamlined 3-step wizard interface for creating and managing client quotes across 11 insurance product types. Features include visual step indicators, automated effective date defaults (1st of next month), integrated Google Places Address Autocomplete with automatic county detection, and multi-tenant isolation. **ID System (2025-10-21):** Uses 8-character short IDs (alphanumeric, uppercase, excluding confusing characters like O/0, I/1/L) instead of UUIDs for better usability and cleaner URLs. IDs are generated server-side using `generateShortId()` from `server/id-generator.ts` with uniqueness validation.
    -   **Wizard Structure:** 
        -   Step 1 (Policy Information): Product type selection and effective date
        -   Step 2 (Personal Information & Address): Client data with SSN, complete address with Google Places auto-fill, and county detection
        -   Step 3 (Family Group): Household income, family size, spouse/dependent management with dedicated schemas. **Updated (2025-10-21):** Reorganized to match Step 2's visual structure with consistent grid layouts (md:grid-cols-4 for names), section headers with icons (Household Information, Family Members), and improved field organization. Spouse cards include: First/Middle/Last/Second Last Name, DOB, SSN (auto-formatted), Gender, Phone, Email. Dependent cards additionally include required "Relation" field (Child, Parent, Sibling, Other).
    -   **Technical Implementation:** REST API routes with Zod validation, Google Places API integration for address autocomplete and county extraction (administrative_area_level_2), date handling, protected multi-tenant fields, SQL joins for data enrichment, react-hook-form for validation, and dynamic form management with nested arrays. Short ID generation with collision detection in `storage.createQuote()`. Separate schemas: `spouseSchema` (extends `familyMemberSchema`) and `dependentSchema` (extends `familyMemberSchema` with required `relation` field).
    -   **EditMemberSheet Refactoring (2025-10-21):** Critical architectural fix to resolve persistent bugs. Component extracted outside `QuotesPage` to prevent recreation on every render. Implemented `useMemo` for `memberData` with optimized dependencies `[quote?.id, memberType, memberIndex]`. SSN field now stores ONLY digits (no formatting/masking) in form state, using `type="password"` vs `type="text"` for visibility toggle - displays formatted (XXX-XX-XXXX) only in UI, never saves masked values. Simplified form reset logic to execute only on open transition (false→true) via `prevOpenRef`, not on data changes. Single controlled Sheet instance prevents multiple re-openings. Added TypeScript interface `EditMemberSheetProps` with proper types and `SheetDescription` for accessibility.
    -   **Normalized Data Model (2025-10-21):** Implemented complete normalized database architecture for enhanced quote member management:
        -   **Database Schema:** Created 4 new tables: `quote_members` (client/spouse/dependent with role field), `quote_member_income` (employment and income details, 1:1 optional), `quote_member_immigration` (citizenship/visa/work authorization, 1:1 optional), `quote_member_documents` (file uploads with metadata, 1:N). All tables use `varchar` IDs with `gen_random_uuid()`, enforce multi-tenant isolation with `companyId`, and include proper foreign keys with cascading deletes.
        -   **AES-256-GCM Encryption (server/crypto.ts):** Production-grade encryption system for PII protection. Encrypts SSN, annual income, visa numbers, green card numbers, and I-94 numbers before database storage. Uses random IV and authentication tag, stored as JSON string format `{iv, authTag, ciphertext}`. Includes masking functions: `maskSSN()` (XXX-XX-1234), `maskIncome()` ($4****), `maskDocumentNumber()` (****1234) for secure data display.
        -   **Storage Layer (server/storage.ts):** 15 new CRUD methods added to `IStorage` interface and `DbStorage` implementation: Quote Members (get by quote/ID, create, update, delete), Income (get, upsert, delete), Immigration (get, upsert, delete), Documents (list, get, create, delete). All methods enforce multi-tenant authorization via `companyId` validation.
        -   **REST API (server/routes.ts):** 16 secure endpoints with comprehensive security: PII masking by default (SSN/income/visa numbers masked in responses), superadmin-only `?reveal=true` flag with audit logging, document upload validation (MIME whitelist: PDF/JPEG/PNG, 10MB limit, secure filename generation, path traversal prevention), secure downloads with proper Content-Disposition headers, cross-company access prevention (403 Forbidden), Zod validation on all request bodies. File storage structure: `/server/uploads/{companyId}/{quoteId}/{memberId}/`.
        -   **Security Architecture:** Field-level encryption for sensitive PII, automatic masking in API responses, audit logging for PII access, multi-tenant isolation at all levels, secure file handling with type/size validation, Content-Security headers on downloads, ownership validation for all operations.

### System Design Choices
The system uses PostgreSQL with Drizzle ORM for data management and enforces strict multi-tenancy. Security features include robust password management, account activation, and 2FA. The modular feature system ensures flexibility and extensibility.

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