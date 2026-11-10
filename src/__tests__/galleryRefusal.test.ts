/**
 * How a gallery refusal reads. A rate limit is DRF's own 429 with `detail`,
 * not the gallery's `error`, so it gets its own sentence with the wait in
 * minutes (a player once saw only "The gallery didn't load." for 40 minutes).
 */
import { describe, expect, it } from "vitest"
import { refusal, refusalText, throttledText } from "../services/galleryFetchCalls"

const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status })

describe("refusal", () => {
	it("reads the gallery's own sentence and field", async () => {
		const answer = await refusal(reply({ error: "Too long.", field: "caption" }, 400), "fallback")
		expect(answer).toEqual({ text: "Too long.", field: "caption" })
	})

	it("falls back when the body has no sentence", async () => {
		expect(await refusalText(reply({}, 500), "The gallery didn't load.")).toBe("The gallery didn't load.")
	})

	it("words a rate limit with the wait, rounded up to minutes", async () => {
		const throttled = reply({ detail: "Request was throttled. Expected available in 2100 seconds." }, 429)
		expect(await refusalText(throttled, "The gallery didn't load.")).toBe(
			"You've been busy in the gallery. Try again in about 35 minutes."
		)
	})
})

describe("throttledText", () => {
	it("never says zero minutes, and says one in the singular", () => {
		expect(throttledText("Expected available in 1 second.")).toMatch(/about 1 minute\.$/)
	})

	it("drops the number when the sentence has none", () => {
		expect(throttledText("Request was throttled.")).toBe(
			"You've been busy in the gallery. Give it a little while and try again."
		)
		expect(throttledText(undefined)).toMatch(/a little while/)
	})
})
