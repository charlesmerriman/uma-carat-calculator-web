import { Dumbbell, Flower2, Repeat, Sparkles, Star, Ticket } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { bannerKey, timelineSupportTiles } from "../../utils/bannerHelpers"
import type { BannerKey } from "../../utils/bannerHelpers"
import { formatDate } from "../../utils/dateFormat"
import { cardHref, umaHref } from "../../utils/encyclopediaRoutes"
import type { BannerCategory, BannerSupport, BannerUma, UserPlannedBanner } from "../../types"
import { BannerArtPlaceholder } from "./BannerArtPlaceholder"
import { FeaturePanel } from "./FeaturePanel"
import { getBannerCardStatus } from "./bannerCardStatus"
import { sectionLayout } from "./sectionLayout"
import { CATEGORY_LABELS } from "./timelineShared"
import type { BannerWindowSection } from "./timelineShared"

/**
 * One banner inside a Timeline card: an optional chip line, then the art and
 * the two feature panels in whichever shape `sectionLayout()` picks.
 */

/**
 * CATEGORY DRIVES THE CHROME, COUNT DRIVES THE GRID. This is the chrome: which
 * chip a section wears. The grid is `sectionLayout()`.
 *
 * `standard` deliberately has no entry: most banners are standard, and a chip
 * on every card is noise rather than signal.
 */
type CategoryChrome = {
	label: string
	icon: LucideIcon
	/** Defined in timeline.css against the --color-category-* theme tokens. */
	chipClass: string
}

const CATEGORY_CHROME: Partial<Record<BannerCategory, CategoryChrome>> = {
	golden_week_revival: {
		label: CATEGORY_LABELS.golden_week_revival,
		icon: Flower2,
		chipClass: "category-chip--revival",
	},
	race_prep_support: {
		label: CATEGORY_LABELS.race_prep_support,
		icon: Dumbbell,
		chipClass: "category-chip--quiet",
	},
	rerun: {
		label: CATEGORY_LABELS.rerun,
		icon: Repeat,
		chipClass: "category-chip--quiet",
	},
}

/**
 * WHERE THE LAYOUT IS: `src/timeline.css`, section 5.
 *
 * This file says WHICH shape a part has, as an attribute; the stylesheet says
 * what that shape is, and holds every width, track and cap in one place:
 *
 *   the section's row   `tl-row` + data-shape="three" | "support-led" | "pair"
 *   its art             `tl-art` + data-place="row" | "alone"
 *   a lone panel        `tl-pair-cell` + data-side, or `tl-lone-panel`
 *   a panel             `tl-panel` + data-kind, data-layout="column" | "band"
 *   its tiles           `tl-grid` / `tl-grid-cell`, or `tl-band` / `tl-band-row`
 *                       / `tl-band-cell`; the tile caps hang off the panel
 *
 * They are plain class names because Tailwind only generates a class it finds
 * spelled out in full: a width built from a shared constant silently produced
 * no CSS, and the grid fell back to one stacked column.
 */

type BannerSectionProps = {
	section: BannerWindowSection
	/** True when this card carries more than one banner. */
	isGrouped: boolean
	/** The card header's window, so a section can flag its own if it differs. */
	groupStartDate: string
	groupEndDate: string
	today: Date
	plannedBannerKeys: Set<BannerKey>
	stagedBanners: UserPlannedBanner[]
	onAddBanner: (banner: BannerUma | BannerSupport, type: "Uma" | "Support") => void
}

