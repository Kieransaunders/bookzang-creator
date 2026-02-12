# BookZang Architecture

## Overview

BookZang is a **Single Page Application (SPA)** built with React and Vite, backed by Convex as the serverless backend platform. The application enables users to import public domain books from Project Gutenberg or upload their own files, apply formatting templates, and export them as PDFs.

**Technology Stack:**
- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS
- **Backend**: Convex (serverless database + functions)
- **Authentication**: @convex-dev/auth (Password + Anonymous providers)
- **UI**: Custom components with Tailwind, Lucide icons, Sonner toasts

---

## Architecture Patterns

### 1. SPA with Convex Backend

The application follows a client-server architecture where:
- **React SPA** handles all UI rendering and user interactions
- **Convex** provides:
  - Real-time reactive database queries
  - Server-side functions (queries, mutations, actions)
  - File storage for uploaded books
  - Authentication infrastructure

### 2. Real-time Data Subscriptions

Convex's reactive queries enable automatic UI updates:
```tsx
// Components subscribe to data and re-render automatically
const books = useQuery(api.books.list, { search });
const jobs = useQuery(api.jobs.list);
const templates = useQuery(api.templates.list);
```

When data changes on the backend, all subscribed components update instantly without manual refresh.

---

## Frontend Architecture

### Entry Points

| File | Purpose |
|------|---------|
| `src/main.tsx` | Application bootstrap - creates Convex client, wraps app in `ConvexAuthProvider` |
| `src/App.tsx` | Root component - handles auth state (Authenticated/Unauthenticated), seeds templates on login |

### Component Hierarchy

```
App.tsx
├── Authenticated
│   └── Dashboard (main app shell)
│       ├── Sidebar (navigation)
│       ├── LibraryPage (book grid, search)
│       ├── JobsPage (job list, progress)
│       ├── TemplatesPage (template selection)
│       └── ImportModal (gutenberg/file import)
│           └── JobDetailsDrawer (job inspection)
└── Unauthenticated
    └── SignInForm (login/signup)
```

### Component Patterns

**Page Components** (`src/components/*Page.tsx`):
- Use `useQuery()` for data fetching
- Use `useState()` for local UI state
- Render loading spinners while data is `undefined`
- Implement empty states for no data

**Modal/Drawer Pattern**:
- `ImportModal` - Centered modal for book import
- `JobDetailsDrawer` - Slide-in drawer for job inspection
- Both use fixed positioning with backdrop blur

**Custom Hooks Pattern**:
- No custom hooks currently defined
- All state managed inline with `useState`/`useQuery`/`useMutation`

### State Management

| State Type | Tool | Usage |
|------------|------|-------|
| Server State | `useQuery`, `useMutation` | Books, jobs, templates, auth |
| Local UI State | `useState` | Modal visibility, search input, tab selection |
| Notifications | `sonner` | Success/error toast messages |

### Data Flow Pattern

```
User Action → useMutation → Convex API → Database → Reactive Update → UI Re-render
                ↑                                              ↓
            mutation call                              useQuery subscription
```

---

## Backend Architecture

### Convex Function Types

| Type | File Pattern | Use Case |
|------|--------------|----------|
| **Queries** | `export const list = query({...})` | Read-only data fetching with real-time subscriptions |
| **Mutations** | `export const create = mutation({...})` | Write operations (create, update, delete) |
| **Actions** | Not currently used | Long-running operations, external API calls |

### Module Organization (`convex/`)

| File | Domain | Functions |
|------|--------|-----------|
| `schema.ts` | Database schema | Table definitions, indexes |
| `auth.ts` | Authentication | `convexAuth` config, `loggedInUser` query |
| `books.ts` | Book management | `list`, `get`, `create`, `createFromFile`, `updateTemplate` |
| `jobs.ts` | Job queue | `list`, `get`, `create`, `updateStatus` |
| `templates.ts` | PDF templates | `list`, `seed` |
| `files.ts` | File storage | `generateUploadUrl` |
| `http.ts` | HTTP routes | Auth routes setup |
| `router.ts` | HTTP router | Base router configuration |

### Database Schema

**Core Tables:**
- `books` - Imported books with metadata (title, author, gutenbergId, status, template)
- `jobs` - Async processing jobs (import, clean, export) with progress tracking
- `templates` - PDF formatting templates (fonts, margins, line height)
- `users`, `sessions`, etc. - Auth tables from `@convex-dev/auth`

**Key Indexes:**
- `by_gutenberg_id` on books table for quick lookups

### File Storage

Uses Convex's built-in storage:
- `files.generateUploadUrl` - Creates signed upload URL
- Files stored with IDs referenced in `books.fileId`
- Supports .txt, .md, .epub uploads

---

## Authentication Flow

### Configuration
- **Provider**: `@convex-dev/auth`
- **Methods**: Password (email/password) + Anonymous
- **Session**: JWT-based, managed by Convex

### Auth Flow

```
1. User submits credentials (SignInForm.tsx)
   ↓
2. signIn("password", formData) → Convex auth endpoint
   ↓
3. Convex validates, creates session
   ↓
4. App.tsx detects auth state change (useQuery(api.auth.loggedInUser))
   ↓
5. UI switches: Unauthenticated → Authenticated → Dashboard
```

### Auth Components

| Component | Purpose |
|-----------|---------|
| `SignInForm.tsx` | Email/password form, toggle signin/signup, anonymous login |
| `SignOutButton.tsx` | Sign out action button |
| `ConvexAuthProvider` | Context wrapper in main.tsx |

---

## Key Abstractions

### 1. Liquid Glass UI

Custom Tailwind classes for frosted glass effect:
```css
.liquid-glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
```

### 2. Job System

Async processing pattern for book operations:
- Jobs have types: `import`, `clean`, `export`
- Status lifecycle: `queued` → `running` → `done`/`error`
- Progress tracking with percentage
- Logs storage for debugging

### 3. Dual Import Sources

Books can come from:
- **Project Gutenberg**: Via ID or URL
- **File Upload**: Direct upload to Convex storage

### 4. Template System

Reusable PDF formatting configurations:
- Predefined templates (Classic, Modern, Large Print)
- Settings: fontSize, lineHeight, margins
- Applied per-book via `templateId`

---

## Entry Points Summary

| Entry Point | File | Responsibility |
|-------------|------|----------------|
| HTML Entry | `index.html` | Loads Vite bundle |
| JS Entry | `src/main.tsx` | Convex client setup, auth provider |
| App Root | `src/App.tsx` | Auth gate, template seeding |
| Dashboard | `src/components/Dashboard.tsx` | Layout shell, navigation |
| Backend Entry | `convex/_generated/api.ts` | Auto-generated API client |

---

## Development Patterns

### Adding a New Feature

1. **Schema**: Add table/index to `convex/schema.ts`
2. **Backend**: Add query/mutation to `convex/{feature}.ts`
3. **Frontend**: Create component in `src/components/`
4. **Integration**: Wire up with `useQuery`/`useMutation`

### Type Safety

- Convex generates TypeScript types from schema
- `api` object provides type-safe function references
- `Id<"tablename">` type for document IDs
