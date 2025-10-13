# Admin Dashboard Design Guidelines

## Design Approach
**Selected System:** Modern Dashboard Design (inspired by Linear, Vercel, and Stripe dashboards)

**Rationale:** This admin dashboard requires a utility-focused, information-dense interface prioritizing efficiency, clarity, and data visualization. The design will emphasize scannable information hierarchy, consistent patterns, and minimal cognitive load.

**Core Principles:**
- Data-first: Information takes priority over decoration
- Clarity: Every element serves a functional purpose
- Efficiency: Quick access to key metrics and actions
- Consistency: Predictable patterns across all views

---

## Color Palette

### Light Mode (Primary) - Inspirado en diseño de referencia
- **Background Layers:**
  - Base: 220 20% 97% (off-white con toque azul)
  - Card/Panel: 0 0% 100% (blanco puro)
  - Hover: 220 15% 95%

- **Primary Brand:**
  - Main: 217 91% 60% (azul vibrante #2196F3)
  - Hover: 217 91% 55%
  - Light: 217 91% 90%
  - Muted: 217 50% 80%

- **Text:**
  - Primary: 220 20% 20% (casi negro con toque azul)
  - Secondary: 220 10% 50%
  - Tertiary: 220 10% 70%

- **Status Colors:**
  - Success: 142 71% 45%
  - Warning: 38 92% 50%
  - Error: 0 65% 51%
  - Info: 199 89% 48%

- **Borders:**
  - Default: 220 15% 90%
  - Hover: 220 15% 85%

### Dark Mode (Secondary)
- **Background Layers:**
  - Base: 220 25% 8%
  - Card: 220 20% 12%
  - Hover: 220 20% 16%

- **Primary Brand:** (igual que light mode)
  - Main: 217 91% 60%

- **Text:**
  - Primary: 0 0% 98%
  - Secondary: 0 0% 70%
  - Tertiary: 0 0% 50%

- **Borders:**
  - Default: 220 20% 20%
  - Hover: 220 20% 25%

---

## Typography

**Font Stack:**
- Primary: Inter (via Google Fonts CDN)
- Monospace: JetBrains Mono (for data/code)

**Scale:**
- H1: text-3xl font-semibold (Dashboard titles)
- H2: text-2xl font-semibold (Section headers)
- H3: text-lg font-medium (Card titles)
- Body: text-sm font-normal (Primary text)
- Caption: text-xs (Metadata, timestamps)
- Data: text-sm font-mono (Numbers, metrics)

**Line Height:**
- Headers: leading-tight
- Body: leading-relaxed
- Data: leading-none

---

## Layout System

**Spacing Primitives:** Use tailwind units of 2, 4, 6, 8, 12, 16
- Micro spacing (between related items): 2, 4
- Component internal: 4, 6, 8
- Section spacing: 8, 12, 16
- Major sections: 16, 24

**Grid System:**
- Container: max-w-[1600px] mx-auto
- Responsive breakpoints: sm, md, lg, xl, 2xl
- Dashboard grid: grid-cols-12 with varying spans

**Page Structure:**
```
┌─────────────────────────────────────┐
│        Header (h-16, fixed)         │
├───────┬─────────────────────────────┤
│       │                             │
│ Side  │   Main Content Area         │
│ Menu  │   (p-8, overflow-auto)      │
│ (w-64)│                             │
│       │                             │
└───────┴─────────────────────────────┘
```

---

## Component Library

### Header Component
- **Height:** h-16, fixed position
- **Background:** bg-[hsl(240,10%,5%)] with border-b border-[hsl(240,10%,15%)]
- **Content:** 
  - Left: Logo/Brand (text-xl font-semibold)
  - Center: Search bar (w-96, rounded-lg)
  - Right: Notifications icon + User profile dropdown
- **Spacing:** px-8

### Side Menu
- **Width:** w-64 (desktop), collapsible on mobile
- **Background:** bg-[hsl(240,10%,3%)] with border-r
- **Navigation Items:**
  - Height: h-10
  - Padding: px-3
  - Rounded: rounded-md
  - Active state: bg-[hsl(240,10%,12%)] + border-l-2 border-primary
  - Hover: bg-[hsl(240,10%,8%)]
  - Icon + Label layout with Heroicons
- **Sections:**
  - Dashboard overview
  - Analytics
  - Users
  - Settings
  - Support
  - Logout (bottom, accent with text-red-400)

### Dashboard Cards
- **Background:** bg-[hsl(240,10%,8%)]
- **Border:** border border-[hsl(240,10%,15%)]
- **Radius:** rounded-lg
- **Padding:** p-6
- **Shadow:** None (flat design)
- **Hover:** border-[hsl(240,10%,20%)] transition

### Stat Cards (KPI Metrics)
- **Layout:** Grid of 4 columns (lg:grid-cols-4, md:grid-cols-2)
- **Content Structure:**
  - Icon (top-left, w-10 h-10, rounded bg-primary/10)
  - Label (text-sm text-secondary)
  - Value (text-2xl font-semibold font-mono)
  - Change indicator (text-xs with ↑/↓ and color coding)
- **Spacing:** gap-6

### Data Tables
- **Background:** Alternating row colors (even: bg-[hsl(240,10%,6%)])
- **Headers:** text-xs uppercase font-medium text-secondary
- **Cell padding:** px-6 py-4
- **Borders:** border-b border-[hsl(240,10%,15%)]
- **Hover:** bg-[hsl(240,10%,10%)]
- **Actions:** Icon buttons (edit, delete) appear on row hover

### Forms & Inputs
- **Input Fields:**
  - Background: bg-[hsl(240,10%,5%)]
  - Border: border border-[hsl(240,10%,20%)]
  - Focus: ring-2 ring-primary/50
  - Padding: px-4 py-2
  - Radius: rounded-md
  - Text: text-sm
- **Labels:** text-sm font-medium mb-2
- **Buttons:**
  - Primary: bg-primary hover:bg-primary-hover px-4 py-2 rounded-md
  - Secondary: border border-primary text-primary
  - Destructive: bg-red-600 hover:bg-red-700

### Login Page
- **Layout:** Centered card on full-height page
- **Card:** 
  - Width: max-w-md
  - Background: bg-[hsl(240,10%,8%)]
  - Padding: p-8
  - Border: border border-[hsl(240,10%,15%)]
  - Shadow: Subtle glow effect
- **Content:**
  - Logo/Brand (centered, mb-8)
  - Form title "Admin Login" (text-2xl mb-6)
  - Email input (with icon)
  - Password input (with icon, toggle visibility)
  - Remember me checkbox
  - Primary button "Sign In" (w-full)
  - Error message display area
- **Background:** Subtle gradient or geometric pattern

### Charts & Data Visualization
- **Library:** Use Chart.js or Recharts via CDN
- **Colors:** Use primary palette with opacity variations
- **Style:** Line charts and bar charts with minimal gridlines
- **Background:** Transparent or matching card background

---

## Interactions & Animations

**Principle:** Minimal and purposeful - animations should enhance usability, not distract.

- **Transitions:** transition-colors duration-200 (for hover states)
- **Menu collapse:** transition-all duration-300
- **Page transitions:** None (instant navigation)
- **Loading states:** Subtle spinner or skeleton screens
- **Notifications:** Slide-in from top-right with fade

---

## Accessibility

- **Focus indicators:** ring-2 ring-primary/50 on all interactive elements
- **Color contrast:** All text meets WCAG AA standards
- **Keyboard navigation:** Full support with visible focus states
- **Screen reader:** Proper ARIA labels on all icons and interactive elements
- **Dark mode:** Consistent implementation across all components and inputs

---

## Icons

**Library:** Heroicons (via CDN)
- Menu items: 20x20 outline icons
- Stats: 24x24 outline icons
- Actions: 16x16 solid icons
- Consistent stroke width and styling