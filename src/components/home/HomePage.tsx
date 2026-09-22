import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
	ArrowRight,
	ArrowUpRight,
	CalendarPlus,
	Carrot,
	FileText,
	HelpCircle,
	MessageSquare,
	PlayCircle,
	ScrollText,
	Ticket,
	TrendingUp,
	Trophy,
} from "lucide-react"
import { Navbar } from "../navbar/Navbar"
import { Footer } from "../footer/Footer"
import { SupportersSection } from "./SupportersSection"
import { FloatingBackToTop } from "../BackToTop"
import { HOME_CARD, HOME_ICON_CHIP, HOME_TILE } from "./homeStyles"
import { changelogFetch } from "../../services/changelogFetchCalls"
import { prefetchCalculatorData } from "../../services/calculatorFetchCalls"
import { formatRelativeDate } from "../../utils/relativeDate"
import { useSiteContent } from "../../services/SiteContentContext"
import { homepageFaqItems } from "../../services/siteContent"
import { firstParagraph } from "../../utils/guideMarkdown"
import { MarkdownContent } from "../info/MarkdownContent"
import type { ChangelogEntry } from "../../types"
import { useDocumentMeta } from "../../hooks/useDocumentMeta"
import { useBackToTop } from "../../hooks/useBackToTop"

const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@HenryHandsomeDerby"
// A fixed video (Henry's walkthrough of this site), NOT the channel's uploads
// playlist: the embed used to follow whatever he posted last, which was often
// unrelated to the calculator.
const YOUTUBE_FEATURED_VIDEO_ID = "vQJ0FLK0CKg"
// The direct document URL, deliberately NOT umacaratcalculator.com. That domain
// currently 301s here, but it is also the obvious candidate to repoint at this
// site — at which point a vanity link would quietly become a self-link.
const HENRY_SHEET_URL =
	"https://docs.google.com/spreadsheets/d/100t3hnYl5Qm2UR8RtPlH-8Xd9KQbBlxEdXUOIR4d394/"

/**
 * What the projection actually models, grouped the way a player thinks about it
 * rather than the way the ledger is built. This is the page's credibility
 * section: someone deciding whether to trust the forecast wants to know whether
 * their situation is covered before they type anything in.
 */
const COVERAGE = [
	{
		title: "Recurring income",
		body: "Daily login, Team Trials on Mondays, club rank on the 1st, Champions Meeting and League of Heroes on the event's end date.",
	},
	{
		title: "Events & campaigns",
		body: "Game events, login campaigns, seasonal rewards, and anniversary campaigns with their carat packs and selector tickets.",
	},
	{
		title: "What you buy",
		body: "Daily Carat Pack, Training Pass and Monthly Shop Tickets as toggles, with paid carats tracked separately so the daily discount is priced right.",
	},
	{
		title: "How you spend",
		body: "Pity at 200 pulls, free pulls, uma and support tickets, selector tickets, and paid-only step-up banners with their own odds.",
	},
]

const steps = [
	{ icon: Carrot, title: "Enter your resources", body: "Add your current carats and tickets." },
	{ icon: Trophy, title: "Set your ranks", body: "Match the forecast to your income." },
	{ icon: CalendarPlus, title: "Add upcoming banners", body: "Choose the banners you want to plan for." },
	{ icon: Ticket, title: "Set your pull goals", body: "Decide how far you want to pull." },
	{ icon: TrendingUp, title: "Read the forecast", body: "See what will be available by each end date." },
]

// `caption` is the tile's default subtitle. Changelog overrides it below with the live
// "Updated <relative date>" once that has loaded; the rest are static. Carried per-link
// rather than derived, so a tile's caption is one line here and not an else-branch.
const infoLinks = [
	{ to: "/changelog", icon: ScrollText, label: "Changelog", caption: "View updates" },
	{ to: "/faq", icon: HelpCircle, label: "FAQ", caption: "Common questions" },
	{ to: "/feedback", icon: MessageSquare, label: "Feedback", caption: "Report a bug on Discord" },
]

