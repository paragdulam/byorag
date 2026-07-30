# UI Contracts: User Authentication & Per-User Data Ownership

## `AuthContext` / `AuthProvider` (new)

**Location**: `frontend/src/context/AuthContext.tsx`

**Value**:
```ts
interface AuthContextValue {
  currentUser: { id: string; email: string } | null
  isLoading: boolean          // true until the initial GET /api/auth/me resolves
  signup: (email: string, password: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}
```

**Behavior**:
- On mount, calls `GET /api/auth/me` (via `authApi.ts`). A `200` sets `currentUser`; a
  `401` leaves it `null`. Either way, `isLoading` becomes `false` once resolved.
- `signup`/`login` call the matching endpoint, store the returned `token` via
  `apiClient.ts`'s token storage, and set `currentUser` from the response.
- `logout` calls `POST /api/auth/logout`, clears the stored token regardless of the
  response (so a network failure never strands the user in a "still shows logged in but
  can't do anything" state), and sets `currentUser` to `null`.
- Also subscribes to `apiClient.ts`'s "got a 401" signal (research.md §6) so a
  server-invalidated session (e.g. revoked from another tab) drops the app back to
  signed-out state without waiting for the next explicit action.

## `LoginScreen` / `SignupScreen` (new)

**Location**: `frontend/src/components/auth/LoginScreen.tsx`, `SignupScreen.tsx`

**Behavior**: Each a simple email + password form with a submit button, calling
`useAuth().login`/`.signup`. A link/toggle between the two (self-service sign-up, FR-001).
Submission errors (wrong credentials, duplicate email) render a `role="alert"` message
inline — no navigation away from the form on failure.

## `App.tsx` (updated)

**Location**: `frontend/src/app/App.tsx`

**Behavior**: Wraps everything in `AuthProvider` (outermost — `CorpusProvider` and every
screen depend on an authenticated session existing before they can load anything). While
`AuthContext`'s `isLoading` is `true`, renders a minimal loading state (no flash of the
login screen before the `/api/auth/me` check resolves). Once resolved: `currentUser ===
null` renders `LoginScreen`/`SignupScreen`; otherwise renders the existing
`CorpusProvider` + screen-switcher exactly as today (FR-006 — every screen is otherwise
unchanged).

## `apiClient.ts` (new, shared)

**Location**: `frontend/src/lib/apiClient.ts`

```ts
export function apiFetch(url: string, init?: RequestInit): Promise<Response>
export function getStoredToken(): string | null
export function setStoredToken(token: string | null): void   // null clears it
export function appendTokenQueryParam(url: string): string   // for the two SSE call sites
```

**Behavior**: `apiFetch` attaches `Authorization: Bearer <token>` (from `getStoredToken()`)
to `init.headers` when a token is present, then calls `fetch`. On receiving a `401`, it
clears the stored token and notifies `AuthContext` (e.g. via a small pub/sub or a
`CustomEvent`) before resolving/rejecting as normal, so the app reacts immediately rather
than only on the next user-initiated call. `appendTokenQueryParam` is used by
`chunkingApi.ts`/`embeddingsApi.ts` when constructing their `EventSource` URLs
(research.md §5) — it does not go through `apiFetch` since `EventSource` doesn't call
`fetch` at all.

Every existing `frontend/src/lib/*Api.ts` module (`corporaApi.ts`, `sourcesApi.ts`,
`chunkingApi.ts`, `embeddingsApi.ts`, `playgroundApi.ts`, `metricsApi.ts`, and any other
direct `fetch` caller) is updated to call `apiFetch` instead of the global `fetch` — no
other change to their existing function signatures or return shapes.
