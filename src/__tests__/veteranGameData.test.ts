import { describe, expect, it } from "vitest"
import { legacyOf, readVeteranGame, statSpark } from "../utils/veteranGameData"
import type { SparkName } from "../types/trainedUma"

/** Reading a veteran's raw game object for her card (components/collection/VeteranCard.tsx). */

const NAMES: Record<string, SparkName> = {
	"103": { name: "Speed", kind: "stat", stars: 3 },
	"202": { name: "Stamina", kind: "stat", stars: 2 },
	"101": { name: "Speed", kind: "stat", stars: 1 },
	"3402": { name: "Long", kind: "aptitude", stars: 2 },
	"3401": { name: "Long", kind: "aptitude", stars: 1 },
	"10010101": { name: "Shooting Star", kind: "unique", stars: 1 },
	"1000401": { name: "Oka Sho", kind: "race", stars: 1 },
	"2000402": { name: "Nakayama Racecourse ○", kind: "skill", stars: 2 },
}
const factors = (...ids: number[]) => ids.map((factor_id) => ({ factor_id, level: 0 }))

/** One veteran in umadump's shape, trimmed to what the card reads. */
const veteran = () => ({
	scenario_id: 2,
	running_style: 1,
	fans: 255610,
	win_saddle_id_array: [1, 10, 12],
	// The game lists them in its own order; the card shows blue, pink, green, then white.
	factor_info_array: factors(1000401, 10010101, 3402, 103, 99999),
	succession_chara_array: [
		{ position_id: 21, card_id: 100101, rank: 15, factor_info_array: factors(101) },
		{ position_id: 20, card_id: 100901, rank: 17, factor_info_array: factors(202, 3401, 2000402) },
		{ position_id: 10, card_id: 100401, rank: 18, factor_info_array: factors(103, 3401, 10010101) },
		{ position_id: 12, card_id: 100201, rank: 14, factor_info_array: factors(202) },
		{ position_id: 11, card_id: 100301, rank: 16, factor_info_array: factors(101) },
	],
	support_card_list: [
		{ position: 2, support_card_id: 30028, limit_break_count: 4 },
		{ position: 1, support_card_id: 30034, limit_break_count: 2 },
	],
	race_result_list: [
		{ turn: 40, result_rank: 2 },
		{ turn: 12, result_rank: 1 },
		{ turn: 30, result_rank: 1 },
	],
})

describe("reading her game data", () => {
	it("names her sparks in the game's colour order and counts the ones it can't name", () => {
		const game = readVeteranGame(veteran(), NAMES)
		expect(game?.sparks.map((spark) => `${spark.name} ${spark.stars}`)).toEqual(["Speed 3", "Long 2", "Shooting Star 1", "Oka Sho 1"])
		expect(game?.unknownSparks).toBe(1)
	})

	it("puts each grandparent under her own parent, in position order", () => {
		const game = readVeteranGame(veteran(), NAMES)
		expect(game?.parents.map((parent) => [parent.position, parent.cardId, parent.grade])).toEqual([[10, 100401, 18], [20, 100901, 17]])
		expect(game?.parents[0].grandparents.map((each) => each.position)).toEqual([11, 12])
		expect(game?.parents[1].grandparents.map((each) => each.cardId)).toEqual([100101])
		expect(statSpark(game!.parents[0].grandparents[1])?.name).toBe("Stamina")
	})

	it("reads the deck by position, the races in the order run, and the facts", () => {
		const game = readVeteranGame(veteran(), NAMES)
		expect(game?.deck).toEqual([
			{ position: 1, cardId: 30034, limitBreak: 2 },
			{ position: 2, cardId: 30028, limitBreak: 4 },
		])
		expect(game?.places).toEqual([1, 1, 2])
		expect(game).toMatchObject({ fans: 255610, titles: 3, scenario: "Unity Cup", runningStyle: "front" })
	})

	it("is nothing for a hand entry, and leaves out what a strange file gets wrong", () => {
		expect(readVeteranGame(null)).toBeNull()
		const game = readVeteranGame({
			scenario_id: 77, running_style: 9, fans: -3, factor_info_array: "103",
			succession_chara_array: [null, { position_id: "10" }], support_card_list: [{ support_card_id: null }],
			race_result_list: [{ turn: 1, result_rank: 0 }],
		}, NAMES)
		expect(game).toEqual({
			sparks: [], unknownSparks: 0, parents: [], deck: [], places: [],
			fans: null, titles: null, scenario: null, runningStyle: null,
		})
	})
})

describe("what she passes on as a parent", () => {
	it("sums blue and pink by name over her and her parents, never her grandparents", () => {
		const legacy = legacyOf(readVeteranGame(veteran(), NAMES)!)
		expect(legacy.totals).toEqual([
			{ kind: "stat", name: "Speed", stars: 6 },
			{ kind: "aptitude", name: "Long", stars: 4 },
			{ kind: "stat", name: "Stamina", stars: 2 },
		])
		expect(legacy).toMatchObject({ uniques: 2, whites: 2 })
	})
})
