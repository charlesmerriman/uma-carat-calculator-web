import type { BannerStepUp, BannerSupport, BannerUma, UserStepUpSelection } from "../../types"
import type { PlannedBannerTarget } from "../../utils/bannerHelpers"
import { formatDate } from "../../utils/dateFormat"
import {
	effectiveSelections,
	findGuaranteedCardArt,
	selectionsForStepUp,
	stepUpPool
} from "../../utils/stepUpSelection"
import { buildEligibleCardCatalogue } from "../../hooks/useEligibleCardCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { FramedUma } from "../FramedUma"
import { ExtraCardsBadge } from "./ExtraCardsBadge"

/**
 * The card whose art a step-up row should show: the step 5 pick.
 *
 * An untouched step-up falls back to the DEFAULT selection's target — the most
 * recently available card — read through the same `effectiveSelections` seam the
 * picker and the campaign card use, so all three always agree about what the
 * user is looking at.
 *
 * Module-level and un-memoized on purpose. The React Compiler memoizes the call
 * for us; a manual useMemo here could not be preserved (and building the
 * catalogue through useEligibleCardCatalogue instead would mean flattening and
 * sorting the whole uma catalogue on every uma and support row too, since a hook
 * cannot be skipped for the rows that do not need it).
 */
function resolveGuaranteedCard(
	stepUp: BannerStepUp,
	allSelections: UserStepUpSelection[],
	umaBannerData: BannerUma[],
	supportBannerData: BannerSupport[]
) {
	const catalogue = buildEligibleCardCatalogue({
		pool: stepUp.card_type === "uma" ? "uma" : "support",
		jpCutoffDate: stepUp.jp_cutoff_date,
		umaBannerData,
		supportBannerData,
	})
	return findGuaranteedCardArt(
		effectiveSelections(
			selectionsForStepUp(allSelections, stepUp.id),
			stepUp,
			catalogue
		),
		umaBannerData,
		supportBannerData
	)
}

/**
 * A planner row's card art: the first two featured umas (framed) or cards and
 * a "+N" for the rest, or on a step-up the step 5 pick, falling back to the
 * campaign art and then to the pool chip, so the cell is never blank before the
 * art is uploaded.
 *
 * Shared by BannerRow (both layouts) and the share picture, so the picture
 * shows exactly the art the sheet does. Images only: the caller decides whether
 * the cell links anywhere.
 */
export function BannerArt({ target, userStepUpSelectionData, umaBannerData, supportBannerData }: {
	target: PlannedBannerTarget
	userStepUpSelectionData: UserStepUpSelection[]
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
}) {
	// The person's favorite umas, drawn in the rainbow frame (FramedUma).
	const oshiIds = useOshiIds()

	if (target.type === "StepUp") {
		const pool = stepUpPool(target)
		const guaranteedCard = resolveGuaranteedCard(
			target.banner,
			userStepUpSelectionData,
			umaBannerData,
			supportBannerData
		)
		if (guaranteedCard?.uma) {
			return (
				<FramedUma
					src={guaranteedCard.uma.portrait ?? guaranteedCard.image}
					alt={guaranteedCard.name}
					oshi={oshiIds.has(guaranteedCard.uma.id)}
					title={`Guaranteed at step 5: ${guaranteedCard.name}`}
					className="w-14"
				/>
			)
		}
		if (guaranteedCard) {
			return (
				<img
					src={guaranteedCard.image}
					alt={guaranteedCard.name}
					className="thumb-banner"
					title={`Guaranteed at step 5: ${guaranteedCard.name}`}
				/>
			)
		}
		if (target.banner.image) {
			return <img src={target.banner.image} alt={target.banner.name} className="thumb-banner" title={pool?.hint} />
		}
		// Typographic fallback. The cutoff rides with it because this chip is
		// exactly the statement it qualifies: "★3 cards, released by this date".
		return (
			<div title={pool?.hint} className="flex flex-col items-center justify-center leading-none">
				<span className="step-up-pool-chip text-sm font-bold text-step-up">{pool?.chip}</span>
				{pool?.cutoff && <span className="mt-0.5 text-[9px] text-gray-400">≤ {formatDate(pool.cutoff)}</span>}
			</div>
		)
	}

	// A step-up has no featured cards (the player picks their own from the back
	// catalogue), and an empty row has none yet.
	const images =
		target.type === "Uma" ? target.banner.umas : target.type === "Support" ? target.banner.support_cards : []
	return (
		<>
			{target.type === "Uma"
				? target.banner.umas.slice(0, 2).map((uma) => (
						<FramedUma
							key={uma.id}
							src={uma.portrait ?? uma.image}
							alt={uma.name}
							oshi={oshiIds.has(uma.id)}
							className="w-14"
						/>
					))
				: images.slice(0, 2).map((img) => (
						<img key={img.name} src={img.image} alt={img.name} className="thumb-banner" />
					))}
			<ExtraCardsBadge hidden={images.length - 2} />
		</>
	)
}
