/**
 * The build-time render entry (see scripts/prerender.mjs).
 *
 * `vite build --ssr src/entry-server.ts` bundles this into dist-ssr/entry-server.js,
 * and the prerender script calls `render()` once per route in PRERENDER_ROUTES to get
 * that route's HTML, <head> values and the site content it read. An Encyclopedia
 * detail page renders here too when its payload is handed over (`pageData`); the
 * build starts doing that in notes/encyclopedia-open-plan.md's PR 4. Nothing here runs
 * in the browser.
 *
 * What this does NOT import matters as much as what it does: no CSS, no font, no
 * StrictMode. The client's dist/index.html — the template the rendered HTML is
 * injected into — already carries the built stylesheet, and StrictMode changes nothing
 * about the markup a render produces.
 *
 * Written with createElement rather than JSX so it can be a .ts file: the
 * react-refresh lint rule treats any .tsx file that exports a non-component as a
 * fast-refresh hazard, and this file is a build entry that fast refresh never sees.
 *
 * Errors are deliberately allowed to escape. A route that touches `window` during
 * render, forgets `useDocumentMeta`, or reads a page the content does not hold,
 * throws here, the script exits non-zero, and the deploy fails — which beats shipping
 * an empty page.
 */
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { StaticRouter } from "react-router-dom"
import App from "./App"
import { HeadMetaContext } from "./services/HeadMetaContext"
import type { HeadMeta } from "./services/HeadMetaContext"
import { SiteContentContext } from "./services/SiteContentContext"
import { buildSiteContentValue, selectEmbedded } from "./services/siteContent"
import type { ContentKey } from "./services/siteContent"
import type { SiteContent } from "./types/siteContent"
import type { QueryClient } from "@tanstack/react-query"
import { PrimedQueryClientContext, makeQueryClient } from "./services/queryClient"
import { primeEncyclopediaPage } from "./services/encyclopediaQueries"
import { encyclopediaPageOf } from "./utils/encyclopediaRoutes"

export { PRERENDER_ROUTES } from "./prerenderRoutes"
export { SITE_NAME, SITE_ORIGIN } from "./hooks/useDocumentMeta"
// The API this bundle was built against, so the prerender script fetches content
// from the same place the bundle will. Vite inlines VITE_API_URL at build time.
export { API_URL } from "./config/apiSource"
// The Encyclopedia's detail pages: which exist, where each one's payload is, and
// where its document goes, from the same helpers the pages and their links use.
export { ENCYCLOPEDIA_INDEX_PATH, PAGE_DATA_ELEMENT_ID, encyclopediaApiPath } from "./services/encyclopediaQueries"
export { encyclopediaHref } from "./utils/encyclopediaRoutes"

export interface RenderResult {
	/** The markup for #root — everything inside the div, not the div itself. */
	html: string
	meta: HeadMeta
	/** The subset of `content` this route read, for embedding in its document. */
	content: SiteContent
}

/**
 * @param content The whole /site-content response. Required: a build without it
 *   has nothing to bake into the About page, and must not pretend otherwise.
 * @param pageData An Encyclopedia detail page's payload, as its API route
 *   answers it, when `url` is one (/app/umas/<id>, /app/cards/<id>,
 *   /app/skills/<id>); null for one the API has no page for. It goes into the
 *   query cache before the render, so the page draws itself instead of its
 *   skeleton. Left out, a detail page renders its loading state, which is
 *   never written to a document: the build only renders the pages it fetched.
 */
export function render(url: string, content: SiteContent, pageData?: unknown): RenderResult {
	// A holder rather than a bare `let`: TypeScript cannot see an assignment made
	// inside the reporter closure, so narrowing on a plain variable would fail.
	const collected: { meta: HeadMeta | null } = { meta: null }
	const keysRead = new Set<ContentKey>()
	// Strict: a page reading a row the API did not return throws, and the build
	// fails, rather than rendering its loading state into the static document.
	const siteContent = buildSiteContentValue(content, {
		strict: true,
		onRead: (key) => keysRead.add(key),
	})

	// A fresh client per render, never shared: this process renders every route.
	const page = encyclopediaPageOf(url)
	let primed: QueryClient | null = null
	if (page?.gameId != null && pageData !== undefined) {
		primed = makeQueryClient()
		primeEncyclopediaPage(primed, { kind: page.kind, gameId: page.gameId }, pageData)
	}

	const html = renderToString(
		createElement(
			HeadMetaContext.Provider,
			{
				value: (meta: HeadMeta) => {
					collected.meta = meta
				},
			},
			createElement(
				SiteContentContext.Provider,
				{ value: siteContent },
				createElement(
					PrimedQueryClientContext.Provider,
					{ value: primed },
					createElement(StaticRouter, { location: url }, createElement(App)),
				),
			),
		),
	)

	if (collected.meta === null) {
		throw new Error(`No page reported document meta for ${url}: every route must call useDocumentMeta`)
	}
	if (html.trim() === "") {
		throw new Error(`Rendered nothing for ${url}`)
	}
	return { html, meta: collected.meta, content: selectEmbedded(content, keysRead) }
}
