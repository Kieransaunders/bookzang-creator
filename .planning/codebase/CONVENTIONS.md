# Coding Conventions

## Overview

This document defines the coding standards and conventions for the BookZang React + TypeScript application with Convex backend.

## TypeScript Configuration

### Strictness Settings
- **Strict Mode**: Enabled (`"strict": true` in tsconfig.app.json)
- **No Fallthrough Cases**: Enabled (`"noFallthroughCasesInSwitch": true`)
- **No Unchecked Side Effect Imports**: Enabled (`"noUncheckedSideEffectImports": true`)
- **Isolated Modules**: Required by Convex and Vite

### Module System
- **Module**: ESNext
- **Module Resolution**: Bundler
- **Target**: ES2020
- **JSX**: react-jsx transform (no need to import React)

### Path Aliases
```typescript
// tsconfig.json
"paths": {
  "@/*": ["./src/*"]
}
```

Usage:
```typescript
import { Dashboard } from "@/components/Dashboard";
import { cn } from "@/lib/utils";
```

## Naming Conventions

### Components
- **PascalCase** for component names and files
- Examples: `Dashboard.tsx`, `SignInForm.tsx`, `ImportModal.tsx`

### Functions & Variables
- **camelCase** for functions, variables, and hooks
- Examples: `useState`, `handleSubmit`, `getStatusColor`

### Convex Functions
- **camelCase** for query/mutation exports
- Examples: `list`, `get`, `create`, `updateStatus`

### Type Definitions
- **PascalCase** for interfaces and types
- Examples: `ImportModalProps`, `JobDetailsDrawerProps`
- Use `type` for unions/literals, `interface` for object shapes

### Constants
- **camelCase** for runtime constants
- **SCREAMING_SNAKE_CASE** for true constants (rare)

## Import Patterns

### ES Modules
- Always use ES module syntax (`import`/`export`)
- `"type": "module"` in package.json

### Import Order
1. React and third-party libraries
2. Convex imports (api, queries, mutations)
3. Local components and utilities
4. Type imports

Example:
```typescript
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Search, Book } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";
```

### Relative vs Absolute Imports
- Use `@/` alias for imports within `src/`
- Use relative paths (`../`, `./`) for parent/sibling imports
- Use `../../convex/_generated/` for generated Convex types

## Component Patterns

### Functional Components
All components are functional using React hooks:

```typescript
// Named exports for components
export function ComponentName() {
  // hooks at the top
  const [state, setState] = useState();
  
  // handlers
  const handleAction = () => { };
  
  // render
  return <div>...</div>;
}
```

### Props Interfaces
Define props interface above the component:

```typescript
interface ImportModalProps {
  onClose: () => void;
}

export function ImportModal({ onClose }: ImportModalProps) {
  // ...
}
```

### React Hooks Usage
- Use `useState` for component state
- Use `useQuery` / `useMutation` for Convex data
- Use `useEffect` for side effects (sparingly)

### "use client" Directive
Components using client-side features include:
```typescript
"use client";
```

This is used for:
- Components using `useAuthActions`
- Any component with client-side interactivity

## Error Handling Patterns

### UI Error Handling
Use `sonner` toast notifications for user feedback:

```typescript
import { toast } from "sonner";

try {
  await someAsyncAction();
  toast.success("Success message");
} catch (error) {
  toast.error("Error message");
  console.error(error);
}
```

### Form Validation
- Validate inputs before submission
- Show inline errors or toast messages
- Disable submit buttons during loading

### Async Pattern
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  
  try {
    await mutation(args);
    toast.success("Success!");
  } catch (error) {
    toast.error("Failed");
    console.error(error);
  } finally {
    setIsLoading(false);
  }
};
```

## Type Definitions

### Convex Schema Types
Use generated types from Convex:

```typescript
import { Id } from "../../convex/_generated/dataModel";

// For document IDs
const [selectedId, setSelectedId] = useState<Id<"jobs"> | null>(null);
```

### Union Types
Use TypeScript unions for state management:

```typescript
type Page = "library" | "jobs" | "templates";
type ImportMode = "gutenberg" | "upload";

const [currentPage, setCurrentPage] = useState<Page>("library");
```

### Props with Children (when needed)
```typescript
interface Props {
  children: React.ReactNode;
}
```

## Convex-Specific Patterns

### Schema Definition
```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tableName: defineTable({
    field: v.string(),
    status: v.union(v.literal("active"), v.literal("inactive")),
  }).index("by_field", ["field"]),
});
```

### Query Patterns
```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let items = await ctx.db.query("table").order("desc").collect();
    
    if (args.search) {
      items = items.filter(item => 
        item.field.toLowerCase().includes(args.search!.toLowerCase())
      );
    }
    
    return items;
  },
});
```

### Mutation Patterns
```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    name: v.string(),
    count: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("table", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("table"),
    updates: v.object({ name: v.optional(v.string()) }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, args.updates);
  },
});
```

### Auth Integration
```typescript
import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password, Anonymous],
});

export const loggedInUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get("users", userId);
  },
});
```

## Styling Conventions

### Tailwind CSS
- Use utility classes extensively
- Custom classes in `src/index.css` for reusable patterns
- Theme extensions in `tailwind.config.js`

### Custom CSS Classes
```css
/* Component-specific utilities */
.auth-input-field { /* auth form inputs only */ }
.auth-button { /* auth form buttons only */ }
.liquid-glass { /* glassmorphism effect */ }
```

### cn() Utility
Use the `cn()` utility for conditional classes:
```typescript
import { cn } from "@/lib/utils";

className={cn(
  "base-classes",
  isActive && "active-classes",
  "hover:transition-all"
)}
```

## File Organization

### Directory Structure
```
src/
├── components/          # React components
│   ├── Dashboard.tsx
│   ├── LibraryPage.tsx
│   └── ...
├── lib/                 # Utilities
│   └── utils.ts         # cn() helper
├── main.tsx             # Entry point
├── App.tsx              # Root component
└── index.css            # Global styles

convex/
├── schema.ts            # Database schema
├── auth.ts              # Authentication
├── books.ts             # Book queries/mutations
├── jobs.ts              # Job queries/mutations
├── templates.ts         # Template queries/mutations
├── files.ts             # File storage
└── _generated/          # Auto-generated types
```

### File Naming
- Components: `PascalCase.tsx`
- Convex modules: `camelCase.ts`
- Utilities: `camelCase.ts`

## Linting & Formatting

### ESLint
- Uses `typescript-eslint` with React plugins
- No explicit config file - relies on default TypeScript-ESLint rules
- Run via: `npm run lint`

### Prettier
- Listed as devDependency
- No explicit config file - using defaults
- Expected to format on save in IDE

### Build-time Type Checking
```json
"lint": "tsc -p convex -noEmit --pretty false && tsc -p . -noEmit --pretty false && convex dev --once && vite build"
```

This command:
1. Type-checks Convex functions
2. Type-checks frontend code
3. Builds Convex
4. Builds Vite

## Best Practices

### State Management
- Use React state for local UI state
- Use Convex queries for server state
- Avoid prop drilling - use composition

### Performance
- Leverage Convex's reactive queries
- Memoize expensive computations if needed
- Use loading states for better UX

### Accessibility
- Use semantic HTML elements
- Include proper form labels
- Support keyboard navigation

### Comments
- Explain "why" not "what"
- Document complex business logic
- Keep comments up-to-date
