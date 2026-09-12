import type { ReactNode } from "react"
import { Link, useLocation } from "react-router-dom"
import { useDocumentMeta } from "../hooks/useDocumentMeta"

/**
 * The short explanatory block under each /app page, and the owner of those pages'
 * document titles.
 *
 * WHY IT LIVES HERE AND NOT IN EACH PAGE
 *
 * The three routed pages mount only once /calculator-data has landed — see the
 * loading gate in ApplicationViews. Anything inside them is therefore invisible to
 * whatever reads the page before that fetch resolves: the browser tab while the
 * spinner shows, an error state, a search crawler, and a build-time render. Putting
 * the prose and the `useDocumentMeta` call in one component that sits OUTSIDE the
 * gate fixes all four with one mount. (The tab used to read "Uma Musume Carat
 * Calculator" for the whole of the loading spinner; now it reads "Calculator | …"
 * from the first frame.)
 *
 * The copy is deliberately free of numbers. Rates like "90 carats a day" are
 * admin-editable and served by the API, so any figure written here would read as
 * wrong the day the constant moves — the guide and the FAQ carry the numbers and
 * the caveat.
 */

interface RouteIntro {
	/** Tab/meta title, without the site name. */
	title: string
	description: string
	heading: string
	/** One node per paragraph. */
	body: ReactNode[]
}

const link = "text-brand transition hover:text-brand/75"

const guideLink = (
	<Link to="/guides/carat-income" className={link}>
		carat income guide
	</Link>
)
const faqLink = (
	<Link to="/faq" className={link}>
		FAQ
	</Link>
)

const INTROS: Record<"/app" | "/app/timeline" | "/app/selectors", RouteIntro> = {
	"/app": {
		title: "Calculator",
		description:
			"Plan your Uma Musume banner pulls and see how many carats, tickets and pulls you will have available for each one.",
		heading: "How to read the calculator",
		body: [
			<>
				Enter the carats and tickets you hold today, your club and Team Trials ranks and the
				purchases you make, then add the banners you want to pull on. For each banner the
				calculator walks the calendar forward and shows the balance you will have on the day
				it ends, after any pulls you planned on earlier banners.
			</>,
			<>
				Income lands on the day the game pays it: daily logins every day, Team Trials on
				Mondays, club rank on the first of the month, and events and campaigns on their own
				dates. Nothing is credited before it is earned, which is why a short window can show
				a monthly source as zero.
			</>,
			<>
				No account is needed. Sign in only if you want the plan saved and available on
				another device. The {guideLink} walks through the projection step by step, and the{" "}
				{faqLink} covers where the data comes from.
			</>,
		],
	},
	"/app/timeline": {
		title: "Banner Timeline",
		description:
			"Every Uma Musume banner, event and campaign on one timeline, with predicted global release dates derived from the JP schedule.",
		heading: "How to read the timeline",
		body: [
			<>
				Every banner, event and campaign the calculator knows about, on one calendar. Banners
				show the characters or support cards they feature; events show what they pay and
				when.
			</>,
			<>
				Dates that Cygames has not yet announced for the global server are predictions
				derived from the Japanese server&apos;s schedule, and anything marked as predicted
				can move. Announced dates replace them as they are confirmed.
			</>,
			<>
				Found a banner you want? Stage it from its card here, then confirm it in the
				calculator to see what it costs. The {guideLink} explains how event rewards are
				counted, and the {faqLink} covers how far ahead you can plan.
			</>,
		],
	},
	"/app/selectors": {
		title: "Selector Tickets",
		description:
			"Plan which Uma Musume support cards and umas to take with your selector tickets, filtered by each ticket's eligibility cutoff.",
		heading: "How to read the selector planner",
		body: [
			<>
				Selector tickets let you pick a specific character or support card instead of
				rolling for one. Each ticket has an eligibility cutoff: only cards released before a
				certain date can be chosen with it.
			</>,
			<>
				This page lists the tickets that come from campaign packs and anniversary events,
				which cards each one can still reach, and the picks a step-up banner lets you make.
				Choose a target for each ticket to see what it would get you.
			</>,
			<>
				Selector tickets never enter the pull forecast on the calculator: they buy a specific
				card rather than a roll. The {faqLink} explains why a selector cannot be used on some
				cards, and the {guideLink} covers how the carats themselves are projected.
			</>,
		],
	},
}

/** The intro for a pathname, tolerating a trailing slash. Falls back to the calculator's. */
function introFor(pathname: string): RouteIntro {
	const path = pathname.replace(/\/+$/, "")
	return path in INTROS ? INTROS[path as keyof typeof INTROS] : INTROS["/app"]
}

export const AppRouteIntro = () => {
	const { pathname } = useLocation()
	const intro = introFor(pathname)
	useDocumentMeta(intro.title, intro.description)

	return (
		<section
			aria-labelledby="app-route-intro-heading"
			className="mx-auto w-full max-w-3xl px-4 py-8 text-sm leading-relaxed text-gray-400"
		>
			<h2 id="app-route-intro-heading" className="text-base font-semibold text-gray-300">
				{intro.heading}
			</h2>
			{intro.body.map((block, index) => (
				// Index key is safe here: the blocks are static content that never reorders.
				<p key={index} className="mt-3">
					{block}
				</p>
			))}
		</section>
	)
}
