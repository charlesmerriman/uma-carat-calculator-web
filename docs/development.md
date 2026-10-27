# Development

Local setup, commands, routes and the build. The [README](../README.md) has the overview.

## Local setup

Requires Node 24, the version `package.json` pins under `engines`. The production build and
CI both read that field.

```bash
npm install
npm run dev
```

`npm run dev` serves http://localhost:5173 against a local API on :8000, set up from the
[API repo](https://github.com/charlesmerriman/uma-carat-calculator-api/blob/HEAD/docs/development.md).
The committed `.env` holds only that public default; personal overrides go in `.env.local`,
which git ignores.

### Choosing a backend

```bash
npm run dev         # local Django on :8000
npm run dev:live    # the production API: real content and a real sign-in
```

`dev:live` is `vite --mode live`, which loads [.env.live](../.env.live) and points
`VITE_API_URL` at the live API for that run only. A "LIVE DATA · writes are real" badge sits in
the bottom-left corner so the two modes are never confused.

Use it for frontend work that needs real content, since a fresh local database starts empty
([why](https://github.com/charlesmerriman/uma-carat-calculator-api/blob/HEAD/docs/development.md#local-content)).
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
npm run typecheck                        # tsc on both projects (app and vite config)
npm run lint
npm run knip                             # unused files, exports and dependencies
npx vitest run                           # tests (npm test starts watch mode)
npm run check                            # all four, before a PR
npm run coverage
npm run build                            # client build + server build + prerender, all into dist/
PRERENDER_CONTENT=snapshot npm run build # the same, prerendering from src/content/snapshot.json (no API needed)
npm run content:pull                     # refresh that snapshot from the live API
npm run preview                          # serve dist/ on :4173; curl /about to see a prerendered document
```

`npm run typecheck` passes `-p` for a reason: `tsconfig.json` is solution-style
(`files: []`), so a bare `npx tsc --noEmit` checks nothing. `npm run build` doesn't type-check
either. CI runs the type check, the linter and the tests on every push to `develop` and
`master`.

knip treats an export used only inside its own file as fine (`ignoreExportsUsedInFile` in
[knip.json](../knip.json)); anything exported and used nowhere fails the check.

## Routes

| Route | Page |
|---|---|
| `/` | Home |
| `/app` | The planner: current resources, pull plan, per-banner forecast |
| `/app/timeline` | Banner, event and campaign calendar |
| `/app/selectors` | Selector tickets, campaign packs and step-up card picks |
| `/app/legend-races` | Daily legend races |
| `/app/pvp` | PvP guides, the team planner and the gallery |
| `/app/<public_id>` | A shared plan's landing page (not prerendered) |
| `/app/collection` | Your veterans (each one's card: stats, aptitudes, skills, sparks, lineage, deck, career), umas and support cards (account only, `noindex`, not prerendered) |
| `/faq` | Every income source, explained |
| `/changelog` | Patch notes |
| `/feedback` | Bug reports and suggestions |
| `/about` | Who makes the site and where its numbers come from |
| `/privacy-policy`, `/terms` | Legal |
| `/login` | Sign in with Google, Discord or Patreon (`noindex`) |
| `/account` | Display name, favorite umas, sign-in methods, supporter status, gallery posts, sign out, delete account (`noindex`) |
| `/auth/callback` | OAuth return (`noindex`) |

The prerendered routes are listed in `src/prerenderRoutes.ts`. Any other path is served the
empty shell `dist/spa.html` and renders `NotFound`, routed at `*` in both `App.tsx` and the
nested `/app/*` routes. A static host can't answer with a real 404, so the page states it with
`noindex` instead.

## Site content at build time

The About page and the FAQ are not in this repo. They are rows the team edits in the API's
admin, served by `GET /site-content`. The prerender fetches that endpoint from the API the
bundle was built against (`VITE_API_URL`) and bakes the words into each document, then embeds
the rows a page used in a `<script id="site-content">` block so hydration matches. A build that
cannot reach the API fails on purpose.

`PRERENDER_CONTENT=snapshot` prerenders from the committed `src/content/snapshot.json`
instead. CI's build step sets it, and so should a local build with no API running. The
snapshot also feeds the tests; `npm run content:pull` refreshes it from the live API. Drift is
harmless, since production never reads it.
