import { describe, expect, it } from "vitest"
import { cardReleases, releaseBlockReason, releaseNote, releaseStatus } from "../utils/cardRelease"
import type { BannerSupport, BannerUma } from "../types"

/** Libra Cup runs Nov 1 to Nov 8 (UTC noon, so local dates read the same). */
const EVENT = { start_date: "2026-11-01T12:00:00Z", end_date: "2026-11-08T12:00:00Z" }
const at = (iso: string) => Date.parse(iso)

describe("cardRelease", () => {
	it("takes a card's first banner, so a rerun never makes it new", () => {
		const banner = (start: string, ids: number[]) =>
			({ banner_timeline: { start_date: start }, umas: ids.map((id) => ({ id })) }) as unknown as BannerUma
		const supports = [
			{ banner_timeline: { start_date: "2026-10-01T12:00:00Z" }, support_cards: [{ id: 9 }] },
		] as unknown as BannerSupport[]
		const releases = cardReleases(
			[banner("2026-11-20T12:00:00Z", [1]), banner("2026-09-01T12:00:00Z", [1, 2])],
			supports
		)
		expect(releases.umas.get(1)).toBe(at("2026-09-01T12:00:00Z"))
		expect(releases.supports.get(9)).toBe(at("2026-10-01T12:00:00Z"))
		expect(releases.umas.has(3)).toBe(false)
	})

	it("is available before the start, during up to the end, after past it", () => {
		expect(releaseStatus(at("2026-10-20T12:00:00Z"), EVENT)).toEqual({ kind: "available" })
		expect(releaseStatus(at("2026-11-01T12:00:00Z"), EVENT)).toEqual({ kind: "available" })
		expect(releaseStatus(at("2026-11-05T12:00:00Z"), EVENT)).toEqual({ kind: "during", date: "2026/11/5" })
		expect(releaseStatus(at("2026-11-08T12:00:00Z"), EVENT).kind).toBe("during")
		expect(releaseStatus(at("2026-11-09T12:00:00Z"), EVENT)).toEqual({ kind: "after", date: "2026/11/9" })
	})

	it("counts a card on no banner as available", () => {
		expect(releaseStatus(undefined, EVENT)).toEqual({ kind: "available" })
	})

	it("words the block and the note", () => {
		expect(releaseBlockReason({ kind: "after", date: "2026/11/9" })).toBe("Out 2026/11/9, after this event")
		expect(releaseBlockReason({ kind: "during", date: "2026/11/5" })).toBeNull()
		expect(releaseNote({ kind: "during", date: "2026/11/5" })).toBe("Out 2026/11/5, during this event")
		expect(releaseNote({ kind: "available" })).toBeNull()
	})
})
