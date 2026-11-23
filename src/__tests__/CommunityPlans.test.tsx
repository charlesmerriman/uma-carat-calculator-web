/**
 * Community plans (/app/plans): the list, its sort and filters in the
 * address, a post opening in place, "Add to my plan", the posted income, the
 * copy's two paths, and the early access gate.
 *
 * The routes are mocked; their rules are tested in the API
 * (test_plan_gallery.py, test_gallery_plan_posts.py). The copy itself is the
 * provider's (sharedPlanProvider.test.tsx covers the shared body); here only
 * what the page decides.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CommunityPlansPage } from "../components/community-plans/CommunityPlansPage"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { CalculatorContext } from "../services/CalculatorContext"
import { DEFAULT_GUEST_STATS } from "../services/guestMigration"
import {
	galleryCommentsFetch,
	galleryPostFetch,
	galleryView,
	galleryVote,
	planFeedFetch,
	planPostCopy,
} from "../services/galleryFetchCalls"
import { TestQueryProvider } from "../test/TestQueryProvider"
import { readView, writeView } from "../utils/planFeedView"
import { PLAN_CAP } from "../types"
import type { BannerSupport, BannerUma, CalculatorContextType, Plan, UserPlannedBanner } from "../types"
import type { PlanFeed, PlanPost, PlanPostRow } from "../types/gallery"

vi.mock("../services/galleryFetchCalls", async () => {
	const actual = await vi.importActual<typeof import("../services/galleryFetchCalls")>("../services/galleryFetchCalls")
	return {
		...actual,
		planFeedFetch: vi.fn(),
		planPostCopy: vi.fn(),
		galleryPostFetch: vi.fn(),
		galleryVote: vi.fn(),
		galleryView: vi.fn(),
		galleryCommentsFetch: vi.fn(),
	}
})
// The projection has its own tests; here it only has to reach the rows.
vi.mock("../hooks/useBannerResources", async () => {
	const { EMPTY_BANNER_RESOURCES } = await import("../hooks/bannerResources")
	return {
		useBannerProjection: ({ userPlannedBannerData }: { userPlannedBannerData: unknown[] }) => ({
			rows: userPlannedBannerData.map(() => ({ ...EMPTY_BANNER_RESOURCES, maxPossiblePulls: 300 })),
		}),
	}
})
// A stand-in engine whose answer depends on the stats it is handed, so a
// test can tell the author's posted ranks from the viewer's own.
const engine = vi.hoisted(() => vi.fn())
vi.mock("../hooks/useAverageMonthlyIncome", () => ({ useAverageMonthlyIncome: engine }))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))

// Midday UTC, so the calendar dates hold in any test time zone. "Today" is
// 2026-10-18: the uma and support banners are ahead, ENDED has closed.
const timeline = (start: string, end: string) => ({ start_date: `${start}T12:00:00Z`, end_date: `${end}T12:00:00Z` })
const UMA_BANNER = {
	id: 100, name: "Kitasan Black banner", banner_timeline: timeline("2026-10-14", "2026-10-30"),
	umas: [{ id: 41, name: "Kitasan Black", image: "/k.png", portrait: "/kp.png" }],
} as unknown as BannerUma
const ENDED = {
	id: 101, name: "Old banner", banner_timeline: timeline("2026-09-01", "2026-09-10"),
	umas: [{ id: 42, name: "Old Uma", image: "/o.png", portrait: "/op.png" }],
} as unknown as BannerUma
const SUPPORT_BANNER = {
	id: 300, name: "Satono support banner", banner_timeline: timeline("2026-10-20", "2026-11-01"),
	support_cards: [{ id: 7, name: "Satono Diamond", image: "/s.png" }],
} as unknown as BannerSupport

const FILTERS: PlanFeed["filters"] = {
	spending: [
		{ value: "f2p", label: "F2P", meaning: "No money spent" },
		{ value: "minnow", label: "Minnow", meaning: "Daily Carat Pack only" },
	],
	sweat: [{ value: "casual", label: "Casual" }, { value: "comp", label: "Comp" }],
	strategies: [
		{ value: "front", label: "Front" }, { value: "pace", label: "Pace" },
		{ value: "late", label: "Late" }, { value: "end", label: "End" },
	],
	ranges: [{ value: 7, label: "Grand Masters" }],
}

const poster = (style: "ssr" | null = null, tier: string | null = null) => ({
	display_name: style ? "MooncakeMile" : "NightRacer", portrait: null, portrait_layers: null, tier_name: tier, gallery_style: style,
})

function row(publicId: string, extra: Partial<PlanPostRow> = {}): PlanPostRow {
	return {
		public_id: publicId,
		kind: "plan",
		caption: `Plan ${publicId}`,
		published_at: "2026-10-12T00:00:00Z",
		content_updated_at: "2026-10-12T00:00:00Z",
		is_mine: false,
		stats: { views: 310, score: 41, comments: 12, copies: 48 },
		my_vote: "none",
		poster: poster(),
		plan: {
			row_count: 3, pull_count: 1200, step_count: 0, has_notes: true, has_income: false,
			lead: [{ banner_uma: 100, banner_support: null, banner_step_up: null }],
		},
		spending: "f2p",
		sweat: "casual",
		strategies: ["pace"],
		range: { id: 7, label: "Grand Masters" },
		...extra,
	}
}

function full(publicId: string, extra: Partial<PlanPost> = {}): PlanPost {
	return {
		...row(publicId),
		strategy: "Free carats only.",
		hidden: false,
		rows: [
			{ banner_uma: 100, banner_support: null, banner_step_up: null, number_of_pulls: 1000, reserved_copies: 0, note: "Spark her" },
			{ banner_uma: null, banner_support: 300, banner_step_up: null, number_of_pulls: 200, reserved_copies: 0 },
			{ banner_uma: 101, banner_support: null, banner_step_up: null, number_of_pulls: 0, reserved_copies: 0 },
		],
		income: null,
		...extra,
	}
}

const feed = (results: PlanPostRow[], extra: Partial<PlanFeed> = {}): PlanFeed => ({
	count: results.length, sort: "top", window: "week", limit: 20, has_more: false, results, filters: FILTERS, ...extra,
})

const plan = (id: number): Plan => ({ id, public_id: `Plan${id}xx`, name: `Plan ${id}`, is_active: id === 1, updated_at: "2026-10-01T00:00:00Z" })

function authValue(earlyAccess = true): AuthContextType {
	return {
		isLoggedIn: true,
		status: "ready",
		account: { display_name: "Me", early_access: earlyAccess, oshis: [], oshi_slots: 1, oshi_uma_ids: [] } as unknown as AuthContextType["account"],
		isSupporter: earlyAccess,
		refresh: vi.fn(),
		signOut: vi.fn(),
	}
}

/** Where the router is, so a test can see what the page wrote to the address. */
function Address() {
	const location = useLocation()
	return <output data-testid="address">{`${location.pathname}${location.search}`}</output>
}

