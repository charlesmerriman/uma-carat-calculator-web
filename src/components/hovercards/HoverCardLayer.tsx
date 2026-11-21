/**
 * The uma and support card cards' one popup for the whole app
 * (notes/uma-card-hover-plan.md). The names say "hover" because it opened on
 * hover until 2026-11-18; it opens on a CLICK now (the owner's call, after
 * Daptrius's report that a card popping up wherever the mouse crossed an uma
 * made the site feel laggy and covered what he was reading).
 *
 * A tile opts in with `data-hover-card="uma:198"` (utils/hoverCards.ts
 * hoverCardProps); this layer, mounted once in AppShell, listens on the
 * document and points ONE Floating UI popup at the tile that was clicked. Why
 * one layer and not a wrapper per tile:
 *
 *   - a grid of 300 tiles (the Collection, the picker) costs 300 attributes,
 *     not 300 popup instances and their listeners;
 *   - no element is added around a tile, so no layout changes.
 *
 * WHICH CLICKS OPEN A CARD (tileFor, below). A click that had no other job:
 *
 *   - on plain art (nothing under the pointer is a link or a button);
 *   - on a link to that same uma's or card's Encyclopedia page. The card
 *     opens instead, and its "Open Encyclopedia" is the way to the page.
 *
 * A click on anything else (a button that picks, opens a picker or an editor,
 * a link to a post or the Timeline) keeps doing what it did, and no card
 * opens. Clicking the tile again, clicking anywhere else, Escape or a route
 * change closes it.
 *
 * WHAT IT COSTS WHILE NOTHING IS OPEN: three listeners that run on a press,
 * a click and a key. Nothing runs while the mouse moves (the hover version
 * listened to every pointerover and pointermove on the page).
 *
 * WHO: everyone, since the Encyclopedia opened (2026-11-18). Touch is ignored,
 * and so is a click made from the keyboard or a screen reader (Enter on a
 * link): there the link goes to the page as it always did, because the card
 * is aria-hidden and its links are out of the Tab order (owner, 2026-11-17:
 * phones keep the links). The one exception to touch is a tile marked
 * `tap: true` (hoverCardProps): a PvP guide's deck card on a style tab
 * (Henry, 2026-11-19), where a tap opens the card like the All tab's.
 *
 * WHERE IT DRAWS: beside the tile, right if there is room and left if not,
 * its top level with the tile's and slid up only as far as the window needs
 * (cardPopupMiddleware in pvp/hoverPopup.tsx). A tile wider than the card (a
 * ranking row, a podium entry) has no "beside" inside the window, so there
 * the card goes beside the POINT that was clicked (anchorFor). z-[10001], above the
 * pickers' z-[10000] overlays and the side drawers; inside an open native
 * <dialog> when the tile is in one (the top layer would hide a popup on
 * <body>). A tile's own `title` is moved aside while its card is open, so
 * the browser's box doesn't show beside it.
 */

import { memo, useEffect, useRef, useState, type CSSProperties } from "react"
import { autoUpdate, FloatingPortal, hide, useFloating, type ReferenceType } from "@floating-ui/react"
import { useQueryClient } from "@tanstack/react-query"
import { useLocation } from "react-router-dom"
import { loadEncyclopediaIndex, useEncyclopediaHrefs, useEncyclopediaLookup } from "../../hooks/useEncyclopediaHrefs"
import { prefetchEncyclopediaPage } from "../../services/encyclopediaQueries"
import { CARD_PAGE_STALE_MS, pageDrawsHoverCards, parseHoverCard, parseRing, TAP_ATTRIBUTE, type HoverCardKind } from "../../utils/hoverCards"
import type { AptitudeKey } from "../../types/pvpTeam"
import { CARD_POPUP_BOX, CARD_POPUP_PLACEMENT, cardPopupMiddleware, InsideHoverContext, InsidePopupContext, watchFooterAd } from "../pvp/hoverPopup"
import { HoverCardContent } from "./HoverCardContent"

const TILE = "[data-hover-card]"
// WithDetail's markers (PvpTiles.tsx): a tile inside one has a popup of its own.
const OWN_HOVER = '[role="group"][aria-describedby]'
// Anything a click already means something to. A tile under one of these
// keeps that meaning, unless it is a link to the tile's own page.
const CONTROL = 'a[href], button, [role="button"], summary, label, input, select, textarea'
// Set on <html> while the layer is on, so the stylesheet can give a tile the
// pointer cursor only for the people a click does something for.
const ACTIVE_ATTRIBUTE = "data-hover-cards"

// A tile wider than this is a row, not a picture: the card's own width.
const WIDE_TILE_PX = 320

/**
 * What the card is placed beside. A picture-sized tile: the tile. A row wider
 * than the card (a ranking row is the list's whole width): the point on it
 * that was clicked, as a box of no width and the row's height, so the card
 * opens next to the pointer, level with the row's top. Beside the row itself
 * there is no room on either side, and the card would land over its far end.
 * The box is measured from the row each time, so scrolling moves the card
 * with it.
 */
