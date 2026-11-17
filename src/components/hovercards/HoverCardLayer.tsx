/**
 * The hover cards' one popup for the whole app (notes/uma-card-hover-plan.md).
 *
 * A tile opts in with `data-hover-card="uma:198"` (utils/hoverCards.ts
 * hoverCardProps); this layer, mounted once in AppShell, listens on the
 * document and points ONE Floating UI popup at whichever tile the pointer or
 * keyboard focus reaches. Why one layer and not a wrapper per tile:
 *
 *   - a grid of 300 tiles (the Collection, the picker) costs 300 attributes,
 *     not 300 popup instances and their listeners;
 *   - no element is added around a tile, so no layout changes, and a tile
 *     that is a button, a link or a drag handle needs nothing special;
 *   - drag and click are handled once: any press closes the card and keeps it
 *     shut until the pointer comes back, so a drag on My team or a click that
 *     opens the picker never leaves a card behind.
 *
 * WHO: early access only, the Encyclopedia's rule (useSkillsPreview). For
 * everyone else this renders nothing and adds no listeners. Touch is ignored:
 * on a phone the name links and page links stay the way in (owner, 2026-11-17).
 *
 * WHERE IT DRAWS: z-[10001], above the pickers' z-[10000] overlays and the
 * side drawers; inside an open native <dialog> when the tile is in one (the
 * top layer would hide a popup on <body>). A tile's own `title` is moved
 * aside while its card is open, so the browser's box doesn't show beside it.
 *
 * It is aria-hidden like every hover detail on the site: the facts are on the
 * page, which the tiles' existing links reach by keyboard and screen reader.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react"
import {
	autoUpdate,
	flip,
	FloatingPortal,
	hide,
	offset,
	shift,
	size,
	useFloating,
	useTransitionStyles,
} from "@floating-ui/react"
import { useReducedMotion } from "framer-motion"
import { useSkillsPreview } from "../../hooks/useSkillsPreview"
import { useEncyclopediaHrefs, useEncyclopediaLookup } from "../../hooks/useEncyclopediaHrefs"
import { useOwned } from "../../hooks/useOwned"
import { useCardPage, useUmaPage } from "../../services/encyclopediaQueries"
import { parseHoverCard, parseRing, type HoverCardKind } from "../../utils/hoverCards"
import type { AptitudeKey } from "../../types/pvpTeam"
import { InsideHoverContext, InsidePopupContext } from "../pvp/hoverPopup"
import { UmaHoverCard } from "./UmaHoverCard"
import { CardHoverCard } from "./CardHoverCard"

// How long the pointer rests on a tile before its card opens: the skill
// card's delay (hoverPopup.tsx), so a mouse crossing a grid doesn't flash a
// card per tile. Focus opens it at once.
const OPEN_DELAY_MS = 120
// How long the card waits after the pointer leaves the tile, so it can cross
// the gap into the card (to scroll it, or click "Open its page").
const CLOSE_GRACE_MS = 150
// A page fetched for a hover stays fresh for the session's next hovers.
const HOVER_STALE_MS = 30 * 60 * 1000

const TILE = "[data-hover-card]"
// WithDetail's markers: a tile inside one already has a hover of its own.
const OWN_HOVER = '[role="group"][aria-describedby]'

interface Target {
	kind: HoverCardKind
	id: number
	element: Element
	ring: AptitudeKey[]
	links: boolean
}

export function HoverCardLayer() {
	return useSkillsPreview() ? <Layer /> : null
}

function Layer() {
	// Load the catalogue now, so the first hover has its game id ready.
	useEncyclopediaLookup()
	const [target, setTarget] = useState<Target | null>(null)
	const [open, setOpen] = useState(false)
	const closeRef = useRef<() => void>(() => {})
	const { refs, floatingStyles, context, middlewareData } = useFloating({
		open,
		onOpenChange: setOpen,
		placement: "right-start",
		strategy: "fixed",
		middleware: [
			offset(6),
			flip({ fallbackPlacements: ["left-start", "bottom-start", "top-start"], padding: 8 }),
			shift({ padding: 8 }),
			// A tall card on a short window scrolls inside itself.
			size({
				padding: 8,
				apply({ availableHeight, elements }) {
					elements.floating.style.maxHeight = `${Math.max(160, Math.floor(availableHeight))}px`
				},
			}),
			hide(),
		],
		// The tile can leave the page under the card (a list re-sorts, a route
		// changes): then the card goes too.
		whileElementsMounted: (reference, floating, update) =>
			autoUpdate(reference, floating, () => {
				if (reference instanceof Element && !reference.isConnected) closeRef.current()
				else update()
			}),
	})
	const floatingRef = useRef<HTMLElement | null>(null)

	useEffect(() => {
		let openTimer = 0
		let closeTimer = 0
		let pressed = false
		let current: Element | null = null
		let frame = 0
		const stashed: Array<[Element, string]> = []

		const restoreTitles = () => {
			for (const [element, title] of stashed.splice(0)) {
				element.setAttribute("title", title)
				element.removeAttribute("data-hover-card-title")
			}
		}
		// The tile's own title, its children's and its nearest titled
		// ancestor's: the browser would draw them beside the card.
		const stashTitles = (tile: Element) => {
			const titled = [tile, ...tile.querySelectorAll("[title]"), tile.parentElement?.closest("[title]")]
			for (const element of titled) {
				const title = element?.getAttribute("title")
				if (!element || !title) continue
				stashed.push([element, title])
				element.setAttribute("data-hover-card-title", title)
				element.removeAttribute("title")
			}
		}
		const clearTimers = () => {
			window.clearTimeout(openTimer)
			window.clearTimeout(closeTimer)
		}
		const close = () => {
			clearTimers()
			restoreTitles()
			current = null
			setOpen(false)
		}
		closeRef.current = close
		const activate = (tile: Element) => {
			const parsed = parseHoverCard(tile.getAttribute("data-hover-card"))
			if (!parsed) return
			clearTimers()
			restoreTitles()
			stashTitles(tile)
			current = tile
			refs.setReference(tile)
			setTarget({
				...parsed,
				element: tile,
				ring: parseRing(tile.getAttribute("data-hover-card-ring")),
				links: tile.getAttribute("data-hover-card-links") !== "off",
			})
			setOpen(true)
		}
		const inCard = (node: EventTarget | null) => node instanceof Node && Boolean(floatingRef.current?.contains(node))
		const tileFrom = (node: EventTarget | null): Element | null => {
			if (!(node instanceof Element) || inCard(node)) return null
			const tile = node.closest(TILE)
			return tile && !tile.closest(OWN_HOVER) ? tile : null
		}
		const scheduleOpen = (tile: Element) => {
			window.clearTimeout(closeTimer)
			if (tile === current) return
			window.clearTimeout(openTimer)
			openTimer = window.setTimeout(() => activate(tile), OPEN_DELAY_MS)
		}
		const scheduleClose = () => {
			window.clearTimeout(openTimer)
			if (!current) return
			window.clearTimeout(closeTimer)
			closeTimer = window.setTimeout(close, CLOSE_GRACE_MS)
		}

		const onPointerOver = (event: PointerEvent) => {
			if (event.pointerType === "touch" || pressed) return
			if (inCard(event.target)) {
				window.clearTimeout(closeTimer)
				return
			}
			const tile = tileFrom(event.target)
			if (tile) scheduleOpen(tile)
			else if (!(event.target instanceof Element && event.target.closest("[data-hover-card-scope]"))) scheduleClose()
		}
		// A stretched link over the art (Rankings' podium, the gallery feed)
		// takes the pointer, so inside a scope look under it for a tile,
		// once per frame.
		const onPointerMove = (event: PointerEvent) => {
			if (event.pointerType === "touch" || pressed) return
			if (!(event.target instanceof Element) || !event.target.closest("[data-hover-card-scope]")) return
			if (frame) return
			const { clientX, clientY } = event
			frame = window.requestAnimationFrame(() => {
				frame = 0
				const under = document.elementsFromPoint(clientX, clientY).find((element) => element.matches(TILE))
				if (under && !under.closest(OWN_HOVER)) scheduleOpen(under)
				else scheduleClose()
			})
		}
		const onPointerDown = (event: PointerEvent) => {
			if (inCard(event.target)) return
			pressed = true
			if (current) close()
			else clearTimers()
		}
		const onPointerUp = () => {
			pressed = false
		}
		const onFocusIn = (event: FocusEvent) => {
			const tile = tileFrom(event.target)
			if (tile && tile instanceof HTMLElement && tile.matches(":focus-visible")) activate(tile)
		}
		const onFocusOut = (event: FocusEvent) => {
			if (current && event.target instanceof Node && current.contains(event.target) && !inCard(event.relatedTarget)) close()
		}
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && current) close()
		}

		document.addEventListener("pointerover", onPointerOver)
		document.addEventListener("pointermove", onPointerMove)
		document.addEventListener("pointerdown", onPointerDown, true)
		document.addEventListener("pointerup", onPointerUp, true)
		document.addEventListener("pointercancel", onPointerUp, true)
		document.addEventListener("focusin", onFocusIn)
		document.addEventListener("focusout", onFocusOut)
		document.addEventListener("keydown", onKeyDown)
		return () => {
			clearTimers()
			window.cancelAnimationFrame(frame)
			restoreTitles()
			document.removeEventListener("pointerover", onPointerOver)
			document.removeEventListener("pointermove", onPointerMove)
			document.removeEventListener("pointerdown", onPointerDown, true)
			document.removeEventListener("pointerup", onPointerUp, true)
			document.removeEventListener("pointercancel", onPointerUp, true)
			document.removeEventListener("focusin", onFocusIn)
			document.removeEventListener("focusout", onFocusOut)
			document.removeEventListener("keydown", onKeyDown)
		}
	}, [refs])

	const reduceMotion = useReducedMotion()
	const { isMounted, styles } = useTransitionStyles(context, { duration: reduceMotion ? 0 : 120 })
	if (!isMounted || !target) return null
	return (
		<FloatingPortal root={(target.element.closest("dialog[open]") as HTMLElement | null) ?? undefined}>
			<Popup
				target={target}
				setFloating={(node) => {
					floatingRef.current = node
					refs.setFloating(node)
				}}
				style={{ ...floatingStyles, ...styles, visibility: middlewareData.hide?.referenceHidden ? "hidden" : "visible" }}
			/>
		</FloatingPortal>
	)
}

/**
 * The drawn card. Its own component so the page fetch and the Collection
 * lookup mount only while a card is open: a supporter who never hovers asks
 * for nothing.
 */
