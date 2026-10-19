/**
 * The carat forecast: free carats over time, with a drop at each planned
 * banner. The data behind `CaratForecast`, kept pure so it can be tested
 * without rendering a chart.
 *
 * HOW THE LINE IS BUILT
 * ---------------------
 * Between banners the line is "what you hold today, plus everything earned
 * since, minus what earlier banners took": `offset + incomeTo(day)`, where
 * `incomeTo` is the engine's own function (utils/incomeProjection), so a day on
 * the chart and a banner row can never disagree about income.
 *
 * At each banner's end date the line meets that banner's row value (its
 * `freeCarats`, what the row's "Carats (Est.)" box shows), then drops by what
 * the row's pulls spend (`freeCaratsSpent`). The drop is drawn at the END date
 * because that is the checkpoint the row's number is measured at.
 *
 * WHY THE MARKER IS ANCHORED TO THE ROW, NOT DERIVED
 * --------------------------------------------------
 * The engine charges banners in START order (projectionWalkOrder); a timeline
 * runs in END order. They agree for ordinary banners, which run back to back.
 * They part ways only when one banner sits inside another's window (a long
 * banner that starts earlier and ends later). There the engine has already
 * charged the outer banner by the time the inner one is measured, while a time
 * axis has not reached the outer banner's end yet. Rather than letting a dot
 * float off the line or disagree with its row, each marker re-anchors the line
 * to the row's own number: if the two differ, the line steps straight to it.
 * The rows stay the source of truth, and the chart never invents a figure the
 * rows don't show.
 *
 * Everything is UTC midnights and instants (utils/utcDates), like the engine.
 */

import type { BannerResources } from "../hooks/bannerResources"
import type { IncomeProjection, WalkEntry } from "./incomeProjection"
import { isExcludedFromProjection } from "./rowOptions"
import { addUtcDays, utcDaysBetween } from "./utcDates"

/** One vertex of the line. `t` is epoch milliseconds. */
export interface ForecastPoint {
	t: number
	value: number
}

/** One planned banner on the chart, at its end date. */
export interface ForecastMarker {
	/** Position in `userPlannedBannerData`: the key every result is read by. */
	index: number
	t: number
	/** Free carats available for this banner: the row's own number. */
	before: number
	/** What is left once its pulls are paid for. */
	after: number
	/** Left out of the projection from its row options: shown, never charged. */
	excluded: boolean
}

export interface CaratForecast {
	start: number
	end: number
	points: ForecastPoint[]
	markers: ForecastMarker[]
}

/** How far past the last banner the line keeps going, in days. */
export const FORECAST_TAIL_DAYS = 30
/** The shortest span the chart ever draws, in days, so one near banner isn't a stub. */
export const FORECAST_MIN_DAYS = 60
/**
 * The most daily samples the line takes. Past this the step widens (two
 * days, three days...), so a plan reaching years out still costs a few hundred
 * engine calls rather than thousands. Markers are always exact.
 */
export const FORECAST_MAX_SAMPLES = 400

interface BuildParams {
	projection: Pick<IncomeProjection, "today" | "now" | "incomeTo">
	walkOrder: WalkEntry[]
	/** The engine's results, positional against userPlannedBannerData. */
	resources: BannerResources[]
	/** The free carats the user holds today (UserStats.current_carat). */
	currentFreeCarats: number
}

export function buildCaratForecast({
	projection,
	walkOrder,
	resources,
	currentFreeCarats,
}: BuildParams): CaratForecast | null {
	const { today, now, incomeTo } = projection
	const freeIncome = (at: Date) => incomeTo(at).freeCarats

	// A banner that has already ended is not on a forward-looking chart, but the
	// engine still charged it, and every later row is measured after that. So
	// its spend comes off the starting balance instead of being drawn.
	let offset = currentFreeCarats
	const upcoming: { entry: WalkEntry; walkPosition: number }[] = []
	walkOrder.forEach((entry, walkPosition) => {
		const charged = !isExcludedFromProjection(entry.banner)
		if (entry.endDate < now) {
			if (charged) offset -= resources[entry.index]?.freeCaratsSpent ?? 0
			return
		}
		upcoming.push({ entry, walkPosition })
	})
	if (upcoming.length === 0) return null

	// Time order for the axis; banners ending together keep the engine's order
	// so their drops stack the way the rows were charged.
	upcoming.sort(
		(a, b) =>
			a.entry.endDate.getTime() - b.entry.endDate.getTime() ||
			a.walkPosition - b.walkPosition
	)

	const lastEnd = upcoming[upcoming.length - 1].entry.endDate
	const horizon = addUtcDays(
		today,
		Math.max(FORECAST_MIN_DAYS, utcDaysBetween(today, lastEnd) + FORECAST_TAIL_DAYS)
	)
	const totalDays = utcDaysBetween(today, horizon)
	const step = Math.max(1, Math.ceil(totalDays / FORECAST_MAX_SAMPLES))

	const samples: Date[] = []
	for (let day = step; day < totalDays; day += step) samples.push(addUtcDays(today, day))
	samples.push(horizon)

	const points: ForecastPoint[] = [{ t: today.getTime(), value: offset + freeIncome(today) }]
	const markers: ForecastMarker[] = []

	let next = 0
	const placeMarkersUpTo = (limit: number) => {
		while (next < upcoming.length && upcoming[next].entry.endDate.getTime() <= limit) {
			const { entry } = upcoming[next++]
			const t = entry.endDate.getTime()
			const row = resources[entry.index]
			const excluded = isExcludedFromProjection(entry.banner)
			const before = row?.freeCarats ?? 0
			const expected = offset + freeIncome(entry.endDate)
			points.push({ t, value: expected })
			// Re-anchor to the row (see the module note). Usually a no-op.
			if (Math.abs(expected - before) >= 1) {
				offset += before - expected
				points.push({ t, value: before })
			}
			const spent = excluded ? 0 : row?.freeCaratsSpent ?? 0
			offset -= spent
			if (spent !== 0) points.push({ t, value: before - spent })
			markers.push({ index: entry.index, t, before, after: before - spent, excluded })
		}
	}

	for (const sample of samples) {
		placeMarkersUpTo(sample.getTime())
		// A banner ending exactly on a sample instant has already put the
		// value there (after its drop); a second point would be a duplicate.
		if (points[points.length - 1].t === sample.getTime()) continue
		points.push({ t: sample.getTime(), value: offset + freeIncome(sample) })
	}

	return { start: today.getTime(), end: horizon.getTime(), points, markers }
}

/** A carat count for display: whole, with thousands separators ("12,345"). */
export const formatCarats = (value: number) => Math.round(value).toLocaleString("en-US")
