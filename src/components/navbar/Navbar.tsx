import { Link, useLocation, useNavigate } from "react-router-dom"
import { CalendarDays, Calculator as CalculatorIcon, LogIn, LogOut, Save, Sparkles, UserRound } from "lucide-react"
import { useCalculatorDataSafe } from "../../services/CalculatorContext"
import { prefetchCalculatorData } from "../../services/calculatorFetchCalls"
import { useAccount } from "../../services/AuthContext"
import {
	toBannerPayload,
	toPurchasePayload,
	toStepUpSelectionPayload
} from "../../services/calculatorFetchCalls"
import { stashGuestPlan } from "../../services/guestMigration"
import { Wordmark } from "../Wordmark"
import { ThemePicker } from "./ThemePicker"
import { SettingsMenu } from "./SettingsMenu"

export const Navbar = () => {
	const navigate = useNavigate()
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
	// another tab — re-renders this button, instead of leaving it offering
	// "Logout" to someone the server no longer recognises.
	const { isLoggedIn, signOut } = useAccount()

	const handleLogout = async (): Promise<void> => {
		// signOut() owns the API call and clearing the token; what stays here is
		// the navigation, which is a navbar decision rather than an auth one.
		await signOut()
		// Full reload rather than navigate(): we're usually already on
		// /app, so a client-side navigation wouldn't remount the provider
		// and the logged-out user would keep seeing their account data.
		window.location.href = "/app"
	}

	// Guest's path to saving: snapshot the in-memory plan into sessionStorage
	// (the provider unmounts on route change, taking its state with it), then
	// send them to login. The provider migrates the snapshot after login.
	const handleSignInToSave = (): void => {
		if (calculatorData) {
			stashGuestPlan(
				calculatorData.userStatsData,
				toBannerPayload(calculatorData.userPlannedBannerData),
				toPurchasePayload(calculatorData.userPlannedPurchaseData),
				toStepUpSelectionPayload(calculatorData.userStepUpSelectionData)
			)
		}
		navigate("/login")
	}

	// Settings gear + theme picker, grouped so every nav cluster renders the same
	// controls. SettingsMenu renders nothing outside app mode (no stats loaded).
	const navControls = (
		<>
			<SettingsMenu />
			<ThemePicker />
		</>
	)

	const isCalculator = location.pathname === "/app"
	const isTimeline = location.pathname === "/app/timeline"
	const isSelectors = location.pathname === "/app/selectors"

	const timerIsGoing = calculatorData?.timerIsGoing ?? false
	// True only inside /app, while the initial fetch is still out.
	const planIsLoading = calculatorData?.isLoading ?? false

	const mobileNavClass = (active: boolean) =>
		`flex min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-semibold transition ${
			active
				? "border-brand/70 bg-brand/10 text-brand shadow-sm"
				: "border-transparent text-gray-400 hover:border-gray-600 hover:bg-gray-700/70 hover:text-gray-100"
		}`
	const desktopNavClass = (active: boolean) =>
		`flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-sm font-medium transition ${
			active
				? "border-brand/70 bg-brand/10 text-brand shadow-sm"
				: "border-transparent text-gray-400 hover:border-gray-600 hover:bg-gray-700/70 hover:text-gray-100"
		}`

	// Shared logo element used in both mobile and desktop navs
	const logo = <Wordmark size="nav" />

	// Guest affordance shown in app mode instead of the save icon + Logout.
	// Passive by design — it never interrupts planning.
	//
	// Disabled until the plan has loaded. The navbar now paints before the
	// initial fetch lands, and during that window every collection is still
	// empty — so stashing would write an empty plan. stashGuestPlan treats
	// "nothing to stash" as CLEAR, which would silently discard a stash the
	// guest had already put aside before navigating back here.
	const signInToSaveButton = (
		<button
			onClick={handleSignInToSave}
			disabled={planIsLoading}
			aria-label="Sign in to save"
			title="Sign in to save your plan to an account"
			className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-600 rounded text-sm text-gray-300 hover:border-gray-400 hover:bg-gray-700 hover:text-gray-100 transition disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-600 disabled:hover:bg-transparent disabled:hover:text-gray-300"
		>
			<LogIn className="w-4 h-4" />
			Sign in to save
		</button>
	)

	// Auth button shown on the right side when outside the app (home mode)
	const authButton = isLoggedIn ? (
		<button
			onClick={handleLogout}
			aria-label="Logout"
			title="Logout"
			className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-600 rounded text-sm text-gray-300 hover:border-gray-400 hover:bg-gray-700 hover:text-gray-100 transition"
		>
			<UserRound className="w-4 h-4" />
			Logout
			<LogOut className="w-4 h-4" />
		</button>
	) : (
		<Link
			to="/login"
			className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-600 rounded text-sm text-gray-300 hover:border-gray-400 hover:bg-gray-700 hover:text-gray-100 transition"
		>
			<LogIn className="w-4 h-4" />
			Login
		</Link>
	)

	return (
		<div className="z-50 shrink-0">
			{/* Mobile nav */}
			<nav className="border-b border-gray-600 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 shadow-sm desktop-nav:hidden">
				<div className="flex h-14 items-center justify-between gap-3 px-3">
					<div className="flex min-w-0 items-center">
						{logo}
					</div>

					<div className="flex shrink-0 items-center gap-1.5">
						{calculatorData ? (
							isLoggedIn ? (
								<>
									<div className="flex h-9 w-9 items-center justify-center">
										{timerIsGoing && (
											<button
												onClick={calculatorData.saveNow}
												aria-label="Save now"
												title="Click to save now"
												className="flex h-9 w-9 items-center justify-center rounded border border-gray-600 text-brand transition hover:border-brand/70 hover:bg-gray-700"
											>
												<Save className="h-4 w-4" />
											</button>
										)}
									</div>
									{navControls}
									<button
										onClick={handleLogout}
										aria-label="Logout"
										title="Logout"
										className="flex h-9 w-9 items-center justify-center rounded border border-gray-600 text-gray-300 transition hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100"
									>
										<LogOut className="h-4 w-4" />
									</button>
								</>
							) : (
								<>
									{navControls}
									{signInToSaveButton}
								</>
							)
						) : (
							authButton
						)}
					</div>
				</div>

				<div className="grid grid-cols-3 gap-1 border-t border-gray-700/80 bg-gray-900/30 px-2 py-2">
					<Link to="/app" className={mobileNavClass(isCalculator)} {...prefetchOnIntent}>
						<CalculatorIcon className="h-4 w-4 shrink-0" />
						<span className="truncate">Calculator</span>
					</Link>
					<Link to="/app/timeline" className={mobileNavClass(isTimeline)} {...prefetchOnIntent}>
						<CalendarDays className="h-4 w-4 shrink-0" />
						<span className="truncate">Timeline</span>
					</Link>
					<Link to="/app/selectors" className={mobileNavClass(isSelectors)} {...prefetchOnIntent}>
						<Sparkles className="h-4 w-4 shrink-0" />
						<span className="truncate">Selectors</span>
					</Link>
				</div>
			</nav>

			{/* Desktop nav — always three-column; center links always visible.
			    Switches on desktop-nav rather than md: this layout is already over-full
			    below ~900px (the "Sign in to save" button wraps to 2-3 lines), which
			    is precisely the landscape-phone / portrait-tablet band. */}
			{/* @container + no horizontal padding on the <nav>: the brand inset is a
			    cqw calc measured against THIS element's content box (see
			    .app-canvas-shell in App.css), and padding here would come out of that
			    measurement. The right-hand cell carries the gutter that used to be
			    px-5 instead. */}
			<nav className="@container hidden h-16 grid-cols-[1fr_auto_1fr] items-center border-b border-gray-600 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 shadow-sm desktop-nav:grid">
				{/* Left: Branding. Its indent is the page's to set (.nav-brand-inset):
				    inside the app shell it follows the calculator canvas, so the
				    wordmark's "U" lines up with the "I" of INCOME & RESOURCES below it,
				    and elsewhere it is the plain edge gutter. Either way the padding
				    grows at half the rate of the 1fr track it sits in, so the centre
				    links stay centred. */}
				<div className="nav-brand-inset flex items-center">
					{logo}
				</div>

				{/* Center: Nav links */}
				<div className="flex items-center justify-center rounded-xl border border-gray-600/80 bg-gray-900/50 p-1 shadow-inner">
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
				</div>

				{/* Right: Save indicator + Theme Picker + Logout/Login */}
				<div className="flex items-center justify-end gap-3 pr-5">
					{calculatorData ? (
						isLoggedIn ? (
							<>
								{/* Fixed-width slot keeps the right grid column stable so the center nav links don't shift */}
								<div className="w-9 h-9 flex items-center justify-center">
									{timerIsGoing && (
										<button
											onClick={calculatorData.saveNow}
											className="cursor-pointer hover:opacity-70 transition-opacity"
											title="Click to save now"
										>
											<Save className="h-5 w-5 text-brand" />
										</button>
									)}
								</div>
								{navControls}
								<button
									onClick={handleLogout}
									className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-600 rounded text-sm text-gray-300 hover:border-gray-400 hover:bg-gray-700 hover:text-gray-100 transition"
								>
									<UserRound className="w-4 h-4" />
									Logout
									<LogOut className="w-4 h-4" />
								</button>
							</>
						) : (
							<>
								{navControls}
								{signInToSaveButton}
							</>
						)
					) : (
						<>
							{navControls}
							{authButton}
						</>
					)}
				</div>
			</nav>
		</div>
	)
}
