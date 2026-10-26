import { describe, expect, it } from "vitest"
import { readVeteranFile, stripOtherPlayers, toImportItem } from "../utils/gameImport/umadumpVeterans"

/**
 * Reading umadump's trained_chara_data.json. The fixture is hand-written in
 * the shape of umadump's published example (the game's own veteran object),
 * with another player's id in a parent so the test can prove it never leaves
 * the device while everything else does (owner, 2026-10-26).
 */

const veteran = (trainedCharaId: number, cardId: number, extra: Record<string, unknown> = {}) => ({
	viewer_id: 311943848596,
	memo: "my best girl",
	owner_viewer_id: 0,
	trained_chara_id: trainedCharaId,
	card_id: cardId,
	speed: 1200,
	stamina: 800,
	power: 1000,
	guts: 400,
	wiz: 900,
	rank_score: 15210,
	proper_ground_turf: 8,
	proper_ground_dirt: 1,
	proper_distance_short: 3,
	proper_distance_mile: 7,
	proper_distance_middle: 7,
	proper_distance_long: 6,
	proper_running_style_nige: 2,
	proper_running_style_senko: 7,
	proper_running_style_sashi: 6,
	proper_running_style_oikomi: 4,
	skill_array: [{ skill_id: 100061, level: 4 }, { skill_id: 200331, level: 1 }, { skill_id: 999999, level: 1 }],
	create_time: "2026-10-01 12:00:00",
	succession_chara_array: [{ owner_viewer_id: 123456789, card_id: 100101 }],
	...extra,
})

// The catalogue's game ids -> the site's ids.
const UMAS = new Map([[100601, 41], [100401, 42]])
const SKILLS = new Map([[100061, 7], [200331, 9]])

describe("readVeteranFile", () => {
	it("builds import rows from the fields it reads, the game's names mapped", () => {
		const result = readVeteranFile([veteran(12, 100601)], UMAS, SKILLS)
		if (!result.ok) throw new Error(result.error)
		const { game_data: _raw, ...columns } = toImportItem(result.veterans[0])
		expect(columns).toEqual({
			import_key: 12,
			uma: 41,
			rank_score: 15210,
			speed: 1200, stamina: 800, power: 1000, guts: 400, wit: 900,
			apt: { turf: 8, dirt: 1, short: 3, mile: 7, medium: 7, long: 6, front: 2, pace: 7, late: 6, end: 4 },
			skills: [{ skill: 7, level: 4 }, { skill: 9, level: 1 }],
		})
	})

	it("keeps everything, your own id and memo included, but never another player's id", () => {
		const result = readVeteranFile([veteran(12, 100601)], UMAS, SKILLS)
		if (!result.ok) throw new Error(result.error)
		const item = toImportItem(result.veterans[0])
		expect(item.game_data.viewer_id).toBe(311943848596)
		expect(item.game_data.memo).toBe("my best girl")
		expect(item.game_data.create_time).toBe("2026-10-01 12:00:00")
		expect(item.game_data.succession_chara_array).toEqual([{ card_id: 100101 }])
		expect(JSON.stringify(item)).not.toContain("123456789")
		// The preview's own fields stay on the device.
		expect(Object.keys(item)).not.toContain("borrowed")
		expect(Object.keys(item)).not.toContain("createdAt")
	})

	it("strips other players at any depth and keeps the file's own id wherever it appears", () => {
		const own = 7
		expect(
			stripOtherPlayers(
				{ viewer_id: own, owner_viewer_id: 0, parents: [{ owner_viewer_id: own }, { owner_viewer_id: 9, owner_trainer_name: "X" }] },
				own
			)
		).toEqual({ viewer_id: own, owner_viewer_id: 0, parents: [{ owner_viewer_id: own }, {}] })
	})

	it("marks a borrowed veteran and keeps her", () => {
		const result = readVeteranFile([veteran(12, 100601, { use_type: 1, owner_viewer_id: 555 })], UMAS, SKILLS)
		if (!result.ok) throw new Error(result.error)
		expect(result.veterans[0].borrowed).toBe(true)
		expect(JSON.stringify(toImportItem(result.veterans[0]))).not.toContain("555")
	})

	it("leaves out umas and skills the site doesn't know, and counts them", () => {
		const result = readVeteranFile([veteran(12, 100601), veteran(13, 109999)], UMAS, SKILLS)
		if (!result.ok) throw new Error(result.error)
		expect(result.veterans.map((each) => each.import_key)).toEqual([12])
		expect(result.unknownUmas).toBe(1)
		expect(result.unknownSkills).toBe(1)
	})

	it("puts the newest first, for the cap", () => {
		const result = readVeteranFile(
			[veteran(1, 100601, { create_time: "2025-01-01 00:00:00" }), veteran(2, 100401, { create_time: "2026-01-01 00:00:00" })],
			UMAS,
			SKILLS
		)
		if (!result.ok) throw new Error(result.error)
		expect(result.veterans.map((each) => each.import_key)).toEqual([2, 1])
	})

	it("reads a missing or odd letter as unknown, never as a guess", () => {
		const result = readVeteranFile([veteran(12, 100601, { proper_ground_turf: 9, proper_ground_dirt: undefined })], UMAS, SKILLS)
		if (!result.ok) throw new Error(result.error)
		expect(result.veterans[0].apt.turf).toBeNull()
		expect(result.veterans[0].apt.dirt).toBeNull()
	})

	it("refuses anything that isn't a list of veterans", () => {
		for (const json of [{}, [], [{ support_card_id: 30001, limit_break_count: 4 }], "text", null]) {
			expect(readVeteranFile(json, UMAS, SKILLS).ok).toBe(false)
		}
	})
})
