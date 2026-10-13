/**
 * PvpTeamsProvider: where a team's edits go.
 *
 *   - a guest's teams go to the device and never to the server;
 *   - an account's go to the server (create at once, edits after a pause) and
 *     never to the device;
 *   - A TAB SAVES THE WAY IT LOADED: a token appearing later changes nothing;
 *   - signing in moves the device's teams into the account and clears them;
 *   - every consumer reads one copy.
 */

import { useEffect } from "react"
import { act, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import { PvpTeamsProvider } from "../services/PvpTeamsProvider"
import { usePvpTeams, type PvpTeamsContextType } from "../services/PvpTeamsContext"
import { readGuestPvpTeams, writeGuestPvpTeams } from "../services/guestPvpTeamStore"
import {
	pvpTeamCreate,
	pvpTeamReplace,
	pvpTeamsFetch,
} from "../services/pvpTeamFetchCalls"
import type { PvpTeamMember, PvpTeamPayload } from "../types/pvpTeam"

let loggedIn = false
vi.mock("../services/AuthContext", () => ({ useAccount: () => ({ isLoggedIn: loggedIn }) }))
vi.mock("../services/CalculatorContext", () => ({
	useCalculatorData: () => ({ championsMeetingData: [{ id: 10 }], leagueOfHeroesData: [{ id: 3 }] }),
}))
vi.mock("../services/pvpTeamFetchCalls", () => ({
	pvpTeamCreate: vi.fn(),
	pvpTeamDelete: vi.fn(),
	pvpTeamPatch: vi.fn(),
	pvpTeamReplace: vi.fn(),
	pvpTeamsFetch: vi.fn(),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mockedCreate = vi.mocked(pvpTeamCreate)
const mockedReplace = vi.mocked(pvpTeamReplace)
const mockedList = vi.mocked(pvpTeamsFetch)

const json = (body: unknown, status = 200): Response =>
	({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response

const CM10 = { kind: "cm" as const, id: 10 }
const MEMBERS: PvpTeamMember[] = [{ position: 0, uma: 41, style: "front", cards: [{ slot: 1, support_card: 302 }] }]

const payload = (id: number, extra: Partial<PvpTeamPayload> = {}): PvpTeamPayload => ({
	id, kind: "cm", event: 10, name: "", is_focus: false, notes: [], members: [], updated_at: "2026-10-13T00:00:00Z", ...extra,
})

/** Renders the provider with `count` consumers; each one's latest context lands in `seen[i]`. */
function renderProvider(count = 1) {
	const seen: PvpTeamsContextType[] = []
	const view = render(
		<PvpTeamsProvider>
			{Array.from({ length: count }, (_, index) => (
				<Probe key={index} onValue={(value) => (seen[index] = value)} />
			))}
		</PvpTeamsProvider>
	)
	return { seen, view }
}

beforeEach(() => {
	loggedIn = false
	localStorage.clear()
	vi.clearAllMocks()
	mockedList.mockResolvedValue(json([]))
})

afterEach(() => localStorage.clear())

describe("PvpTeamsProvider", () => {
	it("loads nothing until asked", () => {
		loggedIn = true
		const { seen } = renderProvider()
		expect(seen[0].status).toBe("idle")
		expect(mockedList).not.toHaveBeenCalled()
	})

	it("keeps a guest's teams on the device and off the server", () => {
		const { seen } = renderProvider()
		act(() => seen[0].ensureLoaded())
		expect(seen[0].mode).toBe("guest")
		let key: string | null = null
		act(() => {
			key = seen[0].createTeam(CM10)
		})
		act(() => seen[0].editTeam(key!, { members: MEMBERS }))
		act(() => seen[0].renameTeam(key!, "Aquarius"))
		expect(readGuestPvpTeams()).toEqual([
			{ kind: "cm", event: 10, name: "Aquarius", focus: false, notes: [], members: MEMBERS },
		])
		expect(mockedCreate).not.toHaveBeenCalled()
		expect(mockedReplace).not.toHaveBeenCalled()
		expect(mockedList).not.toHaveBeenCalled()
	})

	it("drops a device team whose event left the site", () => {
		writeGuestPvpTeams([
			{ kind: "cm", event: 10, name: "", focus: false, notes: [], members: [] },
			{ kind: "cm", event: 99, name: "Gone", focus: false, notes: [], members: [] },
		])
		const { seen } = renderProvider()
		act(() => seen[0].ensureLoaded())
		expect(seen[0].teams.map((team) => team.event)).toEqual([10])
	})

	it("stays a guest tab when a token appears later", () => {
		const { seen, view } = renderProvider()
		act(() => seen[0].ensureLoaded())
		loggedIn = true
		view.rerender(<PvpTeamsProvider>{null}</PvpTeamsProvider>)
		view.rerender(
			<PvpTeamsProvider>
				<Probe onValue={(value) => (seen[0] = value)} />
			</PvpTeamsProvider>
		)
		act(() => {
			seen[0].createTeam(CM10, { members: MEMBERS })
		})
		expect(readGuestPvpTeams()).toHaveLength(1)
		expect(mockedCreate).not.toHaveBeenCalled()
	})

	it("creates an account's team at once and saves an edit made before the create came back", async () => {
		loggedIn = true
		let resolveCreate: (response: Response) => void = () => {}
		mockedCreate.mockReturnValue(new Promise((resolve) => (resolveCreate = resolve)))
		mockedReplace.mockResolvedValue(json(payload(5)))
		const { seen } = renderProvider()
		act(() => seen[0].ensureLoaded())
		await waitFor(() => expect(seen[0].status).toBe("ready"))

		let key: string | null = null
		act(() => {
			key = seen[0].createTeam(CM10)
		})
		expect(mockedCreate).toHaveBeenCalledWith(CM10, { name: "", notes: [], members: [] })
		act(() => seen[0].editTeam(key!, { members: MEMBERS }))
		await act(async () => resolveCreate(json(payload(5))))

		await waitFor(() => expect(mockedReplace).toHaveBeenCalledWith(5, MEMBERS, []), { timeout: 4000 })
		expect(seen[0].teams[0].id).toBe(5)
		expect(localStorage.length).toBe(0)
	})

	it("puts back a refused create and says why", async () => {
		loggedIn = true
		mockedCreate.mockResolvedValue(json({ error: "You can keep up to 5 teams for one event." }, 400))
		const { seen } = renderProvider()
		act(() => seen[0].ensureLoaded())
		await waitFor(() => expect(seen[0].status).toBe("ready"))
		act(() => {
			seen[0].createTeam(CM10)
		})
		await waitFor(() => expect(seen[0].teams).toEqual([]))
		expect(toast.error).toHaveBeenCalledWith("You can keep up to 5 teams for one event.")
	})

	it("moves the device's teams into the account on the first signed-in load", async () => {
		writeGuestPvpTeams([{ kind: "cm", event: 10, name: "Mine", focus: false, notes: [], members: MEMBERS }])
		loggedIn = true
		mockedCreate.mockResolvedValue(json(payload(8, { name: "Mine", members: MEMBERS })))
		mockedList.mockResolvedValue(json([payload(8, { name: "Mine", members: MEMBERS })]))
		const { seen } = renderProvider()
		act(() => seen[0].ensureLoaded())
		await waitFor(() => expect(seen[0].status).toBe("ready"))
		expect(mockedCreate).toHaveBeenCalledWith(CM10, { name: "Mine", notes: [], members: MEMBERS })
		expect(readGuestPvpTeams()).toEqual([])
		expect(toast.success).toHaveBeenCalledWith("Your teams from this device were added to your account.")
		expect(seen[0].teams.map((team) => team.id)).toEqual([8])
	})

	it("keeps a device team the account refused", async () => {
		writeGuestPvpTeams([{ kind: "cm", event: 10, name: "Mine", focus: false, notes: [], members: MEMBERS }])
		loggedIn = true
		mockedCreate.mockResolvedValue(json({ error: "nope" }, 400))
		const { seen } = renderProvider()
		act(() => seen[0].ensureLoaded())
		await waitFor(() => expect(seen[0].status).toBe("ready"))
		expect(readGuestPvpTeams()).toHaveLength(1)
		expect(toast.success).not.toHaveBeenCalled()
	})

	it("gives every consumer the same teams", () => {
		const { seen } = renderProvider(2)
		act(() => seen[0].ensureLoaded())
		act(() => {
			seen[1].createTeam(CM10, { members: MEMBERS })
		})
		expect(seen[0].teams).toHaveLength(1)
		expect(seen[0].teams[0]).toBe(seen[1].teams[0])
	})

	it("keeps one pin", () => {
		const { seen } = renderProvider()
		act(() => seen[0].ensureLoaded())
		let first: string | null = null
		let second: string | null = null
		act(() => {
			first = seen[0].createTeam(CM10)
		})
		act(() => {
			second = seen[0].createTeam({ kind: "loh", id: 3 })
		})
		act(() => seen[0].pinTeam(first))
		act(() => seen[0].pinTeam(second))
		expect(seen[0].teams.map((team) => team.isFocus)).toEqual([false, true])
		act(() => seen[0].pinTeam(null))
		expect(seen[0].teams.some((team) => team.isFocus)).toBe(false)
	})
})

/** Hands the context out after every render (act() flushes the effect). */
function Probe({ onValue }: { onValue: (value: PvpTeamsContextType) => void }) {
	const value = usePvpTeams()
	useEffect(() => {
		onValue(value)
	})
	return null
}
