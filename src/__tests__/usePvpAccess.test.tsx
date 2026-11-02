import type { ReactNode } from "react"
import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import {
	guideOpenToEveryone,
	lockedLandingEvent,
	lockedPvpEvents,
	lockedTeamEvents,
	toolsOpenToEveryone,
	usePvpAccess,
} from "../hooks/usePvpAccess"
import type { Account, AccountStatus } from "../types/account"
import type { RaceEvent } from "../types"

function accessFor(status: AccountStatus, account: Partial<Account> | null) {
	const value = { isLoggedIn: status !== "anonymous", status, account } as unknown as AuthContextType
	const wrapper = ({ children }: { children: ReactNode }) => <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
	return renderHook(() => usePvpAccess(), { wrapper }).result.current
}

/** An event as /calculator-data sends it, with its guide's setting. */
const event = (id: number, start: string, guide: Partial<RaceEvent> = {}): RaceEvent =>
	({
		id,
		name: `Cup ${id}`,
		event_type: "champions_meeting",
		cm_number: id,
		start_date: start,
		end_date: start.replace(/T.*/, "T23:00:00Z"),
		...guide,
	}) as RaceEvent

describe("usePvpAccess: who is early", () => {
	it("opens for an account the server says is early (a supporter or staff)", () => {
		expect(accessFor("ready", { early_access: true })).toBe("open")
	})

	it("stays closed to a guest, an account without it, and one that didn't load", () => {
		expect(accessFor("anonymous", null)).toBe("locked")
		expect(accessFor("ready", { early_access: false })).toBe("locked")
		expect(accessFor("error", null)).toBe("locked")
	})

	it("waits while the account loads", () => {
		expect(accessFor("loading", null)).toBe("pending")
	})
})

describe("what each guide's setting opens to everyone (guide-visibility-plan.md)", () => {
	const none = event(1, "2099-01-01T00:00:00Z")
	const supporters = event(2, "2099-02-01T00:00:00Z", { has_guide: true, guide_visibility: "supporters" })
	const publicGuide = event(3, "2099-03-01T00:00:00Z", { has_guide: true, guide_visibility: "public" })
	const withTools = event(4, "2099-04-01T00:00:00Z", { has_guide: true, guide_visibility: "public", guide_tools_public: true })
	const all = [none, supporters, publicGuide, withTools]

	it("opens a Public guide only, and the tools only with the switch", () => {
		expect(all.map(guideOpenToEveryone)).toEqual([false, false, true, true])
		expect(all.map(toolsOpenToEveryone)).toEqual([false, false, false, true])
		expect(lockedPvpEvents(all)).toEqual([publicGuide, withTools])
		expect(lockedTeamEvents(all)).toEqual([withTools])
	})

	it("never trusts the switch without a Public guide", () => {
		// The API never sends this; if a stale payload did, it opens nothing.
		const stray = event(5, "2099-05-01T00:00:00Z", { guide_visibility: "supporters", guide_tools_public: true })
		expect(toolsOpenToEveryone(stray)).toBe(false)
	})

	it("lands a bare address on the nearest Public guide, or nowhere", () => {
		const now = new Date("2099-01-15T00:00:00Z")
		expect(lockedLandingEvent(all, now)).toBe(publicGuide)
		expect(lockedLandingEvent([none, supporters], now)).toBeNull()
		// Every Public guide over: the latest one.
		expect(lockedLandingEvent(all, new Date("2100-01-01T00:00:00Z"))).toBe(withTools)
	})
})
