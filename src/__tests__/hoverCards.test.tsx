/**
 * The uma and support card hover cards (notes/uma-card-hover-plan.md): the
 * helpers that build and read a tile's attributes and a card's columns, the
 * two cards drawn from a page, and the one layer that opens them on a click
 * of any tile with `data-hover-card`, for early access only and never on touch.
 */

import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Link, MemoryRouter, useLocation } from "react-router-dom"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { TestQueryProvider } from "../test/TestQueryProvider"
import { UmaHoverCard } from "../components/hovercards/UmaHoverCard"
import { CardHoverCard } from "../components/hovercards/CardHoverCard"
import { HoverCardLayer } from "../components/hovercards/HoverCardLayer"
import { SupportTile, UmaTile } from "../components/pvp/PvpTiles"
import { effectAt, effectColumns, hoverCardProps, pageDrawsHoverCards, parseHoverCard, parseRing, statRow } from "../utils/hoverCards"
import type { CardEffect, CardPageData, PageSkill, UmaPageData } from "../types/encyclopedia"

const CATALOGUE = {
	umas: [{ id: 1, name: "Special Week", game_id: 100101, image: null, portrait: null }],
	support_cards: [
		{ id: 4, name: "Kitasan Black", game_id: 30028, image: null, card_type: "speed", rarity: 3, title: "[Fire at My Heels]" },
		{ id: 11, name: "Your best SSR Speed card", game_id: 31000, placeholder: true, image: null, card_type: "speed", rarity: 3, title: "" },
	],
	skills: [],
}
vi.mock("../services/pvpTeamFetchCalls", () => ({ loadPvpCatalogue: () => Promise.resolve(CATALOGUE) }))

const skill = (id: number, name: string, source: string, level: number | null = null): PageSkill =>
	({ id, game_id: 200000 + id, name, image: null, rarity: 1, source, level, evolves_from: null }) as unknown as PageSkill

const SPECIAL_WEEK = {
	id: 1, game_id: 100101, name: "Special Week", title: "[Special Dreamer]", colours: ["#EE6DCB", "#FFDEF9"],
	portrait: null, image: null, rarity: 3, running_style: 3, on_global: true, uses_translation: false,
	apt: { turf: 7, dirt: 1, short: 2, mile: 5, medium: 7, long: 7, front: 1, pace: 7, late: 7, end: 5 },
	base: { speed: 83, stamina: 88, power: 98, guts: 90, wit: 91 },
	growth: { speed: 0, stamina: 20, power: 0, guts: 0, wit: 10 },
	star_stats: [
		{ star: 3, speed: 83, stamina: 88, power: 98, guts: 90, wit: 91 },
		{ star: 5, speed: 103, stamina: 108, power: 118, guts: 110, wit: 111 },
	],
	skills: [skill(1, "Shooting Star", "unique"), skill(2, "Hydrate", "innate"), skill(3, "Gourmand", "awakening", 3)],
	outfits: [], cards: [],
} as unknown as UmaPageData

const effect = (type: number, name: string, format: CardEffect["format"], unlock: number, values: (number | null)[]): CardEffect =>
	({ type, name, help: "", format, unlock, values })
// Values per level, 1 to 50: a flat value from its unlock, rising at Lv 50.
const levels = (unlock: number, low: number, high: number) => Array.from({ length: 50 }, (_, index) => (index + 1 < unlock ? null : index + 1 === 50 ? high : low))

