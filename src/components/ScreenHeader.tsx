/**
 * A screen's header: the place's name and the pages (or views) that share the
 * place, as tabs. One component for the Calculator, the Timeline, the
 * Encyclopedia's lists and Rankings (owner, 2026-11-25: "they should share an
 * adjustable component"). PvP keeps its own rows: its tabs are one page's
 * `?view=` with the event picker beside them.
 *
 * TWO SHAPES, PICKED BY WIDTH (owner, 2026-11-25, from the canvas in the notes
 * repo's notes/screen-header-options/). The stylesheet owns the switch
 * (encyclopedia.css, ".enc-head--mast", at 64rem, where the navbar itself
 * turns into its phone layout); this file only asks it which one is drawn.
 *
 *   - BELOW 64rem, ONE BAR. The header is a single row of the pages, the full
 *     width of the screen, and it is itself what sticks under the navbar: the
 *     same row at rest and pinned, so nothing swaps. The title is not drawn
 *     (the navbar has the place lit right above), but it is still in the page
 *     for a screen reader and as the page's <h1>.
 *   - FROM 64rem, THE MASTHEAD. The title large at the left, the tabs at the
 *     right on the rule, one line each (icon, name, and a chip where a tab has
 *     a badge). It scrolls away with the page, and once it has gone up under
 *     the navbar the COMPACT BAR takes over: the tabs alone, small, one equal
 *     column each, pinned.
 *
 * WHY THE MASTHEAD HAS A SECOND COPY INSTEAD OF SHRINKING. A sticky box that
 * changes height as it sticks moves everything under it by the difference,
 * which moves the scroll position, which can unstick it again: the header
 * flickers at the threshold. Here the masthead never changes, and the compact
 * bar lives in a ZERO-HEIGHT sticky anchor, so showing it moves nothing. It
 * only paints over the page the way any pinned bar does. The phone's bar needs
 * none of that: it is one height always, so it just sticks.
 *
 * THE STICKY PARTS MUST BE CHILDREN OF THE LONG CONTAINER. `sticky` only sticks
 * inside its parent, so the header renders a fragment (top marker, anchor,
 * header) and never a wrapper of its own: a wrapper as tall as the header
 * would carry the bar away with it. AppShell mounts it straight in the
 * scroller; Rankings mounts it in the page area, outside its flex column (a
 * zero-height child of a gapped column still costs a gap).
 *
 * WHAT READS THE HEADER FROM OUTSIDE
 *   - `data-screen-top` is a plain, unstuck node at the very top: where "Back
 *     to top" scrolls (hooks/useBackToTop.ts). Not the header: on a phone the
 *     header is stuck in view already, so scrolling "to" it goes nowhere.
 *   - `data-screen-tabs` is the compact bar's box. The scroll padding
 *     (index.css) keys off it being in the page, so it is there at rest too,
 *     just zero tall; the hover cards (pvp/hoverPopup.tsx) keep below every
 *     top bar with a height, and at rest the box has none, so it doesn't
 *     count. Its slide-in moves the box's CHILD, so the box's rect never
 *     shifts.
 *   - `data-popup-top-bar` is on the header only while the header IS the bar
 *     (the phone's shape), so the hover cards keep below it too. The masthead
 *     never carries it: it is page content that scrolls away.
 *   - `data-screen-bar-line` is the ruler: an invisible box the bar's full
 *     height at the bar's place, in either shape, shown or not. The
 *     Encyclopedia's pinned finder (listFilters.tsx) compares its own top with
 *     the ruler's bottom to know it is pinned. Not the compact bar's box: a
 *     one-shot jump (End, an index link) runs both scroll listeners in one
 *     frame, before the bar has grown, and the finder would read a zero-tall
 *     bar and stay unpinned until the next scroll.
 * The compact <nav> itself is mounted only while it shows, so the page never
 * holds two live copies of the tabs for a keyboard or a screen reader to walk
 * through, and tests (which can't see CSS) find one.
 *
 * WHEN THE COMPACT BAR SHOWS: when the masthead's bottom reaches the bar's
 * bottom edge (the stick line plus --screen-tabs-h). Any later and the bands
 * that pin under the bar (the Timeline's controls, the Encyclopedia's finder)
 * would pin with a gap above them for a moment. Never while the header is the
 * bar: a stuck header's bottom sits exactly on that line, and the copy would
 * mount on top of it. Measured by rect (and the header's computed `position`)
 * in an effect, on every scroller (a capture listener: the desktop shell
 * scrolls an inner box), so it works the same where the document scrolls and
 * in the desktop shell, and the build-time render is the header alone.
 *
 * WHERE IT STICKS. Two scrolling set-ups (ApplicationViews, the scroller's
 * comment): where the document scrolls, under the sticky navbar, so at the
 * navbar's measured height (--navbar-h, hooks/useNavbarHeight.ts; the
 * written-down figure only for the first paint), plus the phone's wordmark row
 * while it is shown (--navbar-reveal, hooks/useNavbarReveal.ts); in the
 * desktop shell the page scrolls inside its own box with the navbar outside
 * it, so the bar sticks at that box's top. Opaque, or the page shows through.
 *
 * THE BAR'S HEIGHT IS --screen-tabs-h (index.css), one figure per shape.
 * Change it there, never here.
 *
 * LINKS OR BUTTONS. The Calculator's, Timeline's and Encyclopedia's tabs are
 * pages with their own addresses, so they are NavLinks in a <nav> with
 * aria-current. Rankings' are views of one page (`?view=`), so they are
 * buttons in a tablist with aria-selected, and the page draws the tabpanel.
 */

