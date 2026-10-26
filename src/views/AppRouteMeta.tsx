import { useLocation } from "react-router-dom"
import { useDocumentMeta } from "../hooks/useDocumentMeta"
import { useSiteContent } from "../services/SiteContentContext"
import { isPublicId } from "../utils/appRoutes"

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

type AppPath = "/app" | "/app/timeline" | "/app/selectors" | "/app/legend-races" | "/app/pvp" | "/app/skills" | "/app/collection"

const META: Record<AppPath, RouteMeta> = {
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
	// The fallback only. The admin's "daily-legend-races" page row supplies
	// the real title and description; see AppRouteMeta below.
	"/app/legend-races": {
		title: "Daily Legend Races",
		description:
			"When each batch of umas joins the Uma Musume daily legend races on global, and how long grinding Star Pieces for one of them takes.",
	},
	// The fallback only, like Legend Races: the "pvp-guides" page row supplies
	// the real title and description.
	"/app/pvp": {
		title: "PvP Guides",
		description:
			"What to build for each Uma Musume Champions Meeting and League of Heroes on global: recommended stats, umas, skills and support decks.",
	},
	// One player's own account: noindex below, and not prerendered.
	"/app/collection": {
		title: "Collection",
		description: "Your Uma Musume veterans, with their stats, aptitudes and skills, to link to your PvP teams and CM runs.",
	},
	"/app/skills": {
		title: "Skills",
		description:
			"Every Uma Musume skill on global and in JP: when it activates, what it does, and which umas and support cards give it.",
	},
}

/**
 * A shared plan's landing card (/app/<public_id>). One meta for every link,
 * and noindex: the page is somebody's plan, copied and never browsed, and it
 * is the one /app page that cannot be prerendered (the id is per plan), so it
 * rides the spa.html shell and stays out of the sitemap.
 */
const SHARED_PLAN_META: RouteMeta = {
	title: "Shared plan",
	description:
		"An Uma Musume pull plan someone shared. Copy it to make it your own and see how it works out with your carats.",
}

/** The route a pathname names, tolerating a trailing slash. Falls back to the calculator. */
function appPathFor(pathname: string): AppPath | "shared" {
	const path = pathname.replace(/\/+$/, "")
	if (path in META) return path as AppPath
	// Checked AFTER the tabs: "/app/timeline" has the shape of an id too.
	const [, app, segment, extra] = path.split("/")
	if (app === "app" && extra === undefined && isPublicId(segment)) return "shared"
	return "/app"
}

export const AppRouteMeta = () => {
	const { pathname } = useLocation()
	const content = useSiteContent()
	const path = appPathFor(pathname)

	// The Legend Races tab's title and description are the team's to write,
	// so they come from its admin page row when it is here.
	//
	// OPTIONAL, which no other page read is: a build fails on a missing row
	// everywhere else. One deployment builds the site while the OLD API is
	// still serving, and the prerender reads /site-content from it, so the
	// first build after this page shipped could not have the row yet. The code
	// fallback covers that one build; every later one bakes the admin's words.
	// Read only on this route, so no other page's document embeds the row.
	const page =
		path === "/app/legend-races"
			? content.page("daily-legend-races", { optional: true })
			: path === "/app/pvp"
				? content.page("pvp-guides", { optional: true })
				: null
	const meta = page
		? { title: page.title, description: page.meta_description }
		: path === "shared"
			? SHARED_PLAN_META
			: META[path]

	// The Skills page is shelved to guide editors (useSkillsPreview): noindex,
	// like a shared plan, and not prerendered, until it is picked up again.
	// The Collection is one player's account, so it never should be.
	useDocumentMeta(meta.title, meta.description, path === "shared" || path === "/app/skills" || path === "/app/collection")
	return null
}
