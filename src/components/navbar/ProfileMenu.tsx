import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronDown, LogOut, UserRound } from "lucide-react"
import { useAccount } from "../../services/AuthContext"
import { useCalculatorDataSafe } from "../../services/CalculatorContext"
import { Avatar } from "../account/Avatar"
import { NAV_POPOVER, NAV_PROFILE_TRIGGER } from "./navStyles"

/**
 * The signed-in corner of the navbar: the person's avatar as the left cap of
 * a pill that carries their name and a chevron, opening a small menu with a
 * link to their account page and sign-out.
 *
 * Replaced the bare "Logout" button on 2026-09-12, and grew the pill on
 * 2026-09-13. Sign-out moved one step further away on purpose — it is the
 * rarest action in the bar, and the slot it held is better spent telling the
 * person WHO is signed in. That matters more now that an account can hold
 * several providers and a chosen name: the picture is a supporter's first
 * oshi (free accounts get the quiet default), and the name is the one they
 * chose (or their handle), which together answer "which account am I in?".
 *
 * THE PILL IS DESKTOP-ONLY (`desktop-nav:`). At 390px the app-mode cluster is
 * already save + settings + theme + this, and a name does not fit; a phone
 * keeps the avatar ring alone, and the name is one tap away in the menu.
 *
 * The avatar renders from the first paint. `isLoggedIn` is synchronous, so the
 * button is there immediately; the picture and name arrive with /account and
 * the Avatar shows its default silhouette until then (see Avatar.tsx). The name
 * span is omitted rather than left empty while loading, so the pill widens
 * once instead of jumping from a placeholder.
 *
 * Closes on outside click, Escape and choosing an item — the same popover
 * idiom as ThemePicker and SettingsMenu, anchored under the button; unlike
 * SettingsMenu it is always the LAST control in the bar, so a right-anchored
 * panel never runs off a narrow screen.
 */

const MENU_ITEM =
	"flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-gray-300 transition hover:bg-gray-700 hover:text-gray-100 focus-visible:bg-gray-700 focus-visible:outline-none"

export const ProfileMenu = () => {
	const { account, signOut } = useAccount()
	const calculatorData = useCalculatorDataSafe()
	const [open, setOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) return
		const handlePointerDown = (e: PointerEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setOpen(false)
			}
		}
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false)
		}
		document.addEventListener("pointerdown", handlePointerDown)
		document.addEventListener("keydown", handleKeyDown)
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown)
			document.removeEventListener("keydown", handleKeyDown)
		}
	}, [open])

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

	return (
		<div ref={containerRef} className="relative">
			<button
				type="button"
				onClick={() => setOpen((prev) => !prev)}
				aria-label="Account menu"
				aria-haspopup="menu"
				aria-expanded={open}
				title={name ? `Signed in as ${name}` : "Account menu"}
				className={`${NAV_PROFILE_TRIGGER} ${
					open ? "border-brand/70" : "border-gray-600 hover:border-gray-400 hover:bg-gray-800"
				}`}
			>
				<Avatar src={account?.avatar_url} size="md" />
				<span className="hidden items-center gap-1 desktop-nav:flex">
					{name && <span className="max-w-36 truncate text-sm font-medium text-gray-200">{name}</span>}
					<ChevronDown
						className={`h-4 w-4 shrink-0 text-gray-400 transition ${open ? "rotate-180" : ""}`}
						aria-hidden="true"
					/>
				</span>
			</button>

			{open && (
				<div role="menu" aria-label="Account" className={`${NAV_POPOVER} absolute right-0 top-full z-50 mt-1.5 w-60 p-1.5`}>
					<div className="flex items-center gap-3 px-2 py-2">
						<Avatar src={account?.avatar_url} size="sm" />
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
					<Link role="menuitem" to="/account" onClick={() => setOpen(false)} className={MENU_ITEM}>
						<UserRound className="h-4 w-4" />
						Account
					</Link>
					<button role="menuitem" type="button" onClick={() => void handleSignOut()} className={MENU_ITEM}>
						<LogOut className="h-4 w-4" />
						Sign out
					</button>
				</div>
			)}
		</div>
	)
}
