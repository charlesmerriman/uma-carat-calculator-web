/**
 * An opened plan post's income block, when its author ticked "Include my
 * income" at posting: "<name>'s income, as set when this was posted".
 *
 * WHAT IT SHOWS, AND FROM WHAT
 * ----------------------------
 * The post carries the author's ranks and income settings and nothing else
 * (backend plan_gallery.POSTED_INCOME_FIELDS, the fields the Average Monthly
 * Income tiles read). Never a balance: no carats, tickets, crystals or shards.
 *
 * The five "average a month" figures come from the SAME engine as the
 * Calculator's tiles (useAverageMonthlyIncome), fed those fields and the
 * site's own constants as a parameter (income-engine.md: one engine, constants
 * never a module import). So the author's numbers here are exactly what their
 * own tiles showed for the same settings on the same day.
 *
 * The engine takes a whole UserStats. The posted fields are laid over the
 * viewer's own block only to fill the shape: every field the engine reads is
 * in the posted set (a backend test pins every GameStats field to a side), so
 * nothing of the viewer's reaches a figure. The ledger is the FULL one, not the
 * projection's: the viewer's skipped races are theirs, and the author's skips
 * were never posted.
 */

import type { ReactNode } from "react"
import { Carrot, Sparkles, Star, Ticket } from "lucide-react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { useAverageMonthlyIncome } from "../../hooks/useAverageMonthlyIncome"
import { miscEarningsMonthly, shopTicketsPerMonth } from "../../utils/cumulativeIncome"
import type { PostedIncome as PostedIncomeFields } from "../../types/gallery"
import type { UserStats } from "../../types"

const ICON = "h-4 w-4 shrink-0 text-brand"
const HEADING = "text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400"
const CHIP = "rounded-md border border-gray-700 bg-gray-900/70 px-2 py-0.5 text-xs text-gray-200"

const onOff = (value: boolean): string => (value ? "on" : "off")

export function PostedIncome({ income, authorName }: { income: PostedIncomeFields; authorName: string }) {
	const {
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		fullIncomeLedger,
		calculationConstants,
	} = useCalculatorData()

	// The posted fields over a block of the right shape. See the header.
	const stats = userStatsData ? ({ ...userStatsData, ...income } satisfies UserStats) : null
	const monthly = useAverageMonthlyIncome({
		userStatsData: stats,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		incomeLedger: fullIncomeLedger,
		constants: calculationConstants,
	})

	const figures: Array<{ label: string; value: number; icon: ReactNode }> = [
		{ label: "Carats", value: monthly.carats, icon: <Carrot className={ICON} /> },
		{ label: "Uma Tickets", value: monthly.umaTickets, icon: <Ticket className={ICON} /> },
		{ label: "Support Tickets", value: monthly.supportTickets, icon: <Ticket className={ICON} /> },
		{ label: "SSR Shards", value: monthly.ssrShards, icon: <Star className={ICON} /> },
		{ label: "SR Shards", value: monthly.srShards, icon: <Sparkles className={ICON} /> },
	]

	// A rank the author never picked is left out, not shown as "none".
	const rankName = (list: Array<{ id: number; name: string }>, id: number | null): string | undefined =>
		list.find((rank) => rank.id === id)?.name
	const ranks = [
		["Team Trials", rankName(teamTrialsRankData, income.team_trials_rank)],
		["Club", rankName(clubRankData, income.club_rank)],
		["Champions Meeting", rankName(championsMeetingRankData, income.champions_meeting_rank)],
		["League of Heroes", rankName(leagueOfHeroesRankData, income.league_of_heroes_rank)],
	].filter((pair): pair is [string, string] => pair[1] !== undefined)

	const k = calculationConstants
	const shopOn = income.monthly_shop_tickets !== false
	const settings = [
		`Daily Carat Pack: ${onOff(income.daily_carat)}`,
		`Training Pass: ${onOff(income.training_pass)}`,
		income.misc_earnings
			? `Misc earnings: ${miscEarningsMonthly(income.custom_misc_earnings_monthly, k).toLocaleString()} a month`
			: "Misc earnings: off",
		shopOn
			? `Monthly shop tickets: ${shopTicketsPerMonth(income.shop_uma_tickets_bought, k.monthly_shop_uma_tickets, k.monthly_shop_uma_tickets_max)} uma, ${shopTicketsPerMonth(income.shop_support_tickets_bought, k.monthly_shop_support_tickets, k.monthly_shop_support_tickets_max)} support`
			: "Monthly shop tickets: off",
	]

	return (
		<section className="rounded-xl border border-gray-700 bg-gray-800/50 p-3 sm:p-4" aria-label={`${authorName}'s income`}>
			<h3 className="text-sm font-semibold text-gray-100">{authorName}'s income, as set when this was posted</h3>
			<p className={`${HEADING} mt-2`}>Average a month</p>
			<div className="mt-1.5 grid grid-cols-2 overflow-hidden rounded-lg border border-gray-700 sm:grid-cols-5">
				{figures.map((figure) => (
					<div
						key={figure.label}
						className="flex flex-col items-center justify-center gap-1 border-b border-r border-gray-700 bg-gray-900 px-2 py-2 sm:border-b-0 sm:last:border-r-0"
					>
						<span className="text-center text-xs leading-tight text-gray-400">{figure.label}</span>
						<span className="flex items-center gap-1.5">
							{figure.icon}
							<span className="text-lg font-bold text-gray-100">{figure.value.toLocaleString()}</span>
						</span>
					</div>
				))}
			</div>
			{ranks.length > 0 && (
				<>
					<p className={`${HEADING} mt-3`}>Ranks</p>
					<ul className="mt-1.5 flex flex-wrap gap-1.5">
						{ranks.map(([label, name]) => (
							<li key={label} className={CHIP}>
								{label}: {name}
							</li>
						))}
					</ul>
				</>
			)}
			<p className={`${HEADING} mt-3`}>Income settings</p>
			<ul className="mt-1.5 flex flex-wrap gap-1.5">
				{settings.map((setting) => (
					<li key={setting} className={CHIP}>
						{setting}
					</li>
				))}
			</ul>
			<p className="mt-3 text-xs text-gray-400">
				Their carats, tickets and crystals are never shown. Your max below still uses your own.
			</p>
		</section>
	)
}
