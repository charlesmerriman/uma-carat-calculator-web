/**
 * Where an uma or a support card's Encyclopedia page is, from the SITE's row
 * id: the id every team, guide, ranking, roster and gallery snapshot carries.
 *
 * Pages are keyed by the GAME's id (utils/encyclopediaRoutes.ts), which most
 * payloads don't send. Rather than add it to each of them (and a gallery post
 * is a frozen snapshot that could never gain it), this reads the one place
 * that maps one id to the other: the PvP catalogue (GET /pvp-catalogue),
 * through the shared promise in pvpTeamFetchCalls.ts. The PvP pages, the
 * Collection, Rankings and search already load it; elsewhere it costs one
 * request per session (about 100 KB compressed).
 *
 * For everyone since the Encyclopedia opened (2026-11-18); until then only
 * early access got links.
 *
 * The index lives in a module-level store read through useSyncExternalStore,
 * so a grid of three hundred tiles shares one fetch and one index, and the
 * server snapshot (no index) keeps prerendered HTML free of links: render-time
 * code here never reads the catalogue before hydration.
 */

import { useEffect, useSyncExternalStore } from "react"
import { loadPvpCatalogue } from "../services/pvpTeamFetchCalls"
import { cardHref, umaHref } from "../utils/encyclopediaRoutes"
import type { CatalogueSupportCard, CatalogueUma, PvpCatalogue } from "../types/pvpTeam"

export interface EncyclopediaHrefs {
	/** An uma's page from her row id (Uma.id), or null when there isn't one to open. */
	uma: (id: number | null | undefined) => string | null
	/** A support card's page from its row id (SupportCard.id), or null. */
	card: (id: number | null | undefined) => string | null
}

/**
 * What the hover cards (components/hovercards) need for a row id: the game's
 * id, which keys its page's fetch, and the catalogue entry, whose name and
 * art draw the card's header while that fetch is in flight.
 */
export interface EncyclopediaEntry<T> {
	gameId: number
	entry: T
}

export interface EncyclopediaLookup {
	uma: (id: number | null | undefined) => EncyclopediaEntry<CatalogueUma> | null
	card: (id: number | null | undefined) => EncyclopediaEntry<CatalogueSupportCard> | null
}

const NO_LINKS: EncyclopediaHrefs = { uma: () => null, card: () => null }
const NO_ENTRIES: EncyclopediaLookup = { uma: () => null, card: () => null }

/** Both views of one catalogue: built together, so they always agree. */
interface Index {
	hrefs: EncyclopediaHrefs
	entries: EncyclopediaLookup
}

/** Built once per catalogue. A placeholder card ("your best SSR Speed card") has no page. */
function buildIndex(catalogue: PvpCatalogue): Index {
	const umas = new Map<number, EncyclopediaEntry<CatalogueUma>>()
	for (const uma of catalogue.umas) {
		if (uma.game_id != null) umas.set(uma.id, { gameId: uma.game_id, entry: uma })
	}
	const cards = new Map<number, EncyclopediaEntry<CatalogueSupportCard>>()
	for (const card of catalogue.support_cards) {
		if (card.game_id != null && !card.placeholder) cards.set(card.id, { gameId: card.game_id, entry: card })
	}
	const find = <T,>(rows: Map<number, EncyclopediaEntry<T>>) => (id: number | null | undefined) =>
		(id == null ? undefined : rows.get(id)) ?? null
	const link = <T,>(rows: Map<number, EncyclopediaEntry<T>>, href: (gameId: number) => string) => (id: number | null | undefined) => {
		const row = find(rows)(id)
		return row === null ? null : href(row.gameId)
	}
	return {
		hrefs: { uma: link(umas, umaHref), card: link(cards, cardHref) },
		entries: { uma: find(umas), card: find(cards) },
	}
}

let index: Index | null = null
let loading = false
const listeners = new Set<() => void>()

function ensureLoaded(): void {
	if (index || loading) return
	loading = true
	loadPvpCatalogue()
		.then((catalogue) => {
			index = buildIndex(catalogue)
			for (const listener of listeners) listener()
		})
		// The links are an extra: a failed fetch leaves the tiles as they were,
		// and the next mount tries again (the shared promise resets on failure).
		.catch(() => undefined)
		.finally(() => {
			loading = false
		})
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

interface IndexOptions {
	/**
	 * False reads the index if something else has loaded it, and asks for
	 * nothing itself. Only the hover layer passes it: it is mounted on every
	 * /app page, and the pages with no tiles shouldn't cost a download.
	 */
	load?: boolean
}

/** The shared index, or null until it loads; loads the catalogue on first use. */
function useIndex(load: boolean): Index | null {
	useEffect(() => {
		if (load) ensureLoaded()
	}, [load])
	return useSyncExternalStore(subscribe, () => index, () => null)
}

export function useEncyclopediaHrefs({ load = true }: IndexOptions = {}): EncyclopediaHrefs {
	return useIndex(load)?.hrefs ?? NO_LINKS
}

/** The game id and catalogue entry behind a row id, on the same rule as the links. */
export function useEncyclopediaLookup({ load = true }: IndexOptions = {}): EncyclopediaLookup {
	return useIndex(load)?.entries ?? NO_ENTRIES
}

/** Starts the catalogue's load from outside a render (the hover layer's press). */
export function loadEncyclopediaIndex(): void {
	ensureLoaded()
}
