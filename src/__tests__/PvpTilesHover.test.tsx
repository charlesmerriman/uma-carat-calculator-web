import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { InlineNote, SkillChip, UmaTile } from "../components/pvp/PvpTiles"
import { SkillMentionsContext } from "../components/pvp/skillMentionsContext"
import type { PvpSkillRef } from "../types/pvpGuide"

/**
 * A [[mention]] inside a tile or chip that has a hover detail opens no popup
 * of its own: Tailwind's group-hover opened every popup nested in a hovered
 * tile at once (2026-11-02). The detail lists the mentioned skills at its
 * bottom instead. jsdom has no hover, so the tests count the popups in the
 * DOM: each is always there, faded out until hovered.
 */

const skill = (overrides: Partial<PvpSkillRef> = {}): PvpSkillRef => ({
	id: 1, name: "Dominator", description: "Decrease velocity of runners ahead.", image: null, rarity: 1, unique_of: null,
	version: "○ white", tier: 1, is_evolved: false, versions: [], ...overrides,
})

const ESCAPADES = skill({ id: 2, name: "564 Escapades", description: "Slightly increase velocity.", unique_of: "Gold Ship (Summer)" })
const MOXIE = skill({ id: 3, name: "Moxie", description: "Slightly reduce fatigue on an uphill." })
const MENTIONS: Record<string, PvpSkillRef> = { "564 escapades": ESCAPADES, moxie: MOXIE }

function inGuide(node: ReactNode) {
	const auth = { isLoggedIn: true, status: "ready", account: { guide_editor: false, oshi_uma_ids: [] } } as unknown as AuthContextType
	return (
		<AuthContext.Provider value={auth}>
			<SkillMentionsContext.Provider value={MENTIONS}>{node}</SkillMentionsContext.Provider>
		</AuthContext.Provider>
	)
}

describe("hover details in a guide", () => {
	it("gives a mention in plain text its own popup", () => {
		render(inGuide(<InlineNote text="Pair it with [[Moxie]]." />))
		expect(screen.getAllByRole("tooltip")).toHaveLength(1)
		expect(screen.getByRole("tooltip")).toHaveTextContent("Slightly reduce fatigue on an uphill.")
	})

	it("opens one popup for a chip whose note names a skill, and lists the skill at its bottom", () => {
		render(inGuide(<SkillChip skill={skill()} note="with [[564 Escapades]]" />))
		// The chip's own, and nothing from the mention on its face or in its detail.
		const [detail, ...others] = screen.getAllByRole("tooltip")
		expect(others).toHaveLength(0)
		expect(detail).toHaveTextContent("564 Escapades (Gold Ship (Summer))Slightly increase velocity.")
	})

	it("lists each skill an uma's note names once, in the note's order", () => {
		render(inGuide(
			<UmaTile uma={{ id: 9, name: "Oguri Cap (Christmas)", image: null }} stars={0} role="" note="Activate [[Moxie]] with [[564 Escapades]], then [[Moxie]] again" />
		))
		const [detail, ...others] = screen.getAllByRole("tooltip")
		expect(others).toHaveLength(0)
		expect(detail).toHaveTextContent("MoxieSlightly reduce fatigue on an uphill.564 Escapades (Gold Ship (Summer))Slightly increase velocity.")
		expect(detail.textContent?.match(/Slightly reduce fatigue/g)).toHaveLength(1)
	})

	it("leaves out the skill a chip is about when its note names itself", () => {
		render(inGuide(<SkillChip skill={MOXIE} note="Take [[Moxie]] early" />))
		expect(screen.getByRole("tooltip").textContent?.match(/Slightly reduce fatigue/g)).toHaveLength(1)
	})
})
