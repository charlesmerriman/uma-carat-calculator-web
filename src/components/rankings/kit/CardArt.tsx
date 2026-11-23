/**
 * A support card's picture at 3:4, sized by `className` (w-10 in a row,
 * w-14 on a podium, w-7 in the window): the game's art in its own frame
 * (FramedCard), as everywhere a card is drawn since the board's "Pages still
 * using old support card styles". A grey card of the same shape stands in
 * while the catalogue has no picture.
 */

import { FramedCard } from "../../FramedCard"
import type { CatalogueSupportCard } from "../../../types/pvpTeam"

export function CardArt({ card, className = "w-10" }: { card: CatalogueSupportCard | undefined; className?: string }) {
	return card?.image || card?.image_borderless ? (
		<FramedCard card={card} className={className} />
	) : (
		<span className={`block aspect-[3/4] shrink-0 rounded-[3px] bg-gray-700 ${className}`} />
	)
}
