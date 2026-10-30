import { Link, useLocation } from "react-router-dom"
import { CalendarDays, Calculator as CalculatorIcon, ListOrdered, LogIn, Sparkles, Swords, Trophy } from "lucide-react"
import { useCalculatorDataSafe } from "../../services/CalculatorContext"
import { prefetchCalculatorData } from "../../services/calculatorFetchCalls"
import { useAccount } from "../../services/AuthContext"
import { Wordmark } from "../Wordmark"
import { OguriSpinner } from "../OguriSpinner"
import { ThemePicker } from "./ThemePicker"
import { SettingsMenu } from "./SettingsMenu"
import { TeamDrawerButton } from "./TeamDrawerButton"
import { ProfileMenu } from "./ProfileMenu"
import { NAV_BUTTON, NAV_SAVE_BUTTON } from "./navStyles"
import { SiteSearchButton, SiteSearchDialog } from "../search/SiteSearch"
import { useSiteSearch } from "../../hooks/useSiteSearch"

export const Navbar = () => {
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
	// itself lives in ProfileMenu now.
	const { isLoggedIn, account } = useAccount()
	const siteSearch = useSiteSearch()
	// Rankings is Patreon only for now (owner, 2026-10-27): its item is drawn
	// for early access alone. The account is unknown during the prerender and
	// while it loads, so the item appears after load and never flashes.
	const showRankings = Boolean(account?.early_access)

	// Search + team drawer + settings gear + theme picker, grouped so the desktop
	// nav's branches render the same controls. TeamDrawerButton and SettingsMenu
	// render nothing outside app mode.
	const searchButton = <SiteSearchButton onOpen={() => siteSearch.setOpen(true)} />
	const navControls = (
		<>
			{searchButton}
			<TeamDrawerButton />
			<SettingsMenu />
			<ThemePicker />
		</>
	)
	// A phone has less row than five buttons and the wordmark want, so the gear
	// holds the theme too. The palette stands in only until the stats load,
	// while the gear has nothing else to show.
	const phoneControls = (
		<>
			{searchButton}
			<TeamDrawerButton />
			{calculatorData?.userStatsData ? <SettingsMenu withTheme /> : <ThemePicker />}
		</>
	)

	const isCalculator = location.pathname === "/app"
	const isTimeline = location.pathname === "/app/timeline"
	const isSelectors = location.pathname === "/app/selectors"
	const isLegendRaces = location.pathname === "/app/legend-races"
	const isPvp = location.pathname === "/app/pvp"
	const isRankings = location.pathname === "/app/rankings"

	const timerIsGoing = calculatorData?.timerIsGoing ?? false
	// False once this browser has refused to store the guest's plan.
	const guestPlanStored = calculatorData?.isGuestPlanStored ?? true

	// The active pill is a brand tint with a brand edge and nothing else. It
	// used to carry `shadow-sm`, which every theme block in index.css re-skinned
	// into a 14px drop shadow (until 2026-10-18) — on a 36px tab that read as a
	// floating chip.
	//
	// Icon ABOVE label since the fourth tab (Legend Races) arrived. Side by
	// side, measured at 375px, every label truncated: the icon and gap left
	// 47px for words needing 57-69px. Stacked, at 11px, the longest
	// ("Calculator", ~63px) fits down to a 320px screen.
	//
	// The fifth tab (PvP) took each cell from about 69px to about 57px at 375px,
	// so the labels went to 10px ("Calculator" is ~57px there and fits). Below
	// 360px even that truncates, so the words hide there and the icons carry
	// the bar; the label stays in the accessibility tree (sr-only).
	//
	// A sixth tab (Rankings, early access only) takes each cell to about 54px
	// at 375px, where "Calculator" no longer fits, so with six the words hide
	// below 390px instead. Both strings are literal so Tailwind sees them.
	const mobileLabel = showRankings ? "truncate max-[389px]:sr-only" : "truncate max-[359px]:sr-only"
	const mobileNavClass = (active: boolean) =>
		`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-0.5 py-1.5 text-[10px] font-semibold transition ${
			active
				? "border-brand/50 bg-brand/10 text-brand"
				: "border-transparent text-gray-400 hover:bg-gray-700/70 hover:text-gray-100"
		}`
	const desktopNavClass = (active: boolean) =>
		`flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-sm font-medium transition ${
			active
				? "border-brand/50 bg-brand/10 text-brand"
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

	// Auth slot shown on the right side when outside the app (home mode): the
	// avatar menu for a signed-in person, a Login link for a guest.
	const authButton = isLoggedIn ? (
		<ProfileMenu />
	) : (
		<Link
			to="/login"
			className={NAV_BUTTON}
		>
			<LogIn className="w-4 h-4" />
			Login
		</Link>
	)

	// `sticky top-0` pins the bar wherever the DOCUMENT scrolls: every page on a
	// phone, and the home and info pages at any width. On the desktop /app shell
	// it is inert: the bar sits outside that shell's internal scroller, so it is
	// already pinned there. It was dropped in May when /app moved to that
	// scroller, which left the document-scrolled pages with a bar that scrolled
	// away. html's `scroll-padding-top` (index.css) carries this bar's height so
	// jump links and deep links land below it rather than under it.
	// `data-sticky-navbar` is how the PvP page measures it, to pin its own
	// tabs under it (hooks/usePvpStickyOffsets.ts).
	return (
		<div className="sticky top-0 z-50 shrink-0" data-sticky-navbar="">
			<SiteSearchDialog open={siteSearch.open} onClose={() => siteSearch.setOpen(false)} />
			{/* Mobile nav */}
			<nav className="border-b border-gray-700 bg-gray-900 desktop-nav:hidden">
				<div className="flex h-14 items-center justify-between gap-3 px-3">
					<div className="flex min-w-0 items-center">
						{logo}
					</div>

					<div className="relative flex shrink-0 items-center gap-1.5">
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
									{phoneControls}
									<ProfileMenu />
								</>
							) : (
								<>
									{phoneControls}
									{signInToSyncButton}
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

				{/* The rule spans the bar; the five tabs are capped at 32rem and
				    centred. Uncapped, a landscape phone (844px) spread them across
				    the whole width with wide gaps between small labels; a portrait
				    phone never reaches the cap. Height unchanged, so the
				    scroll-padding figures in index.css still hold. */}
				<div className="border-t border-gray-700 px-2 py-2">
				<div className={`mx-auto grid max-w-[32rem] gap-1 ${showRankings ? "grid-cols-6" : "grid-cols-5"}`}>
					<Link to="/app" className={mobileNavClass(isCalculator)} {...prefetchOnIntent}>
						<CalculatorIcon className="h-4 w-4 shrink-0" />
						<span className={mobileLabel}>Calculator</span>
					</Link>
					<Link to="/app/timeline" className={mobileNavClass(isTimeline)} {...prefetchOnIntent}>
						<CalendarDays className="h-4 w-4 shrink-0" />
						<span className={mobileLabel}>Timeline</span>
					</Link>
					<Link to="/app/selectors" className={mobileNavClass(isSelectors)} {...prefetchOnIntent}>
						<Sparkles className="h-4 w-4 shrink-0" />
						<span className={mobileLabel}>Selectors</span>
					</Link>
					{/* "Legends" rather than the desktop "Legend Races": four tabs share
					    the bar, and the longer label would not fit a 320px screen. */}
					<Link to="/app/legend-races" className={mobileNavClass(isLegendRaces)} {...prefetchOnIntent}>
						<Trophy className="h-4 w-4 shrink-0" />
						<span className={mobileLabel}>Legends</span>
					</Link>
					<Link to="/app/pvp" className={mobileNavClass(isPvp)} {...prefetchOnIntent}>
						<Swords className="h-4 w-4 shrink-0" />
						<span className={mobileLabel}>PvP</span>
					</Link>
					{showRankings && (
						<Link to="/app/rankings" className={mobileNavClass(isRankings)} {...prefetchOnIntent}>
							<ListOrdered className="h-4 w-4 shrink-0" />
							<span className={mobileLabel}>Rankings</span>
						</Link>
					)}
				</div>
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
			<nav className="hidden border-b border-gray-700 bg-gray-900 px-5 desktop-nav:block">
				<div className="mx-auto grid h-16 max-w-[96rem] grid-cols-[1fr_auto_1fr] items-center">
					{/* Left: Branding, on the bar's left gutter on every page. Until
					    2026-09-13 it was indented per page to line the wordmark up with the
					    canvas below (a calc in App.css plus a measured scrollbar); the
					    owner asked for it flush left instead, and the whole mechanism went. */}
					<div className="flex items-center">
						{logo}
					</div>

					{/* Center: Nav links */}
					<div className="flex items-center justify-center gap-0.5 rounded-xl border border-gray-700 bg-gray-800/60 p-1">
						<Link to="/app" className={desktopNavClass(isCalculator)} {...prefetchOnIntent}>
							<CalculatorIcon className="w-4 h-4" />
							Calculator
						</Link>
						<Link to="/app/timeline" className={desktopNavClass(isTimeline)} {...prefetchOnIntent}>
							<CalendarDays className="w-4 h-4" />
							Timeline
						</Link>
						<Link to="/app/selectors" className={desktopNavClass(isSelectors)} {...prefetchOnIntent}>
							<Sparkles className="h-4 w-4" />
							Selectors
						</Link>
						<Link to="/app/legend-races" className={desktopNavClass(isLegendRaces)} {...prefetchOnIntent}>
							<Trophy className="h-4 w-4" />
							Legend Races
						</Link>
						<Link to="/app/pvp" className={desktopNavClass(isPvp)} {...prefetchOnIntent}>
							<Swords className="h-4 w-4" />
							PvP
						</Link>
						{/* Icon only below xl: a sixth label overflows the bar at 1024px. */}
						{showRankings && (
							<Link to="/app/rankings" className={desktopNavClass(isRankings)} title="Rankings" {...prefetchOnIntent}>
								<ListOrdered className="h-4 w-4" />
								<span className="sr-only xl:not-sr-only">Rankings</span>
							</Link>
						)}
					</div>

					{/* Right: Save indicator + settings + theme picker + avatar menu / Login */}
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
									<ProfileMenu />
								</>
							) : (
								<>
									{navControls}
									{signInToSyncButton}
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
	)
}
