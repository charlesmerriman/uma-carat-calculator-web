import type { BannerCategory } from "../../types"

/**
 * WHICH LAYOUT A BANNER SECTION GETS. One pure function, so the decision can
 * be tested as a table and the JSX only has to write the answer down
 * (`data-shape`, `data-layout`); `src/timeline.css` turns it into geometry.
 *
 * THE GOVERNING RULE: COUNT DRIVES THE GRID, CATEGORY DRIVES THE CHROME.
 * How many tiles fit on a row is a function of how many cards the banner
 * actually has, never of its category, so a miscategorised row (an editor
 * forgetting to mark next year's revival) renders plainly but completely,
 * and never clips nine umas. The JP launch banner is the case that forces
 * this: nine umas AND twenty support cards on a `standard` row with no art,
 * which no category could have flagged.
 *
 * A category may still FORCE a band (the revivals, see CATEGORY_LAYOUT), so
 * a revival stays a band even if a future one features only two umas.
 */

/**
 * How many tiles a narrow feature column holds across. The column is about
 * 260px and a tile caps at 160px, so two is the honest answer — past that the
 * panel is better off as a full-width band.
 */
export const COLUMN_TILE_CAPACITY = 2

/** The two things a category says about layout. Its chip is BannerSection's. */
const CATEGORY_LAYOUT: Partial<Record<BannerCategory, { band?: true; supportLed?: true }>> = {
	// Full-width bands instead of the usual image/uma/support columns. They
	// carry up to eleven umas and no support cards at all, so a 260px column
	// would either clip them or stack them into a tower beside two empty panels.
	golden_week_revival: { band: true },
	// Weights the row's columns towards the support grid. A race-prep batch
	// is one uma and ten support cards, the reverse of an ordinary banner.
	race_prep_support: { supportLed: true },
}

/** A panel's tiles: two across and growing down, or one scrollable line. */
export type PanelLayout = "column" | "band"

/** Where a panel goes: beside the art, on a line of its own, or nowhere. */
export type PanelPlace = PanelLayout | "hidden"

/**
 * The section's shape. The first three are a row of art and panels
 * (`.tl-row[data-shape]`); the rest have no such row.
 *
 *   three         art | umas | supports: the ordinary banner
 *   support-led   the same row weighted to the supports
 *   pair          art | one panel, the other having banded away below
 *   panel-only    one column panel and no art to sit beside
 *   art-only      every panel banded, with art: the art sits alone above them
 *   bands-only    every panel banded and no art
 */
export type SectionShape = "three" | "support-led" | "pair" | "panel-only" | "art-only" | "bands-only"

export type SectionLayout = {
	shape: SectionShape
	uma: PanelPlace
	support: PanelPlace
	/** Whether the art cell (or its placeholder) appears at all. */
	showArt: boolean
	/** True once either panel has banded: the section's gaps open up. */
	hasBand: boolean
}

export function sectionLayout({
	category,
	hasUmaBanner,
	umaCount,
	hasSupportBanner,
	supportCount,
	hasImage,
}: {
	category: BannerCategory
	hasUmaBanner: boolean
	umaCount: number
	hasSupportBanner: boolean
	supportCount: number
	hasImage: boolean
}): SectionLayout {
	const forced = CATEGORY_LAYOUT[category]

	// BANDING IS PER PANEL. A panel bands only when its OWN cards overflow a
	// column — the other panel is unaffected and keeps its place beside the art.
	//
	// This was briefly a section-wide flag, which read plausibly and was wrong on
	// the commonest case we have: 22 of the 29 race-prep rows are one uma and ten
	// support cards WITH banner art, and banding the section threw the art onto
	// its own line and marooned the lone uma in a full-width band. Only the cards
	// that don't fit need the extra width.
	const umaBanded = hasUmaBanner && (!!forced?.band || umaCount > COLUMN_TILE_CAPACITY)
	const supportBanded = hasSupportBanner && (!!forced?.band || supportCount > COLUMN_TILE_CAPACITY)
	const hasBand = umaBanded || supportBanded

	// A panel keeps its column if it isn't banded — and, once anything IS banded,
	// only if it has a banner to show. That second clause is what stops a revival
	// (umas banded, no support banner at all) from spending a full-width row on an
	// empty "No Support Banner" panel. With nothing banded the empty states still
	// render, because then they're the whole section.
	const umaInColumn = !umaBanded && (hasUmaBanner || !hasBand)
	const supportInColumn = !supportBanded && (hasSupportBanner || !hasBand)
	const columnPanelCount = (umaInColumn ? 1 : 0) + (supportInColumn ? 1 : 0)

	// Whether the art cell appears at all.
	//
	// A section with no bands always shows it, placeholder included — that is the
	// ordinary three-column banner, where the placeholder is a third of the row
	// and reads as "art pending". Once something has banded, a placeholder is
	// only ever filler: it would be 1030px of empty box beside a single uma tile,
	// with the real content already on the band below. So past that point the
	// cell needs actual art to earn its place.
	const showArt = !hasBand || hasImage

	// Two column panels implies nothing banded (a banded panel is by definition
	// not in a column), so the three-column templates are only ever reached by
	// the ordinary case.
	const shape: SectionShape =
		columnPanelCount === 0
			? hasImage ? "art-only" : "bands-only"
			: !showArt ? "panel-only"
				: columnPanelCount === 2
					? forced?.supportLed ? "support-led" : "three"
					: "pair"

	return {
		shape,
		uma: umaBanded ? "band" : umaInColumn ? "column" : "hidden",
		support: supportBanded ? "band" : supportInColumn ? "column" : "hidden",
		showArt,
		hasBand,
	}
}
