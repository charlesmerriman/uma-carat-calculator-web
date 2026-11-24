/**
 * The Calculator screen's pages (owner, 2026-11-24): the calculator itself,
 * Selectors and the Pull Plan Library, switched by the bar at the top of the
 * screen (CalculatorTabs.tsx). Plain data, so the navbar can ask "is this the
 * Calculator screen?" without importing a component.
 *
 * `gate` marks a page only some readers get. The Pull Plan Library is early
 * access until round 1's PR 5 opens it (notes/pull-plan-database-plan.md);
 * until then the bar draws it only for an account that has it, and the page
 * itself still refuses everyone else (CommunityPlansPage).
 */

export interface CalculatorTab {
	/** The route, which is also how the bar knows which page is open. */
	to: "/app" | "/app/selectors" | "/app/plans"
	label: string
	/** What a phone shows when the full label won't fit; the full one stays its name. */
	short?: string
	gate?: "earlyAccess"
}

export const CALCULATOR_TABS: readonly CalculatorTab[] = [
	{ to: "/app", label: "Calculator" },
	{ to: "/app/selectors", label: "Selectors" },
	{ to: "/app/plans", label: "Pull Plan Library", short: "Library", gate: "earlyAccess" },
]

/** The tabs this reader gets, in order. */
export function calculatorTabsFor({ earlyAccess }: { earlyAccess: boolean }): CalculatorTab[] {
	return CALCULATOR_TABS.filter((tab) => tab.gate !== "earlyAccess" || earlyAccess)
}

/**
 * Whether `pathname` is one of the screen's pages. The bare `/app/` counts
 * (AppShell treats it as the calculator too). The Library counts for everyone:
 * someone without early access who opens it still gets the bar, and the page
 * tells them it is for supporters first.
 */
export function isCalculatorScreen(pathname: string): boolean {
	const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
	return CALCULATOR_TABS.some((tab) => tab.to === path)
}
