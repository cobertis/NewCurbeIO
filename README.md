# Admin Dashboard - Curbe

A modern, full-stack multi-tenant admin dashboard application built with React, TypeScript, Express.js, and PostgreSQL. This application features comprehensive user and company management with role-based access control, real-time statistics, and a clean, intuitive interface inspired by leading SaaS platforms like Linear and Vercel.

## 🚀 Features

### Multi-Tenant Architecture
- **Company Management**: Full CRUD operations for managing multiple companies/organizations
- **User Management**: Comprehensive user administration with role-based access control
- **Role-Based Access**: Four distinct roles (Superadmin, Admin, Member, Viewer) with granular permissions
- **Company Settings**: Customizable branding, features, email, notifications, and security settings per company
- **Subscriptions**: Billing and plan management with Stripe integration support
- **Invitations**: Invite users to companies with role assignment
- **Activity Logs**: Complete audit trail for all significant actions
- **API Keys**: Programmatic access management per company
- **Notifications**: User-specific notification system

### Core Features
- **Dashboard**: Real-time statistics, charts, and analytics
- **User Management**: Create, edit, delete users with search and filtering
- **Company Profiles**: Detailed company information including logo, website, industry, size
- **Session-based Authentication**: Secure login/logout with session persistence
- **Modern UI/UX**: Clean, responsive design with light/dark mode support
- **Data Visualization**: Interactive charts and statistics

## 🛠 Tech Stack

### Frontend
- **React 18** - UI library with hooks and functional components
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and development server
- **Wouter** - Lightweight client-side routing
- **TanStack Query (React Query)** - Server state management
- **Shadcn/ui + Radix UI** - Accessible component library
- **Tailwind CSS** - Utility-first styling
- **React Hook Form + Zod** - Form validation
- **Lucide React** - Icon system

### Backend
- **Express.js** - Web application framework
- **TypeScript** - Type-safe server development
- **PostgreSQL** - Relational database (Neon)
- **Drizzle ORM** - Type-safe database queries
- **express-session** - Session-based authentication

### Development Tools
- **ESBuild** - Fast JavaScript bundler
- **TSX** - TypeScript execution
- **Drizzle Kit** - Database migrations

## 📋 Prerequisites

- **Node.js** 18+ (for local development)
- **PostgreSQL** database (Neon or local instance)
- **npm** or **yarn** package manager

