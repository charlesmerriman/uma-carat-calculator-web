import { CalendarDays, Clock3, Sparkles, Ticket } from "lucide-react"
import PredictedBadge from "../PredictedBadge"
import type { BannerKey } from "../../utils/bannerHelpers"
import { formatDate } from "../../utils/dateFormat"
import { DateTimeRange } from "./DateTimeRange"
import { AnniversaryEventStrip } from "./AnniversaryEventStrip"
import { LegendRaceNote } from "./LegendRaceNote"
import { StoryEventStrip } from "./StoryEventStrip"
import { CopyTimelineLink } from "./CopyTimelineLink"
import { BannerSection } from "./BannerSection"
import type { DatedRelease } from "../../utils/dailyLegendRaces"
import type { StoryEvent } from "../../types"
import {
	TIMELINE_FOCUS_HIGHLIGHT,
	buildWindowSections,
	featuredTitle,
	getCountdownLabel,
} from "./timelineShared"
import { FOCUS_SCROLL_MARGIN } from "../../hooks/useFocusScroll"
import type { BannerWindowGroup, TimelineFocusProps } from "./timelineShared"
import type { BannerSupport, BannerUma, UserPlannedBanner } from "../../types"

/**
 * One timeline card: a date header, then one section per banner opening in that
 * window.
 *
 * Split out of Timeline.tsx when windows became groups. A card that renders N
 * banners instead of exactly one is too much JSX to keep inline in a component
 * that also owns paging, infinite scroll and search.
 *
 * See BannerWindowGroup for why concurrent banners are merged here rather than
 * in the database.
 *
 * The card is four files, one component each: this one (the header and the
 * list of sections), BannerSection (one banner: its chip, art and panels),
 * FeaturePanel (a panel of tiles and its Stage button) and FeaturedTile (one
 * uma or card). Which layout a section gets is `sectionLayout.ts`; what that
 * layout is, in widths and tracks, is `src/timeline.css`.
 */

type BannerWindowCardProps = {
	group: BannerWindowGroup
	today: Date
	plannedBannerKeys: Set<BannerKey>
	stagedBanners: UserPlannedBanner[]
	onAddBanner: (banner: BannerUma | BannerSupport, type: "Uma" | "Support") => void
	/** Daily legend race batches arriving with a banner in this window. */
	legendRaces?: DatedRelease[]
	/** Story events running with a banner in this window: the row beneath the card. */
	storyEvents?: StoryEvent[]
} & TimelineFocusProps

