/**
 * A guest's PvP teams, kept on this device.
 *
 * The same three rules as the guest plan (services/guestPlanStore.ts), for the
 * same reasons; read that file's header first:
 *
 *   1. IDS, NEVER OBJECTS. A team stores catalogue ids and the event's id;
 *      names and art come from the catalogue when it is drawn.
 *   2. ONLY WHAT WAS TYPED WHILE SIGNED OUT. An account's teams never land
 *      here. PvpTeamsProvider decides guest-or-account once, when it loads.
 *   3. LOCALSTORAGE IS NOT DURABLE. Every call is wrapped, a failed write is
 *      reported (writeGuestPvpTeams returns false), and a damaged entry costs
 *      that team or that row, never everything.
 *
 * Read field by field, so anything a later bundle (or a hand edit) put in
 * storage stays out of what the provider and the sign-in import send.
 */

import type { MemberStyle, PvpNote, PvpNoteColor, PvpTeamCardSlot, PvpTeamMember } from "../types/pvpTeam"
import type { PvpEventKind } from "../utils/pvpEvent"
import { MEMBER_STYLES, PVP_DECK_SIZE, PVP_TEAM_SIZE } from "../utils/pvpTeams"

const STORAGE_KEY = "guestPvpTeams.v1"

/** The note limits the server enforces (views/pvp_team.py NoteSerializer). */
export const PVP_NOTE_CAP = 10
export const PVP_NOTE_MAX_LENGTH = 1000
const NOTE_COLORS: PvpNoteColor[] = ["yellow", "pink", "blue", "green"]

export interface GuestPvpTeam {
	kind: PvpEventKind
	event: number
	name: string
	focus: boolean
	notes: PvpNote[]
	members: PvpTeamMember[]
}

interface GuestPvpTeamsEnvelope {
	version: 1
	savedAt: number
	teams: GuestPvpTeam[]
}

const isId = (value: unknown): value is number =>
	typeof value === "number" && Number.isInteger(value) && value > 0

const isInRange = (value: unknown, low: number, high: number): value is number =>
	typeof value === "number" && Number.isInteger(value) && value >= low && value <= high

function readCard(raw: unknown): PvpTeamCardSlot | null {
	if (typeof raw !== "object" || raw === null) return null
	const row = raw as Record<string, unknown>
	if (!isInRange(row.slot, 1, PVP_DECK_SIZE) || !isId(row.support_card)) return null
	return { slot: row.slot, support_card: row.support_card }
}

function readMember(raw: unknown): PvpTeamMember | null {
	if (typeof raw !== "object" || raw === null) return null
	const row = raw as Record<string, unknown>
	if (!isInRange(row.position, 0, PVP_TEAM_SIZE - 1) || !isId(row.uma)) return null
	if (!MEMBER_STYLES.includes(row.style as MemberStyle)) return null
	// One card per slot and per deck: the first of a clash wins, the rest go.
	const cards: PvpTeamCardSlot[] = []
	for (const card of Array.isArray(row.cards) ? row.cards.map(readCard) : []) {
		if (!card) continue
		if (cards.some((kept) => kept.slot === card.slot || kept.support_card === card.support_card)) continue
		cards.push(card)
	}
	cards.sort((a, b) => a.slot - b.slot)
	return { position: row.position, uma: row.uma, style: row.style as MemberStyle, cards }
}

function readNote(raw: unknown): PvpNote | null {
	if (typeof raw !== "object" || raw === null) return null
	const row = raw as Record<string, unknown>
	if (typeof row.text !== "string" || row.text.length > PVP_NOTE_MAX_LENGTH) return null
	if (!NOTE_COLORS.includes(row.color as PvpNoteColor)) return null
	return { text: row.text, color: row.color as PvpNoteColor }
}

function readTeam(raw: unknown): GuestPvpTeam | null {
	if (typeof raw !== "object" || raw === null) return null
	const row = raw as Record<string, unknown>
	if ((row.kind !== "cm" && row.kind !== "loh") || !isId(row.event)) return null
	// Same rule per member as per card: the first holder of a position or an
	// uma keeps it. (Two outfits of one character need the catalogue to spot;
	// the server refuses that at sign-in and the team stays on the device.)
	const members: PvpTeamMember[] = []
	for (const member of Array.isArray(row.members) ? row.members.map(readMember) : []) {
		if (!member) continue
		if (members.some((kept) => kept.position === member.position || kept.uma === member.uma)) continue
		members.push(member)
	}
	members.sort((a, b) => a.position - b.position)
	const notes = (Array.isArray(row.notes) ? row.notes.map(readNote) : [])
		.filter((note): note is PvpNote => note !== null)
		.slice(0, PVP_NOTE_CAP)
	return {
		kind: row.kind,
		event: row.event,
		name: typeof row.name === "string" ? row.name.slice(0, 40) : "",
		focus: row.focus === true,
		notes,
		members,
	}
}

/** The teams on this device, oldest first. Empty when there are none or storage is blocked. */
export function readGuestPvpTeams(): GuestPvpTeam[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return []
		const parsed: unknown = JSON.parse(raw)
		// An unknown version is left alone: it may be a newer bundle's.
		if (typeof parsed !== "object" || parsed === null || (parsed as GuestPvpTeamsEnvelope).version !== 1) {
			return []
		}
		const rows = (parsed as Record<string, unknown>).teams
		const teams = (Array.isArray(rows) ? rows.map(readTeam) : []).filter(
			(team): team is GuestPvpTeam => team !== null
		)
		// At most one pin, like the server's partial unique constraint: the
		// first pinned team keeps it.
		let pinned = false
		return teams.map((team) => {
			if (!team.focus) return team
			if (pinned) return { ...team, focus: false }
			pinned = true
			return team
		})
	} catch {
		return []
	}
}

/**
 * Write the guest's teams. Returns whether the write LANDED, so the caller
 * can tell the guest when this browser won't keep their work. No teams
 * removes the key instead of storing an empty envelope.
 */
export function writeGuestPvpTeams(teams: GuestPvpTeam[]): boolean {
	try {
		if (teams.length === 0) {
			localStorage.removeItem(STORAGE_KEY)
			return true
		}
		const envelope: GuestPvpTeamsEnvelope = { version: 1, savedAt: Date.now(), teams }
		localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope))
		return true
	} catch {
		return false
	}
}

export function clearGuestPvpTeams(): void {
	try {
		localStorage.removeItem(STORAGE_KEY)
	} catch {
		// Nothing to clear in a browser that would not store it.
	}
}

/**
 * Watch for ANOTHER TAB changing the teams (the browser fires `storage`
 * everywhere but the tab that wrote). Returns an unsubscribe function.
 */
export function subscribeToGuestPvpTeams(listener: () => void): () => void {
	const handleStorage = (event: StorageEvent): void => {
		if (event.key === null || event.key === STORAGE_KEY) listener()
	}
	window.addEventListener("storage", handleStorage)
	return () => window.removeEventListener("storage", handleStorage)
}
