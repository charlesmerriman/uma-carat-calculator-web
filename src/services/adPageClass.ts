/**
 * Per-page body classes for Raptive's ad layout.
 *
 * Raptive places in-content ads by targeting HTML elements, and a layout can be
 * scoped to pages that carry a body class. Their installs team asked for one on
 * the PvP guide and the home page (2026-11-23), the two busy pages that got no
 * in-content slots, so each can have its own setup. The names below are on file
 * with Raptive: rename one and that page's custom placements stop matching
 * until Raptive is told again, so the names are pinned by a test.
 *
 * TWO WRITERS, LIKE THE AD-FREE CLASS (services/adFreeClass.ts)
 *
 * - First load: an inline script at the top of <body> in index.html adds the
 *   class from `location.pathname` before Raptive's script can place anything.
 *   It covers every document the host serves (the prerendered pages and
 *   dist/spa.html) without the prerender having to know about it.
 * - Client-side navigation: App.tsx calls applyAdPageClass on every pathname
 *   change, because the document never reloads and the class from the first
 *   load would otherwise stick to every page the reader moves on to.
 *
 * The map is duplicated in the inline script; adPageClass.test.ts fails if the
 * two drift. Keyed by pathname only: every view of /app/pvp (guide, gallery,
 * team, ?event=, ?style=) is the one PvP page to Raptive.
 */

/** Pathname → the body class Raptive's layout targets. Pinned by a test. */
export const AD_PAGE_CLASSES: Readonly<Record<string, string>> = {
	"/": "ad-page-home",
	"/app/pvp": "ad-page-pvp",
}

/**
 * The class for a pathname, if it has one. A trailing slash is ignored, so the
 * host's `/app/pvp/` (the prerender's dir layout) gets the same class as
 * `/app/pvp`; the bare `/` stays `/`.
 */
export function adPageClassFor(pathname: string): string | undefined {
	const path = pathname.replace(/\/+$/, "") || "/"
	return AD_PAGE_CLASSES[path]
}

/**
 * Leave exactly the current page's class on <body>: add it, and take off any
 * other page's class left from the page before.
 *
 * Safe to call during a build-time render: there is no document there, and
 * nothing to do.
 */
export function applyAdPageClass(pathname: string): void {
	if (typeof document === "undefined") return
	const current = adPageClassFor(pathname)
	for (const name of Object.values(AD_PAGE_CLASSES)) {
		document.body.classList.toggle(name, name === current)
	}
}
