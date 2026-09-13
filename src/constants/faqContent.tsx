import type { ReactNode } from "react"
import { Link } from "react-router-dom"

/**
 * FAQ content for the public /faq page.
 *
 * Static rather than API-backed on purpose. The Changelog is an admin-editable Django
 * model because it changes every release; FAQ answers change rarely and are tied to how
 * the app behaves, so they ship with the deploy that changes that behaviour. The shape
 * below deliberately mirrors what a `FaqEntry` model would serialize to, so promoting
 * this to admin-editable later is a swap of the data source, not a rewrite of the page.
 *
 * `.tsx` rather than `.ts` because several answers carry inline links. Keeping the
 * markup with the prose beats threading a parallel array of link metadata through the
 * component.
 *
 * COPY OWNERSHIP — the two sections below marked "verbatim from the FAQ doc" are
 * transcribed word-for-word from the maintainer's source document and are NOT to be
 * reworded, expanded or "corrected" against the code. If an answer there disagrees with
 * behaviour, raise it; do not edit it here. The remaining two sections are not covered
 * by that document and are maintained in this file.
 *
 * Source material for the sections this file still owns:
 *   frontend/docs/state-and-guest-mode.md     (guest mode, auto-save)
 *   backend/docs/auth-and-privacy.md          (what we store)
 *
 * ONE ANSWER QUOTES A LIVE NUMBER and will read as wrong if the constant moves. It comes
 * from the admin-editable `CalculationConstants` served by `/calculator-data`, NOT from
 * the bundle, so a content editor can change it without touching this file:
 *   - "90 carats per day" is `misc_earnings_monthly / 30` (2,700 / 30 at time of writing).
 */

const link = "text-brand transition hover:text-brand/75"

export interface FaqItem {
	/**
	 * Stable slug. Used as the React key, as the question's DOM id so a single
	 * question can be deep-linked (`/faq#do-i-need-an-account`), and as the handle
	 * the homepage teaser selects by. Derived from the question text, but stored
	 * rather than computed — rewording a question must not break an existing link.
	 */
	id: string
	/** Rendered as the question heading. Also the accessible label for the answer. */
	question: string
	/** One node per paragraph — an answer that needs two blocks gets two entries. */
	answer: ReactNode[]
}

export interface FaqCategory {
	/** Slug used as the section's DOM id and as the jump-link target. */
	id: string
	title: string
	items: FaqItem[]
}

