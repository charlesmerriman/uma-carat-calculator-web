/**
 * The build-time render entry (see scripts/prerender.mjs).
 *
 * `vite build --ssr src/entry-server.ts` bundles this into dist-ssr/entry-server.js,
 * and the prerender script calls `render()` once per route in PRERENDER_ROUTES to get
 * that route's HTML and <head> values. Nothing here runs in the browser.
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
 * render, or forgets `useDocumentMeta`, throws here, the script exits non-zero, and the
 * deploy fails — which beats shipping an empty page.
 */
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { StaticRouter } from "react-router-dom"
import App from "./App"
import { HeadMetaContext } from "./services/HeadMetaContext"
import type { HeadMeta } from "./services/HeadMetaContext"

export { PRERENDER_ROUTES } from "./prerenderRoutes"
export { SITE_NAME, SITE_ORIGIN } from "./hooks/useDocumentMeta"

export interface RenderResult {
	/** The markup for #root — everything inside the div, not the div itself. */
	html: string
	meta: HeadMeta
}

export function render(url: string): RenderResult {
	// A holder rather than a bare `let`: TypeScript cannot see an assignment made
	// inside the reporter closure, so narrowing on a plain variable would fail.
	const collected: { meta: HeadMeta | null } = { meta: null }

	const html = renderToString(
		createElement(
			HeadMetaContext.Provider,
			{
				value: (meta: HeadMeta) => {
					collected.meta = meta
				},
			},
			createElement(StaticRouter, { location: url }, createElement(App)),
		),
	)

	if (collected.meta === null) {
		throw new Error(`No page reported document meta for ${url}: every route must call useDocumentMeta`)
	}
	if (html.trim() === "") {
		throw new Error(`Rendered nothing for ${url}`)
	}
	return { html, meta: collected.meta }
}
