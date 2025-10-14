# Admin Dashboard - Curbe

## Overview

This is a modern multi-tenant admin dashboard application designed for Curbe. It features a superadmin role managing multiple companies, with each company supporting users with various roles (admin, member, viewer). The application aims to provide a clean, efficient, and data-rich experience inspired by leading SaaS platforms, focusing on multi-tenant management, data visualization, and a robust full-stack architecture.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with React 18 and TypeScript, using Vite for fast development. It utilizes Wouter for routing and Shadcn/ui (New York style) with Radix UI primitives for its component system, styled with Tailwind CSS. State management is handled by TanStack Query for server state and React hooks for local state. A custom theming system supports light and dark modes with a design aesthetic inspired by Linear and Vercel.

Key features include:
- **Dashboard**: Displays real-time statistics, various charts (bar, donut), and a recent activity list.
- **Users**: Comprehensive user management with CRUD operations, role-based access, and search/filter functionality.
- **Companies** (Superadmin-only): Full CRUD operations for companies, including detailed profiles and visual cards.
- **Login**: Session-based authentication with role-based access.

### Backend Architecture

The backend is built with Express.js and TypeScript, providing a RESTful API. It uses session-based authentication with `express-session` and implements role-based access control (RBAC) across all protected endpoints.

API Endpoints:
- `/api/users`: CRUD for user management, scoped by company for admins.
- `/api/companies`: CRUD for company management (superadmin only).
- `/api/stats`: Provides user statistics based on access level.

### Data Models & Multi-Tenant Schema

The application uses PostgreSQL with Drizzle ORM and features a multi-tenant schema that includes:
- **Companies**: Core multi-tenant organizations with detailed profiles.
- **Company Settings**: Per-company configuration for branding, features, and security.
- **Users**: Multi-tenant users with roles (superadmin, admin, member, viewer) and company association.
- **Subscriptions**: Manages billing and plans, including Stripe integration fields.
- **Invitations**: System for inviting users to companies.
- **Activity Logs**: Audit trail for significant actions.
- **API Keys**: Manages programmatic access per company.
- **Notifications**: User-specific notifications.

Multi-Tenant Role-Based Access Control:
- **Superadmin**: Global system access.
- **Admin**: Manages users within their assigned company.
- **Member**: Standard user access within their company.
- **Viewer**: Read-only access within their company.

### System Design Choices

The application prioritizes clean design, data visualization, and efficient multi-tenant management. It incorporates modern UI/UX principles with a consistent design system, including custom color palettes, spacing, and elevation patterns. Technical implementations focus on type safety (TypeScript), performance (Vite), and accessibility (Radix UI).

## External Dependencies

- **Database**: Neon PostgreSQL via `@neondatabase/serverless` driver and Drizzle ORM.
- **UI Components**: Radix UI, Shadcn/ui, Lucide React, CMDK, Embla Carousel.
- **Form Management & Validation**: React Hook Form with Zod resolvers.
- **Styling**: Tailwind CSS, PostCSS, Autoprefixer, Class Variance Authority (CVA), `clsx`, `tailwind-merge`.
- **Session Management**: `express-session` (using MemoryStore for development).
- **Utilities**: `date-fns`, `nanoid`, Zod.
- **Development Tools**: TypeScript, ESBuild, TSX.

## Multi-Tenant Architecture - CRUD Coverage & Implementation Status

### ✅ Fully Implemented Tables (with API Endpoints)

#### 1. Companies Table
**Schema Fields:**
- id (varchar UUID), name, slug (unique), domain, logo, website, industry, companySize, timezone, isActive, createdAt, updatedAt

**Storage Layer (DbStorage):**
- ✅ getCompany(id)
- ✅ getCompanyBySlug(slug)
- ✅ getAllCompanies()
- ✅ createCompany(company)
- ✅ updateCompany(id, data)
- ✅ deleteCompany(id)

**API Endpoints (Superadmin Only):**
- ✅ GET /api/companies - List all companies
- ✅ POST /api/companies - Create company (with insertCompanySchema validation)
- ✅ PATCH /api/companies/:id - Update company (with updateCompanySchema validation)
- ✅ DELETE /api/companies/:id - Delete company

