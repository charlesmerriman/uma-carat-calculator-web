/**
 * The scenario a plan runs up to, for the post dialog's "Runs up to X" line
 * BEFORE the plan is posted. The server works the posted value out itself
 * (backend plan_gallery.range_for) and this mirrors its rule, so the line
 * says what the post will say:
 *
 *   the newest scenario that has started by the end of the plan's last
 *   counted banner (rows left out of the projection don't count)
 *
 * Both dates are the site's own (the ones the Timeline shows), so nothing is
 * guessed. Null when no counted row has a banner, or no scenario has started
 * by then.
 */

import type { Scenario, UserPlannedBanner } from "../types"
import { plannedBannerTarget } from "./bannerHelpers"

export function planRange(rows: UserPlannedBanner[], scenarios: Scenario[]): Scenario | null {
	let lastEnd = -Infinity
	for (const row of rows) {
		if (row.excluded_from_projection) continue
		const target = plannedBannerTarget(row)
		if (target.type === "Empty" || !target.timeline.end_date) continue
		lastEnd = Math.max(lastEnd, new Date(target.timeline.end_date).getTime())
	}
	if (lastEnd === -Infinity) return null
	let best: Scenario | null = null
	let bestStart = -Infinity
	for (const scenario of scenarios) {
		// The server counts only a scenario tied to a launch banner, the source of its date.
		if (scenario.banner_timeline === null || !scenario.start_date) continue
		const start = new Date(scenario.start_date).getTime()
		if (start <= lastEnd && start > bestStart) {
			best = scenario
			bestStart = start
		}
	}
	return best
}
