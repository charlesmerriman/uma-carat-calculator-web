import { Sparkles } from "lucide-react"
import PredictedBadge from "../PredictedBadge"
import { BannerArtPlaceholder } from "./BannerArtPlaceholder"
import { formatDate } from "../../utils/dateFormat"
import { TIMELINE_FOCUS_HIGHLIGHT } from "./timelineShared"
import { FOCUS_SCROLL_MARGIN } from "../../hooks/useFocusScroll"
import type { TimelineFocusProps, TimelineMarker } from "./timelineShared"

/**
 * The timeline card for a scenario launch or a campaign opening — and the
 * paired card for the two arriving together (EventMarkerPairCard).
 *
 * One body for both kinds, the way RaceEventCard serves Champions Meeting
 * and League of Heroes without ever branching on which it holds. The single
 * branch here is on whether the marker HAS an end date, not on its kind: a
 * scenario has none (it stays playable after release, so there is nothing to
 * close), while a campaign states its window.
 *
 * A missing image is the expected state, not a degraded one — scenarios get
 * entered while a feature is being built and the art lands later. The
 * placeholder is a designed fallback, the same call the step-up rows already
 * made in the planner.
 */

/**
 * `icon` is optional: a scenario chip carries no icon, so its label and the
 * brand accent alone distinguish it from a campaign.
 */
const MARKER_CHROME: Record<
	TimelineMarker["kind"],
	{ icon?: typeof Sparkles; label: string; accent: string }
> = {
	scenario: {
		label: "New scenario",
		accent: "border-brand/50 bg-brand/15 text-brand",
	},
	anniversary: {
		icon: Sparkles,
		label: "Campaign",
		accent: "border-gray-600 bg-gray-700/70 text-gray-200",
	},
}

/**
 * The wrapper and panel every marker card sits in, alone or paired.
 *
 * The SAME two boxes as BannerWindowCard and RaceEventCard, class for class:
 * an outer `my-3 w-full px-2` that carries the ref and the scroll margin, and
 * the `card-panel` inside it padded `p-2 sm:p-3`, which carries the ring. A
 * marker card used to be its own root with wider padding and no wrapper, and
 * sat visibly wider than every banner card around it. The gutter and padding
 * are not styling choices here; they are what lines the panel edges up.
 */
const CARD_WRAPPER = `my-3 w-full px-2 ${FOCUS_SCROLL_MARGIN}`

/**
 * `tinted` is the scenario's brand edge: a lone scenario card carries it, and
 * so does a pair, because a pair always holds one.
 */
const panelClass = (tinted: boolean, isFocused: boolean): string =>
	`card-panel @container w-full overflow-hidden rounded-xl p-2 sm:p-3 ${
		tinted ? "border-brand/40" : ""
	} ${isFocused ? TIMELINE_FOCUS_HIGHLIGHT : ""}`

/**
 * A marker's contents without the panel: chip, name, dates, art.
 *
 * Split from the panel so the same body can sit alone in a card or side by
 * side with another in EventMarkerPairCard, with no second copy of the chip
 * or art rules to drift.
 *
 * `artAlign` follows BannerWindowCard's rule for its own art: centred when
 * the art has a full-width row to itself (there is no edge to align to, so
 * hard left reads as a bug), hard left when there is a column edge beside
 * it — which a pair always has.
 */
