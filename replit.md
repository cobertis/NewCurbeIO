# Admin Dashboard - Curbe

## Overview

This is a modern admin dashboard application built for Curbe, designed to manage users, analytics, and system settings. The application follows a full-stack architecture with a React-based frontend and Express.js backend, emphasizing clean design, data visualization, and efficient user management.

The dashboard is inspired by modern SaaS platforms like Linear, Vercel, and Stripe, prioritizing information density, clarity, and functional efficiency. It features a data-first approach where every UI element serves a clear purpose, with consistent patterns across all views.

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
- Dashboard: Overview with stats cards and recent activity
- Analytics: Metrics visualization and performance tracking
- Users: User management with search and role-based filtering
- Settings: Profile management and preferences
- Support: Help resources and contact options
- Login: Session-based authentication

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

**Authentication & Authorization:**
- Session-based authentication (no JWT)
- Express-session with configurable secrets and cookie settings
- Secure cookies in production (httpOnly, secure flags)
- Session persistence with 7-day expiration
- Protected routes validated through session middleware

**Storage Layer:**
- In-memory storage implementation (MemStorage class) for development
- Interface-based storage pattern (IStorage) for future database integration
- Pre-initialized admin user (hello@curbe.io / Cuba2010)
- User CRUD operations: getUser, getUserByEmail, createUser

**Data Models:**
- User schema with id (UUID), email, and password fields
- Drizzle ORM schema definitions prepared for PostgreSQL migration
- Zod schema validation for request data

### External Dependencies

**Database (Prepared for Migration):**
- Drizzle ORM configured for PostgreSQL via @neondatabase/serverless
- Schema defined in `/shared/schema.ts` with pgTable definitions
- Migration setup in place but currently using in-memory storage
- Connection string expected via DATABASE_URL environment variable

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

**Note:** The application is currently using in-memory storage for user data but has Drizzle ORM and PostgreSQL infrastructure prepared for production database migration. The session storage is also configured to support PostgreSQL session stores when needed.