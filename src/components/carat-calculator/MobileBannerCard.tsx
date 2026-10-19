import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { Trash2 } from "lucide-react"
import { BannerTypeIcon } from "./BannerTypeBadge"
import type { BannerRowType } from "../../utils/bannerHelpers"
import { ReservedColumnIcons, RESERVED_COLUMN_TITLE } from "./ReservedColumnIcons"
import { ExtraCardsBadge } from "./ExtraCardsBadge"
import { FramedUma } from "../FramedUma"
import { useOshiIds } from "../../hooks/useOshiIds"

interface MobileBannerCardProps {
	bannerType: BannerRowType
	images: { id: number; name: string; image: string; portrait?: string | null }[]
	/**
	 * Replaces the thumbnail strip entirely. A step-up row has no featured cards
	 * to thumbnail — the player picks their own from the back catalogue — so it
	 * supplies its own chip instead of an empty tile rail.
	 */
	imagesSlot?: ReactNode
	/**
	 * Where the thumbnail strip links to — this row's banner on the Timeline, or
	 * null on a row with no banner selected yet. Passed as a href rather than the
	 * caller wrapping `imagesSlot` itself, so the link wraps the strip on every
	 * row kind: the ordinary rows render their thumbnails HERE, from `images`,
	 * and never go through the slot.
	 */
	imagesHref?: string | null
	bannerSelect: ReactNode
	dates: ReactNode
	/**
	 * The row's pull ceiling ("Max Pulls", or "Max Steps" on a step-up), shown
	 * immediately LEFT of the pulls field. It is the bound the field is judged
	 * against, and reading it out of a stats strip further down the card meant
	 * looking away from the number you were editing to find out what the limit
	 * was.
	 *
	 * Optional because a staged row has no projection yet: `useBannerResources`
	 * hasn't run for it, so it has no ceiling to name and the band drops back to
	 * three columns.
	 */
	maxCount?: ReactNode
	/**
	 * The block below the number row, rendered EDGE TO EDGE — it owns its own
	 * padding. The card used to wrap it in a p-3, which cost 24px of height on
	 * every row for a gutter the stats strip doesn't want (it reads as a band,
	 * like the number row above it) and only the staged row's button does.
	 */
	summary: ReactNode
	pullsInput: ReactNode
	reservedInput: ReactNode
	/**
	 * Optional block under `summary`. Owns its own padding, as `summary` does.
	 *
	 * A **staged** row passes none: the odds strip is the widest, most expensive
	 * band on a phone, and a row that isn't on the sheet yet has nothing to spend
	 * it on — the numbers it would show are answering a question the user hasn't
	 * finished asking. The desktop table shows no odds on staged rows for the
	 * same reason, and puts the confirm button in the MLB track instead
	 * (.banner-grid--staged).
	 */
	chanceDisplay?: ReactNode
	/**
	 * The row's note toggle, placed beside the remove button. A staged row passes
	 * none: a note belongs to a row that is on the sheet.
	 */
	noteButton?: ReactNode
	/**
	 * The open odds-card picker (which card the odds are for, and an optional
	 * second one), under the odds. Owns its own padding.
	 */
	oddsPanel?: ReactNode
	/**
	 * A line about the row's state that must show whether or not any panel is
	 * open (a row left out of the projection). Under the summary. Owns its own
	 * padding.
	 */
	notice?: ReactNode
	/** The open options panel (note included), under everything else. Owns its own padding. */
	noteEditor?: ReactNode
	onRemove: () => void
	removeLabel: string
	/**
	 * Marks the card as a STAGED row rather than one that counts. Swaps the
	 * card's neutral surface for the amber staging tint, matching
	 * .staged-surface on the desktop table so the two form factors carry the
	 * same signal.
	 *
	 * A boolean rather than the caller passing class names: the tint is one
	 * decision applied to two elements (shell and body), and a caller supplying
	 * only one of them would half-tint the card.
	 */
	staged?: boolean
}

