import { useLocation } from "react-router-dom"
import { useDocumentMeta } from "../hooks/useDocumentMeta"

/**
 * The owner of the /app routes' document titles and descriptions. Renders nothing.
 *
 * WHY IT LIVES HERE AND NOT IN EACH PAGE
 *
 * The three routed pages mount only once /calculator-data has landed — see the
 * loading gate in ApplicationViews. A `useDocumentMeta` call inside them is
 * therefore invisible to whatever reads the page before that fetch resolves:
 * the browser tab while the spinner shows, an error state, a search crawler,
 * and a build-time render. One component that sits OUTSIDE the gate fixes all
 * four with one mount. (The tab used to read "Uma Musume Carat Calculator" for
 * the whole of the loading spinner; now it reads "Calculator | …" from the
 * first frame.)
 *
 * Until 2026-09-13 this component also rendered a short "how to read this"
 * block under each page. That prose was removed at the owner's request; the
 * guide and the FAQ carry the explanations, and the head tags carry the route.
 */

interface RouteMeta {
	/** Tab/meta title, without the site name. */
	title: string
	description: string
}

const META: Record<"/app" | "/app/timeline" | "/app/selectors", RouteMeta> = {
	"/app": {
		title: "Calculator",
		description:
			"Plan your Uma Musume banner pulls and see how many carats, tickets and pulls you will have available for each one.",
	},
	"/app/timeline": {
		title: "Banner Timeline",
		description:
			"Every Uma Musume banner, event and campaign on one timeline, with predicted global release dates derived from the JP schedule.",
	},
	"/app/selectors": {
		title: "Selector Tickets",
		description:
			"Plan which Uma Musume support cards and umas to take with your selector tickets, filtered by each ticket's eligibility cutoff.",
	},
}

/** The meta for a pathname, tolerating a trailing slash. Falls back to the calculator's. */
function metaFor(pathname: string): RouteMeta {
	const path = pathname.replace(/\/+$/, "")
	return path in META ? META[path as keyof typeof META] : META["/app"]
}

export const AppRouteMeta = () => {
	const { pathname } = useLocation()
	const meta = metaFor(pathname)
	useDocumentMeta(meta.title, meta.description)
	return null
}
