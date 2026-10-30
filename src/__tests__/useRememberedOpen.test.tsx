import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useRememberedOpen } from "../hooks/useRememberedOpen"
import { incomeStartsOpenOnPhone } from "../utils/incomePanel"
import type { UserStats } from "../types"

function Panel({ rememberAs, startOpen = false }: { rememberAs: string | null; startOpen?: boolean | (() => boolean) }) {
	const [open, setOpen] = useRememberedOpen(rememberAs, startOpen)
	return <button onClick={() => setOpen((isOpen) => !isOpen)}>{open ? "open" : "closed"}</button>
}

describe("useRememberedOpen", () => {
	it("starts on its default", () => {
		render(<Panel rememberAs="a" startOpen={() => true} />)
		expect(screen.getByRole("button").textContent).toBe("open")
	})

	it("keeps a toggle through a page change", () => {
		const { unmount } = render(<Panel rememberAs="a" />)
		fireEvent.click(screen.getByRole("button"))
		unmount()
		render(<Panel rememberAs="a" />)
		expect(screen.getByRole("button").textContent).toBe("open")
	})

	it("beats the default once the reader has chosen", () => {
		const { unmount } = render(<Panel rememberAs="a" startOpen />)
		fireEvent.click(screen.getByRole("button"))
		unmount()
		render(<Panel rememberAs="a" startOpen />)
		expect(screen.getByRole("button").textContent).toBe("closed")
	})

	it("keeps each panel to itself", () => {
		const { unmount } = render(<Panel rememberAs="a" />)
		fireEvent.click(screen.getByRole("button"))
		unmount()
		render(<Panel rememberAs="b" />)
		expect(screen.getByRole("button").textContent).toBe("closed")
	})

	it("remembers nothing without a key", () => {
		const { unmount } = render(<Panel rememberAs={null} />)
		fireEvent.click(screen.getByRole("button"))
		unmount()
		render(<Panel rememberAs={null} />)
		expect(screen.getByRole("button").textContent).toBe("closed")
	})
})

describe("the Income panel on a phone", () => {
	const stats = (ranks: Partial<UserStats>) =>
		({ club_rank: null, team_trials_rank: null, champions_meeting_rank: null, league_of_heroes_rank: null, ...ranks }) as UserStats

	it("starts open for a player with no ranks picked", () => {
		expect(incomeStartsOpenOnPhone(stats({}))).toBe(true)
	})

	it("starts closed once any rank is picked", () => {
		expect(incomeStartsOpenOnPhone(stats({ club_rank: 3 }))).toBe(false)
		expect(incomeStartsOpenOnPhone(stats({ league_of_heroes_rank: 1 }))).toBe(false)
	})
})
