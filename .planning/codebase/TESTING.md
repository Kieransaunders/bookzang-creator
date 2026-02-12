# Testing Guide

## Overview

This document describes the testing approach, patterns, and conventions for the BookZang application.

## Current Testing Status

### ⚠️ No Application Tests Present

**The BookZang application currently has no test suite.** No test files (`.test.ts`, `.spec.ts`, `.test.tsx`, `.spec.tsx`) exist in the `src/` or `convex/` directories.

The only test file found in the repository is:
- `.claude/get-shit-done/bin/gsd-tools.test.js` - An internal utility test (not part of the application)

### Test Framework Dependencies

The following testing tools are **NOT** currently installed:
- Jest
- Vitest
- React Testing Library
- @testing-library/jest-dom
- Playwright or Cypress (E2E)

## Package.json Scripts

Current scripts (no test script defined):

```json
{
  "scripts": {
    "dev": "npm-run-all --parallel dev:frontend dev:backend",
    "dev:frontend": "vite --open",
    "dev:backend": "convex dev",
    "build": "vite build",
    "lint": "tsc -p convex -noEmit --pretty false && tsc -p . -noEmit --pretty false && convex dev --once && vite build"
  }
}
```

## Type-Checking as Quality Gate

The project relies heavily on TypeScript for code quality:

### Build-time Type Checking
```bash
npm run lint
```

This performs:
1. **Convex type-checking**: `tsc -p convex -noEmit`
2. **Frontend type-checking**: `tsc -p . -noEmit`
3. **Convex build**: `convex dev --once`
4. **Vite build**: `vite build`

### TypeScript Strictness
- `strict: true` enabled
- `noUncheckedSideEffectImports: true`
- `noFallthroughCasesInSwitch: true`
- All components and functions are fully typed

## Recommended Testing Setup

### For Frontend (React Components)

**Recommended: Vitest + React Testing Library**

Why Vitest over Jest:
- Native ESM support (project uses `"type": "module"`)
- Faster execution
- Better Vite integration
- Same API as Jest

**Installation:**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Example Test Locations:**
```
src/
├── components/
│   ├── Dashboard.tsx
│   ├── Dashboard.test.tsx    # Co-located tests
│   └── __tests__/            # Alternative: test directory
│       └── Dashboard.test.tsx
```

### For Backend (Convex Functions)

**Recommended: Convex Testing Utilities**

Convex provides built-in testing support:
```bash
npm install -D @convex-dev/testing
```

**Test File Locations:**
```
convex/
├── books.ts
├── books.test.ts             # Co-located tests
├── __tests__/                # Alternative: test directory
│   └── books.test.ts
```

### For E2E Testing

**Recommended: Playwright**

For testing critical user flows:
```bash
npm install -D @playwright/test
```

**Test Location:**
```
e2e/
├── auth.spec.ts
├── import-book.spec.ts
└── export-pdf.spec.ts
```

## Recommended Testing Patterns

### Component Testing Pattern

```typescript
// src/components/SignInForm.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SignInForm } from './SignInForm';

// Mock convex auth
vi.mock('@convex-dev/auth/react', () => ({
  useAuthActions: () => ({
    signIn: vi.fn(),
  }),
}));

describe('SignInForm', () => {
  it('renders email and password inputs', () => {
    render(<SignInForm />);
    
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
  });

  it('toggles between sign in and sign up', () => {
    render(<SignInForm />);
    
    const toggleButton = screen.getByText('Sign up instead');
    fireEvent.click(toggleButton);
    
    expect(screen.getByText('Sign in instead')).toBeInTheDocument();
  });
});
```

### Convex Function Testing Pattern

```typescript
// convex/books.test.ts
import { test, expect } from "@convex-dev/testing";

test("create book", async (ctx) => {
  const bookId = await ctx.mutation(api.books.create, {
    title: "Test Book",
    author: "Test Author",
    gutenbergId: "12345",
  });
  
  const book = await ctx.query(api.books.get, { id: bookId });
  expect(book?.title).toBe("Test Book");
});
```

### Mocking Strategies

#### Mocking Convex Hooks
```typescript
vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useConvexAuth: vi.fn(() => ({ isAuthenticated: true })),
}));
```

#### Mocking API Module
```typescript
vi.mock('../../convex/_generated/api', () => ({
  api: {
    books: { list: 'books:list' },
    jobs: { create: 'jobs:create' },
  },
}));
```

#### Mocking Toast Notifications
```typescript
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));
```

## Test Coverage Approach

### Recommended Coverage Goals

| Category | Target Coverage | Priority |
|----------|----------------|----------|
| Convex Mutations | 80% | High |
| Convex Queries | 70% | High |
| React Components | 60% | Medium |
| Utility Functions | 80% | Medium |
| E2E Critical Paths | 100% | High |

### Critical Paths to Test

1. **Authentication Flow**
   - Sign in with email/password
   - Sign in anonymously
   - Sign out

2. **Book Import**
   - Import from Gutenberg (valid ID)
   - Import from Gutenberg (invalid ID)
   - File upload (valid file)
   - File upload (invalid file type/size)

3. **Job Management**
   - Create job
   - Update job status
   - View job details

4. **Template Selection**
   - List templates
   - Apply template to book

## CI/CD Testing Integration

### Recommended Workflow

Add to `package.json`:
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test"
  }
}
```

### Pre-commit Checks
```bash
#!/bin/sh
# .husky/pre-commit
npm run lint
npm run test -- --run
```

## Testing Checklist for New Features

When adding new features, ensure:

- [ ] Convex functions have unit tests
- [ ] React components have basic render tests
- [ ] User interactions are tested (if complex)
- [ ] Error states are tested
- [ ] Loading states are tested
- [ ] E2E test added for critical user flow

## Resources

### Testing Documentation
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Convex Testing Guide](https://docs.convex.dev/testing)
- [Playwright Documentation](https://playwright.dev/)

### Example Projects
- Convex examples with testing: https://github.com/get-convex/convex-helpers
- Vite + React + Vitest templates

## Next Steps to Add Testing

1. Install Vitest and testing libraries
2. Configure Vitest with Vite
3. Write first component test (SignInForm - simple, self-contained)
4. Write first Convex test (books.create)
5. Set up CI to run tests on PR
6. Gradually increase coverage
