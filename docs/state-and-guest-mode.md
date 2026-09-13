# State, Auto-save, and Guest Mode

How the SPA holds its data, when it saves, and how anonymous users are supported.

For the resource math itself see
[resource-projection-logic.md](resource-projection-logic.md).

---

## State management

All data lives in a **single React Context** defined in
`services/CalculatorProvider.tsx`. The provider fetches everything on mount
(`initialCalculatorDataFetch`) and exposes it via `useCalculatorData()`.

The backend's `GET /calculator-data` returns one aggregated payload — all reference data,
the user's stats, planned banners, events, and banner timelines — specifically so the
frontend does not have to make N+1 fetches.

### Loading is the consumer's business, not the provider's

The provider **always renders its children**, and publishes `isLoading` / `fetchError` on the
context instead of gating the tree itself. It used to return a bare spinner until the fetch
landed, which blanked the navbar and footer along with everything else.

`views/ApplicationViews.tsx` owns the gate now: it paints the app shell immediately and shows
the spinner in the page area alone. The routed pages (`CaratCalculator`, `Timeline`,
`Selectors`) stay behind it — they all assume their collections are populated, and nothing has
changed about that guarantee.

**Anything that renders OUTSIDE the gate must tolerate empty collections**, because while
`isLoading` is true every array on the context is still at its initial `[]` and
`userStatsData` is `null`. `Navbar` is the one such component today: its "Sign in to save"
button is disabled while loading, since stashing an empty plan would clear a guest's
already-stashed one.

### The payload is prefetched

`prefetchCalculatorData()` (`services/calculatorFetchCalls.ts`) starts the request before the
calculator is opened — on the home page during an idle callback, and on hover/focus of any
link into `/app` from outside the provider. `initialCalculatorDataFetch()` then reuses that
in-flight request rather than starting a second one.

Two guards on the reuse, both load-bearing: the prefetch is discarded if **the auth token has
changed** since it went out (otherwise a guest response — an empty plan — could be served to
someone who signed in meanwhile), and if it is **older than five minutes**. Consumers always
get a `clone()`, because a `Response` body reads only once and the provider legitimately
consumes it twice (StrictMode in dev, and the stale-token retry after a 401).

---

## Auto-save

For logged-in users, changes to user stats or planned banners trigger a **debounced PATCH
(5 s delay)** via the `useAutoSave` hook.

- Save state is surfaced through Sonner toasts.
- An `onbeforeunload` warning fires if a save is still pending.
- **Guests never arm the timer** — their plan is in-memory only.

---

## Guest mode

The app is fully usable without an account. No route requires one; signing in is only
needed to *save* a plan.

- The API returns `user_stats_data: null` for anonymous requests, and the frontend seeds
  `DEFAULT_GUEST_STATS` from that.
- Guests plan in memory. A refresh discards the plan, by design.
- A request carrying an **invalid** token still 401s even on public endpoints (DRF
  authenticates before permissions run). The frontend clears the token and retries as a
  guest.

### Guest → account migration (`services/guestMigration.ts`)

The Navbar shows a "Sign in to save" button that **snapshots the guest plan into
sessionStorage** (`guestPlanMigration.v1`, 1-hour expiry) before navigating to `/login`.

The snapshot is necessary because `CalculatorProvider` unmounts on route change — without
it the plan would simply be gone by the time the user came back.

On the next provider mount **with** a token, the stash is migrated via PATCH **before any
state is set**, so auto-save cannot race it:

- account banners are preserved (sent **with** ids),
- guest banners are appended (sent **without** ids),
- planned **purchases** follow exactly the same rule, in their own `purchases` key,
- guest stats are sent only if edited away from the defaults (`statsAreDirty`).

`purchases` is optional on `GuestPlanStash` so a stash written before the Selectors page
existed still validates — the version stays `1` because an absent key degrades to "no
purchases", which is correct rather than a reason to discard the whole plan.

The guest stash survives the OAuth round trip unchanged — sessionStorage persists across a
same-tab navigation to the provider and back — so social sign-in reuses this machinery
with no changes of its own.

---

## Social sign-in, client side

`services/socialAuth.ts`:

- `startSocialLogin(provider)` fetches the consent URL, parks
  `{provider, state, createdAt}` in sessionStorage under `oauthState.v1`, then
  `window.location.assign`s to the provider.
- `completeSocialLogin` reads and **immediately clears** that entry (single-use by
  design), compares the returned `state`, then POSTs the code.

`components/auth/OAuthCallback.tsx` drives this and **guards the exchange with a
`useRef`**. The authorization code is single-use, so StrictMode's double mount would
otherwise replay a spent code and show an error to a user who actually signed in fine.

Server-side flow, scopes, and the privacy constraints:
[../../backend/docs/auth-and-privacy.md](../../backend/docs/auth-and-privacy.md).

## Account linking, client side

`services/accountLinking.ts` attaches another provider to the account that is
**already signed in** — the same OAuth round trip against `/account/link/*`
instead of `/auth/*`, authenticated, and it never signs anyone in or creates an
account.

- `startAccountLink(provider)` parks `{provider, state, createdAt}` under
  **`accountLinkState.v1`** — deliberately a different key from sign-in's
  `oauthState.v1`, mirroring the two salts on the server. One key with a mode
  flag would be one bad branch away from finishing the wrong flow.
