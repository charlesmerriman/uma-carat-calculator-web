/**
 * The Rankings page's Players tab (`?view=players`): how the site's players
 * play, from the admin analytics among accounts that use the calculator
 * (staff out): favourite umas, Team Trials class and club rank, the income
 * options they turn on, and the campaign selectors they plan to buy and what
 * they plan to take with them. Counts, with the share beside them.
 */

import { Loader2 } from "lucide-react"
import type { PlayersRankingsPayload } from "../../types/rankingsTabs"
import { useRankingsPayload } from "../../hooks/useRankingsPayload"
import { usePvpCatalogue, type PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { FramedUma } from "../FramedUma"
import { formatDate } from "../../utils/dateFormat"
import { formatTimeAgo } from "../../utils/relativeDate"
import { formatShare } from "../../utils/guideRankings"
import { RankList } from "./RankList"

const PANEL_NOTE = "rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300"
const CELL = "px-2 py-1.5 text-right tabular-nums"

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
	const oshiIds = useOshiIds()
	const favourites = payload.favourites.filter((row) => catalogue.umasById.has(row.uma))
	return (
		<div className="flex flex-col gap-4">
			<p className="text-xs text-gray-400">
				From the {payload.engaged.toLocaleString()} players who use the calculator with an account.{" "}
				<time dateTime={payload.generated_at} title={formatDate(payload.generated_at)}>
					Updated {formatTimeAgo(payload.generated_at)}.
				</time>
			</p>
			<div className="grid items-start gap-4 @4xl:grid-cols-2">
				<RankList
					title="Favourite umas"
					hint="Players who picked her as a favourite on their account."
					empty="Nobody has picked a favourite yet."
					rows={favourites.map((row, index) => {
						const uma = catalogue.umasById.get(row.uma)
						return {
							key: row.uma,
							place: index + 1,
							name: uma?.name ?? "Unknown uma",
							art: <FramedUma src={uma?.portrait ?? uma?.image} oshi={oshiIds.has(row.uma)} className="w-full" />,
							counts: `${row.people.toLocaleString()} ${row.people === 1 ? "player" : "players"} · ${formatShare(row.people / payload.engaged)}`,
							details: [],
						}
					})}
				/>
				<div className="flex flex-col gap-4">
					{payload.ranks.map((rank) => (
						<Panel key={rank.label} title={rank.label} hint={`Of the ${rank.people.toLocaleString()} players who set it.`}>
							<Table
								headers={["Rank", "Players", "Share"]}
								rows={rank.rows.map((row) => [row.name, row.people.toLocaleString(), formatShare(rank.people ? row.people / rank.people : 0)])}
							/>
						</Panel>
					))}
				</div>
				<Panel title="Income options" hint="Players with each option on in the calculator.">
					<Table
						headers={["Option", "Players", "Share"]}
						rows={payload.income.map((row) => [row.label, row.people.toLocaleString(), formatShare(payload.engaged ? row.people / payload.engaged : 0)])}
					/>
				</Panel>
				<Panel title="Campaign selectors" hint="Players planning to buy each selector, and what they plan to take with it.">
					{payload.selectors.length === 0 ? (
						<p className="text-sm text-gray-400">No campaign selectors yet.</p>
					) : (
						<ul className="flex flex-col divide-y divide-gray-700/70">
							{payload.selectors.map((selector) => (
								<li key={`${selector.campaign}-${selector.label}`} className="flex flex-col gap-1 py-2">
									<span className="text-sm font-semibold text-gray-100">
										{selector.label} <span className="font-normal text-gray-400">· {selector.campaign}</span>
									</span>
									<span className="text-xs tabular-nums text-gray-400">
										{selector.buyers.toLocaleString()} {selector.buyers === 1 ? "buyer" : "buyers"}, {selector.picked.toLocaleString()} picked
									</span>
									{selector.top.length > 0 && (
										<span className="text-xs text-gray-300">
											{selector.top
												.map((pick) => {
													const name = pick.uma !== undefined ? catalogue.umasById.get(pick.uma)?.name : catalogue.cardsById.get(pick.card ?? -1)?.name
													return name ? `${name} ${pick.people.toLocaleString()}` : null
												})
												.filter(Boolean)
												.join(" · ")}
										</span>
									)}
								</li>
							))}
						</ul>
					)}
				</Panel>
			</div>
		</div>
	)
}

function Panel({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
	return (
		<section className="card-panel flex min-w-0 flex-col gap-3 p-3 sm:p-4" aria-label={title}>
			<div className="flex flex-col gap-0.5">
				<h2 className="font-display text-base font-bold text-brand">{title}</h2>
				<p className="text-xs text-gray-400">{hint}</p>
			</div>
			{children}
		</section>
	)
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
	return (
		<table className="w-full text-sm">
			<thead className="text-xs text-gray-400">
				<tr className="border-b border-gray-700">
					{headers.map((header, index) => (
						<th key={header} scope="col" className={index === 0 ? "px-2 py-1.5 text-left font-semibold" : `${CELL} font-semibold`}>
							{header}
						</th>
					))}
				</tr>
			</thead>
			<tbody className="divide-y divide-gray-700/70 text-gray-200">
				{rows.map((row) => (
					<tr key={row[0]}>
						{row.map((cell, index) =>
							index === 0 ? (
								<th key={index} scope="row" className="px-2 py-1.5 text-left font-normal">{cell}</th>
							) : (
								<td key={index} className={CELL}>{cell}</td>
							)
						)}
					</tr>
				))}
			</tbody>
		</table>
	)
}
