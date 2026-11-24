// @vitest-environment node
//
// Which layout a banner section gets, as a table. The five shapes that occur in
// production are each a row (docs/timeline.md "Count drives the layout": 22 / 4 /
// 3 / 4 / 1 rows on the sheet), plus the ordinary banner and the cases that
// exist to prove the rule: the card count decides, never the category.
import { describe, expect, it } from "vitest"
import { COLUMN_TILE_CAPACITY, sectionLayout } from "../components/timeline/sectionLayout"

type Input = Parameters<typeof sectionLayout>[0]

const section = (input: Partial<Input>): Input => ({
	category: "standard",
	hasUmaBanner: true,
	umaCount: 1,
	hasSupportBanner: true,
	supportCount: 2,
	hasImage: true,
	...input,
})

describe("sectionLayout", () => {
	it.each([
		{
			name: "race-prep with art (22 rows): the ten cards band, the uma stays beside the art",
			input: section({ category: "race_prep_support", umaCount: 1, supportCount: 10 }),
			expected: { shape: "pair", uma: "column", support: "band", showArt: true, hasBand: true },
		},
		{
			name: "race-prep without art (4): no placeholder beside a lone uma, so the panel sits alone",
			input: section({ category: "race_prep_support", umaCount: 1, supportCount: 10, hasImage: false }),
			expected: { shape: "panel-only", uma: "column", support: "band", showArt: false, hasBand: true },
		},
		{
			name: "race-prep with no uma (3): no empty uma panel, the art alone above the band",
			input: section({ category: "race_prep_support", hasUmaBanner: false, umaCount: 0, supportCount: 10 }),
			expected: { shape: "art-only", uma: "hidden", support: "band", showArt: true, hasBand: true },
		},
		{
			name: "a Golden Week revival (4): umas banded, no art, no empty support panel",
			input: section({ category: "golden_week_revival", umaCount: 11, hasSupportBanner: false, supportCount: 0, hasImage: false }),
			expected: { shape: "bands-only", uma: "band", support: "hidden", showArt: false, hasBand: true },
		},
		{
			name: "the launch banner (1): a standard row, nine umas and twenty cards, both banded on count alone",
			input: section({ umaCount: 9, supportCount: 20, hasImage: false }),
			expected: { shape: "bands-only", uma: "band", support: "band", showArt: false, hasBand: true },
		},
		{
			name: "an ordinary banner: three columns",
			input: section({ umaCount: 2, supportCount: 2 }),
			expected: { shape: "three", uma: "column", support: "column", showArt: true, hasBand: false },
		},
		{
			name: "an ordinary banner with no art yet: still three columns, with the placeholder",
			input: section({ umaCount: 1, supportCount: 2, hasImage: false }),
			expected: { shape: "three", uma: "column", support: "column", showArt: true, hasBand: false },
		},
		{
			name: "a race-prep batch small enough for columns: the support-led weights",
			input: section({ category: "race_prep_support", umaCount: 1, supportCount: 2 }),
			expected: { shape: "support-led", uma: "column", support: "column", showArt: true, hasBand: false },
		},
		{
			name: "a rerun: labelled, laid out like any other banner",
			input: section({ category: "rerun", umaCount: 1, supportCount: 1 }),
			expected: { shape: "three", uma: "column", support: "column", showArt: true, hasBand: false },
		},
		{
			name: "a miscategorised revival: four umas on a standard row still open into a band",
			input: section({ umaCount: 4, hasSupportBanner: false, supportCount: 0, hasImage: false }),
			expected: { shape: "bands-only", uma: "band", support: "hidden", showArt: false, hasBand: true },
		},
		{
			name: "a revival with only two umas: the category still forces the band",
			input: section({ category: "golden_week_revival", umaCount: 2, hasSupportBanner: false, supportCount: 0, hasImage: false }),
			expected: { shape: "bands-only", uma: "band", support: "hidden", showArt: false, hasBand: true },
		},
		{
			name: "umas banded, supports not: the support panel keeps the far column, beside the art",
			input: section({ umaCount: 5, supportCount: 2 }),
			expected: { shape: "pair", uma: "band", support: "column", showArt: true, hasBand: true },
		},
		{
			name: "no banner on either side: both empty states show, as the whole section",
			input: section({ hasUmaBanner: false, umaCount: 0, hasSupportBanner: false, supportCount: 0, hasImage: false }),
			expected: { shape: "three", uma: "column", support: "column", showArt: true, hasBand: false },
		},
		{
			name: "a support banner only, small: the empty uma panel still shows beside it",
			input: section({ hasUmaBanner: false, umaCount: 0, supportCount: 2 }),
			expected: { shape: "three", uma: "column", support: "column", showArt: true, hasBand: false },
		},
	])("$name", ({ input, expected }) => {
		expect(sectionLayout(input)).toEqual(expected)
	})

	it("bands a panel on the first card past a column's capacity, and not before", () => {
		expect(sectionLayout(section({ umaCount: COLUMN_TILE_CAPACITY })).uma).toBe("column")
		expect(sectionLayout(section({ umaCount: COLUMN_TILE_CAPACITY + 1 })).uma).toBe("band")
		expect(sectionLayout(section({ supportCount: COLUMN_TILE_CAPACITY })).support).toBe("column")
		expect(sectionLayout(section({ supportCount: COLUMN_TILE_CAPACITY + 1 })).support).toBe("band")
	})

	it("never puts two panels in columns once anything has banded", () => {
		// The three-column templates are only ever reached by the ordinary case.
		for (const umaCount of [0, 1, 2, 3, 9]) {
			for (const supportCount of [0, 1, 2, 3, 20]) {
				const layout = sectionLayout(section({ umaCount, hasUmaBanner: umaCount > 0, supportCount, hasSupportBanner: supportCount > 0 }))
				const bothInColumns = layout.uma === "column" && layout.support === "column"
				expect(bothInColumns && layout.hasBand).toBe(false)
				expect(layout.shape === "three" || layout.shape === "support-led").toBe(bothInColumns)
			}
		}
	})
})