function anchorFor(tile: Element, clientX: number): ReferenceType {
	const box = tile.getBoundingClientRect()
	if (box.width <= WIDE_TILE_PX) return tile
	const fromLeft = clientX - box.left
	return {
		contextElement: tile,
		getBoundingClientRect() {
			const now = tile.getBoundingClientRect()
			const x = now.left + fromLeft
			return { x, y: now.top, width: 0, height: now.height, top: now.top, bottom: now.bottom, left: x, right: x }
		},
	}
}

interface Target {
	kind: HoverCardKind
	id: number
	element: Element
	ring: AptitudeKey[]
}

export function HoverCardLayer() {
	// Loaded now, not on the first click: the catalogue says which row is
	// which page (one request a session, shared with every page's links).
	// Not on a page that draws no tiles, though (pageDrawsHoverCards has the
	// numbers): there the layer only reads it, should another page have
	// loaded it already.
	const { pathname } = useLocation()
	const load = pageDrawsHoverCards(pathname)
	const lookup = useEncyclopediaLookup({ load })
	const hrefs = useEncyclopediaHrefs({ load })
	// The listeners below read the catalogue through a ref, so its arrival
	// doesn't tear them down (and with them a card opened a moment before).
	const catalogue = useRef({ lookup, hrefs })
	useEffect(() => {
		catalogue.current = { lookup, hrefs }
	}, [lookup, hrefs])
	const queryClient = useQueryClient()
	const [target, setTarget] = useState<Target | null>(null)
	const [open, setOpen] = useState(false)
	const closeRef = useRef<() => void>(() => {})
	const floatingRef = useRef<HTMLElement | null>(null)
	// The open card's tile, for the check below (the card may be placed
	// beside a point on it, not the element itself).
	const tileRef = useRef<Element | null>(null)
	const { refs, floatingStyles, middlewareData } = useFloating({
		open,
		// Beside the tile, slid to fit the window: the rule a guide tile's
		// pinned card shares (hoverPopup.tsx, "WHERE ... GOES").
		placement: CARD_POPUP_PLACEMENT,
		strategy: "fixed",
		middleware: [...cardPopupMiddleware(), hide()],
		// The tile can leave the page under the card (a list re-sorts): then
		// the card goes too. The ad watcher (`watchFooterAd`) places the card
		// again when Raptive's footer ad slides in after it opened.
		whileElementsMounted: (reference, floating, update) => {
			const stopFollowing = autoUpdate(reference, floating, () => {
				if (tileRef.current && !tileRef.current.isConnected) closeRef.current()
				else update()
			})
			const stopWatching = watchFooterAd(update)
			return () => {
				stopFollowing()
				stopWatching()
			}
		},
	})

	useEffect(() => {
		let current: Element | null = null
		// The last press came from a finger: its click is the tile's own.
		let touch = false
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
		const close = () => {
			restoreTitles()
			current = null
			tileRef.current = null
			setOpen(false)
		}
		closeRef.current = close
		const activate = (tile: Element, clientX: number) => {
			const parsed = parseHoverCard(tile.getAttribute("data-hover-card"))
			if (!parsed) return
			restoreTitles()
			stashTitles(tile)
			current = tile
			tileRef.current = tile
			refs.setPositionReference(anchorFor(tile, clientX))
			setTarget({
				...parsed,
				element: tile,
				ring: parseRing(tile.getAttribute("data-hover-card-ring")),
			})
			setOpen(true)
		}
		const inCard = (node: EventTarget | null) => node instanceof Node && Boolean(floatingRef.current?.contains(node))
		const pageOf = (tile: Element) => {
			const parsed = parseHoverCard(tile.getAttribute("data-hover-card"))
			const { hrefs: pages } = catalogue.current
			return parsed ? (parsed.kind === "uma" ? pages.uma(parsed.id) : pages.card(parsed.id)) : null
		}
		/**
		 * The tile a click at `node` opens a card for, or null when the click
		 * belongs to something else. The nearest link or button around the
		 * point decides: none means plain art; a link to the tile's own
		 * Encyclopedia page gives way to the card; anything else is a job the
		 * click keeps.
		 */
		const tileFor = (node: EventTarget | null, tapped = false): Element | null => {
			if (!(node instanceof Element) || inCard(node)) return null
			const tile = node.closest(TILE)
			if (!tile || tile.closest(OWN_HOVER)) return null
			// A tap opens only a tile that asks for it; elsewhere it follows the link.
			if (tapped && tile.getAttribute(TAP_ATTRIBUTE) !== "on") return null
			const control = node.closest(CONTROL)
			if (!control) return tile
			return control instanceof HTMLAnchorElement && control.pathname === pageOf(tile) ? tile : null
		}

		// A press on a tile starts its page's fetch, so by the click (the
		// release, about a tenth of a second later) the card usually has its
		// facts and opens whole instead of growing a moment after.
		const onPointerDown = (event: PointerEvent) => {
			touch = event.pointerType === "touch"
			if (touch || event.button !== 0) return
			const tile = tileFor(event.target)
			// The safety net for a tile on a page pageDrawsHoverCards says has
			// none: its first click finds no catalogue, the next one does.
			if (tile) loadEncyclopediaIndex()
			const parsed = tile && tile !== current ? parseHoverCard(tile.getAttribute("data-hover-card")) : null
			const { lookup: rows } = catalogue.current
			const entry = parsed && (parsed.kind === "uma" ? rows.uma(parsed.id) : rows.card(parsed.id))
			if (parsed && entry) prefetchEncyclopediaPage(queryClient, parsed.kind, entry.gameId, CARD_PAGE_STALE_MS)
		}
		const onClick = (event: MouseEvent) => {
			// The card's own links ("Open Encyclopedia", a skill) are ordinary links.
			if (inCard(event.target)) return
			// A new-tab click (Ctrl, a middle button) and a keyboard or screen
			// reader click (detail 0) keep the link's meaning; so does a tap,
			// except on a tile marked `tap` (tileFor).
			const ordinary = event.button === 0 && event.detail > 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
			const tile = ordinary ? tileFor(event.target, touch) : null
			if (!tile) {
				if (current) close()
				return
			}
			// A click on a link is the card's now: the link doesn't navigate, and
			// React never hears of it, so the link's own onClick doesn't run. A
			// click on plain art had no other job; it is left to travel on, for
			// whatever listens for clicks outside itself.
			if (event.target instanceof Element && event.target.closest(CONTROL)) {
				event.preventDefault()
				event.stopPropagation()
			}
			if (tile === current) close()
			else activate(tile, event.clientX)
		}
		// Escape closes the card first, and only the card: a picker under it
		// (which listens for Escape too) stays for the next press.
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || !current) return
			event.stopPropagation()
			close()
		}

		// Capture, so the click is settled before React (which listens on the
		// app's root) hands it to a <Link>.
		document.addEventListener("pointerdown", onPointerDown, true)
		document.addEventListener("click", onClick, true)
		document.addEventListener("keydown", onKeyDown, true)
		document.documentElement.setAttribute(ACTIVE_ATTRIBUTE, "")
		return () => {
			close()
			document.removeEventListener("pointerdown", onPointerDown, true)
			document.removeEventListener("click", onClick, true)
			document.removeEventListener("keydown", onKeyDown, true)
			document.documentElement.removeAttribute(ACTIVE_ATTRIBUTE)
		}
	}, [refs, queryClient])

	// "Open Encyclopedia", a skill chip, or any other navigation ends the card.
	const { key: locationKey } = useLocation()
	useEffect(() => closeRef.current(), [locationKey])

	if (!open || !target) return null
	return (
		<FloatingPortal root={(target.element.closest("dialog[open]") as HTMLElement | null) ?? undefined}>
			<Popup
				target={target}
				setFloating={(node) => {
					floatingRef.current = node
					refs.setFloating(node)
				}}
				// Out of sight with its tile (scrolled off inside a picker's list, or
				// off the window), and back when the tile is.
				style={{ ...floatingStyles, visibility: middlewareData.hide?.referenceHidden ? "hidden" : "visible" }}
			/>
		</FloatingPortal>
	)
}

