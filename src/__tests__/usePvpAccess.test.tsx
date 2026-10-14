import type { ReactNode } from "react"
import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { PVP_EARLY_ACCESS, usePvpAccess } from "../hooks/usePvpAccess"
import type { Account, AccountStatus } from "../types/account"

function accessFor(status: AccountStatus, account: Partial<Account> | null) {
	const value = { isLoggedIn: status !== "anonymous", status, account } as unknown as AuthContextType
	const wrapper = ({ children }: { children: ReactNode }) => <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
	return renderHook(() => usePvpAccess(), { wrapper }).result.current
}

// While the page is in early access. When PVP_EARLY_ACCESS goes false these
// become "open" for everyone, and the last test says so.
describe.runIf(PVP_EARLY_ACCESS)("usePvpAccess, in early access", () => {
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

describe.runIf(!PVP_EARLY_ACCESS)("usePvpAccess, once open", () => {
	it("is open to everyone", () => {
		expect(accessFor("anonymous", null)).toBe("open")
	})
})
