/**
 * One Community plans post in the list (notes/pull-plan-database-plan.md,
 * Design 6), and the heading line that names its columns.
 *
 * ONE GRID FOR EVERY ROW, so the numbers line up down the list. Three shapes,
 * by the list's own width (`@container/plans`, set by the page), never the
 * window's, so the sidebar beside it is already counted:
 *
 *   wide     vote · 4 banner pictures · plan · Pulls · Views · Copies · Comments · arrow
 *   medium   the same without the pictures
 *   narrow   vote · plan · arrow, with the numbers folded into one line
 *            under the poster ("2,933 pulls, 5 steps · 310 views · ...")
 *
 * THE ROW OPENS IN PLACE. Its title is a real <button> with aria-expanded,
 * stretched over the row (the gallery row's idiom: a button wrapped around
 * the row would put a list and paragraphs inside it). The vote control and
 * the poster's name sit above it, so they keep their own clicks and never
 * open the row. The opened post renders in the same <li>, under the row
 * (CommunityPlansPage passes it as `children`), so a screen reader meets it
 * right after the row that opened it.
 *
 * A supporter's row takes their gallery look from `poster.gallery_style`
 * alone (decision 15): `ssr` the quiet foil panel, `sr` / `rose` an edge from
 * `[data-gallery-style]`. The tier name stays as text in the poster line.
 */