// The four quick-link tiles under the video share one shape: icon chip, bold
// label, muted caption. Built once here so the external sheet link and the three
// internal routes cannot end up a pixel apart.
const tileClass = `${HOME_TILE} flex min-w-0 items-center gap-2.5 px-3 py-2.5 text-left`

// The below-the-fold sections all open the same way: a divider, then a heading.
const sectionClass = "mt-10 border-t border-gray-800 pt-8"
const sectionHeadingClass = "text-xl font-bold tracking-tight text-gray-100"

export const HomePage = () => {
	useDocumentMeta(null, "Plan your Uma Musume gacha pulls. Forecast how many carats and tickets you will have for any upcoming banner, based on your rank income, events and campaigns.")

	const { topRef, isAwayFromTop, scrollToTop } = useBackToTop()
	// The FAQ teaser. Null only on the empty shell before the fetch lands; the
	// prerendered homepage embeds the FAQ, so a normal load always has it.
	const faq = useSiteContent().faq()
	const teaserItems = faq ? homepageFaqItems(faq) : []
	const [latestChangelogDate, setLatestChangelogDate] = useState<string | null>(null)

	useEffect(() => {
		const controller = new AbortController()
		changelogFetch(controller.signal)
			.then((res) => (res.ok ? res.json() : null))
			.then((data: ChangelogEntry[] | null) => {
				if (data?.length) setLatestChangelogDate(data[0].date)
			})
			.catch(() => undefined)
		return () => controller.abort()
	}, [])

	// Warm /calculator-data while the visitor is still reading this page.
	//
	// Nothing under /app renders until that request lands, so it is the entire
	// cost of clicking "Open the calculator" — and the home page needs none of
	// it. Starting it here usually means the response has already arrived by the
	// time they click.
	//
	// On idle rather than immediately: this is a ~1MB response and the home
	// page's own content comes first. requestIdleCallback runs it in a gap
	// instead of competing for bandwidth with the video embed and the changelog
	// fetch above. Safari only shipped requestIdleCallback recently, hence the
	// timeout fallback.
	//
	// Deliberately NOT cancelled on unmount: the whole point is that the request
	// outlives this page and is waiting when the provider mounts.
	useEffect(() => {
		const schedule =
			window.requestIdleCallback ??
			((cb: () => void) => window.setTimeout(cb, 200))
		const handle = schedule(() => prefetchCalculatorData())
		return () => {
			// Only cancels the SCHEDULING — if the callback already ran, the
			// request is in flight and we want it to stay that way.
			if (window.cancelIdleCallback) window.cancelIdleCallback(handle as number)
			else window.clearTimeout(handle as number)
		}
	}, [])

	return (
		<div className="flex min-h-dvh flex-col bg-gray-900">
			{/* The `bg-gray-900` on this root is what the per-theme
			    `#root > .bg-gray-900` glows in index.css hook onto; keep it. */}
			{/* Scroll anchor for "back to top" — zero-height, so it costs no layout.
			    First child, above the navbar, so returning to it returns to the very
			    top of the page rather than just below the header. */}
			<div ref={topRef} aria-hidden="true" />
			<Navbar />
			{/* Normal block flow rather than `flex items-center`, which would
			    vertically centre a single screenful and leave no room below the fold
			    for the sections that explain the tool to a first-time visitor. */}
			<main className="flex-1">
				<div className="mx-auto w-full max-w-[104rem] px-4 py-5 sm:px-6 lg:px-8 lg:py-5">
					<section className={`${HOME_CARD} px-5 py-5 sm:px-6`}>
						<div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
							<div>
								<h1 className="text-3xl font-bold tracking-tight text-balance text-gray-100 sm:text-4xl">Plan your pulls. Know your carats.</h1>
								<p className="mt-2 max-w-2xl text-base text-pretty text-gray-400">A simple planner for your Uma Musume banners, income, and pull goals.</p>
							</div>
							<div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
								<Link
									to="/app"
									className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-black transition hover:brightness-110"
									onMouseEnter={prefetchCalculatorData}
									onFocus={prefetchCalculatorData}
								>
									Open the calculator
									<ArrowRight className="h-4 w-4" aria-hidden="true" />
								</Link>
								<Link
									to="/login"
									className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-600 px-4 text-sm font-semibold text-gray-200 transition hover:border-gray-500 hover:bg-gray-700"
								>
									Sign in to save a plan
								</Link>
							</div>
						</div>
					</section>

					<div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-stretch">
						<section className="flex min-w-0 flex-col">
							{/* The channel link is the panel's header strip and the embed
							    its body: one card, not a link bar stacked on a video box.
							    overflow-hidden clips the iframe to the rounded corners. */}
							<div className={`${HOME_CARD} overflow-hidden`}>
								<a
									href={YOUTUBE_CHANNEL_URL}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center justify-between gap-3 border-b border-gray-700 px-4 py-3 transition hover:bg-gray-700/60"
								>
									<span className="flex min-w-0 items-center gap-3">
										{/* YouTube's red rather than the brand tint: this is
										    the one chip that points off-site, and the colour
										    says so before the arrow does. */}
										<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-500">
											<PlayCircle className="h-4 w-4" aria-hidden="true" />
										</span>
										<span className="min-w-0">
											<span className="block truncate text-sm font-semibold text-gray-100">Henry Handsome Derby's video about this site</span>
											<span className="block truncate text-xs text-gray-500">Open the channel on YouTube</span>
										</span>
									</span>
									<ArrowUpRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
								</a>
								<div className="aspect-video bg-gray-900">
									{/* youtube-nocookie.com is YouTube's privacy-enhanced mode: the
									    player loads, but sets no advertising cookies before the
									    visitor presses play. Plain youtube.com/embed set them on
									    page load for everyone. */}
									<iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${YOUTUBE_FEATURED_VIDEO_ID}`} title="Henry Handsome Derby's video about this site" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
								</div>
							</div>
							<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
								<a href={HENRY_SHEET_URL} target="_blank" rel="noopener noreferrer" className={tileClass}>
									<span className={HOME_ICON_CHIP}><FileText className="h-4 w-4" aria-hidden="true" /></span>
									<span className="min-w-0"><span className="block truncate text-sm font-semibold text-gray-100">Henry's Sheet</span><span className="block truncate text-xs text-gray-500">Resource guide</span></span>
								</a>
								{infoLinks.map((item) => {
									const Icon = item.icon
									const caption = item.to === "/changelog" && latestChangelogDate ? `Updated ${formatRelativeDate(latestChangelogDate)}` : item.caption
									return (
										<Link key={item.to} to={item.to} className={tileClass}>
											<span className={HOME_ICON_CHIP}><Icon className="h-4 w-4" aria-hidden="true" /></span>
											<span className="min-w-0"><span className="block truncate text-sm font-semibold text-gray-100">{item.label}</span><span className="block truncate text-xs text-gray-500">{caption}</span></span>
										</Link>
									)
								})}
							</div>
						</section>

						<section className={`${HOME_CARD} flex h-full flex-col p-4`}>
							<div className="flex items-baseline justify-between gap-3">
								<div>
									<h2 className="text-lg font-bold tracking-tight text-gray-100">How it works</h2>
									<p className="mt-0.5 text-sm text-gray-400">From your stash to a clear pull plan.</p>
								</div>
								<span className="shrink-0 rounded-full border border-gray-700 bg-gray-900/60 px-2.5 py-0.5 text-xs font-medium text-gray-400">5 steps</span>
							</div>
							{/* Rows sit directly on the card, divided by rules, rather than in
							    a second bordered box inside it. `flex-1` on the list and on
							    each row spreads the five steps over the panel's full height
							    so it matches the video column beside it. */}
							<ol className="mt-3 flex flex-1 flex-col divide-y divide-gray-700 border-t border-gray-700">
								{steps.map((step, index) => {
									const Icon = step.icon
									return (
										<li key={step.title} className="flex flex-1 items-center gap-3 py-2.5">
											<span className={`${HOME_ICON_CHIP} text-xs font-bold`}>{index + 1}</span>
											<Icon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
											<div className="min-w-0">
												<h3 className="text-sm font-semibold text-gray-100">{step.title}</h3>
												<p className="text-xs text-gray-400">{step.body}</p>
											</div>
										</li>
									)
								})}
							</ol>
						</section>
					</div>

					{/* ── Below the fold ────────────────────────────────────────────
					    Everything from here down is for the visitor who did not already
					    know what this is. Someone who did clicks a CTA in the hero and
					    never reaches it. */}

					<section className={sectionClass}>
						{/* The pitch and the coverage grid are ONE section on purpose. As its
						    own section the prose was a heading, two paragraphs and then a
						    full-width divider, which made the empty right half of the 104rem
						    canvas the most visible thing about it. As the intro to the grid
						    below it reads the way every other section here does: heading,
						    short left-aligned lead, then content that fills the width. */}
						<h2 className={sectionHeadingClass}>What this is</h2>
						<div className="mt-3 max-w-3xl space-y-3 leading-relaxed text-pretty text-gray-400">
							<p>
								Uma Musume Pretty Derby is a gacha game. You spend a currency called{" "}
								<span className="font-semibold text-gray-300">carats</span> to pull for
								characters and support cards on banners that run for a week or two and then
								go away. Carats come in slowly, from dozens of sources on their own
								schedules, so &quot;can I afford the banner after this one?&quot; is a hard
								question to answer in your head.
							</p>
							<p>
								This planner answers that question. Tell it what you have now and which
								income applies to you, add the banners you care about, and it walks the
								calendar forward day by day to show what you will have on the day each one
								ends, before you spend.
							</p>
						</div>

						<h3 className="mt-8 text-base font-semibold text-gray-100">What the forecast accounts for</h3>
						<p className="mt-1 max-w-3xl text-sm text-pretty text-gray-400">
							Income is added on the day the game pays it rather than averaged across the
							month, so the projection lines up with real banner end dates.
						</p>
						{/* Four across on the wide canvas: the cards are short and the row
						    reads as one line of coverage rather than two stacked pairs. */}
						<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							{COVERAGE.map((item) => (
								<div key={item.title} className={`${HOME_CARD} p-4`}>
									<h4 className="text-sm font-semibold text-brand">{item.title}</h4>
									<p className="mt-1.5 text-sm leading-relaxed text-gray-400">{item.body}</p>
								</div>
							))}
						</div>
					</section>

					{teaserItems.length > 0 && (
					<section className={sectionClass}>
						<div className="flex flex-wrap items-baseline justify-between gap-3">
							<h2 className={sectionHeadingClass}>Common questions</h2>
							<Link to="/faq" className="text-sm font-semibold text-brand transition hover:text-brand/75">
								See all questions →
							</Link>
						</div>
						<div className="mt-5 grid gap-4 lg:grid-cols-3">
							{/* Only the first answer paragraph — the teaser is a taste, and the
							    full answer is one click away at its own anchor. Which questions
							    appear is the admin's "Show on homepage" tick, in FAQ order. */}
							{teaserItems.map((item) => (
								<div key={item.slug} className={`${HOME_CARD} p-4`}>
									<h3 className="text-sm font-semibold text-gray-100">
										<Link to={`/faq#${item.slug}`} className="transition hover:text-brand">
											{item.question}
										</Link>
									</h3>
									<MarkdownContent
										markdown={firstParagraph(item.answer)}
										paragraphClassName="mt-1.5 text-sm leading-relaxed text-gray-400"
									/>
								</div>
							))}
						</div>
					</section>
					)}

					{/* Last section on the page: it thanks people rather than explaining
					    anything, so it sits below the pitch and the FAQ teaser. Renders
					    nothing at all until there is somebody to thank. */}
					<SupportersSection />
				</div>
			</main>
			<Footer />
			<FloatingBackToTop onClick={scrollToTop} visible={isAwayFromTop} />
		</div>
	)
}
