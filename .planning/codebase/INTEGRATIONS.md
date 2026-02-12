# External Integrations

## Authentication: @convex-dev/auth

**Package**: `@convex-dev/auth` ^0.0.80

### Configuration
- **Location**: `convex/auth.ts`, `convex/auth.config.ts`
- **Provider**: Convex Auth (OpenID Connect based)
- **Identity Provider**: Convex (applicationID: "convex")

### Authentication Methods

| Method | Provider | Description |
|--------|----------|-------------|
| Password | `Password` | Email/password authentication |
| Anonymous | `Anonymous` | Sign in without credentials |

### Auth Flow

```typescript
// Backend - convex/auth.ts
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password, Anonymous],
});

// Frontend - src/SignInForm.tsx
const { signIn } = useAuthActions();
await signIn("password", formData);  // Email/password
await signIn("anonymous");            // Anonymous
```

### Auth Components
- **SignInForm.tsx**: Email/password form with toggle between sign in/up
- **SignOutButton.tsx**: Sign out button with auth state check

### Auth Hooks
- `useAuthActions()` - Sign in/out actions
- `useConvexAuth()` - Authentication state
- `getAuthUserId(ctx)` - Server-side user ID retrieval

### Custom User Query
```typescript
// convex/auth.ts
export const loggedInUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const user = await ctx.db.get("users", userId);
    return user;
  },
});
```

## Backend Platform: Convex

**Package**: `convex` ^1.31.2

### Deployment
- **Project**: `knowing-malamute-729`
- **Dashboard**: https://dashboard.convex.dev/d/knowing-malamute-729
- **URL**: https://knowing-malamute-729.convex.cloud

### Database Schema

**Auth Tables** (from `@convex-dev/auth/server`):
- `users` - User accounts
- `accounts` - OAuth/link accounts
- `sessions` - Active sessions
- `verifications` - Email verification tokens

**Application Tables**:

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `books` | Imported books | title, author, gutenbergId, status, fileId |
| `jobs` | Processing jobs | type, status, bookId, progress, logs |
| `templates` | PDF templates | name, settings (fontSize, margins) |

### Indexes
- `books.by_gutenberg_id` - Lookup books by Gutenberg ID

### Convex Functions

| File | Exports | Purpose |
|------|---------|---------|
| `books.ts` | list, get, create, createFromFile, updateTemplate | Book CRUD |
| `jobs.ts` | list, get, create, updateStatus | Job management |
| `templates.ts` | list, seed | Template management |
| `files.ts` | generateUploadUrl | File storage |
| `auth.ts` | auth, signIn, signOut, store, isAuthenticated, loggedInUser | Authentication |

### Real-time Subscriptions

```typescript
// Frontend usage
const books = useQuery(api.books.list, { search: query });
const jobs = useQuery(api.jobs.list);
const user = useQuery(api.auth.loggedInUser);
```

### File Storage

**Location**: `convex/files.ts`

```typescript
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
```

- Used for uploading book files
- Files stored in Convex's built-in storage
- File IDs linked to book records (`books.fileId`)

## HTTP Routes

**File**: `convex/http.ts`

```typescript
import { auth } from "./auth";
import router from "./router";

const http = router;
auth.addHttpRoutes(http);
export default http;
```

### Routes
- Authentication routes added by `auth.addHttpRoutes(http)`
- Custom routes defined in `convex/router.ts`

### HTTP Router

**File**: `convex/router.ts`

```typescript
import { httpRouter } from "convex/server";
const http = httpRouter();
export default http;
```

## Frontend State Management

### Convex React Integration

**File**: `src/main.tsx`

```typescript
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

createRoot(document.getElementById("root")!).render(
  <ConvexAuthProvider client={convex}>
    <App />
  </ConvexAuthProvider>,
);
```

### Hooks Available
- `useQuery(api.*)` - Subscribe to real-time data
- `useMutation(api.*)` - Execute mutations
- `useAction(api.*)` - Execute actions (if defined)

## External APIs

### Project Gutenberg (Implicit)
The application imports books from Project Gutenberg based on Gutenberg ID:
- Books identified by `gutenbergId` field
- Status workflow: imported → cleaned → ready

### Chef Platform (Development)
**URL**: https://chef.convex.dev

Vite config includes a development plugin for Chef integration:
```typescript
// Enables dev tools like screenshots
// Injected only in development mode
```

## Environment Variables

**File**: `.env.local`

| Variable | Value | Purpose |
|----------|-------|---------|
| `CONVEX_DEPLOY_KEY` | `project:iConnectIT:...` | Deployment authentication |
| `CONVEX_DEPLOYMENT` | `dev:knowing-malamute-729` | Target deployment |
| `VITE_CONVEX_URL` | `https://knowing-malamute-729.convex.cloud` | Frontend API URL |

### Runtime Environment Access

**Frontend** (Vite):
```typescript
const convexUrl = import.meta.env.VITE_CONVEX_URL;
```

**Backend** (Convex):
```typescript
// Access via process.env in configuration
const siteUrl = process.env.CONVEX_SITE_URL;
```

## UI/UX Integrations

### Toast Notifications: Sonner
**Package**: `sonner` ^2.0.3

```typescript
import { Toaster } from "sonner";
import { toast } from "sonner";

toast.error("Error message");
toast.success("Success message");
```

### Icons: Lucide React
**Package**: `lucide-react` ^0.563.0

```typescript
import { Library, Briefcase, FileText, Plus } from "lucide-react";
```

Used icons:
- `Library` - Library page
- `Briefcase` - Jobs page  
- `FileText` - Templates page
- `Plus` - Add/import buttons

### Glass Effects: liquid-glass-react
**Package**: `liquid-glass-react` ^1.1.1

Custom CSS implementation based on liquid glass principles:
```css
.liquid-glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
```

## Data Flow Summary

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React Client  │────▶│  Convex Server  │────▶│  Convex DB      │
│                 │◄────│                 │◄────│  + Storage      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
       │                                               │
       │                                               │
       ▼                                               ▼
┌─────────────────┐                         ┌─────────────────┐
│  @convex-dev/   │                         │  Files stored   │
│  auth (OIDC)    │                         │  in _storage    │
└─────────────────┘                         └─────────────────┘
```

## Security Considerations

1. **Authentication**: All backend functions should verify auth via `getAuthUserId()`
2. **File Uploads**: URLs generated server-side via `ctx.storage.generateUploadUrl()`
3. **Environment**: Deployment keys in `.env.local` (not committed to repo)
4. **CORS**: Handled by Convex platform

## Monitoring & Debugging

- **Convex Dashboard**: https://dashboard.convex.dev/d/knowing-malamute-729
  - View database records
  - Monitor function logs
  - Track performance
  - Manage deployments
