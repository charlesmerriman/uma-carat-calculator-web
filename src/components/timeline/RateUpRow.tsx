import { Link } from "react-router-dom"
import type { BannerSupport } from "../../types"
import { useCalculatorDataSafe } from "../../services/CalculatorContext"
import { timelineNamedRateUps } from "../../utils/bannerHelpers"
import { cardHref } from "../../utils/encyclopediaRoutes"
import { CARD_LINK_TITLE, hoverCardProps } from "../../utils/hoverCards"
import { formatRate } from "../../utils/oddsDisplay"
import { rateUpCards } from "../../utils/rateUpRates"

const RARITY = { 2: "SR", 1: "R" } as Record<number, string>

/**
 * The "Also on rate-up" row: the SRs and Rs a support banner lists under its
 * Timeline card rather than drawing (notes/banner-sr-r-plan.md; the owner's
 * pick on the 2026-11-20 canvas, kept on the 2026-11-27 one). Each one as its
 * rarity, its name and its rate, SRs first.
 *
 * It sits first in the strip beneath the card (StoryEventStrip's), outside
 * the card's panel, so it can never change the size of the art or the panels.
 * Which cards it lists is each card's `display` ("named"), which the API works
 * out; one row per banner that has any, named by its banner only when a card
 * groups more than one such banner.
 *
 * A name is a link to the card's Encyclopedia page carrying the card popup
 * every tile opens (hoverCardProps: a click on a computer opens it, a tap on
 * a phone follows the link, as the tiles do).
 */
export function RateUpRow({ banner, label }: { banner: BannerSupport; label: string | null }) {
	const data = useCalculatorDataSafe()
	const cards = timelineNamedRateUps(banner)
	if (cards.length === 0) return null
	// The planner's record of this banner carries its rate overrides and picks,
	// which the Timeline's nested copy doesn't; the rule is the odds' own.
	const full = data?.supportBannerData.find((row) => row.id === banner.id) ?? banner
	const rates = data
		? new Map(
				rateUpCards({ type: "Support", banner: full, timeline: full.banner_timeline }, data.calculationConstants).map(
					(card) => [card.id, card.rate]
				)
			)
		: new Map<number, number>()
	return (
		<section
			aria-label={label ? `Also on rate-up, ${label}` : "Also on rate-up"}
			className="tl-rate-ups flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2.5 sm:px-4"
		>
			<span data-size="xs" className="tl-pill shrink-0 border-brand/50 font-semibold uppercase tracking-wide text-brand">
				Also on rate-up
			</span>
			{label && <span className="text-sm font-semibold text-gray-200">{label}</span>}
			{cards.map((card) => {
				const rate = rates.get(card.id)
				return (
					<span key={card.id} className="text-sm whitespace-nowrap">
						<span className="font-semibold text-gray-300">{RARITY[card.rarity ?? 3] ?? "SSR"}</span>{" "}
						{card.game_id ? (
							<Link
								to={cardHref(card.game_id)}
								title={CARD_LINK_TITLE}
								{...hoverCardProps("card", card.id)}
								className="font-semibold text-gray-100 underline decoration-gray-500 underline-offset-2 hover:text-brand"
							>
								{card.name}
							</Link>
						) : (
							<span className="font-semibold text-gray-100">{card.name}</span>
						)}
						{rate !== undefined && <span className="text-gray-400"> {formatRate(rate)}</span>}
					</span>
				)
			})}
		</section>
	)
}
