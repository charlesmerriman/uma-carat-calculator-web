/**
 * A support card the way the game draws it, built from layers: the card's
 * borderless art (the game's own texture, the API's `image_borderless`), its
 * rarity frame, its type icon in the top-right corner and, on an owned card,
 * the limit-break diamonds bottom left. The card's FramedUma
 * (notes/support-card-art-plan.md, owner 2026-11-02).
 *
 * THE LAYERS ARE DAPTRIUS'S. His SVG overlays (src/assets/card-overlays/,
 * from his Drive "SVG Overlays" folder) are drawn on a 762 x 1000 canvas that
 * is the art padded 50 px on every side; his pipeline lays them over the WHOLE
 * canvas and scales it to the site's 3:4. App.css "Card frames" does the same:
 * the art sits inset by that padding with his rounded corners, and every
 * overlay stretches over the full card (`preserveAspectRatio="none"` in the
 * files). The frames and limit breaks are his files untouched; the type icons
 * are his too, shrunk to the size today's pictures have and given a darker
 * outline (the owner's pick, canvas version 7).
 *
 * A card with no borderless art (a placeholder, or a new card before its
 * texture is uploaded) draws its bordered `image` as it is, never inside a
 * frame: that picture has a frame and icon of its own. The limit breaks still
 * go on top, in the same place, since today's pictures came out of the same
 * pipeline.
 *
 * Used in the guide's decks, the team builder and the Collection (owner,
 * 2026-11-02: those three places first). Everywhere else a card keeps its
 * bordered `image`. `className` sizes the card; it is always 3:4. The frame
 * is only a look: the caller names the card and its limit break for a screen
 * reader.
 */

import frameR from "../assets/card-overlays/frame-r.svg"
import frameSr from "../assets/card-overlays/frame-sr.svg"
import frameSsr from "../assets/card-overlays/frame-ssr.svg"
import limitBreak0 from "../assets/card-overlays/lb-0.svg"
import limitBreak1 from "../assets/card-overlays/lb-1.svg"
import limitBreak2 from "../assets/card-overlays/lb-2.svg"
import limitBreak3 from "../assets/card-overlays/lb-3.svg"
import limitBreak4 from "../assets/card-overlays/lb-4.svg"
import typeFriend from "../assets/card-overlays/type-friend.svg"
import typeGroup from "../assets/card-overlays/type-group.svg"
import typeGuts from "../assets/card-overlays/type-guts.svg"
import typePower from "../assets/card-overlays/type-power.svg"
import typeSpeed from "../assets/card-overlays/type-speed.svg"
import typeStamina from "../assets/card-overlays/type-stamina.svg"
import typeWit from "../assets/card-overlays/type-wit.svg"

/** Keyed by the API's `rarity`: 1 R, 2 SR, 3 SSR. */
const FRAMES: Record<number, string> = { 1: frameR, 2: frameSr, 3: frameSsr }

/** Keyed by the API's `card_type`. Daptrius's "Pal" icon is the game's friend card. */
const TYPE_ICONS: Record<string, string> = {
	speed: typeSpeed,
	stamina: typeStamina,
	power: typePower,
	guts: typeGuts,
	wit: typeWit,
	friend: typeFriend,
	group: typeGroup,
}

/** Index = limit breaks, 0 (four empty diamonds) to 4 (MLB, four lit). */
const LIMIT_BREAKS = [limitBreak0, limitBreak1, limitBreak2, limitBreak3, limitBreak4]

/** What the frame needs from a card: the catalogue's card and the guide's both fit. */
export interface FramedCardArt {
	image: string | null
	/** Absent from an API older than the field: drawn like null. */
	image_borderless?: string | null
	card_type: string | null
	rarity: number | null
}

export function FramedCard({ card, limitBreaks = null, alt = "", className = "" }: {
	card: FramedCardArt
	/** 0..4 on an owned card (the Collection); null draws no diamonds. */
	limitBreaks?: number | null
	alt?: string
	className?: string
}) {
	const art = card.image_borderless ?? null
	const frame = card.rarity === null ? undefined : FRAMES[card.rarity]
	const icon = card.card_type ? TYPE_ICONS[card.card_type] : undefined
	// Clamped, so a bad value draws the nearest real overlay, never nothing.
	const diamonds = limitBreaks === null ? undefined : LIMIT_BREAKS[Math.min(4, Math.max(0, Math.round(limitBreaks)))]
	return (
		<span className={`card-frame ${className}`}>
			{art ? (
				<>
					<img src={art} alt={alt} loading="lazy" decoding="async" className="card-frame__art" />
					{frame && <img src={frame} alt="" aria-hidden="true" className="card-frame__layer" />}
					{icon && <img src={icon} alt="" aria-hidden="true" className="card-frame__layer" />}
				</>
			) : card.image ? (
				<img src={card.image} alt={alt} loading="lazy" decoding="async" className="card-frame__whole" />
			) : (
				<span className="card-frame__empty" aria-hidden="true" />
			)}
			{diamonds && <img src={diamonds} alt="" aria-hidden="true" className="card-frame__layer" />}
		</span>
	)
}
