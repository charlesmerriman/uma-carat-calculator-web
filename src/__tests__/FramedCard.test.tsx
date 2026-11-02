/**
 * FramedCard: a card with borderless art is built from layers (the art, its
 * rarity frame, its type icon); one without draws its bordered picture as it
 * is, never framed; the limit-break diamonds go on top of either.
 */

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { FramedCard, type FramedCardArt } from "../components/FramedCard"
import frameSsr from "../assets/card-overlays/frame-ssr.svg"
import typePower from "../assets/card-overlays/type-power.svg"
import typeFriend from "../assets/card-overlays/type-friend.svg"
import limitBreak2 from "../assets/card-overlays/lb-2.svg"
import limitBreak4 from "../assets/card-overlays/lb-4.svg"

const OGURI: FramedCardArt = {
	image: "bordered.png",
	image_borderless: "texture.webp",
	card_type: "power",
	rarity: 3,
}

/** The decorative layers' file names, in drawing order. */
function layers(container: HTMLElement): string[] {
	return [...container.querySelectorAll("img.card-frame__layer")].map((img) => img.getAttribute("src") ?? "")
}

describe("FramedCard", () => {
	it("builds a card from its texture, rarity frame and type icon", () => {
		const { container } = render(<FramedCard card={OGURI} alt="Oguri Cap" />)
		const art = screen.getByRole("img", { name: "Oguri Cap" })
		expect(art).toHaveAttribute("src", "texture.webp")
		expect(art).toHaveClass("card-frame__art")
		const drawn = layers(container)
		expect(drawn).toEqual([frameSsr, typePower])
	})

	it("draws a card with no texture as its bordered picture, unframed", () => {
		const { container } = render(<FramedCard card={{ ...OGURI, image_borderless: null }} alt="Oguri Cap" />)
		const picture = screen.getByRole("img", { name: "Oguri Cap" })
		expect(picture).toHaveAttribute("src", "bordered.png")
		expect(picture).toHaveClass("card-frame__whole")
		expect(layers(container)).toEqual([])
	})

	it("treats an API older than the field like a card with no texture", () => {
		const { image_borderless: _dropped, ...older } = OGURI
		render(<FramedCard card={older} alt="Oguri Cap" />)
		expect(screen.getByRole("img", { name: "Oguri Cap" })).toHaveAttribute("src", "bordered.png")
	})

	it("lays the limit-break diamonds over either kind of card", () => {
		const framed = render(<FramedCard card={OGURI} limitBreaks={2} />)
		expect(layers(framed.container).at(-1)).toBe(limitBreak2)
		framed.unmount()

		const bordered = render(<FramedCard card={{ ...OGURI, image_borderless: null }} limitBreaks={4} />)
		expect(layers(bordered.container)).toEqual([limitBreak4])
	})

	it("draws a friend card with the Pal icon and skips what it doesn't know", () => {
		const { container } = render(<FramedCard card={{ ...OGURI, card_type: "friend", rarity: null }} />)
		const drawn = layers(container)
		expect(drawn).toEqual([typeFriend])
	})

	it("is a grey card when there is no picture at all", () => {
		const { container } = render(<FramedCard card={{ image: null, image_borderless: null, card_type: null, rarity: null }} />)
		expect(container.querySelector(".card-frame__empty")).not.toBeNull()
		expect(container.querySelector("img")).toBeNull()
	})
})
