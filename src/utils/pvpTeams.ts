/**
 * Pure operations on a PvP team: put an uma or a card in a place, take it
 * out, change a style, and the rules the picker greys tiles out by.
 *
 * The rules mirror the server's (backend calculatorapi/pvp_teams.py and
 * views/pvp_team.py), which refuses the same things. Checking them here first
 * is what lets the picker disable a tile WITH A REASON instead of letting the
 * player pick it and then showing a refusal.
 *
 * Every function returns a new members array; nothing mutates.
 */

import type { PvpGuide } from "../types/pvpGuide"
import type {
	CatalogueUma,
	MemberStyle,
	PvpTeamCardSlot,
	PvpTeamMember,
} from "../types/pvpTeam"

export const PVP_TEAM_SIZE = 3
export const PVP_DECK_SIZE = 6
/** Slot 6 holds the borrowed card. */
export const PVP_BORROW_SLOT = 6
/** Per account, per event. Checked by the server on creation only. */
export const PVP_TEAM_CAP_PER_EVENT = 5

export const MEMBER_STYLES: MemberStyle[] = ["runaway", "front", "pace", "late", "end"]

/** Uma.running_style (1 front, 2 pace, 3 late, 4 end) -> the style a new member starts on. */
export function defaultStyleFor(uma: Pick<CatalogueUma, "running_style">): MemberStyle {
	switch (uma.running_style) {
		case 2:
			return "pace"
		case 3:
			return "late"
		case 4:
			return "end"
		default:
			return "front"
	}
}

export function memberAt(members: PvpTeamMember[], position: number): PvpTeamMember | undefined {
	return members.find((member) => member.position === position)
}

function sortMembers(members: PvpTeamMember[]): PvpTeamMember[] {
	return [...members].sort((a, b) => a.position - b.position)
}

function sortCards(cards: PvpTeamCardSlot[]): PvpTeamCardSlot[] {
	return [...cards].sort((a, b) => a.slot - b.slot)
}

/**
 * Put `uma` at `position`. A member already there keeps its cards (swapping
 * the uma is the common edit: "try Oguri instead of Gold Ship with this deck")
 * and its style unless `style` is given. A new member starts on the uma's own
 * running style.
 */
export function setMemberUma(
	members: PvpTeamMember[],
	position: number,
	uma: Pick<CatalogueUma, "id" | "running_style">,
	style?: MemberStyle
): PvpTeamMember[] {
	const current = memberAt(members, position)
	const next: PvpTeamMember = current
		? { ...current, uma: uma.id, style: style ?? current.style }
		: { position, uma: uma.id, style: style ?? defaultStyleFor(uma), cards: [] }
	return sortMembers([...members.filter((member) => member.position !== position), next])
}

/** Take the uma out, and with it the deck: a deck belongs to its uma. */
export function clearMember(members: PvpTeamMember[], position: number): PvpTeamMember[] {
	return members.filter((member) => member.position !== position)
}

export function setMemberStyle(members: PvpTeamMember[], position: number, style: MemberStyle): PvpTeamMember[] {
	return members.map((member) => (member.position === position ? { ...member, style } : member))
}

/** Put a card in one slot of a member's deck. No member there: no change. */
export function setCard(members: PvpTeamMember[], position: number, slot: number, cardId: number): PvpTeamMember[] {
	return members.map((member) =>
		member.position === position
			? {
					...member,
					cards: sortCards([
						...member.cards.filter((card) => card.slot !== slot),
						{ slot, support_card: cardId },
					]),
				}
			: member
	)
}

export function clearCard(members: PvpTeamMember[], position: number, slot: number): PvpTeamMember[] {
	return members.map((member) =>
		member.position === position
			? { ...member, cards: member.cards.filter((card) => card.slot !== slot) }
			: member
	)
}

/**
 * Why an uma cannot go at `position`, or null when it can. The game's CM
 * rules: the same uma twice is refused, and so is a second outfit of the same
 * character. The member being replaced does not count against itself.
 */
export function umaBlockReason(
	members: PvpTeamMember[],
	position: number,
	candidate: Pick<CatalogueUma, "id" | "character_id">,
	umasById: Map<number, Pick<CatalogueUma, "name" | "character_id">>
): string | null {
	for (const member of members) {
		if (member.position === position) continue
		if (member.uma === candidate.id) return "Already on this team"
		const other = umasById.get(member.uma)
		if (
			other &&
			candidate.character_id !== null &&
			other.character_id === candidate.character_id
		) {
			return `${other.name} is already on this team`
		}
	}
	return null
}

/** Why a card cannot go in `slot` of this member's deck, or null. */
export function cardBlockReason(member: PvpTeamMember | undefined, slot: number, cardId: number): string | null {
	if (!member) return null
	const elsewhere = member.cards.find((card) => card.support_card === cardId && card.slot !== slot)
	return elsewhere ? "Already in this deck" : null
}

/**
 * The guide's picks for one style, as id sets, for the picker's star: umas
 * the guide rates for the style, cards in its decks or honourable mentions
 * for the style. A runaway reads the front picks too, since the guide often
 * files a runaway under Front.
 */
export function recommendedIds(guide: PvpGuide | null, style: MemberStyle): { umas: Set<number>; cards: Set<number> } {
	const umas = new Set<number>()
	const cards = new Set<number>()
	if (!guide) return { umas, cards }
	const styles = new Set<string>(style === "runaway" ? ["runaway", "front"] : [style])
	for (const row of guide.uma_recommendations) {
		if (styles.has(row.style)) umas.add(row.uma.id)
	}
	for (const deck of guide.decks) {
		if (!styles.has(deck.style)) continue
		for (const slot of deck.slots) {
			if (slot.support_card) cards.add(slot.support_card.id)
		}
	}
	for (const mention of guide.honorable_mentions) {
		if (styles.has(mention.style)) cards.add(mention.support_card.id)
	}
	return { umas, cards }
}