export function BannerWindowCard({
	group,
	today,
	plannedBannerKeys,
	stagedBanners,
	onAddBanner,
	legendRaces = [],
	storyEvents = [],
	focusRef,
	isFocused = false,
}: BannerWindowCardProps) {
	const countdownLabel = getCountdownLabel(group.start_date, group.end_date, today)
	// A campaign strip sits flush above the card, so the card's own top corners
	// have to square off or the two render as separate boxes with a seam between.
	const attachedEvent = group.anniversary_event
	// A step-up attaches to the campaign PART it runs in, so at most one banner
	// in this group carries any — flattening is how the group reaches them
	// without BannerWindowGroup having to hoist a second field.
	const stepUps = group.banners.flatMap((banner) => banner.banner_step_ups ?? [])
	const isGrouped = group.banners.length > 1
	// Usually one section per banner. The two halves of a staggered release
	// fuse into one — see buildWindowSections.
	const sections = buildWindowSections(group.banners)
	// Every section's names, both halves of a fused one included, so a
	// staggered release is titled by the pair.
	const title = featuredTitle(
		sections.flatMap((section) => section.umaWindow.banner_umas.flatMap((b) => b.umas.map((uma) => uma.name))),
		sections.flatMap((section) =>
			section.supportWindow.banner_supports.flatMap((b) => b.support_cards.map((card) => card.name))
		)
	)

	// How each side of a staggered release differs from the window in the
	// header, e.g. "Support banner starts 2026/10/27". A side that matches the
	// header says nothing.
	//
	// These live in the HEADER, and nowhere inside a section, on purpose. A line
	// inside a feature panel makes the panel taller, the art row stretches to
	// match, and the banner art grows with it. The header is outside that row, so
	// nothing here can change the size of the art or the panels.
	//
	// Drawn as a QUIET alert pill beside the countdown: an amber outline and an
	// amber icon around ordinary text. Enough to say "the header's range is not
	// the whole truth for this side" without outshouting the countdown. A filled
	// amber pill with a warning triangle was tried and was too loud. The icon is
	// the panel's own, so the pill points at the side it is about. The amber is
	// the staging token, already tuned per theme (see --color-staging in
	// index.css), so it never blends into a gold brand.
	const staggerNotes = sections.flatMap((section) => {
		if (!section.isStaggered) return []
		const sides = [
			{ label: "Umamusume banner", icon: Sparkles, row: section.umaWindow },
			{ label: "Support banner", icon: Ticket, row: section.supportWindow },
		]
		return sides.flatMap(({ label, icon, row }) => {
			const opensLater = row.start_date !== group.start_date
			const endsEarlier = row.end_date !== group.end_date
			const text =
				opensLater && endsEarlier
					? `${label} runs ${formatDate(row.start_date)} through ${formatDate(row.end_date)}`
					: opensLater ? `${label} starts ${formatDate(row.start_date)}`
						: endsEarlier ? `${label} ends ${formatDate(row.end_date)}`
							: null
			return text ? [{ text, icon }] : []
		})
	})

	return (
		// The ref goes on the outer wrapper so scrolling accounts for the campaign
		// strip above the panel; the ring goes on the panel, which is the box a
		// reader recognises as "the card" and the only one with the right rounding.
		<div ref={focusRef} className={`my-3 w-full px-2 ${FOCUS_SCROLL_MARGIN}`}>
			{attachedEvent && (
				<AnniversaryEventStrip event={attachedEvent} stepUps={stepUps} />
			)}
			<div
				className={`tl-card card-panel @container w-full overflow-hidden p-2 sm:p-3 ${
					attachedEvent ? "rounded-t-none" : ""
				} ${storyEvents.length > 0 ? "rounded-b-none" : ""} ${isFocused ? TIMELINE_FOCUS_HIGHLIGHT : ""}`}
			>
				<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex min-w-0 items-center gap-3">
						<div className="tl-icon-box flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-600 bg-gray-700 text-brand">
							<CalendarDays className="h-5 w-5" />
						</div>
						{title ? (
							// Names lead, dates follow (design polish item 20). The date
							// range stays one element with the same text, which is what
							// the Timeline tests find a card by.
							<div className="min-w-0">
								<h3 className="tl-title text-lg leading-snug font-semibold text-balance text-gray-100 sm:text-xl">{title}</h3>
								<div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-gray-400">
									<span>
										<DateTimeRange start={group.start_date} end={group.end_date} />
									</span>
									{group.is_predicted && <PredictedBadge />}
								</div>
							</div>
						) : (
							<div className="tl-title min-w-0 text-xl font-semibold text-gray-100 sm:text-2xl">
								<div className="flex flex-wrap items-center gap-2">
									<span>
										<DateTimeRange start={group.start_date} end={group.end_date} />
									</span>
									{group.is_predicted && <PredictedBadge />}
								</div>
							</div>
						)}
					</div>
					<div className="flex flex-wrap items-center gap-2">
						{legendRaces.map((release) => (
							<LegendRaceNote
								key={release.id}
								release={release}
								windowStartDate={group.start_date}
								now={today}
							/>
						))}
						{staggerNotes.map(({ text, icon: NoteIcon }) => (
							<div
								key={text}
								role="note"
								className="tl-pill flex w-fit items-center gap-2 rounded-full border border-staging/40 px-3 py-1 text-sm font-medium text-gray-200"
							>
								<NoteIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-staging" />
								<span>{text}</span>
							</div>
						))}
						{/* By the first banner: a window is found by ANY of its banners
						    (rowMatchesFocus), so any one of them names the card. */}
						<CopyTimelineLink
							focus={{ kind: "banner", id: group.banners[0].id }}
							name={title || `the banners from ${formatDate(group.start_date)}`}
						/>
						<div className="tl-pill tl-countdown flex w-fit items-center gap-2 rounded-full border border-gray-600 bg-gray-700 px-3 py-1 text-sm font-semibold text-gray-100">
							<span>{countdownLabel}</span>
							<Clock3 className="h-4 w-4 text-brand" />
						</div>
					</div>
				</div>

				{/* Sections are separated by a rule rather than nested panels: two
				    banners in one window are peers, and boxing each would add a
				    frame inside a frame. */}
				<div className="flex flex-col gap-4">
					{sections.map((section, index) => (
						<div
							key={section.primary.id}
							className={index > 0 ? "border-t border-gray-700/70 pt-4" : undefined}
						>
							<BannerSection
								section={section}
								isGrouped={isGrouped}
								groupStartDate={group.start_date}
								groupEndDate={group.end_date}
								today={today}
								plannedBannerKeys={plannedBannerKeys}
								stagedBanners={stagedBanners}
								onAddBanner={onAddBanner}
							/>
						</div>
					))}
				</div>
			</div>
			{/* Flush beneath the panel, outside it, so the art row above can't grow. */}
			{storyEvents.length > 0 && <StoryEventStrip events={storyEvents} />}
		</div>
	)
}