function renderPage({ url = "/app/plans", context = {}, earlyAccess = true }: {
	url?: string
	context?: Partial<CalculatorContextType>
	earlyAccess?: boolean
} = {}) {
	const value = {
		umaBannerData: [UMA_BANNER, ENDED],
		supportBannerData: [SUPPORT_BANNER],
		stepUpBannerData: [],
		plans: [plan(1)],
		activePlanId: 1,
		isPlanBusy: false,
		userPlannedBannerData: [],
		userPlannedPurchaseData: [],
		stagedBanners: [],
		setStagedBanners: vi.fn(),
		userStatsData: { ...DEFAULT_GUEST_STATS, club_rank: 9 },
		clubRankData: [{ id: 3, name: "A", income_amount: 0 }, { id: 9, name: "SS", income_amount: 0 }],
		teamTrialsRankData: [],
		championsMeetingRankData: [],
		leagueOfHeroesRankData: [],
		incomeLedger: [],
		fullIncomeLedger: [],
		calculationConstants: {
			misc_earnings_monthly: 1500, monthly_shop_uma_tickets: 4, monthly_shop_uma_tickets_max: 5,
			monthly_shop_support_tickets: 4, monthly_shop_support_tickets_max: 5,
		},
		copyPostedPlan: vi.fn().mockResolvedValue(true),
		deletePlan: vi.fn().mockResolvedValue(true),
		...context,
	} as unknown as CalculatorContextType
	render(
		<AuthContext.Provider value={authValue(earlyAccess)}>
			<CalculatorContext.Provider value={value}>
				<TestQueryProvider>
					<MemoryRouter initialEntries={[url]}>
						<Routes>
							<Route path="/app/plans" element={<CommunityPlansPage />} />
							<Route path="/app" element={<p>The calculator</p>} />
						</Routes>
						<Address />
					</MemoryRouter>
				</TestQueryProvider>
			</CalculatorContext.Provider>
		</AuthContext.Provider>
	)
	return value
}

