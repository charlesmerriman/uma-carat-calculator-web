import { useState, type RefObject } from "react"
import { Link } from "react-router-dom"
import { ChevronDown, CircleDashed } from "lucide-react"
import PredictedBadge from "../PredictedBadge"
import { FOCUS_SCROLL_MARGIN } from "../../hooks/useFocusScroll"
import { TIMELINE_FOCUS_HIGHLIGHT } from "../timeline/timelineShared"
import { formatDate } from "../../utils/dateFormat"
import { timelineFocusHref } from "../../utils/timelineFocus"
import { arrivalCountdown, rarityGroups, splitOutfit } from "../../utils/dailyLegendRaces"
import type { DailyLegendRaceRelease, DailyLegendRaceUma } from "../../types"
import { FramedUma } from "../FramedUma"

const STARS: Record<1 | 2 | 3, string> = { 1: "★", 2: "★★", 3: "★★★" }

/**
 * One uma: her card art with her name under it. The name is visible because
 * the point of the page is "is MY uma in this batch".
 *
 * An alternate outfit ("Mejiro McQueen (Anime)") gets its outfit on a line of
 * its own. The outfit is the only thing that tells two versions of one uma
 * apart, and it sits at the END of the name, so clamping the whole name to
 * two lines cut off exactly that part. Each half is clamped separately now,
 * which still stops a long name stretching its row. The full name is the
 * tile's tooltip in case either half does get cut.
 */
const UmaTile = ({ uma, isOshi }: { uma: DailyLegendRaceUma; isOshi: boolean }) => {
	const { base, outfit } = splitOutfit(uma.name)
	return (
		// A fixed width from `sm` up, where the tiles are a wrapping flex row
		// (see the list below). On a phone the list is a grid and sizes them.
		<li title={uma.name} className="flex min-w-0 flex-col items-center gap-1 sm:w-22">
			{/* The borderless art in the site's frame; a favourite gets the
			    rainbow one. */}
			<FramedUma src={uma.portrait ?? uma.image} oshi={isOshi} className="w-full" />
			<span className="text-center text-xs leading-tight text-gray-300">
				<span className="line-clamp-2">{base}</span>
				{outfit && <span className="line-clamp-2 text-[0.6875rem] text-gray-400">{outfit}</span>}
				{isOshi && <span className="sr-only"> (your favourite)</span>}
			</span>
		</li>
	)
}

/**
 * Marks a batch that has no date yet. Built like PredictedBadge so the two
 * read as one family, but grey and dashed: "Estimated" is a date we worked
 * out, this is no date at all.
 */
const TentativeBadge = () => (
	<span
		title="Not confirmed. The date isn't known yet, and who is in the batch could change."
		className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-400 px-2 py-0.5 text-xs font-semibold text-gray-300"
	>
		<CircleDashed className="h-3 w-3" aria-hidden="true" />
		Tentative
	</span>
)

/**
 * One batch of umas joining the daily legend races: the name, date and badges
 * on one line, then the umas grouped ★3 / ★2 / ★1. The grind guidance is the
 * page's intro text, said once, not on every card.
 *
 * A batch with no date (`start_date` null) is TENTATIVE: an editor entered it
 * before the timeline had a banner for it. It says "No date yet" where the
 * date goes, wears the Tentative badge and a dashed border, and has no
 * countdown and no Timeline link, since there is no banner card to link to.
 * The card says all that itself, not just the section heading above it,
 * because a search or a deep link can show the card on its own.
 *
 * FOLDED BY DEFAULT past the next two batches (design polish item 22a): with
 * every batch open the page ran to about 6,000px on a phone, through 2029. A
 * folded card is its heading line (name, date, badges, countdown) and a
 * "Show N umas" toggle. `defaultOpen` is the first state only; `forceOpen`
 * (a running search, or the batch a link names) opens it whatever the reader
 * chose, because then the umas ARE the answer. The list stays in the DOM with
 * `hidden`, so folding costs no remount and a test can still read it.
 */
