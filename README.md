# Uma Carat Calculator (Web)

**Live at [umacaratcalculator.com](https://umacaratcalculator.com).** Tens of thousands of
visitors since the September 2026 launch, and dozens of Patreon supporters.

[![CI](https://github.com/charlesmerriman/uma-carat-calculator-web/actions/workflows/ci.yml/badge.svg)](https://github.com/charlesmerriman/uma-carat-calculator-web/actions/workflows/ci.yml)

The React frontend of a gacha resource planner for Uma Musume Pretty Derby. The API it talks
to is [uma-carat-calculator-api](https://github.com/charlesmerriman/uma-carat-calculator-api).

Players enter what they hold and which income applies to their account. The calculator
projects carats and tickets forward and shows what they will have on the day each banner they
plan to pull on ends, before they spend rather than after. It also plans step-up banners,
tracks which cards a selector ticket can still reach, accounts for campaign purchases, and
lays the upcoming banner and event schedule out on a timeline.

## Architecture

One site, two repositories, both deployed by DigitalOcean App Platform on every push to
`master`:

- **Web** (this repo): a React 19 + TypeScript app, built by Vite and served as a static site. Every public route is prerendered to its own HTML document at build time and hydrated in the browser, so crawlers and link previews see real content.
- **API** ([uma-carat-calculator-api](https://github.com/charlesmerriman/uma-carat-calculator-api)): Django 6 and Django REST Framework, served from the same domain under `/api`.
- **Data**: managed PostgreSQL, with banner and card images on DigitalOcean Spaces behind its CDN.
- **Accounts**: sign-in through Google, Discord or Patreon OAuth, exchanged for a DRF token. Player accounts store no email, name or password.
- **Maths**: every projection runs in the browser. The API assembles and dates the reference data, including a flat income ledger, but never computes a forecast.
- **Content**: banners, events and rewards are maintained by hand in the Django admin, which doubles as the CMS.

## About this project

- In continuous development since December 2025, live in open beta since September 2026, and actively maintained.
- The resource model follows [Henry's resource spreadsheet](https://docs.google.com/spreadsheets/d/100t3hnYl5Qm2UR8RtPlH-8Xd9KQbBlxEdXUOIR4d394/), the community reference built by Daptrius that this site grew out of. The application is my own work: the projection engine, authentication, admin and deployment.

## Tech stack

| Tool | Used for |
|---|---|
| React 19 + TypeScript | UI and type safety |
| Vite 7 | Dev server and production bundle |
| Tailwind CSS 4 | Styling |
| Framer Motion | Animation |
| react-router-dom 7 | Routing |
| react-hook-form, react-select | Forms and searchable pickers |
| Sonner | Toasts |
| date-fns | Date helpers |
| lucide-react | Icons |
| Vitest + React Testing Library | Unit, hook and component tests (jsdom) |
| ESLint + typescript-eslint | Linting |

## How it works

### One provider, one request

All server state lives in `CalculatorProvider` (`services/CalculatorProvider.tsx`). It fills
itself with a single `GET /calculator-data` on mount, and components read it through
`useCalculatorData()` with no fetch logic of their own. The auth token has exactly one owner,
`services/authToken.ts`, whose setters notify `AuthProvider`, so the navbar never offers
"Logout" to someone the server no longer recognises.

### The projection engine

The engine is entered through `hooks/useBannerResources.ts` (the per-banner rows) and
`hooks/useAverageMonthlyIncome.ts` (the income tiles above them). Both read the same engine,
so two numbers a player sees side by side cannot disagree.

The API serves every reward as one flat, dated income ledger. For each planned banner the
engine asks that ledger for the total income from today up to the banner's end date, using a
closed form per income source, then subtracts what the banners resolving before it have
already spent. Income is a pure function of a banner's end date; the order of the plan only
decides who spends first.

Date arithmetic runs in UTC through `utils/utcDates.ts`, which reproduces the source
spreadsheet's `DATEDIF`, `EOMONTH`, `WEEKDAY` and `CEILING` so the two can be checked against
each other. Step-up banners, selector tickets and campaign purchases each add their own rules;
[docs/resource-projection-logic.md](docs/resource-projection-logic.md) covers all of it.

### Guest mode and saving

No page needs an account. Guests get the full public payload, start from default stats and
plan in memory. **Sign in to save** snapshots the guest plan into `sessionStorage`, and after
the OAuth round trip the provider merges it into the account: the account's existing banners
stay, the guest's are appended, and the guest's stats are sent only if they were edited.
Signed-in changes save through a debounced `PATCH /calculator-data`, with an unload guard
while a save is in flight.

### Types

Planned banners are a discriminated union twice over: saved or local (`isSavedBanner()` /
`isLocalBanner()`), and uma, support or step-up (`plannedBannerTarget()`). Timeline events
narrow on the backend's `event_type` tag with `isRaceEvent()` / `isBannerTimeline()`. Nothing
inspects an object's shape to decide what it is.

## Routes

| Route | Page |
|---|---|
| `/` | Home |
| `/app` | The planner: current resources, pull plan, per-banner forecast |
| `/app/timeline` | Banner, event and campaign calendar |
| `/app/selectors` | Selector tickets, campaign packs and step-up card picks |
| `/faq` | Every income source, explained |
| `/guides/carat-income` | How the calculator works out your carats, in plain language |
| `/changelog` | Patch notes |
| `/feedback` | Bug reports and suggestions |
| `/about` | Who makes the site and where its numbers come from |
| `/privacy-policy`, `/terms` | Legal |
| `/login` | Sign in with Google, Discord or Patreon (`noindex`) |
| `/auth/callback` | OAuth return (`noindex`) |

Every route above except the two `noindex` ones is prerendered at build time
(`src/prerenderRoutes.ts`). Any other path is served the empty shell `dist/spa.html` and
renders `NotFound`, routed at `*` in both `App.tsx` and the nested `/app/*` routes. A static
host can't answer with a real 404, so the page states it with `noindex` instead.

## Local setup

Requires Node 24, the version `package.json` pins under `engines`. The production build and
CI both read that field.

```bash
npm install
npm run dev
```

`npm run dev` serves http://localhost:5173 against a local API on :8000, set up from the
[API repo](https://github.com/charlesmerriman/uma-carat-calculator-api#local-setup). The
committed `.env` holds only that public default; personal overrides go in `.env.local`, which
git ignores.

### Choosing a backend

```bash
npm run dev         # local Django on :8000
npm run dev:live    # the production API: real content and a real sign-in
```

`dev:live` is `vite --mode live`, which loads [.env.live](.env.live) and points
`VITE_API_URL` at the live API for that run only. A "LIVE DATA · writes are real" badge sits in
the bottom-left corner so the two modes are never confused.

Use it for frontend work that needs real content, since a fresh local database starts empty
([why](https://github.com/charlesmerriman/uma-carat-calculator-api#a-fresh-database-starts-empty)).
Sign-in works and is a real production sign-in, because the API allowlists
`http://localhost:5173/auth/callback` as an OAuth redirect. Signed in, saving a plan writes to
the live database under your own account.

### Why both modes pin port 5173

`http://localhost:5173` is an exact string in more than one place: the production CORS
allowlist, the OAuth redirect URI registered with the providers, and the redirect allowlist
that lets `dev:live` sign in. Vite's default is to slide to 5174 when 5173 is busy, which
looks fine until a request fails preflight or a sign-in returns to whatever else holds the
port. So both scripts run with `--strictPort`, and `scripts/dev-preflight.mjs` first reclaims
the port from a stale Vite belonging to this checkout. `npm run dev:stop` frees it by hand.
A `dev:live` server is the exception: it's usually a window someone is watching, signed in to
production, so all three scripts refuse to touch it and say why. `DEV_FORCE=1 npm run dev:stop`
is the deliberate override.

## Commands

```bash
npx tsc --noEmit -p tsconfig.app.json    # type-check the app
npx tsc --noEmit -p tsconfig.node.json   # type-check vite.config.ts
npm run lint
npx vitest run                           # tests (npm test starts watch mode)
npm run coverage
npm run build                            # client build + server build + prerender, all into dist/
npm run preview                          # serve dist/ on :4173 — curl /about to see a prerendered document
```

The `-p` matters: `tsconfig.json` is solution-style (`files: []`), so a bare
`npx tsc --noEmit` checks nothing. `npm run build` doesn't type-check either. CI runs both
configs, the linter and the tests on every push.

## Documentation

Deeper reference lives in [`docs/`](docs/):

- [resource-projection-logic.md](docs/resource-projection-logic.md): how the forecast is computed, from the ledger engine and pull strategy to step-ups, selector tickets and campaign purchases
- [carat-income-explained.md](docs/carat-income-explained.md): every income source in plain language. Rendered on the site at `/guides/carat-income` (imported with `?raw`), so an edit here ships to the page with the next deploy
- [state-and-guest-mode.md](docs/state-and-guest-mode.md): the provider, auto-save, guest mode, the auth token and the core types
- [ui-conventions.md](docs/ui-conventions.md): dates, styling and themes, the Timeline, and the planner layout

The data model, endpoints, auth design and income schedule are documented in the
[API repo's docs](https://github.com/charlesmerriman/uma-carat-calculator-api/tree/HEAD/docs).

## License

[MIT](LICENSE)
