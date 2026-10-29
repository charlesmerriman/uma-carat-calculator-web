/**
 * The words and numbers of the PvP team picture (components/pvp/share/
 * TeamPicture.tsx; notes/team-picture-plan.md), kept here so they can be
 * tested without drawing it.
 */

import type { RaceEvent } from "../types"
import type { MemberStyle, PvpTeamMember } from "../types/pvpTeam"
import { STYLE_LABELS } from "./pvpGuide"
import { MEMBER_STYLES } from "./pvpTeams"

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
 * Where each style runs along the team shape strip's straight, as a share of
 * its width: the back of the pack on the left, the goal on the right. Every
 * member style has a place (MEMBER_STYLES is the list the strip labels).
 */
export const STYLE_ON_STRAIGHT: Record<MemberStyle, number> = {
	end: 10,
	late: 30,
	pace: 50,
	front: 68,
	runaway: 82,
}

/** The strip's labels, back of the pack first. */
export const STRAIGHT_STYLES: MemberStyle[] = [...MEMBER_STYLES].sort((a, b) => STYLE_ON_STRAIGHT[a] - STYLE_ON_STRAIGHT[b])

/** "Taiki Shuttle (Camping)" -> "Taiki Shuttle" over "Camping"; no outfit, no second line. */
export function splitUmaName(name: string): { name: string; outfit: string | null } {
	const match = /^(.+?)\s*\(([^()]+)\)$/.exec(name.trim())
	return match ? { name: match[1], outfit: match[2] } : { name: name.trim(), outfit: null }
}

/** `uma-team-cm21-2026-10-29.png` (`loh4` for a League of Heroes). */
export function teamPictureFilename(event: RaceEvent, date: string): string {
	const tag = event.event_type === "champions_meeting" ? `cm${event.cm_number}` : `loh${event.loh_number}`
	return `uma-team-${tag}-${date}.png`
}
