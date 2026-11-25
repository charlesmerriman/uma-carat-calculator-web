/**
 * Projection settings: the switches that decide what the projection assumes
 * (spend tickets, misc earnings, paid pulls, the daily pull on other banners).
 *
 * The last row of the Income & Resources panel since 2026-11-24 (owner: "the
 * gear, which exclusively affects the calculator, should be a drop down inside
 * the calculator screen itself, inside the income and resources drop down";
 * notes/navigation-plan.md, PR 1). Until then it was a popover behind a gear
 * in the navbar (navbar/SettingsMenu.tsx, deleted), drawn on every /app page
 * although only the calculator reads these settings.
 *
 * CLOSED, THE ROW STILL ANSWERS THE QUESTION. A dropdown hides its contents,
 * and the shop ticket counts already taught us what a hidden setting costs
 * (IncomeForm, SHOP_TICKET_FIELDS: 3% of players found them behind the gear).
 * So the closed row says how many settings are on and, where there is room,
 * names them: the panel shows what its numbers assume without being opened.
 *
 * Layout is by CONTAINER query, like the rest of the panel: one tile per row
 * on a phone, two from @3xl, three from @income-wide.
 */

import { useId, useState } from "react"
import { ChevronDown, SlidersHorizontal } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { useCalculatorDataSafe } from "../../services/CalculatorContext"
import { useAccount } from "../../services/AuthContext"
import { useRememberedOpen } from "../../hooks/useRememberedOpen"
import { ToggleSwitch } from "../ToggleSwitch"
import { NumberField } from "../NumberField"
import { miscEarningsMonthly } from "../../utils/cumulativeIncome"
import { DEFAULT_CONSTANTS } from "../../constants/gameConstants"
import type { CalculationConstants, UserStats } from "../../types"

/** The boolean-valued keys of UserStats — the only fields these toggles set. */
// `-?` strips the optional marker while mapping. Without it, UserStats'
// optional fields (the shop ticket counts) leak `undefined` into this union
// and it stops being usable as an index. The value is read off
// `Required<UserStats>` for the same reason: an optional boolean (the daily
// pulls on other banners) is `boolean | undefined` on UserStats itself, which
// does not extend `boolean`, and would drop out of the union.
type BooleanStatKey = {
	[K in keyof UserStats]-?: Required<UserStats>[K] extends boolean ? K : never
}[keyof UserStats]

interface ProjectionSetting {
	key: BooleanStatKey
	label: string
	/** What the closed row calls it: short enough for six to share a line. */
	short: string
	description: string | ((constants: CalculationConstants, stats: UserStats) => string)
	defaultOn?: boolean
}

/**
 * Each toggle maps to a boolean field on UserStats and controls a slice of the
 * resource projection (see useBannerResources). Kept as data so the panel is a
 * simple map over this list.
 *
 * A description may be a function of the admin-editable CalculationConstants
 * rather than a fixed string: any blurb quoting a number the content editor can
 * change has to read it from the API, or it silently goes stale the first time
 * that constant moves (Misc Earnings did exactly that, 1,800 -> 2,700/month).
 *
 * `defaultOn: false` marks a setting that starts OFF. It decides how a field
 * the API didn't send (one newer than the deployed backend) reads, which has
 * to match what the projection assumes for it.
 */
const SETTINGS: ProjectionSetting[] = [
	{
		key: "spend_tickets_on_banners",
		label: "Spend Tickets on Banners",
		short: "Tickets on banners",
		description: "Use tickets on planned pulls. Turn off to keep them as spares.",
	},
	{
		key: "misc_earnings",
		label: "Misc Earnings",
		short: "Misc earnings",
		// floor(monthly / 30) is how cumulativeMiscEarningsCarats derives the
		// daily drip, from the same resolved monthly figure, so the blurb can't
		// quote a rate the projection doesn't actually pay.
		description: (k, stats) =>
			`Roughly ${Math.floor(miscEarningsMonthly(stats.custom_misc_earnings_monthly, k) / 30)} carats a day from gifts, team trials, and careers, starting ${k.misc_earnings_delay_days} days out.`,
	},
	{
		key: "discounted_paid_pulls",
		label: "Discounted Paid Pulls",
		short: "Discounted pulls",
		description: "Take the discounted 50-carat pull once a day.",
	},
	{
		key: "full_price_paid_pulls",
		label: "Full-Price Paid Pulls",
		short: "Full-price pulls",
		description: "Spend paid carats on normal 150-carat pulls.",
	},
	// The two below cover the banners the plan has NO row on (an excluded row
	// counts as none); the two above keep the rows the plan does have. See
	// utils/backgroundDailyPulls.
	{
		key: "daily_pulls_other_uma_banners",
		label: "Daily Pull on Every Uma Banner",
		short: "Daily uma pulls",
		description: (k) =>
			`Take the ${k.discounted_pull_cost_carats}-carat daily pull on uma banners you aren't planning on too, up to your last planned banner. Paid carats only.`,
		defaultOn: false,
	},
	{
		key: "daily_pulls_other_support_banners",
		label: "Daily Pull on Every Support Banner",
		short: "Daily support pulls",
		description: (k) =>
			`Take the ${k.discounted_pull_cost_carats}-carat daily pull on support banners you aren't planning on too, up to your last planned banner. Paid carats only.`,
		defaultOn: false,
	},
]

