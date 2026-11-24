import { useLocation } from "react-router-dom"
import { useDocumentMeta } from "../hooks/useDocumentMeta"
import { useSiteContent } from "../services/SiteContentContext"
import { isPublicId } from "../utils/appRoutes"
import { useEncyclopediaPage, type EncyclopediaPageState } from "../services/encyclopediaQueries"
import { encyclopediaPageOf, type EncyclopediaPageKind } from "../utils/encyclopediaRoutes"
import { cardPageMeta, skillPageMeta, umaPageMeta } from "../utils/encyclopediaMeta"

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
 * The Encyclopedia's detail pages render outside that gate (they need nothing
 * from /calculator-data to draw), but their titles live here too, built from
 * the page's own cached payload, so a build-time render carries them.
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

type AppPath =
	| "/app" | "/app/timeline" | "/app/selectors" | "/app/legend-races" | "/app/pvp" | "/app/skills" | "/app/collection"
	| "/app/rankings" | "/app/plans" | "/app/umas" | "/app/cards"

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
	// Early access only (Patreon supporters): noindex below, and not prerendered.
	"/app/rankings": {
		title: "Rankings",
		description: "Which Uma Musume support cards and umas the PvP guides recommend most, across every guide or the next few events.",
	},
	// Early access only for now: noindex below, and not prerendered (PR 5 of
	// notes/pull-plan-database-plan.md opens it).
	"/app/plans": {
		title: "Pull Plan Library",
		description: "Uma Musume pull plans other players have posted, ranked and filtered by budget and play style. Copy one or take single banners.",
	},
	// The Encyclopedia's three lists name it in the title and the description:
	// their built documents hold the app shell, so the head is the only place
	// a search engine reads the word (owner, 2026-11-18: "the encyclopedia
	// itself" must be findable). The wording is the owner's to change.
	"/app/skills": {
		title: "Encyclopedia: Skills",
		description:
			"The Uma Musume Encyclopedia's skill list. Every skill on global and in JP: when it activates, what it does, and which umas and support cards give it.",
	},
	// The Encyclopedia's lists (these two and /app/skills above): public and
	// prerendered like every tab since 2026-11-18.
	"/app/umas": {
		title: "Encyclopedia: Umas",
		description:
			"The Uma Musume Encyclopedia: a page for every uma, support card and skill. Every trainee on global and in JP, with aptitudes, stats at every star, skills and banners.",
	},
	"/app/cards": {
		title: "Encyclopedia: Support Cards",
		description:
			"The Uma Musume Encyclopedia's support card list. Every card on global and in JP, with its effects at every level, the skills it teaches and its banners.",
	},
}

/**
 * An Encyclopedia page (/app/umas/<id> and its card and skill twins) while its
 * payload loads: one meta per kind. Once the payload is in the cache the page
 * gets its own (utils/encyclopediaMeta.ts). A build-time render has it before
 * the first render (entry-server.ts primes the cache), so a built document
 * carries the page's own title from the start.
 */
const ENCYCLOPEDIA_PAGE_META: Record<EncyclopediaPageKind, RouteMeta> = {
	uma: { title: "Uma", description: "An Uma Musume trainee: aptitudes, stats, skills and banners." },
	card: { title: "Support Card", description: "An Uma Musume support card: the skills it teaches and its banners." },
	skill: { title: "Skill", description: "An Uma Musume skill: when it activates, what it does, and who gives it." },
}

/** A detail path the API has no page for. Always noindex: the static host answers it with a 200. */
const MISSING_PAGE_META: RouteMeta = {
	title: "No such page",
	description: "There's no Encyclopedia page at this address.",
}

function encyclopediaMeta(state: EncyclopediaPageState): RouteMeta {
	if (state.data === null) return MISSING_PAGE_META
	if (state.data === undefined) return ENCYCLOPEDIA_PAGE_META[state.kind]
	if (state.kind === "uma") return umaPageMeta(state.data)
	if (state.kind === "card") return cardPageMeta(state.data)
	return skillPageMeta(state.data)
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
	// The same cache entry the detail page reads, so the two share one request.
	const encyclopedia = useEncyclopediaPage(encyclopediaPageOf(pathname))
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
	const meta = encyclopedia
		? encyclopediaMeta(encyclopedia)
		: page
			? { title: page.title, description: page.meta_description }
			: path === "shared"
				? SHARED_PLAN_META
				: META[path]

	// noindex: an Encyclopedia address with no page behind it, a shared plan,
	// the Collection (one player's account), and Rankings and Community plans
	// (behind early access).
	// Every real Encyclopedia page is indexed: the build writes each one as a
	// document with its own title and lists it in sitemap-encyclopedia.xml
	// (scripts/prerender.mjs). A page newer than the last build rides the
	// spa.html shell until the next one, unblocked.
	const encyclopediaNoindex = encyclopedia !== null && encyclopedia.data === null
	useDocumentMeta(
		meta.title,
		meta.description,
		encyclopediaNoindex ||
			path === "shared" ||
			path === "/app/collection" ||
			path === "/app/rankings" ||
			path === "/app/plans"
	)
	return null
}
