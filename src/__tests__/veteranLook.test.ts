import { describe, expect, it } from "vitest"
import { splitOutfit, tileLines } from "../utils/veteranLook"

/** A veteran tile's two lines (components/collection/VeteranList.tsx). */

const veteran = (extra: { label?: string; memo?: string; trained_at?: string | null } = {}) => ({
	label: "", memo: "", trained_at: "2026-08-26T12:00:00Z", ...extra,
})

describe("a veteran tile's lines", () => {
	it("splits an alt outfit off the name, and keeps a plain name whole", () => {
		expect(splitOutfit("TM Opera O (New Year)")).toEqual({ name: "TM Opera O", outfit: "New Year" })
		expect(splitOutfit("Oguri Cap")).toEqual({ name: "Oguri Cap", outfit: null })
	})

	it("leads with her label, else her game memo, the uma under it", () => {
		expect(tileLines(veteran({ label: "Ace", memo: "Dirt Pare" }), "Taiki Shuttle")).toEqual({ title: "Ace", sub: "Taiki Shuttle" })
		expect(tileLines(veteran({ memo: "Dirt Pare" }), "Taiki Shuttle")).toEqual({ title: "Dirt Pare", sub: "Taiki Shuttle" })
	})

	it("otherwise names the uma, then her outfit and when she was trained", () => {
		expect(tileLines(veteran(), "TM Opera O (New Year)")).toEqual({ title: "TM Opera O", sub: "New Year · 2026/8/26" })
		expect(tileLines(veteran(), "Oguri Cap")).toEqual({ title: "Oguri Cap", sub: "Trained 2026/8/26" })
		expect(tileLines(veteran({ trained_at: null }), "Oguri Cap")).toEqual({ title: "Oguri Cap", sub: "Entered by hand" })
	})
})