/**
 * Whether a setting reads as on. A field the API didn't send (one newer than
 * the deployed backend) reads as the setting's default, the same thing the
 * projection assumes for it.
 */
function isOn(stats: UserStats, { key, defaultOn = true }: ProjectionSetting): boolean {
	return defaultOn ? stats[key] !== false : stats[key] === true
}

/** The server refuses more than this (GameStats); the box stops there too. */
const MAX_MISC_EARNINGS_MONTHLY = 100_000

/**
 * The "your own amount" box under the Misc Earnings switch, shown while it's on.
 *
 * It shows the figure the projection is using, through the same resolver, and
 * stores the site's estimate as null: an untouched or reset box keeps following
 * the estimate when an editor changes it (the shop ticket counts work the same
 * way). The reset link only appears once the player has set their own number.
 */
const MiscEarningsAmount = ({
	custom,
	constants,
	onChange,
}: {
	custom: number | null | undefined
	constants: CalculationConstants
	onChange: (next: number | null) => void
}) => {
	const siteEstimate = constants.misc_earnings_monthly
	const isCustom = custom !== null && custom !== undefined
	return (
		// w-full makes this its own line under the label and switch, which wrap.
		<div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-300">
			<label className="flex items-center gap-1.5">
				Carats per month
				<NumberField
					value={miscEarningsMonthly(custom, constants)}
					onChange={(next) => {
						const capped = Math.min(next, MAX_MISC_EARNINGS_MONTHLY)
						onChange(capped === siteEstimate ? null : capped)
					}}
					mediumStep={100}
					ariaLabel="Misc earnings carats per month"
					className="w-16 rounded border border-gray-600 bg-gray-800 px-1 py-0.5 text-center text-sm text-gray-100"
				/>
			</label>
			{isCustom && (
				<button
					type="button"
					onClick={() => onChange(null)}
					className="text-gray-400 underline-offset-2 transition hover:text-gray-100 hover:underline"
				>
					Use our estimate ({siteEstimate})
				</button>
			)}
		</div>
	)
}

