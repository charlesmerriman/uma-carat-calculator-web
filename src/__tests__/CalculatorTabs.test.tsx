/**
 * The Calculator screen's bar (carat-calculator/CalculatorTabs.tsx): which
 * pages it offers to whom, which one is lit, and which paths count as the
 * screen (the navbar's Calculator tab and AppShell both ask).
 */

import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { CalculatorTabs } from "../components/carat-calculator/CalculatorTabs"
import { isCalculatorScreen } from "../components/carat-calculator/calculatorTabs"

function renderTabs(path: string, earlyAccess: boolean) {
	const auth = {
		isLoggedIn: true, status: "ready", isSupporter: earlyAccess, refresh: vi.fn(), signOut: vi.fn(),
		account: { display_name: "Me", early_access: earlyAccess, oshis: [], oshi_slots: 1, oshi_uma_ids: [] },
	} as unknown as AuthContextType
	render(
		<AuthContext.Provider value={auth}>
			<MemoryRouter initialEntries={[path]}>
				<CalculatorTabs />
			</MemoryRouter>
		</AuthContext.Provider>
	)
	return within(screen.getByRole("navigation", { name: "Calculator" }))
}

describe("CalculatorTabs", () => {
	it("offers the calculator and Selectors to everyone", () => {
		const bar = renderTabs("/app", false)
		expect(bar.getByRole("link", { name: "Calculator" })).toHaveAttribute("href", "/app")
		expect(bar.getByRole("link", { name: "Selectors" })).toHaveAttribute("href", "/app/selectors")
		expect(bar.queryByRole("link", { name: "Pull Plan Library" })).toBeNull()
	})

	it("adds the Pull Plan Library with early access", () => {
		const bar = renderTabs("/app", true)
		expect(bar.getByRole("link", { name: "Pull Plan Library" })).toHaveAttribute("href", "/app/plans")
	})

	it("lights the open page only, never the calculator on every page under /app", () => {
		const bar = renderTabs("/app/selectors", true)
		expect(bar.getByRole("link", { name: "Selectors" })).toHaveAttribute("aria-current", "page")
		expect(bar.getByRole("link", { name: "Calculator" })).not.toHaveAttribute("aria-current")
		expect(bar.getByRole("link", { name: "Pull Plan Library" })).not.toHaveAttribute("aria-current")
	})
})

describe("isCalculatorScreen", () => {
	it("is the calculator, Selectors and the Library, with or without a trailing slash", () => {
		for (const path of ["/app", "/app/", "/app/selectors", "/app/selectors/", "/app/plans"]) {
			expect(isCalculatorScreen(path), path).toBe(true)
		}
		for (const path of ["/app/timeline", "/app/pvp", "/app/Ab3dE6gH", "/", "/app/umas"]) {
			expect(isCalculatorScreen(path), path).toBe(false)
		}
	})
})
