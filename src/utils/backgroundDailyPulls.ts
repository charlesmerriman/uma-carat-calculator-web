/**
 * Daily pulls on the banners OUTSIDE the plan.
 *
 * Every uma and support banner has its own once-a-day pull for 50 PAID carats.
 * A whale takes it on every banner that runs, whether or not they want its
 * cards, and those carats are gone before the banners they DO want arrive. The
 * two gear-menu switches (`daily_pulls_other_uma_banners`,
 * `daily_pulls_other_support_banners`, both off by default) model that.
 *
 * WHICH BANNERS
 * -------------
 * A "background banner" is a catalogue banner of a switched-on kind that no
 * COUNTED row of the plan targets. A row left out of the projection does not
 * count (owner, 2026-10-19): it no longer spends through the Discounted Paid
 * Pulls switch, so its banner gets the background pull like any other. The two
 * features never overlap: a counted row's own daily pull stays with the
 * Discounted Paid Pulls switch and the row's options.
 *
 * A step-up is never a background banner. It has no daily pull, and it is not
 * in the uma/support catalogues anyway.
 *
 * HOW MANY DAYS
 * -------------
 * From today (inclusive) to the end of the plan's farthest counted banner, the
 * HORIZON, clipped to the banner's own window. Today, not the banner's start:
 * the paid balance the player typed in already reflects the days that have
 * gone. A planned row counts from its banner's start instead, so its allowance
 * doesn't shrink while it runs; the two differ on purpose. Past the horizon
 * nothing is charged, because no row is measured after it.
 *
 * HOW MUCH
 * --------
 * Not decided here. The engine (useBannerResources) walks these alongside the
 * rows, in start order, and takes `min(days, paid available / cost)` pulls at
 * each one. Paid carats only, and never more than there are: a background
 * banner cannot put the plan into debt, it just stops when the paid carats do.
 */

import { isExcludedFromProjection } from "./rowOptions"
import { startOfUtcDay, utcDaysBetween } from "./utcDates"
import type { WalkEntry } from "./incomeProjection"
import type { BannerSupport, BannerUma, UserStats } from "../types"

export interface BackgroundBanner {
	kind: "uma" | "support"
	/** The catalogue banner's id (BannerUma.id or BannerSupport.id). */
	bannerId: number
	/** The banner's own start: what places it in the walk. */
	startDate: Date
	/**
	 * Where its daily pulls stop: its own end, or the horizon if that comes
	 * first. The income it can spend is measured up to here.
	 */
	endDate: Date
	/** Daily pulls it may take, before the paid balance caps them. At least 1. */
	days: number
}

interface BackgroundBannersParams {
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	/** The plan's rows that have a date, as projectionWalkOrder returns them. */
	walkOrder: WalkEntry[]
	stats: Pick<UserStats, "daily_pulls_other_uma_banners" | "daily_pulls_other_support_banners">
	/** UTC midnight today: where the day count starts. */
	today: Date
	/** The live instant: a banner that has already closed takes no pull. */
	now: Date
}

/**
 * The background banners of a plan, in no particular order (the engine sorts
 * them into its walk). Empty when both switches are off, which is what keeps
 * every projection unchanged for anyone who hasn't opted in.
 */
export function backgroundBanners({
	umaBannerData,
	supportBannerData,
	walkOrder,
	stats,
	today,
	now,
}: BackgroundBannersParams): BackgroundBanner[] {
	// `=== true`: an API older than these fields sends nothing, and that must
	// read as off, the default.
	const umaOn = stats.daily_pulls_other_uma_banners === true
	const supportOn = stats.daily_pulls_other_support_banners === true
	if (!umaOn && !supportOn) return []

	const counted = walkOrder.filter((entry) => !isExcludedFromProjection(entry.banner))
	// No counted row, no horizon: nothing is measured, so nothing to charge.
	if (counted.length === 0) return []
	const horizon = new Date(Math.max(...counted.map((entry) => entry.endDate.getTime())))

	// The banners a counted row already takes part in. A step-up row adds
	// nothing here; it still sets the horizon above.
	const plannedUma = new Set<number>()
	const plannedSupport = new Set<number>()
	for (const { banner } of counted) {
		if (banner.banner_uma) plannedUma.add(banner.banner_uma.id)
		if (banner.banner_support) plannedSupport.add(banner.banner_support.id)
	}

	const result: BackgroundBanner[] = []
	const consider = (kind: BackgroundBanner["kind"], bannerId: number, start: string, end: string) => {
		const startDate = new Date(start)
		const ownEnd = new Date(end)
		// Already closed (it may have ended earlier today), or not open until
		// after the plan's last banner: no pull that any row would feel.
		if (ownEnd <= now || startDate > horizon) return
		const endDate = ownEnd < horizon ? ownEnd : horizon
		// Inclusive calendar days, like the planned rows' allowance, but from
		// whichever is later: the banner's start or today.
		const firstDay = startDate > today ? startOfUtcDay(startDate) : today
		const days = utcDaysBetween(firstDay, endDate) + 1
		if (days < 1) return
		result.push({ kind, bannerId, startDate, endDate, days })
	}

	if (umaOn) {
		for (const banner of umaBannerData) {
			if (plannedUma.has(banner.id) || !banner.banner_timeline) continue
			consider("uma", banner.id, banner.banner_timeline.start_date, banner.banner_timeline.end_date)
		}
	}
	if (supportOn) {
		for (const banner of supportBannerData) {
			if (plannedSupport.has(banner.id) || !banner.banner_timeline) continue
			consider("support", banner.id, banner.banner_timeline.start_date, banner.banner_timeline.end_date)
		}
	}
	return result
}