function Popup({ target, setFloating, style }: {
	target: Target
	setFloating: (node: HTMLElement | null) => void
	style: CSSProperties
}) {
	const lookup = useEncyclopediaLookup()
	const hrefs = useEncyclopediaHrefs()
	const owned = useOwned()
	const uma = target.kind === "uma" ? lookup.uma(target.id) : null
	const card = target.kind === "card" ? lookup.card(target.id) : null
	const umaPage = useUmaPage(uma?.gameId ?? null, { staleTime: HOVER_STALE_MS })
	const cardPage = useCardPage(card?.gameId ?? null, { staleTime: HOVER_STALE_MS })
	// Nothing to draw until the catalogue knows the row (or never, for a
	// placeholder card or an uma with no page).
	if (!uma && !card) return null
	const pageOf = <T,>(query: { data: T | null | undefined; isError: boolean }) => (query.isError ? null : query.data)
	return (
		<div
			ref={setFloating}
			aria-hidden="true"
			style={style}
			className="z-[10001] w-80 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-gray-600 bg-gray-900 p-2 text-left text-xs leading-snug text-gray-200 shadow-lg"
		>
			<InsidePopupContext.Provider value={true}>
				<InsideHoverContext.Provider value={true}>
					{uma ? (
						<UmaHoverCard
							uma={uma.entry}
							page={pageOf(umaPage)}
							href={target.links ? hrefs.uma(target.id) : null}
							ring={target.ring}
							ownedStars={owned.umas.get(target.id) ?? null}
							links={target.links}
						/>
					) : card ? (
						<CardHoverCard
							card={card.entry}
							page={pageOf(cardPage)}
							href={target.links ? hrefs.card(target.id) : null}
							ownedLimitBreak={owned.cards.get(target.id) ?? null}
							links={target.links}
						/>
					) : null}
				</InsideHoverContext.Provider>
			</InsidePopupContext.Provider>
		</div>
	)
}