import type { ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { useOshiIds } from "../../hooks/useOshiIds"
import { formatDate } from "../../utils/dateFormat"
import { plural } from "../../utils/planTotals"
import { FramedUma } from "../FramedUma"
import { BannerTypeIcon } from "../carat-calculator/BannerTypeBadge"
import { GalleryVote, PosterLine, YouChip } from "../pvp/gallery/GalleryBits"
import type { PlanFilterChoices, PlanLeadBanner, PlanPostRow } from "../../types/gallery"
import { FramedCard } from "../FramedCard"
import { cardFrameArt } from "../../utils/cardFrame"

/** The list's columns, shared by the heading line and every row. */
export const PLAN_ROW_GRID =
	"grid items-center gap-x-3 grid-cols-[3rem_minmax(0,1fr)_1.25rem] " +
	"@2xl/plans:grid-cols-[3rem_minmax(0,1fr)_5.5rem_4.5rem_4.5rem_5.5rem_1.25rem] " +
	"@5xl/plans:grid-cols-[3rem_13rem_minmax(0,1fr)_5.5rem_4.5rem_4.5rem_5.5rem_1.25rem]"

const NUMBER = "hidden text-right text-sm font-semibold tabular-nums text-gray-100 @2xl/plans:block"
const CHIP = "rounded-md border border-gray-700 bg-gray-900/70 px-1.5 py-0.5 text-[11px] text-gray-300"

/** The column names, on the rows' grid. Hidden where the numbers fold into a line. */
export function PlanFeedHeading() {
	const cell = "text-right text-xs font-semibold uppercase tracking-wide text-gray-400"
	return (
		<div className={`${PLAN_ROW_GRID} hidden px-3 @2xl/plans:grid`} aria-hidden="true">
			<span className="col-start-2 text-xs font-semibold uppercase tracking-wide text-gray-400 @5xl/plans:col-start-3">Plan</span>
			<span className={cell}>Pulls</span>
			<span className={cell}>Views</span>
			<span className={cell}>Copies</span>
			<span className={cell}>Comments</span>
		</div>
	)
}

/** "2,933" with "and 5 steps" under it; a plan of only step-ups shows its steps. */
function PullsCell({ pulls, steps }: { pulls: number; steps: number }) {
	if (pulls === 0 && steps > 0) return <span className={NUMBER}>{plural(steps, "step", "steps")}</span>
	return (
		<span className={NUMBER}>
			{pulls.toLocaleString()}
			{steps > 0 && <span className="block text-xs font-normal text-gray-400">and {plural(steps, "step", "steps")}</span>}
		</span>
	)
}

/** The phone's folded line: "2,933 pulls, 5 steps · 310 views · 48 copies · 12 comments". */
function foldedNumbers(row: PlanPostRow): string {
	const { pull_count: pulls, step_count: steps } = row.plan
	return [
		[pulls > 0 || steps === 0 ? plural(pulls, "pull", "pulls") : null, steps > 0 ? plural(steps, "step", "steps") : null]
			.filter(Boolean)
			.join(", "),
		plural(row.stats.views, "view", "views"),
		plural(row.stats.copies, "copy", "copies"),
		plural(row.stats.comments, "comment", "comments"),
	].join(" · ")
}

/**
 * One lead banner's picture, from the catalogue the app already holds: an
 * uma banner's first uma in the site's frame (FramedUma, the rule for every
 * uma), a support banner's first card in its own art, a step-up's campaign
 * art or its kind's glyph. A banner that has left the catalogue is an empty
 * tile of the same size, so the row keeps its shape.
 */
function LeadTile({ lead }: { lead: PlanLeadBanner }) {
	const { umaBannerData, supportBannerData, stepUpBannerData } = useCalculatorData()
	const oshiIds = useOshiIds()
	const tile = "h-12 w-12 shrink-0"
	if (lead.banner_uma !== null) {
		const uma = umaBannerData.find((banner) => banner.id === lead.banner_uma)?.umas[0]
		if (uma) {
			return (
				<FramedUma
					src={uma.portrait ?? uma.image}
					layers={uma.portrait_layers}
					alt={uma.name}
					title={uma.name}
					oshi={oshiIds.has(uma.id)}
					className={tile}
				/>
			)
		}
	} else if (lead.banner_support !== null) {
		const card = supportBannerData.find((banner) => banner.id === lead.banner_support)?.support_cards[0]
		if (card) {
			return (
				<span title={card.name} className="flex h-12 w-12 shrink-0 justify-center">
					<FramedCard card={cardFrameArt(card)} alt={card.name} className="h-12" />
				</span>
			)
		}
	} else if (lead.banner_step_up !== null) {
		const stepUp = stepUpBannerData.find((banner) => banner.id === lead.banner_step_up)
		if (stepUp?.image) return <img src={stepUp.image} alt={stepUp.name} title={stepUp.name} className={`${tile} rounded-md object-cover`} />
		if (stepUp) {
			return (
				<span title={stepUp.name} className={`${tile} flex items-center justify-center rounded-md border border-gray-700 bg-gray-900`}>
					<BannerTypeIcon type="StepUp" className="h-6 w-6 text-step-up" />
				</span>
			)
		}
	}
	return <span className={`${tile} rounded-md bg-gray-700`} aria-hidden="true" />
}

export function PlanFeedRow({ row, choices, open, onToggle, bodyId, children }: {
	row: PlanPostRow
	/** The feed's filter choices: where each chip's words come from. */
	choices: PlanFilterChoices | undefined
	open: boolean
	onToggle: () => void
	/** The opened post's element id, for aria-controls. */
	bodyId: string
	/** The opened post, drawn under the row while `open`. */
	children?: ReactNode
}) {
	const look = row.poster.gallery_style
	const label = <T extends string>(list: Array<{ value: T; label: string }> | undefined, value: T | null) =>
		list?.find((choice) => choice.value === value)?.label ?? null
	const chips = [
		label(choices?.spending, row.spending),
		label(choices?.sweat, row.sweat),
		...row.strategies.map((style) => label(choices?.strategies, style)),
		row.range && `Up to ${row.range.label}`,
		row.plan.has_notes && "Notes",
		row.plan.has_income && "Income",
	].filter((chip): chip is string => typeof chip === "string" && chip !== "")

	return (
		<li
			data-plan-row={row.public_id}
			data-gallery-style={look ?? undefined}
			className={`scroll-mt-4 ${look === "ssr" ? "ssr-panel ssr-panel--quiet rounded-xl border" : "card-panel"}`}
		>
			{/* One wrapper per part, so .ssr-panel's "every child above the
			    surface" rule lands on them and the stretched button inside the
			    row can still be absolute. */}
			<div className={`${PLAN_ROW_GRID} relative px-3 py-2.5`}>
				<div className="relative z-[2] self-start @2xl/plans:self-center">
					<GalleryVote post={row} layout="column" />
				</div>
				<ul className="hidden items-center gap-1.5 @5xl/plans:flex" aria-label="First banners">
					{row.plan.lead.map((lead, index) => (
						<li key={index}>
							<LeadTile lead={lead} />
						</li>
					))}
				</ul>
				<div className="flex min-w-0 flex-col gap-1">
					<h3 className="min-w-0">
						<button
							type="button"
							aria-expanded={open}
							aria-controls={open ? bodyId : undefined}
							onClick={onToggle}
							className="line-clamp-2 break-words text-left text-base font-semibold text-gray-100 outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-brand"
						>
							{row.caption}
						</button>
					</h3>
					<div className="relative z-[2] self-start">
						<PosterLine
							poster={row.poster}
							mine={row.is_mine}
							card={{ kind: "post", id: row.public_id }}
							extra={
								<>
									{row.is_mine && <YouChip />}
									<span className="text-xs text-gray-400">
										<time dateTime={row.published_at}>{formatDate(row.published_at)}</time>
										{" · "}
										{plural(row.plan.row_count, "banner", "banners")}
									</span>
								</>
							}
						/>
					</div>
					{chips.length > 0 && (
						<ul className="flex flex-wrap gap-1" aria-label="Tags">
							{chips.map((chip, index) => (
								<li key={`${chip}-${index}`} className={CHIP}>
									{chip}
								</li>
							))}
						</ul>
					)}
					<p className="text-xs text-gray-400 @2xl/plans:hidden">{foldedNumbers(row)}</p>
				</div>
				<PullsCell pulls={row.plan.pull_count} steps={row.plan.step_count} />
				<span className={NUMBER}>{row.stats.views.toLocaleString()}</span>
				<span className={NUMBER}>{row.stats.copies.toLocaleString()}</span>
				<span className={NUMBER}>{row.stats.comments.toLocaleString()}</span>
				<ChevronRight
					className={`h-4 w-4 justify-self-end text-gray-400 transition-transform motion-reduce:transition-none ${open ? "rotate-90 text-brand" : ""}`}
					aria-hidden="true"
				/>
			</div>
			{open && (
				<div id={bodyId} className="border-t border-gray-700 px-3 pb-4 pt-3">
					{children}
				</div>
			)}
		</li>
	)
}
