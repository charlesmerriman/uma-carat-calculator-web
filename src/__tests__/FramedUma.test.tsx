/**
 * FramedUma and useOshiIds: the silver frame for everyone, the rainbow one for
 * the favorites the person's tier covers, and nothing special outside a
 * sign-in provider.
 */

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { FramedUma } from "../components/FramedUma"
import { useOshiIds, useOshiPickIds } from "../hooks/useOshiIds"
import { AuthContext, type AuthContextType } from "../services/AuthContext"

function Favorites({ exact = false }: { exact?: boolean }) {
	const frame = useOshiIds()
	const picks = useOshiPickIds()
	return <output>{[...(exact ? picks : frame)].join(",")}</output>
}

function withAccount(oshis: number[], slots: number, extra: { oshi_uma_ids?: number[] } = {}, exact = false) {
	const value = {
		account: { oshis: oshis.map((id) => ({ id })), oshi_slots: slots, ...extra },
	} as unknown as AuthContextType
	render(
		<AuthContext.Provider value={value}>
			<Favorites exact={exact} />
		</AuthContext.Provider>
	)
}

describe("FramedUma", () => {
	it("draws the borderless art, and marks a favorite for the rainbow frame", () => {
		const { container, rerender } = render(<FramedUma src="p.png" alt="Oguri Cap" />)
		expect(screen.getByRole("img", { name: "Oguri Cap" })).toHaveAttribute("src", "p.png")
		expect(container.firstElementChild).not.toHaveAttribute("data-oshi")
		rerender(<FramedUma src="p.png" alt="Oguri Cap" oshi />)
		expect(container.firstElementChild).toHaveAttribute("data-oshi")
	})

	it("still draws the frame with no picture", () => {
		const { container } = render(<FramedUma src={null} />)
		expect(container.firstElementChild).toHaveClass("uma-frame")
		expect(container.querySelector("img")).toBeNull()
	})
})

describe("useOshiIds", () => {
	it("covers only the favorites the tier has slots for", () => {
		withAccount([12, 41, 77], 2)
		expect(screen.getByRole("status").textContent).toBe("12,41")
	})

	it("frames every outfit the server resolved for the covered picks", () => {
		withAccount([12], 1, { oshi_uma_ids: [12, 13, 14] })
		expect(screen.getByRole("status").textContent).toBe("12,13,14")
	})

	it("is empty outside a sign-in provider", () => {
		render(<Favorites />)
		expect(screen.getByRole("status").textContent).toBe("")
	})
})

describe("useOshiPickIds", () => {
	it("is the exact covered picks, never their other outfits", () => {
		withAccount([12, 41, 77], 2, { oshi_uma_ids: [12, 13, 41] }, true)
		expect(screen.getByRole("status").textContent).toBe("12,41")
	})
})

describe("an owner-named exception", () => {
	it("draws the borderless art with no frame, and never as a favorite", () => {
		const { container } = render(<FramedUma src="p.png" alt="Oguri Cap" oshi frame={false} />)
		expect(container.firstElementChild).toHaveClass("uma-frame--bare")
		expect(container.firstElementChild).not.toHaveAttribute("data-oshi")
		expect(screen.getByRole("img", { name: "Oguri Cap" })).toHaveAttribute("src", "p.png")
	})
})