/**
 * Per-kind presentation, in ONE place rather than three parallel ternaries down
 * the component. Three separate `=== "Uma" ? … : …` expressions all had to be
 * found and widened together whenever a kind was added, and a missed one failed
 * silently by rendering the other kind's treatment.
 *
 * `thumbTileRadius`: the tile clips whatever it contains, so it can only be
 * rounded where the art is too. Uma icons have a rounded frame baked in; support
 * card art is a sharp-cornered rectangle and would get its own border sliced off.
 */
const TYPE_STYLES: Record<
	BannerRowType,
	{ label: string; tile: string; thumbTileRadius: string }
> = {
	// Fill and ink come from .banner-type-tile--* in App.css (theme tokens), not a
	// stock bg-* class here: a stock class can't change with the light themes.
	Uma: { label: "UMA", tile: "banner-type-tile banner-type-tile--uma", thumbTileRadius: "rounded-md" },
	Support: { label: "SUPPORT", tile: "banner-type-tile banner-type-tile--support", thumbTileRadius: "rounded-none" },
	// Provisional: a step-up carries no featured cards, so the thumb radius is
	// moot until its own artwork lands. Final treatment comes with the step-up
	// UI phase — see step-up-banners-plan.md.
	StepUp: { label: "STEP UP", tile: "banner-type-tile banner-type-tile--step-up", thumbTileRadius: "rounded-md" },
}

/**
 * The card's thumbnail strip, wrapped in a link to the Timeline when there is a
 * banner to link to.
 *
 * Split out only so the link doesn't have to be threaded through the JSX twice
 * — the wrapper is the single branch, and what it contains is identical either
 * way. The `<Link>` carries the same flex box the strip's parent already
 * establishes, so wrapping changes no layout.
 */
const Thumbnails = ({
	href,
	slot,
	images,
	framed,
	thumbTileRadius,
}: {
	href?: string | null
	slot?: ReactNode
	images: { id: number; name: string; image: string; portrait?: string | null }[]
	/** An uma row: the borderless art in the site's frame (FramedUma). */
	framed: boolean
	thumbTileRadius: string
}) => {
	const oshiIds = useOshiIds()
	// One thumbnail on a phone, two on a wider card (design polish item 19).
	// At phone width two 48px thumbnails left the banner name about 60px, and a
	// two-uma banner read "Kitas...". `@md:` is the sheet's container (28rem),
	// not the screen, so the card decides by its own width. The second
	// thumbnail goes in a wrapper because .uma-frame sets `display` unlayered,
	// which a `hidden` utility on the frame itself would lose to. The "+N" badge
	// is drawn twice for the same reason the thumbnails differ: it counts what
	// the visible strip leaves out.
	const strip = slot ?? (
		<>
			{images.length > 0
				? images.slice(0, 2).map((img, index) => {
						const thumb = framed ? (
							<FramedUma
								src={img.portrait ?? img.image}
								alt={img.name}
								oshi={oshiIds.has(img.id)}
								className="w-12"
							/>
						) : (
							<div
								className={`flex h-12 min-w-0 shrink-0 items-center justify-center overflow-hidden ${thumbTileRadius} bg-black/10 ring-1 ring-white/10`}
							>
								<img src={img.image} alt={img.name} className="h-full w-auto object-contain" />
							</div>
						)
						return (
							<span key={img.id} className={index === 0 ? "contents" : "hidden shrink-0 @md:block"}>
								{thumb}
							</span>
						)
					})
				: null}
			<ExtraCardsBadge hidden={images.length - 1} className="@md:hidden" />
			<ExtraCardsBadge hidden={images.length - 2} className="hidden @md:block" />
		</>
	)

	if (!href) return strip

	return (
		<Link
			to={href}
			title="View this banner on the timeline"
			className="flex min-w-0 shrink-0 items-center gap-1"
		>
			{strip}
		</Link>
	)
}