**Frontend UI:**
- ✅ Companies page with full CRUD
- ✅ Company cards with visual icons
- ✅ Create/Edit dialogs with form validation
- ✅ Delete confirmation

#### 2. Users Table
**Schema Fields:**
- id (varchar UUID), email, password, firstName, lastName, avatar, phone, role (superadmin|admin|member|viewer), companyId (FK), isActive, emailVerified, emailVerifiedAt, lastLoginAt, passwordChangedAt, createdAt, updatedAt

**Storage Layer (DbStorage):**
- ✅ getUser(id)
- ✅ getUserByEmail(email)
- ✅ createUser(user)
- ✅ getAllUsers()
- ✅ getUsersByCompany(companyId)
- ✅ updateUser(id, data)
- ✅ deleteUser(id)

**API Endpoints (Superadmin & Admin):**
- ✅ GET /api/users - List users (superadmin sees all, admin sees company users)
- ✅ POST /api/users - Create user (admin scoped to their company, validates insertUserSchema)
- ✅ PATCH /api/users/:id - Update user (admin scoped to their company, validates updateUserSchema)
- ✅ DELETE /api/users/:id - Delete user (admin scoped to their company)

**Frontend UI:**
- ✅ Users page with full CRUD
- ✅ Search/filter by email
- ✅ Role badges (Super Admin, Admin, Member, Viewer)
- ✅ Create/Edit dialogs with email, password, role selection
- ✅ Delete confirmation

### ⚠️ Partially Implemented Tables (Storage Only - No API/UI)

#### 3. Company Settings Table
**Schema Fields:**
- id, companyId (FK cascade), primaryColor, secondaryColor, features (JSONB), emailSettings (JSONB), notificationSettings (JSONB), securitySettings (JSONB), createdAt, updatedAt

**Storage Layer (DbStorage):**
- ✅ getCompanySettings(companyId)
- ✅ createCompanySettings(settings)
- ✅ updateCompanySettings(companyId, data)

**API Endpoints:**
- ❌ No endpoints implemented

**Frontend UI:**
- ❌ No UI implemented

**TODO:**
- Create GET/POST/PATCH endpoints for /api/companies/:id/settings
- Build settings UI for branding, features, email, notifications, security
- Implement real-time color preview for branding changes

#### 4. Subscriptions Table
**Schema Fields:**
- id, companyId (FK cascade), planName, planPrice, billingCycle, status, trialEndsAt, currentPeriodStart, currentPeriodEnd, stripeCustomerId, stripeSubscriptionId, createdAt, updatedAt, cancelledAt

**Storage Layer (DbStorage):**
- ✅ getSubscription(id)
- ✅ getSubscriptionByCompany(companyId)
- ✅ createSubscription(subscription)
- ✅ updateSubscription(id, data)

**API Endpoints:**
- ❌ No endpoints implemented

**Frontend UI:**
- ❌ No UI implemented

**TODO:**
- Create GET/POST/PATCH endpoints for /api/companies/:id/subscription
- Build billing/subscription management UI
- Integrate with Stripe for payment processing
- Implement plan upgrade/downgrade flows
- Add trial period management

#### 5. Invitations Table
**Schema Fields:**
- id, companyId (FK cascade), email, role, token (unique), invitedBy (FK users, set null), expiresAt, acceptedAt, createdAt

**Storage Layer (DbStorage):**
- ✅ createInvitation(invitation)
- ✅ getInvitationByToken(token)
- ✅ acceptInvitation(token)

**API Endpoints:**
- ❌ No endpoints implemented

**Frontend UI:**
- ❌ No UI implemented

**TODO:**
- Create POST /api/invitations endpoint (admin can invite users to their company)
- Create GET /api/invitations/accept/:token endpoint for invitation acceptance
- Build invitation UI with email input and role selection
- Implement email sending for invitation links
- Add invitation expiration handling
- Create invitation acceptance flow with password setup

