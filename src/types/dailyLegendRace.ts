/**
 * Daily legend race types.
 *
 * A release is a batch of umas joining the Daily Legend Races, usually with an
 * anniversary. Once in, each uma has her own race, once a day, forever, so a
 * player can grind several at once. Before that, an uma's only source of
 * pieces was her original limited Legend Race event.
 *
 * Nothing here touches the projection: pieces buy nothing the calculator
 * counts. The page and the pill on a Timeline banner card read it, nothing else.
 */

/** One uma tile. Mirrors DailyLegendRaceUmaSerializer. */
export interface DailyLegendRaceUma {
	id: number
	name: string
	image: string | null
	/** The borderless art (else the bordered), for FramedUma. Optional for older fixtures. */
	portrait?: string | null
	/**
	 * Initial star count, 1-3. Resolved on the server (a blank rarity counts
	 * as 3), so the client groups on it as-is and never repeats that rule.
	 */
	rarity: 1 | 2 | 3
}

/** Mirrors DailyLegendRaceReleaseSerializer. */
export interface DailyLegendRaceRelease {
	id: number
	/** "2nd Anniversary" */
	name: string
	/** Optional art. Not shown anywhere, and not on the admin form either. */
	image: string | null
	/**
	 * The banner this batch arrives with, as a bare id. The Timeline puts the
	 * batch on that banner's card. Null for a TENTATIVE batch: one an editor
	 * entered before the timeline had a banner for it.
	 */
	banner_timeline: number | null
	/**
	 * The banner's resolved start plus the release's own day offset, or null
	 * when the release has no banner yet. A null start is a tentative batch:
	 * the Legend Races page lists it with no date (`tentativeReleases()`), and
	 * the Timeline, which needs a date and a banner, leaves it out
	 * (`datedReleases()`).
	 *
	 * No `end_date`, and the API sends none. A batch arrives and stays.
	 */
	start_date: string | null
	is_predicted: boolean
	applied_offset_days: number
	/** Sorted by the server: ★3 first, then by name. */
	umas: DailyLegendRaceUma[]
}
