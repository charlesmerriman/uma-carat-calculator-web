import { describe, expect, it } from "vitest"
import { formatPvpEvent, parsePvpEvent, pvpEventHref, refForRaceEvent, sameEvent } from "../utils/pvpEvent"
import type { RaceEvent } from "../types"

describe("pvpEvent", () => {
	it("round-trips a ref through the URL form", () => {
		expect(formatPvpEvent({ kind: "cm", id: 12 })).toBe("cm-12")
		expect(parsePvpEvent("loh-7")).toEqual({ kind: "loh", id: 7 })
		expect(pvpEventHref({ kind: "cm", id: 12 })).toBe("/app/pvp?event=cm-12")
	})

	it.each([null, undefined, "", "cm", "cm-", "cm-0", "cm-x", "gm-3", "cm-3-4", "CM-3"])(
		"rejects %s",
		(value) => expect(parsePvpEvent(value)).toBeNull()
	)

	it("maps the backend tag onto kind in one place", () => {
		expect(refForRaceEvent({ id: 4, event_type: "champions_meeting" } as RaceEvent)).toEqual({ kind: "cm", id: 4 })
		expect(refForRaceEvent({ id: 4, event_type: "league_of_heroes" } as RaceEvent)).toEqual({ kind: "loh", id: 4 })
	})

	it("compares refs by kind and id", () => {
		expect(sameEvent({ kind: "cm", id: 1 }, { kind: "cm", id: 1 })).toBe(true)
		expect(sameEvent({ kind: "cm", id: 1 }, { kind: "loh", id: 1 })).toBe(false)
		expect(sameEvent(null, { kind: "cm", id: 1 })).toBe(false)
	})
})
