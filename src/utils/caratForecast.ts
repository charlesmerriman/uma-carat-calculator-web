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
import type { IncomeLedgerRow } from "../types/ledger"
import type { UserPlannedBanner } from "../types"
import type { MaxPullBreakdown } from "./bannerHelpers"
import { plannedBannerTarget } from "./bannerHelpers"
import type { IncomeProjection, WalkEntry } from "./incomeProjection"
import { isExcludedFromProjection } from "./rowOptions"
import { addUtcDays, utcDaysBetween } from "./utcDates"

/** One vertex of the line. `t` is epoch milliseconds. */
export interface ForecastPoint {
	t: number
	/** Free carats: the carats view's line. */
	value: number
	/** Paid carats, uma and support tickets: what the pulls lines are made of. */
	paid: number
	umaTickets: number
	supportTickets: number
	/**
	 * Set on the vertex where a banner's dot sits (its row's own numbers,
	 * before its spend): the position in `markers`.
	 */
	marker?: number
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
	/** Paid carats available for this banner, and left after it (its row's own). */
	paidBefore: number
	paidAfter: number
	/**
	 * A step-up: it spends paid carats only, so its dot sits on the paid
	 * layer's top edge, not on the free line it never moves.
	 */
	stepUp: boolean
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
	/** What else they hold today. Absent means none. */
	currentPaidCarats?: number
	currentUmaTickets?: number
	currentSupportTickets?: number
}

/**
 * The four balances the chart tracks. Free carats draw the carats view;
 * all four make the pulls lines. Each one is built the same way: income from
 * the engine, re-anchored to the row at every banner, minus that row's spend.
 */
interface Balances {
	free: number
	paid: number
	uma: number
	support: number
}

const CHANNELS = ["free", "paid", "uma", "support"] as const
const add = (a: Balances, b: Balances): Balances => ({
	free: a.free + b.free,
	paid: a.paid + b.paid,
	uma: a.uma + b.uma,
	support: a.support + b.support,
})
const subtract = (a: Balances, b: Balances): Balances => ({
	free: a.free - b.free,
	paid: a.paid - b.paid,
	uma: a.uma - b.uma,
	support: a.support - b.support,
})

/** What a row's pulls take from each balance: tickets from its own kind only. */
function rowSpend(entry: WalkEntry, row: BannerResources | undefined): Balances {
	if (!row || isExcludedFromProjection(entry.banner)) return { free: 0, paid: 0, uma: 0, support: 0 }
	const isUma = plannedBannerTarget(entry.banner).type === "Uma"
	return {
		free: row.freeCaratsSpent,
		paid: row.paidCaratsSpent,
		uma: isUma ? row.ticketsSpent : 0,
		support: isUma ? 0 : row.ticketsSpent,
	}
}

