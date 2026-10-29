/**
 * How the plan picture lays out a plan of a given length (utils/planPictureLayout.ts):
 * every banner, always, in a shape that stays readable.
 */
import { describe, expect, it } from "vitest"
import { planPictureLayout, splitColumns } from "../utils/planPictureLayout"
import type { PlannerRow } from "../utils/plannerSections"
import type { UserPlannedBanner } from "../types"

const banner = (index: number): PlannerRow => ({ kind: "banner", banner: { id: index } as UserPlannedBanner, index })
const band = (key: string): PlannerRow => ({ kind: "band", key, markers: [] })
const names = (rows: PlannerRow[]) => rows.map((row) => (row.kind === "band" ? row.key : row.index))

describe("planPictureLayout", () => {
	it("keeps the poster to 15 banners, compact rows to 30, then two columns", () => {
		expect(planPictureLayout(1)).toBe("poster")
		expect(planPictureLayout(15)).toBe("poster")
		expect(planPictureLayout(16)).toBe("compact")
		expect(planPictureLayout(30)).toBe("compact")
		expect(planPictureLayout(31)).toBe("columns")
	})
})

describe("splitColumns", () => {
	it("gives the left column the first half, the extra banner when odd", () => {
		const [left, right] = splitColumns([0, 1, 2, 3, 4].map(banner))
		expect(names(left)).toEqual([0, 1, 2])
		expect(names(right)).toEqual([3, 4])
	})

	it("moves a milestone to the column of the banner after it", () => {
		const rows = [band("launch"), banner(0), banner(1), band("anniversary"), banner(2), banner(3)]
		const [left, right] = splitColumns(rows)
		expect(names(left)).toEqual(["launch", 0, 1])
		expect(names(right)).toEqual(["anniversary", 2, 3])
	})

	it("loses no row", () => {
		const rows = [band("a"), ...[0, 1, 2].map(banner), band("b"), band("c"), ...[3, 4, 5, 6].map(banner)]
		const [left, right] = splitColumns(rows)
		expect([...left, ...right]).toEqual(rows)
	})
})
