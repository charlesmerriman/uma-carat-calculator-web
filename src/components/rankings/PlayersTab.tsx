/**
 * The Rankings page's Players tab (`?view=players`): how the site's players
 * play, from the admin analytics among accounts that use the calculator
 * (staff out): Team Trials class and club rank, favourite umas, the income
 * options they turn on, and the campaign selectors they plan to buy with
 * what they plan to take. Shares only, never a count of players (owner,
 * 2026-10-28: nothing on the page may let a reader estimate how many
 * people use the site) and never a name.
 *
 * THE REDESIGN (notes/rankings-redesign-plan.md step 2, mocks 11, 22): the
 * band, the two ranks as stacked distribution bars, favourites as a wall of
 * portraits, income options as labelled bars ("starts off" beside the ones a
 * new account starts without), the typical budget by class (medians from the
 * server, never one person's), and the selectors: the campaign on sale (else
 * the next one) in front, later and past campaigns behind their own buttons.
 *
 * Every figure is the server's share (types/rankingsTabs.ts): it never sends
 * how many players there are.
 */

import { useState } from "react"
import { Loader2 } from "lucide-react"
import type { PlayersRankingsPayload } from "../../types/rankingsTabs"
import type { CatalogueUma } from "../../types/pvpTeam"
import { useRankingsPayload } from "../../hooks/useRankingsPayload"
import { usePvpCatalogue, type PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { FramedUma } from "../FramedUma"
import { formatShare } from "../../utils/guideRankings"
import { useReportUpdated } from "./rankingsUpdated"
import { formatDate, parseApiDate } from "../../utils/dateFormat"
import { Bar } from "./kit/Bar"
import { CardArt } from "./kit/CardArt"
import { DistBar } from "./kit/DistBar"
import { OptionRows } from "./kit/OptionRows"
import { Panel, PanelHead } from "./kit/Panel"
import { StatBand } from "./kit/StatBand"
import { Wall } from "./kit/Wall"

const PANEL_NOTE = "rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300"
const GRID = "grid items-start gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,26rem),1fr))]"
/** The income option the band's third figure reads. */
const DAILY_CARAT = "daily_carat"

export function PlayersTab() {
	const state = useRankingsPayload<PlayersRankingsPayload>("/rankings/players")
	const catalogue = usePvpCatalogue()
	if (state.status === "refused") return <p className={PANEL_NOTE}>Rankings are open to supporters first.</p>
	if (state.status === "error" || catalogue.status === "error") {
		return <p className={PANEL_NOTE}>The rankings didn't load. Reload the page to try again.</p>
	}
	if (state.status !== "ready" || catalogue.status !== "ready") {
		return (
			<div className="flex items-center gap-2 text-sm text-gray-400" role="status">
				<Loader2 className="h-4 w-4 animate-spin" />
				Counting the players...
			</div>
		)
	}
	return <PlayersBody payload={state.payload} catalogue={catalogue} />
}

function PlayersBody({ payload, catalogue }: { payload: PlayersRankingsPayload; catalogue: PvpCatalogueIndex }) {
	useReportUpdated(payload.generated_at)
	const favourites = payload.favourites.flatMap((row) => {
		const uma = catalogue.umasById.get(row.uma)
		return uma ? [{ uma, count: formatShare(row.share) }] : []
	})
	const trials = payload.ranks.find((rank) => rank.label === "Team Trials")
	const topClass = trials?.rows.reduce<(typeof trials.rows)[number] | null>((best, row) => (best && best.share >= row.share ? best : row), null)
	const dailyCarat = payload.income.find((row) => row.key === DAILY_CARAT)

	return (
		<div className="flex flex-col gap-3.5">
			<StatBand
				title="Who plays here"
				stats={[
					...(trials && topClass ? [{ label: `In ${topClass.name}`, value: formatShare(topClass.share) }] : []),
					...(dailyCarat ? [{ label: "Buy the Daily Carat Pack", value: formatShare(dailyCarat.share) }] : []),
					...(trials ? [{ label: "Set their class", value: formatShare(trials.share) }] : []),
				]}
			>
				From the players who use the calculator with an account, staff left out. Shares, never a name.
			</StatBand>

			<div className={GRID}>
				<div className="flex min-w-0 flex-col gap-3">
					{payload.ranks.length > 0 && (
						<section aria-label="Ranks" className="card-panel flex min-w-0 flex-col gap-4 p-3">
							{payload.ranks.map((rank) => (
								<div key={rank.label} className="flex flex-col gap-2">
									<PanelHead title={rank.label === "Team Trials" ? "Team Trials class" : rank.label} hint={`Of the ${formatShare(rank.share)} of players who set it.`} />
									<DistBar label={rank.label} rows={highestFirst(rank.rows)} />
								</div>
							))}
						</section>
					)}
					<Panel title="Income options" hint="Players with each option on in the calculator.">
						<OptionRows
							rows={[...payload.income].sort((a, b) => b.share - a.share).map((row) => ({
								key: row.key,
								label: row.label,
								// Switching it on was a choice: worth saying beside the share.
								note: row.default_on === false ? "starts off" : undefined,
								value: row.share,
								share: formatShare(row.share),
							}))}
						/>
					</Panel>
				</div>
				<div className="flex min-w-0 flex-col gap-3">
					<Panel title="Favourite umas" hint="Share of players who picked her as a favourite. The first favourite is the account picture.">
						{favourites.length === 0 ? (
							<p className="px-1 text-xs text-gray-400">Nobody has picked a favourite yet.</p>
						) : (
							<Wall label="Favourite umas, most picked first" entries={favourites} />
						)}
					</Panel>
					{payload.budget && payload.budget.length > 0 && <Budget rows={payload.budget} />}
					<Selectors selectors={payload.selectors} catalogue={catalogue} />
				</div>
			</div>
		</div>
	)
}

/**
 * A rank's rows highest first, "None" last (mock 11-players.png: Class 6
 * leads). The server sends them lowest first, the order the admin's tables
 * read; the bar's colour ramp runs from the brand, so the top rank gets it.
 */
function highestFirst(rows: Array<{ name: string; share: number }>) {
	const reversed = [...rows].reverse()
	return [...reversed.filter((row) => row.name !== "None"), ...reversed.filter((row) => row.name === "None")]
}

type Selector = PlayersRankingsPayload["selectors"][number]

/**
 * The typical budget per Team Trials class (mock 11-players.png): the middle
 * player's carats held and pulls planned, as two figures and a bar of the
 * carats scaled to the richest class. Medians from the server.
 */
function Budget({ rows }: { rows: NonNullable<PlayersRankingsPayload["budget"]> }) {
	const top = Math.max(0, ...rows.map((row) => row.carats ?? 0))
	return (
		<Panel title="Typical budget by class" hint="The middle player's carats held and pulls planned.">
			<ul className="flex flex-col gap-1">
				{rows.map((row) => (
					<li key={row.name} className="grid grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-2.5 py-0.5 @max-[30rem]:grid-cols-[5rem_minmax(0,1fr)]">
						<span className="text-[13px] text-gray-100">{row.name}</span>
						<Bar fill={top ? (row.carats ?? 0) / top : 0} className="@max-[30rem]:hidden" />
						<span className="whitespace-nowrap text-right text-xs tabular-nums text-gray-400">
							<b className="text-[13px] font-semibold text-gray-100">{(row.carats ?? 0).toLocaleString()}</b> carats
							{row.pulls !== null && (
								<>
									{" · "}
									<b className="text-[13px] font-semibold text-gray-100">{row.pulls.toLocaleString()}</b> pulls
								</>
							)}
						</span>
					</li>
				))}
			</ul>
		</Panel>
	)
}

/** A selector's end as a time, an undated one last. */
function endTime(selector: Selector): number {
	return (selector.end_date && parseApiDate(selector.end_date)?.getTime()) || Number.POSITIVE_INFINITY
}

/**
 * The campaign selectors anyone plans to buy, by their campaign's dates: the
 * ones on sale in front, else every selector of the NEXT campaign (soonest
 * end first), so a campaign's Uma and SSR selectors sit together. Later
 * campaigns and past ones wait behind a button each, later soonest first,
 * past most recent first. A payload without `status` reads as upcoming.
 */
function Selectors({ selectors, catalogue }: { selectors: Selector[]; catalogue: PvpCatalogueIndex }) {
	const [shown, setShown] = useState<"later" | "past" | null>(null)
	const bought = selectors.filter((selector) => selector.buyers > 0)
	const onSale = bought.filter((selector) => selector.status === "on_sale")
	const upcoming = bought.filter((selector) => (selector.status ?? "upcoming") === "upcoming").sort((a, b) => endTime(a) - endTime(b))
	const past = bought.filter((selector) => selector.status === "past").sort((a, b) => endTime(b) - endTime(a))
	const front = onSale.length > 0 ? onSale : upcoming.filter((selector) => selector.campaign === upcoming[0]?.campaign)
	const later = upcoming.filter((selector) => !front.includes(selector))
	const campaigns = [...new Set(front.map((selector) => selector.campaign))]
	const ends = front[0]?.end_date
	const toggle = (list: "later" | "past") => setShown(shown === list ? null : list)
	const others = shown === "later" ? later : shown === "past" ? past : []
	return (
		<Panel
			title={onSale.length > 0 ? (onSale.length === 1 ? "Selector on sale" : "Selectors on sale") : "Next campaign selectors"}
			hint={front.length > 0 ? `${campaigns.join(", ")}${ends ? ` · ends ${formatDate(ends)}` : ""}` : undefined}
		>
			{front.length === 0 && past.length === 0 ? (
				<p className="px-1 text-xs text-gray-400">Nobody plans to buy a campaign selector yet.</p>
			) : (
				<>
					{front.length === 0 && <p className="px-1 text-xs text-gray-400">Nobody plans to buy a selector from a campaign ahead yet.</p>}
					{front.map((selector) => (
						<div key={`${selector.campaign}-${selector.label}`} className="flex flex-col gap-1.5">
							<span className="px-1 text-xs font-semibold text-gray-100">
								{selector.label}
								{campaigns.length > 1 && <span className="font-normal text-gray-400"> · {selector.campaign}</span>}
							</span>
							<SelectorPicks selector={selector} catalogue={catalogue} />
							<p className="px-1 text-xs text-gray-300">
								{formatShare(selector.buyers)} of players plan to buy it, and {formatShare(selector.picked)} of them have picked.
							</p>
						</div>
					))}
					<span className="flex flex-wrap gap-x-3 px-1">
						{later.length > 0 && (
							<button type="button" aria-expanded={shown === "later"} onClick={() => toggle("later")} className="text-[11px] text-brand transition hover:text-brand/75">
								{shown === "later" ? "Hide later campaigns" : `Later campaigns (${later.length})`}
							</button>
						)}
						{past.length > 0 && (
							<button type="button" aria-expanded={shown === "past"} onClick={() => toggle("past")} className="text-[11px] text-brand transition hover:text-brand/75">
								{shown === "past" ? "Hide past campaigns" : `Past campaigns (${past.length})`}
							</button>
						)}
					</span>
					{others.map((selector) => (
						<div key={`${selector.campaign}-${selector.label}`} className="flex flex-col gap-1.5 border-t border-edge px-1 pt-2">
							<span className="text-xs font-semibold text-gray-100">
								{selector.label} <span className="font-normal text-gray-400">· {selector.campaign}</span>
								{selector.end_date && (
									<span className="font-normal text-gray-400">
										{" "}
										· {selector.status === "past" ? "ended" : "ends"} {formatDate(selector.end_date)}
									</span>
								)}
							</span>
							<SelectorPicks selector={selector} catalogue={catalogue} />
							<span className="text-[11px] tabular-nums text-gray-400">
								{formatShare(selector.buyers)} of players, {formatShare(selector.picked)} of them picked
							</span>
						</div>
					))}
				</>
			)}
		</Panel>
	)
}

/** A selector's top picks as chips: the uma's portrait or the card's art, the name, and its share of the picks. */
function SelectorPicks({ selector, catalogue }: { selector: Selector; catalogue: PvpCatalogueIndex }) {
	const oshiIds = useOshiIds()
	if (selector.top.length === 0) return null
	return (
		<ul className="flex flex-wrap gap-2">
			{selector.top.map((pick) => {
				// An uma pick or a card pick, by which id the server sent.
				const uma: CatalogueUma | undefined = pick.uma !== undefined ? catalogue.umasById.get(pick.uma) : undefined
				const card = pick.card !== undefined ? catalogue.cardsById.get(pick.card) : undefined
				const name = uma?.name ?? card?.name
				if (!name) return null
				return (
					<li key={`${pick.uma ?? "c"}-${pick.card ?? "u"}`} className="flex min-w-0 items-center gap-2 rounded-[10px] border border-edge bg-gray-900/70 py-1.5 pl-1.5 pr-3">
						{uma ? <FramedUma src={uma.portrait ?? uma.image} oshi={oshiIds.has(uma.id)} className="w-10" /> : <CardArt card={card} className="w-8" />}
						<span className="flex min-w-0 flex-col">
							<b className="truncate text-[13px] font-semibold text-gray-100">{name}</b>
							<span className="text-[11px] tabular-nums text-gray-400">{formatShare(pick.share)} of picks</span>
						</span>
					</li>
				)
			})}
		</ul>
	)
}
