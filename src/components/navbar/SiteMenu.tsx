import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
	ChevronDown, CircleHelp, Info, Library, LogIn, LogOut, Menu, MessageSquare, Palette, ScrollText, UserRound,
	type LucideIcon,
} from "lucide-react"
import { useAccount } from "../../services/AuthContext"
import { useCalculatorDataSafe } from "../../services/CalculatorContext"
import { useTheme } from "../../services/ThemeContext"
import { Avatar } from "../account/Avatar"
import { ThemeOptions } from "./ThemeOptions"
import { NAV_BUTTON, NAV_POPOVER, NAV_PROFILE_TRIGGER } from "./navStyles"

/**
 * The last control in the navbar: one menu for everything that is not a place.
 * The account, the theme and the info pages (owner, 2026-11-24: "moving all the
 * excess stuff like themes into the profile menu is a good idea, but keep in
 * mind how people who aren't logged in will get to it";
 * notes/navigation-plan.md, PR 2).
 *
 * It was ProfileMenu (2026-09-12), signed-in only, with the theme behind its
 * own palette button beside it and the info pages in the footer alone. Two
 * things changed with the merge:
 *
 * - A GUEST GETS THE MENU TOO, behind a plain menu button, because the theme
 *   and the info pages are theirs as much as anyone's. Its first row is signing
 *   in, with the sentence the "Sign in to sync" button keeps in its tooltip,
 *   where a phone can read it. The Sign in button itself stays in the bar.
 * - THE THEME IS A ROW that opens the picker in place (ThemeOptions). The menu
 *   stays open after a pick, so a theme can be tried and changed again.
 *
 * SIGNED IN, the trigger is unchanged: the avatar as the left cap of a pill
 * that carries the name and a chevron. Sign-out sits at the bottom on purpose:
 * it is the rarest action here, and the trigger is better spent saying WHO is
 * signed in. That matters now that an account can hold several providers and a
 * chosen name: the picture is their first favorite uma (the quiet default
 * until they pick one), and the name is the one they chose (or their handle),
 * which together answer "which account am I in?".
 *
 * THE PILL IS DESKTOP-ONLY (`desktop-nav:`). On a phone a name does not fit
 * beside the other buttons; the avatar ring stands alone and the name is one
 * tap away in the menu.
 *
 * THE NAME WAITS FOR `xl` (1280px). With four tabs in the centre, a full-width
 * name made the signed-in bar wider than the window from 1024 to ~1110px, and
 * the grid took the difference out of the logo. Below xl the pill is avatar +
 * chevron, the title attribute still names the account, and the menu shows it
 * in full.
 *
 * The avatar renders from the first paint. `isLoggedIn` is synchronous, so the
 * button is there immediately; the picture and name arrive with /account and
 * the Avatar shows its default silhouette until then (see Avatar.tsx). The name
 * span is omitted rather than left empty while loading, so the pill widens
 * once instead of jumping from a placeholder.
 *
 * Closes on outside click, Escape (focus goes back to the trigger) and
 * choosing a link. Always the LAST control in the bar, so a right-anchored
 * panel never runs off a narrow screen; it scrolls inside itself when the
 * theme list makes it taller than a short window.
 */

const MENU_ITEM =
	"flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-gray-300 transition hover:bg-gray-700 hover:text-gray-100 focus-visible:bg-gray-700 focus-visible:outline-none"

/** The pages the footer has always linked, one tap away on a phone now. */
const INFO_LINKS: Array<{ to: string; label: string; icon: LucideIcon }> = [
	{ to: "/about", label: "About", icon: Info },
	{ to: "/faq", label: "FAQ", icon: CircleHelp },
	{ to: "/changelog", label: "Changelog", icon: ScrollText },
	{ to: "/feedback", label: "Feedback", icon: MessageSquare },
]