export const MobileBannerCard = ({
	bannerType,
	images,
	imagesSlot,
	imagesHref,
	bannerSelect,
	dates,
	maxCount,
	summary,
	pullsInput,
	reservedInput,
	chanceDisplay,
	noteButton,
	oddsPanel,
	notice,
	noteEditor,
	onRemove,
	removeLabel,
	staged = false,
}: MobileBannerCardProps) => {
	const style = TYPE_STYLES[bannerType]

	return (
		<div
			className={`card-panel @banner-table:hidden overflow-hidden ${
				staged ? "staged-surface border-staging/45" : ""
			}`}
		>
			<div className={`flex min-h-[64px] items-stretch ${style.tile}`}>
				<div className="flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 bg-black/15 px-1">
					{/* No text colour: both inherit the kind's ink from the tile. */}
					<span className="text-xs font-bold tracking-wide">
						{style.label}
					</span>
					<BannerTypeIcon type={bannerType} className="h-5 w-5 opacity-90" />
				</div>

				{/* Tight gutters: every pixel here comes off the banner name, which is
				    the row's primary identifier and the first thing to ellipsis. */}
				<div className="relative flex min-w-0 shrink-0 items-center gap-0.5 overflow-hidden px-1 py-2">
					<Thumbnails
						href={imagesHref}
						slot={imagesSlot}
						images={images}
						framed={bannerType === "Uma"}
						thumbTileRadius={style.thumbTileRadius}
					/>
				</div>

				<div className="flex min-w-0 flex-1 items-center py-2 pr-1">
					{bannerSelect}
				</div>

				{noteButton}

				<button
					onClick={onRemove}
					aria-label={removeLabel}
					title={removeLabel}
					className="my-auto mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-(--tile-danger)/40 bg-black/10 text-(--tile-danger) transition hover:bg-black/25"
				>
					{/* The trashcan on staged cards too: the X they used to show
					    read as "close" rather than "delete". */}
					<Trash2 className="h-5 w-5" />
				</button>
			</div>

			<div className={staged ? "bg-black/15" : "bg-gray-900/35"}>
				{/* Tracks are narrow and there is no "Dates" caps label, both to buy
				    width for the dates — the flexible track, and the one that used to
				    lose: `Start:` and `End:` side by side want ~234px and a 390px
				    viewport can only spare ~150 here, so "End: …" slid underneath the
				    pulls field. They stack instead (see BannerRow's dateDisplay) and
				    label the column well enough on their own.

				    Fixed tracks on the right, flexible date track on the left, at
				    EVERY card width — the card has exactly one layout now, and the
				    extra width a wide container gives it goes to the dates. */}
				<div
					className={`grid border-b border-gray-700 ${
						maxCount
							? "grid-cols-[minmax(0,1fr)_3.5rem_4.25rem_4.25rem]"
							: "grid-cols-[minmax(0,1fr)_4.25rem_4.25rem]"
					}`}
				>
					<div className="min-w-0 self-center px-2 py-2">
						{dates}
					</div>
					{maxCount && (
						<div className="flex min-w-0 flex-col items-center justify-center border-l border-gray-700 px-1 py-2">
							{maxCount}
						</div>
					)}
					<div className="flex min-w-0 flex-col items-center justify-center border-l border-gray-700 px-1 py-2">
						{/* Title case, not uppercase: it now sits directly beside the
						    "Max Pulls" stat label, and it matches the desktop table's own
						    "# Pulls" header. */}
						<div className="mb-0.5 text-[10px] font-medium text-gray-500">Pulls</div>
						{pullsInput}
					</div>
					<div className="flex min-w-0 flex-col items-center justify-center border-l border-gray-700 px-1 py-2">
						{/* Icons rather than the word, matching the desktop table header.
						    w-4 here, not the header's w-5: these sit beside a 10px caps
						    label ("Pulls") and 20px would tower over it. */}
						<div
							className="mb-0.5 flex items-center justify-center gap-1"
							title={RESERVED_COLUMN_TITLE}
						>
							<ReservedColumnIcons size="w-4 h-4" />
						</div>
						{reservedInput}
					</div>
				</div>

				{summary}
				{notice}
				{chanceDisplay}
				{oddsPanel}
				{noteEditor}
			</div>
		</div>
	)
}
