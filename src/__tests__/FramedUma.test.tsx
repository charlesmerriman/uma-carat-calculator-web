/**
 * FramedUma and useOshiIds: the silver frame for everyone, the rainbow one for
 * the favourites the person's tier covers, and nothing special outside a
 * sign-in provider.
 */

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { FramedUma } from "../components/FramedUma"
import { useOshiIds } from "../hooks/useOshiIds"
import { AuthContext, type AuthContextType } from "../services/AuthContext"

function Favourites() {
	const ids = useOshiIds()
	return <output>{[...ids].join(",")}</output>
}

function withAccount(oshis: number[], slots: number) {
	const value = {
		account: { oshis: oshis.map((id) => ({ id })), oshi_slots: slots },
	} as unknown as AuthContextType
	render(
		<AuthContext.Provider value={value}>
			<Favourites />
		</AuthContext.Provider>
	)
}

describe("FramedUma", () => {
	it("draws the borderless art, and marks a favourite for the rainbow frame", () => {
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
	it("covers only the favourites the tier has slots for", () => {
		withAccount([12, 41, 77], 2)
		expect(screen.getByRole("status").textContent).toBe("12,41")
	})

	it("is empty outside a sign-in provider", () => {
		render(<Favourites />)
		expect(screen.getByRole("status").textContent).toBe("")
	})
})

describe("an owner-named exception", () => {
	it("draws the borderless art with no frame, and never as a favourite", () => {
		const { container } = render(<FramedUma src="p.png" alt="Oguri Cap" oshi frame={false} />)
		expect(container.firstElementChild).toHaveClass("uma-frame--bare")
		expect(container.firstElementChild).not.toHaveAttribute("data-oshi")
		expect(screen.getByRole("img", { name: "Oguri Cap" })).toHaveAttribute("src", "p.png")
	})
})
