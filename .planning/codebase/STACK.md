# Technology Stack

## Overview

BookZang is a book transformation dashboard built with a modern React + Convex stack featuring a liquid glass UI design.

## Languages

| Language | Version | Purpose |
|----------|---------|---------|
| TypeScript | ~5.7.2 | Primary language for frontend and backend |
| CSS | Tailwind v3 | Styling with custom utilities |

## Runtime & Build Tools

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | ^22.13.10 | JavaScript runtime |
| Vite | ^6.2.0 | Frontend build tool and dev server |
| PostCSS | ~8 | CSS processing (with Tailwind, autoprefixer) |
| npm-run-all | ^4.1.5 | Run multiple scripts in parallel |

## Frontend Framework

| Package | Version | Purpose |
|---------|---------|---------|
| React | ^19.2.1 | UI library |
| React DOM | ^19.2.1 | React renderer for web |
| @vitejs/plugin-react | ^4.3.4 | Vite React plugin (Fast Refresh) |

## Backend Platform

| Package | Version | Purpose |
|---------|---------|---------|
| convex | ^1.31.2 | Reactive database and serverless backend |

### Convex Features Used
- **Queries**: Real-time data subscriptions (`useQuery`)
- **Mutations**: Data modifications (`useMutation`)
- **Database**: Document store with indexes
- **File Storage**: File upload/download via `ctx.storage`
- **HTTP Routes**: Custom HTTP endpoints in `convex/http.ts`

## Styling

| Package | Version | Purpose |
|---------|---------|---------|
| Tailwind CSS | ~3 | Utility-first CSS framework |
| tailwind-merge | ^3.1.0 | Merge Tailwind classes without conflicts |
| clsx | ^2.1.1 | Conditional class name utility |
| liquid-glass-react | ^1.1.1 | Glass morphism UI effects |
| autoprefixer | ~10 | PostCSS plugin for vendor prefixes |

### Tailwind Configuration
- **Config**: `tailwind.config.js`
- **Custom Colors**: primary (#3b82f6), primary-hover (#2563eb), secondary (#64748b)
- **Custom Spacing**: section (2rem)
- **Custom Border Radius**: container (0.75rem)
- **Base Color**: slate (from shadcn/ui)

### CSS Custom Properties
```css
--color-light: #ffffff
--color-dark: #171717
```

## UI Components & Icons

| Package | Version | Purpose |
|---------|---------|---------|
| lucide-react | ^0.563.0 | Icon library |
| sonner | ^2.0.3 | Toast notifications |

### shadcn/ui Setup
- **Style**: New York
- **Base Color**: Slate
- **CSS Variables**: Enabled
- **Aliases**: `@/components`, `@/lib/utils`, `@/components/ui`

### Custom CSS Classes
- `.liquid-glass` - Glass morphism effect with backdrop blur
- `.liquid-glass-strong` - Stronger glass effect
- `.auth-input-field` - Styled auth input fields
- `.auth-button` - Styled auth buttons

## TypeScript Configuration

| File | Purpose |
|------|---------|
| `tsconfig.json` | Project references |
| `tsconfig.app.json` | Frontend app config (ES2020, DOM libs) |
| `tsconfig.node.json` | Vite config (ES2022, ES2023 libs) |
| `convex/tsconfig.json` | Convex backend config |

### Key Compiler Options
- **Target**: ES2020 (app), ES2022 (node)
- **Module**: ESNext
- **Module Resolution**: bundler
- **JSX**: react-jsx
- **Path Alias**: `@/*` → `./src/*`

## Development & Linting

| Package | Version | Purpose |
|---------|---------|---------|
| eslint | ^9.21.0 | JavaScript/TypeScript linting |
| @eslint/js | ^9.21.0 | ESLint JavaScript plugin |
| typescript-eslint | ^8.24.1 | TypeScript ESLint |
| eslint-plugin-react-hooks | ^5.1.0 | React Hooks linting |
| eslint-plugin-react-refresh | ^0.4.19 | React Refresh linting |
| prettier | ^3.5.3 | Code formatting |
| globals | ^15.15.0 | Global variables |
| dotenv | ^16.4.7 | Environment variables |

## npm Scripts

```bash
# Development - runs frontend and backend in parallel
npm run dev

# Frontend only (Vite dev server with auto-open)
npm run dev:frontend

# Backend only (Convex dev server)
npm run dev:backend

# Production build (Vite)
npm run build

# Linting - type check Convex + app, build check
npm run lint
```

## Project Structure

```
├── src/                    # Frontend source
│   ├── components/         # React components
│   ├── lib/               # Utilities (cn helper)
│   ├── App.tsx            # Root component
│   ├── main.tsx           # Entry point
│   ├── index.css          # Global styles
│   ├── SignInForm.tsx     # Authentication form
│   └── SignOutButton.tsx  # Sign out button
├── convex/                # Backend source
│   ├── _generated/        # Auto-generated Convex code
│   ├── schema.ts          # Database schema
│   ├── auth.ts            # Authentication setup
│   ├── auth.config.ts     # Auth configuration
│   ├── http.ts            # HTTP routes
│   ├── router.ts          # HTTP router
│   ├── books.ts           # Book queries/mutations
│   ├── files.ts           # File storage
│   ├── jobs.ts            # Job management
│   └── templates.ts       # Template management
├── index.html             # HTML entry
├── vite.config.ts         # Vite configuration
├── tailwind.config.js     # Tailwind configuration
├── postcss.config.cjs     # PostCSS configuration
├── components.json        # shadcn/ui configuration
└── .env.local             # Environment variables
```

## Key Dependencies Summary

**Production Dependencies (8)**:
- @convex-dev/auth ^0.0.80
- convex ^1.31.2
- react ^19.2.1
- react-dom ^19.2.1
- lucide-react ^0.563.0
- sonner ^2.0.3
- liquid-glass-react ^1.1.1
- tailwind-merge ^3.1.0
- clsx ^2.1.1

**Development Dependencies (15)**:
- vite ^6.2.0
- @vitejs/plugin-react ^4.3.4
- tailwindcss ~3
- typescript ~5.7.2
- eslint ^9.21.0
- prettier ^3.5.3
- autoprefixer ~10
- postcss ~8
- npm-run-all ^4.1.5
- And various @types packages
