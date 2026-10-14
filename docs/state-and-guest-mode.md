# State, Auto-save, and Guest Mode

How the SPA holds its data, when and where it saves, and how anonymous users are supported.

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
`userStatsData` is `null`. `Navbar` is the one such component today.

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

The PATCH carries `plan_id`, the plan the banner rows were loaded from. See "Plans" below
for why it is never "whichever plan is active".

- Save state is surfaced through Sonner toasts.
- An `onbeforeunload` warning fires if a save is still pending.
- **Guests never arm the timer.** Their plan is written straight to the device on every
  change instead (see "Guest mode"), so there is nothing pending to show or warn about.
- **Which of the two a tab does is decided when it loads, not per edit.** See "A tab saves
  the way it loaded" below.
- **A row's note commits on blur, not per keystroke.** `BannerNoteEditor`
  (`components/carat-calculator/BannerNote.tsx`) keeps the text in local state while the
  person types, because every change to `userPlannedBannerData` re-arms this timer and the
  PATCH re-sends the whole row list. The note is an optional `note?: string` on the row and
  needs no mapping: `toBannerPayload` spreads the row, so autosave, the Navbar save and the
  guest's device store all carry it. `NOTE_MAX_LENGTH` (500) mirrors the API's cap, and the
  textarea's `maxLength` keeps a save from ever failing on it.
