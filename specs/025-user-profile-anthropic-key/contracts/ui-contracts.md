# UI Contracts: User Profile & Personal Anthropic API Key

## `AuthContext` (extended)

**Location**: `frontend/src/context/AuthContext.tsx`

**Value additions**:
```ts
interface AuthContextValue {
  currentUser: AuthUser | null   // AuthUser gains createdAt: string
  hasAnthropicKey: boolean       // false until the initial GET /api/profile/anthropic-key resolves true
  isLoading: boolean
  signup: (email: string, password: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshAnthropicKeyStatus: () => Promise<void>   // called after add/update/delete in Profile
}
```

**Behavior**:
- On mount, once `GET /api/auth/me` resolves a user, also calls `GET
  /api/profile/anthropic-key` and sets `hasAnthropicKey` from `hasKey` (research.md §5).
- `logout` resets `hasAnthropicKey` to `false` alongside clearing `currentUser`.
- `refreshAnthropicKeyStatus` re-fetches the same endpoint; `ProfileScreen` calls it after
  every successful add/update/delete so the nav updates immediately (spec Acceptance
  Scenarios US2.7–8, US3.4).

## `SidebarNav` (updated)

**Location**: `frontend/src/components/layout/SidebarNav.tsx`

**Behavior**: Reads `hasAnthropicKey` from `AuthContext`. For the `Playground` and
`Metrics` `NAV_ITEMS` entries only, when `hasAnthropicKey` is `false`:
- The `<a>` renders with `aria-disabled="true"`, a muted style variant (no hover/active
  styling), and its click handler does not call `onNavigate` (a disabled nav item is
  inert, not a broken link — FR-014).
- Adds a `title` attribute (native tooltip, matches "hover... shows that user needs to add
  Anthropic key") reading: `"Add a personal Anthropic key in your Profile to use this."`

All other nav entries (Corpora, Sources, Chunking, Embeddings, Vector View) are unaffected
— gating is scoped to exactly the two screens the spec names (FR-014).

## `ProfileScreen` (new)

**Location**: `frontend/src/components/profile/ProfileScreen.tsx`

**Behavior**:
- Reads `currentUser` (email, `createdAt`) from `AuthContext` and renders them read-only
  (FR-002; no edit controls — spec Assumptions).
- A "Log out" button calling `useAuth().logout()` (FR-003).
- An Anthropic key section:
  - No key on file: an input + "Save" button. Submits to `PUT
    /api/profile/anthropic-key`. A `400`/`502`/`422` response renders inline as a
    `role="alert"` message (mirrors `LoginScreen`/`SignupScreen`'s existing error-display
    pattern) without clearing the input, so the user can correct and retry.
  - Key on file: shows the masked value (`sk-ant-...wxyz`), a "Replace" flow (same input +
    `PUT`, pre-empty — never pre-filled with the old value, since the plaintext is never
    returned), and a "Delete" button calling `DELETE /api/profile/anthropic-key` with a
    confirm step (destructive action, consistent with other delete confirmations already
    in the app, e.g. corpus/document delete).
  - On any successful save/delete, calls `refreshAnthropicKeyStatus()` so `SidebarNav`
    updates without a full page reload.

## `SidebarNav` reachability of Profile (new nav surface)

**Location**: `frontend/src/components/layout/TopBar.tsx` (existing icon-button row) or a
new item in `SidebarNav.tsx`'s `NAV_ITEMS` — implementer's choice of exact placement, but
it MUST be reachable from every authenticated screen (FR-001), consistent with how
`TopBar` already renders on every screen inside `AppShell`.

## `App.tsx` (updated)

**Location**: `frontend/src/app/App.tsx`

**Behavior**: `ScreenId` gains `'profile'`; the existing screen-switcher renders
`ProfileScreen` for it, following the same pattern as every other screen branch already
there. No change to the `AuthProvider`/`isLoading` gating already established
(024-user-authentication).
