import type { BannerRowType } from "../../utils/bannerHelpers"

/**
 * The glyph on a row's type badge. Exported separately from the badge because
 * the mobile card draws its own surround and wants only the icon.
 *
 * Extracted because the desktop table row and the mobile card drew the same two
 * SVGs from two hand-copied ternaries. Adding a third banner kind meant finding
 * both, and a missed one silently rendered another kind's icon — the same
 * failure mode the FK sniffs had. One component, one place to extend.
 *
 * `className` carries the size and colour so each caller keeps its own scale
 * (w-5 in both today, but the desktop badge and the card sit in different type
 * scales and have diverged before).
 */
export const BannerTypeIcon = ({
	type,
	className,
}: {
	type: BannerRowType
	className?: string
}) => {
	if (type === "Uma") {
		// A horseshoe — a heel at each top corner, both curving down to meet at the
		// toe. Two mirrored paths rather than one, so they meet flush at (12,21):
		// both arrive horizontally, which puts their butt caps on the same vertical.
		return (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="butt" strokeLinejoin="miter" className={className}>
				<path d="M 3 3 L 7 4 C 6 9 0 21 12 21" />
				<path d="M 21 3 L 17 4 C 18 9 24 21 12 21" />
			</svg>
		)
	}

	if (type === "Support") {
		// A support card, with a second card tucked behind it.
		return (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="butt" strokeLinejoin="round" className={className}>
				<path d="M6 2H3a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h3" />
				<rect x="8" y="1" width="15" height="22" rx="2" />
			</svg>
		)
	}

	// Step Up: an ascending staircase, for the five-step cost ladder. Provisional
	// alongside the rest of the step-up visual treatment — see
	// step-up-banners-plan.md.
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
			<path d="M3 20h5v-5h5v-5h5V5" />
		</svg>
	)
}


/** Modifier class per kind. The StepUp rule arrives with the step-up UI phase;
 *  until then no row can be of that kind. See step-up-banners-plan.md. */
const TAB_CLASS: Record<BannerRowType, string> = {
	Uma: "banner-type-tab--uma",
	Support: "banner-type-tab--support",
	StepUp: "banner-type-tab--step-up",
}

const LABEL: Record<BannerRowType, string> = {
	Uma: "UMA",
	Support: "SUPPORT",
	StepUp: "STEP UP",
}

/**
 * The square type badge at the left of a desktop table row.
 *
 * Shared by BannerRow and StagedBannerRow, which previously carried
 * byte-identical copies of this markup — modifier class, label and a pair of
 * inline SVGs, each behind its own `=== "Uma"` ternary. Six places to widen for
 * a third kind, any of which fails silently by rendering the wrong kind.
 *
 * Width comes from .banner-grid's first track; this is a table cell, not a
 * free-standing element.
 */
export const BannerTypeBadge = ({ type }: { type: BannerRowType }) => (
	<div className={`banner-type-tab ${TAB_CLASS[type]}`}>
		<span className="text-xs font-bold tracking-wide">{LABEL[type]}</span>
		<BannerTypeIcon type={type} className="w-5 h-5 opacity-90" />
	</div>
)

/**
 * The same kind as a small pill, for the share picture's cards (share/
 * PlanPicture.tsx), which name the kind above the banner instead of giving it
 * a column. Same fill and ink as the badge, so a theme or colorblind mode
 * redraws both.
 */
export const BannerTypeChip = ({ type }: { type: BannerRowType }) => (
	<span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] leading-none font-bold tracking-wider ${TAB_CLASS[type]}`}>
		<BannerTypeIcon type={type} className="h-3 w-3 opacity-90" />
		{LABEL[type]}
	</span>
)
