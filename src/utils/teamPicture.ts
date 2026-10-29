/**
 * The words and numbers of the PvP team picture (components/pvp/share/
 * TeamPicture.tsx; notes/team-picture-plan.md), kept here so they can be
 * tested without drawing it.
 */

import type { RaceEvent } from "../types"
import type { MemberStyle, PvpTeamMember } from "../types/pvpTeam"
import { availableCourseDetails } from "./courseDetails"
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

export interface CourseTile {
	label: string
	value: string
	note: string | null
}

/** "1200" or "1200m" as metres, else null. Editors type both. */
function metres(text: string | undefined): number | null {
	const match = text ? /^(\d{3,4})\s*m?$/i.exec(text.trim()) : null
	return match ? Number(match[1]) : null
}

const GROUNDS = new Set(["firm", "good", "soft", "heavy"])

/**
 * The race as four headline tiles: Racecourse (its direction under it),
 * Distance (the metres, the band under them), Surface (the ground) and
 * Weather (the season). Every field is typed by an editor and may still read
 * "TBD", so a tile whose headline isn't announced is left out, and a field
 * that doesn't read as expected is shown as typed rather than guessed at.
 */
export function courseTiles(event: RaceEvent): CourseTile[] {
	const known = new Map(availableCourseDetails(event).map((detail) => [detail.label, detail.value.trim()]))
	const direction = known.get("Direction")
	const condition = known.get("Track condition")

	// The metres can sit in either field ("Distance: 2200", "Length: Medium"),
	// and the band word in the other.
	const length = known.get("Length")
	const distance = known.get("Distance")
	const meters = metres(length) ?? metres(distance)
	const band = [distance, length].find((text) => text !== undefined && metres(text) === null) ?? null

	const tiles: Array<CourseTile | null> = [
		known.has("Racecourse")
			? {
					label: "Racecourse",
					value: known.get("Racecourse")!,
					note: direction === undefined ? null : /^(left|right)$/i.test(direction) ? `${direction}-handed` : direction,
				}
			: null,
		meters !== null
			? { label: "Distance", value: `${meters.toLocaleString("en-US")}m`, note: band }
			: band !== null
				? { label: "Distance", value: band, note: null }
				: null,
		known.has("Surface")
			? {
					label: "Surface",
					value: known.get("Surface")!,
					note: condition === undefined ? null : GROUNDS.has(condition.toLowerCase()) ? `${condition} ground` : condition,
				}
			: null,
		known.has("Weather") ? { label: "Weather", value: known.get("Weather")!, note: known.get("Season") ?? null } : null,
	]
	return tiles.filter((tile): tile is CourseTile => tile !== null)
}

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
