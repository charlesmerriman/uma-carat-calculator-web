import type { ReactNode } from "react"
import { Sparkles } from "lucide-react"
import type { BannerSupport, BannerUma, UserStepUpSelection } from "../../../types"
import type { BannerResources } from "../../../hooks/bannerResources"
import { EMPTY_BANNER_RESOURCES } from "../../../hooks/bannerResources"
import { plannedBannerRowType, plannedBannerTarget, plannedBannerTimeline, plannedPulls, plannedSteps } from "../../../utils/bannerHelpers"
import type { PullCountStatus } from "../../../utils/bannerHelpers"
import { bannerRowFigures } from "../../../utils/bannerRowFigures"
import { formatDate } from "../../../utils/dateFormat"
import { isExcludedFromProjection } from "../../../utils/rowOptions"
import { planPictureLayout, splitColumns } from "../../../utils/planPictureLayout"
import type { PlannerMarker, PlannerRow } from "../../../utils/plannerSections"
import { Wordmark } from "../../Wordmark"
import { Avatar } from "../../account/Avatar"
import { BannerArt } from "../BannerArt"
import { BannerTypeChip } from "../BannerTypeBadge"

/**
 * The pull plan as a picture, made to be posted (notes/share-plan-image-plan.md).
 *
 * A poster, not a copy of the sheet. Someone scrolling past it in Discord sees
 * it at half size or less, so it leads with what reads at that size: the
 * plan's totals as big figures, then each banner as a card with its art a
 * size up and its pull count as the biggest number on the card. The sheet's
 * four stat boxes stay, smaller, for the players who read them.
 *
 * The banners hang off a dated rail, so the picture reads as the schedule it
 * is, and the sheet's scenario and anniversary bands become dated milestones
 * on the same rail.
 *
 * Every colour is a theme token, and the root paints the theme's own page glow
 * (`.share-picture` in App.css), so the picture comes out in the player's theme,
 * colorblind mode included. It is drawn while mounted in the page, which is why
 * the tokens reach it.
 *
 * Its numbers come from `bannerRowFigures`, the helper the sheet reads, so the
 * picture and the sheet can't disagree. Fixed width (960px, drawn at 2x), so
 * the picture is the same on a phone as on a desktop.
 *
 * Every banner is always drawn. A long plan changes shape instead
 * (planPictureLayout): from 16 banners each is a compact row, and from 31 the
 * rows run in two columns on a 1,760px picture, so it stays readable in a chat
 * feed rather than becoming a thin strip.
 */
