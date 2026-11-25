/**
 * A screen's header: the place's name, one line on what it is for, and the
 * pages (or views) that share the place, as tabs. One component for the
 * Calculator, the Timeline, the Encyclopedia's lists and Rankings (owner,
 * 2026-11-25: "they should share an adjustable component"). PvP keeps its own
 * rows: its tabs are one page's `?view=` with the event picker beside them.
 *
 * TWO LOOKS, ONE HEADER.
 *   - At rest it is the MASTHEAD (encyclopedia.css, ".enc-head--mast"): the
 *     title large on the left, the line under it, the tabs on the right with
 *     an icon (or a badge) over each name. It scrolls away with the page.
 *   - Once the masthead has scrolled up under the navbar, the COMPACT BAR takes
 *     over: the tabs alone, small, in one row, pinned under the navbar.
 *
 * WHY TWO COPIES INSTEAD OF ONE BOX THAT SHRINKS. A sticky box that changes
 * height as it sticks moves everything under it by the difference, which moves
 * the scroll position, which can unstick it again: the header flickers at the
 * threshold. Here the masthead never changes, and the compact bar lives in a
 * ZERO-HEIGHT sticky anchor, so showing it moves nothing. It only paints over
 * the page the way any pinned bar does.
 *
 * THE ANCHOR MUST BE A CHILD OF THE LONG CONTAINER. `sticky` only sticks
 * inside its parent, so the header renders a fragment (anchor, masthead) and
 * never a wrapper of its own: a wrapper as tall as the masthead would carry
 * the bar away with it. AppShell mounts it straight in the scroller; Rankings
 * mounts it in the page area, outside its flex column (a zero-height child of
 * a gapped column still costs a gap).
 *
 * `data-screen-tabs` IS THE BAR'S BOX, and two things read it:
 *   - the scroll padding (index.css), which keys off it being in the page, so
 *     it is there at rest too, just zero tall;
 *   - the hover cards (pvp/hoverPopup.tsx), which keep below every top bar
 *     with a height. At rest the box has none, so it doesn't count. Its
 *     slide-in moves the box's CHILD, so the box's rect never shifts.
 * `data-screen-bar-line` IS THE RULER: an invisible box the bar's full height
 * at the bar's place, whether the bar shows or not. The Encyclopedia's pinned
 * finder (listFilters.tsx) compares its own top with the ruler's bottom to know
 * it is pinned. Not the bar's box: a one-shot jump (End, an index link) runs
 * both scroll listeners in one frame, before the bar has grown, and the finder
 * would read a zero-tall bar and stay unpinned until the next scroll.
 * The compact <nav> itself is mounted only while it shows, so the page never
 * holds two live copies of the tabs for a keyboard or a screen reader to walk
 * through, and tests (which can't see CSS) find one.
 *
 * WHEN IT SWITCHES: when the masthead's bottom reaches the bar's bottom edge
 * (the stick line plus --screen-tabs-h). Any later and the bands that pin
 * under the bar (the Timeline's controls, the Encyclopedia's finder) would pin
 * with a gap above them for a moment. Measured by rect in an effect, on every
 * scroller (a capture listener: the desktop shell scrolls an inner box), so it
 * works the same where the document scrolls and in the desktop shell, and the
 * build-time render is the masthead alone.
 *
 * WHERE IT STICKS. Two scrolling set-ups (ApplicationViews, the scroller's
 * comment): on a phone the document scrolls under the sticky navbar, so the
 * bar sticks at the navbar's measured height (--navbar-h,
 * hooks/useNavbarHeight.ts; the written-down figure only for the first paint),
 * plus the phone's wordmark row while it is shown (--navbar-reveal,
 * hooks/useNavbarReveal.ts); in the desktop shell the page scrolls inside its
 * own box with the navbar outside it, so the bar sticks at that box's top.
 * Opaque, or the page shows through.
 *
 * THE BAR'S HEIGHT IS --screen-tabs-h (index.css). Change it there, never here.
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
	 * masthead's title is not a heading there: one <h1> a page.
	 */
	ownHeading?: boolean
}

/** A view of one page: a button. */
export interface ScreenButtonTab<Id extends string> extends TabBase {
	id: Id
	/** The masthead's lead in place of the icon ("51", "CM 22"); the compact bar never shows it. */
	badge?: string
}

type ScreenHeaderTabs<Id extends string> =
	| { kind: "links"; tabs: readonly ScreenLinkTab[] }
	| { kind: "buttons"; tabs: readonly ScreenButtonTab<Id>[]; active: Id; onSelect: (id: Id) => void }

export type ScreenHeaderProps<Id extends string> = {
	/** The place's name, large at the top left. */
	title: string
	icon: LucideIcon
	/** One line on what the place is for. */
	description: string
	/** The tabs' accessible name. */
	label: string
	/**
	 * The page's column, as a max-width utility (a literal, so Tailwind sees it),
	 * so the masthead and the bar line up with the page under them.
	 */
	column: string
} & ScreenHeaderTabs<Id>

// Literal strings so Tailwind sees them. One equal column per tab at EVERY
// width in the compact bar (owner, 2026-11-24: not bunched at the left).
const GRID_COLUMNS: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" }

/** "/app/" is "/app": the bare path with no trailing slash. */
function normalPath(pathname: string): string {
	return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
}

