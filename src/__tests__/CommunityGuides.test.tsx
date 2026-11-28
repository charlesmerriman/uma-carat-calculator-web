/**
 * Community guides on the PvP page (components/pvp/community/CommunityGuides.tsx,
 * notes/community-guides-plan.md): the event's list, one guide opened with its
 * band and one thread, and what the reader hands the guide view.
 *
 * PvpGuideView has its own tests; here a stand-in shows what it was given
 * and which of the two "a player wrote this" contexts it sits in. The routes
 * are mocked; their rules are tested in the API (test_guide_gallery.py).
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TestQueryProvider } from "../test/TestQueryProvider"
import { galleryCommentsFetch, galleryPostFetch, galleryReport, galleryView } from "../services/galleryFetchCalls"
import { guideDeckUsed, guideFeedFetch } from "../services/guideGalleryFetchCalls"
import type { RaceEvent } from "../types"
import type { GuideFeed, GuidePost, GuidePostRow } from "../types/gallery"
import type { PvpDeck, PvpGuide } from "../types/pvpGuide"

const EVENT = {
	id: 20, event_type: "champions_meeting", cm_number: 20, name: "Champions Meeting 20 Sagittarius Cup",
	start_date: "2026-10-10T00:00:00Z", end_date: "2026-10-16T00:00:00Z", is_predicted: false,
} as unknown as RaceEvent

vi.mock("../hooks/usePvpCatalogue", () => ({
	usePvpCatalogue: () => ({
		status: "ready",
		catalogue: { umas: [], support_cards: [], skills: [] },
		umasById: new Map([
			[41, { id: 41, name: "Maruzensky", image: null, portrait: "m.png", character_id: 1004 }],
			[12, { id: 12, name: "Oguri Cap", image: null, portrait: "o.png", character_id: 1006 }],
		]),
		cardsById: new Map(),
		skillsById: new Map(),
	}),
}))

const auth = vi.hoisted(() => ({ isLoggedIn: true, account: { display_name: "Dab" } as { display_name: string } | null }))
vi.mock("../services/AuthContext", async () => ({
	...(await vi.importActual<typeof import("../services/AuthContext")>("../services/AuthContext")),
	useAccount: () => auth,
}))

vi.mock("../services/galleryFetchCalls", async () => ({
	...(await vi.importActual<typeof import("../services/galleryFetchCalls")>("../services/galleryFetchCalls")),
	galleryPostFetch: vi.fn(),
	galleryView: vi.fn(),
	galleryVote: vi.fn(),
	galleryCommentsFetch: vi.fn(),
	galleryReport: vi.fn(),
	galleryPostTakeDown: vi.fn(),
}))
vi.mock("../services/guideGalleryFetchCalls", async () => ({
	...(await vi.importActual<typeof import("../services/guideGalleryFetchCalls")>("../services/guideGalleryFetchCalls")),
	guideFeedFetch: vi.fn(),
	guideDeckUsed: vi.fn(),
}))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

// The guide view, standing in: what it was handed, and the contexts around it.
const DECK = { id: 7, style: "front", label: "Budget", note: "", is_highlighted: false, slots: [] } as unknown as PvpDeck
vi.mock("../components/pvp/PvpGuideView", async () => {
	const { useIsCommunityGuide } = await import("../components/pvp/communityGuideContext")
	const { useUntrustedText } = await import("../components/info/untrustedText")
	return {
		PvpGuideView: ({ guide, onUseDeck }: { guide: PvpGuide; onUseDeck?: (deck: PvpDeck) => void }) => (
			<div data-testid="guide-view">
				<span>{guide.style_ranking}</span>
				<span>{`community:${String(useIsCommunityGuide())} untrusted:${String(useUntrustedText())}`}</span>
				{onUseDeck && <button type="button" onClick={() => onUseDeck(DECK)}>Use this deck</button>}
			</div>
		),
	}
})

const { CommunityGuides } = await import("../components/pvp/community/CommunityGuides")

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))

const poster = { display_name: "MooncakeMile", portrait: null, tier_name: "Senior Class", gallery_style: "ssr" as const }

function row(publicId: string, extra: Partial<GuidePostRow> = {}): GuidePostRow {
	return {
		public_id: publicId,
		kind: "pvp_guide",
		caption: `Guide ${publicId}`,
		published_at: "2026-10-08T00:00:00Z",
		content_updated_at: "2026-10-08T00:00:00Z",
		is_mine: false,
		stats: { views: 1204, score: 41, comments: 12 },
		my_vote: "none",
		poster,
		event: { kind: "cm", id: 20, label: EVENT.name },
		umas: [{ uma: 41 }, { uma: 12 }],
		...extra,
	}
}

function post(publicId: string, extra: Partial<GuidePost> = {}): GuidePost {
	return {
		...row(publicId),
		strategy: "",
		hidden: false,
		stats: { views: 1204, score: 41, comments: 12, copies: 3 },
		guide: { style_ranking: "Front >> End" } as unknown as PvpGuide,
		...extra,
	}
}

function renderGuides({ openGuide = null, onUseDeck = vi.fn(), onSort = vi.fn(), onBack = vi.fn() }: {
	openGuide?: string | null
	onUseDeck?: (deck: PvpDeck) => void
	onSort?: (sort: "top" | "new") => void
	onBack?: () => void
} = {}) {
	render(
		<TestQueryProvider>
			<MemoryRouter>
				<CommunityGuides
					event={EVENT}
					sort="top"
					onSort={onSort}
					openGuide={openGuide}
					guideHref={(id) => `?guide=${id}`}
					onBack={onBack}
					style={null}
					onStyleChange={vi.fn()}
					onUseDeck={onUseDeck}
					top={<span>the switch</span>}
				/>
			</MemoryRouter>
		</TestQueryProvider>
	)
	return { onUseDeck, onSort, onBack }
}

beforeEach(() => {
	vi.mocked(guideFeedFetch).mockReset()
	vi.mocked(galleryPostFetch).mockReset()
	vi.mocked(galleryCommentsFetch).mockReset().mockImplementation(() => json({ count: 0, page: 1, has_more: false, results: [] }))
	vi.mocked(galleryView).mockReset()
	vi.mocked(guideDeckUsed).mockReset()
})

describe("the list", () => {
	it("draws each guide with its title, writer, lead umas and counts, each a link to the guide", async () => {
		const feed: GuideFeed = { count: 2, sort: "top", has_more: false, results: [row("AAA11111"), row("BBB22222", { umas: [] })] }
		vi.mocked(guideFeedFetch).mockImplementation(() => json(feed))
		renderGuides()
		const list = await screen.findByRole("list", { name: `Community guides for ${EVENT.name}` })
		const first = within(list).getAllByRole("listitem")[0]
		expect(within(first).getByText("Guide AAA11111")).toBeInTheDocument()
		expect(within(first).getByText("MooncakeMile")).toBeInTheDocument()
		expect(within(first).getByText("Maruzensky")).toBeInTheDocument()
		expect(within(first).getByText(/1,?204 views/)).toBeInTheDocument()
		expect(within(first).getByRole("link", { name: "Open Guide AAA11111" })).toHaveAttribute("href", "/?guide=AAA11111")
		expect(screen.getByText("the switch")).toBeInTheDocument()
		expect(vi.mocked(guideFeedFetch).mock.calls[0]).toEqual([{ kind: "cm", id: 20 }, "top"])
	})

	it("sorts by Top or New, and says when there are none yet", async () => {
		vi.mocked(guideFeedFetch).mockImplementation(() => json({ count: 0, sort: "top", has_more: false, results: [] }))
		const { onSort } = renderGuides()
		expect(await screen.findByText("No community guides for this event yet.")).toBeInTheDocument()
		const sorts = screen.getByRole("group", { name: "Sort guides" })
		expect(within(sorts).getByRole("button", { name: "Top" })).toHaveAttribute("aria-pressed", "true")
		fireEvent.click(within(sorts).getByRole("button", { name: "New" }))
		expect(onSort).toHaveBeenCalledWith("new")
	})
})

describe("one guide", () => {
	it("draws the band, the guide as a player's, and one thread, and counts a view", async () => {
		vi.mocked(galleryPostFetch).mockImplementation(() => json(post("AAA11111")))
		renderGuides({ openGuide: "AAA11111" })
		expect(await screen.findByRole("heading", { name: "Guide AAA11111" })).toBeInTheDocument()
		const view = screen.getByTestId("guide-view")
		expect(view).toHaveTextContent("Front >> End")
		// Its text draws no pictures or links, and its per-section threads stand aside.
		expect(view).toHaveTextContent("community:true untrusted:true")
		expect(await screen.findByRole("region", { name: "Comments" })).toBeInTheDocument()
		await waitFor(() => expect(galleryCommentsFetch).toHaveBeenCalledWith("AAA11111", 1))
		expect(galleryView).toHaveBeenCalledWith("AAA11111")
		expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument()
	})

	it("hands the deck itself to My team, and counts it", async () => {
		vi.mocked(galleryPostFetch).mockImplementation(() => json(post("AAA11111")))
		const { onUseDeck } = renderGuides({ openGuide: "AAA11111" })
		fireEvent.click(await screen.findByRole("button", { name: "Use this deck" }))
		expect(onUseDeck).toHaveBeenCalledWith(DECK)
		expect(guideDeckUsed).toHaveBeenCalledWith("AAA11111")
	})

	it("offers Report on someone else's guide and Take down on your own", async () => {
		vi.mocked(galleryPostFetch).mockImplementation(() => json(post("AAA11111")))
		vi.mocked(galleryReport).mockImplementation(() => json({}, 201))
		renderGuides({ openGuide: "AAA11111" })
		fireEvent.click(await screen.findByRole("button", { name: "Report" }))
		expect(await screen.findByRole("dialog")).toBeInTheDocument()
	})

	it("lets the writer take their own guide down", async () => {
		vi.mocked(galleryPostFetch).mockImplementation(() => json(post("MINE1111", { is_mine: true })))
		renderGuides({ openGuide: "MINE1111" })
		fireEvent.click(await screen.findByRole("button", { name: "Take down" }))
		expect(screen.getByText("Take it down?")).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "Report" })).not.toBeInTheDocument()
	})

	it("says when the guide is gone, with the way back", async () => {
		vi.mocked(galleryPostFetch).mockImplementation(() => json({ error: "This post isn't available any more." }, 404))
		const { onBack } = renderGuides({ openGuide: "GONE1111" })
		expect(await screen.findByText("This guide isn't available any more.")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "All community guides" }))
		expect(onBack).toHaveBeenCalled()
	})
})
