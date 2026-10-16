import { describe, expect, it } from "vitest"
import { isPublicId, sharedPlanLinkPath, sharedPlanPath } from "../utils/appRoutes"

// The client's half of the share id's shape. The server's is
// calculatorapi/public_ids.py: 8 letters or digits.
describe("isPublicId", () => {
	it.each(["AbCd1234", "00000000", "zzzzZZZZ"])("accepts %s", (id) => {
		expect(isPublicId(id)).toBe(true)
	})

	it.each([undefined, "", "AbCd123", "AbCd12345", "AbCd-123", "abc_defg", "legend-races"])(
		"rejects %s",
		(segment) => {
			expect(isPublicId(segment)).toBe(false)
		}
	)

	it("would accept an eight-letter tab, which is why the router ranks the tabs first", () => {
		expect(isPublicId("timeline")).toBe(true)
	})
})

describe("sharedPlanPath", () => {
	it("is the app route the link opens", () => {
		expect(sharedPlanPath("AbCd1234")).toBe("/app/AbCd1234")
	})
})

describe("sharedPlanLinkPath", () => {
	it("is the API-served link with the preview, not the app route", () => {
		expect(sharedPlanLinkPath("AbCd1234")).toBe("/plan/AbCd1234")
	})
})
