---
name: better-auth
description: |
  Better Auth - The most comprehensive authentication library for TypeScript. Use when implementing authentication flows, managing user sessions, setting up OAuth providers, email/password auth, multi-factor authentication (MFA), passkeys, organization/team support, or when working with auth clients and server handlers. Triggers: better-auth, signIn, signUp, signOut, useSession, authClient, createAuth, OAuth, MFA, passkey, organization, team
---

# Better Auth

Better Auth is a comprehensive authentication framework for TypeScript with built-in support for multiple authentication methods, sessions, and database adapters.

## Quick Reference

### Project Structure (Convex + TanStack Start)

```
convex/
├── auth.ts              # Server-side auth configuration
├── auth.config.ts       # Convex auth config provider
└── schema.ts            # Database schema (users, sessions, etc.)

src/
├── lib/
│   ├── auth-client.ts   # Client-side auth client
│   └── auth-server.ts   # Server handler for TanStack Start
├── routes/
│   └── api/auth/        # API routes for auth endpoints
└── components/          # Auth-related UI components
```

### Core Concepts

| Concept | Description | Client | Server |
|---------|-------------|--------|--------|
| `authClient` | React client for auth operations | ✅ | ❌ |
| `createAuth` | Factory for auth instance | ❌ | ✅ |
| `useSession` | Hook to get current session | ✅ | ❌ |
| `getSession` | Server-side session retrieval | ❌ | ✅ |
| `signIn` | Authenticate user | ✅ | ❌ |
| `signUp` | Register new user | ✅ | ❌ |
| `signOut` | End session | ✅ | ❌ |

## Setup & Configuration

### 1. Installation

```bash
npm install better-auth
npm install @convex-dev/better-auth  # For Convex integration
```

### 2. Environment Variables

```bash
# Required
VITE_CONVEX_URL=https://your-convex-url.convex.cloud
VITE_CONVEX_SITE_URL=https://your-site-url.convex.site
SITE_URL=http://localhost:3000  # Server-side

# Optional (for specific features)
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
RESEND_API_KEY=...  # For email verification
```

### 3. Convex Server Setup

**convex/auth.config.ts:**
```typescript
import { getAuthConfigProvider } from '@convex-dev/better-auth/auth-config'
import type { AuthConfig } from 'convex/server'

export default {
  providers: [getAuthConfigProvider()],
} satisfies AuthConfig
```

**convex/auth.ts:**
```typescript
import { betterAuth } from 'better-auth/minimal'
import { createClient } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import authConfig from './auth.config'
import { components } from './_generated/api'
import { query } from './_generated/server'
import type { GenericCtx } from '@convex-dev/better-auth'
import type { DataModel } from './_generated/dataModel'

const siteUrl = process.env.SITE_URL!

export const authComponent = createClient<DataModel>(components.betterAuth)

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    
    // Email/Password authentication
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,  // Set true for production
      autoSignInAfterRegistration: true,
    },
    
    // Social OAuth providers
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
      github: {
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      },
    },
    
    plugins: [
      convex({ authConfig }),
      // Additional plugins: organization(), passkey(), twoFactor(), etc.
    ],
  })
}

// Helper query to get current user
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await authComponent.getAuthUser(ctx)
  },
})
```

### 4. Client Setup

**src/lib/auth-client.ts:**
```typescript
import { createAuthClient } from 'better-auth/react'
import { convexClient } from '@convex-dev/better-auth/client/plugins'

export const authClient = createAuthClient({
  plugins: [convexClient()],
})

// Export commonly used methods
export const { signIn, signUp, signOut, useSession, useListAccounts } = authClient
```

### 5. Server Handler (TanStack Start)

**src/lib/auth-server.ts:**
```typescript
import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'

export const {
  handler,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthReactStart({
  convexUrl: process.env.VITE_CONVEX_URL!,
  convexSiteUrl: process.env.VITE_CONVEX_SITE_URL!,
})
```

### 6. API Routes

**src/routes/api/auth/-$.ts:**
```typescript
import { createAPIFileRoute } from '@tanstack/react-start/api'
import { handler } from '../../../lib/auth-server'

export const APIRoute = createAPIFileRoute('/api/auth/\$')({
  GET: async ({ request }) => handler(request),
  POST: async ({ request }) => handler(request),
})
```

## Core Patterns

### 1. Email/Password Authentication

