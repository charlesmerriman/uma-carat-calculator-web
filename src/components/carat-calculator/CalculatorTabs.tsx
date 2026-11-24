/**
 * The Calculator screen's own bar: Calculator, Selectors and the Pull Plan
 * Library (owner, 2026-11-24). It replaced the Library button that sat in the
 * Plans bar and the navbar's Selectors tab.
 *
 * The bar itself is the shared ScreenTabs (components/ScreenTabs.tsx, which
 * carries the why of its markup, where it mounts and how it sticks). This file
 * is the Calculator screen's part: which pages this reader gets, and their
 * icons. It reads only the account, which is safe above AppShell's loading
 * gate: unknown at build time and while it loads, so the Library tab (early
 * access) joins after load.
 */

import { Calculator as CalculatorIcon, Sparkles, Users, type LucideIcon } from "lucide-react"
import { useAccount } from "../../services/AuthContext"
import { ScreenTabs } from "../ScreenTabs"
import { calculatorTabsFor, type CalculatorTab } from "./calculatorTabs"

const ICONS: Record<CalculatorTab["to"], LucideIcon> = {
	"/app": CalculatorIcon,
	"/app/selectors": Sparkles,
	"/app/plans": Users,
}

export function CalculatorTabs() {
	const { account } = useAccount()
	const tabs = calculatorTabsFor({ earlyAccess: Boolean(account?.early_access) })
	return <ScreenTabs label="Calculator" tabs={tabs.map((tab) => ({ ...tab, icon: ICONS[tab.to] }))} />
}
