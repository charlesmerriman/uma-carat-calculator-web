/**
 * A support card's picture at 3:4, sized by `className` (w-10 in a row,
 * w-14 on a podium, w-7 in the window). Cards keep their own art: there is
 * no borderless set for them, so no FramedUma here (frontend-ui.md). A grey
 * card of the same shape stands in while the catalogue has no picture.
 */

import type { CatalogueSupportCard } from "../../../types/pvpTeam"

export function CardArt({ card, className = "w-10" }: { card: CatalogueSupportCard | undefined; className?: string }) {
	return card?.image ? (
		<img src={card.image} alt="" loading="lazy" decoding="async" className={`block aspect-[3/4] shrink-0 rounded-[3px] object-cover ${className}`} />
	) : (
		<span className={`block aspect-[3/4] shrink-0 rounded-[3px] bg-gray-700 ${className}`} />
	)
}
