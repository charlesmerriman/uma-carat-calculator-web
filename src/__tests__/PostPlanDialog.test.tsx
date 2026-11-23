/**
 * PostPlanDialog: posting a plan to Community plans. The rules are the API's
 * (test_plan_gallery.py) and the send is the provider's (postPlan); these
 * cover what the dialog decides: what it asks, that the two "also show" boxes
 * start unticked every time, what it sends, where a refusal shows, and the
 * take-down.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PostPlanDialog } from "../components/community-plans/PostPlanDialog"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { CalculatorContext } from "../services/CalculatorContext"
import { galleryPostFetch, galleryPostTakeDown, planFeedFetch } from "../services/galleryFetchCalls"
import { TestQueryProvider } from "../test/TestQueryProvider"
import type { CalculatorContextType, Plan } from "../types"
import type { PlanFeed, PlanPost } from "../types/gallery"

vi.mock("../services/galleryFetchCalls", async () => {
	const actual = await vi.importActual<typeof import("../services/galleryFetchCalls")>("../services/galleryFetchCalls")
	return { ...actual, planFeedFetch: vi.fn(), galleryPostFetch: vi.fn(), galleryPostTakeDown: vi.fn() }
})
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))

const FILTERS: PlanFeed["filters"] = {
	spending: [{ value: "f2p", label: "F2P", meaning: "No purchases" }, { value: "minnow", label: "Minnow", meaning: "Daily Carat Pack only" }],
	sweat: [{ value: "casual", label: "Casual" }],
	strategies: [{ value: "front", label: "Front" }, { value: "pace", label: "Pace" }, { value: "late", label: "Late" }, { value: "end", label: "End" }],
	ranges: [],
}
const FEED: PlanFeed = { count: 0, sort: "top", window: "week", limit: 20, has_more: false, results: [], filters: FILTERS }

const PLAN: Plan = { id: 7, name: "Main", is_active: true, updated_at: "2026-11-01T00:00:00Z", post_public_id: null }

const POSTED = {
	public_id: "Post1234", kind: "plan", caption: "Skip until the anniversary", strategy: "Free carats only.",
	published_at: "2026-11-10T00:00:00Z", content_updated_at: "2026-11-10T00:00:00Z", is_mine: true, hidden: false,
	stats: { views: 1, score: 0, comments: 0, copies: 0 }, my_vote: "none",
	poster: { display_name: "Me", portrait: null, tier_name: null, gallery_style: null },
	plan: { row_count: 2, pull_count: 400, step_count: 0, lead: [], has_notes: true, has_income: true },
	spending: "minnow", sweat: "casual", strategies: ["pace"], range: { id: 3, label: "Grand Masters" },
	rows: [], income: null,
} as unknown as PlanPost

function renderDialog({ plan = PLAN, displayName = "Me", context = {} }: {
	plan?: Plan
	displayName?: string
	context?: Partial<CalculatorContextType>
} = {}) {
	const value = {
		isPlanBusy: false,
		postPlan: vi.fn().mockResolvedValue({ ok: true, post: { ...POSTED, public_id: "New12345" } }),
		forgetPlanPost: vi.fn(),
		...context,
	} as unknown as CalculatorContextType
	const auth = {
		isLoggedIn: true, status: "ready", isSupporter: true, refresh: vi.fn(), signOut: vi.fn(),
		account: { display_name: displayName, early_access: true, oshis: [], oshi_slots: 1, oshi_uma_ids: [] },
	} as unknown as AuthContextType
	const onClose = vi.fn()
	render(
		<AuthContext.Provider value={auth}>
			<CalculatorContext.Provider value={value}>
				<TestQueryProvider>
					<MemoryRouter>
						<PostPlanDialog plan={plan} onClose={onClose} />
					</MemoryRouter>
				</TestQueryProvider>
			</CalculatorContext.Provider>
		</AuthContext.Provider>
	)
	return { value, onClose }
}

beforeEach(() => {
	vi.clearAllMocks()
	vi.mocked(planFeedFetch).mockImplementation(() => json(FEED))
	vi.mocked(galleryPostFetch).mockImplementation(() => json(POSTED))
})

describe("PostPlanDialog", () => {
	it("asks for a display name first", () => {
		renderDialog({ displayName: "" })
		expect(screen.getByRole("link", { name: "Set a display name" })).toHaveAttribute("href", "/account")
	})

	it("posts with the author's picks, and both boxes unticked unless ticked", async () => {
		const { value, onClose } = renderDialog()
		const post = await screen.findByRole("button", { name: "Post plan" })
		expect(post).toBeDisabled()
		fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "  F2P road  " } })
		fireEvent.change(screen.getByLabelText(/^Spending level/), { target: { value: "f2p" } })
		expect(screen.getByText("No purchases")).toBeInTheDocument()
		fireEvent.click(screen.getByLabelText("Late"))
		fireEvent.click(screen.getByLabelText("Front"))
		expect(post).toBeDisabled()
		fireEvent.click(screen.getByLabelText("Show my name, picture and tier with this plan"))
		fireEvent.click(post)
		await waitFor(() => expect(value.postPlan).toHaveBeenCalled())
		expect(value.postPlan).toHaveBeenCalledWith(7, {
			caption: "F2P road", strategy: "", spending: "f2p", sweat: "", strategies: ["front", "late"],
			include_notes: false, include_income: false, confirm_public_identity: true,
		})
		await waitFor(() => expect(onClose).toHaveBeenCalled())
		expect(toast.success).toHaveBeenCalledWith("Your plan is in Community plans.", expect.anything())
	})

	it("starts an update from the post's words and picks, never its two ticks", async () => {
		const { value } = renderDialog({ plan: { ...PLAN, post_public_id: "Post1234" } })
		expect(await screen.findByDisplayValue("Skip until the anniversary")).toBeInTheDocument()
		expect(screen.getByDisplayValue("Free carats only.")).toBeInTheDocument()
		expect(screen.getByLabelText(/^Spending level/)).toHaveValue("minnow")
		expect(screen.getByLabelText("Pace")).toBeChecked()
		expect(screen.getByText(/Runs up to Grand Masters/)).toBeInTheDocument()
		// The post had notes and income; this post shows them only if ticked again.
		expect(screen.getByLabelText(/Include my notes/)).not.toBeChecked()
		expect(screen.getByLabelText(/Include my income/)).not.toBeChecked()
		fireEvent.click(screen.getByLabelText(/Include my income/))
		fireEvent.click(screen.getByLabelText("Show my name, picture and tier with this plan"))
		fireEvent.click(screen.getByRole("button", { name: "Update post" }))
		await waitFor(() => expect(value.postPlan).toHaveBeenCalledWith(7, expect.objectContaining({ include_income: true, include_notes: false })))
	})

	it("shows a refused note beside the notes box, inside the dialog", async () => {
		const postPlan = vi.fn().mockResolvedValue({ ok: false, text: "Check the note on Kitasan Black. No links.", field: "notes" })
		renderDialog({ context: { postPlan } })
		fireEvent.change(await screen.findByLabelText(/^Title/), { target: { value: "Mine" } })
		fireEvent.click(screen.getByLabelText(/Include my notes/))
		fireEvent.click(screen.getByLabelText("Show my name, picture and tier with this plan"))
		fireEvent.click(screen.getByRole("button", { name: "Post plan" }))
		const alert = await screen.findByRole("alert")
		expect(alert).toHaveTextContent("Check the note on Kitasan Black.")
		expect(screen.getByLabelText(/Include my notes/)).toHaveAttribute("aria-invalid", "true")
		expect(toast.success).not.toHaveBeenCalled()
	})

	it("takes a posted plan down after asking, and clears the mark", async () => {
		vi.mocked(galleryPostTakeDown).mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })))
		const { value, onClose } = renderDialog({ plan: { ...PLAN, post_public_id: "Post1234" } })
		fireEvent.click(await screen.findByRole("button", { name: "Take it down" }))
		const confirm = screen.getByText("Take it down?")
		fireEvent.click(within(confirm).getByRole("button", { name: "Take down" }))
		await waitFor(() => expect(value.forgetPlanPost).toHaveBeenCalledWith("Post1234"))
		expect(galleryPostTakeDown).toHaveBeenCalledWith("Post1234")
		expect(onClose).toHaveBeenCalled()
	})
})
