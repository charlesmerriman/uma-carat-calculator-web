/**
 * The PvP gallery: the feed (sorts, filter, longer lists, rows by look,
 * votes, your post), the post panel (deep link, view, copy, share, missing
 * post, closing and stepping), the comment thread's states, the dialogs
 * (posting, reporting over a post), and the release filter a copied team goes
 * through.
 *
 * The routes are mocked; their rules are tested in the API
 * (test_gallery.py, test_pvp_gallery.py).
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter, useLocation } from "react-router-dom"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { GalleryView } from "../components/pvp/gallery/GalleryView"
import { PublishDialog } from "../components/pvp/gallery/PublishDialog"
import { PvpTeamsContext, type PvpTeamsContextType } from "../services/PvpTeamsContext"
import {
	galleryCommentsFetch,
	galleryCopy,
	galleryFeedFetch,
	galleryPostFetch,
	galleryReport,
	galleryView,
	galleryVote,
	pvpTeamPublish,
} from "../services/galleryFetchCalls"
import { withinRelease } from "../utils/pvpTeams"
import { TestQueryProvider } from "../test/TestQueryProvider"
import type { RaceEvent } from "../types"
import type { GalleryComment, GalleryFeed, GalleryPost, GalleryRow } from "../types/gallery"
import type { PvpTeamMember } from "../types/pvpTeam"

const LIBRA = {
	id: 19, event_type: "champions_meeting", cm_number: 19, name: "Libra Cup", start_date: "2020-01-01T00:00:00Z",
	end_date: "2030-01-01T00:00:00Z", is_predicted: false, surface_type: "Turf", distance: "Mile", length: "",
} as unknown as RaceEvent

// Card 303 first appears after Libra Cup ends, so a copied team loses it.
const SUPPORT_BANNERS = [{ banner_timeline: { start_date: "2040-01-01T12:00:00Z" }, support_cards: [{ id: 303 }] }]

vi.mock("../services/CalculatorContext", () => ({
	useCalculatorData: () => ({ umaBannerData: [], supportBannerData: SUPPORT_BANNERS }),
}))
vi.mock("../hooks/usePvpCatalogue", () => ({
	usePvpCatalogue: () => ({
		status: "ready",
		catalogue: { umas: [], support_cards: [], skills: [] },
		umasById: new Map([
			[41, { id: 41, name: "Maruzensky", image: null, portrait: "m.png", character_id: 1004 }],
			[12, { id: 12, name: "Oguri Cap", image: null, portrait: "o.png", character_id: 1006 }],
			[77, { id: 77, name: "Gold Ship", image: null, portrait: "g.png", character_id: 1007 }],
		]),
		cardsById: new Map([
			[302, { id: 302, name: "Kitasan Black", image: "k.png" }],
			[303, { id: 303, name: "Future Card", image: "f.png" }],
		]),
		skillsById: new Map(),
	}),
}))

const auth = vi.hoisted(() => ({ isLoggedIn: true, account: { display_name: "Rhondal" } as { display_name: string } | null }))
// The real module, so AuthContext itself exists (useOshiIds reads it); only
// useAccount is replaced. No provider is mounted, so nobody's favourites.
vi.mock("../services/AuthContext", async () => ({
	...(await vi.importActual<typeof import("../services/AuthContext")>("../services/AuthContext")),
	useAccount: () => auth,
}))

vi.mock("../services/galleryFetchCalls", async () => {
	const actual = await vi.importActual<typeof import("../services/galleryFetchCalls")>("../services/galleryFetchCalls")
	return {
		...actual,
		galleryFeedFetch: vi.fn(),
		galleryPostFetch: vi.fn(),
		galleryVote: vi.fn(),
		galleryView: vi.fn(),
		galleryCopy: vi.fn(),
		galleryCommentsFetch: vi.fn(),
		galleryPostTakeDown: vi.fn(),
		galleryReport: vi.fn(),
		pvpTeamPublish: vi.fn(),
	}
})
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))

const poster = (style: "ssr" | "sr" | "rose" | null, tier: string | null = null) => ({
	display_name: `Poster ${style ?? "free"}`, portrait: null, tier_name: tier, gallery_style: style,
})

function row(publicId: string, extra: Partial<GalleryRow> = {}): GalleryRow {
	return {
		public_id: publicId,
		caption: `Caption ${publicId}`,
		published_at: "2026-10-10T00:00:00Z",
		content_updated_at: "2026-10-10T00:00:00Z",
		is_mine: false,
		umas: [{ uma: 41, style: "front" }, { uma: 12, style: "pace" }, { uma: 77, style: "late" }],
		stats: { views: 212, upvotes: 14, comments: 5 },
		my_vote: false,
		poster: poster(null),
		...extra,
	}
}

const TEAM: PvpTeamMember[] = [
	{ position: 0, uma: 41, style: "front", cards: [{ slot: 1, support_card: 302 }, { slot: 2, support_card: 303 }] },
]

function fullPost(publicId: string, extra: Partial<GalleryPost> = {}): GalleryPost {
	return {
		...row(publicId),
		strategy: "",
		team: TEAM,
		event: { kind: "cm", id: 19, label: "Libra Cup" },
		hidden: false,
		stats: { views: 212, upvotes: 14, comments: 5, copies: 3 },
		...extra,
	}
}

function teamsValue(extra: Partial<PvpTeamsContextType> = {}): PvpTeamsContextType {
	return {
		status: "ready", mode: "account", teams: [], saveState: "idle",
		ensureLoaded: vi.fn(), createTeam: vi.fn(() => "new-key"), editTeam: vi.fn(), renameTeam: vi.fn(),
		pinTeam: vi.fn(), deleteTeam: vi.fn(), setTeamPost: vi.fn(),
		...extra,
	}
}

/** Where the router is, so a test can see what closing a post did to the address. */
function Address() {
	const location = useLocation()
	return <output data-testid="address">{`${location.pathname}${location.search}`}</output>
}