## 🔧 Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd admin-dashboard-curbe
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory (see [Environment Variables](#environment-variables) section):

```env
DATABASE_URL="postgresql://..."
SESSION_SECRET="your-secret-key-here"
NODE_ENV="development"
```

### 4. Set Up Database

Push the schema to your database:

```bash
npm run db:push
```

Or force push if you encounter issues:

```bash
npm run db:push --force
```

### 5. Seed Initial Data (Optional)

Seed the superadmin user:

```bash
tsx server/seed-admin.ts
```

This creates a superadmin user:
- **Email**: hello@curbe.io
- **Password**: Cuba2010
- **Role**: superadmin

### 6. Start Development Server

```bash
npm run dev
```

The application will be available at:
- **Frontend + Backend**: http://localhost:5000

## 🔐 Environment Variables

### Core Variables (Required for Current Features)

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | **Yes** | - |
| `SESSION_SECRET` | Secret key for session encryption (min 32 chars) | **Yes** | - |
| `NODE_ENV` | Environment mode (development/production/test) | No | development |

### Database Connection (Auto-configured from DATABASE_URL)

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PGDATABASE` | Database name | No | - |
| `PGHOST` | Database host | No | - |
| `PGPORT` | Database port | No | 5432 |
| `PGUSER` | Database user | No | - |
| `PGPASSWORD` | Database password | No | - |

### Future Integration Variables (Optional, for Planned Features)

#### Stripe (Subscription Management)
| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe API secret key (from Stripe dashboard) | No | - |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (from Stripe dashboard) | No | - |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (from webhook config) | No | - |

#### Email Service (Notifications & Invitations)
| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `SMTP_HOST` | SMTP server host | No | - |
| `SMTP_PORT` | SMTP server port | No | 587 |
| `SMTP_USER` | SMTP username | No | - |
| `SMTP_PASSWORD` | SMTP password | No | - |
| `SMTP_FROM_NAME` | Email sender name | No | Curbe Admin |
| `SMTP_FROM_EMAIL` | Email sender address | No | noreply@curbe.io |

#### Cloud Storage (File Uploads)
| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `AWS_ACCESS_KEY_ID` | AWS access key for S3 | No | - |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key for S3 | No | - |
| `AWS_REGION` | AWS region | No | us-east-1 |
| `AWS_S3_BUCKET` | S3 bucket name | No | - |

#### Production Infrastructure
| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `REDIS_URL` | Redis connection for session store | No | - |

#### Feature Flags
| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `ENABLE_ANALYTICS` | Enable analytics features | No | false |
| `ENABLE_API_ACCESS` | Enable API key access | No | false |
| `ENABLE_SSO` | Enable single sign-on | No | false |
| `ENABLE_2FA` | Enable two-factor authentication | No | false |

### Setting Up Environment Variables

1. **Copy the example file**:
   ```bash
   cp .env.example .env
   ```

2. **Configure required variables** (DATABASE_URL, SESSION_SECRET):
   ```env
   DATABASE_URL="postgresql://user:pass@host.neon.tech/db?sslmode=require"
   SESSION_SECRET="$(openssl rand -base64 32)"  # Generate strong secret
   NODE_ENV="development"
   ```

3. **Handle optional variables**:
   - **Comment out** unused optional variables with `#` to keep `.env` clean
   - **Leave blank** if you plan to add them soon
   - **Add values** only when implementing the feature:
     ```env
     # Uncomment when implementing subscriptions:
     # STRIPE_SECRET_KEY=sk_test_...
     # STRIPE_PUBLISHABLE_KEY=pk_test_...
     ```

4. **Verify environment setup**:
   ```bash
   # Check .gitignore contains .env
   grep -q "^\.env$" .gitignore && echo "✓ .env is gitignored" || echo "⚠ Add .env to .gitignore!"
   
   # Validate required variables are set
   node -e "if(!process.env.DATABASE_URL || !process.env.SESSION_SECRET) { console.error('Missing required env vars'); process.exit(1); } else { console.log('✓ Required variables set'); }"
   ```

5. **Run database migrations** after configuring DATABASE_URL:
   ```bash
   npm run db:push --force
   ```

### Security Best Practices for Environment Variables

⚠️ **Critical Security Guidelines:**

1. **Strong Secrets**
   - Use cryptographically secure random strings for SESSION_SECRET
   - Minimum 32 characters recommended
   - Generate with: `openssl rand -base64 32` or `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

2. **Secret Management**
   - **Never commit** `.env` file to version control
   - **Verify .gitignore**: Run `grep -q "^\.env$" .gitignore` to confirm `.env` is excluded
   - **Platform-specific stores** (recommended for production):
     - Replit: Use Secrets tab (automatically injected as environment variables)
     - Vercel: Environment Variables in project settings
     - Railway/Render: Environment section in dashboard
     - Heroku: Config Vars in settings
   - **Separate environments**: Use different secrets for development, staging, and production
   - **Role-based access**: Restrict who can view/edit production secrets

3. **Secret Rotation**
   - Rotate SESSION_SECRET every 90 days in production
   - Rotate API keys (Stripe, AWS) according to provider recommendations
   - Rotate database credentials periodically
   - Implement secret rotation without downtime using dual-key systems

4. **Access Control**
   - Limit who can view production secrets
   - Use role-based access for environment configuration
   - Audit secret access logs regularly

5. **Monitoring**
   - Alert on failed authentication attempts
   - Monitor for leaked credentials (GitHub secret scanning)
   - Track unusual API usage patterns

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (frontend + backend) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:push` | Push database schema changes |
| `npm run db:push -- --force` | Force push schema changes |
| `tsx server/seed-admin.ts` | Seed superadmin user |
| `tsx server/seed-test-users.ts` | Seed test users |

## 🏗 Architecture

### Multi-Tenant Data Model

The application uses a comprehensive PostgreSQL schema with 8 core tables:

#### 1. **Companies** (Organizations)
- Core multi-tenant entities
- Fields: id, name, slug (unique), domain, logo, website, industry, companySize, timezone, isActive
- One-to-many with users, settings, subscriptions

#### 2. **Company Settings**
- Per-company configuration
- Branding (primary/secondary colors)
- Features (analytics, API access, custom branding, SSO)
- Email settings
- Notification preferences
- Security settings (password requirements, session timeout, 2FA)

#### 3. **Users**
- Multi-tenant user accounts
- Fields: id, email, password, firstName, lastName, avatar, phone, role, companyId
- Roles: superadmin, admin, member, viewer
- Relationships: belongs to company, creates invitations, receives notifications

#### 4. **Subscriptions**
- Billing and plan management
- Fields: planName, planPrice, billingCycle, status, Stripe integration
- Statuses: active, cancelled, past_due, trial

#### 5. **Invitations**
- Invite users to companies
- Token-based with expiration
- Tracks inviter and acceptance status

#### 6. **Activity Logs**
- Audit trail for all actions
- Captures: action type, entity, metadata, IP address, user agent

#### 7. **API Keys**
- Programmatic access per company
- Fields: name, key, lastUsedAt, expiresAt, isActive

#### 8. **Notifications**
- User-specific notifications
- Types: info, success, warning, error
- Read/unread tracking

### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| **Superadmin** | Full system access, manages all companies and users globally |
| **Admin** | Manages users within their assigned company only |
| **Member** | Standard user access within their company |
| **Viewer** | Read-only access within their company |

### API Endpoints

#### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout  
- `GET /api/session` - Get current session

#### Users (Admin/Superadmin)
- `GET /api/users` - List users (scoped by role)
- `POST /api/users` - Create user
- `PATCH /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

#### Companies (Superadmin only)
- `GET /api/companies` - List all companies
- `POST /api/companies` - Create company
- `PATCH /api/companies/:id` - Update company
- `DELETE /api/companies/:id` - Delete company

#### Statistics
- `GET /api/stats` - Get user statistics (scoped by access level)

## 📁 Project Structure

```
admin-dashboard-curbe/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   │   └── ui/       # Shadcn/ui components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utility functions and config
│   │   ├── pages/        # Page components
│   │   │   ├── login.tsx
│   │   │   ├── dashboard.tsx
│   │   │   ├── users.tsx
│   │   │   ├── companies.tsx
│   │   │   ├── analytics.tsx
│   │   │   ├── settings.tsx
│   │   │   └── support.tsx
│   │   ├── App.tsx       # Main app component with routing
│   │   ├── index.css     # Global styles and theme
│   │   └── main.tsx      # Entry point
│   └── index.html
│
├── server/                # Backend Express application
│   ├── db.ts             # Database connection
│   ├── routes.ts         # API route definitions
│   ├── storage.ts        # Data access layer (IStorage, DbStorage)
│   ├── types.ts          # Express type augmentation
│   ├── vite.ts           # Vite middleware setup
│   ├── seed-admin.ts     # Superadmin seeding script
│   ├── seed-test-users.ts # Test users seeding script
│   └── index.ts          # Server entry point
│
├── shared/               # Shared code between client and server
│   └── schema.ts         # Database schema and Zod validation
│
├── drizzle.config.ts     # Drizzle ORM configuration
├── vite.config.ts        # Vite configuration
├── tailwind.config.ts    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies and scripts
```

## 🚀 Deployment

### Environment Configuration

1. Set environment variables for production:
   ```env
   NODE_ENV=production
   DATABASE_URL=<production-database-url>
   SESSION_SECRET=<strong-random-secret>
   ```

2. Ensure database is accessible and schema is synced:
   ```bash
   npm run db:push --force
   ```

### Build for Production

```bash
npm run build
```

This creates optimized production builds:
- Frontend: `dist/public/`
- Backend: `dist/`

### Start Production Server

```bash
npm run start
```

### Deployment Platforms

#### Replit
- Already configured with workflow "Start application"
- Automatically runs `npm run dev`
- Environment variables managed in Secrets

#### Other Platforms (Vercel, Railway, Render, etc.)
1. Configure environment variables in platform settings
2. Set build command: `npm run build`
3. Set start command: `npm run start`
4. Ensure PostgreSQL database is provisioned and accessible

## 👨‍💻 Development Guide

### Adding New Pages

1. Create page component in `client/src/pages/`
2. Register route in `client/src/App.tsx`
3. Add navigation item in `client/src/components/app-sidebar.tsx`

### Database Schema Changes

1. Modify schema in `shared/schema.ts`
2. Update storage interface in `server/storage.ts` if needed
3. Push changes: `npm run db:push --force`

### Adding API Endpoints

1. Define route in `server/routes.ts`
2. Implement storage methods in `server/storage.ts`
3. Create Zod validation schemas in `shared/schema.ts`

### Styling Guidelines

- Use Tailwind utility classes
- Follow existing color scheme (CSS variables in `client/src/index.css`)
- Use Shadcn/ui components for consistency
- Add `data-testid` attributes to interactive elements

## 🔒 Security Considerations

### ⚠️ Critical TODOs

1. **Password Hashing** (HIGH PRIORITY)
   - Currently passwords are stored in plain text
   - Implement bcrypt or argon2 hashing
   - Update login/registration flows

2. **Email Verification**
   - Implement email verification for new users
   - Send verification tokens
   - Validate email ownership

3. **Two-Factor Authentication (2FA)**
   - TOTP-based authentication
   - Backup codes
   - Recovery flow

4. **Rate Limiting**
   - Implement rate limiting on auth endpoints
   - Per-user and per-IP limits
   - API key-based rate limiting

5. **Input Sanitization**
   - XSS protection for text inputs
   - File upload validation
   - SQL injection prevention (handled by Drizzle ORM)

## 🗺 Roadmap

### Implemented ✅
- [x] Multi-tenant schema with 8 tables
- [x] User and Company CRUD with API and UI
- [x] Role-based access control
- [x] Session-based authentication
- [x] Dashboard with real-time statistics
- [x] English translation of entire UI
- [x] PostgreSQL migration

### In Progress 🚧
- [ ] Password hashing and security improvements
- [ ] Additional API endpoints for all tables
- [ ] Company settings UI and API

### Planned 📋
- [ ] Company Settings UI (branding, features, security)
- [ ] Subscription management UI and Stripe integration
- [ ] Invitations system UI with email sending
- [ ] Activity logs viewer with filtering
- [ ] API keys management UI
- [ ] Notifications UI with real-time updates
- [ ] Email verification flow
- [ ] Two-factor authentication
- [ ] Password reset functionality
- [ ] User profile editing
- [ ] Company onboarding flow
- [ ] Role-based dashboard views

## 📄 License

This project is proprietary software developed for Curbe.

## 👥 Credits

Developed with modern web technologies and best practices, inspired by design systems from Linear, Vercel, and Stripe.

---

For more detailed information, see `replit.md` for technical architecture and implementation details.
