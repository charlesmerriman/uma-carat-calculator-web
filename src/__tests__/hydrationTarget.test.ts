// @vitest-environment node
import { describe, expect, it } from "vitest"
import { shouldHydrate } from "../hydrationTarget"

describe("shouldHydrate", () => {
	it.each([
		["/about", "/about", true],
		["/about", "/about/", true],
		["/", "/", true],
		["/app/timeline", "/app/timeline", true],
		["/", "/login", false], // the prerendered homepage served as a catch-all
		["/about", "/faq", false],
		[undefined, "/about", false], // the empty shell
	])("marker %s at %s → %s", (marker, pathname, expected) => {
		expect(shouldHydrate(marker, pathname)).toBe(expected)
	})
})
