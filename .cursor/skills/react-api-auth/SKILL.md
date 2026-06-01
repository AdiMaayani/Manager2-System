---
name: react-api-auth
description: >-
  Integrate ManageR2 React apps with the ASP.NET API, JWT session storage, and
  apiRequest conventions. Use when adding fetch hooks, API clients, login flows,
  protected routes, or replacing direct fetch calls in React code.
---

# ManageR2 React API & Auth

## API base

- Dev proxy: Vite proxies `/api` → `http://localhost:5161` (see `apps/web/vite.config.ts`).
- Production: set `VITE_API_BASE_URL` env var.
- All paths match backend controllers: `/Projects`, `/WorkItems`, `/Users/login`.

## Central client

`apps/web/src/api/client.ts` exports `apiRequest<T>` and `ApiError`. All HTTP calls go through it — no raw `fetch` in components or feature hooks.

```ts
// ✅ correct
import { apiRequest } from '@api/client';
return apiRequest<ProjectListResponse>('/Projects');

// ❌ wrong
fetch('http://localhost:5161/api/Projects', ...)
```

`ApiError` has `status: number` and `responseBody: unknown`.

## Auth session

`apps/web/src/api/auth.ts` holds all session helpers. Use the same `sessionStorage` keys:

| Key | Purpose |
|-----|---------|
| `manager2_token` | JWT bearer token |
| `manager2_user` | JSON `AuthUser` profile |
| `manager2_return_url` | Post-login redirect target |

Key functions:

```ts
getAuthToken()         // → string
setAuthSession(res)    // stores token + user
clearAuthSession()     // logout cleanup
getCurrentUser()       // → AuthUser | null
ensureValidToken()     // → boolean, clears if expired
redirectToLogin()      // saves return URL, clears session, navigates /login
```

## ProtectedRoute

`apps/web/src/app/ProtectedRoute/ProtectedRoute.tsx` wraps protected routes. It:
1. Redirects to `/login` immediately if no valid token.
2. Polls every 5 s via `setInterval`; redirects with a Hebrew alert on expiry.
3. Returns `null` if token is absent (prevents flash of protected content).

```tsx
// router.tsx usage
{
  path: '/',
  element: <ProtectedRoute><AppLayout /></ProtectedRoute>,
}
```

## Feature API modules

One file per backend module under `apps/web/src/features/<domain>/api/`:

```ts
// features/projects/api/projectsApiClient.ts
import { apiRequest } from '@api/client';
import type { ProjectLifecycleResponse } from '../types';

export function getProjectLifecycleAsync(projectId: number) {
  return apiRequest<ProjectLifecycleResponse>(`/Projects/${projectId}/lifecycle`);
}
```

- Functions end with `Async`.
- Return types match backend DTO names (drop the `Dto` suffix in TS: `ProjectLifecycleResponseDto` → `ProjectLifecycleResponse`).

## Login flow

1. `POST /Users/login` via `loginUserAsync` in `features/auth/api/authApiClient.ts`.
2. On success: `setAuthSession(response)`, `clearReturnUrl()`, navigate to return URL or `/`.
3. On 401/403: show Hebrew error message; do NOT redirect (already on login page).
4. `apiRequest` auto-redirects on 401 for all other routes.

Implemented in `features/auth/hooks/useLogin.ts`.

## Data mode

`VITE_APP_DATA_MODE` in `apps/web/.env.development`:
- `local` — use `apiRequest` (default)
- `mock` — feature hooks use `@shared/mock` via `resolveDataAsync`

## Error handling in hooks

```ts
import { ApiError } from '@api/client';

try {
  const data = await getSomethingAsync();
} catch (err) {
  if (err instanceof ApiError) {
    // err.status, err.message (Hebrew from API), err.responseBody
  }
}
```

Surface `err.message` to users; log details in dev only.

## Anti-patterns

- ❌ Raw `fetch` with `localhost` in components or hooks
- ❌ Storing token in React state (sessionStorage is the source of truth)
- ❌ Skipping `ProtectedRoute` on any route that needs auth
- ❌ Duplicating 401 redirect logic — it lives only in `apiRequest`
