/**
 * The Calculator screen's header: Calculator, Selectors and the Pull Plan
 * Library (owner, 2026-11-24). It replaced the Library button that sat in the
 * Plans bar and the navbar's Selectors tab.
 *
 * The header itself is the shared ScreenHeader (components/ScreenHeader.tsx,
 * which carries the why of its markup, where it mounts and how it sticks). This
 * file is the Calculator screen's part: which pages this reader gets, their
 * icons and the title. It reads only the account, which is safe
 * above AppShell's loading gate: unknown at build time and while it loads, so
 * the Library tab (early access) joins after load.
 */

import { Calculator as CalculatorIcon, Sparkles, Users, type LucideIcon } from "lucide-react"
import { useAccount } from "../../services/AuthContext"
import { ScreenHeader } from "../ScreenHeader"
import { calculatorTabsFor, type CalculatorTab } from "./calculatorTabs"

const ICONS: Record<CalculatorTab["to"], LucideIcon> = {
	"/app": CalculatorIcon,
	"/app/selectors": Sparkles,
	"/app/plans": Users,
}

/** Selectors and the Library have their own <h1>; the calculator's is the header's. */
const OWN_HEADING: ReadonlySet<CalculatorTab["to"]> = new Set(["/app/selectors", "/app/plans"])

export function CalculatorTabs() {
	const { account } = useAccount()
	const tabs = calculatorTabsFor({ earlyAccess: Boolean(account?.early_access) })
	return (
		<ScreenHeader
			kind="links"
			title="Calculator"
			icon={CalculatorIcon}
			label="Calculator"
			// 94rem: the calculator's panels sit 1rem inside a 96rem box (CaratCalculator,
			// `max-w-[96rem]` then `sm:mx-4`), so this keeps the header on their edges.
			column="max-w-[94rem]"
			tabs={tabs.map((tab) => ({ ...tab, icon: ICONS[tab.to], ownHeading: OWN_HEADING.has(tab.to) }))}
		/>
	)
}
