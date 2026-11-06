/**
 * The course map's layers in the block (CourseSection, CourseLayersMenu):
 * the open skill row lights its zones, the zones are fetched only once a layer
 * needs them, the Layers menu is off by default and asks a guest to sign in.
 */
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import CourseLayersMenu from "../components/course/CourseLayersMenu"
import CourseSection from "../components/course/CourseSection"
import { setAccelsOpen, setCourseFocus, setCourseLayers, useVeteranPicks } from "../services/courseMapStore"
import { TestQueryProvider } from "../test/TestQueryProvider"
import type { SkillZoneMap } from "../utils/courseLayers"
import { CHUKYO_1200 } from "./courseFixtures"

const ZONES: SkillZoneMap = {
	"88": { kind: "place", zones: [{ start: 550, end: 788, kind: "random" }], styles: ["front"] },
}

afterEach(() => {
	act(() => {
		setCourseFocus(null)
		setAccelsOpen(false)
	})
	vi.restoreAllMocks()
})

/**
 * The accels column's two fetches: the course's skill zones (three accels
 * listed, one too early to list; on the Speed list 89 and three speed skills,
 * one worth nothing here) and the catalogue, where 89 is Seiun Sky's unique
 * and 90 its inherited white.
 */
function mockAccelFetch() {
	vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
		if (String(input).includes("/skill-zones")) {
			return new Response(JSON.stringify({
				"88": { kind: "place", zones: [{ start: 550, end: 788, kind: "random" }], styles: ["front"],
					effects: ["accel"], spread: [550, 788], spurt: { from: -250, to: -12, useful: 0.096 } },
				"89": { kind: "place", zones: [{ start: 800, end: 1200, kind: "fixed" }], styles: null,
					effects: ["accel", "speed"], fires_at: 800, spurt: { from: 0, to: 0, useful: 1.2, accel: 0.85, carry: 0.35 },
					carry_window: [740, 791], carry_speed: 0.35, carry_seconds: 3.2,
					speed_kind: "target", speed_rank: { useful: 0.35, speed: 0, carry: 0.35, accelerating: 1 } },
				"90": { kind: "place", zones: [{ start: 800, end: 1200, kind: "fixed" }], styles: null,
					effects: ["accel"], fires_at: 800, spurt: { from: 0, to: 0, useful: 0.6 } },
				// Fires 250 m early: no use at the spurt start, so not listed.
				"91": { kind: "place", zones: [{ start: 550, end: 1200, kind: "fixed" }], styles: null,
					effects: ["accel"], fires_at: 550, spurt: { from: -250, to: -250, useful: 0 } },
				// Speed skills: the final straight, a quarter of it while speeding up...
				"92": { kind: "place", zones: [{ start: 788, end: 1200, kind: "random" }], styles: null, effects: ["speed"],
					spread: [788, 1200], spurt: { from: -12, to: 400 }, speed_kind: "target",
					speed_rank: { useful: 0.26, speed: 0.26, carry: 0, accelerating: 0.25 } },
				// ...Uma Stan, with no place on the course, at full strength...
				"93": { kind: "anywhere", zones: [], styles: null, effects: ["speed"], speed_kind: "target",
					speed_rank: { useful: 0.15, speed: 0.15, carry: 0 } },
				// ...one raising current speed at the late-race start, uncut...
				"94": { kind: "place", zones: [{ start: 800, end: 1200, kind: "fixed" }], styles: null, effects: ["speed"],
					fires_at: 800, spurt: { from: 0, to: 0 }, speed_kind: "current", speed_rank: { useful: 0.55, speed: 0.55, carry: 0 } },
				// ...and a target-speed one there, worth nothing: not listed.
				"95": { kind: "place", zones: [{ start: 800, end: 1200, kind: "fixed" }], styles: null, effects: ["speed"],
					fires_at: 800, spurt: { from: 0, to: 0 }, speed_kind: "target",
					speed_rank: { useful: 0, speed: 0, carry: 0, accelerating: 1 } },
			}))
		}
		const skill = (id: number, name: string, rarity = 1) => ({ id, name, description: "", image: null, rarity, tier: 1, group_id: id, cost: 100 })
		return new Response(JSON.stringify({
			umas: [{ id: 1, name: "Seiun Sky", portrait: null, skills: [{ skill: 89, source: "unique", level: 1 }] }],
			support_cards: [],
			// 90 is the unique's inherited white: the same name.
			skills: [skill(88, "Final Push"), skill(89, "Angling and Scheming", 5), skill(90, "Angling and Scheming"), skill(91, "Red Shift"),
				skill(92, "Homestretch Haste"), skill(93, "Uma Stan"), skill(94, "Sublimated Thunder"), skill(95, "Late Charger")],
		}))
	})
}

