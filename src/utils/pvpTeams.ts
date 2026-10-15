/**
 * Pure operations on a PvP team: put an uma or a card in a place, take it
 * out, change a style, and the rules the picker greys tiles out by.
 *
 * Most rules mirror the server's (backend calculatorapi/pvp_teams.py and
 * views/pvp_team.py), which refuses the same things. The deck's uma rules (a
 * second card of one uma, a card of the uma training) are client-only; the
 * functions say which rule is which. Checking them here first
 * is what lets the picker disable a tile WITH A REASON instead of letting the
 * player pick it and then showing a refusal.
 *
 * Every function returns a new members array; nothing mutates.
 */

import type { RaceEvent } from "../types"
import type { PvpGuide } from "../types/pvpGuide"
import { hasEnded, isRunning } from "./pvpGuide"
import { refForRaceEvent, sameEvent } from "./pvpEvent"
import { releaseBlockReason, type ReleaseStatus } from "./cardRelease"
import type {
	CatalogueSupportCard,
	CatalogueUma,
	MemberStyle,
	PvpTeam,
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

/** The first empty owned slot (1..5) of a deck, or null when all five are filled. */
export function firstOpenCardSlot(member: PvpTeamMember): number | null {
	for (let slot = 1; slot < PVP_BORROW_SLOT; slot++) {
		if (!member.cards.some((card) => card.slot === slot)) return slot
	}
	return null
}

/** The first of a guide pick's styles a member can run ("everyone" is not one). */
export function memberStyleFrom(styles: readonly string[]): MemberStyle | undefined {
	return MEMBER_STYLES.find((style) => styles.includes(style))
}

/** The catalogue lookups the team rules read. PvpCatalogueIndex is one. */
export type TeamRuleLookups = {
	umasById: Map<number, Pick<CatalogueUma, "name" | "character_id">>
	cardsById: Map<number, Pick<CatalogueSupportCard, "name" | "card_type">>
}

/**
 * Why an uma cannot go at `position`, or null when it can. The game's CM
 * rules: the same uma twice is refused, and so is a second outfit of the same
 * character. The member being replaced does not count against itself.
 *
 * Swapping the uma keeps the deck (setMemberUma), so an uma whose own card is
 * in that spot's deck is refused too: the mirror of cardBlockReason's
 * "can't support herself", which a swap would otherwise walk round. The
 * server checks the first two rules (pvp_teams.py), not this one.
 */
export function umaBlockReason(
	members: PvpTeamMember[],
	position: number,
	candidate: Pick<CatalogueUma, "id" | "name" | "character_id">,
	lookups: TeamRuleLookups
): string | null {
	for (const member of members) {
		if (member.position === position) continue
		if (member.uma === candidate.id) return "Already on this team"
		const other = lookups.umasById.get(member.uma)
		if (
			other &&
			candidate.character_id !== null &&
			other.character_id === candidate.character_id
		) {
			return `${other.name} is already on this team`
		}
	}
	const deck = members.find((member) => member.position === position)?.cards ?? []
	for (const card of deck) {
		const held = lookups.cardsById.get(card.support_card)
		if (held && held.card_type !== "group" && sameUma(held.name, candidate.name)) {
			return `${held.name}'s card is in this deck`
		}
	}
	return null
}

/**
 * Why a card cannot go in `slot` of this member's deck, or null. `slot` null
 * means a slot that is empty now (Guide picks' "Add" fills the first open one).
 * The game's deck rules, the borrow slot included in all three:
 *
 *   - the same card twice is refused (the server refuses it too);
 *   - so is a card of the uma training with the deck (no Daiwa Scarlet card
 *     for Daiwa Scarlet, in any outfit);
 *   - and a second card of the same uma (two Agnes Tachyon cards, whatever
 *     their titles).
 *
 * Group cards are exempt from the last two. A group card is filed under one
 * of its umas in the game data (Team Sirius under Special Week), which is why
 * the exemption reads the card type. Those two are client-only: the server
 * checks the same card twice, not the uma behind it.
 *
 * The card in `slot`, which the pick replaces, does not count against it.
 */
export function cardBlockReason(
	member: PvpTeamMember | undefined,
	slot: number | null,
	cardId: number,
	lookups: TeamRuleLookups
): string | null {
	if (!member) return null
	const others = member.cards.filter((card) => card.slot !== slot)
	if (others.some((card) => card.support_card === cardId)) return "Already in this deck"
	const candidate = lookups.cardsById.get(cardId)
	if (!candidate || candidate.card_type === "group") return null
	const trainee = lookups.umasById.get(member.uma)
	if (trainee && sameUma(trainee.name, candidate.name)) return `${candidate.name} can't support herself`
	for (const card of others) {
		const other = lookups.cardsById.get(card.support_card)
		if (other && other.card_type !== "group" && sameUma(other.name, candidate.name)) {
			return `${other.name} already has a card in this deck`
		}
	}
	return null
}

/**
 * Whether two names are the same uma: a support card's name is its uma's
 * name (the title is what tells the cards apart), and an uma's name adds its
 * outfit in brackets. The API sends no character id for cards (and the ~300
 * not on global yet have none at all), so the name is the key.
 *
 * Compared as letters and digits only, outfit dropped, because a few umas
 * and their cards are spelled differently ("T.M. Opera O" / "TM Opera O",
 * "Ines Fujin ♡" / "Ines Fujin"). Checked on 2026-10-14 against the game's
 * character ids: every global card lands on its own uma, no two umas share a
 * key, and no card name has brackets to lose.
 */
function sameUma(a: string, b: string): boolean {
	return umaKey(a) === umaKey(b)
}

function umaKey(name: string): string {
	const key = name
		.replace(/\s*\(.*\)\s*$/, "")
		.normalize("NFKD")
		.toLocaleLowerCase()
		.replace(/[^a-z0-9]/g, "")
	// A name with no Latin letters at all keeps itself, so it never matches
	// every other such name on an empty key.
	return key || name.trim().toLocaleLowerCase()
}

/**
 * The guide's picks for one style, as id sets, for the picker's star: umas
 * the guide rates for the style, cards in its decks for the style. A runaway reads the front picks too, since the guide often
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
	return { umas, cards }
}

/**
 * Every skill the team can get, by skill id, with where from: "Oguri Cap
 * (unique)", "Kitasan Black (hint)". Read from the builder's catalogue, which
 * already leaves out skills that are not on global.
 */
export function teamSkillSources(
	members: PvpTeamMember[],
	umasById: Map<number, Pick<CatalogueUma, "name" | "skills">>,
	cardsById: Map<number, Pick<CatalogueSupportCard, "name" | "skills">>
): Map<number, string[]> {
	const sources = new Map<number, string[]>()
	const add = (skillId: number, from: string) => {
		const list = sources.get(skillId) ?? []
		if (!list.includes(from)) list.push(from)
		sources.set(skillId, list)
	}
	for (const member of members) {
		const uma = umasById.get(member.uma)
		for (const link of uma?.skills ?? []) add(link.skill, `${uma?.name} (${link.source})`)
		for (const entry of member.cards) {
			const card = cardsById.get(entry.support_card)
			for (const link of card?.skills ?? []) add(link.skill, `${card?.name} (${link.source})`)
		}
	}
	return sources
}

/**
 * Of one event's teams, the one to open on: the pinned one, else the one
 * edited last (a tie goes to the newer team). The builder and the team drawer
 * both start here, so "Open in PvP" from the drawer lands on the same team.
 */
export function preferredTeam(teams: PvpTeam[]): PvpTeam | null {
	const pinned = teams.find((team) => team.isFocus)
	if (pinned) return pinned
	let best: PvpTeam | null = null
	for (const team of teams) if (!best || team.updatedAt >= best.updatedAt) best = team
	return best
}

/** What the team drawer shows. */
export type DrawerChoice =
	| { kind: "team"; team: PvpTeam; event: RaceEvent; pinned: boolean }
	/** No team for the running or next event: the drawer offers to build one. */
	| { kind: "none"; event: RaceEvent }
	/** No event running or coming up at all. */
	| { kind: "no-events" }

/**
 * Which team the drawer shows, decided in three steps:
 *
 *   1. The pinned team, if its event has not ended. An ended pin is ignored,
 *      never cleared: the pin is the player's to change.
 *   2. Else a team for the event running now, or if none is running the next
 *      to start; with two, the one edited last.
 *   3. Else none: the event it would be for, so the drawer can say "No team
 *      for Libra Cup yet", or no event at all.
 *
 * `events` oldest first by start (raceEventsInOrder); `now` is passed in so a
 * test can pin the calendar.
 */
export function drawerTeam(teams: PvpTeam[], events: RaceEvent[], now: Date): DrawerChoice {
	const eventOf = (team: PvpTeam) =>
		events.find((event) => sameEvent(refForRaceEvent(event), { kind: team.kind, id: team.event })) ?? null

	const pinned = teams.find((team) => team.isFocus)
	const pinnedEvent = pinned ? eventOf(pinned) : null
	if (pinned && pinnedEvent && !hasEnded(pinnedEvent, now)) {
		return { kind: "team", team: pinned, event: pinnedEvent, pinned: true }
	}

	// Ordered by start, so the first one not over is the running one if any,
	// else the next to start.
	const target = events.find((event) => isRunning(event, now)) ?? events.find((event) => !hasEnded(event, now))
	if (!target) return { kind: "no-events" }
	const forTarget = teams.filter((team) => eventOf(team) === target)
	// The pin was handled above; among the rest, the latest edit wins.
	const team = preferredTeam(forTarget.map((candidate) => ({ ...candidate, isFocus: false })))
	const chosen = team ? forTarget.find((candidate) => candidate.key === team.key) ?? null : null
	return chosen ? { kind: "team", team: chosen, event: target, pinned: false } : { kind: "none", event: target }
}

/**
 * "Is this uma one of my favourites?" for the team grids' frame. A favourite
 * (an oshi on the account) counts for every outfit of its character, so a
 * favourite Oguri Cap frames Oguri Cap (Christmas) too; an uma the catalogue
 * has no character for matches by id alone.
 */
export function favouriteCheck(
	oshiIds: number[],
	umasById: Map<number, Pick<CatalogueUma, "character_id">>
): (umaId: number) => boolean {
	const ids = new Set(oshiIds)
	const characters = new Set(
		oshiIds.map((id) => umasById.get(id)?.character_id).filter((character): character is number => character != null)
	)
	return (umaId) => {
		if (ids.has(umaId)) return true
		const character = umasById.get(umaId)?.character_id
		return character != null && characters.has(character)
	}
}

/**
 * A team as it may be added to an event: anything not out by the event's last
 * day removed (utils/cardRelease.ts). Every path into a team applies the
 * release rule, and a team copied from the gallery is a path in: its poster's
 * client checked it, but the server does not, so it is checked again here.
 * An uma that may not be added takes its deck with it.
 */
export function withinRelease(
	members: PvpTeamMember[],
	releaseFor: (pool: "uma" | "support", id: number) => ReleaseStatus
): PvpTeamMember[] {
	return members
		.filter((member) => releaseBlockReason(releaseFor("uma", member.uma)) === null)
		.map((member) => ({
			...member,
			cards: member.cards.filter((card) => releaseBlockReason(releaseFor("support", card.support_card)) === null),
		}))
}