**Sign Up:**
```typescript
import { authClient } from '@/lib/auth-client'

const handleSignUp = async (email: string, password: string, name: string) => {
  const { data, error } = await authClient.signUp.email({
    email,
    password,
    name,
    callbackURL: '/dashboard',  // Redirect after signup
  })
  
  if (error) {
    console.error('Signup failed:', error.message)
    return
  }
  
  // User signed up successfully
  console.log('User created:', data.user)
}
```

**Sign In:**
```typescript
const handleSignIn = async (email: string, password: string) => {
  const { data, error } = await authClient.signIn.email({
    email,
    password,
    callbackURL: '/dashboard',
    rememberMe: true,  // Persist session
  })
  
  if (error) {
    console.error('Signin failed:', error.message)
    return
  }
  
  console.log('Signed in:', data.user)
}
```

**Sign Out:**
```typescript
const handleSignOut = async () => {
  await authClient.signOut({
    callbackURL: '/',
  })
}
```

### 2. Session Management

**Use Session Hook (React):**
```typescript
import { useSession } from '@/lib/auth-client'

function UserProfile() {
  const { data: session, isPending, error } = useSession()
  
  if (isPending) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  if (!session) return <div>Not signed in</div>
  
  return <div>Welcome, {session.user.name}!</div>
}
```

**Server-Side Session:**
```typescript
// In Convex queries/mutations
import { authComponent } from '../auth'
import { query } from './_generated/server'

export const getUserWithData = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx)
    if (!user) return null
    
    // Fetch additional user data
    const profile = await ctx.db.get(user._id)
    return { user, profile }
  },
})
```

### 3. OAuth/Social Login

**Configuration:**
```typescript
// convex/auth.ts
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    // ... other config
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        redirectURI: 'http://localhost:3000/api/auth/callback/google',
      },
      github: {
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      },
      discord: {
        clientId: process.env.DISCORD_CLIENT_ID!,
        clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      },
    },
  })
}
```

**Client Usage:**
```typescript
const signInWithGoogle = () => {
  authClient.signIn.social({
    provider: 'google',
    callbackURL: '/dashboard',
  })
}

const signInWithGithub = () => {
  authClient.signIn.social({
    provider: 'github',
    callbackURL: '/dashboard',
  })
}
```

### 4. Password Reset

**Request Reset:**
```typescript
const handleForgotPassword = async (email: string) => {
  const { error } = await authClient.forgetPassword({
    email,
    redirectTo: '/reset-password',  // Page with token handler
  })
  
  if (error) {
    console.error('Failed:', error.message)
  }
}
```

**Reset Password:**
```typescript
const handleResetPassword = async (token: string, newPassword: string) => {
  const { error } = await authClient.resetPassword({
    token,
    newPassword,
  })
  
  if (error) {
    console.error('Reset failed:', error.message)
  }
}
```

### 5. Email Verification

**Configuration:**
```typescript
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPasswordEmail: async (user, url) => {
        // Send email with verification link
        await sendEmail({
          to: user.email,
          subject: 'Verify your email',
          text: `Click here: \${url}`,
        })
      },
    },
  })
}
```

**Resend Verification:**
```typescript
const resendVerification = async (email: string) => {
  await authClient.sendVerificationEmail({ email })
}
```

## Advanced Features

### 1. Organizations/Teams

**Setup:**
```typescript
import { organization } from 'better-auth/plugins'

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    plugins: [
      convex({ authConfig }),
      organization({
        allowUserToCreateOrganization: true,
        maxOrganizationsPerUser: 5,
      }),
    ],
  })
}
```

**Client Usage:**
```typescript
import { useListOrganizations, useActiveOrganization } from '@/lib/auth-client'

function OrganizationSwitcher() {
  const { data: organizations } = useListOrganizations()
  const { data: activeOrg, setActiveOrganization } = useActiveOrganization()
  
  const createOrg = async (name: string, slug: string) => {
    await authClient.organization.create({
      name,
      slug,
    })
  }
  
  const inviteMember = async (email: string, role: string) => {
    await authClient.organization.inviteMember({
      email,
      role,
    })
  }
  
  return (
    <select onChange={(e) => setActiveOrganization(e.target.value)}>
      {organizations?.map(org => (
        <option key={org.id} value={org.id}>{org.name}</option>
      ))}
    </select>
  )
}
```

### 2. Two-Factor Authentication (2FA/TOTP)

**Setup:**
```typescript
import { twoFactor } from 'better-auth/plugins'

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    plugins: [
      convex({ authConfig }),
      twoFactor({
        issuer: 'YourAppName',
      }),
    ],
  })
}
```