describe("the course map's layers", () => {
	it("fetches nothing until a layer needs the zones", () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch")
		render(<CourseSection course={CHUKYO_1200} />, { wrapper: TestQueryProvider })
		expect(fetchSpy).not.toHaveBeenCalled()
	})

	it("lights the open skill row's zones, with the legend", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(ZONES)))
		const { container } = render(<CourseSection course={CHUKYO_1200} />, { wrapper: TestQueryProvider })
		act(() => setCourseFocus({ skillId: 88, name: "Final Push" }))
		await waitFor(() => expect(container.querySelector('[data-band="layers"]')).not.toBeNull())
		const layers = within(container.querySelector('[data-band="layers"]') as HTMLElement)
		expect(layers.getAllByText("Final Push").length).toBeGreaterThan(0)
		expect(screen.getByRole("list", { name: "Layer legend" })).toBeInTheDocument()
	})

	it("names each lit skill under the track, a hover target that lights its bar on the strip", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
			new Response(JSON.stringify(String(input).includes("/skill-zones") ? ZONES : { shape: null })))
		const { container } = render(<CourseSection course={CHUKYO_1200} />, { wrapper: TestQueryProvider })
		fireEvent.click(screen.getByRole("button", { name: "Both" }))
		act(() => setCourseFocus({ skillId: 88, name: "Final Push", image: "/skills/push.png" }))
		const legend = within(await screen.findByRole("list", { name: "Lit skills" }))
		const item = legend.getByText("Final Push")
		expect(item.querySelector("img")).toHaveAttribute("src", "/skills/push.png")
		fireEvent.mouseEnter(item)
		await waitFor(() => expect(container.querySelectorAll('[data-band="layers"] [data-previewed="true"]')).toHaveLength(1))
		fireEvent.mouseLeave(item)
		await waitFor(() => expect(container.querySelectorAll('[data-band="layers"] [data-previewed]')).toHaveLength(0))
	})

	it("keeps what the pointer is on in place when lighting from below grows the block (the hover loop, 2026-11-04)", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(ZONES)))
		// The block's bottom: 300 when the store changes, 400 once the lit rows are in.
		let measured = 0
		const rect = (bottom: number) => ({ x: 0, y: 0, top: 0, left: 0, right: 0, width: 0, height: bottom, bottom, toJSON: () => ({}) }) as DOMRect
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
			if (this.id !== "course-map") return rect(0)
			measured += 1
			return rect(measured === 1 ? 300 : 400)
		})
		const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {})
		render(<CourseSection course={CHUKYO_1200} />, { wrapper: TestQueryProvider })
		// A chip under the block: the pointer sits below its bottom.
		fireEvent.mouseMove(window, { clientY: 800 })
		act(() => setCourseFocus({ skillId: 88, name: "Final Push" }))
		await waitFor(() => expect(scrollBy).toHaveBeenCalledWith(0, 100))
		// Nothing moves for a pointer above the block (the accels column, the menu).
		scrollBy.mockClear()
		measured = 0
		fireEvent.mouseMove(window, { clientY: 100 })
		act(() => setCourseFocus(null))
		await waitFor(() => expect(screen.queryByRole("list", { name: "Layer legend" })).toBeNull())
		expect(scrollBy).not.toHaveBeenCalled()
	})

	it("lists the accels useful at the spurt start, most useful first, and lights one on a tap", async () => {
		mockAccelFetch()
		const { container } = render(<CourseSection course={CHUKYO_1200} />, { wrapper: TestQueryProvider })
		// The Accels button is in the bar and, for a phone, under the headline: one column either way.
		fireEvent.click(screen.getAllByRole("button", { name: "Accels" })[0])
		expect(screen.getAllByRole("complementary", { name: "Accels that land at the spurt" })).toHaveLength(1)
		const list = within(await screen.findByRole("list", { name: "Accels on this course" }))
		const rows = list.getAllByRole("button")
		expect(rows).toHaveLength(3)
		expect(screen.getByText("3 here")).toBeInTheDocument()
		expect(rows[0]).toHaveTextContent("Angling and Scheming")
		expect(rows[0]).toHaveTextContent("unique of Seiun Sky")
		expect(rows[0]).toHaveTextContent("Fires as the late race starts")
		// The rank's two parts, and the carry in the game's terms (owner, 2026-11-04).
		expect(rows[0]).toHaveTextContent("Accel 0.85")
		expect(rows[0]).toHaveTextContent("Carry 0.35")
		expect(rows[0]).toHaveTextContent("+0.35 m/s into the late race for 3.2 s")
		expect(rows[1]).not.toHaveTextContent("Carry")
		expect(rows[1]).toHaveTextContent("inherited from Seiun Sky")
		// "All" says whose style a style-gated accel is.
		expect(rows[2]).toHaveTextContent("Final Push · Front")
		expect(rows[2]).toHaveTextContent("At a random point 12m to 250m before the late race starts")
		fireEvent.click(screen.getByRole("button", { name: "Pace" }))
		await waitFor(() => expect(list.getAllByRole("button")).toHaveLength(2))
		fireEvent.click(screen.getByRole("button", { name: "All" }))
		await waitFor(() => expect(list.getAllByRole("button")).toHaveLength(3))
		fireEvent.click(list.getAllByRole("button")[2])
		await waitFor(() => expect(container.querySelector('[data-band="layers"]')).not.toBeNull())
		expect(within(container.querySelector('[data-band="layers"]') as HTMLElement).getAllByText("Final Push").length).toBeGreaterThan(0)
		// The lit skill's verdict card beside the headline, with its first line.
		const card = within(screen.getByLabelText("Final Push on this course"))
		expect(card.getByText("At a random point 12m to 250m before the late race starts")).toBeInTheDocument()
		fireEvent.click(card.getByRole("button", { name: "Unlight this skill" }))
		await waitFor(() => expect(screen.queryByLabelText("Final Push on this course")).toBeNull())
	})

	it("searches the accels by skill name and by the owner uma's name", async () => {
		mockAccelFetch()
		render(<CourseSection course={CHUKYO_1200} />, { wrapper: TestQueryProvider })
		fireEvent.click(screen.getAllByRole("button", { name: "Accels" })[0])
		const list = within(await screen.findByRole("list", { name: "Accels on this course" }))
		const search = screen.getByRole("searchbox", { name: "Search the accels" })
		// Her name finds her unique and its inherited white, in rank order.
		fireEvent.change(search, { target: { value: "SEIUN" } })
		await waitFor(() => expect(list.getAllByRole("button")).toHaveLength(2))
		expect(screen.getByText("2 here")).toBeInTheDocument()
		expect(list.getAllByRole("button")[1]).toHaveTextContent("inherited from Seiun Sky")
		fireEvent.change(search, { target: { value: "push" } })
		await waitFor(() => expect(list.getAllByRole("button")).toHaveLength(1))
		expect(list.getByRole("button")).toHaveTextContent("Final Push")
		// Red Shift fires too early to be listed, so the search can't find it.
		fireEvent.change(search, { target: { value: "red shift" } })
		expect(await screen.findByText("No skill here matches that.")).toBeInTheDocument()
		expect(screen.getByText("0 here")).toBeInTheDocument()
		// The search holds across a style pill.
		fireEvent.change(search, { target: { value: "push" } })
		fireEvent.click(screen.getByRole("button", { name: "Pace" }))
		expect(await screen.findByText("No skill here matches that.")).toBeInTheDocument()
	})

	it("switches to the speed skills, ranked by the API's speed score", async () => {
		mockAccelFetch()
		render(<CourseSection course={CHUKYO_1200} />, { wrapper: TestQueryProvider })
		fireEvent.click(screen.getAllByRole("button", { name: "Accels" })[0])
		await screen.findByRole("list", { name: "Accels on this course" })
		const lists = within(screen.getByRole("group", { name: "Which skills" }))
		expect(lists.getByRole("button", { name: "Accels" })).toHaveAttribute("aria-pressed", "true")
		fireEvent.click(lists.getByRole("button", { name: "Speed" }))
		// The title follows the switch.
		expect(screen.getByRole("complementary", { name: "Speed skills on this course" })).toBeInTheDocument()
		const list = within(await screen.findByRole("list", { name: "Speed skills on this course" }))
		const rows = list.getAllByRole("button")
		expect(rows.map((row) => row.textContent?.split(/unique|inherited|Fires|At a|Not tied/)[0])).toEqual([
			"Sublimated Thunder", "Angling and Scheming", "Homestretch Haste", "Uma Stan",
		])
		expect(screen.getByText("4 here")).toBeInTheDocument()
		// Current speed says why it takes no cut; the carry keeps its chip and words.
		expect(rows[0]).toHaveTextContent("Speed 0.55")
		expect(rows[0]).toHaveTextContent("Raises current speed")
		expect(rows[1]).toHaveTextContent("Carry 0.35")
		expect(rows[1]).toHaveTextContent("+0.35 m/s into the late race for 3.2 s")
		expect(rows[1]).toHaveTextContent("Always fires while still speeding up")
		expect(rows[2]).toHaveTextContent("Fires while still speeding up 25% of the time")
		expect(rows[3]).toHaveTextContent("Not tied to a place on the course")
		// The search works on this list too.
		fireEvent.change(screen.getByRole("searchbox", { name: "Search the speed skills" }), { target: { value: "stan" } })
		await waitFor(() => expect(list.getAllByRole("button")).toHaveLength(1))
	})

	it("ticks each veteran and each of her skills that can fire here", () => {
		act(() => setCourseLayers({ veterans: true }))
		render(
			<CourseLayersMenu signedIn veteransNote={null} veterans={[{
				veteranId: 7, name: "Oguri Cap (Christmas)", head: null, shown: true, colour: "var(--color-course-vet-3)",
				skills: [{ skillId: 1, name: "Swinging Maestro", shown: false }, { skillId: 2, name: "Encroaching Shadow", shown: true }],
			}]} />,
		)
		fireEvent.click(screen.getByRole("button", { name: "Layers" }))
		expect(screen.getByRole("checkbox", { name: "Oguri Cap (Christmas)" })).toBeChecked()
		// Her colour on the map, as a swatch beside her name.
		expect((document.querySelector("[data-swatch]") as HTMLElement).style.background).toBe("var(--color-course-vet-3)")
		const skills = within(screen.getByRole("list", { name: "Oguri Cap (Christmas)'s skills" }))
		expect(skills.getByRole("checkbox", { name: "Encroaching Shadow" })).toBeChecked()
		fireEvent.click(skills.getByRole("checkbox", { name: "Swinging Maestro" }))
		fireEvent.click(screen.getByRole("checkbox", { name: "Oguri Cap (Christmas)" }))
		const { result } = renderHook(() => useVeteranPicks())
		expect(result.current).toEqual({ veterans: { 7: false }, skills: { "7:1": true } })
		act(() => setCourseLayers({ veterans: false }))
	})

	it("offers the veterans' layer off by default, and asks a guest to sign in", () => {
		render(<CourseSection course={CHUKYO_1200} />, { wrapper: TestQueryProvider })
		fireEvent.click(screen.getByRole("button", { name: "Layers" }))
		const box = screen.getByRole("checkbox", { name: /My veterans' skills/ })
		expect(box).not.toBeChecked()
		expect(box).toBeDisabled()
		expect(screen.getByText("Sign in to show your team's veterans.")).toBeInTheDocument()
	})
})
