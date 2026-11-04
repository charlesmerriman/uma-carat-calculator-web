import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { InlineNote, SkillChip, UmaTile } from "../components/pvp/PvpTiles"
import { SkillMentionsContext } from "../components/pvp/skillMentionsContext"
import { useCourseFocus } from "../services/courseMapStore"
import type { PvpSkillRef } from "../types/pvpGuide"

/**
 * A [[mention]] inside a tile or chip that has a hover detail opens no popup
 * of its own: Tailwind's group-hover opened every popup nested in a hovered
 * tile at once (2026-11-02). The detail lists the mentioned skills at its
 * bottom instead. The first block counts the screen reader's copies (one
 * per tile, always in the DOM); the second drives the drawn popup, which is
 * a portal on <body> mounted only while open.
 */

/** The drawn popup: Floating UI's portal node on <body>, or null while closed. */
const drawnPopup = () => document.querySelector("[data-floating-ui-portal]")

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

/** What the course map would light: the focus store's skill and owner. */
function FocusProbe() {
	const focus = useCourseFocus()
	return <output data-testid="focus">{focus ? `${focus.skillId}:${focus.owner?.name ?? ""}` : "none"}</output>
}

describe("an uma's tile and her unique", () => {
	it("lights her unique on the course map while hovered, naming it as the detail when she has no note", async () => {
		const user = userEvent.setup()
		const uma = { id: 9, name: "Maruzensky", image: null, unique: { id: 210, name: "Lead the Pack", image: null } }
		render(inGuide(<><UmaTile uma={uma} stars={0} role="" note="" /><FocusProbe /></>))
		expect(screen.getByRole("tooltip")).toHaveTextContent("Unique: Lead the Pack")
		expect(screen.getByTestId("focus")).toHaveTextContent("none")
		const tile = screen.getByRole("group", { name: "Maruzensky" })
		await user.hover(tile)
		await waitFor(() => expect(screen.getByTestId("focus")).toHaveTextContent("210:Maruzensky"))
		await user.unhover(tile)
		await waitFor(() => expect(screen.getByTestId("focus")).toHaveTextContent("none"))
	})

	it("has no hover at all for an uma with neither a note nor a unique", () => {
		render(inGuide(<UmaTile uma={{ id: 9, name: "Oguri Cap", image: null }} stars={0} role="" note="" />))
		expect(screen.queryByRole("tooltip")).toBeNull()
	})
})

describe("the drawn popup", () => {
	it("opens on <body> on hover, outside the tile's own box, and closes when the pointer leaves", async () => {
		const user = userEvent.setup()
		render(inGuide(<SkillChip skill={skill()} note="" />))
		const chip = screen.getByRole("group", { name: "Dominator" })
		expect(drawnPopup()).toBeNull()

		await user.hover(chip)
		await waitFor(() => expect(drawnPopup()).toHaveTextContent("Decrease velocity of runners ahead."))
		// Outside the chip, so no column or card box above it can clip or cover it.
		expect(chip.contains(drawnPopup())).toBe(false)

		await user.unhover(chip)
		await waitFor(() => expect(drawnPopup()).toBeNull())
	})

	it("opens on a tap on a touch screen, and Escape closes it", async () => {
		const user = userEvent.setup()
		render(inGuide(<InlineNote text="Pair it with [[Moxie]]." />))
		const mention = screen.getByRole("group", { name: "Moxie" })

		await user.pointer({ keys: "[TouchA]", target: mention })
		await waitFor(() => expect(drawnPopup()).toHaveTextContent("Slightly reduce fatigue on an uphill."))

		await user.keyboard("{Escape}")
		await waitFor(() => expect(drawnPopup()).toBeNull())
	})
})