const KITASAN = {
	id: 4, game_id: 30028, name: "Kitasan Black", title: "[Fire at My Heels]", colours: ["#5A6065", "#FC6D31"],
	image: null, image_borderless: null, card_type: "speed", rarity: 3, on_global: true, released_at: "2025-07-16T22:00:00+00:00",
	caps: [30, 35, 40, 45, 50],
	effects: [effect(1, "Friendship Bonus", "percent", 1, levels(1, 20, 25)), effect(19, "Specialty Priority", "number", 45, levels(45, 60, 80))],
	unique_effect: {
		level: 30, text: "Training Effectiveness and Specialty Priority", translated: false,
		amounts: [{ type: 8, name: "Training Effectiveness", value: 5, format: "percent", condition: null, line: "Training Effectiveness 5%" }],
	},
	skills: [skill(10, "Corner Adept ○", "hint"), skill(11, "Professor of Curvature", "event")],
	outfits: [], cards: [], group_members: [], purpose: "", character_id: 1068, jp_name: "", jp_title: "",
} as unknown as CardPageData

function shell(node: ReactNode, { early = true, guest = false }: { early?: boolean; guest?: boolean } = {}) {
	const auth = (guest
		? { isLoggedIn: false, status: "ready", account: null }
		: { isLoggedIn: true, status: "ready", account: { early_access: early, oshi_uma_ids: [] } }) as unknown as AuthContextType
	return (
		<AuthContext.Provider value={auth}>
			<TestQueryProvider>
				<MemoryRouter>{node}</MemoryRouter>
			</TestQueryProvider>
		</AuthContext.Provider>
	)
}

describe("hover card helpers", () => {
	it("builds a tile's attributes and reads them back", () => {
		const props = hoverCardProps("uma", 198, { ring: ["turf", "long", "late"] })
		expect(props).toEqual({ "data-hover-card": "uma:198", "data-hover-card-ring": "turf,long,late" })
		expect(parseHoverCard(props["data-hover-card"])).toEqual({ kind: "uma", id: 198 })
		expect(parseRing(props["data-hover-card-ring"])).toEqual(["turf", "long", "late"])
		expect(hoverCardProps("card", null)).toEqual({})
		expect(parseHoverCard("skill:3")).toBeNull()
		expect(parseRing("turf,banana")).toEqual(["turf"])
	})

	it("knows the two pages with no cards, so the layer downloads no catalogue for them", () => {
		// The calculator is the page a banner launch crowds; the catalogue is 106 KB.
		expect(pageDrawsHoverCards("/app")).toBe(false)
		expect(pageDrawsHoverCards("/app/")).toBe(false)
		expect(pageDrawsHoverCards("/app/selectors")).toBe(false)
		for (const path of ["/app/timeline", "/app/pvp", "/app/umas", "/app/umas/100101", "/app/collection"]) {
			expect(pageDrawsHoverCards(path), path).toBe(true)
		}
	})

	it("shows 0LB and MLB, adds the player's own limit break, and marks 0 or 4 instead of repeating it", () => {
		const caps = [30, 35, 40, 45, 50]
		expect(effectColumns(caps, null).map((column) => column.label)).toEqual(["0LB", "MLB"])
		expect(effectColumns(caps, 2)).toEqual([
			{ label: "0LB", level: 30, yours: false },
			{ label: "MLB", level: 50, yours: false },
			{ label: "Yours, 2LB", level: 40, yours: true },
		])
		expect(effectColumns(caps, 4).map((column) => [column.label, column.yours])).toEqual([["0LB", false], ["MLB", true]])
		expect(effectColumns([], 2)).toEqual([])
	})

	it("writes an effect as the game does, and an en dash before it unlocks", () => {
		const priority = effect(19, "Specialty Priority", "number", 45, levels(45, 60, 80))
		expect(effectAt(priority, 30)).toBe("–")
		expect(effectAt(priority, 50)).toBe("80")
		expect(effectAt(effect(1, "Friendship Bonus", "percent", 1, levels(1, 20, 25)), 30)).toBe("20%")
	})

	it("opens an uma's stats at the stars the player owns her at, else her starting stars", () => {
		expect(statRow(SPECIAL_WEEK.star_stats, 5, 3)?.star).toBe(5)
		expect(statRow(SPECIAL_WEEK.star_stats, null, 3)?.star).toBe(3)
		expect(statRow(SPECIAL_WEEK.star_stats, 4, 3)?.star).toBe(3)
	})
})

