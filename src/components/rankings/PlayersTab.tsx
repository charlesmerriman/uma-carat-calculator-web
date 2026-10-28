/**
 * The Rankings page's Players tab (`?view=players`): how the site's players
 * play, from the admin analytics among accounts that use the calculator
 * (staff out): Team Trials class and club rank, favourite umas, the income
 * options they turn on, and the campaign selectors they plan to buy with
 * what they plan to take. Counts and shares, never a name.
 *
 * THE REDESIGN (notes/rankings-redesign-plan.md step 2, mocks 11, 22): the
 * band, the two ranks as stacked distribution bars, favourites as a wall of
 * portraits, income options as labelled bars, and one selector in front with
 * the rest behind "Show earlier". Step 4 adds the typical budget by class,
 * "starts off" on the income options, and which selector is on sale.
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

const plural = (count: number, one: string, many = `${one}s`) => `${count.toLocaleString()} ${count === 1 ? one : many}`

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
	const { engaged } = payload
	const share = (people: number, of: number) => formatShare(of > 0 ? people / of : 0)
	const favourites = payload.favourites.flatMap((row) => {
		const uma = catalogue.umasById.get(row.uma)
		return uma ? [{ uma, count: plural(row.people, "player") }] : []
	})
	const trials = payload.ranks.find((rank) => rank.label === "Team Trials")
	const topClass = trials?.rows.reduce<(typeof trials.rows)[number] | null>((best, row) => (best && best.people >= row.people ? best : row), null)
	const dailyCarat = payload.income.find((row) => row.key === DAILY_CARAT)

	return (
		<div className="flex flex-col gap-3.5">
			<StatBand
				title="Who plays here"
				stats={[
					{ label: "Players", value: engaged.toLocaleString() },
					...(trials && topClass ? [{ label: `In ${topClass.name}`, value: share(topClass.people, trials.people) }] : []),
					...(dailyCarat ? [{ label: "Buy the Daily Carat Pack", value: share(dailyCarat.people, engaged) }] : []),
				]}
			>
				From the players who use the calculator with an account, staff left out. Counts, never a name.
			</StatBand>

			<div className={GRID}>
				<div className="flex min-w-0 flex-col gap-3">
					{payload.ranks.length > 0 && (
						<section aria-label="Ranks" className="card-panel flex min-w-0 flex-col gap-4 p-3">
							{payload.ranks.map((rank) => (
								<div key={rank.label} className="flex flex-col gap-2">
									<PanelHead title={rank.label === "Team Trials" ? "Team Trials class" : rank.label} hint={`Of the ${rank.people.toLocaleString()} who set it.`} />
									<DistBar label={rank.label} rows={highestFirst(rank.rows)} total={rank.people} />
								</div>
							))}
						</section>
					)}
					<Panel title="Income options" hint="Players with each option on in the calculator.">
						<OptionRows
							rows={[...payload.income].sort((a, b) => b.people - a.people).map((row) => ({
								key: row.key,
								label: row.label,
								value: row.people,
								share: share(row.people, engaged),
								count: row.people.toLocaleString(),
							}))}
						/>
					</Panel>
				</div>
				<div className="flex min-w-0 flex-col gap-3">
					<Panel title="Favourite umas" hint="Players who picked her as a favourite. The first favourite is the account picture.">
						{favourites.length === 0 ? (
							<p className="px-1 text-xs text-gray-400">Nobody has picked a favourite yet.</p>
						) : (
							<Wall label="Favourite umas, most picked first" entries={favourites} />
						)}
					</Panel>
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
function highestFirst(rows: Array<{ name: string; people: number }>) {
	const reversed = [...rows].reverse()
	return [...reversed.filter((row) => row.name !== "None"), ...reversed.filter((row) => row.name === "None")]
}

type Selector = PlayersRankingsPayload["selectors"][number]

/**
 * The campaign selectors: the first one anyone plans to buy in front, with
 * its top picks as pictures, and the rest behind "Show earlier". Which one is
 * on sale comes from the server in step 4; until then this says "planned",
 * never "on sale".
 */
function Selectors({ selectors, catalogue }: { selectors: Selector[]; catalogue: PvpCatalogueIndex }) {
	const [earlier, setEarlier] = useState(false)
	const front = selectors.find((selector) => selector.buyers > 0) ?? null
	const rest = selectors.filter((selector) => selector !== front && selector.buyers > 0)
	return (
		<Panel title="Campaign selectors" hint={front ? `${front.label} · ${front.campaign}` : undefined}>
			{front === null ? (
				<p className="px-1 text-xs text-gray-400">Nobody plans to buy a campaign selector yet.</p>
			) : (
				<>
					<SelectorPicks selector={front} catalogue={catalogue} />
					<p className="px-1 text-xs text-gray-300">
						{plural(front.buyers, "player")} {front.buyers === 1 ? "plans" : "plan"} to buy it; {front.picked.toLocaleString()}{" "}
						{front.picked === 1 ? "has" : "have"} picked.
					</p>
					{rest.length > 0 && (
						<button type="button" aria-expanded={earlier} onClick={() => setEarlier(!earlier)} className="self-start px-1 text-[11px] text-brand transition hover:text-brand/75">
							{earlier ? "Hide the others" : `Show earlier (${rest.length})`}
						</button>
					)}
					{earlier &&
						rest.map((selector) => (
							<div key={`${selector.campaign}-${selector.label}`} className="flex flex-col gap-1.5 border-t border-edge px-1 pt-2">
								<span className="text-xs font-semibold text-gray-100">
									{selector.label} <span className="font-normal text-gray-400">· {selector.campaign}</span>
								</span>
								<SelectorPicks selector={selector} catalogue={catalogue} />
								<span className="text-[11px] tabular-nums text-gray-400">
									{plural(selector.buyers, "buyer")}, {selector.picked.toLocaleString()} picked
								</span>
							</div>
						))}
				</>
			)}
		</Panel>
	)
}

/** A selector's top picks as chips: the uma's portrait or the card's art, the name, and how many picked it. */
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
							<span className="text-[11px] tabular-nums text-gray-400">{pick.people.toLocaleString()} picked</span>
						</span>
					</li>
				)
			})}
		</ul>
	)
}
