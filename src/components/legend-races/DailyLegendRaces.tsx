import { useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ChevronDown, Search, Trophy } from "lucide-react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { useAccount } from "../../services/AuthContext"
import { useSiteContent } from "../../services/SiteContentContext"
import { MarkdownContent } from "../info/MarkdownContent"
import { FOCUS_TAILROOM, useFocusScroll } from "../../hooks/useFocusScroll"
import { useBackToTop } from "../../hooks/useBackToTop"
import { useOshiIds } from "../../hooks/useOshiIds"
import { FloatingBackToTop } from "../BackToTop"
import { formatDate } from "../../utils/dateFormat"
import {
	LEGEND_RACES_RELEASE_PARAM,
	arrivalCountdown,
	datedReleases,
	legendRacesReleaseHref,
	parseReleaseFocus,
	releaseByUmaId,
	splitByToday,
	tentativeReleases,
} from "../../utils/dailyLegendRaces"
import type { DailyLegendRaceRelease } from "../../types"
import { LegendRaceReleaseCard } from "./LegendRaceReleaseCard"

/** The heading while the page's admin row has not loaded. Mirrors the seed's title. */
const FALLBACK_TITLE = "Daily Legend Races"

/**
 * The Legend Races tab (route: /app/legend-races): when each batch of umas
 * joins the daily legend races, and how long grinding one of them takes.
 *
 * Top to bottom: the admin-written text (the grind guidance), a line per oshi (signed-in
 * supporters only), a search box, the batches still to come, the tentative
 * ones with no date yet, and the ones already out (collapsed, since the
 * reader came for what is next).
 *
 * Everything an editor might change comes from the API: the batches and
 * their umas (`daily_legend_race_data`), and the title and text (the
 * `daily-legend-races` site page, numbers included). The date rules live in
 * utils/dailyLegendRaces.ts.
 *
 * Inside the /app loading gate, so it is never prerendered and can read the
 * clock and the account freely. Its head tags come from AppRouteMeta.
 */
