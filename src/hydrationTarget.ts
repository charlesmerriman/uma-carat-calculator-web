/**
 * Was this document prerendered for the page the browser is actually showing?
 *
 * Each prerendered document marks its root with `data-prerendered="/route"`
 * (scripts/prerender.mjs). Hydrating is only correct when that route is the one
 * being displayed: React would otherwise try to attach the About tree to the
 * markup of the homepage, recover by throwing the markup away, and log an error.
 *
 * The marker, not "does #root have children", is the test on purpose. A static
 * host can serve a prerendered document for a path it was not built for — every
 * unmatched path gets the catch-all document, and during a deploy the catch-all
 * can briefly be the prerendered homepage rather than the empty shell. In both
 * cases the marker disagrees with the path and main.tsx renders from scratch.
 */
export function shouldHydrate(marker: string | undefined, pathname: string): boolean {
	if (marker === undefined) return false
	return normalise(marker) === normalise(pathname)
}

/** "/about/" and "/about" are the same page; "/" stays "/". */
function normalise(path: string): string {
	const trimmed = path.replace(/\/+$/, "")
	return trimmed === "" ? "/" : trimmed
}
