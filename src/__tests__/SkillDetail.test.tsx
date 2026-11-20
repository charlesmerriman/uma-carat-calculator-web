import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { SkillDetail } from "../components/pvp/SkillDetail"
import { InsidePopupContext, PopupHoldContext } from "../components/pvp/hoverPopup"
import { TestQueryProvider } from "../test/TestQueryProvider"
import type { PvpSkillRef, SkillReadable } from "../types/pvpGuide"

/** The hover detail of a guide's skill: what the API's readable text and sources become. */

const READABLE: SkillReadable = {
	wit_check: true,
	complete: false,
	slots: [{
		after: { all: [{ text: "On the final corner or later", raw: false }], any: [] },
		when: {
			all: [{ text: "In 3rd place or lower", raw: false }],
			any: [[{ text: "Within 1 length of the runner ahead", raw: false }], [{ text: "is_overtake==1", raw: true }]],
		},
		effects: [{ text: "Velocity +0.35 m/s", raw: false }],
		duration: "5 s",
		cooldown: "Once per race",
	}],
}

/** On a guide the skills work shows to early access only (useSkillsPreview): supporters and staff first. */
function asEditor(node: ReactNode, editor = true) {
	const value = { isLoggedIn: true, status: "ready", account: { early_access: editor, oshi_uma_ids: [] } } as unknown as AuthContextType
	return <AuthContext.Provider value={value}>{node}</AuthContext.Provider>
}

const skill = (overrides: Partial<PvpSkillRef> = {}): PvpSkillRef => ({
	id: 1, name: "Xceleration", description: "Increase velocity late.", image: null, rarity: 1, unique_of: null,
	version: "○ white", tier: 1, is_evolved: false, versions: [], ...overrides,
})

describe("SkillDetail", () => {
	it("reads when it fires and what it does, with unconfirmed code as code", () => {
		const { container } = render(asEditor(<SkillDetail skill={skill({ readable: READABLE })} />))
		expect(container).toHaveTextContent("Only after: On the final corner or later")
		expect(container).toHaveTextContent(
			"When: In 3rd place or lower, and one of: (Within 1 length of the runner ahead) or (is_overtake==1)"
		)
		expect(container).toHaveTextContent("Does: Velocity +0.35 m/s")
		// How long it lasts, how often it fires and the Wit roll are chips under the rows.
		for (const chip of ["Lasts 5 s", "Once per race", "Rolls Wit check"]) expect(screen.getByText(chip)).toBeInTheDocument()
		expect(screen.getByText("is_overtake==1").tagName).toBe("CODE")
	})

	it("names a unique's owner on its inherited copy (Henry, 2026-11-19)", () => {
		const { container } = render(asEditor(<SkillDetail skill={skill({
			is_inherited: true,
			sources: { umas: [{ id: 12, name: "Seiun Sky", source: "inherited", level: null, on_global: true }], uma_count: 1, cards: [], card_count: 0 },
		})} />))
		expect(container).toHaveTextContent("Umas: Seiun Sky (inherited)")
	})

	it("turns a held popup into the card of a name clicked in it, with a way back (Henry, 2026-11-19)", () => {
		const hold = vi.fn()
		const sources = {
			umas: [{ id: 12, name: "Seiun Sky", source: "unique", level: 3, on_global: true }, { name: "No Id", source: "hint", level: null, on_global: true }],
			uma_count: 2, cards: [], card_count: 0,
		}
		render(asEditor(
			<TestQueryProvider>
				<InsidePopupContext.Provider value={true}>
					<PopupHoldContext.Provider value={hold}>
						<SkillDetail skill={skill({ name: "Angling and Scheming", sources })} />
					</PopupHoldContext.Provider>
				</InsidePopupContext.Provider>
			</TestQueryProvider>
		))
		// A name with an id is a button; one without stays words.
		expect(screen.queryByRole("button", { name: "No Id" })).toBeNull()
		fireEvent.click(screen.getByRole("button", { name: "Seiun Sky" }))
		expect(hold).toHaveBeenCalledTimes(1)
		// Her card in the popup (loading here: no catalogue in a test), under a row back to the skill.
		expect(screen.getByRole("status", { name: "Loading Seiun Sky" })).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Angling and Scheming" }))
		expect(screen.getByRole("button", { name: "Seiun Sky" })).toBeInTheDocument()
	})

	it("keeps plain names outside a popup that can hold (the screen reader's copy)", () => {
		render(asEditor(<SkillDetail skill={skill({
			sources: { umas: [{ id: 12, name: "Seiun Sky", source: "unique", level: 3, on_global: true }], uma_count: 1, cards: [], card_count: 0 },
		})} />))
		expect(screen.queryByRole("button", { name: "Seiun Sky" })).toBeNull()
	})

	it("names where a player gets it, global first, and counts the rest", () => {
		const { container } = render(asEditor(<SkillDetail skill={skill({
			sources: {
				umas: [{ name: "Special Week", source: "evolved", level: 3, on_global: true }], uma_count: 1,
				cards: [{ name: "Kitasan Black", source: "hint", on_global: false }], card_count: 12,
			},
		})} />))
		expect(container).toHaveTextContent("Umas: Special Week (evolution, level 3)")
		expect(container).toHaveTextContent("Cards: Kitasan Black (hint, JP), +11 more")
	})

	it("tags a JP-only skill and credits UmaTL for its text", () => {
		render(asEditor(<SkillDetail skill={skill({ availability: "jp", uses_translation: true })} />))
		expect(screen.getByText("JP only")).toBeInTheDocument()
		expect(screen.getByText("English text: UmaTL fan translation.")).toBeInTheDocument()
	})

	it("says nothing extra for a global skill with its own text", () => {
		const { container } = render(asEditor(<SkillDetail skill={skill({ availability: "global", uses_translation: false })} />))
		expect(container).not.toHaveTextContent("JP only")
		expect(container).not.toHaveTextContent("UmaTL")
	})

	it("shows a player without early access only what the card always showed", () => {
		const full = skill({ readable: READABLE, availability: "jp", uses_translation: true,
			sources: { umas: [{ name: "Special Week", source: "unique", level: null, on_global: true }], uma_count: 1, cards: [], card_count: 0 } })
		for (const node of [<SkillDetail skill={full} />, asEditor(<SkillDetail skill={full} />, false)]) {
			const { container, unmount } = render(node)
			expect(container).toHaveTextContent("Increase velocity late.")
			expect(container).not.toHaveTextContent("When:")
			expect(container).not.toHaveTextContent("Umas:")
			expect(container).not.toHaveTextContent("JP only")
			expect(container).not.toHaveTextContent("UmaTL")
			unmount()
		}
	})

	it("shows everyone the whole card when the Encyclopedia draws it", () => {
		// The Encyclopedia is public, so its skill rows pass `full`; a guide never does.
		const whole = skill({ readable: READABLE, availability: "jp", uses_translation: true,
			sources: { umas: [{ name: "Special Week", source: "unique", level: null, on_global: true }], uma_count: 1, cards: [], card_count: 0 } })
		const { container } = render(asEditor(<SkillDetail skill={whole} full />, false))
		expect(container).toHaveTextContent("When:")
		expect(container).toHaveTextContent("Umas:")
		expect(container).toHaveTextContent("JP only")
		expect(container).toHaveTextContent("UmaTL")
	})
})
