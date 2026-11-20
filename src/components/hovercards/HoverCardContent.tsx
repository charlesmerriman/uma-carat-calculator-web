/**
 * A hover card's whole content for one row id: it finds the uma or card in
 * the catalogue (useEncyclopediaLookup), fetches its page, reads the
 * Collection, and draws UmaHoverCard or CardHoverCard.
 *
 * Two callers, and both mount it only while a popup is OPEN, so a page full
 * of tiles fetches nothing until someone hovers one: HoverCardLayer (every
 * tile with data-hover-card) and the guide's own tiles (PvpTiles.tsx), whose
 * hover holds the guide's note and passes it in as `top`.
 *
 * When the catalogue doesn't know the row (a placeholder card, an uma with no
 * page, the catalogue still loading) it draws `fallback`: nothing for the
 * layer, today's thin detail for a guide tile.
 */

import type { ReactNode } from "react"
import { useEncyclopediaHrefs, useEncyclopediaLookup } from "../../hooks/useEncyclopediaHrefs"
import { useOwned } from "../../hooks/useOwned"
import { useCardPage, useUmaPage } from "../../services/encyclopediaQueries"
import type { AptitudeKey } from "../../types/pvpTeam"
import { CARD_PAGE_STALE_MS, type HoverCardKind } from "../../utils/hoverCards"
import { UmaHoverCard } from "./UmaHoverCard"
import { CardHoverCard } from "./CardHoverCard"

export function HoverCardContent({ kind, id, ring = [], links = true, top = null, fallback = null }: {
	kind: HoverCardKind
	/** The site's row id: Uma.id or SupportCard.id. */
	id: number
	ring?: readonly AptitudeKey[]
	links?: boolean
	top?: ReactNode
	fallback?: ReactNode
}) {
	const lookup = useEncyclopediaLookup()
	const hrefs = useEncyclopediaHrefs()
	const owned = useOwned()
	const uma = kind === "uma" ? lookup.uma(id) : null
	const card = kind === "card" ? lookup.card(id) : null
	const umaPage = useUmaPage(uma?.gameId ?? null, { staleTime: CARD_PAGE_STALE_MS })
	const cardPage = useCardPage(card?.gameId ?? null, { staleTime: CARD_PAGE_STALE_MS })
	// An error draws the header and the link only (page null), never a spinner forever.
	const pageOf = <T,>(query: { data: T | null | undefined; isError: boolean }) => (query.isError ? null : query.data)
	if (uma) {
		return (
			<UmaHoverCard
				uma={uma.entry}
				page={pageOf(umaPage)}
				href={links ? hrefs.uma(id) : null}
				ring={ring}
				ownedStars={owned.umas.get(id) ?? null}
				links={links}
				top={top}
			/>
		)
	}
	if (card) {
		return (
			<CardHoverCard
				card={card.entry}
				page={pageOf(cardPage)}
				href={links ? hrefs.card(id) : null}
				ownedLimitBreak={owned.cards.get(id) ?? null}
				links={links}
				top={top}
			/>
		)
	}
	return <>{fallback}</>
}