describe("the uma card", () => {
	it("draws her header, rings the race's aptitudes, boxes her stats and links her skills", () => {
		render(shell(
			<UmaHoverCard uma={{ id: 1, name: "Special Week", portrait: null, image: null }} page={SPECIAL_WEEK} href="/app/umas/100101" ring={["turf", "long", "late"]} ownedStars={5} />
		))
		expect(screen.getByText("Special Week")).toBeInTheDocument()
		expect(screen.getByText("[Special Dreamer] · ★3 · Late Surger")).toBeInTheDocument()
		const ringed = [...document.querySelectorAll('[data-race="true"]')].map((cell) => cell.firstChild?.textContent)
		expect(ringed).toEqual(["Turf", "Long", "Late"])
		expect(screen.getByText("Stats at ★5, yours")).toBeInTheDocument()
		expect(screen.getByText("103")).toBeInTheDocument()
		expect(screen.getByRole("link", { name: /Gourmand/ })).toHaveAttribute("href", "/app/skills/200003")
		expect(screen.getByText("Lv 3")).toBeInTheDocument()
		expect(screen.getByRole("link", { name: /Open Encyclopedia/ })).toHaveAttribute("href", "/app/umas/100101")
	})

	it("draws the header from the catalogue and a loading line while her page is on its way", () => {
		render(shell(<UmaHoverCard uma={{ id: 1, name: "Special Week", portrait: null, image: null }} page={undefined} href={null} />))
		expect(screen.getByText("Special Week")).toBeInTheDocument()
		expect(screen.getByRole("status", { name: "Loading Special Week" })).toBeInTheDocument()
		expect(screen.queryByRole("link")).toBeNull()
	})

	it("draws no links where leaving would drop an edit", () => {
		render(shell(
			<UmaHoverCard uma={{ id: 1, name: "Special Week", portrait: null, image: null }} page={SPECIAL_WEEK} href={null} links={false} />
		))
		expect(screen.getByText("Gourmand")).toBeInTheDocument()
		expect(screen.queryByRole("link")).toBeNull()
	})
})

describe("the support card's card", () => {
	it("shows effects at 0LB, MLB and the player's limit break, the unique effect and its skills", () => {
		render(shell(<CardHoverCard card={KITASAN} page={KITASAN} href="/app/cards/30028" ownedLimitBreak={2} />))
		expect(screen.getByText("[Fire at My Heels] · SSR Speed · Out 2025/7/16")).toBeInTheDocument()
		const table = screen.getByRole("table")
		expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["", "0LB", "MLB", "Yours, 2LB"])
		const priority = within(table).getByText("Specialty Priority").closest("tr") as HTMLElement
		expect(within(priority).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Specialty Priority", "–", "80", "–"])
		expect(screen.getByText("Training Effectiveness 5%")).toBeInTheDocument()
		expect(screen.getByText("Hints · 1")).toBeInTheDocument()
		expect(screen.getByRole("link", { name: /Professor of Curvature/ })).toBeInTheDocument()
	})
})

