/**
 * The Rankings page's Pull plans tab (`?view=pull-plans`): the banners
 * players plan to pull on, how many plan each and how much (planners,
 * total, average, typical = the median), and when the pulls fall due.
 * The admin analytics' Popular banners tables, shown to supporters
 * (notes/rankings-page-plan.md).
 *
 * THE REDESIGN (notes/rankings-redesign-plan.md step 2, mocks 07, 08, 20;
 * the 2026-11-25 polish, notes/rankings-polish-plan.md, canvas shots 14, 15):
 * the hero (the banner ahead most planners plan, its umas' faces on the first
 * one's colours), the month strip ("When the pulls fall due", six divs in place
 * of the Recharts chart and its table), the type and sort lenses (both
 * remembered on the device with the pinned window's choices), and one list
 * of PullPlanRow, each with its banner's faces (the umas or cards on it,
 * from the calculator's banners; a step-up has none), opening to its pull
 * spread and "also planning".
 *
 * BEHIND THE RAPTIVE GATE: guide editors only (useRankingsPullPlans) until
 * the owner lifts it; the API refuses everyone else the same way.
 *
 * Which rows show and their order is utils/pullPlanRankings.ts.
 *
 * SHARES, NOT COUNTS (owner, 2026-10-28): no figure says how many people
 * plan or how many pulls they plan in all, since either would let a reader
 * estimate the site's players, and the server sends none
 * (types/pullPlanRankings.ts). Medians and averages are per planner, so
 * they stay.
 */