**Enable 2FA:**
```typescript
const enable2FA = async () => {
  const { data, error } = await authClient.twoFactor.enable()
  if (data) {
    // Show QR code to user
    console.log('QR Code URI:', data.totpURI)
    console.log('Backup codes:', data.backupCodes)
  }
}
```

**Verify TOTP:**
```typescript
const verify2FA = async (code: string) => {
  const { data, error } = await authClient.twoFactor.verifyTOTP({
    code,
    callbackURL: '/dashboard',
  })
}
```

### 3. Passkeys (WebAuthn)

**Setup:**
```typescript
import { passkey } from 'better-auth/plugins/passkey'

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    plugins: [
      convex({ authConfig }),
      passkey(),
    ],
  })
}
```

**Register Passkey:**
```typescript
const registerPasskey = async () => {
  const { data, error } = await authClient.passkey.addPasskey()
  if (error) console.error('Failed:', error.message)
}
```

**Sign In with Passkey:**
```typescript
const signInWithPasskey = async () => {
  const { data, error } = await authClient.signIn.passkey()
  if (error) console.error('Failed:', error.message)
}
```

### 4. Account Linking

```typescript
const linkAccount = async () => {
  await authClient.linkSocial({
    provider: 'github',
  })
}

// List linked accounts
const { data: accounts } = useListAccounts()
```

### 5. Session Management

**List Sessions:**
```typescript
const { data: sessions } = authClient.useListSessions()
```

**Revoke Session:**
```typescript
const revokeSession = async (token: string) => {
  await authClient.revokeSession({ token })
}

// Revoke all other sessions
const revokeOtherSessions = async () => {
  await authClient.revokeOtherSessions()
}
```

## Protected Routes

### TanStack Start Route Guard

```typescript
// src/routes/dashboard.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { authClient } from '@/lib/auth-client'

export const Route = createFileRoute('/dashboard')({
  component: DashboardComponent,
  beforeLoad: async ({ context }) => {
    const session = await authClient.getSession()
    
    if (!session.data) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
    
    return { user: session.data.user }
  },
})

function DashboardComponent() {
  const { user } = Route.useRouteContext()
  return <div>Welcome, {user.name}!</div>
}
```

### React Component Guard

```typescript
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()
  
  useEffect(() => {
    if (!isPending && !session) {
      navigate({ to: '/login' })
    }
  }, [session, isPending, navigate])
  
  if (isPending) return <LoadingSpinner />
  if (!session) return null
  
  return <>{children}</>
}
```

## Error Handling

```typescript
const handleAuth = async () => {
  const { data, error } = await authClient.signIn.email({
    email: 'user@example.com',
    password: 'password',
  })
  
  if (error) {
    switch (error.code) {
      case 'invalid_credentials':
        showToast('Invalid email or password')
        break
      case 'email_not_verified':
        showToast('Please verify your email first')
        break
      case 'user_not_found':
        showToast('No account found with this email')
        break
      default:
        showToast(error.message)
    }
    return
  }
  
  // Success
  navigate({ to: '/dashboard' })
}
```

## Best Practices

1. **Always use HTTPS** in production for auth endpoints
2. **Set `requireEmailVerification: true`** for production apps
3. **Implement proper error handling** for all auth operations
4. **Use `rememberMe`** option based on user preference
5. **Store sensitive config** in environment variables
6. **Implement rate limiting** on auth endpoints
7. **Use strong password policies** (min length, complexity)
8. **Enable 2FA** for sensitive operations
9. **Regularly rotate** OAuth client secrets
10. **Log auth events** for security monitoring

## Common Validators

Better Auth handles these automatically with Convex adapter:

| Table | Purpose |
|-------|---------|
| `users` | User accounts |
| `sessions` | Active sessions |
| `accounts` | Linked OAuth accounts |
| `verifications` | Email verification tokens |
| `twoFactors` | 2FA settings |
| `passkeys` | WebAuthn credentials |
| `organizations` | Teams/organizations |
| `members` | Organization memberships |
| `invitations` | Organization invites |

## References

- [Better Auth Docs](https://www.better-auth.com/)
- [Better Auth GitHub](https://github.com/better-auth/better-auth)
- [@convex-dev/better-auth](https://www.npmjs.com/package/@convex-dev/better-auth)
- Supported OAuth providers: Google, GitHub, Discord, Twitter, Apple, Microsoft, Facebook, and more