export function PlanPicture({
	plannerRows,
	bannerResources,
	umaBannerData,
	supportBannerData,
	userStepUpSelectionData,
	ownerName,
	ownerPicture,
	hideSpend,
	now,
}: {
	plannerRows: PlannerRow[]
	/** Positional against the plan's rows: read by each row's ORIGINAL index. */
	bannerResources: BannerResources[]
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	userStepUpSelectionData: UserStepUpSelection[]
	/** Shown only when the player ticks the box; null reads "My pull plan". */
	ownerName: string | null
	/** The account's picture (its first favorite uma), shown beside the name
	 *  under the same box. The player's own favorite, so the rainbow frame. */
	ownerPicture: string | null
	/** Blanks the paid carat figures, for players who'd rather not show spend. */
	hideSpend: boolean
	now: Date
}) {
	const banners = plannerRows.flatMap((row) => (row.kind === "banner" ? [row] : []))
	const resourcesOf = (index: number) => bannerResources[index] ?? EMPTY_BANNER_RESOURCES

	const totalPulls = banners.reduce((sum, row) => sum + plannedPulls(row.banner), 0)
	const totalSteps = banners.reduce((sum, row) => sum + plannedSteps(row.banner), 0)
	const freeSpent = banners.reduce((sum, row) => sum + resourcesOf(row.index).freeCaratsSpent, 0)
	const paidSpent = banners.reduce((sum, row) => sum + resourcesOf(row.index).paidCaratsSpent, 0)

	// The plan's tightest moment, the same figure as the forecast's headline
	// (CaratForecastChart): the free carats left after each banner that is
	// charged and still running, at the lowest. Short is the over-budget red.
	const charged = banners.filter(
		(row) =>
			!isExcludedFromProjection(row.banner) &&
			!bannerRowFigures(row.banner, resourcesOf(row.index), plannedBannerRowType(row.banner) === "StepUp", now).bannerHasEnded
	)
	const lowest = charged.length
		? Math.min(...charged.map((row) => resourcesOf(row.index).freeCarats - resourcesOf(row.index).freeCaratsSpent))
		: null

	// The dates the plan covers, from the first banner's start to the last one's end.
	const timelines = banners.flatMap((row) => plannedBannerTimeline(row.banner) ?? [])
	const firstStart = timelines.reduce<string | null>(
		(first, timeline) => (first === null || Date.parse(timeline.start_date) < Date.parse(first) ? timeline.start_date : first),
		null
	)
	const lastEnd = timelines.reduce<string | null>(
		(last, timeline) => (last === null || Date.parse(timeline.end_date) > Date.parse(last) ? timeline.end_date : last),
		null
	)

	const layout = planPictureLayout(banners.length)
	const compact = layout !== "poster"

	return (
		<div
			data-layout={layout}
			className={`share-picture relative ${layout === "columns" ? "w-[1760px]" : "w-[960px]"} overflow-hidden text-gray-100`}
		>
			{/* A racecourse rail in the corner, in the theme's accent: decoration only. */}
			<div className="share-picture-track" />

			<header className="relative px-10 pt-9 pb-8">
				<div className="flex items-start justify-between gap-8">
					<div className="flex min-w-0 items-center gap-4">
						{ownerPicture && <Avatar src={ownerPicture} size="lg" oshi />}
						<div className="min-w-0">
							<h2 className="font-display text-[2.625rem] leading-[1.1] font-bold tracking-tight text-gray-50">
								{ownerName ? `${ownerName}'s pull plan` : "My pull plan"}
							</h2>
							<p className="mt-2 text-[15px] text-gray-300">
								{banners.length} {banners.length === 1 ? "banner" : "banners"}
								{firstStart && lastEnd && `, ${formatDate(firstStart)} to ${formatDate(lastEnd)}`}
							</p>
						</div>
					</div>
					<Wordmark size="card" />
				</div>

				<div className="mt-7 flex gap-3">
					<Tile
						label="Pulls planned"
						value={totalPulls.toLocaleString()}
						note={totalSteps > 0 ? `and ${totalSteps} step-up ${totalSteps === 1 ? "step" : "steps"}` : undefined}
					/>
					<Tile label="Free carats spent" value={freeSpent.toLocaleString()} />
					{!hideSpend && paidSpent > 0 && <Tile label="Paid carats spent" value={paidSpent.toLocaleString()} />}
					{lowest !== null &&
						(lowest < 0 ? (
							<Tile label="Carats short" value={(-lowest).toLocaleString()} note="at the plan's lowest point" tone="over" />
						) : (
							<Tile label="Carats to spare" value={lowest.toLocaleString()} note="at the plan's lowest point" tone="ok" />
						))}
				</div>
			</header>

			{/* The rail: a date column, the line with a node per entry, and the
			    entries; for a long plan, two such columns side by side, read
			    left first. Each column's line is one absolute stroke through its
			    node column, from the first node to the last. */}
			<div className={`relative px-10 ${layout === "columns" ? "grid grid-cols-2 gap-x-10" : ""}`}>
				{(layout === "columns" ? splitColumns(plannerRows) : [plannerRows]).map((rows, column) => (
					<div key={column} className={`relative flex flex-col ${compact ? "gap-1.5" : "gap-2.5"}`}>
						<div
							className={`absolute left-[120px] w-0.5 -translate-x-1/2 bg-brand/25 ${compact ? "top-7 bottom-7" : "top-11 bottom-11"}`}
						/>
						{rows.map((plannerRow) =>
							plannerRow.kind === "band" ? (
								plannerRow.markers.map((marker) => <Milestone key={marker.key} marker={marker} compact={compact} />)
							) : (
								<BannerEntry
									key={plannerRow.banner.id ?? plannerRow.banner.tempId}
									plannerRow={plannerRow}
									resources={resourcesOf(plannerRow.index)}
									umaBannerData={umaBannerData}
									supportBannerData={supportBannerData}
									userStepUpSelectionData={userStepUpSelectionData}
									hideSpend={hideSpend}
									compact={compact}
									now={now}
								/>
							)
						)}
					</div>
				))}
			</div>

			<footer className="relative mt-8 flex items-center justify-between gap-4 border-t border-edge px-10 py-5 text-sm">
				<p className="text-gray-300">
					Plan yours at <span className="font-semibold text-brand">umacaratcalculator.com</span>
				</p>
				<p className="text-gray-400">As of {formatDate(now.toISOString())}</p>
			</footer>
		</div>
	)
}

