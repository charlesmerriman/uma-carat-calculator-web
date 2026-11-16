import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { resetRememberedFilters, useHasRememberedFilters, useRememberedFilter } from "../hooks/useRememberedFilter"

const RARITIES = ["all", "ssr", "sr", "r"] as const
type Rarity = (typeof RARITIES)[number]

describe("useRememberedFilter", () => {
	it("keeps a filter after the list unmounts, as a trip to a card's page does", () => {
		const first = renderHook(() => useRememberedFilter<Rarity>("cards:rarity", "all", RARITIES))
		expect(first.result.current[0]).toBe("all")
		act(() => first.result.current[1]("ssr"))
		expect(first.result.current[0]).toBe("ssr")
		first.unmount()

		const back = renderHook(() => useRememberedFilter<Rarity>("cards:rarity", "all", RARITIES))
		expect(back.result.current[0]).toBe("ssr")
	})

	it("reads a stored value that is no longer a chip as the default", () => {
		sessionStorage.setItem("enc-filter:cards:rarity", "ur")
		const { result } = renderHook(() => useRememberedFilter<Rarity>("cards:rarity", "all", RARITIES))
		expect(result.current[0]).toBe("all")
	})

	it("stores nothing for the default, and remembers free text", () => {
		const { result } = renderHook(() => useRememberedFilter<string>("cards:query", ""))
		act(() => result.current[1]("kitasan"))
		expect(sessionStorage.getItem("enc-filter:cards:query")).toBe("kitasan")
		act(() => result.current[1](""))
		expect(sessionStorage.getItem("enc-filter:cards:query")).toBeNull()
	})

	it("resets one list's filters and leaves the other lists alone", () => {
		const rarity = renderHook(() => useRememberedFilter<Rarity>("cards:rarity", "all", RARITIES))
		const query = renderHook(() => useRememberedFilter<string>("cards:query", ""))
		const active = renderHook(() => useHasRememberedFilters("cards"))
		sessionStorage.setItem("enc-filter:umas:query", "oguri")
		expect(active.result.current).toBe(false)

		act(() => rarity.result.current[1]("sr"))
		act(() => query.result.current[1]("kitasan"))
		expect(active.result.current).toBe(true)

		act(() => resetRememberedFilters("cards"))
		expect(rarity.result.current[0]).toBe("all")
		expect(query.result.current[0]).toBe("")
		expect(active.result.current).toBe(false)
		expect(sessionStorage.getItem("enc-filter:umas:query")).toBe("oguri")
	})
})
