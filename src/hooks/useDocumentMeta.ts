import { useContext, useEffect } from "react"
import { useLocation } from "react-router-dom"
import { HeadMetaContext } from "../services/HeadMetaContext"

/**
 * Per-route <title>, description, canonical and robots tags.
 *
 * Every public route is prerendered to its own HTML document at build time
 * (src/prerenderRoutes.ts, scripts/prerender.mjs), so a crawler or a link unfurler
 * fetching /about gets About's tags without running any JavaScript. This hook is
 * where those tags come from, in both places they are needed:
 *
 *   - At build time, `renderToString` runs no effects, so the hook reports its values
 *     through HeadMetaContext and the prerender script writes them into the document.
 *   - In the browser, the effect below writes the same values onto the live <head> —
 *     which is what keeps them right across client-side navigation, where no new
 *     document is ever fetched.
 *
 * Deliberately not react-helmet-async. That earns its place when titles are
 * dynamic and numerous (a page per record); here the route set is fixed and
 * small, and this is the whole implementation.
 *
 * A route that never calls this hook fails the build ("No page reported document
 * meta"), which is the point: the old failure mode was a page silently inheriting
 * whatever the previously visited route had set.
 */

export const SITE_NAME = "Uma Musume Carat Calculator"

/**
 * Canonical origin, hardcoded rather than read from window.location.
 *
 * App Platform keeps serving this same bundle on its generated
 * `umamusme-calculator-7zdcg.ondigitalocean.app` hostname, and that hostname
 * cannot be switched off. While the canonical was built from
 * `window.location.origin`, every page served there declared ITSELF canonical,
 * so Google saw two complete and equally authoritative copies of the site
 * competing with one another. A constant makes the DigitalOcean host point its
 * canonical at the real domain, which is what consolidates them.
 *
 * This reverses an earlier deliberate choice. Runtime origin was correct while
 * the custom domain was still pending — it meant the move could not break the
 * tags. The move is done, so the property that mattered then is now the bug.
 *
 * NOTE: does NOT survive a domain move. Update it together with
 * public/robots.txt, public/sitemap.xml, and the og:url / og:image /
 * twitter:image tags in index.html.
 */
export const SITE_ORIGIN = "https://umacaratcalculator.com"

/**
 * Finds a <head> tag or creates it, so we reuse the tags already present in
 * index.html rather than appending a duplicate on first navigation. Two
 * <meta name="description"> tags is not a crash, but which one wins is not
 * something worth leaving to the parser.
 */
function upsertTag<T extends HTMLElement>(
	selector: string,
	create: () => T,
): T {
	const existing = document.head.querySelector<T>(selector)
	if (existing) return existing

	const created = create()
	document.head.appendChild(created)
	return created
}

export function useDocumentMeta(
	/** Page name alone; the site name is appended. Pass null for the homepage,
	 *  which should title as the site itself rather than "Home | ...". */
	title: string | null,
	description: string,
	/** Keeps a page out of search results. For pages that are plumbing rather
	 *  than content. This tag is the ONLY thing keeping them out: robots.txt
	 *  deliberately disallows nothing, because a Disallow would stop the crawl
	 *  and the crawler would never get far enough to read this. */
	noindex = false,
): void {
	const { pathname } = useLocation()

	const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME
	// pathname only: query strings and hashes are never the canonical form of
	// a page here. See SITE_ORIGIN for why the origin is a constant and not
	// window.location.origin.
	const canonical = `${SITE_ORIGIN}${pathname}`

	// Build-time render: hand the values to whoever is collecting them. Null in
	// the browser, where nothing provides the context.
	const report = useContext(HeadMetaContext)
	if (report) report({ title: fullTitle, description, canonical, noindex })

	useEffect(() => {
		document.title = fullTitle

		upsertTag<HTMLMetaElement>('meta[name="description"]', () => {
			const tag = document.createElement("meta")
			tag.name = "description"
			return tag
		}).content = description

		upsertTag<HTMLLinkElement>('link[rel="canonical"]', () => {
			const tag = document.createElement("link")
			tag.rel = "canonical"
			return tag
		}).href = canonical

		// Add or remove rather than set/unset: an empty robots tag is not the same
		// as no robots tag, and a stale noindex left behind by a previous route
		// would quietly deindex a real page.
		const robots = document.head.querySelector('meta[name="robots"]')
		if (noindex) {
			if (!robots) {
				const tag = document.createElement("meta")
				tag.name = "robots"
				tag.content = "noindex, nofollow"
				document.head.appendChild(tag)
			}
		} else {
			robots?.remove()
		}
	}, [fullTitle, description, canonical, noindex])
}
