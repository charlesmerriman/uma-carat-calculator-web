/**
 * The PvP team as a picture: what it prints, and the button on the My team
 * bar. The drawing itself (html-to-image) needs a real browser, so the
 * button's test stubs it; it was checked by hand in headless Chrome.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TeamPicture } from "../components/pvp/share/TeamPicture"
import { ShareTeamButton } from "../components/pvp/share/ShareTeamButton"
import type { RaceEvent } from "../types"
import type { CatalogueSupportCard, CatalogueUma, PvpTeam, PvpTeamMember } from "../types/pvpTeam"
import type { TrainedUma } from "../types/trainedUma"
import { downloadImage } from "../utils/shareImage"

vi.mock("../utils/shareImage", () => ({
	renderNodeToPng: vi.fn(() => Promise.resolve(new Blob(["png"], { type: "image/png" }))),
	shareSupport: () => ({ copy: false, share: false }),
	copyImage: vi.fn(),
	shareImageFile: vi.fn(),
	downloadImage: vi.fn(),
}))
let displayName = ""
vi.mock("../services/AuthContext", async () => ({
	...(await vi.importActual<typeof import("../services/AuthContext")>("../services/AuthContext")),
	useAccount: () => ({ account: displayName ? { display_name: displayName, avatar_url: null } : null, isLoggedIn: !!displayName }),
}))

const NOW = new Date("2026-10-29T12:00:00Z")

const EVENT = {
	id: 21, event_type: "champions_meeting", cm_number: 21, name: "Champions Meeting 21 Capricorn Cup",
	start_date: "2026-10-31T22:00:00Z", end_date: "2026-11-06T21:59:59Z", image: "https://example.test/cm21.jpg",
	track: "Chukyo", surface_type: "Turf", distance: "Sprint", length: "1200", direction: "Left",
	track_condition: "Firm", season: "Winter", weather: "Sunny",
} as unknown as RaceEvent

const APT = { turf: 7, dirt: 1, short: 2, mile: 4, medium: 7, long: 7, front: 1, pace: 2, late: 6, end: 7 }
const uma = (id: number, name: string): CatalogueUma =>
	({ id, name, image: null, portrait: null, rarity: 3, running_style: null, character_id: id, is_variant: false, apt: APT, skills: [] }) as CatalogueUma
const UMAS = new Map([[1, uma(1, "Narita Taishin")], [2, uma(2, "Taiki Shuttle (Camping)")]])
const CARDS = new Map<number, CatalogueSupportCard>([
	[10, { id: 10, name: "Agnes Tachyon", image: null, card_type: "speed", rarity: 3, title: "", skills: [] }],
	[11, { id: 11, name: "Daiichi Ruby", image: null, card_type: "power", rarity: 3, title: "", skills: [] }],
])
const MEMBERS: PvpTeamMember[] = [
	{ position: 0, uma: 1, style: "end", cards: [{ slot: 1, support_card: 10 }, { slot: 6, support_card: 11 }], trained_uma: 50 },
	{ position: 2, uma: 2, style: "pace", cards: [] },
]
// Her veteran had her Sprint fixed from F to B.
const VETERAN = { id: 50, uma: 1, apt: { ...APT, short: 6 }, speed: 1590, stamina: 360, power: 1230, guts: 700, wit: 1150, rank_score: 17020, rank_grade: 17 } as TrainedUma

function renderPicture(props: Partial<Parameters<typeof TeamPicture>[0]> = {}) {
	return render(
		<TeamPicture
			event={EVENT}
			members={MEMBERS}
			teamName={null}
			notes={[]}
			umasById={UMAS}
			cardsById={CARDS}
			isFavorite={() => false}
			veterans={null}
			ownerName={null}
			ownerPicture={null}
			now={NOW}
			{...props}
		/>
	)
}

const column = (name: string) => screen.getByRole("heading", { name }).closest(".rounded-2xl") as HTMLElement

describe("TeamPicture", () => {
	it("prints the race, the team's shape and each uma with her deck", () => {
		const { container } = renderPicture()
		expect(screen.getByRole("heading", { name: "My Capricorn Cup team" })).toBeInTheDocument()
		expect(screen.getByText("Champions Meeting 21")).toBeInTheDocument()
		expect(screen.getByText("Chukyo")).toBeInTheDocument()
		expect(screen.getByText("1,200m")).toBeInTheDocument()
		expect(screen.getByText("1 Pace + 1 End")).toBeInTheDocument()
		// The outfit gets its own line, and an empty spot keeps its column.
		expect(screen.getByRole("heading", { name: "Taiki Shuttle" })).toBeInTheDocument()
		expect(screen.getByText("Camping")).toBeInTheDocument()
		expect(screen.getByText("Open spot")).toBeInTheDocument()
		const taishin = within(column("Narita Taishin"))
		expect(taishin.getByText("Agnes Tachyon")).toBeInTheDocument()
		expect(taishin.getByLabelText("Borrowed")).toBeInTheDocument()
		expect(taishin.getByText("1 Speed")).toBeInTheDocument()
		// The event's art sits behind the top.
		expect(container.querySelector("img.share-picture-art")).toHaveAttribute("src", "https://example.test/cm21.jpg")
	})

	it("shows her base letters and no veteran unless the veterans are shown", () => {
		renderPicture()
		const taishin = within(column("Narita Taishin"))
		expect(taishin.getByText("Sprint").nextElementSibling).toHaveTextContent("F")
		expect(taishin.queryByText("Veteran")).not.toBeInTheDocument()
	})

	it("shows the veteran, with the letters she fixed, when asked to", () => {
		renderPicture({ veterans: [VETERAN] })
		const taishin = within(column("Narita Taishin"))
		expect(taishin.getByText("Sprint").nextElementSibling).toHaveTextContent("B")
		expect(taishin.getByText("Veteran")).toBeInTheDocument()
		expect(taishin.getByText("17,020")).toBeInTheDocument()
		expect(taishin.getByText("1,590")).toBeInTheDocument()
	})

	it("falls back to her own letter where a hand-entered veteran left one unknown", () => {
		renderPicture({ veterans: [{ ...VETERAN, apt: { ...VETERAN.apt, short: null, turf: null } }] })
		const taishin = within(column("Narita Taishin"))
		expect(taishin.getByText("Sprint").nextElementSibling).toHaveTextContent("F")
		expect(taishin.getByText("Turf").nextElementSibling).toHaveTextContent("A")
	})

	it("names the owner and the team, and prints the notes with their red", () => {
		renderPicture({ ownerName: "CarrotRun", teamName: "Rain plan", notes: [{ text: "Never run her at ==F==.", color: "pink" }] })
		expect(screen.getByRole("heading", { name: "CarrotRun's Capricorn Cup team" })).toBeInTheDocument()
		expect(screen.getByText(/^Rain plan · /)).toBeInTheDocument()
		expect(screen.getByText("F", { selector: "span.text-highlight" })).toBeInTheDocument()
	})

	it("draws no art layer for an event without art", () => {
		const { container } = renderPicture({ event: { ...EVENT, image: null } as RaceEvent })
		expect(container.querySelector(".share-picture-art")).toBeNull()
		expect(container.querySelector(".share-picture--art")).toBeNull()
	})
})

describe("ShareTeamButton", () => {
	afterEach(() => {
		displayName = ""
		vi.clearAllMocks()
	})

	const TEAM: PvpTeam = {
		key: "t1", id: 1, kind: "cm", event: 21, isFocus: false, updatedAt: 0, name: "", members: MEMBERS,
		notes: [{ text: "Wit first.", color: "yellow" }],
	}

	it("starts with veterans off and notes on, and downloads a file named for the event", async () => {
		displayName = "CarrotRun"
		render(<ShareTeamButton event={EVENT} team={TEAM} umasById={UMAS} cardsById={CARDS} veterans={[VETERAN]} />)
		fireEvent.click(screen.getByRole("button", { name: "Share picture" }))
		expect(screen.getByRole("checkbox", { name: "Show my name (CarrotRun)" })).not.toBeChecked()
		expect(screen.getByRole("checkbox", { name: "Show my veterans" })).not.toBeChecked()
		expect(screen.getByRole("checkbox", { name: "Show notes" })).toBeChecked()
		await waitFor(() => expect(screen.getByRole("button", { name: "Download" })).toBeEnabled())
		fireEvent.click(screen.getByRole("button", { name: "Download" }))
		expect(downloadImage).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/^uma-team-cm21-\d{4}-\d{2}-\d{2}\.png$/))
	})

	it("offers the veterans only when the team has one linked", () => {
		render(<ShareTeamButton event={EVENT} team={TEAM} umasById={UMAS} cardsById={CARDS} veterans={undefined} />)
		fireEvent.click(screen.getByRole("button", { name: "Share picture" }))
		expect(screen.queryByRole("checkbox", { name: "Show my veterans" })).not.toBeInTheDocument()
	})
})
