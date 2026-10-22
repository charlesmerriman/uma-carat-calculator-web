import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { CopyTimelineLink } from "../components/timeline/CopyTimelineLink"
import { parseTimelineFocus } from "../utils/timelineFocus"

// `toast` is called as a function (the fallback) AND has `.success`.
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn() }) }))

const setClipboard = (writeText: (text: string) => Promise<void>) =>
	Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })

describe("CopyTimelineLink", () => {
	beforeEach(() => vi.clearAllMocks())

	it("copies the Timeline's own deep link to the card", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined)
		setClipboard(writeText)
		render(<CopyTimelineLink focus={{ kind: "cm", id: 12 }} name="Taurus Cup" />)

		await userEvent.click(screen.getByRole("button", { name: "Copy link to Taurus Cup" }))

		const url = `${window.location.origin}/app/timeline?focus=cm-12`
		expect(writeText).toHaveBeenCalledWith(url)
		// The link round-trips through the parser the Timeline reads it with.
		expect(parseTimelineFocus(new URL(url).searchParams.get("focus"))).toEqual({ kind: "cm", id: 12 })
		expect(toast.success).toHaveBeenCalledWith("Link copied.")
	})

	it("shows the link to copy by hand when the clipboard is refused", async () => {
		setClipboard(vi.fn().mockRejectedValue(new Error("denied")))
		render(<CopyTimelineLink focus={{ kind: "banner", id: 3 }} name="Special Week" />)

		await userEvent.click(screen.getByRole("button", { name: /copy link/i }))

		await waitFor(() =>
			expect(toast).toHaveBeenCalledWith(`${window.location.origin}/app/timeline?focus=banner-3`)
		)
		expect(toast.success).not.toHaveBeenCalled()
	})
})