import { useEffect, useRef, useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import type { LucideIcon } from "lucide-react"

interface TabBase {
	label: string
	/** What a phone shows when the full label won't fit; the full one stays its name. */
	short?: string
	icon: LucideIcon
}

/** A page of the screen: a link. */
export interface ScreenLinkTab extends TabBase {
	/** The route, which is also how the header knows which page is open. */
	to: string
	/**
	 * The page draws its own <h1> (Selectors, Legend Races, the Library), so the
	 * header's title is not a heading there: one <h1> a page.
	 */
	ownHeading?: boolean
}

/** A view of one page: a button. */
export interface ScreenButtonTab<Id extends string> extends TabBase {
	id: Id
	/**
	 * A short figure after the name in the masthead ("51", "CM 22"), as a chip.
	 * The phone's bar and the compact bar have no room for it and leave it out.
	 */
	badge?: string
}

type ScreenHeaderTabs<Id extends string> =
	| { kind: "links"; tabs: readonly ScreenLinkTab[] }
	| { kind: "buttons"; tabs: readonly ScreenButtonTab<Id>[]; active: Id; onSelect: (id: Id) => void }

export type ScreenHeaderProps<Id extends string> = {
	/** The place's name: large at the masthead's left, the page's heading at every width. */
	title: string
	icon: LucideIcon
	/** The tabs' accessible name. */
	label: string
	/**
	 * The page's column, as a max-width utility (a literal, so Tailwind sees it),
	 * so the masthead and the bar line up with the page under them.
	 */
	column: string
} & ScreenHeaderTabs<Id>

// Literal strings so Tailwind sees them. One equal column per tab in the compact
// bar (owner, 2026-11-24: not bunched at the left).
const GRID_COLUMNS: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" }

/** "/app/" is "/app": the bare path with no trailing slash. */
function normalPath(pathname: string): string {
	return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
}

/**
 * What the scroll position and the stylesheet say about the header:
 *   - `isBar`: the header itself is the pinned bar (the phone's shape);
 *   - `past`: the masthead has scrolled up under the bar's line, so the
 *     compact bar shows. Never true while `isBar`.
 */
function useHeaderState() {
	const anchorRef = useRef<HTMLDivElement>(null)
	const rulerRef = useRef<HTMLDivElement>(null)
	const headRef = useRef<HTMLElement>(null)
	const [isBar, setIsBar] = useState(false)
	const [past, setPast] = useState(false)
	useEffect(() => {
		let frame = 0
		const measure = () => {
			frame = 0
			const anchor = anchorRef.current
			const head = headRef.current
			if (!anchor || !head) return
			const box = head.getBoundingClientRect()
			// Nothing laid out (jsdom, a hidden tab): the header alone is what shows.
			if (box.height === 0) {
				setIsBar(false)
				setPast(false)
				return
			}
			// The stylesheet decides the shape (a media query); `sticky` is how it says
			// "this header is the bar". Read here so the breakpoint lives in one place.
			if (getComputedStyle(head).position === "sticky") {
				setIsBar(true)
				setPast(false)
				return
			}
			setIsBar(false)
			// The ruler is --screen-tabs-h tall, so the bar's height is read from the one
			// variable, not a copy of it (the compact bar itself is zero tall until it shows).
			const barBottom = anchor.getBoundingClientRect().top + (rulerRef.current?.offsetHeight ?? 0)
			setPast(box.bottom <= barBottom + 0.5)
		}
		const later = () => {
			if (!frame) frame = requestAnimationFrame(measure)
		}
		// Capture: the desktop shell scrolls an inner box, and a scroll doesn't bubble.
		window.addEventListener("scroll", later, { capture: true, passive: true })
		// A resize can cross the stylesheet's breakpoint and swap the shape.
		window.addEventListener("resize", later)
		measure()
		return () => {
			cancelAnimationFrame(frame)
			window.removeEventListener("scroll", later, { capture: true })
			window.removeEventListener("resize", later)
		}
	}, [])
	return { anchorRef, rulerRef, headRef, isBar, past }
}

export function ScreenHeader<Id extends string>(props: ScreenHeaderProps<Id>) {
	const { title, icon: TitleIcon, column } = props
	const { pathname } = useLocation()
	const { anchorRef, rulerRef, headRef, isBar, past } = useHeaderState()
	const width = `mx-auto w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] ${column}`

	// One <h1> a page: a page that draws its own heading gets the title as text.
	const openLink = props.kind === "links" ? props.tabs.find((tab) => tab.to === normalPath(pathname)) : undefined
	const Title = openLink?.ownHeading ? "p" : "h1"

	return (
		<>
			{/* The top of the screen, for "Back to top": in the flow, never stuck. The
			    scroll margin is a screen tall on purpose: scrollIntoView parks its target
			    below the scroll padding (the navbar's and the bar's room), which would
			    stop a few px short of the top; a margin this size asks for less than
			    zero, and the scroller settles at zero. */}
			<div data-screen-top="" className="scroll-mt-[100vh]" />
			{/* The anchor: zero tall, so the compact bar in it takes no room in the page. */}
			<div ref={anchorRef} className="sticky top-[calc(var(--navbar-h,4.125rem)_+_var(--navbar-reveal,0px))] z-30 h-0 app-shell:top-0">
				{/* The ruler: the bar's full height at the bar's place, shown or not. */}
				<div ref={rulerRef} data-screen-bar-line="" aria-hidden="true" className="pointer-events-none invisible absolute h-(--screen-tabs-h) w-0" />
				<div data-screen-tabs="" className={past ? "enc-pinbox h-(--screen-tabs-h) bg-gray-900" : "h-0"}>
					{past && <Tabs {...props} className={`enc-pin grid ${GRID_COLUMNS[props.tabs.length] ?? "grid-cols-3"} ${width}`} />}
				</div>
			</div>
			{/* The header's own box is the full width (the phone's bar is opaque edge to
			    edge); the column sits inside it. */}
			<header ref={headRef} data-screen-head="" data-popup-top-bar={isBar ? "" : undefined} className="enc-head--mast">
				<div className={`enc-head__in ${width}`}>
					<Title className="enc-head__title">
						<TitleIcon aria-hidden="true" />
						{title}
					</Title>
					<Tabs {...props} className="enc-tabs" chips />
				</div>
			</header>
		</>
	)
}

/** A tab's name, with the phone's short form where it has one. */
function TabName({ tab }: { tab: TabBase }) {
	if (!tab.short) return <span className="truncate">{tab.label}</span>
	return (
		<>
			<span className="sm:hidden" aria-hidden="true">
				{tab.short}
			</span>
			<span className="sr-only sm:not-sr-only">{tab.label}</span>
		</>
	)
}

/**
 * One row of the tabs: the header's own, and the compact bar's. The same markup
 * in both, so encyclopedia.css draws one tab (".enc-tab") and each row only
 * sizes it. `chips` draws a tab's badge; only the header's row has the room.
 */
function Tabs<Id extends string>(props: ScreenHeaderProps<Id> & { className: string; chips?: boolean }) {
	const { className, chips = false } = props
	if (props.kind === "links") {
		return (
			<nav aria-label={props.label} className={className}>
				{props.tabs.map((tab) => (
					// `end`: a screen's first page is often a prefix of the others ("/app"),
					// and would otherwise light up on every page under it. NavLink sets
					// aria-current="page" on the open one, which is what the styles key off.
					<NavLink key={tab.to} to={tab.to} end className="enc-tab">
						<b aria-hidden="true">
							<tab.icon />
						</b>
						<TabName tab={tab} />
					</NavLink>
				))}
			</nav>
		)
	}
	return (
		<div role="tablist" aria-label={props.label} className={className}>
			{props.tabs.map((tab) => (
				<button
					key={tab.id}
					type="button"
					role="tab"
					aria-selected={tab.id === props.active}
					onClick={() => props.onSelect(tab.id)}
					className="enc-tab"
				>
					<b aria-hidden="true">
						<tab.icon />
					</b>
					<TabName tab={tab} />
					{/* Decoration for a screen reader: the name alone is the tab's label. */}
					{chips && tab.badge !== undefined && (
						<span className="enc-tab__chip" aria-hidden="true">
							{tab.badge}
						</span>
					)}
				</button>
			))}
		</div>
	)
}
