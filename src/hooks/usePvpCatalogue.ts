/**
 * The team builder's catalogue (GET /pvp-catalogue) with lookup maps.
 *
 * Fetched the first time something that draws a team mounts, never on /app
 * load, and shared through the module-level promise in pvpTeamFetchCalls.ts,
 * so a second consumer (the R2b drawer) costs no request. A failed fetch is
 * retried by the next mount.
 */

import { useEffect, useMemo, useState } from "react"
import { loadPvpCatalogue } from "../services/pvpTeamFetchCalls"
import type { CatalogueSkill, CatalogueSupportCard, CatalogueUma, PvpCatalogue } from "../types/pvpTeam"

export interface PvpCatalogueIndex {
	catalogue: PvpCatalogue
	umasById: Map<number, CatalogueUma>
	cardsById: Map<number, CatalogueSupportCard>
	skillsById: Map<number, CatalogueSkill>
}

export type PvpCatalogueState =
	| { status: "loading" }
	| { status: "error" }
	| ({ status: "ready" } & PvpCatalogueIndex)

export function usePvpCatalogue(): PvpCatalogueState {
	const [catalogue, setCatalogue] = useState<PvpCatalogue | null>(null)
	const [failed, setFailed] = useState(false)

	useEffect(() => {
		let live = true
		loadPvpCatalogue()
			.then((loaded) => {
				if (live) setCatalogue(loaded)
			})
			.catch((error: unknown) => {
				console.error(error)
				if (live) setFailed(true)
			})
		return () => {
			live = false
		}
	}, [])

	return useMemo<PvpCatalogueState>(() => {
		if (catalogue) {
			return {
				status: "ready",
				catalogue,
				umasById: new Map(catalogue.umas.map((uma) => [uma.id, uma])),
				cardsById: new Map(catalogue.support_cards.map((card) => [card.id, card])),
				skillsById: new Map(catalogue.skills.map((skill) => [skill.id, skill])),
			}
		}
		return failed ? { status: "error" } : { status: "loading" }
	}, [catalogue, failed])
}