const rowOf = (caption: string) => screen.getByRole("button", { name: caption }).closest("li") as HTMLElement
const lastFeedCall = () => vi.mocked(planFeedFetch).mock.calls.at(-1)?.[0]

beforeEach(() => {
	vi.clearAllMocks()
	window.localStorage.clear()
	vi.useFakeTimers({ toFake: ["Date"] })
	vi.setSystemTime(new Date("2026-10-18T12:00:00Z"))
	vi.mocked(planFeedFetch).mockImplementation(() => json(feed([row("P1"), row("P2", { poster: poster("ssr", "Senior Class") })])))
	vi.mocked(galleryPostFetch).mockImplementation((id) => json(full(id)))
	vi.mocked(galleryCommentsFetch).mockImplementation(() => json({ page: 1, has_more: false, results: [] }))
	engine.mockImplementation(({ userStatsData }: { userStatsData: { club_rank: number } | null }) => ({
		carats: (userStatsData?.club_rank ?? 0) * 1000, umaTickets: 1, supportTickets: 2, ssrShards: 3, srShards: 4,
	}))
})

afterEach(() => {
	vi.useRealTimers()
})

describe("the gate", () => {
	it("shows the supporters-first note without early access, and asks for nothing", () => {
		renderPage({ earlyAccess: false })
		expect(screen.getByText(/Community plans are for our Patreon supporters/)).toBeInTheDocument()
		expect(planFeedFetch).not.toHaveBeenCalled()
	})

	it("shows the same note when the server refuses", async () => {
		vi.mocked(planFeedFetch).mockImplementation(() => json({ error: "Community plans are open to supporters first." }, 403))
		renderPage()
		expect(await screen.findByText(/Community plans are for our Patreon supporters/)).toBeInTheDocument()
	})
})

describe("the list", () => {
	it("draws each row from the feed and the catalogue", async () => {
		renderPage()
		const first = await waitFor(() => rowOf("Plan P1"))
		expect(within(first).getByText("NightRacer")).toBeInTheDocument()
		// Chips, worded by the feed's filter block.
		for (const chip of ["F2P", "Casual", "Pace", "Up to Grand Masters", "Notes"]) {
			expect(within(first).getByText(chip)).toBeInTheDocument()
		}
		expect(within(first).queryByText("Income")).toBeNull()
		// The lead banner's uma, from the catalogue by id.
		expect(within(first).getByAltText("Kitasan Black")).toBeInTheDocument()
		// The phone's folded line carries every number.
		expect(within(first).getByText("1,200 pulls · 310 views · 48 copies · 12 comments")).toBeInTheDocument()
		expect(screen.getByText("2 plans")).toBeInTheDocument()
	})

	it("gives a supporter's row their look from gallery_style alone", async () => {
		renderPage()
		const supporter = await waitFor(() => rowOf("Plan P2"))
		expect(supporter).toHaveAttribute("data-gallery-style", "ssr")
		expect(supporter.className).toContain("ssr-panel")
		expect(within(supporter).getByText("Senior Class")).toBeInTheDocument()
		const plain = rowOf("Plan P1")
		expect(plain).not.toHaveAttribute("data-gallery-style")
		expect(plain.className).toContain("card-panel")
	})

	it("says when the filters leave nothing, and clears them", async () => {
		vi.mocked(planFeedFetch).mockImplementation(({ filters }) => json(feed(filters.spending ? [] : [row("P1")])))
		renderPage({ url: "/app/plans?spending=f2p" })
		expect(await screen.findByText("No plans match these filters.")).toBeInTheDocument()
		fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" }).at(-1) as HTMLElement)
		expect(await screen.findByRole("button", { name: "Plan P1" })).toBeInTheDocument()
		expect(screen.getByTestId("address")).toHaveTextContent(/^\/app\/plans$/)
	})
})