function renderGallery(url = "/app/pvp?event=cm-19&view=gallery", teams = teamsValue(), onOpenMyTeam = vi.fn()) {
	render(
		<MemoryRouter initialEntries={[url]}>
			<TestQueryProvider>
				<PvpTeamsContext.Provider value={teams}>
					<GalleryView event={LIBRA} onOpenMyTeam={onOpenMyTeam} />
					<Address />
				</PvpTeamsContext.Provider>
			</TestQueryProvider>
		</MemoryRouter>
	)
	return { teams, onOpenMyTeam }
}

function feed(results: GalleryRow[], extra: Partial<GalleryFeed> = {}): Promise<Response> {
	return json({
		count: results.length, sort: "hot", limit: 20, has_more: false, results,
		umas: [{ uma: 41, count: 3 }, { uma: 12, count: 2 }],
		...extra,
	})
}

/** The open post's panel, named by its title. */
const panel = (name = "Poster free's team") => screen.findByRole("region", { name })

beforeEach(() => {
	auth.isLoggedIn = true
	auth.account = { display_name: "Rhondal" }
	vi.mocked(galleryFeedFetch).mockImplementation((_ref, { sort }) =>
		feed(
			[
				row("aaaaaaa1", { poster: poster("ssr", "Senior Class") }),
				row("bbbbbbb2", { poster: poster("sr", "Classic Class") }),
				row("ccccccc3", { poster: poster("rose", "Junior Class"), stats: { views: 1, upvotes: 2, comments: 1 } }),
			],
			{ sort }
		)
	)
	vi.mocked(galleryPostFetch).mockImplementation((id) => json(fullPost(id)))
	vi.mocked(galleryCommentsFetch).mockImplementation(() => json({ count: 0, page: 1, has_more: false, results: [] }))
})

afterEach(() => vi.clearAllMocks())

