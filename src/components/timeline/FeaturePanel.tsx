import { ChevronRight, Gift, Star } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useOshiIds } from "../../hooks/useOshiIds"
import { FeaturedTile, type FeaturedCard } from "./FeaturedTile"
import type { PanelLayout } from "./sectionLayout"
import { getBannerStatusClasses, getBannerStatusLabel, type BannerCardStatus } from "./bannerCardStatus"

/**
 * One panel of a banner section: "Featured Umamusume" or "Featured Support
 * Cards". A title line (with the Recommended and free-pulls chips), the tiles
 * as a column or a band, and the one button that stages the banner.
 *
 * Whether it is a column or a band is decided by `sectionLayout()`; what each
 * looks like is `.tl-grid` and `.tl-band` in `src/timeline.css`.
 */

type FeaturePanelProps = {
	icon: LucideIcon
	title: string
	/** Empty when the banner exists but has no cards linked yet. */
	items: FeaturedCard[]
	/** False when this window has no banner of this kind at all. */
	hasBanner: boolean
	/** Which banner this panel holds: written to `data-kind`, for themes (timeline.css). */
	kind: "uma" | "support"
	/** Uma tiles: drawn in the site's frame (FramedUma). Support art keeps its own. */
	framed?: boolean
	emptyText: string
	/**
	 * The tile art's intrinsic ratio, reserved before the image loads. Uma
	 * portraits are square (360×360) and support cards are 3:4 (450×600),
	 * uniformly, so this is a fact about the assets rather than a guess — see
	 * `.tl-art` in timeline.css for why every image in the timeline declares one.
	 */
	tileAspectClass: string
	/** Band is one scrollable line at every width; column stays two-wide. */
	layout?: PanelLayout
	status: BannerCardStatus
	actionIcon: LucideIcon
	onAdd: () => void
	/**
	 * The banner is editorially Recommended: the panel gets the SSR treatment
	 * (.ssr-panel in App.css) and a "Recommended" chip in its title line. Every
	 * part of that is zero-layout — see the note on .ssr-panel.
	 */
	recommended?: boolean
	/**
	 * Pulls the game hands out free on this banner (`free_pulls` on the
	 * BannerUma / BannerSupport, which the planner already subtracts from a
	 * row's pull count). Zero, the common case, renders nothing. Shown as a
	 * chip in the title line under the same zero-layout rule as `recommended`.
	 */
	freePulls?: number
	/**
	 * A tile's Encyclopedia address from its game id: `umaHref` or `cardHref`.
	 * The panel knows which it holds, so no tile has to guess from its shape.
	 */
	pageHref: (gameId: number) => string
}