export const FAQ_CATEGORIES: FaqCategory[] = [
	{
		// Verbatim from the FAQ doc — see COPY OWNERSHIP above.
		id: "using-the-calculator",
		title: "Using the calculator",
		items: [
			{
				id: "what-does-this-calculator-actually-do",
				question: "What does this calculator actually do?",
				answer: [
					<>
						It projects how many carats and tickets you will have by the end date of each
						banner. You tell it what your resources are today and which income sources apply
						to you, add the banners you are planning for, and it walks forward through the
						calendar, adding up everything the game will give you between now and then.
					</>,
					<>
						The point is to answer the question you actually have, "Can I afford to go for
						both of these, or do I have to pick one?", before the banner arrives rather than
						after.
					</>,
				],
			},
			{
				id: "do-i-need-an-account",
				question: "Do I need an account?",
				answer: [
					<>
						The calculator is fully usable as a guest; an account only adds one thing:
						saving. As a guest, your plan lives in your browser for as long as the tab is
						open and is discarded when you leave or reload the page.
					</>,
					<>
						If you create an account the plan built with your guest account will not be lost.
						It will be transferred to your account.
					</>,
				],
			},
			{
				id: "how-do-i-get-started",
				question: "How do I get started?",
				answer: [
					<>
						Open the calculator and enter your current carats and tickets, then set your
						income ranks so the forecast matches how much you actually earn. Add the banners
						you want to plan for, set how many pulls you plan on performing on each, and
						read the forecasted results.
					</>,
				],
			},
			{
				id: "what-is-the-difference-between-free-and",
				question: "What is the difference between free and paid carats?",
				answer: [
					<>
						<strong>Paid carats</strong> are carats that have been purchased. Unlike free
						carats, they can be used for daily discounted pulls and step-up banners. The
						calculator tracks them separately and the spending of paid carats can be toggled
						in the settings menu.
					</>,
				],
			},
			{
				id: "what-do-the-colours-on-the-pulls",
				question: 'What do the colors on the "# Pulls" box mean?',
				answer: [
					<>
						<strong>Bright green</strong> means the number is at a pity threshold (a multiple
						of 200). <strong>Faded green</strong> means it is not at the pity threshold.
					</>,
					<>
						<strong>Red</strong> means the calculator estimates that you will not have enough
						resources for your plan. The calculator tends to underestimate, so if you are
						only a few pulls off, you will likely earn enough for your plan. The longer the
						time period, the more true that is.
					</>,
				],
			},
		],
	},
	{
		// Verbatim from the FAQ doc — see COPY OWNERSHIP above.
		id: "the-numbers",
		title: "The numbers",
		items: [
			{
				id: "where-do-the-carat-numbers-come-from",
				question: "Where do the carat numbers come from?",
				answer: [
					<>
						From the income sources you set, game events, and an estimation for
						miscellaneous earnings. Daily login pays every day, Team Trials pays weekly on
						Mondays, club rank pays monthly on the 1st, Champions Meeting pays when finals
						open, and League of Heroes pays on the event's end date.
					</>,
					<>
						Game events include every known event, login bonus, and mission with their
						carat, ticket, and shard rewards. Tickets and shards are always awarded on the
						first day of the banner. Carats are either rewarded on the first day or
						throughout the banner. Most carats are awarded throughout, and the amount given
						is reduced each day to estimate progress through an event.
					</>,
					<>
						Miscellaneous Earnings gives 90 carats per day starting 30 days from now. It
						attempts to accurately capture carat earnings that could not be included in
						fixed data, such as gifts from Cygames, Team Trials rank-ups and win rewards,
						carats from career races, uma stories, main missions, and archive level-ups.
						This tool keeps the calculator accurate over long periods of time.
					</>,
					<>
						A few sources are toggles because they depend on what you buy or how you play:
						the Daily Carat Pack, the Training Pass, Misc Earnings, and Monthly Shop
						Tickets. Turn on the ones that apply to you and leave the rest off.
					</>,
				],
			},
			{
				id: "why-does-this-not-match-what-i",
				question: "Why does this not match what I have in the game?",
				answer: [
					<>
						The usual reasons it drifts: Your starting balance is whatever you typed, so if
						that is outdated, estimates will be inaccurate. Misc Earnings is a flat average
						rather than your real gifts and career clears. If you outearn or are outearned
						by the estimate, predictions will drift over time. Event income models typical
						play, so clearing an event on day one puts you ahead of the projection, while
						leaving it until the last weekend puts you behind.
					</>,
					<>
						Dates for unannounced banners are predictions based on the Japanese server's
						schedule, and anything predicted can move. The calculator's date estimates are
						kept fast to cause a slight underestimation and prevent drops from banners
						releasing earlier than expected.
					</>,
				],
			},
			{
				id: "what-does-average-monthly-income-mean",
				question: 'What does "average monthly income" mean?',
				answer: [
					<>
						It is a flat average over a fixed window. The calculator totals every carat,
						ticket and shard your current settings earn over the next five months, starting
						today, and divides by five. Nothing is deducted along the way — pull costs never
						enter it, so it is what you earn, not what you have left over.
					</>,
					<>
						It runs on the same income ledger as the banner rows below it, so the headline
						figure and the per-banner forecasts cannot disagree. Carats are reported as a
						single number here rather than split into free and paid, because that split only
						matters where the two balances buy pulls at different prices. One deliberate
						exception: planner purchases are left out.
					</>,
				],
			},
			{
				id: "how-do-step-up-banners-work-here",
				question: "How do step-up banners work?",
				answer: [
					<>
						Step-up banners are paid-only banners. You select 10 characters or support cards
						to populate the ★3/SSR drop pool. There are 5 steps with a total cost of 5,000
						paid carats. Each step is a 10-pull with certain guaranteed rewards.
					</>,
					<>
						Steps 1 and 2 are standard 10-pulls. Steps 3 and 4 have a guaranteed ★3/SSR card
						from your selection. On Step 5, you choose which ★3/SSR card to guarantee. With
						50 total pulls, the odds of spooking an extra ★3/SSR from your selection are
						high.
					</>,
					<>
						The inputs for step-up banners are capped by the number offered on the Japanese
						server.
					</>,
				],
			},
			{
				id: "why-can-i-not-use-a-selector",
				question: "Why can I not select certain characters or support cards?",
				answer: [
					<>
						Selector tickets have a cutoff date: you can only pick a card that was released
						on or before that date. The calculator works that out from each card's Japanese
						release date and compares it to the cutoff date, so a card released after the
						cutoff is not selectable.
					</>,
					<>
						Separately, some characters are considered <strong>semi-limited</strong>; this
						means they can only be obtained through gacha, either on their release banner or
						through spooks. You cannot select them on step-up banners or selector tickets.
					</>,
					<>
						The restricted list currently includes Jungle Pocket, Gentildona, Orfevre, Still
						in Love, Oguri Cap (Anime Collab), Stay Gold, Almond Eye, and Epiphaneia.
					</>,
				],
			},
			{
				id: "how-far-ahead-can-i-plan",
				question: "How far ahead can I plan?",
				answer: [
					<>
						As far as the timeline goes. Banners that have been officially announced carry
						their real dates; further out, dates are predicted from the Japanese server's
						schedule. Predicted entries are marked as such. They are good enough to plan
						against, but treat them as likely rather than fixed.
					</>,
				],
			},
		],
	},
	{
		// Not covered by the FAQ doc — maintained in this file.
		id: "account-and-privacy",
		title: "Your account and privacy",
		items: [
			{
				id: "what-do-you-store-about-me",
				question: "What do you store about me?",
				answer: [
					<>
						As little as possible. If you sign in with Google, Discord or Patreon we
						receive an anonymous account reference and the web address of your profile
						picture there, and nothing else: no email address, no real name, no display
						name, and never a password. The picture is shown to you alone. Your username
						is randomly generated by us. Alongside that we store the planning data you
						enter, so your plan is there when you come back.
					</>,
					<>
						Visits are counted without cookies and without ever storing your IP address.
						You can delete your account, and everything stored with it, from the Account
						page at any time. The full detail is in the{" "}
						<Link to="/privacy-policy" className={link}>
							Privacy Policy
						</Link>
						.
					</>,
				],
			},
			{
				id: "i-lost-access-to-my-google-or",
				question: "I lost access to the account I sign in with. Can I get my plan back?",
				answer: [
					<>
						Only if you connected another sign-in first. An account here can have Google,
						Discord and Patreon linked to it from the Account page, and any one of them
						gets you back in. If the one you lost was the only one, then unfortunately
						not: because we hold no email address, there is no password reset and no way
						for us to confirm that an account was yours. That is the deliberate trade-off
						for holding none of your personal data: the same design that means a breach
						here exposes nothing about you also means we cannot vouch for you.
					</>,
					<>
						If it happens, you would need to start a new plan. Linking a second sign-in
						while you still have the first is the insurance.
					</>,
				],
			},
			{
				id: "is-this-site-affiliated-with-cygames",
				question: "Is this site affiliated with Cygames?",
				answer: [
					<>
						No. This is an unofficial fan-made planning tool with no connection to Cygames
						or Uma Musume Pretty Derby. All game names and assets belong to their owners.
						Nothing here is official, and no projection it produces should be read as a
						statement from the game.
					</>,
				],
			},
		],
	},
	{
		// Not covered by the FAQ doc — maintained in this file.
		id: "about-the-site",
		title: "About the site",
		items: [
			{
				id: "how-do-i-report-a-bug-or",
				question: "How do I report a bug or suggest a feature?",
				answer: [
					<>
						Use the{" "}
						<Link to="/feedback" className={link}>
							Feedback
						</Link>{" "}
						form. No account is needed, and you can tag it as a bug, a feature idea or a
						data correction. Bug reports are much easier to act on with the specifics:
						which banner or screen, what you expected, and what you saw instead.
					</>,
					<>
						The form asks for nothing but the message itself — no name, no email address —
						so it is one-way and you will not get a reply to it.
					</>,
				],
			},
			{
				id: "how-often-is-the-data-updated",
				question: "How often is the data updated?",
				answer: [
					<>
						Banner and event data is updated as the game announces it, and the underlying
						income figures are corrected whenever they are found to have drifted. Recent
						changes are listed on the{" "}
						<Link to="/changelog" className={link}>
							Changelog
						</Link>
						.
					</>,
				],
			},
		],
	},
]

/**
 * The three questions surfaced as a teaser on the homepage, in display order.
 *
 * Selected by id rather than by position so reordering or adding questions above
 * them cannot silently change what the homepage shows. Chosen to cover the three
 * things a first-time visitor actually wonders: whether they have to sign up,
 * whether they can trust the numbers, and whether this is official.
 */
export const HOMEPAGE_FAQ_IDS = [
	"do-i-need-an-account",
	"why-does-this-not-match-what-i",
	"is-this-site-affiliated-with-cygames",
] as const

/** Flattened lookup — the categories are a display grouping, not an index. */
const ALL_FAQ_ITEMS: FaqItem[] = FAQ_CATEGORIES.flatMap((category) => category.items)

/**
 * Resolve ids to items, preserving the order given and skipping anything that no
 * longer exists. Silently dropping a stale id is deliberate: a mistyped id should
 * cost the homepage one teaser, not crash the page a visitor lands on first.
 */
export function faqItemsByIds(ids: readonly string[]): FaqItem[] {
	return ids
		.map((id) => ALL_FAQ_ITEMS.find((item) => item.id === id))
		.filter((item): item is FaqItem => item !== undefined)
}