describe("the hover card layer", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn(async (url: string) => {
			if (String(url).endsWith("/encyclopedia/umas/100101")) return new Response(JSON.stringify(SPECIAL_WEEK), { status: 200 })
			if (String(url).endsWith("/encyclopedia/cards/30028")) return new Response(JSON.stringify(KITASAN), { status: 200 })
			return new Response("{}", { status: 404 })
		}))
	})
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	// Shows where the router is, so a test can tell a click that opened a card
	// from one that followed its link.
	function Where() {
		return <output aria-label="route">{useLocation().pathname}</output>
	}

	const META = "[Special Dreamer] · ★3 · Late Surger"
	const tiles = (
		<>
			<span title="Special Week" {...hoverCardProps("uma", 1, { ring: ["long"] })}>Uma</span>
			<span {...hoverCardProps("card", 4)}>Card</span>
			<span {...hoverCardProps("card", 11)}>Placeholder</span>
			<span>Elsewhere</span>
			<HoverCardLayer />
		</>
	)

	it("opens the card on a click of plain art, moves the tile's title aside, and closes on a second click", async () => {
		const user = userEvent.setup()
		render(shell(tiles))
		const uma = screen.getByText("Uma")
		await user.click(uma)
		expect(await screen.findByText(META)).toBeInTheDocument()
		expect(uma).not.toHaveAttribute("title")
		await user.click(uma)
		await waitFor(() => expect(screen.queryByText(META)).toBeNull())
		expect(uma).toHaveAttribute("title", "Special Week")
	})

	it("never opens on hover", async () => {
		const user = userEvent.setup()
		render(shell(tiles))
		await user.hover(screen.getByText("Uma"))
		await new Promise((resolve) => setTimeout(resolve, 300))
		expect(screen.queryByText(META)).toBeNull()
		expect(screen.getByText("Uma")).toHaveAttribute("title", "Special Week")
	})

	it("opens a support card's card, closes on a click elsewhere or Escape, and opens nothing for a placeholder", async () => {
		const user = userEvent.setup()
		render(shell(tiles))
		await user.click(screen.getByText("Card"))
		expect(await screen.findByText("Training Effectiveness 5%")).toBeInTheDocument()
		await user.click(screen.getByText("Elsewhere"))
		await waitFor(() => expect(screen.queryByText("Training Effectiveness 5%")).toBeNull())
		await user.click(screen.getByText("Card"))
		expect(await screen.findByText("Training Effectiveness 5%")).toBeInTheDocument()
		await user.keyboard("{Escape}")
		await waitFor(() => expect(screen.queryByText("Training Effectiveness 5%")).toBeNull())
		await user.click(screen.getByText("Placeholder"))
		await new Promise((resolve) => setTimeout(resolve, 300))
		expect(screen.queryByRole("table")).toBeNull()
	})

	it("moves from one tile's card to another's on one click", async () => {
		const user = userEvent.setup()
		render(shell(tiles))
		await user.click(screen.getByText("Uma"))
		expect(await screen.findByText(META)).toBeInTheDocument()
		await user.click(screen.getByText("Card"))
		expect(await screen.findByText("Training Effectiveness 5%")).toBeInTheDocument()
		expect(screen.queryByText(META)).toBeNull()
		expect(screen.getByText("Uma")).toHaveAttribute("title", "Special Week")
	})

	it("opens the card in place of a link to that uma's own page, and the card's link goes there", async () => {
		const user = userEvent.setup()
		const ran = vi.fn()
		render(shell(
			<>
				<span {...hoverCardProps("card", 4)}>Card</span>
				<Link to="/app/umas/100101" onClick={ran}>
					<span {...hoverCardProps("uma", 1)}>Art</span>
				</Link>
				<Where />
				<HoverCardLayer />
			</>
		))
		// A first card proves the catalogue is in: it is what names an uma's page.
		await user.click(screen.getByText("Card"))
		expect(await screen.findByText("Training Effectiveness 5%")).toBeInTheDocument()
		await user.click(screen.getByText("Art"))
		expect(await screen.findByText(META)).toBeInTheDocument()
		expect(screen.getByRole("status", { name: "route" })).toHaveTextContent(/^\/$/)
		// The link's own onClick (a picker's book closes its picker) stays out of it too.
		expect(ran).not.toHaveBeenCalled()
		// By its words: the popup is aria-hidden, so it has no role to ask for.
		await user.click(screen.getByText("Open Encyclopedia"))
		expect(screen.getByRole("status", { name: "route" })).toHaveTextContent("/app/umas/100101")
		await waitFor(() => expect(screen.queryByText(META)).toBeNull())
	})

	it("leaves a click alone when it already has a job: a button, or a link that goes somewhere else", async () => {
		const user = userEvent.setup()
		const picked = vi.fn()
		render(shell(
			<>
				<button type="button" onClick={picked} {...hoverCardProps("uma", 1)}>Pick her</button>
				<Link to="/app/timeline">
					<span {...hoverCardProps("uma", 1)}>Banner face</span>
				</Link>
				<span {...hoverCardProps("card", 4)}>Card</span>
				<Where />
				<HoverCardLayer />
			</>
		))
		// Prove the layer is live first, so "no card" below means something.
		await user.click(screen.getByText("Card"))
		expect(await screen.findByText("Training Effectiveness 5%")).toBeInTheDocument()
		await user.click(screen.getByRole("button", { name: "Pick her" }))
		expect(picked).toHaveBeenCalledTimes(1)
		await waitFor(() => expect(screen.queryByText("Training Effectiveness 5%")).toBeNull())
		expect(screen.queryByText(META)).toBeNull()
		await user.click(screen.getByText("Banner face"))
		expect(screen.getByRole("status", { name: "route" })).toHaveTextContent("/app/timeline")
		expect(screen.queryByText(META)).toBeNull()
	})

	it("lets the keyboard and a new-tab click keep the link", async () => {
		const user = userEvent.setup()
		render(shell(
			<>
				<Link to="/app/cards/30028" {...hoverCardProps("card", 4)}>Kitasan</Link>
				<span {...hoverCardProps("uma", 1)}>Uma</span>
				<Where />
				<HoverCardLayer />
			</>
		))
		await user.click(screen.getByText("Uma"))
		expect(await screen.findByText(META)).toBeInTheDocument()
		// Ctrl+click opens a tab in a browser; here it must reach the link untouched.
		const link = screen.getByRole("link", { name: "Kitasan" })
		const reached = vi.fn((event: MouseEvent) => event.preventDefault())
		link.addEventListener("click", reached)
		await user.keyboard("{Control>}")
		await user.click(link)
		await user.keyboard("{/Control}")
		expect(reached).toHaveBeenCalledTimes(1)
		expect(screen.queryByText("Training Effectiveness 5%")).toBeNull()
		link.removeEventListener("click", reached)
		// Enter on the focused link follows it: the card is out of a keyboard's reach.
		link.focus()
		await user.keyboard("{Enter}")
		expect(screen.getByRole("status", { name: "route" })).toHaveTextContent("/app/cards/30028")
		expect(screen.queryByText("Training Effectiveness 5%")).toBeNull()
	})

	it("ignores touch", async () => {
		const user = userEvent.setup()
		render(shell(tiles))
		await user.pointer({ keys: "[TouchA]", target: screen.getByText("Uma") })
		await new Promise((resolve) => setTimeout(resolve, 300))
		expect(screen.queryByText(META)).toBeNull()
	})

	// Henry, 2026-11-19: a style tab's deck card went to its page on a tap,
	// where the All tab's opens a popup. Only that tile takes a tap.
	it("opens a style tab's deck card on a tap, where other tiles keep their link", async () => {
		const user = userEvent.setup()
		render(shell(
			<>
				<SupportTile card={{ id: 4, name: "Kitasan Black", image: "kitasan.png", image_borderless: null, card_type: "speed", rarity: 3 } as never} note="" />
				<Link to="/app/umas/100101" {...hoverCardProps("uma", 1)}>Special Week</Link>
				<Where />
				<HoverCardLayer />
			</>
		))
		const art = await screen.findByRole("link", { name: /Kitasan Black/ })
		await user.pointer({ keys: "[TouchA]", target: art })
		expect(await screen.findByText("Training Effectiveness 5%")).toBeInTheDocument()
		expect(screen.getByRole("status", { name: "route" })).toHaveTextContent(/^\/$/)
		await user.pointer({ keys: "[TouchA]", target: screen.getByRole("link", { name: "Special Week" }) })
		expect(screen.getByRole("status", { name: "route" })).toHaveTextContent("/app/umas/100101")
	})

	// A guide tile draws its card inside itself (WithDetail), and React hands
	// a tap in the portalled card to the tile's own handlers: the tile's tap
	// toggle closed the card under the finger, and the browser's click then
	// fell through to the page behind it.
	it("keeps a guide tile's card open when a tap lands inside it", async () => {
		const user = userEvent.setup()
		render(shell(<UmaTile uma={{ id: 1, name: "Special Week", image: null }} stars={0} role="" note="Run her as a late surger." />))
		const tile = screen.getByRole("group", { name: "Special Week" })
		await waitFor(() => expect(tile).toHaveClass("cursor-pointer"))
		await user.pointer({ keys: "[TouchA]", target: tile })
		expect(await screen.findByText(META)).toBeInTheDocument()
		await user.pointer({ keys: "[TouchA]", target: screen.getByText(META) })
		await new Promise((resolve) => setTimeout(resolve, 300))
		expect(screen.getByText(META)).toBeInTheDocument()
		// A tap on the tile itself still closes it.
		await user.pointer({ keys: "[TouchA]", target: tile })
		await waitFor(() => expect(screen.queryByText(META)).toBeNull())
	})

	// Daptrius, 2026-11-19: no hover popup on a guide uma tile whose click
	// opens her card; everything the hover said is on the card.
	it("shows nothing on a guide uma tile's hover, and her card with the note on top on a click", async () => {
		const user = userEvent.setup()
		render(shell(<UmaTile uma={{ id: 1, name: "Special Week", image: null }} stars={0} role="" note="Run her as a late surger." />))
		const tile = screen.getByRole("group", { name: "Special Week" })
		const popup = () => document.querySelector("[data-floating-ui-portal]")
		// The catalogue knows her, so the tile offers her card (and says so with the cursor).
		await waitFor(() => expect(tile).toHaveClass("cursor-pointer"))
		await user.hover(tile)
		await new Promise((resolve) => setTimeout(resolve, 300))
		expect(popup()).toBeNull()
		await user.click(tile)
		expect(await screen.findByText(META)).toBeInTheDocument()
		expect(document.querySelector(".hover-card .skill-card__note")).toHaveTextContent("Run her as a late surger.")
		// Pinned: it stays when the pointer leaves, and when the card itself is
		// clicked (the pin's click focused the tile, and a click on the card's
		// plain text takes that focus away again)...
		await user.unhover(tile)
		await user.click(screen.getByText(META))
		await new Promise((resolve) => setTimeout(resolve, 300))
		expect(screen.getByText(META)).toBeInTheDocument()
		// ...and a second click on the tile closes it.
		await user.click(tile)
		await waitFor(() => expect(screen.queryByText(META)).toBeNull())
	})

	// The cards were early access only until the Encyclopedia opened to
	// everyone (2026-11-18). `early: false` is an account without it.
	it("opens a guide tile's card on a click for an account without early access too", async () => {
		const user = userEvent.setup()
		render(shell(<UmaTile uma={{ id: 1, name: "Special Week", image: null }} stars={0} role="" note="Run her as a late surger." />, { early: false }))
		const tile = screen.getByRole("group", { name: "Special Week" })
		await waitFor(() => expect(tile).toHaveClass("cursor-pointer"))
		await user.click(tile)
		expect(await screen.findByText(META)).toBeInTheDocument()
	})

	it("draws the card without early access", async () => {
		const user = userEvent.setup()
		render(shell(tiles, { early: false }))
		await user.click(screen.getByText("Uma"))
		expect(await screen.findByText(META)).toBeInTheDocument()
	})

	it("draws the card for a guest", async () => {
		const user = userEvent.setup()
		render(shell(tiles, { guest: true }))
		await user.click(screen.getByText("Uma"))
		expect(await screen.findByText(META)).toBeInTheDocument()
	})
})
