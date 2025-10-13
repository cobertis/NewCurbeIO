# Admin Dashboard - Curbe

## Overview

This is a modern admin dashboard application built for Curbe with **multi-tenant organization management**. The application features a superadmin who manages multiple organizations, with each organization having its own users (org_admin and org_user). 

The application follows a full-stack architecture with a React-based frontend and Express.js backend, emphasizing clean design, data visualization, and efficient user management. The dashboard is inspired by modern SaaS platforms like Linear, Vercel, and Stripe, prioritizing information density, clarity, and functional efficiency.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System:**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server for fast HMR (Hot Module Replacement)
- Wouter for lightweight client-side routing instead of React Router

**UI Component System:**
- Shadcn/ui component library (New York style variant) with Radix UI primitives
- Tailwind CSS for utility-first styling with custom design tokens
- Component architecture follows composition patterns with extensive use of Radix UI for accessibility
- Custom theming system supporting both light and dark modes with CSS variables

**State Management:**
- TanStack Query (React Query) for server state management and data fetching
- Session-based authentication state managed through protected routes
- Local state using React hooks (useState, useEffect)

**Design System:**
- Custom color palette defined in CSS variables with HSL values
- Light mode primary (default) with dark mode secondary
- Design inspired by Linear/Vercel with emphasis on scannable information
- Consistent border radius, spacing, and elevation patterns
- Custom hover and active state elevations using CSS variables

**Key Pages & Features:**
- **Dashboard**: Real-time statistics from database with modern visualizations:
  - Stat cards with circular icons
  - Bar charts for monthly data
  - Highlighted feature card in vibrant blue
  - Dual donut charts for role distribution
  - Activity list with recent user actions
- **Analytics**: Metrics visualization and performance tracking (placeholder)
- **Users**: Full user management with role-based access:
  - Real-time user list from PostgreSQL
  - Search/filter by email
  - Create new users (email, password, role selection)
  - Edit users (email and role)
  - Delete users functionality
  - Role badges (Super Admin, Org Admin, Usuario)
- **Organizations** (Superadmin-only): Organization management:
  - Create/edit/delete organizations
  - Assign domain to organizations
  - Visual organization cards with icons
- **Settings**: Profile management and preferences (placeholder)
- **Support**: Help resources and contact options (placeholder)
- **Login**: Session-based authentication with role-based access

### Backend Architecture

**Server Framework:**
- Express.js with TypeScript for type-safe API development
- Session-based authentication using express-session
- Custom middleware for request logging and JSON response capture
- Vite middleware integration for development with HMR support

**API Design:**
- RESTful API endpoints under `/api` prefix
- Session-based authentication flow (login, logout, session verification)
- Protected routes requiring authenticated sessions
- Credential-based requests using `credentials: "include"`
- **User Management Endpoints**:
  - GET /api/users - List all users
  - POST /api/users - Create new user
  - PATCH /api/users/:id - Update user
  - DELETE /api/users/:id - Delete user
- **Organization Management Endpoints** (superadmin-only):
  - GET /api/organizations - List all organizations
  - POST /api/organizations - Create organization
  - PATCH /api/organizations/:id - Update organization
  - DELETE /api/organizations/:id - Delete organization

**Authentication & Authorization:**
- Session-based authentication (no JWT)
- Express-session with configurable secrets and cookie settings
- Secure cookies in production (httpOnly, secure flags)
- Session persistence with 7-day expiration
- Protected routes validated through session middleware

**Storage Layer:**
- **PostgreSQL database** with Drizzle ORM (migrated from in-memory)
- Database connection via Neon serverless driver
- Interface-based storage pattern (DbStorage implements IStorage)
- Full CRUD operations for users and organizations
- Superadmin user seeded: hello@curbe.io / Cuba2010 (role: superadmin)

**Data Models:**
- **Organizations schema** (shared/schema.ts):
  - id: varchar (UUID, auto-generated)
  - name: text (required)
  - domain: text (optional)
  - createdAt: timestamp (auto-generated)
