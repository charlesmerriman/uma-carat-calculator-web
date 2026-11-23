/**
 * A banner's or a story event's support card as FramedCard reads it: the
 * game's borderless art, its type and its rarity (api #311 sends the first
 * two on /calculator-data, as the PvP catalogue already did).
 *
 * A null rarity reads as SSR, the way the rate-up rule reads it (a card with
 * no game id). With no borderless art FramedCard draws the bordered `image`
 * whole, never inside a frame, so a card whose texture isn't uploaded yet
 * looks as it did before.
 */

import type { FramedCardArt } from "../components/FramedCard"

export function cardFrameArt(card: {
	image: string | null
	image_borderless?: string | null
	card_type?: string | null
	rarity?: number | null
}): FramedCardArt {
	return {
		image: card.image,
		image_borderless: card.image_borderless ?? null,
		card_type: card.card_type ?? null,
		rarity: card.rarity ?? 3,
	}
}