export function FeaturePanel({
	icon: Icon,
	title,
	items,
	pageHref,
	hasBanner,
	kind,
	framed = false,
	emptyText,
	tileAspectClass,
	layout = "column",
	status,
	actionIcon: ActionIcon,
	onAdd,
	recommended = false,
	freePulls = 0,
}: FeaturePanelProps) {
	// Count drives the layout. A narrow column tops out at two tiles across and
	// grows downwards; a band is always exactly one line — see `.tl-band` in
	// timeline.css.
	//
	// There is no row cap and no overflow clip on the cross axis, and that is
	// deliberate: the panel used to carry `grid-rows-1`, `xl:overflow-hidden` and
	// `xl:[contain:size]`, which pinned it to the banner art's height and
	// silently discarded every tile past the first row. On an eleven-uma revival
	// that meant showing two umas and hiding nine, with nothing on screen to say
	// so. A card that grows taller — or a line that scrolls — is the right trade.
	const isBand = layout === "band"
	const oshiIds = useOshiIds()

	// A band tile is narrower than a column tile, so its name gets a smaller
	// size and a third line. Both tiers were measured against real banners: at
	// 15px/two lines "Biwa Hayahide (Christmas)" and "(Mecha)" both truncated to
	// "Biwa Hayahide…" on a revival featuring both. The old third tier — 11px
	// with tighter tracking, for the launch banner's twenty support cards — is
	// gone with the squeeze that forced it; no band tile now renders below its
	// minimum (`--tl-*-band-min`).
	const nameClass = isBand
		? "line-clamp-3 text-[0.8125rem]"
		: "line-clamp-2 text-[0.9375rem]"

	const tiles = items.map((item) => {
		const tile = (
			<FeaturedTile
				item={item}
				href={item.game_id ? pageHref(item.game_id) : null}
				tileAspectClass={tileAspectClass}
				nameClass={nameClass}
				framed={framed}
				oshi={framed && oshiIds.has(item.id)}
			/>
		)

		// In a band the growth sits on a wrapper so the tile keeps its own cap and
		// stays centered in its share of the line; in a column the tile is the
		// grid cell itself.
		return (
			<div key={item.id} className={isBand ? "tl-band-cell" : "tl-grid-cell"}>
				{tile}
			</div>
		)
	})

	// A recommended panel SWAPS its ordinary surface for the SSR one rather than
	// layering over it — see .ssr-panel in App.css. An ended banner keeps the foil
	// and loses the motion: still a record of a good pull, no longer something
	// to draw the eye to.
	const surfaceClass = recommended
		? `ssr-panel ${status === "expired" ? "ssr-panel--still" : ""}`
		: "card-panel"

	// Whether anything shares the title line. Both chips are sized to the
	// title's 20px line box, so the line is exactly as tall with them as without.
	const hasChip = recommended || freePulls > 0

	return (
		<section data-kind={kind} data-layout={layout} className={`tl-panel flex min-w-0 flex-col rounded-xl border px-1.5 py-1.5 ${surfaceClass}`}>
			{/* `@container` so the free-pulls chip can size itself to THIS line's
			    width rather than the viewport's — see its note below. Inline-size
			    containment only stops the line from ever pushing its column wider,
			    which nothing relied on: every column has an explicit minimum. */}
			<div
				className={`tl-panel-title @container mb-1.5 flex shrink-0 items-center gap-2 text-sm font-semibold ${
					recommended ? "text-recommended" : "text-brand"
				}`}
			>
				<Icon className="h-4 w-4 shrink-0" />
				{/* With a chip to make room for, the title holds its width and the chip
				    gives way instead (its label truncates). A title wrapping onto a
				    second line would make the row taller, and nothing here may. */}
				<span className={hasChip ? "shrink-0 whitespace-nowrap" : undefined}>{title}</span>
				{/* Neither chip ever truncates ("Rec…" and "10 fr…" say nothing). They
				    step down instead, keyed to the title line's own width, and the
				    ladder is measured, not guessed: icon + title is 213px for the wider
				    title, the free-pulls chip is about 59 / 99 / 144px for "120",
				    "120 free" and "120 free pulls" at the title's 14px, the gold pill is
				    28px as a star and 104px with its word, and every gap is 8px.

				      free pulls alone          with Recommended
				      from 18rem  "[gift] 50"   from 18rem  "[gift] 50", no gold pill
				      from 20rem  "50 free"     from 20rem  star + "50"
				      from 23rem  "50 free      from 23rem  star + "50 free"
				                   pulls"       from 26rem  star + "50 free pulls"
				                                from 30rem  "Recommended" + "50 free pulls"
				      below 18rem nothing: the ~200px uma column beside a race-prep
				                  batch, where the title alone fills the line

				    When something has to give, the gold pill goes before the number
				    does: the foil panel and the gold title already say "recommended",
				    and nothing else says how many pulls are free. Both words stay in
				    the accessibility tree at every width. Recommended with no free
				    pulls keeps its word and truncates as it always has. */}
				{recommended && (
					<span
						className={`recommended-chip ${freePulls > 0 ? "hidden @min-[20rem]:inline-flex" : "inline-flex"}`}
						title="Recommended"
					>
						<Star aria-hidden="true" fill="currentColor" className="h-3 w-3 shrink-0" />
						<span className={freePulls > 0 ? "sr-only @min-[30rem]:not-sr-only" : "truncate"}>
							Recommended
						</span>
					</span>
				)}
				{freePulls > 0 && (
					<span
						// The gold pill carries the `margin-left: auto` that pushes both
						// chips right; wherever it is absent or hidden, this one must.
						className={`free-pulls-chip hidden @min-[18rem]:inline-flex ${
							recommended ? "@max-[20rem]:ml-auto" : "ml-auto"
						}`}
						title={`${freePulls} free pulls on this banner`}
					>
						<Gift aria-hidden="true" className="h-3 w-3 shrink-0 text-brand" />
						<span>
							{freePulls}
							<span
								className={
									recommended
										? "sr-only @min-[23rem]:not-sr-only"
										: "sr-only @min-[20rem]:not-sr-only"
								}
							>
								{" "}
								free
							</span>
							<span
								className={
									recommended
										? "sr-only @min-[26rem]:not-sr-only"
										: "sr-only @min-[23rem]:not-sr-only"
								}
							>
								{" "}
								pulls
							</span>
						</span>
					</span>
				)}
			</div>
			{hasBanner ? (
				<div className="flex flex-1 flex-col gap-1.5">
					{isBand ? (
						// One scrollable line: `.tl-band` in timeline.css.
						<div className="tl-band">
							<div className="tl-band-row">{tiles}</div>
						</div>
					) : (
						// Two across, or one alone: `.tl-grid` in timeline.css.
						<div className="tl-grid" data-columns={items.length === 1 ? 1 : 2}>
							{tiles}
						</div>
					)}
					{/* Single shared action button — every featured card here belongs to the
					    same banner, so one full-width button drives the add for all of them. */}
					<button
						type="button"
						onClick={onAdd}
						disabled={status !== "available"}
						data-status={status}
						className={`tl-stage flex shrink-0 items-center justify-center gap-2 rounded-md border px-2 py-2 text-xs font-medium leading-tight transition ${getBannerStatusClasses(status)} ${
							status === "available" ? "cursor-pointer" : "cursor-not-allowed"
						} ${
							// A solid backing on the SSR surface: the button's brand text is
							// measured against the card's gray-800, never against gold.
							recommended ? "bg-gray-800" : ""
						}`}
					>
						<ActionIcon className="h-3.5 w-3.5" />
						{getBannerStatusLabel(status)}
						{status === "available" && <ChevronRight className="h-3.5 w-3.5" />}
					</button>
				</div>
			) : (
				<div className="flex min-h-40 w-full flex-1 items-center justify-center rounded-lg border border-gray-600 bg-gray-700 px-4 text-center text-sm text-gray-400">
					{emptyText}
				</div>
			)}
		</section>
	)
}
