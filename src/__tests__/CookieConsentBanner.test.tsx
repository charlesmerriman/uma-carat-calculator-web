import { act, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CookieConsentBanner } from "../components/consent/CookieConsentBanner"
import {
	COOKIE_CONSENT_STORAGE_KEY,
	openConsentPrompt,
	resetConsentStoreForTests,
} from "../services/consentStore"

type GtagWindow = Window & { gtag?: (...args: unknown[]) => void }

const ALL_GRANTED = {
	ad_storage: "granted",
	ad_user_data: "granted",
	ad_personalization: "granted",
	analytics_storage: "granted",
}
const ALL_DENIED = Object.fromEntries(Object.keys(ALL_GRANTED).map((k) => [k, "denied"]))

function renderBanner() {
	return render(
		<MemoryRouter>
			<CookieConsentBanner />
		</MemoryRouter>,
	)
}

beforeEach(() => {
	localStorage.clear()
	resetConsentStoreForTests()
	;(window as GtagWindow).gtag = vi.fn()
})

afterEach(() => {
	delete (window as GtagWindow).gtag
})

describe("CookieConsentBanner", () => {
	it("asks a first-time visitor, with Accept and Reject as equals", () => {
		renderBanner()
		expect(screen.getByRole("dialog", { name: "Cookie preferences" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument()
		// No close: a first-time visitor answers, they do not dismiss.
		expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument()
	})

	it("Accept stores the choice, tells gtag, and closes", () => {
		renderBanner()
		fireEvent.click(screen.getByRole("button", { name: "Accept" }))
		expect(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toBe("granted")
		expect((window as GtagWindow).gtag).toHaveBeenCalledWith("consent", "update", ALL_GRANTED)
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
	})

	it("Reject stores the choice, tells gtag, and closes", () => {
		renderBanner()
		fireEvent.click(screen.getByRole("button", { name: "Reject" }))
		expect(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toBe("denied")
		expect((window as GtagWindow).gtag).toHaveBeenCalledWith("consent", "update", ALL_DENIED)
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
	})

	it("stays hidden for a visitor who already chose", () => {
		localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "denied")
		renderBanner()
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
	})

	it("reopens from the footer link, and can then be closed without changing the choice", () => {
		localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "denied")
		renderBanner()
		// Outside a React event handler, so the store update needs act() to flush.
		act(() => openConsentPrompt())
		expect(screen.getByRole("dialog")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Close" }))
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		expect(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toBe("denied")
		expect((window as GtagWindow).gtag).not.toHaveBeenCalled()
	})

	it("ignores a stored value it does not recognise", () => {
		localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "maybe")
		renderBanner()
		expect(screen.getByRole("dialog")).toBeInTheDocument()
	})
})
