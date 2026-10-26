import { describe, expect, it } from "vitest"
import { formatScore, gradeLabel, veteranTag, veteranText } from "../utils/veteranGrade"
import type { TrainedUma } from "../types/trainedUma"

/**
 * How a veteran is named (utils/veteranGrade.ts). The grade numbers below are
 * the owner's real ones, with scores in the bands their file held.
 */

const veteran = (extra: Partial<TrainedUma>) =>
	({ label: "", memo: "", rank_score: null, rank_grade: null, speed: 1200, stamina: 743, power: 1097, guts: 637, wit: 1081, ...extra }) as TrainedUma

describe("gradeLabel", () => {
	it("reads the ladder the owner's file fits", () => {
		expect([12, 13, 14, 15, 16, 17, 18].map(gradeLabel)).toEqual(["B+", "A", "A+", "S", "S+", "SS", "SS+"])
		expect([1, 11].map(gradeLabel)).toEqual(["G", "B"])
	})

	it("counts the U-ranks ten to a tier", () => {
		expect([19, 20, 28, 29, 30, 39].map(gradeLabel)).toEqual(["UG", "UG1", "UG9", "UF", "UF1", "UE"])
	})

	it("shows no letter it can't confirm, or for nothing", () => {
		expect(gradeLabel(49)).toBeNull()
		expect(gradeLabel(null)).toBeNull()
		expect(gradeLabel(0)).toBeNull()
	})
})

describe("naming a veteran", () => {
	it("is grade and score, as the game shows them", () => {
		expect(veteranTag(veteran({ rank_score: 13815, rank_grade: 14 }))).toBe("A+ 13,815")
		expect(veteranTag(veteran({ rank_score: 12000 }))).toBe("12,000")
		expect(veteranTag(veteran({}))).toBeNull()
		expect(formatScore(24089)).toBe("24,089")
	})

	it("puts the label, else the memo, first; the stat line only as a last resort", () => {
		expect(veteranText(veteran({ label: "Main", rank_score: 13815, rank_grade: 14 }))).toBe("Main · A+ 13,815")
		expect(veteranText(veteran({ memo: "Ace", rank_score: 15120, rank_grade: 15 }))).toBe("Ace · S 15,120")
		expect(veteranText(veteran({ rank_score: 15120, rank_grade: 15 }))).toBe("S 15,120")
		expect(veteranText(veteran({}))).toBe("1200 / 743 / 1097 / 637 / 1081")
	})
})
