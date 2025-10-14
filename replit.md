# Admin Dashboard - Curbe

## Overview

This project is a modern multi-tenant admin dashboard for Curbe, designed to provide a comprehensive management solution for businesses. It supports a superadmin role capable of overseeing multiple companies, with each company having its own users assigned various roles (admin, member, viewer). The application focuses on delivering an efficient, data-rich experience with robust multi-tenant management, advanced data visualization, and a scalable full-stack architecture, drawing inspiration from leading SaaS platforms.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React 18, TypeScript, and Vite. It uses Wouter for routing and Shadcn/ui (New York style) with Radix UI for components, styled using Tailwind CSS. State management is handled by TanStack Query for server state and React hooks for local state. A custom theming system supports light/dark modes with a design aesthetic inspired by Linear and Vercel.

Key UI features:
- **Dashboard:** Displays real-time statistics, various charts (bar, donut), and recent activity.
- **Users:** Comprehensive CRUD operations for user management with role-based access and filtering.
- **Companies (Superadmin-only):** Full CRUD operations for companies, including detailed profiles and visual cards.
- **Login:** Session-based authentication with role-based access.

### Backend

The backend uses Express.js and TypeScript, offering a RESTful API. It implements session-based authentication with `express-session` and enforces role-based access control (RBAC) across all protected endpoints.

API Endpoints:
- `/api/users`: Manages users, scoped by company for admins.
- `/api/companies`: Manages companies (superadmin only).
- `/api/stats`: Provides user statistics based on access level.

### Data Models & Multi-Tenant Schema

The application uses PostgreSQL with Drizzle ORM and features a multi-tenant schema that includes:
- **Companies:** Core multi-tenant organizations.
- **Company Settings:** Per-company configurations.
- **Users:** Multi-tenant users with roles (superadmin, admin, member, viewer) and company association.
- **Subscriptions:** Manages billing and plans.
- **Invitations:** System for inviting users to companies.
- **Activity Logs:** Audit trail.
- **API Keys:** Manages programmatic access per company.
- **Notifications:** User-specific notifications.

Multi-Tenant Role-Based Access Control:
- **Superadmin:** Global system access.
- **Admin:** Manages users within their assigned company.
- **Member:** Standard user access within their company.
- **Viewer:** Read-only access within their company.

### System Design Choices

The application emphasizes clean design, efficient multi-tenant management, and data visualization. It adheres to modern UI/UX principles with a consistent design system, including custom color palettes, spacing, and elevation. Technical decisions prioritize type safety (TypeScript), performance (Vite), and accessibility (Radix UI).

## External Dependencies

- **Database:** Neon PostgreSQL (via `@neondatabase/serverless`) and Drizzle ORM.
- **UI Components:** Radix UI, Shadcn/ui, Lucide React, CMDK, Embla Carousel.
- **Form Management & Validation:** React Hook Form with Zod resolvers.
- **Styling:** Tailwind CSS, PostCSS, Autoprefixer, Class Variance Authority (CVA), `clsx`, `tailwind-merge`.
- **Session Management:** `express-session`.
- **Utilities:** `date-fns`, `nanoid`, Zod.
- **Development Tools:** TypeScript, ESBuild, TSX.