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
import type { PvpDeck, PvpDeckSlot, PvpGuide } from "../types/pvpGuide"
import { hasEnded, isRunning, WHITE_SKILL_RARITY } from "./pvpGuide"
import { refForRaceEvent, sameEvent } from "./pvpEvent"
import { releaseBlockReason, type ReleaseStatus } from "./cardRelease"
import type {
	CatalogueSkill,
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
function defaultStyleFor(uma: Pick<CatalogueUma, "running_style">): MemberStyle {
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
		? {
				...current,
				uma: uma.id,
				style: style ?? current.style,
				// A veteran is one outfit: another uma in the spot drops the link.
				trained_uma: current.uma === uma.id ? current.trained_uma : null,
			}
		: { position, uma: uma.id, style: style ?? defaultStyleFor(uma), cards: [] }
	return sortMembers([...members.filter((member) => member.position !== position), next])
}

/** Take the uma out, and with it the deck: a deck belongs to its uma. */
export function clearMember(members: PvpTeamMember[], position: number): PvpTeamMember[] {
	return members.filter((member) => member.position !== position)
}

/** Link the veteran `trainedUma` (one of the member's own outfit) to the member, or `null` to unlink. */
export function setMemberVeteran(members: PvpTeamMember[], position: number, trainedUma: number | null): PvpTeamMember[] {
	return members.map((member) => (member.position === position ? { ...member, trained_uma: trainedUma } : member))
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

/**
 * The picker's "Add to every deck on this team": the card goes in the chosen
 * slot, then into each other deck's first open slot, a borrowed card into the
 * other decks' borrow slots. Never replaces a card. A deck already holding it
 * needs nothing; one that is full, or that the game's rules refuse, is skipped
 * and reported so the player knows which deck to fix by hand.
 */
export function addCardToEveryDeck(
	members: PvpTeamMember[],
	position: number,
	slot: number,
	cardId: number,
	lookups: TeamRuleLookups
): { members: PvpTeamMember[]; skipped: { position: number; reason: string }[] } {
	let next = setCard(members, position, slot, cardId)
	const skipped: { position: number; reason: string }[] = []
	for (const member of members) {
		if (member.position === position || member.cards.some((card) => card.support_card === cardId)) continue
		const borrowTaken = member.cards.some((card) => card.slot === PVP_BORROW_SLOT)
		const open = slot === PVP_BORROW_SLOT ? (borrowTaken ? null : PVP_BORROW_SLOT) : firstOpenCardSlot(member)
		const reason = open === null ? "deck is full" : cardBlockReason(member, open, cardId, lookups)
		if (open === null || reason !== null) skipped.push({ position: member.position, reason: reason ?? "deck is full" })
		else next = setCard(next, member.position, open, cardId)
	}
	return { members: next, skipped }
}

/** The first of a guide pick's styles a member can run ("everyone" is not one). */
export function memberStyleFrom(styles: readonly string[]): MemberStyle | undefined {
	return MEMBER_STYLES.find((style) => styles.includes(style))
}

/** The catalogue lookups the team rules read. PvpCatalogueIndex is one. */
export type TeamRuleLookups = {
	umasById: Map<number, Pick<CatalogueUma, "name" | "character_id">>
	cardsById: Map<number, Pick<CatalogueSupportCard, "name" | "card_type" | "group_members" | "placeholder">>
}

/**
 * Why an uma cannot go at `position`, or null when it can. The game's CM
 * rules: the same uma twice is refused, and so is a second outfit of the same
 * character. The member being replaced does not count against itself.
 *
 * Swapping the uma keeps the deck (setMemberUma), so an uma whose own card is
 * in that spot's deck is refused too: the mirror of cardBlockReason's
 * "can't support herself", which a swap would otherwise walk round. A group
 * card counts for each of its umas (Rice Shower can't take a spot whose deck
 * holds Team Sirius). The server checks the first two rules (pvp_teams.py),
 * not this one.
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
		if (!held) continue
		const self = cardUmas(held).find((uma) => sameUma(uma, candidate.name))
		if (self === undefined) continue
		return held.card_type === "group" ? `${self} is in ${held.name}` : `${held.name}'s card is in this deck`
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
 * A group card is a card of EACH of its umas for the last two (cardUmas):
 * Team Sirius can't support Rice Shower, and can't share a deck with a
 * Special Week card. Those two are client-only: the server checks the same
 * card twice, not the umas behind it.
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
	const candidate = lookups.cardsById.get(cardId)
	// A placeholder is no one card and no one uma: it may stand in twice, and
	// the uma rules below don't apply to it (the server agrees on the repeat).
	if (candidate?.placeholder) return null
	if (others.some((card) => card.support_card === cardId)) return "Already in this deck"
	if (!candidate) return null
	const candidateUmas = cardUmas(candidate)
	const trainee = lookups.umasById.get(member.uma)
	// For an ordinary card the matched name is the card's own, so the message
	// reads as it always has; for a group card it names the member training.
	const self = trainee ? candidateUmas.find((uma) => sameUma(uma, trainee.name)) : undefined
	if (self !== undefined) return `${self} can't support herself`
	for (const card of others) {
		const other = lookups.cardsById.get(card.support_card)
		if (!other || other.placeholder) continue
		const shared = cardUmas(other).find((uma) => candidateUmas.some((mine) => sameUma(mine, uma)))
		if (shared === undefined) continue
		// Two cards of one uma, or two of one group (Team Sirius twice).
		if (sameUma(other.name, candidate.name)) return `${other.name} already has a card in this deck`
		// The uma is in this deck through a group card: "Special Week is in Team Sirius".
		if (other.card_type === "group") return `${shared} is in ${other.name}`
		// A group card meeting a card of one of its umas.
		return `${shared} already has a card in this deck`
	}
	return null
}

/** What putting a guide's deck on a member did: the cards placed, and what could not go in. */
export interface DeckFill {
	cards: PvpTeamCardSlot[]
	/** A card the team rules or its release date kept out, and why ("Oguri Cap can't support herself"). */
	skipped: Array<{ name: string; reason: string }>
	/** A slot the guide fills with words rather than a card ("Any Wit"), left empty. */
	open: Array<{ slot: number; note: string }>
}

/**
 * A guide's deck as a member's cards ("Use this deck", owner 2026-10-24,
 * `guide-visuals-plan-2.md` release C). Each guide slot's main card goes in;
 * its alternatives ("or Light Hello R") do not. The guide's borrow card (else
 * its slot 6) goes in the borrow slot, the rest fill slots 1 to 5 in the
 * guide's order. A card the team's own rules refuse (her own card, a second
 * card of one uma: cardBlockReason) or that is not out by the event's last
 * day (the withinRelease rule) is skipped and named, never forced in: a deck
 * is one more path into a team, and every path applies the same rules.
 *
 * `member` is the one the deck goes on, with the uma it will have.
 */
export function deckToMemberCards(
	deck: PvpDeck,
	member: PvpTeamMember,
	lookups: TeamRuleLookups,
	releaseFor: (pool: "uma" | "support", id: number) => ReleaseStatus
): DeckFill {
	// Each guide slot's main row (its first), in slot order.
	const mains = new Map<number, PvpDeckSlot>()
	for (const row of [...deck.slots].sort((a, b) => a.slot - b.slot || a.order - b.order)) {
		if (!mains.has(row.slot)) mains.set(row.slot, row)
	}
	const rows = [...mains.values()]
	const borrow = rows.find((row) => row.is_borrow) ?? rows.find((row) => row.slot === PVP_BORROW_SLOT) ?? null
	const owned = rows.filter((row) => row !== borrow).slice(0, PVP_BORROW_SLOT - 1)
	const fill: DeckFill = { cards: [], skipped: [], open: [] }
	const place = (row: PvpDeckSlot, slot: number) => {
		const card = row.support_card
		if (!card) {
			fill.open.push({ slot, note: row.note })
			return
		}
		// Checked against the cards placed so far, so the deck's own repeats count.
		const reason = !lookups.cardsById.has(card.id)
			? "Not in the card list"
			: (releaseBlockReason(releaseFor("support", card.id)) ?? cardBlockReason({ ...member, cards: fill.cards }, slot, card.id, lookups))
		if (reason) fill.skipped.push({ name: card.name, reason })
		else fill.cards.push({ slot, support_card: card.id })
	}
	owned.forEach((row, index) => place(row, index + 1))
	if (borrow) place(borrow, PVP_BORROW_SLOT)
	return fill
}

/** The deck "Use this deck" hands to My team, in the router state (never the URL). */
export interface UseDeckRequest {
	useDeck: { deckId: number }
}

/** The handed-over deck's id from a location's state, or null. */
export function deckRequestId(state: unknown): number | null {
	const id = (state as Partial<UseDeckRequest> | null)?.useDeck?.deckId
	return typeof id === "number" ? id : null
}

/**
 * The umas a card counts as in a deck, by name: its own uma for an ordinary
 * card, every member for a group card (group_members, from the game's
 * support_card_group table via the import). The game files a group card under
 * ONE of its umas (Team Sirius under Special Week), so neither its name nor
 * that one character would be right.
 *
 * A group card with no members listed (not on global yet, so never imported,
 * or an API older than the field) counts as none of them: it can still be
 * refused as the same card twice, but blocks no uma.
 */
const RARITY_WORDS: Record<number, string> = { 1: "R", 2: "SR", 3: "SSR" }
const TYPE_WORDS: Record<string, string> = {
	speed: "Speed",
	stamina: "Stamina",
	power: "Power",
	guts: "Guts",
	wit: "Wit",
	friend: "Friend",
	group: "Group",
}

/**
 * What a placeholder card is called everywhere a card's name shows: "Your
 * best SSR Speed card" (owner, 2026-10-27). The admin's row is just "SSR
 * Speed", which reads like a real card. A missing rarity reads as SSR, the
 * convention on SupportCard.rarity.
 */
export function placeholderName(card: Pick<CatalogueSupportCard, "card_type" | "rarity">): string {
	const rarity = RARITY_WORDS[card.rarity ?? 3] ?? ""
	const type = TYPE_WORDS[card.card_type ?? ""] ?? ""
	return ["Your best", rarity, type, "card"].filter(Boolean).join(" ")
}

/** Where a placeholder sorts among the others: SSR first, then the types in TYPE_WORDS's order. */
export function placeholderOrder(card: Pick<CatalogueSupportCard, "card_type" | "rarity">): number {
	const types = Object.keys(TYPE_WORDS)
	const type = types.indexOf(card.card_type ?? "")
	return (3 - (card.rarity ?? 3)) * 10 + (type === -1 ? types.length : type)
}

function cardUmas(card: Pick<CatalogueSupportCard, "name" | "card_type" | "group_members">): string[] {
	return card.card_type === "group" ? (card.group_members ?? []) : [card.name]
}

/**
 * Whether two names are the same uma: a support card's name is its uma's
 * name (the title is what tells the cards apart), and an uma's name adds its
 * outfit in brackets. The API sends no character id for cards (and the ~300
 * not on global yet have none at all), so the name is the key. A group
 * card's members come as names for the same reason.
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

/** `skill_data.group_rate` of a × penalty version: never part of a pair. */
const PENALTY_SKILL_TIER = -1

/**
 * Each white skill's ○/◎ pair, by skill id: the ids of every white in its
 * group, itself included, the × penalty version left out. A skill with no
 * other white is not in the map, so read it as `pairs.get(id) ?? [id]`.
 *
 * Most green skills, and the Straightaways / Corners whites, come as a ○ and
 * a ◎, both white, and a team treats them as one skill (owner, 2026-10-16).
 * No card or uma teaches a ◎ in the game data, so a search for the ◎ has to
 * find the cards that teach the ○. A gold in the same group (Right-Handed
 * Demon) is a different skill and stays out: its rarity is gold.
 */
export function whiteSkillPairs(skills: Iterable<CatalogueSkill>): Map<number, number[]> {
	const whitesByGroup = new Map<number, number[]>()
	for (const skill of skills) {
		if (skill.rarity !== WHITE_SKILL_RARITY || skill.tier === PENALTY_SKILL_TIER || skill.group_id === null) continue
		const group = whitesByGroup.get(skill.group_id) ?? []
		group.push(skill.id)
		whitesByGroup.set(skill.group_id, group)
	}
	const pairs = new Map<number, number[]>()
	for (const ids of whitesByGroup.values()) {
		if (ids.length < 2) continue
		for (const id of ids) pairs.set(id, ids)
	}
	return pairs
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
