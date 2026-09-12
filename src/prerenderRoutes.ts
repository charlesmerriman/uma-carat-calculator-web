/**
 * Every public route that is prerendered to static HTML at build time.
 *
 * `npm run build` renders each of these through src/entry-server.tsx and writes the
 * result to dist/<route>/index.html with that route's own <title>, description,
 * canonical and social tags baked in (scripts/prerender.mjs). Anything NOT listed here
 * is served the empty shell, dist/spa.html, and rendered entirely on the client.
 *
 * Adding a public route means adding it here AND to public/sitemap.xml — a test holds
 * the two lists equal — and calling `useDocumentMeta` as the page's first statement,
 * because the build fails on a route that reports no title.
 *
 * /login and /auth/callback are deliberately absent: they are noindex plumbing, and
 * the callback is a page the browser is REDIRECTED to with a one-time code in the
 * query string, not a document anyone should be able to fetch pre-rendered.
 *
 * Kept free of React imports so the build script and node-environment tests can
 * import it without pulling in the app.
 */
export const PRERENDER_ROUTES = [
	"/",
	"/about",
	"/faq",
	"/terms",
	"/privacy-policy",
	"/changelog",
	"/feedback",
	"/guides/carat-income",
	"/app",
	"/app/timeline",
	"/app/selectors",
] as const

export type PrerenderRoute = (typeof PRERENDER_ROUTES)[number]