describe("the feed", () => {
	it("draws each supporter look by its key, the SSR one quiet, with the tier name as text", async () => {
		renderGallery()
		const rows = await screen.findAllByRole("article")
		expect(rows[0]).toHaveClass("ssr-panel", "ssr-panel--quiet")
		expect(rows[1]).toHaveAttribute("data-gallery-style", "sr")
		expect(rows[2]).toHaveAttribute("data-gallery-style", "rose")
		expect(within(rows[0]).getByText("Senior Class")).toBeInTheDocument()
		expect(within(rows[1]).getByText("212 views")).toBeInTheDocument()
		expect(within(rows[0]).getByText("Oguri Cap")).toBeInTheDocument()
		expect(screen.getByText("3 teams")).toBeInTheDocument()
	})

	it("counts one as one", async () => {
		renderGallery()
		const rows = await screen.findAllByRole("article")
		expect(within(rows[2]).getByText("1 view")).toBeInTheDocument()
		expect(within(rows[2]).getByText("1 comment")).toBeInTheDocument()
	})

	it("makes every row a link to its post", async () => {
		renderGallery()
		const [first] = await screen.findAllByRole("article")
		expect(within(first).getByRole("link", { name: "Open Poster ssr's team" })).toHaveAttribute(
			"href", "/app/pvp?event=cm-19&view=gallery&post=aaaaaaa1"
		)
	})

	it("asks the API for the sort the tabs choose, and says what it means", async () => {
		renderGallery()
		await screen.findAllByRole("article")
		fireEvent.click(screen.getByRole("button", { name: "Top" }))
		await waitFor(() =>
			expect(galleryFeedFetch).toHaveBeenLastCalledWith({ kind: "cm", id: 19 }, { sort: "top", uma: null, limit: 20 })
		)
		expect(screen.getByRole("button", { name: "Top" })).toHaveAttribute("aria-pressed", "true")
		expect(screen.getByText(/supporters' own posts, count a bit extra/)).toBeInTheDocument()
	})

	it("filters by an uma the event's posts use", async () => {
		renderGallery()
		await screen.findAllByRole("article")
		const filter = screen.getByRole("combobox")
		expect(within(filter).getByRole("option", { name: "Maruzensky (3)" })).toBeInTheDocument()
		fireEvent.change(filter, { target: { value: "12" } })
		await waitFor(() =>
			expect(galleryFeedFetch).toHaveBeenLastCalledWith({ kind: "cm", id: 19 }, { sort: "hot", uma: 12, limit: 20 })
		)
		expect(screen.getByTestId("address").textContent).toContain("uma=12")
	})

	it("loads more by asking for a longer list from the top", async () => {
		vi.mocked(galleryFeedFetch).mockImplementation((_ref, { limit }) =>
			feed([row("aaaaaaa1")], { count: 30, limit, has_more: limit < 30 })
		)
		renderGallery()
		fireEvent.click(await screen.findByRole("button", { name: "Load more" }))
		await waitFor(() =>
			expect(galleryFeedFetch).toHaveBeenLastCalledWith({ kind: "cm", id: 19 }, { sort: "hot", uma: null, limit: 40 })
		)
		await waitFor(() => expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument())
	})

	it("moves the vote at once and puts it back when the server says no", async () => {
		// The answer is held back so the vote can be seen before it arrives.
		let answer: (response: Response) => void = () => undefined
		vi.mocked(galleryVote).mockImplementation(() => new Promise((resolve) => (answer = resolve)))
		renderGallery()
		const [first] = await screen.findAllByRole("article")
		fireEvent.click(within(first).getByRole("button", { name: /^Upvote/ }))
		expect(await within(first).findByRole("button", { name: /Remove your upvote \(15/ })).toBeInTheDocument()
		answer(new Response(JSON.stringify({ error: "Your account can't vote in the gallery." }), { status: 403 }))
		await waitFor(() => expect(within(first).getByRole("button", { name: /^Upvote \(14/ })).toBeInTheDocument())
		expect(toast.error).toHaveBeenCalledWith("Your account can't vote in the gallery.")
	})

	it("asks a guest to sign in instead of voting, with a way to do it", async () => {
		auth.isLoggedIn = false
		vi.mocked(galleryFeedFetch).mockImplementation(() => feed([row("aaaaaaa1", { my_vote: null })]))
		renderGallery()
		const [first] = await screen.findAllByRole("article")
		fireEvent.click(within(first).getByRole("button", { name: /^Upvote/ }))
		expect(toast).toHaveBeenCalledWith(
			"Sign in to upvote teams.",
			expect.objectContaining({ action: expect.objectContaining({ label: "Sign in" }) })
		)
		expect(galleryVote).not.toHaveBeenCalled()
		expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login")
	})

	it("marks your own post and shows it above the list", async () => {
		vi.mocked(galleryFeedFetch).mockImplementation(() =>
			feed([row("mine0001", { is_mine: true, my_vote: true }), row("bbbbbbb2")])
		)
		vi.mocked(galleryPostFetch).mockImplementation((id) => json(fullPost(id, { is_mine: true })))
		renderGallery(undefined, teamsValue({
			teams: [{ key: "t1", id: 7, kind: "cm", event: 19, name: "", members: [], notes: [], is_focus: false, post: "mine0001" }] as unknown as PvpTeamsContextType["teams"],
		}))
		const [mine] = await screen.findAllByRole("article")
		expect(within(mine).getByText("You")).toBeInTheDocument()
		expect(within(mine).queryByRole("button", { name: /upvote/i })).not.toBeInTheDocument()
		expect(await screen.findByText("Your post")).toBeInTheDocument()
		expect(screen.getByText("14 upvotes")).toBeInTheDocument()
	})

	it("offers to post when you have not", async () => {
		const { onOpenMyTeam } = renderGallery()
		fireEvent.click(await screen.findByRole("button", { name: "Post a team" }))
		expect(onOpenMyTeam).toHaveBeenCalled()
	})

	it("says so when nobody has posted", async () => {
		vi.mocked(galleryFeedFetch).mockImplementation(() => feed([], { umas: [] }))
		const { onOpenMyTeam } = renderGallery()
		expect(await screen.findByText("Nobody has posted a team for Libra Cup yet.")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Build yours on My team" }))
		expect(onOpenMyTeam).toHaveBeenCalled()
	})

	it("offers to try again when the feed fails", async () => {
		vi.mocked(galleryFeedFetch).mockImplementationOnce(() => json({}, 500))
		renderGallery()
		fireEvent.click(await screen.findByRole("button", { name: "Try again" }))
		expect(await screen.findAllByRole("article")).toHaveLength(3)
	})
})

describe("the post panel", () => {
	it("opens from its link, counts one view and draws the team with its caption in full", async () => {
		renderGallery("/app/pvp?event=cm-19&view=gallery&post=aaaaaaa1")
		const open = await panel()
		expect(await within(open).findByText("Maruzensky")).toBeInTheDocument()
		expect(within(open).getByText("Kitasan Black")).toBeInTheDocument()
		expect(within(open).getByText("Caption aaaaaaa1")).toBeInTheDocument()
		expect(within(open).getByText("3 copies")).toBeInTheDocument()
		expect(galleryView).toHaveBeenCalledTimes(1)
		expect(galleryView).toHaveBeenCalledWith("aaaaaaa1")
	})

	it("shows the strategy under the team, and no section without one", async () => {
		vi.mocked(galleryPostFetch).mockImplementation((id) =>
			json(fullPost(id, { strategy: id === "aaaaaaa1" ? "Pace in front.\nEnd closes." : "" }))
		)
		renderGallery("/app/pvp?event=cm-19&view=gallery&post=aaaaaaa1")
		const open = await panel()
		const strategy = await within(open).findByRole("region", { name: "Strategy" })
		expect(strategy).toHaveTextContent("Pace in front. End closes.")
		fireEvent.click(screen.getByRole("button", { name: "Next team" }))
		await waitFor(() => expect(screen.getByTestId("address").textContent).toContain("post=bbbbbbb2"))
		await within(await panel()).findByText("Caption bbbbbbb2")
		expect(screen.queryByRole("region", { name: "Strategy" })).not.toBeInTheDocument()
	})

	it("opens from the list and closes back to it", async () => {
		renderGallery()
		const [first] = await screen.findAllByRole("article")
		fireEvent.click(within(first).getByRole("link", { name: /^Open/ }))
		await panel()
		expect(screen.getByTestId("address").textContent).toContain("post=aaaaaaa1")
		fireEvent.click(screen.getByRole("button", { name: "Close" }))
		await waitFor(() => expect(screen.getByTestId("address").textContent).not.toContain("post="))
		// The post slides out before it leaves the page.
		await waitFor(() => expect(screen.queryByRole("region", { name: "Poster free's team" })).not.toBeInTheDocument())
	})

	it("steps to the next team in the list", async () => {
		renderGallery("/app/pvp?event=cm-19&view=gallery&post=aaaaaaa1")
		await panel()
		await screen.findAllByRole("article")
		expect(screen.getByRole("button", { name: "Previous team" })).toBeDisabled()
		fireEvent.click(screen.getByRole("button", { name: "Next team" }))
		await waitFor(() => expect(screen.getByTestId("address").textContent).toContain("post=bbbbbbb2"))
	})

	it("copies the team into My team, minus what is not out by the event", async () => {
		vi.mocked(galleryCopy).mockImplementation(() => json({ kind: "cm", event: 19, members: TEAM }))
		const { teams } = renderGallery("/app/pvp?event=cm-19&view=gallery&post=aaaaaaa1")
		fireEvent.click(await screen.findByRole("button", { name: "Copy to My team" }))
		await waitFor(() => expect(teams.createTeam).toHaveBeenCalled())
		expect(teams.createTeam).toHaveBeenCalledWith({ kind: "cm", id: 19 }, {
			members: [{ position: 0, uma: 41, style: "front", cards: [{ slot: 1, support_card: 302 }] }],
		})
		expect(toast.success).toHaveBeenCalledWith("Copied to My team.", expect.anything())
	})

	it("copies the permanent /post link", async () => {
		const writeText = vi.fn(() => Promise.resolve())
		Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
		renderGallery("/app/pvp?event=cm-19&view=gallery&post=aaaaaaa1")
		fireEvent.click(await screen.findByRole("button", { name: "Copy link" }))
		await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/post/aaaaaaa1`))
	})

	it("says when a post is not available", async () => {
		vi.mocked(galleryPostFetch).mockImplementation(() => json({ error: "This team isn't available any more." }, 404))
		renderGallery("/app/pvp?event=cm-19&view=gallery&post=gone0000")
		expect(await screen.findByText("This team isn't available any more.")).toBeInTheDocument()
		expect(galleryView).not.toHaveBeenCalled()
	})

	it("keeps the post open when Escape closes a report over it", async () => {
		renderGallery("/app/pvp?event=cm-19&view=gallery&post=aaaaaaa1")
		fireEvent.click(await screen.findByRole("button", { name: "Report" }))
		const report = await screen.findByRole("dialog", { name: "Report this team" })
		fireEvent.keyDown(within(report).getAllByRole("radio")[0], { key: "Escape" })
		// The browser's answer to Escape on a modal dialog, which jsdom does not send.
		fireEvent(report, new Event("cancel", { cancelable: true }))
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "Report this team" })).not.toBeInTheDocument())
		expect(screen.getByRole("region", { name: "Poster free's team" })).toBeInTheDocument()
		expect(screen.getByTestId("address").textContent).toContain("post=aaaaaaa1")
	})

	it("shows a refused report inside the dialog", async () => {
		vi.mocked(galleryReport).mockImplementation(() => json({ error: "You already reported this." }, 409))
		renderGallery("/app/pvp?event=cm-19&view=gallery&post=aaaaaaa1")
		fireEvent.click(await screen.findByRole("button", { name: "Report" }))
		const report = await screen.findByRole("dialog", { name: "Report this team" })
		fireEvent.click(within(report).getAllByRole("radio")[0])
		fireEvent.click(within(report).getByRole("button", { name: "Send report" }))
		expect(await within(report).findByRole("alert")).toHaveTextContent("You already reported this.")
	})

	it("draws each comment state", async () => {
		const comment = (id: number, extra: Partial<GalleryComment>): GalleryComment => ({
			id, state: "visible", body: `Body ${id}`, created_at: "2026-10-11T00:00:00Z", edited: false,
			earlier_version: false, is_author: false, is_mine: false, poster: poster(null), replies: [], ...extra,
		})
		vi.mocked(galleryCommentsFetch).mockImplementation(() =>
			json({
				count: 2, page: 1, has_more: false,
				results: [
					comment(1, { earlier_version: true, edited: true, replies: [comment(2, { is_author: true })] }),
					comment(3, { state: "deleted", body: "", poster: null, replies: [comment(4, {})] }),
				],
			})
		)
		renderGallery("/app/pvp?event=cm-19&view=gallery&post=aaaaaaa1")
		expect(await screen.findByText("On an earlier version of this team")).toBeInTheDocument()
		expect(screen.getByText("(edited)")).toBeInTheDocument()
		expect(screen.getByText("Author")).toBeInTheDocument()
		expect(screen.getByText("[deleted]")).toBeInTheDocument()
		expect(screen.getByText("Body 4")).toBeInTheDocument()
		expect(screen.getAllByRole("button", { name: "Reply" }).length).toBeGreaterThan(0)
	})

	it("offers no Reply without a display name, and says what to set", async () => {
		auth.account = { display_name: "" }
		vi.mocked(galleryCommentsFetch).mockImplementation(() =>
			json({
				count: 1, page: 1, has_more: false,
				results: [{
					id: 1, state: "visible", body: "Nice", created_at: "2026-10-11T00:00:00Z", edited: false,
					earlier_version: false, is_author: false, is_mine: false, poster: poster(null), replies: [],
				}],
			})
		)
		renderGallery("/app/pvp?event=cm-19&view=gallery&post=aaaaaaa1")
		expect(await screen.findByText("Nice")).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument()
		expect(screen.getByRole("link", { name: "Set a display name" })).toHaveAttribute("href", "/account")
	})
})

describe("the post dialog", () => {
	function renderDialog(displayName: string, onPosted = vi.fn(), ownPost: string | null = null) {
		render(
			<MemoryRouter>
				<TestQueryProvider>
					<PublishDialog
						teamId={5}
						displayName={displayName}
						replacing={ownPost !== null}
						ownPost={ownPost}
						onPosted={onPosted}
						onClose={vi.fn()}
					/>
				</TestQueryProvider>
			</MemoryRouter>
		)
		return onPosted
	}

	it("posts only once the box is ticked", async () => {
		vi.mocked(pvpTeamPublish).mockImplementation(() => json(fullPost("aaaaaaa1"), 201))
		const onPosted = renderDialog("Rhondal")
		const post = screen.getByRole("button", { name: "Post team" })
		expect(post).toBeDisabled()
		fireEvent.change(screen.getByRole("textbox", { name: /Caption/ }), { target: { value: "  Runaway blocker " } })
		fireEvent.change(screen.getByRole("textbox", { name: /Strategy/ }), { target: { value: "Pace in front.\n\nEnd closes. " } })
		fireEvent.click(screen.getByRole("checkbox"))
		fireEvent.click(post)
		await waitFor(() => expect(onPosted).toHaveBeenCalled())
		expect(pvpTeamPublish).toHaveBeenCalledWith(5, "Runaway blocker", "Pace in front.\n\nEnd closes.")
	})

	it("starts an update from the post's own words", async () => {
		vi.mocked(galleryPostFetch).mockImplementation((id) =>
			json(fullPost(id, { caption: "Old caption", strategy: "Old strategy" }))
		)
		renderDialog("Rhondal", vi.fn(), "aaaaaaa1")
		expect(await screen.findByRole("textbox", { name: /Strategy/ })).toHaveValue("Old strategy")
		expect(screen.getByRole("textbox", { name: /Caption/ })).toHaveValue("Old caption")
		expect(screen.getByRole("button", { name: "Update post" })).toBeInTheDocument()
	})

	it("marks the box a refusal names", async () => {
		vi.mocked(pvpTeamPublish).mockImplementation(() =>
			json({ error: "Links can't be posted in the gallery.", field: "strategy" }, 400)
		)
		renderDialog("Rhondal")
		fireEvent.click(screen.getByRole("checkbox"))
		fireEvent.click(screen.getByRole("button", { name: "Post team" }))
		expect(await screen.findByRole("alert")).toHaveTextContent("Links can't be posted in the gallery.")
		expect(screen.getByRole("textbox", { name: /Strategy/ })).toHaveAttribute("aria-invalid", "true")
		expect(screen.getByRole("textbox", { name: /Caption/ })).not.toHaveAttribute("aria-invalid")
	})

	it("shows a refusal next to the caption", async () => {
		vi.mocked(pvpTeamPublish).mockImplementation(() => json({ error: "That caption has a word we don't allow." }, 400))
		renderDialog("Rhondal")
		fireEvent.click(screen.getByRole("checkbox"))
		fireEvent.click(screen.getByRole("button", { name: "Post team" }))
		expect(await screen.findByRole("alert")).toHaveTextContent("That caption has a word we don't allow.")
		expect(toast.error).not.toHaveBeenCalled()
	})

	it("sends someone with no display name to set one", () => {
		renderDialog("")
		expect(screen.getByRole("link", { name: "Set a display name" })).toHaveAttribute("href", "/account")
		expect(screen.queryByRole("button", { name: "Post team" })).not.toBeInTheDocument()
	})
})

describe("withinRelease", () => {
	it("drops what is not out by the event, an uma taking its deck with it", () => {
		const blocked = new Set(["support-303", "uma-12"])
		const releaseFor = (pool: "uma" | "support", id: number) =>
			blocked.has(`${pool}-${id}`) ? ({ kind: "after", date: "2040/1/1" } as const) : ({ kind: "available" } as const)
		const members: PvpTeamMember[] = [
			...TEAM,
			{ position: 1, uma: 12, style: "pace", cards: [{ slot: 1, support_card: 302 }] },
		]
		expect(withinRelease(members, releaseFor)).toEqual([
			{ position: 0, uma: 41, style: "front", cards: [{ slot: 1, support_card: 302 }] },
		])
	})
})
