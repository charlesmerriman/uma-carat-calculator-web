import { act, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { EncyclopediaTabs } from "../components/encyclopedia/EncyclopediaTabs"
import { lettersFor } from "../utils/encyclopediaLetters"
import { reportCounts } from "../utils/encyclopediaCounts"

/** The lists' letter headings and the tabs' counts (notes/encyclopedia-redesign-plan.md). */

const names = (count: number) => Array.from({ length: count }, (_, index) => `${"ABC"[index % 3]} name ${index}`).sort()

describe("lettersFor", () => {
	it("cuts a full list in name order into runs of one letter", () => {
		const groups = lettersFor(names(60), (name) => name, true)
		expect(groups?.map((group) => [group.letter, group.items.length])).toEqual([["A", 20], ["B", 20], ["C", 20]])
	})

	it("keeps the order it is given, so a reversed list runs Z to A", () => {
		const groups = lettersFor([...names(60)].reverse(), (name) => name, true)
		expect(groups?.map((group) => group.letter)).toEqual(["C", "B", "A"])
	})

	it("files a name that doesn't start with a letter under #", () => {
		const list = ["#LookatCurren", "1st Place", ...names(60)]
		expect(lettersFor(list, (name) => name, true)?.[0]).toEqual({ letter: "#", items: ["#LookatCurren", "1st Place"] })
	})

	it("is nothing for a filtered, re-sorted or short list: that is one plain grid", () => {
		expect(lettersFor(names(60), (name) => name, false)).toBeNull()
		expect(lettersFor(names(12), (name) => name, true)).toBeNull()
	})
})

describe("the tabs' counts", () => {
	it("show a list's number once some page has counted it", () => {
		const auth = { isLoggedIn: true, status: "ready", account: { early_access: true } } as unknown as AuthContextType
		render(<AuthContext.Provider value={auth}><MemoryRouter><EncyclopediaTabs /></MemoryRouter></AuthContext.Provider>)
		expect(screen.getByRole("link", { name: "Skills" })).toBeInTheDocument()
		act(() => reportCounts({ skills: 2223, umas: 270 }))
		expect(screen.getByRole("link", { name: "2,223 Skills" })).toBeInTheDocument()
		expect(screen.getByRole("link", { name: "270 Umas" })).toBeInTheDocument()
		// Nobody has counted the cards yet, so that tab is its name alone.
		expect(screen.getByRole("link", { name: "Support cards" })).toBeInTheDocument()
	})
})