describe("the address holds the view", () => {
	it("writes the sort, the window and each filter, and asks the server for them", async () => {
		renderPage()
		await screen.findByRole("button", { name: "Plan P1" })
		expect(lastFeedCall()).toMatchObject({ sort: "top", window: "week" })

		fireEvent.click(screen.getByRole("button", { name: "This month" }))
		await waitFor(() => expect(lastFeedCall()).toMatchObject({ sort: "top", window: "month" }))
		expect(screen.getByTestId("address")).toHaveTextContent("window=month")

		const sidebar = screen.getByRole("complementary", { name: "Filters" })
		fireEvent.change(within(sidebar).getByLabelText("Spending level"), { target: { value: "f2p" } })
		await waitFor(() => expect(lastFeedCall()?.filters.spending).toBe("f2p"))
		// The chosen level's meaning, in words.
		expect(within(sidebar).getByText("No money spent")).toBeInTheDocument()

		fireEvent.click(within(sidebar).getByLabelText("Late"))
		fireEvent.click(within(sidebar).getByLabelText("Front"))
		await waitFor(() => expect(lastFeedCall()?.filters.strategies).toEqual(["front", "late"]))
		fireEvent.change(within(sidebar).getByLabelText("Range"), { target: { value: "7" } })
		fireEvent.change(within(sidebar).getByLabelText("Sweat level"), { target: { value: "comp" } })
		await waitFor(() => expect(lastFeedCall()?.filters).toEqual({ range: 7, strategies: ["front", "late"], spending: "f2p", sweat: "comp" }))
		expect(screen.getByTestId("address")).toHaveTextContent("strategy=front%2Clate")

		fireEvent.click(screen.getByRole("button", { name: "New" }))
		await waitFor(() => expect(lastFeedCall()?.sort).toBe("new"))
		expect(screen.getByTestId("address")).toHaveTextContent("sort=new")
	})

	it("reads the view from the address on arrival, ignoring what it doesn't know", async () => {
		renderPage({ url: "/app/plans?window=month&strategy=pace,front,sideways&spending=bogus&range=x" })
		await screen.findByRole("button", { name: "Plan P1" })
		expect(lastFeedCall()).toMatchObject({
			sort: "top",
			window: "month",
			filters: { range: null, strategies: ["front", "pace"], spending: null, sweat: null },
		})
	})

	it("leaves the defaults out of the address", () => {
		const plain = readView(new URLSearchParams())
		expect(writeView(new URLSearchParams("post=P1"), plain).toString()).toBe("post=P1")
	})

	it("puts the last view back on a plain visit", async () => {
		window.localStorage.setItem("community-plans-view", "sort=new&spending=f2p")
		renderPage()
		await waitFor(() => expect(screen.getByTestId("address")).toHaveTextContent("sort=new&spending=f2p"))
	})

	it("opens the filters in a sheet below the sidebar's width", async () => {
		renderPage({ url: "/app/plans?spending=f2p" })
		await screen.findByRole("button", { name: "Plan P1" })
		fireEvent.click(screen.getByRole("button", { name: "Filters (1)" }))
		const sheet = screen.getByRole("dialog", { name: "Filters" })
		expect(within(sheet).getByLabelText("Spending level")).toHaveValue("f2p")
	})
})