/** The rail's three columns: the date, the node, the entry. The line sits at 120px. */
const RAIL_ROW = "grid grid-cols-[104px_32px_minmax(0,1fr)] items-center"

/** A node, centred on the line by flex. With `mx-auto` the nodes came out
 *  off the line in the PNG (cause not pinned down); flex draws them on it. */
function RailNode({ children }: { children: ReactNode }) {
	return <div className="relative flex justify-center">{children}</div>
}

const TILE_TONES = {
	ok: { box: "border-pull-ok-border/50 bg-pull-ok-border/10", value: "text-pull-ok" },
	over: { box: "border-pull-over-border/60 bg-pull-over-border/10", value: "text-pull-over" },
}

/** One of the header's headline figures. */
function Tile({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: keyof typeof TILE_TONES }) {
	const style = tone ? TILE_TONES[tone] : { box: "border-edge bg-(--card-fill)", value: "text-gray-50" }
	return (
		<div className={`min-w-0 flex-1 rounded-xl border px-4 py-3 ${style.box}`}>
			<p className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{label}</p>
			<p className={`font-display mt-1.5 text-[1.75rem] leading-none font-bold tabular-nums ${style.value}`}>{value}</p>
			{note && <p className="mt-1.5 text-xs text-gray-400">{note}</p>}
		</div>
	)
}

/** A scenario launch or an anniversary, as a dated point on the rail. Styled
 *  like the sheet's band (PlannerSectionBand): a scenario in the accent, an
 *  anniversary with a sparkle. A size down in compact rows. */
function Milestone({ marker, compact }: { marker: PlannerMarker; compact: boolean }) {
	const scenario = marker.kind === "scenario"
	return (
		<div className={`${RAIL_ROW} ${compact ? "py-0.5" : "py-1"}`}>
			<span className="pr-1 text-right text-xs text-gray-400 tabular-nums">{formatDate(marker.startDate)}</span>
			<RailNode>
				<span className="h-2.5 w-2.5 rotate-45 bg-brand" />
			</RailNode>
			<div className="flex min-w-0 items-center gap-3">
				<span
					className={`flex shrink-0 items-center gap-1.5 tracking-wide ${compact ? "text-[13px]" : "text-[15px]"} ${
						scenario ? "font-semibold text-brand" : "font-medium text-gray-200"
					}`}
				>
					{!scenario && <Sparkles className="h-4 w-4 text-brand/85" aria-hidden="true" />}
					{marker.name}
				</span>
				<span className="h-px flex-1 bg-brand/20" />
			</div>
		</div>
	)
}

/** The big count's colour: green on pity, red over budget, plain otherwise. */
const COUNT_TEXT: Record<PullCountStatus, string> = {
	ok: "text-pull-ok",
	neutral: "text-gray-50",
	over: "text-pull-over",
}

/** The meter's affordable part, in the sheet's field colours. */
const METER_FILL: Record<PullCountStatus, string> = {
	ok: "bg-pull-ok-border",
	neutral: "bg-pull-neutral-border",
	over: "bg-pull-neutral-border",
}

