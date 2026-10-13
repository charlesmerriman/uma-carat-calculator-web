import { useEffect, useState } from "react"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import { TeamNotes } from "../components/pvp/TeamNotes"
import type { PvpNote } from "../types/pvpTeam"

/**
 * Sticky notes: Add opens one, the pen and Escape, a blank note goes on close,
 * the eraser and its Undo, the cap of ten, the 1000 limit, red highlights and
 * kept line breaks.
 */

vi.mock("sonner", () => ({ toast: vi.fn() }))
const mockedToast = vi.mocked(toast)

let current: PvpNote[] = []
function Harness({ initial }: { initial: PvpNote[] }) {
	const [notes, setNotes] = useState(initial)
	useEffect(() => {
		current = notes
	}, [notes])
	return <TeamNotes notes={notes} onChange={setNotes} />
}

const note = (text: string, color: PvpNote["color"] = "yellow"): PvpNote => ({ text, color })

beforeEach(() => {
	mockedToast.mockReset()
	current = []
})

describe("TeamNotes", () => {
	it("adds a yellow note already open for writing", () => {
		render(<Harness initial={[]} />)
		fireEvent.click(screen.getByRole("button", { name: "Add note" }))
		const area = screen.getByRole("textbox", { name: "Note" })
		expect(area).toHaveFocus()
		expect(area).toHaveAttribute("maxLength", "1000")
		fireEvent.change(area, { target: { value: "Pull Kitasan" } })
		fireEvent.click(screen.getByRole("button", { name: "Pink" }))
		fireEvent.click(screen.getByRole("button", { name: "Done" }))
		expect(current).toEqual([note("Pull Kitasan", "pink")])
		expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
	})

	it("removes a note closed while blank", () => {
		render(<Harness initial={[]} />)
		fireEvent.click(screen.getByRole("button", { name: "Add note" }))
		fireEvent.keyDown(screen.getByRole("textbox", { name: "Note" }), { key: "Escape" })
		expect(current).toEqual([])
	})

	it("opens with the pen and closes with Escape, keeping the text", () => {
		render(<Harness initial={[note("first")]} />)
		fireEvent.click(screen.getByRole("button", { name: "Write in note" }))
		fireEvent.change(screen.getByRole("textbox", { name: "Note" }), { target: { value: "first, edited" } })
		fireEvent.keyDown(screen.getByRole("textbox", { name: "Note" }), { key: "Escape" })
		expect(current).toEqual([note("first, edited")])
	})

	it("erases at once and Undo puts it back in its place", () => {
		render(<Harness initial={[note("a"), note("b"), note("c")]} />)
		fireEvent.click(screen.getAllByRole("button", { name: "Erase note" })[1])
		expect(current.map((n) => n.text)).toEqual(["a", "c"])
		expect(mockedToast).toHaveBeenCalledWith("Note erased", expect.objectContaining({ action: expect.anything() }))
		const options = mockedToast.mock.calls[0][1] as unknown as { action: { onClick: () => void } }
		act(() => options.action.onClick())
		expect(current.map((n) => n.text)).toEqual(["a", "b", "c"])
	})

	it("stops at ten", () => {
		render(<Harness initial={Array.from({ length: 10 }, (_, i) => note(`n${i}`))} />)
		expect(screen.getByRole("button", { name: "Add note" })).toBeDisabled()
		expect(screen.getByText("(10 of 10)")).toBeInTheDocument()
	})

	it("shows ==words== in red and keeps line breaks", () => {
		render(<Harness initial={[note("Take ==Groundwork==\nthen rest")]} />)
		const list = within(screen.getByRole("list"))
		expect(list.getByText("Groundwork").tagName).toBe("MARK")
		const paragraph = list.getByText("Groundwork").closest("p")
		expect(paragraph?.textContent).toBe("Take Groundwork\nthen rest")
		expect(paragraph).toHaveClass("whitespace-pre-wrap")
	})

	it("can be switched off until there is a team", () => {
		render(<TeamNotes notes={[]} onChange={() => {}} disabledReason="Pick an uma first to start a team" />)
		expect(screen.getByRole("button", { name: "Add note" })).toBeDisabled()
	})
})