const EventMarkerBody = ({
	marker,
	artAlign,
}: {
	marker: TimelineMarker
	artAlign: "center" | "start"
}) => {
	const chrome = MARKER_CHROME[marker.kind]
	const Icon = chrome.icon
	// A scenario announces a change in how the game is played, so it gets the
	// louder heading; a campaign is a recurring sale and sits quieter.
	const isScenario = marker.kind === "scenario"

	return (
		<>
			<div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
				<span
					className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${chrome.accent}`}
				>
					{Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
					{chrome.label}
				</span>
				<h3
					className={`min-w-0 font-bold text-gray-100 ${
						isScenario ? "text-xl sm:text-2xl" : "text-lg"
					}`}
				>
					{marker.name}
				</h3>
				{marker.isPredicted && <PredictedBadge />}
			</div>

			<p className="mb-3 text-sm text-gray-300">
				{marker.endDate
					? `${formatDate(marker.startDate)} through ${formatDate(marker.endDate)}`
					// No end, and none is coming — see TimelineMarker.endDate.
					: `Releases ${formatDate(marker.startDate)}`}
			</p>

			{/*
			 * Capped on WIDTH and never on height: the art is 16:9, and a height
			 * clamp on a definite percentage width squashes the picture rather
			 * than fitting it. Same rule as the banner art.
			 *
			 * The 16:9 is also DECLARED, so the box exists before the image
			 * loads and nothing below it moves when it does — see BANNER_ART in
			 * BannerWindowCard for why that matters to the planner's deep links.
			 *
			 * Centred or hard left per `artAlign`; see the component note.
			 *
			 * From xl up the art is `--timeline-art-width`, the width every
			 * banner card's art has (see App.css): resolved against the panel
			 * through its `@container`, so it holds inside the pair's half-width
			 * column too. Below xl the cap matches BANNER_ART, so a marker's art
			 * is never wider than a banner's there either.
			 */}
			<div
				className={`max-w-[41rem] xl:w-[var(--timeline-art-width)] ${
					artAlign === "center" ? "mx-auto" : ""
				}`}
			>
				{marker.image ? (
					<img
						src={marker.image}
						alt={marker.name}
						loading="lazy"
						decoding="async"
						className="aspect-[16/9] h-auto w-full object-contain rounded-xl"
					/>
				) : (
					<BannerArtPlaceholder />
				)}
			</div>
		</>
	)
}

export const EventMarkerCard = ({
	marker,
	focusRef,
	isFocused = false,
}: { marker: TimelineMarker } & TimelineFocusProps) => (
	<div ref={focusRef} className={CARD_WRAPPER}>
		<div className={panelClass(marker.kind === "scenario", isFocused)}>
			<EventMarkerBody marker={marker} artAlign="center" />
		</div>
	</div>
)

/**
 * A scenario and the campaign it launched with, in one panel.
 *
 * Campaign on the left and scenario on the right, even though the scenario
 * sorts first as a lone card. Read left to right the panel then says "the
 * anniversary, and with it a new scenario", which is how the launch is
 * announced; and the campaign's 16:9 art is the wider, heavier image, so it
 * anchors the panel from the leading edge while the scenario's cut-out sits
 * lighter beside it.
 *
 * Two columns from the medium breakpoint with a rule between them; below it
 * the halves stack in that same order with the rule turned horizontal, so a
 * phone reads the pair as the two cards it replaces. One focus ring for the
 * whole panel: a deep link to either half lands on the launch they share, and
 * `rowMatchesFocus` already answers for both.
 */
export const EventMarkerPairCard = ({
	scenario,
	anniversary,
	focusRef,
	isFocused = false,
}: {
	scenario: TimelineMarker
	anniversary: TimelineMarker
} & TimelineFocusProps) => (
	<div ref={focusRef} className={CARD_WRAPPER}>
		<div className={panelClass(true, isFocused)}>
			{/*
			 * Three tracks, not two: the middle one is the rule, sized by its own
			 * width so the halves stay equal. minmax(0, 1fr) rather than 1fr so a
			 * long name wraps inside its column instead of widening it — the same
			 * job min-w-0 does on the cells.
			 */}
			<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-6">
				<div className="min-w-0">
					<EventMarkerBody marker={anniversary} artAlign="start" />
				</div>
				{/*
				 * The divider. Stacked, it is a short centred horizontal rule between
				 * the halves; side by side, a one-pixel column stretched to the row
				 * and inset top and bottom, so it separates the two without walling
				 * the panel in half.
				 */}
				<div
					aria-hidden="true"
					className="mx-auto h-px w-2/3 bg-gray-600 md:mx-0 md:my-4 md:h-auto md:w-px md:self-stretch"
				/>
				<div className="min-w-0">
					<EventMarkerBody marker={scenario} artAlign="start" />
				</div>
			</div>
		</div>
	</div>
)
