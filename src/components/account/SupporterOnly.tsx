import type { ReactNode } from "react"
import { useHasBenefit } from "../../hooks/useHasBenefit"

/**
 * The one paywall boundary component.
 *
 * Every supporter-gated piece of UI goes through this, so every boundary looks
 * the same and the rule behind them changes in one place. Keyed on a benefit
 * from `account.supporter.benefits` — never on a tier — for the reasons in
 * useHasBenefit.
 *
 *   <SupporterOnly benefit="ad_free" fallback={<AdSlot />}>
 *     {null}
 *   </SupporterOnly>
 *
 * `fallback` is what non-supporters (and everyone, while the account is still
 * loading) see. Default null: the gated thing simply is not there.
 *
 * This is a CLIENT gate and spoofable; it decides what is drawn, not what is
 * allowed. Anything that must actually be enforced is enforced by the API.
 */
interface SupporterOnlyProps {
	benefit: string
	fallback?: ReactNode
	children: ReactNode
}

export const SupporterOnly = ({ benefit, fallback = null, children }: SupporterOnlyProps) => {
	const hasBenefit = useHasBenefit(benefit)
	return <>{hasBenefit ? children : fallback}</>
}
