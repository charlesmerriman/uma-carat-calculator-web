import { describe, expect, it } from "vitest"
import { detectExportFile, readOwnedCards, readOwnedUmas } from "../utils/gameImport/umadumpRoster"

/**
 * umadump's ownership files, in the shapes checked on the owner's real export
 * (2026-10-26): card_data.json and support_card_data.json.
 */

const umaRow = (cardId: number, extra: Record<string, unknown> = {}) => ({
	card_id: cardId, create_time: "2025-09-01 08:00:00", rarity: 4, talent_level: 5, skill_data_array: [{ skill_id: 1, level: 3 }], ...extra,
})
const cardRow = (id: number, extra: Record<string, unknown> = {}) => ({
	viewer_id: 7, support_card_id: id, limit_break_count: 4, stock: 1, exp: 1200, favorite_flag: 0,
	create_time: "2025-09-01 08:00:00", possess_time: "2025-09-01 08:00:00", extra_data: {}, ...extra,
})

describe("detectExportFile", () => {
	it("tells the three files apart by shape, never by name", () => {
		expect(detectExportFile([umaRow(100601)])).toBe("umas")
		expect(detectExportFile([cardRow(30028)])).toBe("support_cards")
		expect(detectExportFile([{ trained_chara_id: 12, card_id: 100601, speed: 1200 }])).toBe("veterans")
		for (const other of [[], {}, [{ chara_id: 1, data_id: 2 }], "text"]) expect(detectExportFile(other)).toBeNull()
	})
})

describe("reading the files", () => {
	const UMAS = new Map([[100601, 41]])
	const CARDS = new Map([[30028, 9]])

	it("reads each owned uma's stars and potential, keeping the whole object", () => {
		const result = readOwnedUmas([umaRow(100601), umaRow(109999)], UMAS)
		expect(result.unknown).toBe(1)
		expect(result.items).toEqual([
			{ uma: 41, stars: 4, talent_level: 5, game_data: umaRow(100601) },
		])
	})

	it("reads each card's limit break and spare copies, keeping the whole object and your own id", () => {
		const result = readOwnedCards([cardRow(30028), cardRow(39999)], CARDS)
		expect(result.unknown).toBe(1)
		expect(result.items).toEqual([{ support_card: 9, limit_break: 4, spare_copies: 1, game_data: cardRow(30028) }])
	})

	it("reads an odd value as unknown, never as a guess", () => {
		expect(readOwnedUmas([umaRow(100601, { rarity: 9 })], UMAS).items[0].stars).toBeNull()
		expect(readOwnedCards([cardRow(30028, { limit_break_count: 7, stock: -1 })], CARDS).items[0]).toMatchObject({ limit_break: 0, spare_copies: 0 })
	})
})
