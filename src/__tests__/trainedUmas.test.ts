import { describe, expect, it } from "vitest"
import {
	aptitudeSummary,
	draftFromVeteran,
	draftProblems,
	draftToInput,
	emptyDraft,
	isUniqueSkill,
	searchSkills,
	toggleSkill,
	withUma,
} from "../utils/trainedUmas"
import type { CatalogueSkill, CatalogueUma } from "../types/pvpTeam"
import type { TrainedUma } from "../types/trainedUma"

/** The veteran form's rules (components/collection/VeteranForm.tsx). */

const APT = { turf: 8, dirt: 1, short: 3, mile: 7, medium: 7, long: 6, front: 2, pace: 7, late: 7, end: 4 }

const filled = () => {
	const draft = withUma(emptyDraft(), { id: 41, apt: APT })
	return { ...draft, stats: { speed: "1200", stamina: "800", power: "1000", guts: "400", wit: "900" } }
}

const skill = (id: number, name: string, rarity = 1) => ({ id, name, rarity }) as CatalogueSkill

describe("the veteran draft", () => {
	it("starts a picked uma on her own aptitudes, keeping what was typed", () => {
		const typed = { ...emptyDraft(), label: "Ace", stats: { ...emptyDraft().stats, speed: "1100" } }
		const draft = withUma(typed, { id: 41, apt: { ...APT, end: null } } as Pick<CatalogueUma, "id" | "apt">)
		expect(draft.uma).toBe(41)
		expect(draft.apt.turf).toBe(8)
		expect(draft.apt.end).toBeNull()
		expect(draft.label).toBe("Ace")
		expect(draft.stats.speed).toBe("1100")
	})

	it("names each field that would be refused", () => {
		expect(draftProblems(emptyDraft())).toMatchObject({ uma: "Pick the uma first.", speed: "Required." })
		expect(draftProblems({ ...filled(), stats: { ...filled().stats, wit: "2001" } })).toEqual({ wit: "0 to 2000." })
		expect(draftProblems({ ...filled(), stats: { ...filled().stats, guts: "4.5" } })).toEqual({ guts: "0 to 2000." })
		expect(draftProblems({ ...filled(), label: "x".repeat(41) })).toEqual({ label: "At most 40 characters." })
		expect(draftProblems(filled())).toEqual({})
	})

	it("turns into what the API takes, numbers as numbers and the label trimmed", () => {
		const input = draftToInput({ ...filled(), label: "  Ace ", skills: [{ skill: 9, level: 3 }] })
		expect(input).toEqual({
			uma: 41, label: "Ace", speed: 1200, stamina: 800, power: 1000, guts: 400, wit: 900,
			apt: APT, skills: [{ skill: 9, level: 3 }],
		})
	})

	it("round-trips a saved veteran", () => {
		const veteran = { ...draftToInput(filled()), id: 7, rank_score: null, source: "manual", import_key: null,
			missing_from_import: false, created_at: "", updated_at: "" } as TrainedUma
		expect(draftToInput(draftFromVeteran(veteran))).toEqual(draftToInput(filled()))
	})

	it("adds a skill at level 1 and takes it off again", () => {
		const added = toggleSkill(emptyDraft(), 9)
		expect(added.skills).toEqual([{ skill: 9, level: 1 }])
		expect(toggleSkill(added, 9).skills).toEqual([])
	})
})

describe("skills", () => {
	const SKILLS = [skill(1, "Corner Adept ○"), skill(2, "Corner Adept ◎"), skill(3, "Straightaway Adept"), skill(4, "Shooting Star", 5)]

	it("finds every word, ignoring case and the ○ ◎ marks, and skips picked ones", () => {
		expect(searchSkills(SKILLS, "corner ◎", new Set()).map((each) => each.id)).toEqual([1, 2])
		expect(searchSkills(SKILLS, "adept corner", new Set([1])).map((each) => each.id)).toEqual([2])
		expect(searchSkills(SKILLS, "c", new Set())).toEqual([])
	})

	it("levels only a unique skill", () => {
		expect(isUniqueSkill(SKILLS[3])).toBe(true)
		expect(isUniqueSkill(SKILLS[0])).toBe(false)
	})

	it("sums up the A and S letters for a list row", () => {
		expect(aptitudeSummary(APT)).toBe("Turf S · Mile A · Medium A · Pace A · Late A")
	})
})
