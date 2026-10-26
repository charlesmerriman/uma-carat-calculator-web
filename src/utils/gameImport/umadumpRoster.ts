/**
 * Reads umadump's two ownership exports in the browser, into the rows
 * POST /roster/import takes: `card_data.json` (the umas the player owns) and
 * `support_card_data.json` (the support cards). The veteran file is
 * umadumpVeterans.ts; `detectExportFile` says which of the three a file is.
 *
 * Checked on the owner's real export (2026-10-26): 46 umas and 199 cards, every
 * one matched the site. `rarity` is the uma's stars (2..5), `talent_level` her
 * potential (1..5), `limit_break_count` the card's limit break (0..4) and
 * `stock` its spare copies.
 *
 * EVERYTHING IS SENT, like a veteran (owner, 2026-10-26): each row carries the
 * game's whole object as `game_data`, the player's own account id included.
 * These files name no other player; stripOtherPlayers runs anyway, and the
 * server strips again.
 *
 * RECOGNISED BY SHAPE, NEVER BY NAME: a player may rename the files.
 */

import { stripOtherPlayers } from "./umadumpVeterans"

export type ExportKind = "veterans" | "umas" | "support_cards"

type Row = Record<string, unknown>

const isRow = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value)
const isWhole = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value)

/** Which umadump file this JSON is, by the fields every row has, or null. */
export function detectExportFile(json: unknown): ExportKind | null {
	if (!Array.isArray(json) || json.length === 0 || !json.every(isRow)) return null
	const rows = json as Row[]
	if (rows.every((row) => isWhole(row.trained_chara_id) && isWhole(row.card_id))) return "veterans"
	if (rows.every((row) => isWhole(row.support_card_id) && isWhole(row.limit_break_count))) return "support_cards"
	if (rows.every((row) => isWhole(row.card_id) && isWhole(row.talent_level) && row.trained_chara_id === undefined)) return "umas"
	return null
}

export interface OwnedUmaItem {
	uma: number
	stars: number | null
	talent_level: number | null
	game_data: Record<string, unknown>
}

export interface OwnedCardItem {
	support_card: number
	limit_break: number
	spare_copies: number
	game_data: Record<string, unknown>
}

export interface RosterFileResult<Item> {
	items: Item[]
	/** Rows whose uma or card the site doesn't have yet, left out. */
	unknown: number
}

const inRange = (value: unknown, low: number, high: number): value is number =>
	isWhole(value) && value >= low && value <= high

/** card_data.json's rows as import items. `umaIdByGameId` maps the game's outfit ids to the site's. */
export function readOwnedUmas(rows: Row[], umaIdByGameId: Map<number, number>): RosterFileResult<OwnedUmaItem> {
	const items: OwnedUmaItem[] = []
	let unknown = 0
	for (const row of rows) {
		const uma = umaIdByGameId.get(row.card_id as number)
		if (uma === undefined || items.some((item) => item.uma === uma)) {
			if (uma === undefined) unknown += 1
			continue
		}
		items.push({
			uma,
			stars: inRange(row.rarity, 1, 5) ? row.rarity : null,
			talent_level: inRange(row.talent_level, 1, 5) ? row.talent_level : null,
			game_data: stripOtherPlayers(row, row.viewer_id) as Record<string, unknown>,
		})
	}
	return { items, unknown }
}

/** support_card_data.json's rows as import items. */
export function readOwnedCards(rows: Row[], cardIdByGameId: Map<number, number>): RosterFileResult<OwnedCardItem> {
	const items: OwnedCardItem[] = []
	let unknown = 0
	for (const row of rows) {
		const card = cardIdByGameId.get(row.support_card_id as number)
		if (card === undefined || items.some((item) => item.support_card === card)) {
			if (card === undefined) unknown += 1
			continue
		}
		items.push({
			support_card: card,
			limit_break: inRange(row.limit_break_count, 0, 4) ? row.limit_break_count : 0,
			spare_copies: inRange(row.stock, 0, 99) ? row.stock : 0,
			game_data: stripOtherPlayers(row, row.viewer_id) as Record<string, unknown>,
		})
	}
	return { items, unknown }
}