- `completeAccountLink` consumes that entry (single-use) and resolves to the new
  `LinkedProvider` row; a 409 passes the **server's** message through, because
  it says which conflict it was ("already linked to a different account" vs
  "this account already has a google login").
- `unlinkProvider` DELETEs. The server refuses to remove the **last** sign-in
  method of a password-less account (400, with a message); the account page
  disables the button as a courtesy, but the rule lives on the server.

`components/auth/OAuthCallback.tsx` is **shared by both flows**. At mount it asks
`peekPendingLinkProvider()` (non-consuming) — but only while `isLoggedIn`,
because a link can only have been started by someone signed in, and a parked
link in a token-less tab is stale. A link then finishes with `refresh()` and
lands on `/account`; otherwise it is the sign-in flow exactly as before. The
flow is latched in a `useState` initialiser so the error screen cannot flip to
sign-in copy after the pending entry has been consumed — this is the one
render-time storage read outside the `/app` gate, allowed because this route is
never prerendered or hydrated.

`components/account/AccountPage.tsx` (`/account`, noindex, **not** prerendered —
like `/login`) is where linking is reachable from: connected providers with
connect/disconnect, supporter status and named benefits, sign-out. A guest sees
a sign-in card, never a redirect; no route requires an account.

---

## Type system

Planned banners use a **discriminated union**:

- `SavedPlannedBanner` — has `id` (from the DB) and `user`
- `LocalPlannedBanner` — has `tempId` (client-only, before first save)

Narrow with the `isSavedBanner()` / `isLocalBanner()` type guards.

Request types use IDs (e.g. `banner_uma: number | null`); response types use nested
objects. All types live in `src/types/` and are barrel-exported from `src/types/index.ts`.

---

## Auth token and the account

Two layers, and the split matters.

### `services/authToken.ts` — owns the stored token

The **only** module that touches the `authToken` key. `getAuthToken()`,
`setAuthToken()`, `clearAuthToken()`, and `authHeaders()` (an empty object for a
guest — sending `Token null` would make the backend reject an otherwise valid
guest request).

Writes **notify subscribers**, and that is the reason the module exists rather
than being a convenience wrapper. Before it, the calculator could drop a stale
token after a 401 and nothing else found out, so the navbar carried on offering
"Logout" to someone the server no longer recognised. A `storage` listener covers
the same change made in another tab.

**Always clear through `clearAuthToken()`**, never `localStorage.removeItem`, or
`AuthProvider` keeps serving a signed-in answer.

### `services/AuthProvider.tsx` + `AuthContext.ts` — owns the account

Wraps every route in `App.tsx` (not just `/app`) because the navbar needs it on
the home page, and the Phase 3 ad loader will need it everywhere. `useAccount()`
gives:

| Value | Meaning |
|---|---|
| `isLoggedIn` | Is a token present. **Synchronous** on a normal client render. On a prerendered page it is `false` in the static HTML and during hydration (the build ran as a guest) and corrects itself in the first commit after — see the `AuthProvider` docblock. |
| `status` | `anonymous` / `loading` / `ready` / `error` — how far `GET /account` got. |
| `account` | The summary, or `null` until it loads. Includes `avatar_url`: the picture from the provider most recently signed in with, or `null` — the one profile attribute an account holds (2026-09-12). `components/account/Avatar.tsx` draws it and falls back to a handle-derived colour and initials on `null` or a broken image. |
| `isSupporter` | `account.supporter.is_supporter`, false until positively known. For gating UI use `useHasBenefit(key)` / `<SupporterOnly benefit=…>` — they key on a **benefit**, not on this flag or the tier name. |
| `refresh()` | Re-read `/account` after something that could change entitlement. |
| `signOut()` | Deletes the server-side token, then clears it locally. |

**`isLoggedIn` and `account` answer different questions on different schedules,
deliberately.** Making `isLoggedIn` wait for `/account` would flash "Login" at
every returning user on every page load; trusting the token to imply a valid
account would show a signed-in shell to someone whose token was revoked. Keeping
both is what avoids each.

**`status` is not decoration.** "We don't know yet" and "not a supporter" must
never collapse into one value: anything that has to *fail open* on uncertainty —
the ad loader — can only express that by checking `status` as well as
`isSupporter`.

**A guest makes no request.** No token means `status` goes straight to
`anonymous`. Most traffic is anonymous and must not pay for a supporter feature.

Inside async callbacks, prefer `getAuthToken()` over the context value —
`CalculatorProvider` does — because a closure wants the live answer rather than
whatever was captured when it was created.

**Guest mode is unaffected.** No route requires an account; the provider only
describes one when it exists. See "Guest mode" above.

`supporter` is real as of Phase 2: the server derives it per request from the
linked Patreon supporter row. When there is no entitlement the block is
`{ is_supporter: false }` and **nothing else** — `tier` and `benefits` are
absent rather than null, so neither can be misread as a checked-and-empty
answer.

**Gate on a benefit key, never on the tier name.** `benefits` is a list of
capability keys (`"ad_free"`, …) and the server decides which tiers earn which;
matching on `tier` would put a copy of the paywall in the bundle, free to
disagree with the real one, and would break the day a tier is renamed on
Patreon. `AuthProvider` already exposes `isSupporter` derived from
`account?.supporter.is_supporter ?? false`, which is the fail-closed default —
paired with `status`, that is what lets Phase 3's ad loader fail *open*.
