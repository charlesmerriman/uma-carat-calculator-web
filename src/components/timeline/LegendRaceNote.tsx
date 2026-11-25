import { Link } from "react-router-dom"
import { ArrowUpRight, Trophy } from "lucide-react"
import { formatDate } from "../../utils/dateFormat"
import { legendRacesReleaseHref } from "../../utils/dailyLegendRaces"
import type { DatedRelease } from "../../utils/dailyLegendRaces"

/**
 * "11 umas join daily legend races", on the card of the banner a batch
 * arrives with. Links to that batch on the Legend Races tab.
 *
 * A pill in the card HEADER, beside the countdown, for the same reason the
 * staggered-release notes live there: the header sits outside the art row, so
 * nothing here can change the size of the art or the panels. A batch used to
 * be a card of its own in the stream, which floated between unrelated cards
 * with three short lines in a full-width box.
 *
 * The date is spelled out only when it differs from the window's, which is
 * the batches that land a day or three after their banner opens.
 *
 * Past tense once the batch is out ("16 umas joined"): with past events
 * shown, the Timeline lists banners from months ago, and "join" on one of
 * those reads as still to come. Judged against `now`, the same instant rule
 * the Legend Races page splits its two lists on (splitByToday).
 */
export const LegendRaceNote = ({
	release,
	windowStartDate,
	now,
}: {
	release: DatedRelease
	windowStartDate: string
	now: Date
}) => {
	const count = release.umas.length
	const sameDay = formatDate(release.start_date) === formatDate(windowStartDate)
	const isOut = new Date(release.start_date).getTime() <= now.getTime()
	const verb = isOut ? "joined" : count === 1 ? "joins" : "join"
	const label =
		count > 0
			? `${count} ${count === 1 ? "uma" : "umas"} ${verb} daily legend races`
			: "Daily legend races"

	return (
		<Link
			to={legendRacesReleaseHref(release.id)}
			title={`${release.name}: see who ${isOut ? "joined" : "joins"}`}
			data-size="md"
			className="tl-pill gap-2 border-legend-race/50 bg-legend-race/10 font-medium text-gray-200 transition hover:bg-legend-race/20"
		>
			<Trophy aria-hidden="true" className="h-4 w-4 shrink-0 text-legend-race" />
			<span>
				{label}
				{!sameDay && ` ${formatDate(release.start_date)}`}
			</span>
			<ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-legend-race" />
		</Link>
	)
}