/** Whether the masthead has scrolled up under the bar's line, measured on scroll. */
function useScrolledPast() {
	const anchorRef = useRef<HTMLDivElement>(null)
	const rulerRef = useRef<HTMLDivElement>(null)
	const mastRef = useRef<HTMLElement>(null)
	const [past, setPast] = useState(false)
	useEffect(() => {
		let frame = 0
		const measure = () => {
			frame = 0
			const anchor = anchorRef.current
			const mast = mastRef.current
			if (!anchor || !mast) return
			const box = mast.getBoundingClientRect()
			// Nothing laid out (jsdom, a hidden tab): the masthead is what shows.
			if (box.height === 0) {
				setPast(false)
				return
			}
			// The ruler is --screen-tabs-h tall, so the bar's height is read from the one
			// variable, not a copy of it (the bar itself is zero tall until it shows).
			const barBottom = anchor.getBoundingClientRect().top + (rulerRef.current?.offsetHeight ?? 0)
			setPast(box.bottom <= barBottom + 0.5)
		}
		const later = () => {
			if (!frame) frame = requestAnimationFrame(measure)
		}
		// Capture: the desktop shell scrolls an inner box, and a scroll doesn't bubble.
		window.addEventListener("scroll", later, { capture: true, passive: true })
		window.addEventListener("resize", later)
		measure()
		return () => {
			cancelAnimationFrame(frame)
			window.removeEventListener("scroll", later, { capture: true })
			window.removeEventListener("resize", later)
		}
	}, [])
	return { anchorRef, rulerRef, mastRef, past }
}

export function ScreenHeader<Id extends string>(props: ScreenHeaderProps<Id>) {
	const { title, icon: TitleIcon, description, label, column } = props
	const { pathname } = useLocation()
	const { anchorRef, rulerRef, mastRef, past } = useScrolledPast()
	const width = `mx-auto w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] ${column}`

	// One <h1> a page: a page that draws its own heading gets the title as text.
	const openLink = props.kind === "links" ? props.tabs.find((tab) => tab.to === normalPath(pathname)) : undefined
	const Title = openLink?.ownHeading ? "p" : "h1"

	return (
		<>
			{/* The anchor: zero tall, so the bar in it takes no room in the page. */}
			<div ref={anchorRef} className="sticky top-[calc(var(--navbar-h,4.125rem)_+_var(--navbar-reveal,0px))] z-30 h-0 app-shell:top-0">
				{/* The ruler: the bar's full height at the bar's place, shown or not. */}
				<div ref={rulerRef} data-screen-bar-line="" aria-hidden="true" className="pointer-events-none invisible absolute h-(--screen-tabs-h) w-0" />
				<div data-screen-tabs="" className={past ? "h-(--screen-tabs-h) bg-gray-900" : "h-0"}>
					{past && <CompactTabs {...props} width={width} />}
				</div>
			</div>
			<header ref={mastRef} data-screen-head="" className={`enc-head enc-head--mast mt-5 ${width}`}>
				<div>
					<Title className="enc-head__title">
						<TitleIcon aria-hidden="true" />
						{title}
					</Title>
					<p className="enc-head__sub">{description}</p>
				</div>
				{props.kind === "links" ? (
					<nav aria-label={label} className="enc-tabs">
						{props.tabs.map((tab) => (
							<NavLink key={tab.to} to={tab.to} end className="enc-tab">
								<b aria-hidden="true">
									<tab.icon />
								</b>
								<TabName tab={tab} />
							</NavLink>
						))}
					</nav>
				) : (
					<div role="tablist" aria-label={label} className="enc-tabs">
						{props.tabs.map((tab) => (
							<button
								key={tab.id}
								type="button"
								role="tab"
								aria-selected={tab.id === props.active}
								onClick={() => props.onSelect(tab.id)}
								className="enc-tab"
							>
								{/* The lead is decoration for a screen reader: the name is the tab's label. */}
								<b aria-hidden="true">{tab.badge ?? <tab.icon />}</b>
								<TabName tab={tab} />
							</button>
						))}
					</div>
				)}
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

/** The pinned bar: the tabs alone, one equal column each (the look the screen bars had since 2026-11-24). */
function CompactTabs<Id extends string>(props: ScreenHeaderProps<Id> & { width: string }) {
	const row = `grid h-(--screen-tabs-h) gap-1 border-b border-gray-700 ${props.width} ${GRID_COLUMNS[props.tabs.length] ?? "grid-cols-3"}`
	const look = (active: boolean) =>
		`-mb-px flex min-w-0 items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-sm font-semibold transition sm:px-4 ${
			active ? "border-brand text-brand" : "border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-100"
		}`
	if (props.kind === "links") {
		return (
			<nav aria-label={props.label} className={row}>
				{props.tabs.map((tab) => (
					// `end`: a screen's first page is often a prefix of the others ("/app"),
					// and would otherwise light up on every page under it.
					<NavLink key={tab.to} to={tab.to} end className={({ isActive }) => look(isActive)}>
						<tab.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
						<TabName tab={tab} />
					</NavLink>
				))}
			</nav>
		)
	}
	return (
		<div role="tablist" aria-label={props.label} className={row}>
			{props.tabs.map((tab) => (
				<button
					key={tab.id}
					type="button"
					role="tab"
					aria-selected={tab.id === props.active}
					onClick={() => props.onSelect(tab.id)}
					className={look(tab.id === props.active)}
				>
					<tab.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
					<TabName tab={tab} />
				</button>
			))}
		</div>
	)
}