describe("a post opens in place", () => {
	it("opens inside its row, counts the view once loaded, and closes the one that was open", async () => {
		renderPage()
		const first = await screen.findByRole("button", { name: "Plan P1" })
		expect(galleryPostFetch).not.toHaveBeenCalled()
		expect(galleryView).not.toHaveBeenCalled()

		fireEvent.click(first)
		expect(first).toHaveAttribute("aria-expanded", "true")
		expect(await within(rowOf("Plan P1")).findByText("About this plan")).toBeInTheDocument()
		expect(galleryPostFetch).toHaveBeenCalledWith("P1")
		await waitFor(() => expect(galleryView).toHaveBeenCalledWith("P1"))
		expect(screen.getByTestId("address")).toHaveTextContent("post=P1")

		fireEvent.click(screen.getByRole("button", { name: "Plan P2" }))
		expect(first).toHaveAttribute("aria-expanded", "false")
		expect(screen.getByRole("button", { name: "Plan P2" })).toHaveAttribute("aria-expanded", "true")
		expect(within(rowOf("Plan P1")).queryByText("About this plan")).toBeNull()
	})

	it("doesn't open for the vote control, and the vote patches the row", async () => {
		vi.mocked(galleryVote).mockImplementation(() => json({ score: 42, my_vote: "up" }))
		renderPage()
		const first = await waitFor(() => rowOf("Plan P1"))
		fireEvent.click(within(first).getByRole("button", { name: "Upvote (score 41)" }))
		await waitFor(() => expect(galleryVote).toHaveBeenCalledWith("P1", "up"))
		expect(await within(first).findByRole("button", { name: "Take back your upvote (score 42)" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "Plan P1" })).toHaveAttribute("aria-expanded", "false")
	})

	it("doesn't open for the poster's name, which opens their card", async () => {
		renderPage()
		const first = await waitFor(() => rowOf("Plan P1"))
		fireEvent.click(within(first).getByRole("button", { name: "NightRacer" }))
		expect(screen.getByRole("dialog", { name: "NightRacer" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "Plan P1" })).toHaveAttribute("aria-expanded", "false")
	})

	it("scrolls to an opened row once, never again when a vote changes the list", async () => {
		vi.mocked(galleryVote).mockImplementation(() => json({ score: 42, my_vote: "up" }))
		const scroll = vi.spyOn(Element.prototype, "scrollIntoView")
		renderPage({ url: "/app/plans?post=P1" })
		const first = await waitFor(() => rowOf("Plan P1"))
		await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1))
		fireEvent.click(within(first).getByRole("button", { name: "Upvote (score 41)" }))
		expect(await within(first).findByRole("button", { name: "Take back your upvote (score 42)" })).toBeInTheDocument()
		expect(scroll).toHaveBeenCalledTimes(1)
		scroll.mockRestore()
	})

	it("opens the post the address names", async () => {
		renderPage({ url: "/app/plans?post=P2" })
		const second = await screen.findByRole("button", { name: "Plan P2" })
		expect(second).toHaveAttribute("aria-expanded", "true")
		expect(galleryPostFetch).toHaveBeenCalledWith("P2")
	})

	it("shows a linked post the list leaves out on its own above it", async () => {
		renderPage({ url: "/app/plans?post=P9" })
		const linked = await screen.findByRole("list", { name: "Linked plan" })
		expect(await within(linked).findByRole("button", { name: "Plan P9" })).toHaveAttribute("aria-expanded", "true")
	})

	it("says so when a linked post is gone", async () => {
		vi.mocked(galleryPostFetch).mockImplementation(() => json({ error: "Not found" }, 404))
		renderPage({ url: "/app/plans?post=P9" })
		expect(await screen.findByText("This plan isn't up any more.")).toBeInTheDocument()
	})

	it("shows notes, and the income block only when the post has one", async () => {
		renderPage({ url: "/app/plans?post=P1" })
		expect(await screen.findByText("Spark her")).toBeInTheDocument()
		expect(screen.queryByText(/income, as set when this was posted/)).toBeNull()
	})
})

describe("the posted income", () => {
	const INCOME = {
		club_rank: 3, team_trials_rank: null, champions_meeting_rank: null, league_of_heroes_rank: null,
		daily_carat: true, training_pass: false, misc_earnings: true, custom_misc_earnings_monthly: null,
		monthly_shop_tickets: true, shop_uma_tickets_bought: null, shop_support_tickets_bought: 2,
	}

	it("runs the engine on the author's posted fields, never the viewer's", async () => {
		vi.mocked(galleryPostFetch).mockImplementation((id) => json(full(id, { income: INCOME })))
		renderPage({ url: "/app/plans?post=P1" })
		const block = await screen.findByRole("region", { name: "NightRacer's income" })
		// The stand-in engine pays club_rank x 1000: the author's 3, not the viewer's 9.
		expect(within(block).getByText("3,000")).toBeInTheDocument()
		expect(within(block).queryByText("9,000")).toBeNull()
		expect(engine).toHaveBeenCalledWith(expect.objectContaining({ incomeLedger: [] }))
		expect(within(block).getByText("Club: A")).toBeInTheDocument()
		expect(within(block).getByText("Daily Carat Pack: on")).toBeInTheDocument()
		expect(within(block).getByText("Misc earnings: 1,500 a month")).toBeInTheDocument()
		expect(within(block).getByText("Monthly shop tickets: 4 uma, 2 support")).toBeInTheDocument()
		expect(within(block).getByText(/Their carats, tickets and crystals are never shown/)).toBeInTheDocument()
	})
})

