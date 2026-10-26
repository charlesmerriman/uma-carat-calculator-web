/**
 * "Use this deck" in My team (guide-visuals-plan-2.md, release C): the guide
 * hands a deck over in the router state; TeamBuilder offers the selected
 * team's spots, asks before replacing cards, opens the uma picker for an
 * empty spot, and puts the deck on with the team rules applied. The mapping
 * itself is unit-tested in pvpTeams.test.ts (deckToMemberCards).
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter, useLocation } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import { TeamBuilder } from "../components/pvp/TeamBuilder"
import { TestQueryProvider } from "../test/TestQueryProvider"
import { PvpTeamsContext, type PvpTeamsContextType } from "../services/PvpTeamsContext"
import type { RaceEvent } from "../types"
import type { PvpGuide } from "../types/pvpGuide"
import type { CatalogueSupportCard, CatalogueUma, PvpTeam, PvpTeamMember } from "../types/pvpTeam"

const EVENT = {
	id: 10, event_type: "champions_meeting", cm_number: 10, name: "Aquarius Cup", start_date: "2020-01-01T00:00:00Z",
	end_date: "2099-01-01T00:00:00Z", is_predicted: false, surface_type: "Turf", distance: "Mile", length: "",
} as unknown as RaceEvent

const apt = { turf: 8, dirt: 1, short: 3, mile: 7, medium: 6, long: 4, front: 5, pace: 7, late: 7, end: 3 }
const uma = (id: number, name: string, running_style: number): CatalogueUma => ({
	id, name, image: null, portrait: null, rarity: 3, running_style, character_id: id, is_variant: false, apt, skills: [],
})
const UMAS = [uma(1, "Oguri Cap", 3), uma(3, "Maruzensky", 1), uma(6, "Taiki Shuttle", 2)]
const card = (id: number, name: string): CatalogueSupportCard => ({ id, name, image: null, card_type: "speed", rarity: 3, title: "", skills: [] })
const CARDS = [card(302, "Agnes Tachyon"), card(304, "Kitasan Black"), card(308, "Oguri Cap")]

vi.mock("../hooks/usePvpCatalogue", () => ({
	usePvpCatalogue: () => ({
		status: "ready",
		catalogue: { umas: UMAS, support_cards: CARDS, skills: [] },
		umasById: new Map(UMAS.map((each) => [each.id, each])),
		cardsById: new Map(CARDS.map((each) => [each.id, each])),
		skillsById: new Map(),
	}),
}))
// Everything is out in time; the release rule has its own tests.
vi.mock("../hooks/useCardReleases", () => ({ useCardReleases: () => () => ({ kind: "available" }) }))
vi.mock("../services/CalculatorContext", () => ({
	useCalculatorData: () => ({ championsMeetingData: [EVENT], leagueOfHeroesData: [], umaBannerData: [], supportBannerData: [] }),
}))
vi.mock("../services/AuthContext", async () => ({
	...(await vi.importActual<typeof import("../services/AuthContext")>("../services/AuthContext")),
	useAccount: () => ({ account: null, isLoggedIn: false }),
}))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

const slot = (number: number, extra: Record<string, unknown>) => ({ slot: number, order: 0, is_borrow: false, note: "", support_card: null, ...extra })
const ref = (id: number, name: string) => ({ id, name, image: null, card_type: "speed", rarity: 3 })
const GUIDE = {
	event_type: "champions_meeting", event: 10, is_published: true, updated_at: "2099-01-01T00:00:00Z", scenario: null,
	style_ranking: "", short_description: "", meta_analysis: "", team_comps: [], stat_configs: [],
	uma_recommendations: [], skill_recommendations: [], style_notes: [], skill_mentions: {}, comment_counts: {},
	decks: [
		{
			id: 1, style: "pace", label: "Standard", note: "", is_highlighted: false,
			slots: [
				slot(1, { support_card: ref(304, "Kitasan Black") }),
				slot(2, { support_card: ref(308, "Oguri Cap") }),
				slot(3, { note: "Any Wit" }),
				slot(6, { is_borrow: true, support_card: ref(302, "Agnes Tachyon") }),
			],
		},
	],
} as unknown as PvpGuide
vi.mock("../hooks/usePvpGuide", () => ({ usePvpGuide: () => ({ status: "ready", guide: GUIDE }) }))

const MEMBERS: PvpTeamMember[] = [
	{ position: 0, uma: 1, style: "late" as const, cards: [{ slot: 1, support_card: 304 }, { slot: 2, support_card: 302 }] },
	{ position: 1, uma: 3, style: "front" as const, cards: [] },
]
const team = (key: string, members = MEMBERS): PvpTeam => ({
	key, id: null, kind: "cm", event: 10, name: "", isFocus: false, notes: [], members, updatedAt: 0,
})

function teamsValue(teams: PvpTeam[]): PvpTeamsContextType {
	return {
		status: "ready", mode: "guest", teams, saveState: "idle",
		ensureLoaded: vi.fn(), createTeam: vi.fn(() => "new"), editTeam: vi.fn(), renameTeam: vi.fn(), pinTeam: vi.fn(), deleteTeam: vi.fn(), setTeamPost: vi.fn(),
	}
}

function HistoryState() {
	return <div data-testid="history-state">{JSON.stringify(useLocation().state)}</div>
}

function renderBuilder(value: PvpTeamsContextType, state: unknown = { useDeck: { deckId: 1 } }) {
	render(
		<MemoryRouter initialEntries={[{ pathname: "/app/pvp", search: "?event=cm-10&view=team", state }]}>
			<TestQueryProvider>
				<PvpTeamsContext.Provider value={value}>
					<TeamBuilder event={EVENT} />
					<HistoryState />
				</PvpTeamsContext.Provider>
			</TestQueryProvider>
		</MemoryRouter>
	)
	return value
}

const banner = () => within(screen.getByRole("region", { name: "Use a guide deck" }))

beforeEach(() => {
	vi.mocked(toast.success).mockClear()
	localStorage.clear()
})

describe("Use this deck in My team", () => {
	it("offers the spots, and clears the hand-over from history so a reload never offers it again", async () => {
		renderBuilder(teamsValue([team("t1")]))
		expect(banner().getByText("Use the Pace Standard deck on:")).toBeInTheDocument()
		expect(banner().getAllByRole("button").map((button) => button.textContent)).toEqual([
			"", // Cancel (an icon)
			"Spot 1 · Oguri Cap",
			"Spot 2 · Maruzensky",
			"Spot 3 · empty, pick an uma",
			"New team",
		])
		await waitFor(() => expect(screen.getByTestId("history-state").textContent).toBe("null"))
		expect(screen.getByRole("region", { name: "Use a guide deck" })).toBeInTheDocument()
	})

	it("puts the deck on an uma with no cards at once, in the deck's style, and Undo puts the team back", () => {
		const value = renderBuilder(teamsValue([team("t1")]))
		fireEvent.click(banner().getByRole("button", { name: "Spot 2 · Maruzensky" }))
		expect(value.editTeam).toHaveBeenCalledWith("t1", {
			members: [
				MEMBERS[0],
				{ position: 1, uma: 3, style: "pace", cards: [{ slot: 1, support_card: 304 }, { slot: 2, support_card: 308 }, { slot: 6, support_card: 302 }] },
			],
		})
		expect(screen.queryByRole("region", { name: "Use a guide deck" })).not.toBeInTheDocument()
		const [message, options] = vi.mocked(toast.success).mock.calls[0]
		expect(message).toBe("Pace Standard deck on spot 2, Maruzensky.")
		expect(options?.description).toBe("Card 3 is left for any Wit card.")
		const action = options?.action as { label: string; onClick: () => void }
		expect(action.label).toBe("Undo")
		action.onClick()
		expect(value.editTeam).toHaveBeenLastCalledWith("t1", { members: MEMBERS })
	})

	it("asks before replacing a deck, keeps it on Keep them, and skips the card she can't take", () => {
		const value = renderBuilder(teamsValue([team("t1")]))
		fireEvent.click(banner().getByRole("button", { name: "Spot 1 · Oguri Cap" }))
		expect(banner().getByText("Replace Oguri Cap’s 2 cards with the Pace Standard deck?")).toBeInTheDocument()
		fireEvent.click(banner().getByRole("button", { name: "Keep them" }))
		expect(value.editTeam).not.toHaveBeenCalled()

		fireEvent.click(banner().getByRole("button", { name: "Spot 1 · Oguri Cap" }))
		fireEvent.click(banner().getByRole("button", { name: "Replace" }))
		expect(value.editTeam).toHaveBeenCalledWith("t1", {
			members: [{ position: 0, uma: 1, style: "pace", cards: [{ slot: 1, support_card: 304 }, { slot: 6, support_card: 302 }] }, MEMBERS[1]],
		})
		expect(vi.mocked(toast.success).mock.calls[0][1]?.description).toBe(
			"Left out Oguri Cap: Oguri Cap can't support herself. Card 3 is left for any Wit card."
		)
	})

	it("opens the uma picker for an empty spot and puts the deck on whoever is picked", () => {
		const value = renderBuilder(teamsValue([team("t1")]))
		fireEvent.click(banner().getByRole("button", { name: "Spot 3 · empty, pick an uma" }))
		const dialog = within(screen.getByRole("dialog"))
		expect(dialog.getByText("An uma for the Pace Standard deck, spot 3")).toBeInTheDocument()
		fireEvent.click(dialog.getByRole("button", { name: /Taiki Shuttle/ }))
		expect(value.editTeam).toHaveBeenCalledWith("t1", {
			members: [
				...MEMBERS,
				{ position: 2, uma: 6, style: "pace", cards: [{ slot: 1, support_card: 304 }, { slot: 2, support_card: 308 }, { slot: 6, support_card: 302 }] },
			],
		})
	})

	it("closes on Cancel, and offers no new team at the cap", () => {
		const full = teamsValue(["a", "b", "c", "d", "e"].map((key) => team(key)))
		renderBuilder(full)
		expect(banner().getByRole("button", { name: "New team" })).toBeDisabled()
		fireEvent.click(banner().getByRole("button", { name: "Cancel" }))
		expect(screen.queryByRole("region", { name: "Use a guide deck" })).not.toBeInTheDocument()
		expect(full.editTeam).not.toHaveBeenCalled()
	})

	it("shows no banner when nothing was handed over", () => {
		renderBuilder(teamsValue([team("t1")]), null)
		expect(screen.queryByRole("region", { name: "Use a guide deck" })).not.toBeInTheDocument()
	})
})

describe("a member's veteran", () => {
	afterEach(() => vi.unstubAllGlobals())

	// Oguri's base Late is A (7); this veteran's is E (3).
	const veteran = {
		id: 5, uma: 1, label: "Main Oguri", speed: 1200, stamina: 800, power: 1000, guts: 400, wit: 900,
		apt: { ...apt, late: 3 }, skills: [], rank_score: null, source: "manual", import_key: null,
		missing_from_import: false, created_at: "", updated_at: "",
	}
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify([veteran]), { status: 200 }))))
	})

	it("picks one of the account's veterans of her outfit", async () => {
		const value = renderBuilder({ ...teamsValue([team("t1")]), mode: "account" }, null)
		const pick = await screen.findByRole("button", { name: "Veteran for Oguri Cap: none" })
		// Maruzensky has no veteran: no pick for her.
		expect(screen.queryByRole("button", { name: /Veteran for Maruzensky/ })).toBeNull()
		fireEvent.click(pick)
		fireEvent.click(within(screen.getByRole("dialog", { name: "Which Oguri Cap is she?" })).getByRole("button", { name: /Main Oguri/ }))
		expect(value.editTeam).toHaveBeenCalledWith("t1", { members: [{ ...MEMBERS[0], trained_uma: 5 }, MEMBERS[1]] })
	})

	it("reads a linked veteran's aptitude letters, not the uma's own", async () => {
		const linked = team("t1", [{ ...MEMBERS[0], trained_uma: 5 }, MEMBERS[1]])
		renderBuilder({ ...teamsValue([linked]), mode: "account" }, null)
		await waitFor(() => expect(screen.getAllByLabelText("Aptitudes for this race")[0].textContent).toContain("Late E"))
	})

	it("offers no pick to a guest", () => {
		renderBuilder(teamsValue([team("t1")]), null)
		expect(screen.queryByLabelText("Veteran for Oguri Cap")).toBeNull()
	})
})

