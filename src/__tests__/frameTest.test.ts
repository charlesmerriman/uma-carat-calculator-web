import { afterEach, describe, expect, it } from "vitest"
import { applyFrameTest } from "../utils/frameTest"

/** Put a query string on the address bar, the way a tester's link would. */
function visit(search: string) {
	window.history.replaceState(null, "", `/app/encyclopedia${search}`)
}

describe("applyFrameTest", () => {
	afterEach(() => {
		sessionStorage.clear()
		delete document.documentElement.dataset.frameTest
		visit("")
	})

	it("does nothing for an ordinary visit", () => {
		visit("")
		applyFrameTest()
		expect(document.documentElement.dataset.frameTest).toBeUndefined()
	})

	it("turns a known variant on from the address", () => {
		visit("?frametest=clip")
		applyFrameTest()
		expect(document.documentElement.dataset.frameTest).toBe("clip")
	})

	it("keeps the variant for the tab once the address no longer carries it", () => {
		visit("?frametest=inset")
		applyFrameTest()
		delete document.documentElement.dataset.frameTest
		visit("")
		applyFrameTest()
		expect(document.documentElement.dataset.frameTest).toBe("inset")
	})

	it("turns off on ?frametest=off, and on a name it doesn't know", () => {
		for (const value of ["off", "nonsense"]) {
			visit("?frametest=clip")
			applyFrameTest()
			delete document.documentElement.dataset.frameTest
			visit(`?frametest=${value}`)
			applyFrameTest()
			expect(document.documentElement.dataset.frameTest).toBeUndefined()
			expect(sessionStorage.length).toBe(0)
		}
	})
})