describe("Add to my plan", () => {
	it("stages that banner with the author's pulls, writes no plan, and has no button on an ended banner", async () => {
		const planned = { id: 5, user: 1, number_of_pulls: 0, reserved_copies: 0, banner_support: SUPPORT_BANNER } as UserPlannedBanner
		const value = renderPage({ url: "/app/plans?post=P1", context: { userPlannedBannerData: [planned] } })
		const banners = await screen.findByRole("region", { name: "Banners" })
		const buttons = await within(banners).findAllByRole("button", { name: "Add to my plan" })
		// Kitasan's row only: Satono is already planned, and the old banner has ended.
		expect(buttons).toHaveLength(1)
		expect(within(banners).getByText("Already in calculator")).toBeInTheDocument()

		fireEvent.click(buttons[0])
		const updater = vi.mocked(value.setStagedBanners).mock.calls[0][0] as (prev: UserPlannedBanner[]) => UserPlannedBanner[]
		const [staged] = updater([])
		expect(staged).toMatchObject({ number_of_pulls: 1000, reserved_copies: 0, banner_uma: UMA_BANNER, initialBannerType: "Uma" })
		expect(staged.tempId).toBeGreaterThan(5)
		// Only the pulls: the author's note stays theirs.
		expect(staged.note).toBeUndefined()
		expect(planPostCopy).not.toHaveBeenCalled()
		expect(value.copyPostedPlan).not.toHaveBeenCalled()
	})

	it("says a banner is already staged", async () => {
		const staged = { tempId: 1, number_of_pulls: 0, reserved_copies: 0, banner_uma: UMA_BANNER } as UserPlannedBanner
		renderPage({ url: "/app/plans?post=P1", context: { stagedBanners: [staged] } })
		const banners = await screen.findByRole("region", { name: "Banners" })
		expect(await within(banners).findByText("Already staged")).toBeInTheDocument()
	})
})

describe("copying", () => {
	it("names an account's copy after the post and goes to the calculator", async () => {
		const value = renderPage({ url: "/app/plans?post=P1" })
		fireEvent.click(await screen.findByRole("button", { name: "Copy to my plans" }))
		expect(screen.getByLabelText("Name your copy")).toHaveValue("Plan P1")
		fireEvent.click(screen.getByRole("button", { name: "Copy as a new plan" }))
		await waitFor(() => expect(value.copyPostedPlan).toHaveBeenCalledWith("P1", "Plan P1"))
		expect(await screen.findByText("The calculator")).toBeInTheDocument()
	})

	it("asks a guest before replacing the plan on the device", async () => {
		const row1 = { tempId: 1, number_of_pulls: 0, reserved_copies: 0, banner_uma: UMA_BANNER } as UserPlannedBanner
		const value = renderPage({ url: "/app/plans?post=P1", context: { plans: [], activePlanId: null, userPlannedBannerData: [row1] } })
		fireEvent.click(await screen.findByRole("button", { name: "Copy to my plans" }))
		fireEvent.click(screen.getByRole("button", { name: "Copy to this device" }))
		expect(screen.getByText("Replace the plan on this device?")).toBeInTheDocument()
		expect(value.copyPostedPlan).not.toHaveBeenCalled()
		fireEvent.click(screen.getByRole("button", { name: "Replace it" }))
		await waitFor(() => expect(value.copyPostedPlan).toHaveBeenCalledWith("P1", undefined))
	})

	it("offers to make room at the plan cap", async () => {
		const plans = Array.from({ length: PLAN_CAP }, (_, index) => plan(index + 1))
		renderPage({ url: "/app/plans?post=P1", context: { plans } })
		fireEvent.click(await screen.findByRole("button", { name: "Copy to my plans" }))
		expect(screen.getByText(`You're at the ${PLAN_CAP}-plan limit. Delete one to make room.`)).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "Copy as a new plan" })).toBeDisabled()
	})
})
