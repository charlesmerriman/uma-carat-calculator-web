import { useEffect, useRef, useState } from "react"
import { Settings } from "lucide-react"
import { useCalculatorDataSafe } from "../../services/CalculatorContext"
import { useAccount } from "../../services/AuthContext"
import { ToggleSwitch } from "../ToggleSwitch"
import { DEFAULT_CONSTANTS } from "../../constants/gameConstants"
import { NAV_ICON_BUTTON, NAV_POPOVER } from "./navStyles"
import type { CalculationConstants, UserStats } from "../../types"

/** The boolean-valued keys of UserStats — the only fields these toggles set. */
// `-?` strips the optional marker while mapping. Without it, UserStats'
// optional fields (the shop ticket counts) leak `undefined` into this union
// and it stops being usable as an index.
type BooleanStatKey = {
	[K in keyof UserStats]-?: UserStats[K] extends boolean ? K : never
}[keyof UserStats]

/**
 * Each toggle maps to a boolean field on UserStats and controls a slice of the
 * resource projection (see useBannerResources). Kept as data so the panel is a
 * simple map over this list.
 *
 * A description may be a function of the admin-editable CalculationConstants
 * rather than a fixed string: any blurb quoting a number the content editor can
 * change has to read it from the API, or it silently goes stale the first time
 * that constant moves (Misc Earnings did exactly that, 1,800 -> 2,700/month).
 */
const SETTINGS: {
	key: BooleanStatKey
	label: string
	description: string | ((constants: CalculationConstants) => string)
}[] = [
	{
		key: "spend_tickets_on_banners",
		label: "Spend Tickets on Banners",
		description: "Use tickets on planned pulls. Turn off to keep them as spares.",
	},
	{
		key: "misc_earnings",
		label: "Misc Earnings",
		// floor(monthly / 30) is how cumulativeMiscEarningsCarats derives the
		// daily drip — same expression here so the blurb can't quote a rate the
		// projection doesn't actually pay.
		description: (k) =>
			`Roughly ${Math.floor(k.misc_earnings_monthly / 30)} carats a day from gifts, team trials, and careers, starting ${k.misc_earnings_delay_days} days out.`,
	},
	{
		key: "discounted_paid_pulls",
		label: "Discounted Paid Pulls",
		description: "Take the discounted 50-carat pull once a day.",
	},
	{
		key: "full_price_paid_pulls",
		label: "Full-Price Paid Pulls",
		description: "Spend paid carats on normal 150-carat pulls.",
	},
]

export const SettingsMenu = () => {
	const calculatorData = useCalculatorDataSafe()
	const [open, setOpen] = useState(false)
	// Two presses to clear a guest's plan: the first swaps the button for a
	// confirm. Reset whenever the panel closes, so reopening never lands on it.
	const [confirmingClear, setConfirmingClear] = useState(false)
	const { isLoggedIn } = useAccount()
	const containerRef = useRef<HTMLDivElement>(null)

	// Close the popover when clicking outside it (same idiom as ThemePicker).
	useEffect(() => {
		if (!open) return
		const handlePointerDown = (e: PointerEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setOpen(false)
				setConfirmingClear(false)
			}
		}
		document.addEventListener("pointerdown", handlePointerDown)
		return () => document.removeEventListener("pointerdown", handlePointerDown)
	}, [open])

	// Only meaningful once stats exist (app mode). Guests have seeded defaults,
	// so this renders for them too — their toggles are kept on the device with
	// the rest of their plan.
	const userStatsData = calculatorData?.userStatsData
	const setUserStatsData = calculatorData?.setUserStatsData
	// Always populated on the context (seeded with DEFAULT_CONSTANTS before the
	// fetch lands); the fallback is only here because the context itself is
	// optional in this component.
	const constants = calculatorData?.calculationConstants ?? DEFAULT_CONSTANTS
	if (!userStatsData || !setUserStatsData) return null

	return (
		<div ref={containerRef} className="relative">
			<button
				onClick={() => {
					setOpen((prev) => !prev)
					setConfirmingClear(false)
				}}
				aria-label="Projection settings"
				title="Projection settings"
				className={NAV_ICON_BUTTON}
			>
				<Settings className="h-4 w-4" />
			</button>

			{open && (
				// Fixed + viewport-centered on mobile: the gear sits between other icons
				// rather than at the screen edge, so anchoring the panel to the button
				// (as on desktop) runs its w-72 width off the side of a narrow viewport.
				// Centering on the viewport avoids that regardless of where the button sits.
				// The breakpoint must match the one Navbar switches on (desktop-nav,
				// md:) — anchoring the panel to its button is only correct while the
				// desktop nav is the one being rendered.
				// max-h + scroll is for landscape phones: this panel is fixed at top-16
				// in a viewport barely 390px tall, so unbounded its lower toggles fall
				// off the bottom of the screen with no way to reach them.
				<div className={`${NAV_POPOVER} fixed left-1/2 top-16 z-50 max-h-[calc(100dvh-5rem)] w-72 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 overflow-y-auto p-3 desktop-nav:absolute desktop-nav:left-auto desktop-nav:top-full desktop-nav:right-0 desktop-nav:mt-1.5 desktop-nav:max-w-none desktop-nav:translate-x-0`}>
					<h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-brand">
						Projection Settings
					</h3>
					<div className="flex flex-col gap-1">
						{SETTINGS.map(({ key, label, description }) => (
							<div
								key={key}
								className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 rounded-md px-1 py-2 hover:bg-gray-700/50"
							>
								<div className="min-w-0 flex-1">
									<div className="text-sm text-gray-100">{label}</div>
									<div className="text-xs leading-tight text-gray-400">
										{typeof description === "function" ? description(constants) : description}
									</div>
								</div>
								<div className="shrink-0 pt-0.5">
									<ToggleSwitch
										// Every setting in this panel is ON by default, so a
										// field the API didn't send (one newer than the
										// deployed backend) has to read as on. `!!` would
										// show it off while the projection treats it as on.
										checked={userStatsData[key] !== false}
										onChange={(checked) =>
											setUserStatsData({ ...userStatsData, [key]: checked })
										}
										ariaLabel={label}
									/>
								</div>
							</div>
						))}
					</div>
					{/* Guests only. A reload used to be how a guest started over;
					    their plan now survives one, so this is the way to empty
					    it. A signed-in user deletes or creates plans instead. */}
					{!isLoggedIn && (
						<div className="mt-2 border-t border-gray-700 px-1 pt-3">
							{confirmingClear ? (
								<div className="flex flex-wrap items-center justify-between gap-2">
									<span className="text-xs text-gray-300">
										Remove every banner and reset your numbers?
									</span>
									<div className="flex gap-2">
										<button
											onClick={() => setConfirmingClear(false)}
											className="rounded-md border border-gray-600 px-2.5 py-1 text-xs font-medium text-gray-300 transition hover:bg-gray-700"
										>
											Cancel
										</button>
										<button
											onClick={() => {
												calculatorData?.resetGuestPlan()
												setConfirmingClear(false)
												setOpen(false)
											}}
											className="rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
										>
											Clear plan
										</button>
									</div>
								</div>
							) : (
								<button
									onClick={() => setConfirmingClear(true)}
									className="text-xs font-medium text-gray-400 underline-offset-2 transition hover:text-gray-100 hover:underline"
								>
									Clear plan and start over
								</button>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	)
}
