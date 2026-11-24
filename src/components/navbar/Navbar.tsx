import { useRef } from "react"
import { Link, useLocation } from "react-router-dom"
import { LogIn } from "lucide-react"
import { useCalculatorDataSafe } from "../../services/CalculatorContext"
import { prefetchCalculatorData } from "../../services/calculatorFetchCalls"
import { useAccount } from "../../services/AuthContext"
import { Wordmark } from "../Wordmark"
import { OguriSpinner } from "../OguriSpinner"
import { TeamDrawerButton } from "./TeamDrawerButton"
import { SiteMenu } from "./SiteMenu"
import { navPlacesFor } from "./navPlaces"
import { NAV_BUTTON, NAV_SAVE_BUTTON } from "./navStyles"
import { SiteSearchButton, SiteSearchDialog } from "../search/SiteSearch"
import { useSiteSearch } from "../../hooks/useSiteSearch"
import { useNavbarHeight } from "../../hooks/useNavbarHeight"

export const Navbar = () => {
	const navbarRef = useRef<HTMLDivElement>(null)
	useNavbarHeight(navbarRef)
	const location = useLocation()
	// null when rendered outside CalculatorProvider (e.g. on the home page)
	const calculatorData = useCalculatorDataSafe()

	// Warm /calculator-data when the pointer (or keyboard focus) lands on a link
	// into /app, so the payload is on its way before the click.
	//
	// Only OUTSIDE the provider. Inside /app the data is already loaded and in
	// context, and prefetchCalculatorData() would have nothing usable to reuse —
	// so hovering "Timeline" while sitting on the calculator would fire a
	// pointless second megabyte.
	const prefetchOnIntent = calculatorData
		? {}
		: { onMouseEnter: prefetchCalculatorData, onFocus: prefetchCalculatorData }

	// Was read straight from localStorage here. Going through the provider means
	// a token dropped ELSEWHERE — the calculator's 401 recovery, or a sign-out in
	// another tab — re-renders this slot, instead of leaving it showing a
	// signed-in avatar to someone the server no longer recognises. Sign-out
	// itself lives in SiteMenu now.
	const { isLoggedIn, account } = useAccount()
	const siteSearch = useSiteSearch()
	// The places this reader gets (navPlaces.ts): the same list for the phone
	// bar and the desktop bar. Rankings is Patreon only for now (owner,
	// 2026-10-27), so it joins for early access alone. The account is unknown
	// during the prerender and while it loads, so it appears after load and
	// never flashes.
	const places = navPlacesFor({ earlyAccess: Boolean(account?.early_access) })

	// Search + team drawer, grouped so the desktop nav's branches render the
	// same controls. TeamDrawerButton renders nothing outside app mode. The
	// theme was a palette button here until 2026-11-24; it is a row of the
	// menu at the end of the bar now (SiteMenu), which a guest gets too. The projection settings were a gear here until 2026-11-24; they are
	// a row of the calculator's Income & Resources panel now
	// (carat-calculator/ProjectionSettings.tsx), since only the calculator
	// reads them.
	const searchButton = <SiteSearchButton onOpen={() => siteSearch.setOpen(true)} />
	const navControls = (
		<>
			{searchButton}
			<TeamDrawerButton />
		</>
	)

	// A place stays lit on every page inside it: the Calculator on Selectors
	// and the Pull Plan Library, the Timeline on Legend Races. Those pages are
	// switched by the screen's own bar (components/ScreenTabs.tsx), which is why
	// neither has a tab here any more.

	const timerIsGoing = calculatorData?.timerIsGoing ?? false
	// False once this browser has refused to store the guest's plan.
	const guestPlanStored = calculatorData?.isGuestPlanStored ?? true

	// The active pill is a brand tint with a brand edge and nothing else. It
	// used to carry `shadow-sm`, which every theme block in index.css re-skinned
	// into a 14px drop shadow (until 2026-10-18) — on a 36px tab that read as a
	// floating chip.
	//
	// Icon ABOVE label since the fourth tab (Legend Races) arrived: side by
	// side, every label truncated at 375px.
	//
	// Seven tabs (2026-11-18) were more than a phone could name, so the words
	// hid below 440px and the bar was seven unlabelled icons. Since Selectors
	// and Legend Races moved under their places (2026-11-24) it is four tabs,
	// five with Rankings, and every one keeps its NAME at every phone width
	// (owner, 2026-11-24: the places stay on top, named, while a bottom bar
	// waits; notes/navigation-plan.md). Two things make five names fit 320px:
	// the cells are sized by their words (`flex-auto`), so a short name (PvP)
	// gives its room to a long one (Encyclopedia) instead of each taking a
	// fifth, and the words go from 11px to 10px below 360px.
	const mobileNavClass = (active: boolean) =>
		`nav-tab flex min-w-0 flex-auto flex-col items-center justify-center gap-0.5 rounded-lg border px-1.5 py-1.5 text-[11px] font-semibold transition max-[359px]:text-[10px] ${
			active
				? "nav-tab--active border-brand/50 bg-brand/10 text-brand"
				: "border-transparent text-gray-400 hover:bg-gray-700/70 hover:text-gray-100"
		}`
	const desktopNavClass = (active: boolean) =>
		`nav-tab flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-sm font-medium transition ${
			active
				? "nav-tab--active border-brand/50 bg-brand/10 text-brand"
				: "border-transparent text-gray-400 hover:bg-gray-700/70 hover:text-gray-100"
		}`

	// Shared logo element used in both mobile and desktop navs
	const logo = <Wordmark size="nav" />

	// Guest affordance shown in app mode instead of the save icon + avatar.
	// Passive by design — it never interrupts planning.
	//
	// A plain link. It used to snapshot the plan into sessionStorage on the way
	// out, because the provider unmounts on a route change and took the plan
	// with it. The plan is on the device already now (guestPlanStore), and the
	// provider finds it there when the person comes back signed in.
	//
	// "In this browser" is the whole claim, on purpose: browser storage can be
	// cleared from under us, so the copy never says just "saved". It lives in
	// the tooltip alone. A status line beside the button was tried and sat
	// awkwardly in the bar; a failed write already announces itself with a toast.
	const signInToSyncButton = (
		<Link
			to="/login"
			title={
				guestPlanStored
					? "Your plan is saved in this browser. Sign in to keep it safe and use it on your other devices."
					: "This browser isn't saving your plan. Sign in to keep it."
			}
			className={NAV_BUTTON}
		>
			<LogIn className="w-4 h-4" />
			{/* Shorter on a phone and just the icon on a small one, or the search
			    button squeezes the wordmark. */}
			<span className="max-[379px]:sr-only">
				Sign in<span className="hidden sm:inline"> to sync</span>
			</span>
		</Link>
	)

	// The end of the bar outside the app (home mode): the menu, with a Login
	// link before it for a guest. The menu is there for everyone: it holds
	// the theme and the info pages as well as the account.
	const authButton = isLoggedIn ? (
		<SiteMenu />
	) : (
		<>
			<Link
				to="/login"
				className={NAV_BUTTON}
			>
				<LogIn className="w-4 h-4" />
				{/* Just the icon on a small phone, where the menu button now sits beside it. */}
				<span className="max-[379px]:sr-only">Login</span>
			</Link>
			<SiteMenu />
		</>
	)

	// The bar is sticky wherever the DOCUMENT scrolls: every page on a phone,
	// and the home and info pages at any width. On the desktop /app shell it
	// is inert there: the bar sits outside that shell's internal scroller, so
	// it is already pinned.
	//
	// ON A PHONE ONLY THE PLACES PIN. The row above them (the wordmark, search,
	// Team, Sign in, the menu) scrolls away with the page: the sticky box's
	// `top` is minus that row's height, so the box stops when the row has left
	// the screen and the places sit at the top (owner, 2026-11-24). Scroll up
	// a little and the row is back. On desktop there is no such row and `top`
	// is 0. The row's height is its `h-14` (border included: border-box), so
	// the two numbers change together.
	//
	// What is MEASURED is the pinned part alone (`data-sticky-navbar`, the
	// ref): the PvP page pins its own tabs under it (hooks/usePvpStickyOffsets.ts),
	// and its height is --navbar-h for the screen bars and the Encyclopedia's
	// jump bar (hooks/useNavbarHeight.ts). html's `scroll-padding-top`
	// (index.css) carries the same height, so jump links and deep links land
	// below it rather than under it.
	return (
		<div className="sticky -top-14 z-50 shrink-0 desktop-nav:top-0">
			<SiteSearchDialog open={siteSearch.open} onClose={() => siteSearch.setOpen(false)} />
			{/* Phone, first row: scrolls away. Not a `site-navbar`: a theme's bar
			    edge (Winning Live's penlight strip) belongs under the places, the
			    part that stays. */}
				{/* Tighter gaps under 360px. Signed in, the row held five buttons
				    (search, team, gear, palette, profile) and at 320px the 6px gaps
				    pushed the wordmark onto a third line, clipping "Uma". It holds
				    three now, four for a guest (search, team, sign in, menu). */}
				<div className="flex h-14 items-center justify-between gap-2 border-b border-gray-700 bg-gray-900 px-3 min-[360px]:gap-3 desktop-nav:hidden">
					<div className="flex min-w-0 items-center">
						{logo}
					</div>

					<div className="relative flex shrink-0 items-center gap-1 min-[360px]:gap-1.5">
						{calculatorData ? (
							isLoggedIn ? (
								<>
									{/* Floats in the gap beside the buttons, only while a save
									    waits. A slot held for it in the row squeezed the wordmark. */}
									{timerIsGoing && (
										<div className="absolute right-full mr-1.5 flex h-9 w-9 items-center justify-center">
											<button
												onClick={calculatorData.saveNow}
												aria-label="Save now"
												title="Click to save now"
												className={NAV_SAVE_BUTTON}
											>
												<OguriSpinner size="sm" />
											</button>
										</div>
									)}
									{navControls}
									<SiteMenu />
								</>
							) : (
								<>
									{navControls}
									{signInToSyncButton}
									<SiteMenu />
								</>
							)
						) : (
							<>
								{searchButton}
								{authButton}
							</>
						)}
					</div>
				</div>

			{/* What stays pinned, and what is measured: the phone's places, or the
			    whole desktop bar. */}
			<div ref={navbarRef} data-sticky-navbar="">
			{/* Phone: the places. Capped at 32rem and centred: uncapped, a landscape
			    phone (844px) spread them across the whole width with wide gaps
			    between small labels; a portrait phone never reaches the cap. */}
			<nav aria-label="Site" className="site-navbar border-b border-gray-700 bg-gray-900 px-2 py-2 desktop-nav:hidden">
				<div className="mx-auto flex max-w-[32rem] gap-1">
					{places.map((place) => {
						const isOpen = place.isOpen(location.pathname)
						return (
							<Link key={place.id} to={place.to} aria-current={isOpen ? "page" : undefined} className={mobileNavClass(isOpen)} {...prefetchOnIntent}>
								<place.icon className="h-4 w-4 shrink-0" />
								<span className="max-w-full truncate">{place.label}</span>
							</Link>
						)
					})}
				</div>
			</nav>

			{/* Desktop nav — always three-column; center links always visible.
			    Switches on desktop-nav rather than md: this layout is already over-full
			    below ~900px (the "Sign in to sync" button wraps to 2-3 lines), which
			    is precisely the landscape-phone / portrait-tablet band. */}
			{/* The border and background span the window; the three columns inside
			    stop at 96rem, the same cap as .page-container. Without the cap the
			    wordmark and the account controls rode out to the window's edges on
			    wide screens, where a 16:9 recording crop cut both off. Below
			    96rem + the px-5 gutters (1576px) the cap never engages and the bar
			    is the plain edge-to-edge one. One cap for the whole bar, not a
			    per-page inset: see ui-conventions ("The wordmark sits on the bar's
			    gutter, capped at the page column"). */}
			<nav className="site-navbar hidden border-b border-gray-700 bg-gray-900 px-5 desktop-nav:block">
				<div className="mx-auto grid h-16 max-w-[96rem] grid-cols-[1fr_auto_1fr] items-center">
					{/* Left: Branding, on the bar's left gutter on every page. Until
					    2026-09-13 it was indented per page to line the wordmark up with the
					    canvas below (a calc in App.css plus a measured scrollbar); the
					    owner asked for it flush left instead, and the whole mechanism went. */}
					<div className="flex items-center">
						{logo}
					</div>

					{/* Center: Nav links */}
					<div className="nav-tabs flex items-center justify-center gap-0.5 rounded-xl border border-gray-700 bg-gray-800/60 p-1">
						{places.map((place) => {
							const isOpen = place.isOpen(location.pathname)
							return (
								<Link key={place.id} to={place.to} aria-current={isOpen ? "page" : undefined} className={desktopNavClass(isOpen)} {...prefetchOnIntent}>
									<place.icon className="h-4 w-4" />
									{place.label}
								</Link>
							)
						})}
					</div>

					{/* Right: Save indicator + search + team + the menu (and Sign in for a guest) */}
					<div className="flex items-center justify-end gap-2">
						{calculatorData ? (
							isLoggedIn ? (
								<>
									{/* Fixed-width slot keeps the right grid column stable so the center nav links don't shift */}
									<div className="w-9 h-9 flex items-center justify-center">
										{timerIsGoing && (
											<button
												onClick={calculatorData.saveNow}
												aria-label="Save now"
												title="Click to save now"
												className={NAV_SAVE_BUTTON}
											>
												<OguriSpinner size="sm" />
											</button>
										)}
									</div>
									{navControls}
									<SiteMenu />
								</>
							) : (
								<>
									{navControls}
									{signInToSyncButton}
									<SiteMenu />
								</>
							)
						) : (
							<>
								{navControls}
								{authButton}
							</>
						)}
					</div>
				</div>
			</nav>
			</div>
		</div>
	)
}