export const LegendRaceReleaseCard = ({
	release,
	now,
	isAvailable,
	oshiIds,
	focusRef,
	isFocused = false,
	defaultOpen = true,
	forceOpen = false,
}: {
	release: DailyLegendRaceRelease
	now: Date
	isAvailable: boolean
	oshiIds: ReadonlySet<number>
	focusRef?: RefObject<HTMLElement | null>
	isFocused?: boolean
	defaultOpen?: boolean
	forceOpen?: boolean
}) => {
	const start = release.start_date === null ? null : new Date(release.start_date)
	const headingId = `legend-race-release-${release.id}`
	const listId = `${headingId}-umas`
	const [open, setOpen] = useState(defaultOpen)
	const expanded = forceOpen || open
	const umaCount = release.umas.length

	return (
		<section
			ref={focusRef}
			aria-labelledby={headingId}
			className={`card-panel p-3 sm:p-4 ${FOCUS_SCROLL_MARGIN} ${
				start === null ? "border-dashed" : ""
			} ${isFocused ? TIMELINE_FOCUS_HIGHLIGHT : ""}`}
		>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				<h3 id={headingId} className="text-lg font-bold text-gray-100">
					{release.name}
				</h3>
				{start === null ? (
					<>
						<span className="text-sm text-gray-400">No date yet</span>
						<TentativeBadge />
					</>
				) : (
					<>
						<span className="text-sm text-gray-400">{formatDate(release.start_date)}</span>
						{release.is_predicted && <PredictedBadge />}
						{!isAvailable && (
							<span className="rounded-full border border-legend-race/50 bg-legend-race/15 px-2.5 py-0.5 text-xs font-semibold text-legend-race">
								{arrivalCountdown(start, now)}
							</span>
						)}
					</>
				)}
				<div className="ml-auto flex items-center gap-3">
					{release.banner_timeline != null && (
						<Link
							to={timelineFocusHref({ kind: "banner", id: release.banner_timeline })}
							className="text-sm text-brand transition hover:text-brand/75"
						>
							On the Timeline
						</Link>
					)}
					{/* No toggle while forced open: it would do nothing visible. */}
					{umaCount > 0 && !forceOpen && (
						<button
							type="button"
							aria-expanded={expanded}
							aria-controls={listId}
							onClick={() => setOpen((value) => !value)}
							className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm text-gray-300 transition hover:bg-gray-700 hover:text-gray-100"
						>
							{expanded ? "Hide umas" : `Show ${umaCount} uma${umaCount === 1 ? "" : "s"}`}
							<ChevronDown
								className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
								aria-hidden="true"
							/>
						</button>
					)}
				</div>
			</div>

			{umaCount > 0 && (
				// Star groups stack on a phone. From `sm` up they sit side by side
				// when a whole group fits beside the last one, so a batch like
				// "five ★3 and one ★2" is one row of tiles and not two. That works
				// because each group is a flex item as wide as its tiles: a group
				// that does not fit drops to the next line, and one wider than the
				// card shrinks to it and wraps its own tiles.
				<div id={listId} hidden={!expanded} className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-6">
					{rarityGroups(release.umas).map((group) => (
						<div key={group.rarity}>
							<h4 className="mb-1.5 text-sm font-semibold text-brand">
								<span aria-hidden="true">{STARS[group.rarity]}</span>
								<span className="sr-only">{group.rarity} star</span>
							</h4>
							{/* A fluid grid on a phone, so the tiles fill the row. A
							    wrapping flex row of fixed-width tiles from `sm` up: an
							    auto-fill grid has no width of its own, so a group built
							    from one could not size itself to its tiles. */}
							<ul className="grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-x-2 gap-y-3 sm:flex sm:flex-wrap">
								{group.umas.map((uma) => (
									<UmaTile key={uma.id} uma={uma} isOshi={oshiIds.has(uma.id)} />
								))}
							</ul>
						</div>
					))}
				</div>
			)}
		</section>
	)
}