// The card is redrawn only when it shows something else: the box around it
// is given a new position on every scroll and resize, and the facts inside
// don't change with it.
const Content = memo(HoverCardContent)

/**
 * The drawn card's box. Its content (HoverCardContent) mounts only while a
 * card is open, so a supporter who never clicks one asks for nothing; it
 * draws nothing for a row the catalogue doesn't know (a placeholder card),
 * and then neither does the box. Never taller than the window: a long card
 * scrolls inside itself.
 */
function Popup({ target, setFloating, style }: {
	target: Target
	setFloating: (node: HTMLElement | null) => void
	style: CSSProperties
}) {
	const lookup = useEncyclopediaLookup()
	const known = target.kind === "uma" ? lookup.uma(target.id) : lookup.card(target.id)
	if (!known) return null
	return (
		<div
			ref={setFloating}
			aria-hidden="true"
			style={style}
			className={`z-[10001] rounded-lg border border-gray-600 bg-gray-900 p-2 text-left text-xs leading-snug text-gray-200 shadow-lg ${CARD_POPUP_BOX}`}
		>
			<InsidePopupContext.Provider value={true}>
				<InsideHoverContext.Provider value={true}>
					<Content kind={target.kind} id={target.id} ring={target.ring} />
				</InsideHoverContext.Provider>
			</InsidePopupContext.Provider>
		</div>
	)
}