import { useMemo, useState, type ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { useRankingsPayload } from "../../hooks/useRankingsPayload"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { useCalculatorData } from "../../services/CalculatorContext"
import { chooseRankings, useRankingsChoices } from "../../services/rankingsPinStore"
import type { SupportCard, Uma } from "../../types/banner"
import type { PlannedBannerType, PullPlanRankingsPayload } from "../../types/pullPlanRankings"
import { cardFrameArt } from "../../utils/cardFrame"
import { formatShare } from "../../utils/guideRankings"
import { pullPlanRows, stripColumns, type PullPlanSort, type StripColumn } from "../../utils/pullPlanRankings"
import { movement } from "../../utils/rankingsMovement"
import { FramedCard } from "../FramedCard"
import { FramedUma } from "../FramedUma"
import { useReportUpdated } from "./rankingsUpdated"
import { Lens } from "./kit/Lens"
import { Panel } from "./kit/Panel"
import { RankedList } from "./kit/RankedList"
import { RankHero } from "./kit/RankHero"
import { PullPlanRow } from "./PullPlanRow"

type TypeChoice = PlannedBannerType | "all"
const TYPES: Array<{ id: TypeChoice; label: string }> = [
	{ id: "all", label: "All" },
	{ id: "uma", label: "Uma" },
	{ id: "support", label: "Support" },
	{ id: "step_up", label: "Step-up" },
]
const SORTS: Array<{ id: PullPlanSort; label: string }> = [
	{ id: "date", label: "By date" },
	{ id: "planners", label: "By planners" },
]

const PANEL_NOTE = "rk-panel p-4 text-sm text-gray-300"

/** What is on a banner: its umas, or its cards. A step-up has neither. */
interface BannerFaces {
	umas: Uma[]
	cards: SupportCard[]
}

export function PullPlans() {
	const state = useRankingsPayload<PullPlanRankingsPayload>("/rankings/pull-plans")
	if (state.status === "refused") return <p className={PANEL_NOTE}>Pull plans aren't open yet.</p>
	if (state.status === "error") return <p className={PANEL_NOTE}>The rankings didn't load. Reload the page to try again.</p>
	if (state.status === "loading") {
		return (
			<div className="flex items-center gap-2 text-sm text-gray-400" role="status">
				<Loader2 className="h-4 w-4 animate-spin" />
				Counting the plans...
			</div>
		)
	}
	return <PullPlansBody payload={state.payload} />
}

function PullPlansBody({ payload }: { payload: PullPlanRankingsPayload }) {
	useReportUpdated(payload.generated_at)
	const choices = useRankingsChoices()["pull-plans"]
	// A remembered value from an older build falls back to the default.
	const type: TypeChoice = TYPES.some((option) => option.id === choices?.type) ? (choices?.type as TypeChoice) : "all"
	const sort: PullPlanSort = choices?.sort === "planners" ? "planners" : "date"
	const [showEnded, setShowEnded] = useState(false)
	// One clock reading per mount: which month is "now" on the strip.
	const [now] = useState(() => new Date())

	const rows = useMemo(
		() => pullPlanRows(payload.banners, { type: type === "all" ? null : type, sort, showEnded }),
		[payload, type, sort, showEnded]
	)
	const ahead = payload.banners.filter((row) => row.status !== "ended")
	const leader = Math.max(0, ...rows.map((row) => row.share))
	// Movement is by planners (the order the server snapshots), so it shows in that order only.
	const moves = useMemo(() => {
		if (sort !== "planners") return new Map<string, number | "new">()
		const shown = (key: string) => rows.some((row) => `${row.type}-${row.id}` === key)
		return movement(rows.map((row) => `${row.type}-${row.id}`), payload.previous?.banners.filter(shown))
	}, [sort, rows, payload])
	const columns = useMemo(() => stripColumns(payload.demand, now), [payload, now])
	// A month, never a quarter or Later: three months summed would outweigh any one.
	const busiest = columns
		.filter((column) => column.kind === "month")
		.reduce<StripColumn | null>((best, month) => (best && best.share >= month.share ? best : month), null)
	// The banner ahead the most players plan, as a share of everyone with a plan.
	const mostPlanned = ahead.reduce<(typeof ahead)[number] | null>((best, row) => (best && best.share >= row.share ? best : row), null)
	// A banner's Timeline card is its BannerTimeline, which the calculator's banners carry.
	const { umaBannerData, supportBannerData, stepUpBannerData } = useCalculatorData()
	const timelines = useMemo(() => {
		const map = new Map<string, number>()
		for (const banner of umaBannerData) map.set(`uma-${banner.id}`, banner.banner_timeline.id)
		for (const banner of supportBannerData) map.set(`support-${banner.id}`, banner.banner_timeline.id)
		for (const banner of stepUpBannerData) map.set(`step_up-${banner.id}`, banner.banner_timeline.id)
		return map
	}, [umaBannerData, supportBannerData, stepUpBannerData])
	const timelineOf = (type: PlannedBannerType, id: number) => timelines.get(`${type}-${id}`) ?? null
	// Who is on each banner, from the banners the page already holds (the payload's ids are banner ids).
	const onBanner = useMemo(() => {
		const map = new Map<string, BannerFaces>()
		for (const banner of umaBannerData) map.set(`uma-${banner.id}`, { umas: banner.umas, cards: [] })
		for (const banner of supportBannerData) map.set(`support-${banner.id}`, { umas: [], cards: banner.support_cards })
		return map
	}, [umaBannerData, supportBannerData])
	const oshiIds = useOshiIds()
	/** A banner's faces in the site's frames, at a row's size or the hero's. Null for a step-up. */
	const facesOf = (type: PlannedBannerType, id: number, size: "row" | "hero"): ReactNode => {
		const on = onBanner.get(`${type}-${id}`)
		if (!on || (on.umas.length === 0 && on.cards.length === 0)) return null
		const umaClass = size === "hero" ? "enc-hero__art" : "w-12"
		const cardClass = size === "hero" ? "enc-hero__art enc-hero__art--card" : "w-[2.4rem]"
		return (
			<>
				{on.umas.map((uma) => (
					<FramedUma key={`u-${uma.id}`} src={uma.portrait ?? uma.image} layers={uma.portrait_layers} oshi={oshiIds.has(uma.id)} className={umaClass} />
				))}
				{on.cards.map((card) => (
					<FramedCard key={`c-${card.id}`} card={cardFrameArt(card)} className={cardClass} />
				))}
			</>
		)
	}
	// The hero's colours are its first uma's: the catalogue knows her character (it loads
	// for the other tabs anyway). Until it lands, or for a card banner, the page's accent.
	const catalogue = usePvpCatalogue()
	const heroFaces = mostPlanned ? facesOf(mostPlanned.type, mostPlanned.id, "hero") : null
	const heroOn = mostPlanned ? onBanner.get(`${mostPlanned.type}-${mostPlanned.id}`) : undefined
	// One face is drawn at a portrait's or a card's size; two or more side by side, smaller.
	const faceCount = (heroOn?.umas.length ?? 0) + (heroOn?.cards.length ?? 0)
	const heroShape = faceCount > 1 ? "pair" : heroOn?.cards.length ? "card" : "uma"
	const firstUma = heroOn?.umas[0]
	const characterId = firstUma && catalogue.status === "ready" ? catalogue.umasById.get(firstUma.id)?.character_id : undefined
	const heroColours = characterId != null && catalogue.status === "ready" ? catalogue.catalogue.character_colours?.[String(characterId)] : undefined

	return (
		<div className="flex flex-col gap-[1.125rem]">
			<RankHero
				title="What players plan to pull on"
				top={
					mostPlanned
						? {
								place: "#1 most planned",
								name: mostPlanned.name,
								line: (
									<>
										<b>{formatShare(mostPlanned.share)}</b> of planners have it in their plan
									</>
								),
								art: heroFaces && <span className="rk-faces">{heroFaces}</span>,
								shape: heroShape,
								colours: heroColours,
							}
						: null
				}
				figures={[
					{ label: "Banners ahead", value: ahead.length.toLocaleString() },
					...(busiest && busiest.share > 0 ? [{ label: "Busiest month", value: formatShare(busiest.share), suffix: busiest.label }] : []),
				]}
			/>

			{payload.demand.length > 0 && (
				<Panel title="When the pulls fall due" hint={'Share of planned pulls by the month a banner ends. Undated banners sit in "Later".'}>
					<MonthStrip columns={columns} />
				</Panel>
			)}

			<div className="flex flex-wrap items-center gap-2.5">
				<Lens label="Banner type" options={TYPES} value={type} onChange={(next) => chooseRankings("pull-plans", { type: next })} />
				<Lens label="Order" options={SORTS} value={sort} onChange={(next) => chooseRankings("pull-plans", { sort: next })} />
				<span className="text-[13px] text-gray-400">
					{showEnded ? "Ended banners shown" : "Ended banners hidden"} ·{" "}
					<button type="button" aria-pressed={showEnded} onClick={() => setShowEnded(!showEnded)} className="text-brand transition hover:text-brand/75">
						{showEnded ? "hide" : "show"}
					</button>
				</span>
			</div>

			<RankedList
				label="Banners players plan"
				items={rows}
				start={20}
				itemKey={(row) => `${row.type}-${row.id}`}
				render={(row) => (
					<PullPlanRow
						row={row}
						fill={leader > 0 ? row.share / leader : 0}
						faces={facesOf(row.type, row.id, "row")}
						timelineOf={timelineOf}
						movement={moves.get(`${row.type}-${row.id}`)}
					/>
				)}
				empty="Nobody plans a banner like that yet."
				footnote={
					<span className="text-gray-400">
						Planners is the share of everyone with a plan. A step-up's figures are ladder steps, not pulls.
					</span>
				}
			/>
		</div>
	)
}

/**
 * Eleven columns: this month and the next five, four quarters, then "Later"
 * (stripColumns), each a bar of its share of the pulls planned (tallest = the
 * biggest column). The running month is drawn in the running colour and says
 * "now". Solid bars on the inset surface (the 2026-11-25 polish; a quarter is
 * no longer a lighter shade: nothing is dimmed, and its label says it holds
 * three months). Divs, no chart library. On a phone the strip scrolls
 * sideways rather than squeezing eleven labels into ~30px each.
 */
function MonthStrip({ columns }: { columns: StripColumn[] }) {
	const top = Math.max(0, ...columns.map((column) => column.share))
	return (
		<div className="overflow-x-auto rounded-[0.875rem] bg-(--enc-inset) px-2.5 pb-3 pt-3.5 [scrollbar-width:thin]">
			<ol
				className="grid items-end gap-2 px-1 @min-[40rem]:gap-3"
				style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(3.25rem, 1fr))` }}
				aria-label="Share of planned pulls by month"
			>
				{columns.map((column) => (
					<li key={column.key} className="flex min-w-0 flex-col items-center gap-1">
						<span className="flex h-20 w-full max-w-[3.5rem] items-end" aria-hidden="true">
							<span
								className={`block w-full rounded-t-md ${column.current ? "bg-status-running" : "bg-brand"}`}
								style={{ height: `${top > 0 ? Math.max(2, (column.share / top) * 100) : 2}%` }}
							/>
						</span>
						<b className="font-display text-base font-bold tabular-nums text-gray-100">{formatShare(column.share)}</b>
						<span className="text-center text-xs leading-tight tabular-nums text-gray-400">
							{column.label}
							{column.current ? " · now" : ""}
						</span>
					</li>
				))}
			</ol>
		</div>
	)
}
