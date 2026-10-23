import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SkillDetail } from "../components/pvp/SkillDetail"
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

const skill = (overrides: Partial<PvpSkillRef> = {}): PvpSkillRef => ({
	id: 1, name: "Xceleration", description: "Increase velocity late.", image: null, rarity: 1, unique_of: null,
	version: "○ white", tier: 1, is_evolved: false, versions: [], ...overrides,
})

describe("SkillDetail", () => {
	it("reads when it fires and what it does, with unconfirmed code as code", () => {
		const { container } = render(<SkillDetail skill={skill({ readable: READABLE })} />)
		expect(container).toHaveTextContent("Only after: On the final corner or later")
		expect(container).toHaveTextContent(
			"When: In 3rd place or lower, and one of: (Within 1 length of the runner ahead) or (is_overtake==1)"
		)
		expect(container).toHaveTextContent("Does: Velocity +0.35 m/s for 5 s, once per race")
		expect(container).toHaveTextContent("Rolls against Wit before it fires.")
		expect(screen.getByText("is_overtake==1").tagName).toBe("CODE")
	})

	it("names where a player gets it, global first, and counts the rest", () => {
		const { container } = render(<SkillDetail skill={skill({
			sources: {
				umas: [{ name: "Special Week", source: "evolved", level: 3, on_global: true }], uma_count: 1,
				cards: [{ name: "Kitasan Black", source: "hint", on_global: false }], card_count: 12,
			},
		})} />)
		expect(container).toHaveTextContent("Umas: Special Week (evolution, level 3)")
		expect(container).toHaveTextContent("Cards: Kitasan Black (hint, JP), +11 more")
	})

	it("tags a JP-only skill and credits UmaTL for its text", () => {
		render(<SkillDetail skill={skill({ availability: "jp", uses_translation: true })} />)
		expect(screen.getByText("JP only")).toBeInTheDocument()
		expect(screen.getByText("English text: UmaTL fan translation.")).toBeInTheDocument()
	})

	it("says nothing extra for a global skill with its own text", () => {
		const { container } = render(<SkillDetail skill={skill({ availability: "global", uses_translation: false })} />)
		expect(container).not.toHaveTextContent("JP only")
		expect(container).not.toHaveTextContent("UmaTL")
	})
})