export const ProjectionSettings = () => {
	const calculatorData = useCalculatorDataSafe()
	const { isLoggedIn } = useAccount()
	// Closed on every load: the row's summary carries the state, and the panel
	// above it is already a screen and a half on a phone. Once opened it stays
	// open until a reload, like the panel itself (useRememberedOpen).
	const [open, setOpen] = useRememberedOpen("projection-settings", false)
	// Two presses to clear a guest's plan: the first swaps the link for a
	// confirm. Reset whenever the row closes, so reopening never lands on it.
	const [confirmingClear, setConfirmingClear] = useState(false)
	// MotionConfig's reducedMotion="user" stops transforms, not a height
	// animation, so this one has to ask for itself.
	const reducedMotion = useReducedMotion()
	const bodyId = useId()

	const userStatsData = calculatorData?.userStatsData
	const setUserStatsData = calculatorData?.setUserStatsData
	// Always populated on the context (seeded with DEFAULT_CONSTANTS before the
	// fetch lands); the fallback is only here because the context itself is
	// optional in this component.
	const constants = calculatorData?.calculationConstants ?? DEFAULT_CONSTANTS
	if (!userStatsData || !setUserStatsData) return null

	const settingsOn = SETTINGS.filter((setting) => isOn(userStatsData, setting))

	return (
		<div className="border-t border-gray-700">
			<button
				type="button"
				onClick={() => {
					setOpen((previous) => !previous)
					setConfirmingClear(false)
				}}
				aria-expanded={open}
				aria-controls={bodyId}
				className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-gray-700/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand @income-wide:px-5"
			>
				<SlidersHorizontal className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
				<span className="font-display shrink-0 text-sm font-semibold text-gray-100">Projection settings</span>
				{/* What the numbers above assume, named, where there is room for
				    it. Below @3xl the pill beside it carries the count alone. */}
				<span className="hidden min-w-0 flex-1 truncate text-xs text-gray-400 @3xl:block">
					{settingsOn.length > 0 ? settingsOn.map((setting) => setting.short).join(" · ") : "Everything is off"}
				</span>
				<span className="ml-auto shrink-0 rounded-full border border-gray-600 bg-gray-900 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-gray-200">
					{settingsOn.length} of {SETTINGS.length} on
				</span>
				{/* The same boxed chevron as the panel's own header, so the two
				    read as one kind of control. */}
				<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-brand/40 bg-brand/10">
					<ChevronDown className={`h-4 w-4 shrink-0 text-brand transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
				</span>
			</button>

			{/* initial={false}: a remembered-open row paints open, it doesn't grow
			    into view. */}
			<motion.div
				id={bodyId}
				initial={false}
				animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
				transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeInOut" }}
				style={{ overflow: "hidden" }}
			>
				{/* `inert` while closed keeps the switches out of the tab order and
				    away from a screen reader; height 0 alone hides them only from
				    the eye. On a plain wrapper, not the animated box, so the motion
				    library never has to pass it through. */}
				<div inert={!open} aria-hidden={!open}>
				<div className="grid grid-cols-1 gap-2 px-3 pb-3 pt-1 @3xl:grid-cols-2 @income-wide:grid-cols-3 @income-wide:px-5 @income-wide:pb-5">
					{SETTINGS.map((setting) => {
						const { key, label, description } = setting
						const checked = isOn(userStatsData, setting)
						return (
							// A setting that is on gets the brand edge. Off is the plain
							// tile, never a dimmed one: the text has to stay readable to
							// decide whether to turn it on.
							<div
								key={key}
								className={`flex flex-wrap items-start justify-between gap-x-3 gap-y-2 rounded-lg border bg-gray-900 px-3 py-2.5 ${checked ? "border-brand/40" : "border-gray-700"}`}
							>
								<div className="min-w-0 flex-1">
									<div className="text-sm font-medium text-gray-100">{label}</div>
									<div className="text-xs leading-snug text-gray-400">
										{typeof description === "function" ? description(constants, userStatsData) : description}
									</div>
								</div>
								<div className="shrink-0 pt-0.5">
									<ToggleSwitch
										checked={checked}
										onChange={(next) => setUserStatsData({ ...userStatsData, [key]: next })}
										ariaLabel={label}
									/>
								</div>
								{key === "misc_earnings" && userStatsData.misc_earnings !== false && (
									<MiscEarningsAmount
										custom={userStatsData.custom_misc_earnings_monthly}
										constants={constants}
										onChange={(next) => setUserStatsData({ ...userStatsData, custom_misc_earnings_monthly: next })}
									/>
								)}
							</div>
						)
					})}
				</div>
				{/* Guests only. A reload used to be how a guest started over;
				    their plan now survives one, so this is the way to empty
				    it. A signed-in user deletes or creates plans instead. */}
				{!isLoggedIn && (
					<div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-700 px-4 py-2.5 @income-wide:px-5">
						{confirmingClear ? (
							<>
								<span className="text-xs text-gray-300">Remove every banner and reset your numbers?</span>
								<button
									type="button"
									onClick={() => setConfirmingClear(false)}
									className="rounded-md border border-gray-600 px-2.5 py-1 text-xs font-medium text-gray-300 transition hover:bg-gray-700"
								>
									Cancel
								</button>
								<button
									type="button"
									onClick={() => {
										calculatorData?.resetGuestPlan()
										setConfirmingClear(false)
									}}
									className="rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
								>
									Clear plan
								</button>
							</>
						) : (
							<button
								type="button"
								onClick={() => setConfirmingClear(true)}
								className="text-xs font-medium text-gray-400 underline-offset-2 transition hover:text-gray-100 hover:underline"
							>
								Clear plan and start over
							</button>
						)}
					</div>
				)}
				</div>
			</motion.div>
		</div>
	)
}
