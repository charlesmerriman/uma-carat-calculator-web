/**
 * The words and numbers of the PvP team picture (components/pvp/share/
 * TeamPicture.tsx; notes/team-picture-plan.md), kept here so they can be
 * tested without drawing it.
 */

import type { RaceEvent } from "../types"
import type { MemberStyle, PvpTeamMember } from "../types/pvpTeam"
import { STYLE_LABELS } from "./pvpGuide"
import { MEMBER_STYLES } from "./pvpTeams"
import { shareFileName } from "./shareFileName"

/** The order a team's styles are named in, front of the pack first. */
const SHAPE_ORDER: MemberStyle[] = ["runaway", "front", "pace", "late", "end"]

/**
 * "2 Pace + 1 End": how many run each style, the way the guides write a team
 * comp (`team_comps`). Empty for a team with no umas.
 */
export function teamShape(members: PvpTeamMember[]): string {
	const counts = new Map<MemberStyle, number>()
	for (const member of members) counts.set(member.style, (counts.get(member.style) ?? 0) + 1)
	return SHAPE_ORDER.filter((style) => counts.has(style))
		.map((style) => `${counts.get(style)} ${STYLE_LABELS[style]}`)
		.join(" + ")
}

/**
 * Where each style sits along the team shape strip, as a share of its width:
 * Runaway on the left to End on the right, the order the game and every other
 * part of the site uses (Daptrius, 2026-10-29; it ran End to Runaway toward a
 * goal post until then). Every member style has a place (MEMBER_STYLES is the
 * list the strip labels).
 */
export const STYLE_ON_STRAIGHT: Record<MemberStyle, number> = {
	runaway: 10,
	front: 30,
	pace: 50,
	late: 70,
	end: 90,
}

/** The strip's labels, Runaway first. */
export const STRAIGHT_STYLES: MemberStyle[] = [...MEMBER_STYLES].sort((a, b) => STYLE_ON_STRAIGHT[a] - STYLE_ON_STRAIGHT[b])

/** "Taiki Shuttle (Camping)" -> "Taiki Shuttle" over "Camping"; no outfit, no second line. */
export function splitUmaName(name: string): { name: string; outfit: string | null } {
	const match = /^(.+?)\s*\(([^()]+)\)$/.exec(name.trim())
	return match ? { name: match[1], outfit: match[2] } : { name: name.trim(), outfit: null }
}

/**
 * `uma-team-cm21-plan-b-2026-10-29-1615.png` (`loh4` for a League of Heroes):
 * the event, then each of `names` that is set (the player's, only when shown;
 * the team's, when it has one), then the minute (utils/shareFileName.ts).
 */
export function teamPictureFilename(event: RaceEvent, stamp: string, names: Array<string | null> = []): string {
	const tag = event.event_type === "champions_meeting" ? `cm${event.cm_number}` : `loh${event.loh_number}`
	return shareFileName("uma-team", [tag, ...names], stamp)
}