- **The odds choices ride the row the same way.** `primary_card` / `second_card`
  (optional card ids) and `primary_target` (the first card's target, 1..5; see "Two-card
  odds" in `resource-projection-logic.md`) go out through `toBannerPayload`'s spread with
  no mapping. The guest store is the one place that names them: `readBanner` rebuilds a
  row from checked fields, so it keeps the two ids only when they are real ids and the
  target only when `isTargetCopies` accepts it, and a row stored before they existed
  still loads.

---

## Plans

A signed-in account holds up to five named pull plans and the calculator shows one at a
time. **A plan is its banner rows and nothing else, plus at most a pointer to which of the
owner's stats blocks it reads.** Step-up selections belong to the account and stay put when
the plan changes. Stats, toggles and planned purchases belong to the account too, but a
plan with "separate resources" on (`income_profile_id` non-null) reads and saves its own
copy of all three, for people who plan for more than one game account. The purchases
follow the stats because they feed the same income (since 2026-09-24; before that they
were the account's under every plan). The reasoning, and why it keeps a plan safe to copy
between accounts later, is in
[../../backend/docs/data-model.md](../../backend/docs/data-model.md) ("`Plan`" and
"`IncomeProfile`").

That split is why the projection engine did not change. `useBannerResources` reads
`userPlannedBannerData`, `userStatsData` and `userPlannedPurchaseData` as it always did;
they now mean "the open plan's". The client never decides which block a plan reads:
`GET /plans/<id>` sends `user_stats_data` and `user_planned_purchase_data` beside the rows,
in the same shape either way, and `applyPlan` swaps all three in together. Either key may
be absent from an older API, and then what is on screen is kept. The save path is
unchanged because `PATCH /calculator-data` already carries the plan id beside the stats
and purchases. The Selectors page, which has no plan switcher, says whose purchases it
shows when the open plan has separate resources on.

The provider adds `plans`, `activePlanId`, `isPlanBusy` and five actions (`switchPlan`,
`createPlan`, `renamePlan`, `deletePlan`, `setSeparateIncome`).
`components/carat-calculator/PlanSwitcher.tsx` is the only UI for them and owns no logic of
its own.

### Save what is on screen before replacing it

The server deletes every banner row a save does not name, and the rows in React state are
the only copy of an unsaved edit. Every rule below follows from those two facts.

- **A save names its plan.** `userCalculatorDataPatch` takes `planId` first, and
  `performSave` passes the `activePlanId` from the same render as the rows. They are only
  ever set together (`applyPlan`), so a save cannot pair one plan's id with another's rows.

  | Time | What happens |
  |---|---|
  | 12:00:00 | edit a row in plan A, the 5 s timer starts |
  | 12:00:03 | switch to plan B |
  | 12:00:05 | without the rule: A's rows are written over B |

- **Every action flushes first.** `flushPendingSave()` runs `saveNow()` when a save is
  pending and reports whether it landed (`lastSaveOkRef`). On a failure the action stops
  and the user stays where they were, unsaved edit still on screen.
- **Rows and stats from the server are not an edit.** `applyPlan` sets the plan id, the
  rows and (when the response carries them) the stats in one tick, with
  `suppressAutoSaveRef` set so the auto-save effect skips the change it is about to cause.
  An API from before separate resources sends no stats and the ones on screen are kept. `activePlanId` is in that
  effect's deps so the effect is guaranteed to run and clear the flag; otherwise a flag
  left set would swallow the user's next real edit.
- **Staged rows are cleared on a switch.** They were being composed for the plan just left.
- **Deleting the open plan drops its pending save** (`cancelTimer` on `useAutoSave`)
  instead of firing it at an id that no longer exists. Deleting a *different* plan flushes
  as usual, because that edit is still wanted.
- **Separate resources flushes first, for the STATS.** Turning it on makes the server copy
  the stats the plan reads today, from the database. A stats edit still sitting in the
  five-second window would be missing from that copy, so `setSeparateIncome` runs
  `flushPendingSave()` before the PATCH, then refetches the plan through `planFetch` and
  `applyPlan`, the same path a switch uses. Turning it off discards the plan's own copy, so
  the switcher confirms that direction the way it confirms Delete.
- **Create makes the plan, then opens it.** The server creates plans inactive; `createPlan`
  activates it only after the flush, and a copy is taken after the flush so it includes the
  edit made two seconds ago.

`__tests__/calculatorProviderPlans.test.tsx` pins the ordering. None of these failures
throw. They lose banners.

### Guests, and an API without plans

For a guest `plans` is `[]` and `activePlanId` is `null`, and `PlanSwitcher` renders
nothing. An API from before plans existed sends neither key and gets the same treatment:
the switcher is hidden and saves omit `plan_id`, which the server reads as the account's
only plan. A guest keeps ONE plan, on the device; several plans are an account feature.
What happens to that plan at sign-in is under "Signing in with a plan on the device".

`PlanSwitcher` is a header bar in the Income & Resources style with **one tab per plan**, a
"New" button and a "..." menu for the open plan. Below `@min-[40rem]` (a container query on
the planner box, like `@banner-table:`) the tabs give way to a single dropdown, because five
names do not fit a phone. Both layouts are always in the DOM and CSS shows one, so nothing
in JS knows which is visible: each opener records what the popover should show and which
control it hangs from.

The popover is portalled to `<body>` like `CountStepper`'s pad. The planner box is
`overflow-hidden` and an `@container`, which clips even a fixed-position child, and a new
plan has no rows to make the box taller than the menu.

### Copying a shared plan

A plan's owner can switch on a link, `/app/<public_id>`, from the plan menu ("Share this
plan", `setPlanSharing` / `resetPlanLink`). **A shared plan is copied, never viewed**:
nobody but its owner ever has it on screen, so there is no read-only mode anywhere in the
provider and no save path to gate. The link opens `SharedPlanLanding` (a card, see
`ui-conventions.md`), and its one action is `copySharedPlan(publicId, name?)`. Opening the
link creates nothing; the button does. Server rules: `backend/docs/data-model.md`
("Share links").

`copySharedPlan` takes the path this tab LOADED in (`loadedAsRef`), and refuses outright
when the token has changed since, because the server picks its own path from the token on
the request and the two must agree (a guest tab whose person signed in elsewhere would
otherwise receive an account copy it cannot show; that tab is about to reload anyway).

| | Account | Guest |
|---|---|---|
| First | flushes a pending save, like `createPlan` | nothing to flush |
| Server | `POST …/copy` with the name: a new plan, created inactive | `POST …/copy` with `include_stats`: the rows (ids), and the resources (stats and purchases) if shared AND asked for |
| Then | `planActivate` + `applyPlan`, exactly as a new plan | rebuilt with `guestPlanToState`; the auto-save effect writes the device store |
| Rows | the copy's | replace the device's |
| Stats and purchases | the copy's own block seeded from the owner's stats AND purchases when shared, else the account's | replaced by the owner's (stats and purchases together) only when the guest ticked "Use their resources instead of mine" and the owner shared them |
| Notes | kept only when the owner shares them | same |
| Step-up picks | the owner's never travel | the guest's own stay |

Two details carry the invariants. The guest path writes nothing to storage itself: it sets
state and lets the guest auto-save effect write it, the same single path `resetGuestPlan`
relies on, so a blocked store is reported once, the usual way. And asking before a guest's
device plan is replaced is the CARD's job, not the provider's: it knows what the copy would
replace (rows always; stats and purchases only when the guest chose to take the owner's
resources) and asks only when one of those holds something.

Taking the owner's resources is the GUEST's choice, never automatic (owner's call,
2026-10-12): a device holds one set, so the owner sharing theirs must not cost the guest
their own. "Resources" is the stats AND the planned purchases, which travel together
because purchases fund the stats beside them (owner's call, also 2026-10-12; they were
private before). It is
enforced twice: the card sends `include_stats` only when the box is ticked and the server
sends stats only then, and the provider ignores stats it did not ask for.

---

## Guest mode

The app is fully usable without an account. No route requires one. A guest's plan is
**kept on their device**; an account is what puts a plan on every device, and what the
account-only features (several plans, separate resources, supporter perks) hang off.

- The API returns `user_stats_data: null` and empty collections for anonymous requests.
  The provider replaces them with the device's plan, or with `DEFAULT_GUEST_STATS` and
  nothing when there is none.
- **Nothing about a guest reaches the server.** No route was added for this and guest
  rows are not in the analytics.
- A request carrying an **invalid** token still 401s even on public endpoints (DRF
  authenticates before permissions run). The frontend clears the token and retries as a
  guest.

### The device store (`services/guestPlanStore.ts`)

One `localStorage` key, `guestPlan.v1`: `{ version, savedAt, stats, banners, purchases,
stepUpSelections }`. Four rules, each with a failure behind it.

- **Ids, never objects.** A planned row in state carries the whole banner. Stored, that
  object would keep the dates it had on the day of the save:

  | Day | What happens |
  |---|---|
  | Oct 1 | Guest plans a banner the API predicts ends Dec 10. |
  | Oct 20 | An editor corrects the prediction to Dec 24. |
  | Oct 21 | A stored OBJECT still says Dec 10 and shows 14 days less income. A stored ID is looked up in today's catalogue and says Dec 24. |

  So the store holds the PATCH shape (`toBannerPayload` and friends) and
  `guestPlanToState()` rebuilds the rows against the payload that was just fetched. A row
  whose banner, product or step-up has left the catalogue is dropped on its own, and a
  rank that no longer exists reads as no rank. That also protects the sign-in import:
  one id the server does not know would 400 the whole body.
- **Stats are read over the defaults**, key by key and type-checked, so a stat added after
  the plan was saved gets its default instead of arriving `undefined`.
- **Every storage call is wrapped, and a failed write is reported.** `writeGuestPlan`
  returns whether it landed. On the first failure the guest gets one toast, the context's
  `isGuestPlanStored` goes false and the navbar button's tooltip says so. The calculator carries
  on in memory.
- **Written on every change, with no timer.** A write this size is synchronous and takes
  well under a millisecond, so a closed tab never loses work. An empty plan removes the
  key.

`localStorage` is not durable: clearing site data deletes it, and Safari deletes
script-written storage after seven days without a visit. **The copy therefore says "saved
on this device", never just "saved".**

"Clear plan and start over" in the settings menu (guests only) is `resetGuestPlan()`. A
reload used to be how a guest started over.

Staged rows are still not stored anywhere, for guests or accounts.

### A tab saves the way it loaded

`CalculatorProvider` records `loadedAsRef` (`guest` or `account`) when the payload arrives
and the save path reads that, never the live token. The token is shared by every tab, so
asking "is there a token?" per edit has two wrong answers:

| Tab loaded as | In another tab | The next edit would |
|---|---|---|
| guest | they sign in | PATCH the guest's rows with no `plan_id`. The server reads that as the active plan and deletes every account row not in the body. |
| account | they sign out | write the account's rows into the device store, left behind on what may be a shared computer. |

With the mode latched a guest tab only writes the device store and an account tab only
PATCHes. When the token appears or disappears under a tab (`subscribeToAuthToken`), the tab
reloads through `services/reloadPage.ts`, a one-line module that exists so tests can mock
it.

**The device store only ever holds what was typed while signed out.** Account data is never
copied into it, including at sign-out.

### Two guest tabs

The provider subscribes to the `storage` event for the key (`subscribeToGuestPlan`), which
the browser fires in every tab except the one that wrote. A tab that hears it swaps in the
new plan, flagged with `suppressAutoSaveRef` the way `applyPlan` flags server rows so it
is not written straight back. Without this, a tab opened yesterday would write its old
plan over the work done in a newer one.

### Signing in with a plan on the device (`services/guestPlanImport.ts`)

On the first provider mount **with** a token, `importGuestPlan()` runs on the raw payload
**before any state is set**, so auto-save cannot race it.

| The account | Rows | Stats, purchases | Step-up picks |
|---|---|---|---|
| is empty (no rows or purchases, one plan) | into its plan | the guest's | the guest's |
| has data | a NEW plan, "From this device", not opened | the account's are kept | merged per banner (`mergeStepUpSelections`) |
| has data and `PLAN_CAP` plans | left on the device, one notice per tab session | kept | kept |

Rows are choices and can sit in a plan of their own without changing any number. Stats are
facts, and a device plan can be weeks older than the account's. The old rule (append to
the active plan, let edited guest stats overwrite) would add stale duplicate rows and set
the account's carats back.

- The new-plan import is two calls, `planCreate` then `userCalculatorDataPatch` with the
  new plan's id. **Purchases and stats are omitted from that PATCH (`null`), not sent
  empty**: an absent key is left alone by the server, `[]` deletes every row, and the
  purchases in hand belong to the ACTIVE plan's stats block, not the new plan's.
- If the PATCH fails after the plan was created, the empty plan is deleted so retries do
  not stack up "From this device" tabs.
- **The device copy is cleared only after the server confirms.** A 5xx or a network
  failure keeps it for the next load. A 4xx keeps it too and sets `importBlocked`, so the
  same body is not retried on every load; the next guest edit rewrites the entry without
  the flag.

**Transitional, one release:** before 2026-10 the plan was in memory and "Sign in to save"
stashed it in sessionStorage (`guestPlanMigration.v1`, `services/guestMigration.ts`).
Nothing writes that stash now, but the import still reads one, for someone who was on a
provider's consent screen while the deploy landed. Delete the stash functions and their
tests after that release. `DEFAULT_GUEST_STATS`, `statsAreDirty` and
`mergeStepUpSelections` in the same file stay.

---

## Guest teams (the PvP team builder)

PvP teams have their own provider, `services/PvpTeamsProvider.tsx` (context and
`usePvpTeams()` in `PvpTeamsContext.ts`), mounted in `AppShell` inside the calculator
provider. One provider rather than a hook per page because the PvP page's builder and the
team drawer (R2b) edit the same teams and must save through one queue.

- **Loaded on first use.** Nothing is read on `/app` load; the first consumer calls
  `ensureLoaded()` (the PvP page's My team view, later the drawer).
- **A tab saves the way it loaded**, the same rule as the plan: guest or account is decided
  once, from the token, at that first load, and latched in `modeRef`.
- **Guest:** `services/guestPvpTeamStore.ts`, localStorage key `guestPvpTeams.v1`. Ids
  only, read back field by field, one pin kept, notes capped at ten; a refused write is
  reported and toasted once per tab. A team whose event is no longer in
  `/calculator-data` is kept but not shown (filtered at read time: the first load runs
  from a child's effect in the commit that brings the events in, so filtering at load
  saw an empty list). `subscribeToGuestPvpTeams` takes another tab's
  copy. The save line says "Saved on this device".
- **Account:** the `/pvp-teams` routes (`services/pvpTeamFetchCalls.ts`). Create, rename,
  pin and delete go out at once; member and note edits mark the team dirty and are `PUT`
  1.5 s after the last edit through `useAutoSave`. A team is on screen before its `POST`
  returns: its `key` (never the server id) names it, edits made meanwhile are saved once
  the id lands, and a delete in that window deletes the server copy when it arrives. A
  refusal is toasted with the server's sentence. Never written to the device store.
- **What a team carries besides its umas and cards:** a private `name`, up to ten `notes`
  (`{text, color}`, 1000 characters each, written in `components/pvp/TeamNotes.tsx`), the pin
  (`isFocus` here, `is_focus` on the server, `focus` in the device store; at most one, set from
  the team window's selector) and `updatedAt`, the last change in ms, which picks between two
  teams for one event (`utils/pvpTeams.ts` `preferredTeam()`). All of it is the owner's alone.
- **A team copied from the gallery** goes through `createTeam` like any new team, so a
  guest's copy lands in the device store and an account's on the server. Only an account's
  team can be posted: `post` (the gallery post's public id) is always null on the device,
  and `setTeamPost` updates it after posting or taking down.
- **Signing in with teams on the device:** the first account load `POST`s each device team,
  clears the ones that landed and toasts "Your teams from this device were added to your
  account." A refused one stays on the device and is offered again next load.

The catalogue the builder draws from (`GET /pvp-catalogue`) is a module-level promise in
`pvpTeamFetchCalls.ts`, read through `hooks/usePvpCatalogue.ts`: one request per tab, made
when the builder first mounts.

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
| `account` | The summary, or `null` until it loads. Includes `avatar_url` — a supporter's first oshi while their tier covers a slot, else `null` (free accounts always get null: the picture is the perk) — `oshis` (every pick they hold) and `oshi_slots` (how many the tier covers, 0 for free), and `display_name`, the name they chose or `""`. `components/account/Avatar.tsx` draws the picture and falls back to a quiet grey silhouette on `null` or a broken image. Both preferences are written by `accountPatch()` (`PATCH /account`) from the account page, which then calls `refresh()`. |
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
