/**
 * The Timeline race card's "Your rewards" panel: what this Champions Meeting or
 * League of Heroes pays the player at the finish they picked, one box per
 * payout day (owner, 2026-10-29: it fills the space under Course details and
 * puts a number next to the "Taking part" switch).
 *
 * The numbers come from hooks/useRaceRewards, which reads the same split and
 * the same bounds as the projection (utils/incomeLedger raceRewardSchedule),
 * so this panel and the planner rows can't disagree.
 */

import { Check, Gift } from "lucide-react"
import { formatDate } from "../../utils/dateFormat"
import type { RaceRewards as RaceRewardsData } from "../../hooks/useRaceRewards"

/** "5 uma, 5 support": the parts the rank pays, zeros left out. */
function itemParts(parts: [number, string][]): string {
	return parts
		.filter(([count]) => count > 0)
		.map(([count, label]) => `${count} ${label}`)
		.join(", ")
}

export function RaceRewards({ rewards }: { rewards: RaceRewardsData }) {
	const { days, total, tickets, shards, rankName, counted } = rewards
	return (
		<section className="card-panel p-3">
			<div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
				<div className="flex items-center gap-2 text-sm font-semibold text-brand">
					<Gift className="h-4 w-4" />
					<span>Your rewards</span>
				</div>
				<p className="text-sm text-gray-300" title="From the finish you picked in your income settings">
					<span className={`font-semibold ${counted ? "text-gray-50" : "text-gray-400"}`}>
						{total.toLocaleString()}
					</span>{" "}
					{counted ? `carats as ${rankName}` : "carats left out"}
				</p>
			</div>

			{/*
			 * Three to a row on a phone; from sm up, one row with a column per
			 * payout (5 for a CM, 8 for an LoH), however many the ledger has.
			 */}
			<ol
				className={`grid grid-cols-3 gap-2 sm:grid-flow-col sm:grid-cols-none sm:auto-cols-fr ${counted ? "" : "opacity-60"}`}
				aria-label="Carats by payout day"
			>
				{days.map((day) => (
					<li
						key={day.at}
						className={`min-w-0 rounded-lg border border-gray-600/80 bg-gray-700/70 px-2 py-2 ${day.paid ? "opacity-50" : ""}`}
						title={day.paid ? "Already paid, so it's in the balance you entered" : undefined}
					>
						<div className="flex items-center gap-1 truncate text-xs font-semibold tracking-wide text-gray-400">
							{day.paid && <Check className="h-3 w-3 shrink-0" aria-label="Paid" />}
							<span className="truncate">{formatDate(day.at)}</span>
						</div>
						<div className="mt-1 truncate text-[15px] leading-snug font-semibold text-gray-50">
							+{day.carats.toLocaleString()}
						</div>
					</li>
				))}
			</ol>

			{(tickets || shards) && (
				<p className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-300 ${counted ? "" : "opacity-60"}`}>
					{tickets && (
						<span>
							Tickets:{" "}
							<span className="font-semibold text-gray-100">
								{itemParts([[tickets.uma, "uma"], [tickets.support, "support"]])}
							</span>{" "}
							on {formatDate(tickets.at)}
						</span>
					)}
					{shards && (
						<span>
							Shards:{" "}
							<span className="font-semibold text-gray-100">
								{itemParts([[shards.ssr, "SSR"], [shards.sr, "SR"]])}
							</span>{" "}
							on {formatDate(shards.at)}
						</span>
					)}
				</p>
			)}
		</section>
	)
}