#### 6. Activity Logs Table (Audit Trail)
**Schema Fields:**
- id, companyId (FK cascade), userId (FK users, set null), action, entity, entityId, metadata (JSONB), ipAddress, userAgent, createdAt

**Storage Layer (DbStorage):**
- ✅ createActivityLog(log)
- ✅ getActivityLogsByCompany(companyId, limit)

**API Endpoints:**
- ❌ No endpoints implemented

**Frontend UI:**
- ❌ No UI implemented

**TODO:**
- Create GET /api/companies/:id/activity-logs endpoint
- Build activity log viewer UI with filtering (action, entity, date range)
- Implement automatic logging for user actions (create, update, delete)
- Add real-time activity feed
- Create detailed log entry view with metadata expansion

#### 7. API Keys Table
**Schema Fields:**
- id, companyId (FK cascade), name, key (unique), lastUsedAt, expiresAt, isActive, createdAt

**Storage Layer (DbStorage):**
- ✅ createApiKey(apiKey)
- ✅ getApiKeysByCompany(companyId)
- ✅ deleteApiKey(id)

**API Endpoints:**
- ❌ No endpoints implemented

**Frontend UI:**
- ❌ No UI implemented

**TODO:**
- Create GET/POST/DELETE endpoints for /api/companies/:id/api-keys
- Build API keys management UI
- Implement API key generation with cryptographic security
- Add API key usage tracking
- Create API key-based authentication middleware
- Implement rate limiting per API key

#### 8. Notifications Table
**Schema Fields:**
- id, userId (FK cascade), type (info|success|warning|error), title, message, link, isRead, readAt, createdAt

**Storage Layer (DbStorage):**
- ✅ createNotification(notification)
- ✅ getNotificationsByUser(userId, limit)
- ✅ markNotificationAsRead(id)

**API Endpoints:**
- ❌ No endpoints implemented

**Frontend UI:**
- ❌ No UI implemented

**TODO:**
- Create GET/PATCH endpoints for /api/notifications
- Build notification bell UI with unread count badge
- Implement notification list with mark as read functionality
- Add real-time notifications with WebSocket
- Create notification preferences UI
- Implement email notifications integration

## Security & Data Integrity TODO

### Critical Security Issues
1. **⚠️ Password Security (HIGH PRIORITY)**
   - Passwords currently stored in **plain text**
   - MUST implement bcrypt or argon2 password hashing
   - Add password strength validation
   - Implement secure password reset flow

2. **Two-Factor Authentication**
   - Implement TOTP-based 2FA
   - Add backup codes generation
   - Create 2FA setup flow in Settings

3. **Session Security**
   - Implement session rotation
   - Add device tracking
   - Create active sessions management UI
   - Implement force logout from all devices

### Data Integrity & Validation
1. **Email Verification**
   - Implement email verification flow
   - Add verification token generation
   - Create email verification UI
   - Integrate with email service

2. **Input Sanitization**
   - Add XSS protection for all text inputs
   - Implement SQL injection prevention (already using Drizzle ORM)
   - Add file upload validation for logos/avatars

3. **Rate Limiting**
   - Implement rate limiting on login endpoint
   - Add rate limiting for API endpoints
   - Create company-specific rate limits

## Recent Changes & Implementation Status

### ✅ Completed (October 2025)
- Multi-tenant schema with 8 comprehensive tables
- Full CRUD for Companies (API + UI)
- Full CRUD for Users (API + UI)
- English translation of entire UI
- Role-based access control (superadmin, admin, member, viewer)
- PostgreSQL migration from in-memory storage
- Dashboard with real-time statistics
- Session-based authentication
- Comprehensive documentation

### 🚧 In Progress
- Multi-tenant architecture refinement
- Security improvements (password hashing)
- Additional API endpoints for remaining tables

### 📋 Planned Next Steps
1. Implement password hashing (bcrypt/argon2)
2. Build Company Settings UI and API
3. Create Subscription management UI and Stripe integration
4. Implement Invitations system with email sending
5. Build Activity Logs viewer
6. Create API Keys management UI
7. Implement Notifications system with real-time updates
8. Add email verification flow
9. Implement 2FA
10. Create comprehensive deployment documentation