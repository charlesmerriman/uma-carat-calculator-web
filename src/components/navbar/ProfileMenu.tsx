import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { LogOut, UserRound } from "lucide-react"
import { useAccount } from "../../services/AuthContext"
import { useCalculatorDataSafe } from "../../services/CalculatorContext"
import { Avatar } from "../account/Avatar"
import { NAV_POPOVER } from "./navStyles"

/**
 * The signed-in corner of the navbar: the person's avatar, opening a small menu
 * with a link to their account page and sign-out.
 *
 * Replaced the bare "Logout" button on 2026-09-12. Sign-out moved one step
 * further away on purpose — it is the rarest action in the bar, and the slot
 * it held is better spent telling the person WHO is signed in. That matters
 * more now that an account can hold several providers: the picture follows the
 * provider they last signed in with, which is a visible answer to "which
 * account am I in?".
 *
 * The avatar renders from the first paint. `isLoggedIn` is synchronous, so the
 * button is there immediately; the picture and handle arrive with /account and
 * the Avatar shows a neutral silhouette until then (see Avatar.tsx).
 *
 * Closes on outside click, Escape and choosing an item — the same popover
 * idiom as ThemePicker and SettingsMenu, anchored under the button; unlike SettingsMenu
 * it is always the LAST control in the bar, so a right-anchored panel never
 * runs off a narrow screen.
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

	const name = account?.username ?? ""
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
				className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
					open ? "border-brand/70" : "border-gray-600 hover:border-gray-400"
				}`}
			>
				<Avatar src={account?.avatar_url} name={name} size="sm" />
			</button>

			{open && (
				<div role="menu" aria-label="Account" className={`${NAV_POPOVER} absolute right-0 top-full z-50 mt-1.5 w-60 p-1.5`}>
					<div className="flex items-center gap-3 px-2 py-2">
						<Avatar src={account?.avatar_url} name={name} size="sm" />
						<div className="min-w-0">
							<div className="truncate text-sm font-semibold text-gray-100">{name || "Signed in"}</div>
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
