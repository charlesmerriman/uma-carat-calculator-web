/**
 * The PvP team picture's words: the team's shape, an uma's name split from her
 * outfit, and the file name. The race's tiles are courseDetails.test.tsx.
 */
import { describe, expect, it } from "vitest"
import type { RaceEvent } from "../types"
import type { MemberStyle, PvpTeamMember } from "../types/pvpTeam"
import { splitUmaName, teamPictureFilename, teamShape } from "../utils/teamPicture"

const member = (position: number, style: MemberStyle): PvpTeamMember => ({ position, uma: position + 1, style, cards: [] })

// Capricorn Cup's fields as the API sends them (CM 21).
const CAPRICORN = {
	id: 21, event_type: "champions_meeting", cm_number: 21, name: "Champions Meeting 21 Capricorn Cup",
	start_date: "2026-10-31T22:00:00Z", end_date: "2026-11-06T21:59:59Z", image: null,
	track: "Chukyo", surface_type: "Turf", distance: "Sprint", length: "1200", direction: "Left",
	track_condition: "Firm", season: "Winter", weather: "Sunny",
} as unknown as RaceEvent

describe("teamShape", () => {
	it("counts each style, front of the pack first, the way a guide writes a comp", () => {
		expect(teamShape([member(0, "end"), member(1, "pace"), member(2, "pace")])).toBe("2 Pace + 1 End")
		expect(teamShape([member(0, "late"), member(1, "runaway")])).toBe("1 Runaway + 1 Late")
		expect(teamShape([])).toBe("")
	})
})

describe("splitUmaName", () => {
	it("puts an outfit on its own line", () => {
		expect(splitUmaName("Taiki Shuttle (Camping)")).toEqual({ name: "Taiki Shuttle", outfit: "Camping" })
		expect(splitUmaName("Nishino Flower")).toEqual({ name: "Nishino Flower", outfit: null })
	})
})

describe("teamPictureFilename", () => {
	it("names the event", () => {
		expect(teamPictureFilename(CAPRICORN, "2026-10-29")).toBe("uma-team-cm21-2026-10-29.png")
		const loh = { ...CAPRICORN, event_type: "league_of_heroes", loh_number: 4 } as unknown as RaceEvent
		expect(teamPictureFilename(loh, "2026-10-29")).toBe("uma-team-loh4-2026-10-29.png")
	})
})
