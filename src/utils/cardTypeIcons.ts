/**
 * Each support card type's icon on its own, for the Encyclopedia's Type chips
 * (Daptrius, board "Encyclopedia Filter Changes", 2026-11-17: "Use the
 * existing type icons ... less reading").
 *
 * They are the icons in the card frame's corner (assets/card-overlays, which
 * FramedCard stacks over the art), cut out as squares: the same drawing with
 * the overlay's full-card transform dropped and the view box cropped to the
 * icon (606 0 156 156). Re-cut them if the overlays change.
 */

import typeFriend from "../assets/type-icons/type-friend.svg"
import typeGroup from "../assets/type-icons/type-group.svg"
import typeGuts from "../assets/type-icons/type-guts.svg"
import typePower from "../assets/type-icons/type-power.svg"
import typeSpeed from "../assets/type-icons/type-speed.svg"
import typeStamina from "../assets/type-icons/type-stamina.svg"
import typeWit from "../assets/type-icons/type-wit.svg"

/** Keyed by the API's `card_type`. */
export const CARD_TYPE_ICONS: Record<string, string> = {
	speed: typeSpeed,
	stamina: typeStamina,
	power: typePower,
	guts: typeGuts,
	wit: typeWit,
	friend: typeFriend,
	group: typeGroup,
}
