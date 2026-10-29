/**
 * The timeline card for a race event — a Champions Meeting or a League of Heroes
 * event.
 *
 * One component for both because the two models hold identical data (course
 * details) and are meant to present identically.
 * This started as the Champions Meeting branch inlined in Timeline.tsx; it was
 * lifted out rather than copied so the two can't drift into "almost the same
 * card" — the failure mode where a tweak lands on one and quietly misses the
 * other.
 *
 * Nothing here reads `event_type`. That tag exists to narrow the *union*, not to
 * branch on inside the card: if this component ever needs to know which type it
 * has, the two have stopped being the same card and should be split again.
 */

import { BookOpen, Clock3, Loader2, Trophy } from "lucide-react"
import { Link } from "react-router-dom"
import PredictedBadge from "../PredictedBadge"
import { DateTimeRange } from "./DateTimeRange"
import { BannerArtPlaceholder } from "./BannerArtPlaceholder"
import { TIMELINE_FOCUS_HIGHLIGHT, getCountdownLabel } from "./timelineShared"
import { CourseDetails } from "./CourseDetails"
import { CopyTimelineLink } from "./CopyTimelineLink"
import { availableCourseDetails, courseDetails } from "../../utils/courseDetails"
import { pvpEventHref, refForRaceEvent } from "../../utils/pvpEvent"
import { FOCUS_SCROLL_MARGIN } from "../../hooks/useFocusScroll"
import { useRaceParticipation } from "../../hooks/useRaceParticipation"
import { ToggleSwitch } from "../ToggleSwitch"
import type { RefObject } from "react"
import type { RaceEvent } from "../../types"

/**
 * `focusRef` and `isFocused`, like the other cards. The ref goes to whichever
 * row the Timeline is anchored on (a search can leave a race event on top);
 * the ring marks the card a deep link named, which for a race event is the
 * PvP page's "View on Timeline" (?focus=cm-12 / loh-7).
 */
export function RaceEventCard({
	event,
	today,
	focusRef,
	isFocused = false,
}: {
	event: RaceEvent
	today: Date
	focusRef?: RefObject<HTMLDivElement | null>
	isFocused?: boolean
}) {
	const availableTrackDetails = availableCourseDetails(event)
	const hasPendingDetails = availableTrackDetails.length !== courseDetails(event).length
	const hasEventDetails = availableTrackDetails.length > 0
	const countdownLabel = getCountdownLabel(event.start_date, event.end_date, today)
	// Null when there's nothing to switch (see the hook), and the switch is
	// simply not drawn.
	const participation = useRaceParticipation(event)
	const skipped = participation?.participating === false

	return (
		<div ref={focusRef} className={`my-3 w-full px-2 ${FOCUS_SCROLL_MARGIN}`}>
			<div
				className={`card-panel @container w-full overflow-hidden rounded-xl p-2 sm:p-3 ${
					isFocused ? TIMELINE_FOCUS_HIGHLIGHT : ""
				}`}
			>
				<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex min-w-0 items-center gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-600 bg-gray-700 text-brand">
							<Trophy className="h-5 w-5" />
						</div>
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<h2 className="text-xl font-semibold text-gray-100 sm:text-2xl">{event.name}</h2>
								{event.is_predicted && <PredictedBadge />}
							</div>
							<p className="mt-0.5 text-sm text-gray-400">
								<DateTimeRange start={event.start_date} end={event.end_date} />
							</p>
							{skipped && (
								<p className="mt-0.5 text-sm text-gray-400">
									You're skipping this one, so its rewards aren't counted in your income.
								</p>
							)}
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						{/* Only when a guide is PUBLISHED (has_guide). The href comes from
						    the shared helper, so this card still never reads event_type. */}
						{event.has_guide && (
							<Link
								to={pvpEventHref(refForRaceEvent(event))}
								className="flex w-fit items-center gap-1.5 rounded-full border border-brand/50 bg-brand/10 px-3 py-1 text-sm font-semibold text-brand transition hover:bg-brand/20"
							>
								<BookOpen className="h-4 w-4" />
								PvP guide
							</Link>
						)}
						{participation && (
							<div
								className="flex w-fit items-center gap-2 rounded-full border border-gray-600 bg-gray-700 py-0.5 pl-3 pr-1 text-sm font-semibold text-gray-100"
								title="Turn this off if you won't play it. Its rewards then stay out of your projected income."
							>
								<span>Taking part</span>
								<ToggleSwitch
									checked={participation.participating}
									onChange={participation.setParticipating}
									ariaLabel={`Taking part in ${event.name}`}
								/>
							</div>
						)}
						{/* A race ref is already a TimelineFocus (cm-12 / loh-3). */}
						<CopyTimelineLink focus={refForRaceEvent(event)} name={event.name} />
						<div className="flex w-fit items-center gap-2 rounded-full border border-gray-600 bg-gray-700 px-3 py-1 text-sm font-semibold text-gray-100">
							<span>{countdownLabel}</span>
							<Clock3 className="h-4 w-4 text-brand" />
						</div>
					</div>
				</div>

				{hasPendingDetails && (
					<div className="mb-4 flex items-center gap-2 rounded-lg border border-brand/25 bg-brand/5 px-3 py-2 text-sm text-gray-300">
						<Loader2 className="h-4 w-4 shrink-0 text-brand" />
						<span>Some course details are coming soon.</span>
					</div>
				)}

				{/*
				 * The art track is `--timeline-art-width`, the same width the banner
				 * cards' art has (see App.css and BANNER_ART). This used to be the
				 * banner row's 1.28fr weight against one gap instead of two, which
				 * came out 6px wider than the banners above and below it. The
				 * details panel takes the rest. Without details the art sits alone
				 * and centred, still at the shared width from xl up.
				 */}
				<div className={hasEventDetails
					? "grid gap-4 xl:grid-cols-[minmax(360px,var(--timeline-art-width))_minmax(500px,1fr)] xl:items-stretch"
					: "mx-auto max-w-[41rem] xl:w-[var(--timeline-art-width)]"}
				>
					<div className="min-w-0">
						{event.image ? (
							/* 16:9 declared so the box is reserved before the image
							   loads; object-contain keeps an off-ratio asset
							   letterboxed rather than stretched. See BANNER_ART. */
							<img
								src={event.image}
								alt={event.name}
								loading="lazy"
								decoding="async"
								className="aspect-[16/9] h-auto w-full object-contain rounded-xl"
							/>
						) : (
							<BannerArtPlaceholder />
						)}
					</div>

					{hasEventDetails && (
						<div className="flex min-w-0 flex-col gap-4">
							<CourseDetails event={event} />

						</div>
					)}
				</div>
			</div>
		</div>
	)
}
