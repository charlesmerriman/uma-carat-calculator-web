import { useEffect } from "react"
import { useLocation } from "react-router-dom"

/**
 * Per-route <title>, description, canonical and robots tags.
 *
 * This is a single-page app: every URL is served the same index.html, and React
 * only ever replaces the contents of #root. Nothing touches <head> unless we do
 * it by hand, so without this hook all eight routes present one identical title
 * and description to browser tabs, to Google, and to anything else reading the
 * document.
 *
 * Deliberately not react-helmet-async. That earns its place when titles are
 * dynamic and numerous (a page per record); here the route set is fixed and
 * small, and this is the whole implementation.
 *
 * NOTE ON LINK PREVIEWS: this cannot fix them. Discord, Slack, Twitter and
 * friends fetch the raw HTML and never execute JavaScript, so they only ever see
 * the static tags in index.html. Those are set there as a site-wide default. Real
 * per-route previews would need prerendering or SSR.
 */

const SITE_NAME = "Uma Musume Carat Calculator"

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
const SITE_ORIGIN = "https://umacaratcalculator.com"

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

	useEffect(() => {
		document.title = title ? `${title} | ${SITE_NAME}` : SITE_NAME

		upsertTag<HTMLMetaElement>('meta[name="description"]', () => {
			const tag = document.createElement("meta")
			tag.name = "description"
			return tag
		}).content = description

		// pathname only: query strings and hashes are never the canonical form of
		// a page here. See SITE_ORIGIN for why the origin is a constant and not
		// window.location.origin.
		upsertTag<HTMLLinkElement>('link[rel="canonical"]', () => {
			const tag = document.createElement("link")
			tag.rel = "canonical"
			return tag
		}).href = `${SITE_ORIGIN}${pathname}`

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
	}, [title, description, noindex, pathname])
}
