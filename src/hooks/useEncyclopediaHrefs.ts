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
 * request per session (about 100 KB compressed), made only for the people who
 * see the links.
 *
 * Early access only while the Encyclopedia is supporters-first: everyone else
 * gets a lookup that answers null, and so no links (useSkillsPreview, the same
 * rule the pages use; opening them to everyone opens these too).
 *
 * The index lives in a module-level store read through useSyncExternalStore,
 * so a grid of three hundred tiles shares one fetch and one index, and the
 * server snapshot (no index) keeps prerendered HTML free of links: render-time
 * code here never reads the catalogue before hydration.
 */

import { useEffect, useSyncExternalStore } from "react"
import { useSkillsPreview } from "./useSkillsPreview"
import { loadPvpCatalogue } from "../services/pvpTeamFetchCalls"
import { cardHref, umaHref } from "../utils/encyclopediaRoutes"
import type { PvpCatalogue } from "../types/pvpTeam"

export interface EncyclopediaHrefs {
	/** An uma's page from her row id (Uma.id), or null when there isn't one to open. */
	uma: (id: number | null | undefined) => string | null
	/** A support card's page from its row id (SupportCard.id), or null. */
	card: (id: number | null | undefined) => string | null
}

const NO_LINKS: EncyclopediaHrefs = { uma: () => null, card: () => null }

/** Built once per catalogue. A placeholder card ("your best SSR Speed card") has no page. */
function buildIndex(catalogue: PvpCatalogue): EncyclopediaHrefs {
	const umaIds = new Map<number, number>()
	for (const uma of catalogue.umas) {
		if (uma.game_id != null) umaIds.set(uma.id, uma.game_id)
	}
	const cardIds = new Map<number, number>()
	for (const card of catalogue.support_cards) {
		if (card.game_id != null && !card.placeholder) cardIds.set(card.id, card.game_id)
	}
	const lookup = (ids: Map<number, number>, href: (gameId: number) => string) => (id: number | null | undefined) => {
		const gameId = id == null ? undefined : ids.get(id)
		return gameId === undefined ? null : href(gameId)
	}
	return { uma: lookup(umaIds, umaHref), card: lookup(cardIds, cardHref) }
}

let index: EncyclopediaHrefs | null = null
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

export function useEncyclopediaHrefs(): EncyclopediaHrefs {
	const early = useSkillsPreview()
	useEffect(() => {
		if (early) ensureLoaded()
	}, [early])
	const loaded = useSyncExternalStore(subscribe, () => index, () => null)
	return early && loaded ? loaded : NO_LINKS
}