export const SiteMenu = () => {
	const { isLoggedIn, account, signOut } = useAccount()
	const calculatorData = useCalculatorDataSafe()
	const { activeTheme, themes } = useTheme()
	const [open, setOpen] = useState(false)
	const [themeOpen, setThemeOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)
	const triggerRef = useRef<HTMLButtonElement>(null)

	useEffect(() => {
		if (!open) return
		const handlePointerDown = (e: PointerEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setOpen(false)
			}
		}
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setOpen(false)
				triggerRef.current?.focus()
			}
		}
		document.addEventListener("pointerdown", handlePointerDown)
		document.addEventListener("keydown", handleKeyDown)
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown)
			document.removeEventListener("keydown", handleKeyDown)
		}
	}, [open])

	const toggle = () => {
		setOpen((prev) => !prev)
		// The picker folds away with the menu, so it opens short next time.
		setThemeOpen(false)
	}
	const close = () => setOpen(false)

	const handleSignOut = async (): Promise<void> => {
		// signOut() owns the API call and clearing the token; the navigation is
		// the navbar's decision. A full load rather than navigate(): inside /app
		// a client-side navigation would not remount CalculatorProvider, and the
		// signed-out user would keep seeing the account's plan. Outside /app the
		// home page is the natural place to land.
		await signOut()
		window.location.assign(calculatorData ? "/app" : "/")
	}

	const handle = account?.username ?? ""
	// The name they chose, else the handle. "" until /account lands.
	const name = account?.display_name || handle
	const supporter = account?.supporter
	const themeLabel = themes.find((theme) => theme.id === activeTheme)?.label ?? ""
	// "In this browser" is the whole claim, on purpose: browser storage can be
	// cleared from under us, so the copy never says just "saved". Outside /app
	// there is no plan in hand to describe.
	const signInBlurb = !calculatorData
		? "Keep your plan safe and use it on your other devices."
		: calculatorData.isGuestPlanStored
			? "Your plan is saved in this browser. Sign in to keep it safe and use it on your other devices."
			: "This browser isn't saving your plan. Sign in to keep it."

	return (
		<div ref={containerRef} className="relative">
			{isLoggedIn ? (
				<button
					ref={triggerRef}
					type="button"
					onClick={toggle}
					aria-label="Account menu"
					aria-haspopup="menu"
					aria-expanded={open}
					title={name ? `Signed in as ${name}` : "Account menu"}
					className={`${NAV_PROFILE_TRIGGER} ${
						open ? "border-brand/70" : "border-gray-600 hover:border-gray-400 hover:bg-gray-800"
					}`}
				>
					<Avatar src={account?.avatar_url} size="md" framed={false} />
					<span className="hidden items-center gap-1 desktop-nav:flex">
						{name && <span className="hidden max-w-36 truncate text-sm font-medium text-gray-200 xl:block">{name}</span>}
						<ChevronDown
							className={`h-4 w-4 shrink-0 text-gray-400 transition ${open ? "rotate-180" : ""}`}
							aria-hidden="true"
						/>
					</span>
				</button>
			) : (
				// A guest has no picture to press, so the menu gets a button of its
				// own. The word joins the icon where the bar has room for it.
				<button
					ref={triggerRef}
					type="button"
					onClick={toggle}
					aria-label="Menu"
					aria-haspopup="menu"
					aria-expanded={open}
					title="Menu"
					className={`${NAV_BUTTON} px-2.5 ${open ? "border-brand/70 text-brand" : ""}`}
				>
					<Menu className="h-4 w-4" aria-hidden="true" />
					<span className="hidden desktop-nav:inline">Menu</span>
				</button>
			)}

			{open && (
				<div
					role="menu"
					aria-label={isLoggedIn ? "Account" : "Menu"}
					className={`${NAV_POPOVER} absolute right-0 top-full z-50 mt-1.5 flex max-h-[calc(100dvh-5rem)] w-72 max-w-[calc(100vw-1.5rem)] flex-col overflow-y-auto p-1.5`}
				>
					{isLoggedIn ? (
						<>
							<div className="flex items-center gap-3 px-2 py-2">
								<Avatar src={account?.avatar_url} size="sm" framed={false} />
								<div className="min-w-0">
									<div className="truncate text-sm font-semibold text-gray-100">{name || "Signed in"}</div>
									{/* The handle stays visible when a chosen name is shown above it:
									    it is what an admin would ask for. */}
									{account?.display_name && (
										<div className="truncate font-mono text-xs text-gray-400">{handle}</div>
									)}
									<div className="text-xs text-gray-400">
										{supporter?.is_supporter && supporter.tier
											? `Supporter · ${supporter.tier}`
											: name
												? "Signed in"
												: "Loading…"}
									</div>
								</div>
							</div>
							<div className="my-1 border-t border-gray-700" />
							<Link role="menuitem" to="/account" onClick={close} className={MENU_ITEM}>
								<UserRound className="h-4 w-4" />
								Account
							</Link>
							{/* The player's game collection (veterans): off the navbar on purpose. */}
							<Link role="menuitem" to="/app/collection" onClick={close} className={MENU_ITEM}>
								<Library className="h-4 w-4" />
								Collection
							</Link>
						</>
					) : (
						<Link
							role="menuitem"
							to="/login"
							onClick={close}
							className="flex items-start gap-2.5 rounded-md border border-brand/40 bg-brand/10 px-2.5 py-2 text-left transition hover:bg-brand/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
						>
							<LogIn className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
							<span className="min-w-0">
								<span className="block text-sm font-semibold text-brand">Sign in to sync</span>
								<span className="block text-xs leading-snug text-gray-300">{signInBlurb}</span>
							</span>
						</Link>
					)}

					<div className="my-1 border-t border-gray-700" />
					{/* The theme: a row that names the current one and opens the
					    picker under itself. Not closed by a pick, so a theme can be
					    tried and changed again without reopening the menu. */}
					<button
						type="button"
						role="menuitem"
						aria-expanded={themeOpen}
						onClick={() => setThemeOpen((prev) => !prev)}
						className={MENU_ITEM}
					>
						<Palette className="h-4 w-4" aria-hidden="true" />
						<span className="flex-1">Theme</span>
						<span className="text-xs text-gray-400">{themeLabel}</span>
						<ChevronDown
							className={`h-4 w-4 shrink-0 text-gray-400 transition ${themeOpen ? "rotate-180" : ""}`}
							aria-hidden="true"
						/>
					</button>
					{themeOpen && (
						<div className="mx-1 mb-1 flex flex-col gap-1 rounded-lg border border-gray-700 bg-gray-900 p-1.5">
							<ThemeOptions />
						</div>
					)}

					<div className="my-1 border-t border-gray-700" />
					{INFO_LINKS.map(({ to, label, icon: Icon }) => (
						<Link key={to} role="menuitem" to={to} onClick={close} className={MENU_ITEM}>
							<Icon className="h-4 w-4" aria-hidden="true" />
							{label}
						</Link>
					))}

					{isLoggedIn && (
						<>
							<div className="my-1 border-t border-gray-700" />
							<button role="menuitem" type="button" onClick={() => void handleSignOut()} className={MENU_ITEM}>
								<LogOut className="h-4 w-4" />
								Sign out
							</button>
						</>
					)}
				</div>
			)}
		</div>
	)
}
