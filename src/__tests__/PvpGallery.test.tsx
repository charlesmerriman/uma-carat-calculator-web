/**
 * The PvP gallery: the feed (sorts, rows by look, votes), the post panel
 * (deep link, view, copy, share, missing post), the comment thread's states,
 * the post dialog, and the release filter a copied team goes through.
 *
 * The routes are mocked; their rules are tested in the API
 * (test_gallery.py, test_pvp_gallery.py).
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
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
	galleryView,
	galleryVote,
	pvpTeamPublish,
} from "../services/galleryFetchCalls"
import { withinRelease } from "../utils/pvpTeams"
import type { RaceEvent } from "../types"
import type { GalleryComment, GalleryPost, GalleryRow } from "../types/gallery"
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
vi.mock("../services/AuthContext", () => ({ useAccount: () => auth }))

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

function renderGallery(url = "/app/pvp?event=cm-19&view=gallery", teams = teamsValue(), onOpenMyTeam = vi.fn()) {
	render(
		<MemoryRouter initialEntries={[url]}>
			<PvpTeamsContext.Provider value={teams}>
				<GalleryView event={LIBRA} onOpenMyTeam={onOpenMyTeam} />
			</PvpTeamsContext.Provider>
		</MemoryRouter>
	)
	return { teams, onOpenMyTeam }
}

beforeEach(() => {
	auth.isLoggedIn = true
	auth.account = { display_name: "Rhondal" }
	vi.mocked(galleryFeedFetch).mockImplementation((_ref, sort) =>
		json({
			count: 3, sort, page: 1, has_more: false,
			results: [
				row("aaaaaaa1", { poster: poster("ssr", "Senior Class") }),
				row("bbbbbbb2", { poster: poster("sr", "Classic Class") }),
				row("ccccccc3", { poster: poster("rose", "Junior Class") }),
			],
		})
	)
	vi.mocked(galleryCommentsFetch).mockImplementation(() => json({ count: 0, page: 1, has_more: false, results: [] }))
})

afterEach(() => vi.clearAllMocks())

describe("the feed", () => {
	it("draws each supporter look by its key, with the tier name as text", async () => {
		renderGallery()
		const rows = await screen.findAllByRole("article")
		expect(rows[0]).toHaveClass("ssr-panel")
		expect(rows[1]).toHaveAttribute("data-gallery-style", "sr")
		expect(rows[2]).toHaveAttribute("data-gallery-style", "rose")
		expect(within(rows[0]).getByText("Senior Class")).toBeInTheDocument()
		expect(within(rows[1]).getByText("212 views")).toBeInTheDocument()
		expect(screen.getByText("3 teams")).toBeInTheDocument()
	})

	it("asks the API for the sort the tabs choose", async () => {
		renderGallery()
		await screen.findAllByRole("article")
		fireEvent.click(screen.getByRole("button", { name: "Top" }))
		await waitFor(() => expect(galleryFeedFetch).toHaveBeenLastCalledWith({ kind: "cm", id: 19 }, "top", 1))
		expect(screen.getByRole("button", { name: "Top" })).toHaveAttribute("aria-pressed", "true")
	})

	it("moves the vote at once and puts it back when the server says no", async () => {
		vi.mocked(galleryVote).mockImplementation(() => json({ error: "Your account can't vote in the gallery." }, 403))
		renderGallery()
		const [first] = await screen.findAllByRole("article")
		fireEvent.click(within(first).getByRole("button", { name: /^Upvote/ }))
		expect(within(first).getByRole("button", { name: /Remove your upvote \(15/ })).toBeInTheDocument()
		await waitFor(() => expect(within(first).getByRole("button", { name: /^Upvote \(14/ })).toBeInTheDocument())
		expect(toast.error).toHaveBeenCalledWith("Your account can't vote in the gallery.")
	})

	it("asks a guest to sign in instead of voting", async () => {
		auth.isLoggedIn = false
		vi.mocked(galleryFeedFetch).mockImplementation(() =>
			json({ count: 1, sort: "hot", page: 1, has_more: false, results: [row("aaaaaaa1", { my_vote: null })] })
		)
		renderGallery()
		const [first] = await screen.findAllByRole("article")
		fireEvent.click(within(first).getByRole("button", { name: /^Upvote/ }))
		expect(toast).toHaveBeenCalledWith("Sign in to upvote teams.")
		expect(galleryVote).not.toHaveBeenCalled()
	})

	it("says so when nobody has posted", async () => {
		vi.mocked(galleryFeedFetch).mockImplementation(() => json({ count: 0, sort: "hot", page: 1, has_more: false, results: [] }))
		const { onOpenMyTeam } = renderGallery()
		expect(await screen.findByText("Nobody has posted a team for Libra Cup yet.")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Build yours on My team" }))
		expect(onOpenMyTeam).toHaveBeenCalled()
	})
})

describe("the post panel", () => {
	it("opens from its link, counts one view and draws the team", async () => {
		vi.mocked(galleryPostFetch).mockImplementation(() => json(fullPost("aaaaaaa1")))
		renderGallery("/app/pvp?event=cm-19&view=gallery&post=aaaaaaa1")
		const panel = await screen.findByRole("dialog", { name: "Caption aaaaaaa1" })
		expect(await within(panel).findByText("Maruzensky")).toBeInTheDocument()
		expect(within(panel).getByText("3 copies")).toBeInTheDocument()
		expect(galleryView).toHaveBeenCalledTimes(1)
		expect(galleryView).toHaveBeenCalledWith("aaaaaaa1")
	})

	it("copies the team into My team, minus what is not out by the event", async () => {
		vi.mocked(galleryPostFetch).mockImplementation(() => json(fullPost("aaaaaaa1")))
		vi.mocked(galleryCopy).mockImplementation(() => json({ kind: "cm", event: 19, members: TEAM }))
		const { teams } = renderGallery("/app/pvp?event=cm-19&view=gallery&post=aaaaaaa1")
		fireEvent.click(await screen.findByRole("button", { name: "Copy to my teams" }))
		await waitFor(() => expect(teams.createTeam).toHaveBeenCalled())
		expect(teams.createTeam).toHaveBeenCalledWith({ kind: "cm", id: 19 }, {
			members: [{ position: 0, uma: 41, style: "front", cards: [{ slot: 1, support_card: 302 }] }],
		})
		expect(toast.success).toHaveBeenCalledWith("Copied to My team.", expect.anything())
	})

	it("copies the permanent /post link", async () => {
		const writeText = vi.fn(() => Promise.resolve())
		Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
		vi.mocked(galleryPostFetch).mockImplementation(() => json(fullPost("aaaaaaa1")))
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

	it("draws each comment state", async () => {
		const comment = (id: number, extra: Partial<GalleryComment>): GalleryComment => ({
			id, state: "visible", body: `Body ${id}`, created_at: "2026-10-11T00:00:00Z", edited: false,
			earlier_version: false, is_author: false, is_mine: false, poster: poster(null), replies: [], ...extra,
		})
		vi.mocked(galleryPostFetch).mockImplementation(() => json(fullPost("aaaaaaa1")))
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
	})
})

describe("the post dialog", () => {
	function renderDialog(displayName: string, onPosted = vi.fn()) {
		render(
			<MemoryRouter>
				<PublishDialog teamId={5} displayName={displayName} replacing={false} onPosted={onPosted} onClose={vi.fn()} />
			</MemoryRouter>
		)
		return onPosted
	}

	it("posts only once the box is ticked", async () => {
		vi.mocked(pvpTeamPublish).mockImplementation(() => json(fullPost("aaaaaaa1"), 201))
		const onPosted = renderDialog("Rhondal")
		const post = screen.getByRole("button", { name: "Post team" })
		expect(post).toBeDisabled()
		fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Runaway blocker " } })
		fireEvent.click(screen.getByRole("checkbox"))
		fireEvent.click(post)
		await waitFor(() => expect(onPosted).toHaveBeenCalled())
		expect(pvpTeamPublish).toHaveBeenCalledWith(5, "Runaway blocker")
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