export const DailyLegendRaces = () => {
	const { dailyLegendRaceData } = useCalculatorData()
	const { account } = useAccount()
	const page = useSiteContent().page("daily-legend-races")
	const [searchParams] = useSearchParams()
	const [query, setQuery] = useState("")
	const [showAvailable, setShowAvailable] = useState(false)

	// One clock reading per mount, so every card measures from the same "now".
	const now = useMemo(() => new Date(), [])
	const dated = useMemo(() => datedReleases(dailyLegendRaceData), [dailyLegendRaceData])
	const { upcoming, available } = useMemo(() => splitByToday(dated, now), [dated, now])
	// Batches an editor entered before the timeline had a banner for them, so
	// they have no date. Listed in a section of their own, marked tentative.
	const tentative = useMemo(() => tentativeReleases(dailyLegendRaceData), [dailyLegendRaceData])

	// The oshis this account's tier covers (the first `oshi_slots`), the same
	// cut the account picture uses. A lapsed supporter keeps their rows but
	// not the perk, so the uncovered ones are left out here too.
	const coveredOshis = useMemo(
		() => (account ? account.oshis.slice(0, account.oshi_slots) : []),
		[account]
	)
	// The tiles' rainbow frame: every outfit of each covered favourite, the
	// set every page frames. The lines above the list stay one per pick.
	const oshiIds = useOshiIds()
	const oshiReleases = useMemo(() => {
		const byUma = releaseByUmaId<DailyLegendRaceRelease>([...dated, ...tentative])
		return coveredOshis.flatMap((oshi) => {
			const release = byUma.get(oshi.id)
			return release ? [{ oshi, release }] : []
		})
	}, [coveredOshis, dated, tentative])

	// A link to one batch (the pill on a Timeline banner card, or an oshi
	// line) names it in the URL. If that batch is already out, its list opens
	// for it. Adjusted during render, keyed on the target, so following a
	// second link opens the list again even after the reader closed it.
	const focusId = parseReleaseFocus(searchParams.get(LEGEND_RACES_RELEASE_PARAM))
	const [openedForFocus, setOpenedForFocus] = useState<number | null>(null)
	if (focusId !== openedForFocus) {
		setOpenedForFocus(focusId)
		if (focusId !== null && available.some((release) => release.id === focusId)) {
			setShowAvailable(true)
		}
	}

	// Search narrows each batch to the umas whose name matches, and hides a
	// batch with none. A batch with no umas entered yet still shows when there
	// is no query: its date is news on its own.
	const search = query.trim().toLowerCase()
	const narrow = <T extends DailyLegendRaceRelease>(releases: T[]): T[] =>
		search === ""
			? releases
			: releases
				.map((release) => ({
					...release,
					umas: release.umas.filter((uma) => uma.name.toLowerCase().includes(search)),
				}))
				.filter((release) => release.umas.length > 0)
	const shownUpcoming = narrow(upcoming)
	const shownTentative = narrow(tentative)
	const shownAvailable = narrow(available)
	const availableOpen = showAvailable || search !== ""

	const focusRef = useRef<HTMLElement | null>(null)
	const rendered = [...shownUpcoming, ...shownTentative, ...(availableOpen ? shownAvailable : [])]
	const focusIndex = focusId === null ? -1 : rendered.findIndex((release) => release.id === focusId)
	useFocusScroll(focusRef, focusIndex >= 0 ? focusId : null)
	// Room to scroll the last card to the top; see FOCUS_TAILROOM.
	const focusNeedsTailroom = focusIndex >= 0 && focusIndex === rendered.length - 1

	const { topRef, isAwayFromTop, scrollToTop } = useBackToTop()

	// Only the next two batches start open; every other card is its heading
	// line until tapped (design polish item 22a, see LegendRaceReleaseCard). A
	// search, or the batch a link names, opens a card regardless.
	const OPEN_UPCOMING = 2
	const renderCard = (release: DailyLegendRaceRelease, isAvailable: boolean, defaultOpen = false) => (
		<LegendRaceReleaseCard
			key={release.id}
			release={release}
			now={now}
			isAvailable={isAvailable}
			oshiIds={oshiIds}
			focusRef={release.id === focusId ? focusRef : undefined}
			isFocused={release.id === focusId}
			defaultOpen={defaultOpen}
			forceOpen={search !== "" || release.id === focusId}
		/>
	)

	return (
		<div className="mx-auto my-3 flex w-[calc(100%-1rem)] max-w-5xl flex-col gap-4 sm:w-[calc(100%-2rem)]">
			<header>
				{/* Scroll anchor for "back to top" — zero-height, so it costs no layout.
				    Inside the header rather than ahead of it, because the page root is a
				    flex column with gap-4: a sibling anchor would push the title down by a
				    gap's worth. Here it marks the same spot for free. */}
				<div ref={topRef} aria-hidden="true" />
				<h1 className="font-display flex items-center gap-2 text-xl font-bold text-brand">
					<Trophy className="h-5 w-5 shrink-0" />
					{page?.title ?? FALLBACK_TITLE}
				</h1>
				{/* No loading state for the intro: the batches below are the page,
				    and they are already here. The words fill in when they land. */}
				{page && (
					<div className="text-sm">
						<MarkdownContent markdown={page.body} paragraphClassName="mt-1 leading-relaxed text-gray-300" />
					</div>
				)}
			</header>

			{oshiReleases.length > 0 && (
				<section aria-labelledby="legend-races-oshis" className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3">
					<h2 id="legend-races-oshis" className="text-sm font-semibold text-gray-100">
						Your favourites
					</h2>
					<ul className="mt-1 space-y-0.5 text-sm text-gray-300">
						{oshiReleases.map(({ oshi, release }) => {
							// Null for an oshi in a tentative batch: she is on the
							// list, but nobody knows when yet.
							const start = release.start_date === null ? null : new Date(release.start_date)
							return (
								<li key={oshi.id}>
									<span className="font-medium text-gray-100">{oshi.name}</span>
									{start === null
										? ": no date yet ("
										: start.getTime() <= now.getTime()
											? ": in the daily races now ("
											: `: joins ${formatDate(release.start_date)}, ${arrivalCountdown(start, now)} (`}
									<Link
										to={legendRacesReleaseHref(release.id)}
										className="text-brand transition hover:text-brand/75"
									>
										{release.name}
									</Link>
									)
								</li>
							)
						})}
					</ul>
				</section>
			)}

			<div className="relative w-full sm:w-72">
				<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
				<input
					type="search"
					aria-label="Search umas"
					placeholder="Search umas..."
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					className="w-full rounded-lg border border-gray-600 bg-gray-800 py-2 pl-9 pr-3 text-sm text-gray-100 placeholder-gray-500 focus:border-brand focus:outline-none"
				/>
			</div>

			<section aria-labelledby="legend-races-upcoming" className="flex flex-col gap-3">
				<h2 id="legend-races-upcoming" className="text-base font-semibold text-gray-100">
					Coming up
				</h2>
				{shownUpcoming.length > 0 ? (
					shownUpcoming.map((release, index) => renderCard(release, false, index < OPEN_UPCOMING))
				) : (
					<p className="text-sm text-gray-500">
						{search !== ""
							? "No upcoming batch has an uma by that name."
							: "No batches are scheduled yet. Check back after the next one is announced."}
					</p>
				)}
			</section>

			{/* No empty line of its own: with nothing to list, or nothing a
			    search matches, the whole section steps aside. */}
			{shownTentative.length > 0 && (
				<section aria-labelledby="legend-races-tentative" className="flex flex-col gap-3">
					<div>
						<h2 id="legend-races-tentative" className="text-base font-semibold text-gray-100">
							No date yet
						</h2>
						<p className="text-sm text-gray-400">
							These batches are tentative. The date isn't known yet, and who is in them could
							change.
						</p>
					</div>
					{shownTentative.map((release) => renderCard(release, false))}
				</section>
			)}

			{available.length > 0 && (
				<section aria-labelledby="legend-races-available" className="flex flex-col gap-3">
					<h2 id="legend-races-available">
						<button
							type="button"
							aria-expanded={availableOpen}
							onClick={() => setShowAvailable((open) => !open)}
							// While a search is running the list stays open, so the
							// toggle would do nothing visible; it waits until the box is clear.
							disabled={search !== ""}
							className="flex items-center gap-1.5 text-base font-semibold text-gray-100 transition hover:text-brand disabled:cursor-default disabled:hover:text-gray-100"
						>
							<ChevronDown
								className={`h-4 w-4 shrink-0 transition-transform ${availableOpen ? "" : "-rotate-90"}`}
								aria-hidden="true"
							/>
							{/* The count follows the search, so it matches the cards
							    listed under it and not the total behind the filter. */}
							Already in the daily races ({shownAvailable.length})
						</button>
					</h2>
					{availableOpen &&
						(shownAvailable.length > 0 ? (
							shownAvailable.map((release) => renderCard(release, true))
						) : (
							<p className="text-sm text-gray-500">No batch already out has an uma by that name.</p>
						))}
				</section>
			)}

			{focusNeedsTailroom && <div aria-hidden="true" className={FOCUS_TAILROOM} />}

			<FloatingBackToTop onClick={scrollToTop} visible={isAwayFromTop} column="64rem" />
		</div>
	)
}