function BannerEntry({ plannerRow, resources, umaBannerData, supportBannerData, userStepUpSelectionData, hideSpend, compact, now }: {
	plannerRow: Extract<PlannerRow, { kind: "banner" }>
	resources: BannerResources
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	userStepUpSelectionData: UserStepUpSelection[]
	hideSpend: boolean
	/** A long plan's one-line row (planPictureLayout). */
	compact: boolean
	now: Date
}) {
	const banner = plannerRow.banner
	const target = plannedBannerTarget(banner)
	const bannerType = plannedBannerRowType(banner)
	const isStepUp = bannerType === "StepUp"
	const figures = bannerRowFigures(banner, resources, isStepUp, now)
	const timeline = plannedBannerTimeline(banner)
	const excluded = isExcludedFromProjection(banner)
	// The 2x2 grid reads Carat Est. over Paid Carat Est., the pull split over
	// the most pulls (Daptrius, 2026-10-29): the sheet's first two swap places.
	// The sheet itself keeps its order.
	const [split, carats, paid, most] = figures.stats
	// The paid figure stays in place, blanked and greyed, so the grid keeps its shape.
	const stats = [carats, split, paid, most].map((stat) =>
		hideSpend && stat.label === "Paid Carat Est." ? { ...stat, value: "–", valueClass: "text-gray-400" } : stat
	)

	// number_of_pulls carries STEPS on a step-up row (step-up.md).
	const count = banner.number_of_pulls
	const ceiling = isStepUp ? figures.stepUpperBound : figures.pullUpperBound
	const unit = isStepUp ? (count === 1 ? "step" : "steps") : count === 1 ? "pull" : "pulls"

	// What the meter says: how much of the planned count the carats cover,
	// against the most the banner could take. Over budget, the part past the
	// ceiling turns red. An ended or uncounted banner gets no meter.
	const scale = Math.max(count, ceiling, 1)
	const showMeter = !figures.bannerHasEnded && !excluded && count > 0
	const caption: ReactNode = figures.bannerHasEnded ? (
		<span className="text-gray-400">Ended</span>
	) : excluded ? (
		<span className="text-gray-400">Not counted</span>
	) : figures.countStatus === "over" ? (
		<span className="text-pull-over">Over budget</span>
	) : figures.countStatus === "ok" ? (
		<span className="text-pull-ok">{isStepUp ? "Full round" : "On pity"}</span>
	) : null

	const meter = showMeter && (
		<div className={`flex overflow-hidden rounded-full bg-gray-700 ${compact ? "mt-1 h-1" : "mt-1.5 h-1.5"}`}>
			<div className={METER_FILL[figures.countStatus]} style={{ width: `${(Math.min(count, ceiling) / scale) * 100}%` }} />
			{count > ceiling && <div className="bg-pull-over-border" style={{ width: `${((count - ceiling) / scale) * 100}%` }} />}
		</div>
	)
	const reserved = banner.reserved_copies > 0 && (
		<p className={`mt-0.5 leading-tight ${compact ? "text-[10px]" : "text-[11px]"} ${figures.reservedStatus === "over" ? "text-pull-over" : "text-gray-300"}`}>
			+{banner.reserved_copies} reserved
		</p>
	)

	// A long plan's row: the same figures a size down, about half the height.
	// The count's colour carries the status, so the caption goes.
	if (compact) {
		return (
			<div className={RAIL_ROW}>
				<div className="pr-1 text-right leading-tight tabular-nums">
					{timeline ? (
						<>
							<p className="text-[13px] font-semibold text-gray-100">{formatDate(timeline.start_date)}</p>
							<p className="text-[11px] text-gray-400">to {formatDate(timeline.end_date)}</p>
						</>
					) : (
						<p className="text-xs text-gray-400">–</p>
					)}
				</div>
				<RailNode>
					<span className="h-2.5 w-2.5 rounded-full border-2 border-brand bg-gray-900" />
				</RailNode>

				<div
					className={`flex min-h-14 items-center gap-3 rounded-lg border border-edge bg-(--card-fill) py-1.5 pr-3 pl-2 ${
						excluded ? "opacity-60" : ""
					}`}
				>
					{/* Relative: BannerArt's "+2" badge is placed against this cell. */}
					<div className="relative flex w-[100px] shrink-0 items-center justify-center gap-1">
						<BannerArt
							target={target}
							userStepUpSelectionData={userStepUpSelectionData}
							umaBannerData={umaBannerData}
							supportBannerData={supportBannerData}
							small
						/>
					</div>
					<div className="min-w-0 flex-1">
						<BannerTypeChip type={bannerType} />
						<p className="mt-0.5 line-clamp-2 text-[13px] leading-tight font-semibold text-gray-50">
							{target.type === "Empty" ? "–" : target.banner.name}
						</p>
					</div>
					<dl className="grid w-[184px] shrink-0 grid-cols-2 gap-x-2.5 gap-y-0.5">
						{stats.map((stat) => (
							<div key={stat.label} className="min-w-0">
								<dt className="truncate text-[9.5px] leading-tight text-gray-400">{stat.label}</dt>
								<dd className={`text-[12.5px] leading-tight font-semibold tabular-nums ${stat.valueClass ?? "text-gray-100"}`}>{stat.value}</dd>
							</div>
						))}
					</dl>
					<div className="w-[84px] shrink-0 text-center">
						<p className="leading-none tabular-nums">
							<span className={`font-display text-xl font-bold ${COUNT_TEXT[figures.countStatus]}`}>{count.toLocaleString()}</span>{" "}
							<span className="text-[11px] text-gray-400">{unit}</span>
						</p>
						{meter}
						{reserved}
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className={RAIL_ROW}>
			<div className="pr-1 text-right leading-tight tabular-nums">
				{timeline ? (
					<>
						<p className="text-sm font-semibold text-gray-100">{formatDate(timeline.start_date)}</p>
						<p className="mt-0.5 text-xs text-gray-400">to {formatDate(timeline.end_date)}</p>
					</>
				) : (
					<p className="text-xs text-gray-400">–</p>
				)}
			</div>
			<RailNode>
				<span className="h-3 w-3 rounded-full border-2 border-brand bg-gray-900" />
			</RailNode>

			<div
				className={`flex min-h-[5.5rem] items-center gap-4 rounded-xl border border-edge bg-(--card-fill) py-2.5 pr-4 pl-3 shadow-(--card-shadow) ${
					excluded ? "opacity-60" : ""
				}`}
			>
				<div className="relative flex w-[136px] shrink-0 items-center justify-center gap-1.5">
					<BannerArt
						target={target}
						userStepUpSelectionData={userStepUpSelectionData}
						umaBannerData={umaBannerData}
						supportBannerData={supportBannerData}
						large
					/>
				</div>

				<div className="min-w-0 flex-1">
					<BannerTypeChip type={bannerType} />
					<p className="mt-1.5 line-clamp-3 text-[15px] leading-snug font-semibold text-gray-50">
						{target.type === "Empty" ? "–" : target.banner.name}
					</p>
				</div>

				<dl className="grid w-[200px] shrink-0 grid-cols-2 gap-x-3 gap-y-1.5">
					{stats.map((stat) => (
						<div key={stat.label} className="min-w-0">
							<dt className="truncate text-[10.5px] leading-tight text-gray-400">{stat.label}</dt>
							<dd className={`text-sm leading-tight font-semibold tabular-nums ${stat.valueClass ?? "text-gray-100"}`}>{stat.value}</dd>
						</div>
					))}
				</dl>

				<div className="w-[96px] shrink-0 text-center">
					<p className={`font-display text-[1.75rem] leading-none font-bold tabular-nums ${COUNT_TEXT[figures.countStatus]}`}>
						{count.toLocaleString()}
					</p>
					<p className="mt-0.5 text-xs text-gray-400">{unit}</p>
					{meter}
					{caption && <p className="mt-1 text-[11px] leading-tight font-medium">{caption}</p>}
					{reserved}
				</div>
			</div>
		</div>
	)
}