- **Users schema** (shared/schema.ts):
  - id: varchar (UUID, auto-generated)
  - email: text (unique, required)
  - password: text (required, plain text - TODO: implement hashing)
  - role: enum (superadmin|org_admin|org_user, default: org_user)
  - organizationId: varchar (foreign key to organizations, optional for superadmin)
  - createdAt: timestamp (auto-generated)
- Zod schemas for validation (insertUserSchema, insertOrganizationSchema)
- Type-safe with TypeScript inference

**Multi-Tenant Role-Based Access Control:**
- **Superadmin**: Full system access, manages all organizations and users
- **Org Admin**: Manages users within their organization
- **Org User**: Basic dashboard access within their organization
- Authorization middleware validates user role and organization on protected endpoints

### External Dependencies

**Database (Active - PostgreSQL):**
- **Neon PostgreSQL** connected via DATABASE_URL
- Drizzle ORM for type-safe database queries
- Schema defined in `/shared/schema.ts` with pgTable
- Migrations managed with `npm run db:push`
- Seed scripts: server/seed-admin.ts, server/seed-test-users.ts

**UI Component Libraries:**
- Radix UI suite for accessible, unstyled primitives (20+ components)
- Lucide React for consistent iconography
- CMDK for command palette functionality
- Embla Carousel for carousel components
- React Hook Form with Zod resolvers for form validation

**Development Tools:**
- TypeScript with strict mode enabled
- ESBuild for production server bundling
- TSX for development server execution
- Replit-specific plugins for enhanced development experience

**Styling Dependencies:**
- Tailwind CSS with PostCSS and Autoprefixer
- Class Variance Authority (CVA) for variant-based component styling
- clsx and tailwind-merge for conditional class composition
- Custom CSS variables for theming

**Session Management:**
- express-session for server-side session handling
- connect-pg-simple prepared for PostgreSQL session storage (when migrating from in-memory)

**Utility Libraries:**
- date-fns for date manipulation and formatting
- nanoid for generating unique identifiers
- Zod for runtime type validation

## Recent Changes (October 2025)

### Completed Features

**✅ Multi-Tenant Architecture (Latest)**
- Implemented organizations table with full CRUD operations
- Updated users table with organizationId foreign key
- Migrated role system from admin/moderator/viewer to superadmin/org_admin/org_user
- Created organization management page (superadmin-only access)
- Updated sidebar to show Organizations link only to superadmin
- Role badges updated with correct colors and labels:
  - Superadmin: Red badge "Super Admin"
  - Org Admin: Blue badge "Org Admin"
  - Org User: Gray badge "Usuario"

**✅ Modern Dashboard Design**
- Rich data visualizations with stat cards and circular icons
- Improved bar charts for monthly metrics
- Highlighted feature card in vibrant blue (#2196F3)
- Dual donut charts for role distribution
- Activity list with recent user actions
- Real-time statistics from PostgreSQL database

**✅ PostgreSQL Migration**
- Migrated from in-memory storage to Neon PostgreSQL
- Updated schema with role and createdAt fields
- Implemented DbStorage class with full CRUD operations
- Created seed scripts for admin and test users
- All data now persists in database

**✅ User Management (Complete CRUD)**
- Real-time user listing from PostgreSQL
- Create users with email, password, role selection
- Edit users (email and role) with updateUserSchema validation
- Delete users functionality
- Search/filter users by email
- Spanish language interface
- All API responses sanitized (passwords excluded)

**✅ Modern UI Design**
- Clean sidebar with active state highlighting (vibrant blue #2196F3)
- Rounded buttons and borders following reference design
- Compact header with logo and user avatar
- Smooth hover states and transitions
- Consistent spacing and visual hierarchy
- Role-based menu items (Organizations visible only to superadmin)

### Known Limitations

**Security:**
- ⚠️ Passwords stored in plain text (hashing not yet implemented)
- TODO: Implement bcrypt/argon2 password hashing
- TODO: Implement password strength validation

**Future Enhancements:**
- Organization-scoped data filtering (users see only their org's data)
- Org admin permissions for managing organization users
- Add audit log for user and organization actions
- Implement session storage in PostgreSQL (currently in-memory)
- Build out Analytics, Settings, and Support pages with real functionality
- Add real-time notifications with WebSocket support
- Implement password hashing with bcrypt/argon2
- Add password strength validation