export function buildCaratForecast({
	projection,
	walkOrder,
	resources,
	currentFreeCarats,
	currentPaidCarats = 0,
	currentUmaTickets = 0,
	currentSupportTickets = 0,
}: BuildParams): CaratForecast | null {
	const { today, now, incomeTo } = projection
	const income = (at: Date): Balances => {
		const i = incomeTo(at)
		return { free: i.freeCarats, paid: i.paidCarats, uma: i.umaTickets, support: i.supportTickets }
	}
	const toPoint = (t: number, b: Balances): ForecastPoint => ({
		t,
		value: b.free,
		paid: b.paid,
		umaTickets: b.uma,
		supportTickets: b.support,
	})

	// A banner that has already ended is not on a forward-looking chart, but the
	// engine still charged it, and every later row is measured after that. So
	// its spend comes off the starting balances instead of being drawn.
	let offset: Balances = {
		free: currentFreeCarats,
		paid: currentPaidCarats,
		uma: currentUmaTickets,
		support: currentSupportTickets,
	}
	const upcoming: { entry: WalkEntry; walkPosition: number }[] = []
	walkOrder.forEach((entry, walkPosition) => {
		if (entry.endDate < now) {
			offset = subtract(offset, rowSpend(entry, resources[entry.index]))
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

	const points: ForecastPoint[] = [toPoint(today.getTime(), add(offset, income(today)))]
	const markers: ForecastMarker[] = []

	let next = 0
	const placeMarkersUpTo = (limit: number) => {
		while (next < upcoming.length && upcoming[next].entry.endDate.getTime() <= limit) {
			const { entry } = upcoming[next++]
			const t = entry.endDate.getTime()
			const row = resources[entry.index]
			const excluded = isExcludedFromProjection(entry.banner)
			const expected = add(offset, income(entry.endDate))
			const before: Balances = row
				? { free: row.freeCarats, paid: row.paidCarats, uma: row.umaTickets, support: row.supportTickets }
				: expected
			points.push(toPoint(t, expected))
			// Re-anchor to the row (see the module note). Usually a no-op.
			if (CHANNELS.some((k) => Math.abs(expected[k] - before[k]) >= 1)) {
				offset = add(offset, subtract(before, expected))
				points.push(toPoint(t, before))
			}
			points[points.length - 1].marker = markers.length
			const spent = rowSpend(entry, row)
			offset = subtract(offset, spent)
			if (CHANNELS.some((k) => spent[k] !== 0)) points.push(toPoint(t, subtract(before, spent)))
			markers.push({
				index: entry.index,
				t,
				before: before.free,
				after: before.free - spent.free,
				excluded,
				paidBefore: before.paid,
				paidAfter: before.paid - spent.paid,
				stepUp: plannedBannerTarget(entry.banner).type === "StepUp",
			})
		}
	}

	for (const sample of samples) {
		placeMarkersUpTo(sample.getTime())
		// A banner ending exactly on a sample instant has already put the
		// values there (after its drop); a second point would be a duplicate.
		if (points[points.length - 1].t === sample.getTime()) continue
		points.push(toPoint(sample.getTime(), add(offset, income(sample))))
	}

	return { start: today.getTime(), end: horizon.getTime(), points, markers }
}

/** A carat count for display: whole, with thousands separators ("12,345"). */
export const formatCarats = (value: number) => Math.round(value).toLocaleString("en-US")

// ── The pulls view ────────────────────────────────────────────────────────────

/**
 * One planned banner's pulls: what its row affords, without free pulls. Named
 * for the bars the pulls view first drew; it is now the dot on that banner's
 * line (buildPullSeries).
 */
export interface PullBar {
	marker: ForecastMarker
	/**
	 * The row's Max Pulls WITHOUT the banner's own free pulls (owner,
	 * 2026-10-19): what the player's tickets and carats can buy. Free pulls
	 * come with the banner whatever you hold, so counting them would flatter
	 * every banner that has them.
	 */
	pulls: number
	breakdown: MaxPullBreakdown
}

/**
 * One per upcoming banner, in the forecast's own (end date) order.
 *
 * Read straight off the rows (`maxPullBreakdown`), never recomputed, so a dot
 * and its row cannot disagree. A step-up is left out: its row counts steps,
 * not pulls, and it spends paid carats only.
 */
export function buildPullBars(
	markers: ForecastMarker[],
	resources: BannerResources[],
	banners: UserPlannedBanner[]
): PullBar[] {
	return markers.flatMap((marker) => {
		const banner = banners[marker.index]
		const row = resources[marker.index]
		if (!banner || !row || plannedBannerTarget(banner).type === "StepUp") return []
		const { tickets, paidPulls, freeCaratPulls } = row.maxPullBreakdown
		return [{
			marker,
			pulls: tickets + paidPulls + freeCaratPulls,
			breakdown: row.maxPullBreakdown,
		}]
	})
}

// ── Skipped PvP events ────────────────────────────────────────────────────────

/** A skipped Champions Meeting or League of Heroes, placed on the line. */
export interface SkipMarker {
	t: number
	/** The line's value at that instant, so the dot sits on the line. */
	value: number
	name: string
	kind: IncomeLedgerRow["kind"]
}

/**
 * The line's value at an instant: straight-line between the two vertices
 * around it, the way the line is drawn. At an instant with several vertices
 * (a banner's arrival and drop) the last one wins: what is left after it.
 */
export function forecastValueAt<P extends { t: number }>(
	points: P[],
	t: number,
	read: (point: P) => number = (point) => (point as unknown as ForecastPoint).value
): number {
	let before = points[0]
	for (const point of points) {
		if (point.t > t) {
			if (point.t === before.t) return read(before)
			const share = (t - before.t) / (point.t - before.t)
			return read(before) + share * (read(point) - read(before))
		}
		before = point
	}
	return read(before)
}

/**
 * A dot for each skipped event whose payout falls inside the chart, on the
 * line at the instant it would have paid. `rows` come from
 * upcomingSkippedRaces (utils/raceParticipation), read off the FULL ledger.
 */
export function buildSkipMarkers(
	forecast: CaratForecast,
	rows: IncomeLedgerRow[]
): SkipMarker[] {
	return rows.flatMap((row) => {
		const t = new Date(row.date).getTime()
		if (t < forecast.start || t > forecast.end) return []
		return [{ t, value: forecastValueAt(forecast.points, t), name: row.name, kind: row.kind }]
	})
}

// ── The pulls lines ───────────────────────────────────────────────────────────

/** The player's settings that decide what a day's balances can pull. */
export interface PullSettings {
	/** Carats per pull (calculation_constants.pull_cost_carats). */
	pullCost: number
	/** "Full-price paid pulls": paid carats buy pulls at the normal price. */
	fullPricePaidPulls: boolean
	/** "Spend tickets on banners": matching tickets count as pulls. */
	spendTickets: boolean
}

/** One vertex of the two pulls lines. */
export interface PullPoint {
	t: number
	uma: number
	support: number
	/** On a banner's dot: its bar (the row's number) and which line it sits on. */
	bar?: PullBar
	kind?: "uma" | "support"
}

/**
 * Pulls a balance can buy, as the player's settings allow. Never below zero:
 * a carat debt is no pulls, not negative pulls.
 *
 * The daily discounted pull is left out between banners: it exists only while
 * a banner runs (one per day of its window). At a banner the line meets the
 * row's own number instead, which counts it, so a dot can sit a little above
 * the line where it arrives.
 */
function pullsFrom(point: ForecastPoint, tickets: number, settings: PullSettings): number {
	const free = Math.floor(Math.max(0, point.value) / settings.pullCost)
	const paid = settings.fullPricePaidPulls ? Math.floor(Math.max(0, point.paid) / settings.pullCost) : 0
	return free + paid + (settings.spendTickets ? Math.max(0, tickets) : 0)
}

/**
 * The pulls view: two lines, day by day like the carats view (owner,
 * 2026-10-19). "Uma pulls" counts carats and uma tickets, "Support pulls"
 * carats and support tickets, because a banner can only spend its own kind.
 * Free pulls are never counted: they come with a banner, whatever you hold.
 *
 * At each banner's dot vertex, that banner's own line takes the row's number
 * (its Max Pulls without free pulls, from `bars`) so dot and row agree; the
 * other line keeps the daily figure. A step-up has no bar, so no dot here.
 */
export function buildPullSeries(
	forecast: CaratForecast,
	bars: PullBar[],
	banners: UserPlannedBanner[],
	settings: PullSettings
): PullPoint[] {
	const barByMarker = new Map(bars.map((bar) => [forecast.markers.indexOf(bar.marker), bar]))
	return forecast.points.map((point) => {
		const result: PullPoint = {
			t: point.t,
			uma: pullsFrom(point, point.umaTickets, settings),
			support: pullsFrom(point, point.supportTickets, settings),
		}
		const bar = point.marker === undefined ? undefined : barByMarker.get(point.marker)
		if (bar) {
			const banner = banners[bar.marker.index]
			const kind = banner && plannedBannerTarget(banner).type === "Uma" ? "uma" : "support"
			result[kind] = bar.pulls
			result.bar = bar
			result.kind = kind
		}
		return result
	})
}