export function BannerSection({
	section,
	isGrouped,
	groupStartDate,
	groupEndDate,
	today,
	plannedBannerKeys,
	stagedBanners,
	onAddBanner,
}: BannerSectionProps) {
	// Each panel reads from its OWN row. They are the same row on every section
	// but a fused one — the two halves of a staggered release, see
	// buildWindowSections — where the dates below genuinely differ per panel.
	const { primary: banner, umaWindow, supportWindow } = section
	const umaBanner = umaWindow.banner_umas[0]
	const supportBanner = supportWindow.banner_supports[0]

	const umaExpired = !umaBanner || new Date(umaWindow.end_date) <= today
	const supportExpired = !supportBanner || new Date(supportWindow.end_date) <= today
	const umaPlanned = umaBanner ? plannedBannerKeys.has(bannerKey("Uma", umaBanner.id)) : false
	const supportPlanned = supportBanner
		? plannedBannerKeys.has(bannerKey("Support", supportBanner.id))
		: false
	const umaStaged = umaBanner
		? stagedBanners.some((b) => b.banner_uma?.id === umaBanner.id)
		: false
	const supportStaged = supportBanner
		? stagedBanners.some((b) => b.banner_support?.id === supportBanner.id)
		: false

	// A grouped section states its own end date only when it actually differs
	// from the header's — otherwise it would just repeat the header. Real case:
	// the 2025 Golden Week revival runs nine days longer than the standard
	// banner sharing its start.
	//
	// A staggered group adds the other way to differ: a banner that opens later
	// than the card does. Then the line gives the whole range, because "ends"
	// alone would still imply it is open from the header's first day.
	const opensLater = isGrouped && banner.start_date !== groupStartDate
	// A staggered section stays quiet here: one line could only describe one of
	// its two halves, so the card header carries both (see staggerNotes).
	const hasOwnWindow =
		isGrouped &&
		!section.isStaggered &&
		(opensLater || banner.end_date !== groupEndDate)
	const chrome = CATEGORY_CHROME[banner.banner_category]
	const ChipIcon = chrome?.icon

	// Which shape the section takes, and where each panel goes: one pure
	// function (sectionLayout.ts), decided by the card counts.
	// The SSRs, plus any SR drawn as a picture (its `display`, resolved by the
	// API). The other SRs and Rs are listed under the card instead
	// (RateUpRow), so they never change the panel or the layout.
	const supportTiles = supportBanner ? timelineSupportTiles(supportBanner) : []
	const layout = sectionLayout({
		category: banner.banner_category,
		hasUmaBanner: !!umaBanner,
		umaCount: umaBanner?.umas.length ?? 0,
		hasSupportBanner: !!supportBanner,
		supportCount: supportTiles.length,
		hasImage: !!section.image,
	})
	const umaInColumn = layout.uma === "column"
	const supportInColumn = layout.support === "column"
	const hasColumnPanel = umaInColumn || supportInColumn

	const umaPanel = (
		<FeaturePanel
			icon={Sparkles}
			kind="uma"
			title="Featured Umamusume"
			items={umaBanner?.umas ?? []}
			pageHref={umaHref}
			hasBanner={!!umaBanner}
			framed
			emptyText="No Umamusume banner"
			tileAspectClass="aspect-square"
			layout={layout.uma === "band" ? "band" : "column"}
			status={getBannerCardStatus(!!umaBanner, umaExpired, umaPlanned, umaStaged)}
			actionIcon={Star}
			onAdd={() => umaBanner && onAddBanner(umaBanner, "Uma")}
			// Per banner: the uma and support sides of a window are flagged
			// independently. `=== true` so a payload from before the field existed
			// reads as not recommended.
			recommended={umaBanner?.is_recommended === true}
			freePulls={umaBanner?.free_pulls ?? 0}
		/>
	)

	const supportPanel = (
		<FeaturePanel
			icon={Ticket}
			kind="support"
			title="Featured Support Cards"
			items={supportTiles}
			pageHref={cardHref}
			hasBanner={!!supportBanner}
			emptyText="No Support Banner"
			tileAspectClass="aspect-[3/4]"
			layout={layout.support === "band" ? "band" : "column"}
			status={getBannerCardStatus(
				!!supportBanner,
				supportExpired,
				supportPlanned,
				supportStaged
			)}
			actionIcon={Ticket}
			onAdd={() => supportBanner && onAddBanner(supportBanner, "Support")}
			recommended={supportBanner?.is_recommended === true}
			freePulls={supportBanner?.free_pulls ?? 0}
		/>
	)

	const header = (chrome || hasOwnWindow) && (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
			{chrome && ChipIcon && (
				<span className={`category-chip ${chrome.chipClass}`}>
					<ChipIcon className="h-3.5 w-3.5" />
					{chrome.label}
				</span>
			)}
			{hasOwnWindow && (
				<span className="text-sm font-medium text-gray-400">
					{opensLater
						? `This banner runs ${formatDate(banner.start_date)} through ${formatDate(banner.end_date)}`
						: `This banner ends ${formatDate(banner.end_date)}`}
				</span>
			)}
		</div>
	)

	return (
		<div className={`flex flex-col ${layout.hasBand ? "gap-3" : "gap-2"}`}>
			{header}

			{hasColumnPanel &&
				(layout.showArt ? (
					// art | panels. What each shape is, and what it does below xl:
					// `.tl-row` in timeline.css.
					<div className="tl-row" data-shape={layout.shape}>
						<div className="tl-row-art">
							{section.image ? (
								<img
									src={section.image}
									alt={banner.name}
									loading="lazy"
									decoding="async"
									className="tl-art"
									data-place="row"
								/>
							) : (
								<BannerArtPlaceholder />
							)}
						</div>

						{/* One panel left: it gets a half to itself and sits centred in
						    it, mirroring the art. Two panels means nothing banded, so
						    the ordinary three-column templates apply and each panel is
						    the grid item directly. */}
						{layout.shape === "pair" ? (
							<div className="tl-pair-cell" data-side={umaInColumn ? "left" : "right"}>
								{umaInColumn ? umaPanel : supportPanel}
							</div>
						) : (
							<>
								{umaInColumn && umaPanel}
								{supportInColumn && supportPanel}
							</>
						)}
					</div>
				) : (
					// No art and nothing to sit beside: the panel keeps its column
					// width rather than stretching across a row it is the only
					// occupant of. Wide enough for two tiles, which is the most a
					// column ever holds.
					<div className="tl-lone-panel" data-shape="panel-only">
						{umaInColumn && umaPanel}
						{supportInColumn && supportPanel}
					</div>
				))}

			{/* No column panel to sit beside, but art to show anyway: it sits above
			    the bands instead, centered because there is no column edge left to
			    align to. Reached by any row whose only banner is banded — a
			    support-only race-prep batch with art is the live case. */}
			{layout.shape === "art-only" && section.image && (
				<img
					src={section.image}
					alt={banner.name}
					loading="lazy"
					decoding="async"
					className="tl-art"
					data-place="alone"
				/>
			)}

			{/* Bands stack below the art row, umas first — the primary axis of a
			    banner, and the order the panels sit in when both are columns. */}
			{layout.uma === "band" && umaPanel}
			{layout.support === "band" && supportPanel}
		</div>
	)
}
