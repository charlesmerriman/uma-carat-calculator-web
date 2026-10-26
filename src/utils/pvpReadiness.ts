/**
 * How ready a team is for its event, as the counts the readiness strip above
 * My team's grid shows (notes/pvp-planner-plan.md, R1 item 5):
 *
 *   Umas 3/3 · Cards 12/18 · Aptitudes 2 to fix · Skills 9 of 14
 *
 * Pure, and built only from helpers the rest of My team already uses, so the
 * strip can never disagree with what it summarises: the aptitudes are the
 * letters the grid draws (aptitudeKeysForEvent, the same three per member),
 * and a skill counts as covered exactly when the Skills panel ticks it
 * (familySources over teamSkillSources).
 *
 * Stat targets join once a member can carry a veteran's stats (R2).
 */

import { aptitudeKeysForEvent, aptitudeLetter } from "./courseAptitude"
import { familySources, guideSkillsByCategory } from "./pvpGuide"
import { PVP_DECK_SIZE, PVP_TEAM_SIZE } from "./pvpTeams"
import type { RaceEvent } from "../types"
import type { PvpGuide } from "../types/pvpGuide"
import type { CatalogueUma, PvpTeamMember } from "../types/pvpTeam"

/** The game's A, on the 1..8 scale (G..S). Anything below it is worth fixing. */
export const GOOD_APTITUDE = 7

export interface Count {
	have: number
	of: number
}

/** One letter below A: "Spot 2 · Long D". */
export interface AptitudeGap {
	position: number
	label: string
	letter: string
}

export interface Readiness {
	umas: Count
	cards: Count
	/** Every letter below A the race asks of the team, spot by spot. */
	aptitudes: AptitudeGap[]
	/** The guide's recommended skills the team can get; null with no guide or no picks. */
	skills: Count | null
}

export function pvpReadiness(
	members: PvpTeamMember[],
	course: Pick<RaceEvent, "surface_type" | "distance" | "length">,
	guide: PvpGuide | null,
	umasById: Map<number, Pick<CatalogueUma, "apt">>,
	skillSources: Map<number, string[]>
): Readiness {
	const aptitudes: AptitudeGap[] = []
	for (const member of [...members].sort((a, b) => a.position - b.position)) {
		const uma = umasById.get(member.uma)
		if (!uma) continue
		for (const aptitude of aptitudeKeysForEvent(course, member.style)) {
			const value = uma.apt[aptitude.key]
			// An unknown letter (null) is not a gap: the grid draws it as "?".
			if (value != null && value < GOOD_APTITUDE) {
				aptitudes.push({ position: member.position, label: aptitude.label, letter: aptitudeLetter(value) ?? "?" })
			}
		}
	}

	let skills: Count | null = null
	if (guide) {
		const picks = guideSkillsByCategory(guide).flatMap((group) => group.skills)
		if (picks.length > 0) {
			skills = {
				have: picks.filter((pick) => familySources(skillSources, pick.skill) !== null).length,
				of: picks.length,
			}
		}
	}

	return {
		umas: { have: members.length, of: PVP_TEAM_SIZE },
		cards: { have: members.reduce((sum, member) => sum + member.cards.length, 0), of: PVP_TEAM_SIZE * PVP_DECK_SIZE },
		aptitudes,
		skills,
	}
}
