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

import { Clock3, Loader2, MapPinned, Trophy } from "lucide-react"
import PredictedBadge from "../PredictedBadge"
import { formatDate } from "../../utils/dateFormat"
import { BannerArtPlaceholder } from "./BannerArtPlaceholder"
import { getCountdownLabel } from "./timelineShared"
import { FOCUS_SCROLL_MARGIN } from "../../hooks/useFocusScroll"
import type { RefObject } from "react"
import type { RaceEvent } from "../../types"

// Course details are entered by hand in the admin and are unknown until the
// event is announced. The models' columns are non-null, so "unknown" is encoded
// as a sentinel rather than an absent value: text fields are seeded with "TBD"
// and the stat recommendations with 0. Keep each slot visible and translate
// those sentinels into a useful, consistent pending state.
function isTrackDetailAvailable(value: string | null | undefined): boolean {
	if (value == null) return false
	const trimmed = value.trim()
	return trimmed !== "" && trimmed.toUpperCase() !== "TBD"
}

function trackDetailValue(value: string | null | undefined): string {
	return isTrackDetailAvailable(value) ? value!.trim() : "Not announced"
}

/**
 * `focusRef` without an `isFocused` counterpart, unlike the other two cards.
 *
 * A race event can never be a DEEP LINK target — nothing links to one, and
 * `rowMatchesFocus` excludes the kind outright — so there is no arrival ring to
 * draw here and accepting the flag would only make that look possible. It can
 * still be the row the Timeline is ANCHORED on, though: a search matches race
 * events by name and track, so clearing the box may well leave one at the top of
 * the screen. Those are two different jobs sharing one ref, and only the second
 * applies to this card.
 */
export function RaceEventCard({
	event,
	today,
	focusRef,
}: {
	event: RaceEvent
	today: Date
	focusRef?: RefObject<HTMLDivElement | null>
}) {
	const trackDetails = [
		{ label: "Racecourse", value: event.track },
		{ label: "Surface", value: event.surface_type },
		{ label: "Distance", value: event.distance },
		{ label: "Length", value: event.length },
		{ label: "Direction", value: event.direction },
		{ label: "Track condition", value: event.track_condition },
		{ label: "Season", value: event.season },
		{ label: "Weather", value: event.weather },
	]
	const availableTrackDetails = trackDetails.filter((detail) =>
		isTrackDetailAvailable(detail.value)
	)
	const hasPendingDetails = availableTrackDetails.length !== trackDetails.length
	const hasEventDetails = availableTrackDetails.length > 0
	const countdownLabel = getCountdownLabel(event.start_date, event.end_date, today)

	return (
		<div ref={focusRef} className={`my-3 w-full px-2 ${FOCUS_SCROLL_MARGIN}`}>
			<div className="card-panel @container w-full overflow-hidden rounded-xl p-2 sm:p-3">
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
								{formatDate(event.start_date)} through {formatDate(event.end_date)}
							</p>
						</div>
					</div>
					<div className="flex w-fit items-center gap-2 rounded-full border border-gray-600 bg-gray-700 px-3 py-1 text-sm font-semibold text-gray-100">
						<span>{countdownLabel}</span>
						<Clock3 className="h-4 w-4 text-brand" />
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
							{availableTrackDetails.length > 0 && (
								<section className="rounded-xl border border-gray-600 bg-gray-800 p-3 shadow-sm">
									<div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand">
										<MapPinned className="h-4 w-4" />
										<span>Course details</span>
									</div>
									<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
										{availableTrackDetails.map((detail) => (
											<div key={detail.label} className="min-w-0 rounded-lg border border-gray-600/80 bg-gray-700/70 px-2 py-1.5">
												<div className="text-xs font-medium uppercase tracking-wide text-gray-400">{detail.label}</div>
												<div className="mt-0.5 truncate text-sm font-semibold text-gray-100">
													{trackDetailValue(detail.value)}
												</div>
											</div>
										))}
									</div>
								</section>
							)}

						</div>
					)}
				</div>
			</div>
		</div>
	)
}

export default RaceEventCard
