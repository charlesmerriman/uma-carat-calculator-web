/**
 * The pure half of the Legend Races page: which batches show, how they split
 * around today, and how a batch's umas group by star count. The grind
 * guidance is admin-written page text, not maths.
 *
 * No React here, so every rule is tested on its own (see
 * __tests__/dailyLegendRaces.test.ts) and the page is mostly wiring.
 *
 * Nothing here feeds the carat projection. Pieces buy nothing it counts.
 */

import { differenceInCalendarDays } from "date-fns"
import type { DailyLegendRaceRelease, DailyLegendRaceUma } from "../types/dailyLegendRace"

/** A release that has a date: on the Timeline, and in the page's two dated lists. */
export type DatedRelease = DailyLegendRaceRelease & { start_date: string }

/**
 * A release with no date yet. An editor entered it before the timeline had a
 * banner to link it to, so there is nothing to date it from. The page lists
 * these as tentative; the Timeline cannot show them at all.
 */
export type TentativeRelease = DailyLegendRaceRelease & { start_date: null }

/**
 * Drop the undated releases and sort the rest by date, soonest first.
 *
 * Undated is normal (see `tentativeReleases`). The API already sorts, but
 * the page sorts again so it never depends on that.
 */
export function datedReleases(releases: DailyLegendRaceRelease[]): DatedRelease[] {
	return releases
		.filter((release): release is DatedRelease => release.start_date !== null)
		.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
}

/**
 * The releases with no date, for the page's "No date yet" list.
 *
 * In the order they were entered (by id). There is no date to sort on, and
 * by name "6.5th Anniversary" would come before "6th Anniversary".
 *
 * One with no umas is left out: no date and nobody in it is nothing to show.
 * The API already holds those back, so this only guards an older one.
 */
export function tentativeReleases(releases: DailyLegendRaceRelease[]): TentativeRelease[] {
	return releases
		.filter(
			(release): release is TentativeRelease =>
				release.start_date === null && release.umas.length > 0
		)
		.sort((a, b) => a.id - b.id)
}

/**
 * Split dated releases around `now`. A release is out once its instant has
 * passed, the same rule the Timeline uses for a scenario (no end date, so the
 * start is all there is to judge it on).
 *
 * `upcoming` stays soonest first. `available` is NEWEST first, because the
 * batch a player most likely missed is the latest one.
 */
export function splitByToday(
	releases: DatedRelease[],
	now: Date
): { upcoming: DatedRelease[]; available: DatedRelease[] } {
	const upcoming: DatedRelease[] = []
	const available: DatedRelease[] = []
	for (const release of releases) {
		if (new Date(release.start_date).getTime() > now.getTime()) upcoming.push(release)
		else available.push(release)
	}
	return { upcoming, available: available.reverse() }
}

export interface RarityGroup {
	rarity: 1 | 2 | 3
	umas: DailyLegendRaceUma[]
}

/**
 * A batch's umas grouped ★3, ★2, ★1, keeping only the groups that have
 * someone in them. Order within a group is the API's (by name).
 */
export function rarityGroups(umas: DailyLegendRaceUma[]): RarityGroup[] {
	return ([3, 2, 1] as const)
		.map((rarity) => ({ rarity, umas: umas.filter((uma) => uma.rarity === rarity) }))
		.filter((group) => group.umas.length > 0)
}

/**
 * Past this many days a countdown stops counting days. Three months is about
 * where "in 97 days" stops being something a reader plans around.
 */
const APPROXIMATE_AFTER_DAYS = 90

/** The average month, in days (365.25 / 12). Only used to round a countdown. */
const DAYS_PER_MONTH = 30.44

/**
 * "today", "tomorrow", "in 12 days", then "in about 6 months" and "in about
 * 2.5 years", for a release that has not arrived.
 *
 * Calendar days in the viewer's own time, like the Timeline's countdown
 * badge (getCountdownLabel), so the count agrees with the date printed
 * beside it, which formatDate also renders locally.
 *
 * Far-off dates are rounded on purpose. Nearly all of them are estimates, and
 * "in 720 days" claims a precision the date beside it does not have. Months
 * up to two years, then years to the nearest half:
 *
 *   75 days  -> "in 75 days"
 *   193 days -> "in about 6 months"
 *   594 days -> "in about 20 months"
 *   720 days -> "in about 2 years"
 *   900 days -> "in about 2.5 years"
 */
export function arrivalCountdown(start: Date, now: Date): string {
	const days = differenceInCalendarDays(start, now)
	if (days <= 0) return "today"
	if (days === 1) return "tomorrow"
	if (days <= APPROXIMATE_AFTER_DAYS) return `in ${days} days`

	const months = Math.round(days / DAYS_PER_MONTH)
	if (months < 24) return `in about ${months} months`
	// Halves of a year: 29 months is 2.5, 33 months is 3 (written "3", not "3.0").
	const years = Math.round(months / 6) / 2
	return `in about ${years} years`
}

/**
 * Dated releases by the banner they arrive with, for the Timeline, which
 * shows each one as a note on that banner's card. A release with no banner
 * is undated anyway, so `datedReleases` has already dropped it.
 */
export function legendRacesByBanner(releases: DailyLegendRaceRelease[]): Map<number, DatedRelease[]> {
	const byBanner = new Map<number, DatedRelease[]>()
	for (const release of datedReleases(releases)) {
		if (release.banner_timeline == null) continue
		byBanner.set(release.banner_timeline, [...(byBanner.get(release.banner_timeline) ?? []), release])
	}
	return byBanner
}

/**
 * Which release each uma joins, by uma id. For the oshi strip, which covers
 * dated and tentative batches alike, hence the generic.
 */
export function releaseByUmaId<T extends DailyLegendRaceRelease>(releases: T[]): Map<number, T> {
	const byUma = new Map<number, T>()
	for (const release of releases) {
		for (const uma of release.umas) byUma.set(uma.id, release)
	}
	return byUma
}

/** The Legend Races route. */
const LEGEND_RACES_PATH = "/app/legend-races"

/**
 * The query parameter naming one release card, for the Timeline note's
 * link. A parameter and not a `#hash` for the reason given in
 * utils/selectorsFocus.ts: the browser acts on a hash only for a document it
 * is loading, and this is a client-side route change. One kind of target, so
 * no kind prefix (the same call selectorsFocus makes).
 */
export const LEGEND_RACES_RELEASE_PARAM = "release"

/** The `to` for a react-router `<Link>` to one release's card. */
export function legendRacesReleaseHref(releaseId: number): string {
	return `${LEGEND_RACES_PATH}?${LEGEND_RACES_RELEASE_PARAM}=${releaseId}`
}

/**
 * Parse a `release` parameter, or null for anything unrecognised. Same rules
 * as parseCampaignFocus: off the URL, so a malformed value degrades to "no
 * target", and `Number("")` is 0, which the positivity check turns away.
 */
export function parseReleaseFocus(raw: string | null | undefined): number | null {
	if (!raw) return null
	const id = Number(raw)
	return Number.isInteger(id) && id > 0 ? id : null
}
