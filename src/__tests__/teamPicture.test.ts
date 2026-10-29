/**
 * The PvP team picture's words: the team's shape, an uma's name split from her
 * outfit, and the file name. The race's tiles are courseDetails.test.tsx.
 */
import { describe, expect, it } from "vitest"
import type { RaceEvent } from "../types"
import type { MemberStyle, PvpTeamMember } from "../types/pvpTeam"
import { STRAIGHT_STYLES, splitUmaName, teamPictureFilename, teamShape } from "../utils/teamPicture"
import { fileSlug, fileStamp, shareFileName } from "../utils/shareFileName"

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

describe("the team shape strip", () => {
	it("runs Runaway to End, left to right, like the game", () => {
		expect(STRAIGHT_STYLES).toEqual(["runaway", "front", "pace", "late", "end"])
	})
})

describe("teamPictureFilename", () => {
	it("names the event, the names shown and the minute", () => {
		expect(teamPictureFilename(CAPRICORN, "2026-10-29-1615")).toBe("uma-team-cm21-2026-10-29-1615.png")
		const loh = { ...CAPRICORN, event_type: "league_of_heroes", loh_number: 4 } as unknown as RaceEvent
		expect(teamPictureFilename(loh, "2026-10-29-1615", [null, "Plan B"])).toBe("uma-team-loh4-plan-b-2026-10-29-1615.png")
		expect(teamPictureFilename(CAPRICORN, "2026-10-29-1615", ["MooncakeMile", null])).toBe("uma-team-cm21-mooncakemile-2026-10-29-1615.png")
	})
})

describe("share file names", () => {
	it("stamps the viewer's date and time to the minute", () => {
		expect(fileStamp(new Date(2026, 9, 29, 16, 5))).toBe("2026-10-29-1605")
	})

	it("keeps letters and digits of any script, one dash between words", () => {
		expect(fileSlug("  Main plan!! v2 ")).toBe("main-plan-v2")
		expect(fileSlug("ウマ娘 計画")).toBe("ウマ娘-計画")
		expect(fileSlug("x".repeat(60))).toHaveLength(40)
	})

	it("drops a blank part", () => {
		expect(shareFileName("uma-plan", [null, "Main", "", undefined], "2026-10-29-1605")).toBe("uma-plan-main-2026-10-29-1605.png")
		expect(shareFileName("uma-plan", ["!!!"], "2026-10-29-1605")).toBe("uma-plan-2026-10-29-1605.png")
	})
})
