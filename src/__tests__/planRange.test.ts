/** planRange: the post dialog's "Runs up to X", the server's range_for rule mirrored. */

import { describe, expect, it } from "vitest"
import { planRange } from "../utils/planRange"
import type { BannerUma, Scenario, UserPlannedBanner } from "../types"

const scenario = (id: number, start: string | null, timeline: number | null = id): Scenario =>
	({ id, name: `S${id}`, image: null, banner_timeline: timeline, start_date: start, is_predicted: false, applied_offset_days: 0 })

const row = (end: string, extra: Partial<UserPlannedBanner> = {}): UserPlannedBanner =>
	({
		tempId: Math.random(),
		number_of_pulls: 200,
		reserved_copies: 0,
		banner_uma: { id: 1, name: "B", umas: [], banner_timeline: { start_date: "2026-01-01T12:00:00Z", end_date: end } } as unknown as BannerUma,
		...extra,
	}) as UserPlannedBanner

const SCENARIOS = [scenario(1, "2026-01-10T12:00:00Z"), scenario(2, "2026-03-10T12:00:00Z"), scenario(3, "2026-06-10T12:00:00Z")]

describe("planRange", () => {
	it("is the newest scenario started by the last counted banner's end", () => {
		expect(planRange([row("2026-02-01T12:00:00Z"), row("2026-04-01T12:00:00Z")], SCENARIOS)?.id).toBe(2)
	})

	it("leaves out rows outside the projection", () => {
		const rows = [row("2026-02-01T12:00:00Z"), row("2026-07-01T12:00:00Z", { excluded_from_projection: true })]
		expect(planRange(rows, SCENARIOS)?.id).toBe(1)
	})

	it("counts a scenario that starts on the banner's last moment", () => {
		expect(planRange([row("2026-03-10T12:00:00Z")], SCENARIOS)?.id).toBe(2)
	})

	it("is null with no counted banner, or before any scenario", () => {
		expect(planRange([], SCENARIOS)).toBeNull()
		expect(planRange([row("2025-12-01T12:00:00Z")], SCENARIOS)).toBeNull()
	})

	it("skips an undated scenario and one with no launch banner, as the server does", () => {
		const scenarios = [scenario(1, "2026-01-10T12:00:00Z"), scenario(4, null), scenario(5, "2026-01-20T12:00:00Z", null)]
		expect(planRange([row("2026-02-01T12:00:00Z")], scenarios)?.id).toBe(1)
	})
})
