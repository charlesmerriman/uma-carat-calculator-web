import type { ReactNode } from "react"
import { useRememberedOpen } from "../../hooks/useRememberedOpen"
import { incomeStartsOpenOnPhone } from "../../utils/incomePanel"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import NumberFlow from "@number-flow/react"
import Select from "react-select"
import type { SingleValue, CSSObjectWithLabel, StylesConfig } from "react-select"
import { Trophy, Gift, Diamond, TrendingUp, Sword, Crown, Carrot, Dumbbell, Ticket, Star, Sparkles, ChevronDown } from "lucide-react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { useAverageMonthlyIncome } from "../../hooks/useAverageMonthlyIncome"
import { UncapCrystalsPanel } from "./UncapCrystalsPanel"
import { ToggleSwitch } from "../ToggleSwitch"
import { NumberField } from "../NumberField"
import { shopTicketsPerMonth } from "../../utils/cumulativeIncome"
import { upcomingSkipCount } from "../../utils/raceParticipation"
import { upcomingRaceRewardRange } from "../../utils/incomeLedger"
import type { RaceRank } from "../../utils/incomeLedger"
import type { IncomeLedgerRow, LedgerRowKind } from "../../types/ledger"
import { countLabel } from "../../utils/plural"
import type { CalculationConstants, ClubRank, TeamTrialsRank, ChampionsMeetingRank, LeagueOfHeroesRank } from "../../types"

// ── Types ─────────────────────────────────────────────────────────────

interface RankOption<T> {
	value: T
	label: string
	key: number
}

// ── Shared Styles ─────────────────────────────────────────────────────

// The rank selects' empty text. react-select's own "Select..." names no
// thing; this names the one thing all four of them want.
const RANK_PLACEHOLDER = "Choose a rank"

// Colors reference the theme's CSS variables (the same gray tokens the Tailwind
// utilities use) so these rank selects repaint with the active [data-theme]
// instead of being locked to the dark palette. gray-700 = surface, gray-600 =
// border/selected, gray-500 = hover border, gray-400 = indicator/placeholder,
// gray-100 = text.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const selectStyles: StylesConfig<any, false> = {
	control: (base: CSSObjectWithLabel) => ({
		...base,
		border: "1px solid var(--color-gray-600)",
		borderRadius: 4,
		boxShadow: "none",
		minHeight: 32,
		backgroundColor: "var(--color-gray-700)",
		"&:hover": { borderColor: "var(--color-gray-500)" },
	}),
	valueContainer: (base: CSSObjectWithLabel) => ({ ...base, padding: "0 6px" }),
	dropdownIndicator: (base: CSSObjectWithLabel) => ({
		...base,
		padding: "0 4px",
		color: "var(--color-gray-400)",
	}),
	indicatorSeparator: () => ({ display: "none" }),
	menu: (base: CSSObjectWithLabel) => ({
		...base,
		zIndex: 100,
		borderRadius: 4,
		backgroundColor: "var(--color-gray-700)",
		border: "1px solid var(--color-gray-600)",
	}),
	option: (base: CSSObjectWithLabel, state: { isSelected: boolean; isFocused: boolean }) => ({
		...base,
		color: "var(--color-gray-100)",
		backgroundColor: state.isSelected || state.isFocused ? "var(--color-gray-600)" : "var(--color-gray-700)",
		padding: "4px 8px",
	}),
	singleValue: (base: CSSObjectWithLabel) => ({
		...base,
		color: "var(--color-gray-100)",
	}),
	input: (base: CSSObjectWithLabel) => ({
		...base,
		color: "var(--color-gray-100)",
	}),
	placeholder: (base: CSSObjectWithLabel) => ({
		...base,
		color: "var(--color-gray-400)",
	}),
	menuPortal: (base: CSSObjectWithLabel) => ({ ...base, zIndex: 9999 }),
}

// Padding is symmetric: NumberField renders no spinner arrows at all, so
// text-center lands optically centered — the old asymmetric pl-4.5
// counterweight would push the value off-center.
// Width is NOT set here — the two call sites differ (a phone's resource grid gives
// each field a hair under 4rem, the rank badges a full 5rem) and baking one in
// meant overriding it at the site that disagreed.
const numInputClass =
	"border border-gray-600 rounded-md py-1 px-1 text-xs text-center bg-gray-700 text-gray-100 outline-none focus:border-gray-500 @income-wide:px-2 @income-wide:text-sm"

// ── ResourceRow ───────────────────────────────────────────────────────

// Eight of these stacked in one column ran to ~355px on a phone, the single
// biggest block in the panel. Two columns of smaller rows is ~140px: the icon
// drops to 24px, the label to 11px and wraps rather than pushing the field off
// the row, and the field keeps a 3.5rem tap target.
const ResourceRow = ({ icon, label, value, onChange }: { icon: ReactNode; label: string; value: number; onChange: (v: number) => void }) => (
	<div className="flex min-w-0 items-center gap-1.5 @income-wide:gap-2">
		<span className="shrink-0 w-6 h-6 flex items-center justify-center @income-wide:w-8 @income-wide:h-8">{icon}</span>
		<span className="min-w-0 flex-1 text-[11px] text-gray-400 leading-tight @income-wide:text-sm">{label}</span>
		<NumberField
			value={value}
			className={`${numInputClass} w-14 shrink-0 @income-wide:w-20`}
			ariaLabel={label}
			onChange={onChange}
		/>
	</div>
)

// ── Shop tickets ──────────────────────────────────────────────────────

/**
 * The two "how many do I buy" boxes beside the Monthly Shop Tickets toggle.
 * Each maps to a nullable count on UserStats, capped at what the shop sells.
 *
 * These lived in the navbar's Projection Settings popover until 2026-10, where
 * about 3% of players ever changed them: two clicks deep, behind a gear, with
 * nothing on the calculator pointing at them. Purchases is where players
 * already go to say what they buy, so the toggle and its counts sit here now.
 */
const SHOP_TICKET_FIELDS: {
	key: "shop_uma_tickets_bought" | "shop_support_tickets_bought"
	label: string
	/** What a null count resolves to: the assumed purchase. */
	defaultCount: (constants: CalculationConstants) => number
	/** The most the shop sells in a month. */
	max: (constants: CalculationConstants) => number
}[] = [
	{
		key: "shop_uma_tickets_bought",
		label: "Uma",
		defaultCount: (k) => k.monthly_shop_uma_tickets,
		max: (k) => k.monthly_shop_uma_tickets_max,
	},
	{
		key: "shop_support_tickets_bought",
		label: "Support",
		defaultCount: (k) => k.monthly_shop_support_tickets,
		max: (k) => k.monthly_shop_support_tickets_max,
	},
]

// ── PassToggle ────────────────────────────────────────────────────────

/**
 * One purchase/bonus: icon, label, on-off switch and its income badge.
 *
 * Extracted because the two of them now sit SIDE BY SIDE rather than stacked,
 * and two hand-copied halves of a split row is the drift that leaves one of
 * them a size class behind the other.
 *
 * The block's own `@container` — NOT `@income-wide:` — decides which of the two
 * arrangements this renders. The question here is "do two of these fit across
 * this column", which is about the column, and the column is 2fr of a 3-track
 * grid on a desktop and the full panel below that. Keyed to the panel's width
 * instead, the narrow desktop column would get the roomy layout it has no room
 * for. 40rem is where two roomy halves fit: each wants ~300px (32px icon, a
 * ~115px label at text-sm, the 40px switch and an 80px badge, plus gaps).
 *
 * Below that the half stacks into two lines — label over controls — which is
 * what keeps BOTH of them on one row on a phone.
 */
const PassToggle = ({
	icon,
	label,
	ariaLabel,
	checked,
	onChange,
	badge,
	title,
}: {
	icon: ReactNode
	label: string
	ariaLabel: string
	checked: boolean
	onChange: (checked: boolean) => void
	badge: string
	title: string
}) => (
	<div className="flex min-w-0 flex-col items-center gap-1.5 px-2 @min-[40rem]:flex-row @min-[40rem]:gap-x-3 @min-[40rem]:px-0">
		<div className="flex w-full min-w-0 items-center justify-center gap-1.5 @min-[40rem]:w-auto">
			<span className="shrink-0 text-brand">{icon}</span>
			<span className="min-w-0 text-center text-[11px] leading-tight text-gray-400 @min-[40rem]:whitespace-nowrap @min-[40rem]:text-left @min-[40rem]:text-sm">
				{label}
			</span>
		</div>
		{/* Both lines centre within the half rather than spreading to its edges: a
		    switch pinned left and a badge pinned right read as two unrelated
		    controls once the half is only ~180px of a desktop column. */}
		<div className="flex w-full items-center justify-center gap-3 @min-[40rem]:w-auto">
			<ToggleSwitch ariaLabel={ariaLabel} checked={checked} onChange={onChange} />
			<div
				className="flex h-7 w-20 shrink-0 items-center justify-center rounded border border-brand bg-gray-700 text-[11px] font-semibold text-brand @min-[40rem]:h-8 @min-[40rem]:text-xs"
				title={title}
			>
				{badge}
			</div>
		</div>
	</div>
)

// Section icons keep the brand tint; the headings beside them are gray. The
// panel had the title, five headings, every figure and the primary button all
// in brand gold, so nothing stood out (design-polish item 9, 2026-10-18). Gold
// is for the one primary action, the active nav tab and these small marks.
const iconCls = "w-4 h-4 shrink-0 text-brand"

/**
 * What the chosen CM or LoH rank pays per event. Payouts rise at set event
 * numbers (utils/incomeLedger, raceRewardAmount), so when the events still
 * ahead pay different amounts the badge shows the range, as the source sheet
 * does. "/event" is dropped then: "+3,300-3,800/event" does not fit the
 * badge's 5rem, so the title says it in full.
 */
const RaceRewardBadge = ({
	rank,
	kind,
	ledger,
}: {
	rank: RaceRank
	kind: LedgerRowKind
	ledger: IncomeLedgerRow[]
}) => {
	const range = upcomingRaceRewardRange(ledger, kind, rank, new Date()) ?? {
		min: rank.income_amount,
		max: rank.income_amount,
	}
	const single = range.min === range.max
	return (
		<div
			className="w-full h-8 flex items-center justify-center text-xs font-semibold text-brand bg-gray-700 border border-brand rounded"
			title={
				single
					? undefined
					: `${range.min.toLocaleString()} to ${range.max.toLocaleString()} carats per event, depending on the event`
			}
		>
			{single
				? `+${range.min.toLocaleString()}/event`
				: `+${range.min.toLocaleString()}-${range.max.toLocaleString()}`}
		</div>
	)
}

/**
 * The Club Rank glyph — a jersey-and-shoulders figure over a crowd line, drawn
 * inline rather than pulled from lucide because no stock icon reads as a club.
 *
 * Kept local: it is one field's decoration, not a shared token. Sizing and
 * colour come from `className` (iconCls at the call site) so it scales with the
 * lucide icons beside it instead of carrying its own w-/h-.
 */
const ClubRankIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="butt"
		strokeLinejoin="miter"
		className={className}
		aria-hidden="true"
	>
		<ellipse cx="12" cy="13.5" rx="8" ry="8" />
		<path style={{ strokeWidth: 3 }} d="M 3 21 L 8 21 C 8 21 12 18.8 16 21 L 21 21" />
		<path d="M 5 20 C 5 20 12 16 19 20" />
		<path d="M 8 19 L 8 13 C 8 13 8 9 12 9 C 12 9 16 9 16 13 L 16 19" />
		<ellipse cx="12" cy="2.5" rx="0.25" ry="0.25" />
		<ellipse cx="8" cy="3" rx="0.25" ry="0.25" />
		<ellipse cx="16" cy="3" rx="0.25" ry="0.25" />
		<path d="M 8.2 4.5 C 8.4 4.44 10.3 5.5 12.1 3.8" />
		<path d="M 15.8 4.5 C 15.6 4.44 13.7 5.5 11.9 3.8" />
	</svg>
)

/**
 * The Champion's Meeting glyph — a crescent. Local for the same reason as
 * [ClubRankIcon]: one field's decoration, sized and coloured by `className`.
 */
const ChampionsMeetingIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		aria-hidden="true"
	>
		<path d="M2.0343,14.3455c1.5881,2.1525,4.1422,3.5487,7.0224,3.5487c4.8166,0,8.7212,-3.9046,8.7212,-8.7212 c0,-2.9731,-1.4877,-5.5987,-3.7593,-7.173c4.5484,0.9902,7.9472,5.0383,7.9472,9.8834c0,5.5872,-4.5293,10.1166,-10.1166,10.1166 C7.1091,22,3.1319,18.7457,2.0343,14.3455z" />
	</svg>
)

// ── IncomeForm ────────────────────────────────────────────────────────

export const IncomeForm = () => {
	const {
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		incomeLedger,
		fullIncomeLedger,
		calculationConstants,
		setUserStatsData,
	} = useCalculatorData()

	// These tiles must agree with the banner rows below them: both read the same
	// ledger engine, so a user comparing the two can never see them disagree.
	const monthlyStats = useAverageMonthlyIncome({
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		incomeLedger,
		constants: calculationConstants,
	})

	// Open by default on desktop, collapsed on mobile — this panel is roughly a
	// screen and a half tall on a phone, and the banner sheet below it is what
	// most visits are actually for. The exception is a player who has picked no
	// ranks yet: the numbers below mean little until they do, so it starts open.
	// Once toggled it stays that way until a reload (useRememberedOpen).
	//
	// The breakpoint is read ONCE in the lazy initializer rather than subscribed
	// to with a matchMedia listener: the default is a first-paint concern only.
	// A live listener would re-force open/closed on every crossing of 767px,
	// overriding whatever the user had toggled mid-session.
	const [isOpen, setIsOpen] = useRememberedOpen("income-panel", () => {
		if (typeof window === "undefined" || !window.matchMedia("(max-width: 767px)").matches) return true
		return incomeStartsOpenOnPhone(userStatsData)
	})

	if (!userStatsData) return null

	// Every income toggle defaults ON; only an explicit false turns it off.
	const shopTicketsOn = userStatsData.monthly_shop_tickets !== false

	const teamTrialsRank = teamTrialsRankData.find((r) => r.id === userStatsData.team_trials_rank)
	const clubRank = clubRankData.find((r) => r.id === userStatsData.club_rank)
	const championsMeetingRank = championsMeetingRankData.find((r) => r.id === userStatsData.champions_meeting_rank)
	const leagueOfHeroesRank = leagueOfHeroesRankData.find((r) => r.id === userStatsData.league_of_heroes_rank)
	// Skips are set on the Timeline, a page away from these totals, so the
	// panel says when some are in force. Otherwise a player who skipped a CM
	// weeks ago sees lower numbers here and no reason why. The full ledger,
	// because the projection's has the skipped rows taken out already.
	const skippedRaces = upcomingSkipCount(fullIncomeLedger, userStatsData.skipped_race_events, new Date())

	const monthlyItems = [
		{
			label: "Carats",
			value: monthlyStats.carats,
			icon: <Carrot className={iconCls} />,
		},
		{
			label: "Uma Tickets",
			value: monthlyStats.umaTickets,
			icon: <Ticket className={iconCls} />,
		},
		{
			label: "Support Tickets",
			value: monthlyStats.supportTickets,
			icon: <Ticket className={iconCls} />,
		},
		{
			label: "SSR Shards",
			value: monthlyStats.ssrShards,
			icon: <Star className={iconCls} />,
		},
		{
			label: "SR Shards",
			value: monthlyStats.srShards,
			icon: <Sparkles className={iconCls} />,
		},
	]

	return (
		// No width/background/padding of its own: this renders inside the
		// calculator page's shared desktop canvas and its mx-2/sm:mx-4 gutter,
		// which previously had to be duplicated here because the panel hung
		// full-bleed off the navbar.
		<div className="w-full">
			{/* Collapse header — a full-width control so it remains an obvious entry
			    point when the income form is closed on phones and desktop alike. */}
			<button
				type="button"
				onClick={() => setIsOpen((v) => !v)}
				aria-expanded={isOpen}
				className="flex w-full cursor-pointer items-center justify-between gap-2 border-b border-gray-700 bg-gray-800/50 px-4 py-3 text-left transition-colors hover:bg-gray-800/80 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
			>
				<span className="font-display min-w-0 truncate text-base font-semibold text-gray-100 uppercase tracking-wide">Income &amp; Resources</span>
				{/* A title with a chevron beside it reads as a title. The word and the
				    boxed chevron together read as a control — and this panel starts
				    CLOSED on a phone, so the header is all there is to go on: if it
				    doesn't look openable, the whole form is invisible. The word is
				    phone-only; a desktop load has the panel already open and the
				    chevron alone is enough beside a visible body. */}
				<span className="flex shrink-0 items-center gap-1.5">
					<span className="text-[11px] font-medium uppercase tracking-wide text-gray-400 @income-wide:hidden">
						{isOpen ? "Hide" : "Show"}
					</span>
					<span className="flex h-7 w-7 items-center justify-center rounded-md border border-brand/40 bg-brand/10">
						<ChevronDown className={`h-4 w-4 shrink-0 text-brand transition-transform ${isOpen ? "rotate-180" : ""}`} />
					</span>
				</span>
			</button>

			{/* initial={false} skips the mount animation, so a desktop load paints
			    the panel already open instead of expanding into view. The rank
			    selects portal their menus to document.body, so overflow:hidden
			    here clips the panel without clipping an open dropdown. */}
			<motion.div
				initial={false}
				animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
				transition={{ duration: 0.2, ease: "easeInOut" }}
				style={{ overflow: "hidden" }}
			>
				<div className="bg-gray-800">
					{/* ── Top row: Income Sources + Current Resources ──
					    ONE column up to @income-wide, where the three-track desktop
					    grid takes over. From @3xl (48rem of panel) each block spreads
					    across that column instead of sitting in a capped phone-width
					    strip: the four ranks two by two, purchases on one line, the
					    eight resources four across (design polish item 19a). Below
					    @3xl it was one centred phone-width column under a full desktop
					    navbar on a 1024 to 1258px window. Splitting the row into two
					    columns was tried first and left a tall empty well under the
					    resources, which are half the height of ranks plus purchases. */}
					<div className="grid grid-cols-1 @income-wide:grid-cols-[2fr_1fr]">
						{/* Related settings share one bordered surface; dividers describe the
					    relationship without turning each group into its own card. */}
						<div className="p-3 @income-wide:p-5">
							<div className="grid grid-cols-1 gap-4 @income-wide:grid-cols-[3fr_auto_2fr]">
								{/* Competitive Progress */}
								<div className="min-w-0">
									<h3 className="font-display font-semibold text-center text-sm text-gray-200 mb-2 flex items-center justify-center gap-1.5 @income-wide:mb-4">
										<Trophy className={iconCls} />
										Competitive Progress
									</h3>
									{/* One row per rank when the panel is compact: icon, label and income
									    badge on the first line, the select spanning the second. It used to
									    take THREE lines — the badge could not share a line with the label
									    because a single grid holds all four ranks and `order` is
									    container-wide, so each rank now owns a wrapper that
									    `@income-wide:contents` dissolves again once the panel is wide. */}
									{/* The compact layout is CAPPED and centred, not stretched. It is
									    now in use up to 78.625rem of panel, and a one-per-line form
									    stretched that far gives you a 1140px-wide rank select and a
									    hand's width of dead space between a label and its input. 34rem
									    is about what the widest phone gives these blocks, so capping
									    there is the same layout rather than a wider variant of it. From
									    @3xl (the middle layout, see the top row) the cap lifts and the
									    ranks go two by two, so each select is about half the panel. The
									    real desktop grid takes over at `@income-wide:`. */}
									<div className="mx-auto grid w-full max-w-[34rem] grid-cols-1 gap-y-2 @3xl:max-w-none @3xl:grid-cols-2 @3xl:gap-x-8 @3xl:gap-y-3 @income-wide:grid-cols-[auto_auto_1fr_auto] @income-wide:items-center @income-wide:gap-x-2 @income-wide:gap-y-3">
										<div className="flex flex-wrap items-center gap-x-2 gap-y-1 @income-wide:contents">
											<Sword className={iconCls} />
											<span className="min-w-0 text-xs text-gray-400 text-left leading-tight @income-wide:pr-2 @income-wide:text-sm @income-wide:text-right @income-wide:whitespace-nowrap">Team Trials:</span>
											<Select
												className="order-last w-full min-w-0 @income-wide:order-none @income-wide:col-span-1 @income-wide:w-auto"
												styles={selectStyles}
												placeholder={RANK_PLACEHOLDER}
												menuPortalTarget={document.body}
												menuPosition="fixed"
												// Controlled, not defaultValue: userStatsData can be replaced
												// from outside this component (guest→account migration, a save
												// round-trip), and an uncontrolled select would keep showing the
												// rank it mounted with.
												value={
													teamTrialsRank
														? {
																value: teamTrialsRank,
																label: teamTrialsRank.name,
																key: teamTrialsRank.id,
															}
														: null
												}
												onChange={(o: SingleValue<RankOption<TeamTrialsRank>>) => {
													if (!o) return
													setUserStatsData({
														...userStatsData,
														team_trials_rank: o.value.id,
													})
												}}
												options={teamTrialsRankData.map((r) => ({
													value: r,
													label: r.name,
													key: r.id,
												}))}
											/>
											<div className="ml-auto w-20 @income-wide:ml-0 @income-wide:w-20 @income-wide:col-span-1 @income-wide:justify-self-end">
												{teamTrialsRank && (
													<div className="w-full h-8 flex items-center justify-center text-xs font-semibold text-brand bg-gray-700 border border-brand rounded">
														{`+${teamTrialsRank.income_amount.toLocaleString()}/week`}
													</div>
												)}
											</div>
										</div>

										<div className="flex flex-wrap items-center gap-x-2 gap-y-1 @income-wide:contents">
											<ClubRankIcon className={iconCls} />
											<span className="min-w-0 text-xs text-gray-400 text-left leading-tight @income-wide:pr-2 @income-wide:text-sm @income-wide:text-right @income-wide:whitespace-nowrap">Club Rank:</span>
											<Select
												className="order-last w-full min-w-0 @income-wide:order-none @income-wide:col-span-1 @income-wide:w-auto"
												styles={selectStyles}
												placeholder={RANK_PLACEHOLDER}
												menuPortalTarget={document.body}
												menuPosition="fixed"
												value={
													clubRank
														? {
																value: clubRank,
																label: clubRank.name,
																key: clubRank.id,
															}
														: null
												}
												onChange={(o: SingleValue<RankOption<ClubRank>>) => {
													if (!o) return
													setUserStatsData({
														...userStatsData,
														club_rank: o.value.id,
													})
												}}
												options={clubRankData.map((r) => ({
													value: r,
													label: r.name,
													key: r.id,
												}))}
											/>
											<div className="ml-auto w-20 @income-wide:ml-0 @income-wide:w-20 @income-wide:col-span-1 @income-wide:justify-self-end">
												{clubRank && (
													<div className="w-full h-8 flex items-center justify-center text-xs font-semibold text-brand bg-gray-700 border border-brand rounded">
														{`+${clubRank.income_amount.toLocaleString()}/mo`}
													</div>
												)}
											</div>
										</div>

										<div className="flex flex-wrap items-center gap-x-2 gap-y-1 @income-wide:contents">
											<ChampionsMeetingIcon className={iconCls} />
											<span className="min-w-0 text-xs text-gray-400 text-left leading-tight @income-wide:pr-2 @income-wide:text-sm @income-wide:text-right @income-wide:whitespace-nowrap">Champion's Meeting:</span>
											<Select
												className="order-last w-full min-w-0 @income-wide:order-none @income-wide:col-span-1 @income-wide:w-auto"
												styles={selectStyles}
												placeholder={RANK_PLACEHOLDER}
												menuPortalTarget={document.body}
												menuPosition="fixed"
												value={
													championsMeetingRank
														? {
																value: championsMeetingRank,
																label: championsMeetingRank.name,
																key: championsMeetingRank.id,
															}
														: null
												}
												onChange={(o: SingleValue<RankOption<ChampionsMeetingRank>>) => {
													if (!o) return
													setUserStatsData({
														...userStatsData,
														champions_meeting_rank: o.value.id,
													})
												}}
												options={championsMeetingRankData.map((r) => ({
													value: r,
													label: r.name,
													key: r.id,
												}))}
											/>
											<div className="ml-auto w-20 @income-wide:ml-0 @income-wide:w-20 @income-wide:col-span-1 @income-wide:justify-self-end">
												{championsMeetingRank && (
													<RaceRewardBadge rank={championsMeetingRank} kind="champions_meeting" ledger={incomeLedger} />
												)}
											</div>
										</div>

										<div className="flex flex-wrap items-center gap-x-2 gap-y-1 @income-wide:contents">
											<Crown className={iconCls} />
											<span className="min-w-0 text-xs text-gray-400 text-left leading-tight @income-wide:pr-2 @income-wide:text-sm @income-wide:text-right @income-wide:whitespace-nowrap">League of Heroes:</span>
											<Select
												className="order-last w-full min-w-0 @income-wide:order-none @income-wide:col-span-1 @income-wide:w-auto"
												styles={selectStyles}
												placeholder={RANK_PLACEHOLDER}
												menuPortalTarget={document.body}
												menuPosition="fixed"
												value={
													leagueOfHeroesRank
														? {
																value: leagueOfHeroesRank,
																label: leagueOfHeroesRank.name,
																key: leagueOfHeroesRank.id,
															}
														: null
												}
												onChange={(o: SingleValue<RankOption<LeagueOfHeroesRank>>) => {
													if (!o) return
													setUserStatsData({
														...userStatsData,
														league_of_heroes_rank: o.value.id,
													})
												}}
												options={leagueOfHeroesRankData.map((r) => ({
													value: r,
													label: r.name,
													key: r.id,
												}))}
											/>
											<div className="ml-auto w-20 @income-wide:ml-0 @income-wide:w-20 @income-wide:col-span-1 @income-wide:justify-self-end">
												{leagueOfHeroesRank && (
													<RaceRewardBadge rank={leagueOfHeroesRank} kind="league_of_heroes" ledger={incomeLedger} />
												)}
											</div>
										</div>
									</div>
									{skippedRaces > 0 && (
										<p className="mt-2 text-center text-xs text-gray-400">
											Skipping {countLabel(skippedRaces, "upcoming event")}, so {skippedRaces === 1 ? "it isn't" : "they aren't"} counted.{" "}
											<Link to="/app/timeline" className="text-brand underline-offset-2 hover:underline">
												Change it on the Timeline
											</Link>
										</p>
									)}
								</div>

								{/* Separator */}
								<div className="hidden w-px bg-gray-700 self-stretch my-2 @income-wide:block" />

								{/* Purchases */}
								<div className="flex min-w-0 flex-col">
									<h3 className="font-display font-semibold text-center text-sm text-gray-200 mb-2 flex items-center justify-center gap-1.5 @income-wide:mb-4">
										<Gift className={iconCls} />
										Purchases
									</h3>
									{/* ONE ROW: Daily Carat Pack left, Training Pass right. Stacked, the
									    pair cost two full rows of a block that spans the whole panel at
									    every width below the desktop 3-track layout — most of that width
									    empty. Side by side they cost one.

									    Its own @container, so the split is decided by THIS column rather
									    than by the panel: see PassToggle. The two halves stay a 2-column
									    grid at every width — one row is the point — and it is the halves
									    that compact, not the row that breaks. */}
									<div className="@container flex flex-1 items-center justify-center">
										<div className="grid w-full grid-cols-2 divide-x divide-gray-700 @min-[40rem]:flex @min-[40rem]:w-auto @min-[40rem]:justify-center @min-[40rem]:gap-x-10 @min-[40rem]:divide-x-0">
											{/* Daily carats only — the pack's 500 paid carats per 30-day
											    repurchase are projected but won't fit the badge, so the
											    tooltip carries them (same pattern as the Training Pass). */}
											<PassToggle
												icon={<Carrot className="h-6 w-6 @min-[40rem]:h-8 @min-[40rem]:w-8" />}
												label="Daily Carat Pack:"
												ariaLabel="Daily Carat Pack"
												checked={userStatsData.daily_carat}
												onChange={(checked) =>
													setUserStatsData({
														...userStatsData,
														daily_carat: checked,
													})
												}
												badge={userStatsData.daily_carat ? "+50/day" : "+0/day"}
												title={
													userStatsData.daily_carat
														? "Daily Carat Pack: +50 carats every day, plus 500 paid carats each time it is re-bought (every 30 days, starting 30 days from today)"
														: "Daily Carat Pack off: no daily carats and no paid carats from repurchases"
												}
											/>
											{/* Carats only — the pass's ticket income is projected but not
											    shown here, to keep the badge in step with the rows above.
											    The tooltip carries the full breakdown for anyone who wants it. */}
											<PassToggle
												icon={<Dumbbell className="h-6 w-6 @min-[40rem]:h-8 @min-[40rem]:w-8" />}
												label="Training Pass:"
												ariaLabel="Training Pass"
												checked={userStatsData.training_pass}
												onChange={(checked) =>
													setUserStatsData({
														...userStatsData,
														training_pass: checked,
													})
												}
												badge={userStatsData.training_pass ? "+2,200/mo" : "+500/mo"}
												title={
													userStatsData.training_pass
														? "Paid Training Pass: +2,200 carats each month (1,850 free carats plus 350 paid carats), 4 uma tickets and 4 support tickets"
														: "Free Training Pass tier: +500 carats, 2 uma tickets and 2 support tickets each month"
												}
											/>
										</div>
									</div>
									{/* Monthly Shop Tickets. Its own full-width row under the passes:
									    a toggle plus two count boxes is too much for a PassToggle
									    half. flex-wrap lets the counts drop under the toggle on a
									    phone and sit beside it on a desktop. */}
									<div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-gray-700 pt-3">
										<label className="flex items-center gap-3">
											<ToggleSwitch
												ariaLabel="Monthly Shop Tickets"
												// ON by default, so a field the API didn't send reads
												// as on, the same way the projection treats it.
												checked={shopTicketsOn}
												onChange={(checked) =>
													setUserStatsData({
														...userStatsData,
														monthly_shop_tickets: checked,
													})
												}
											/>
											<span className="text-sm text-gray-300">Monthly Shop Tickets</span>
										</label>
										{/* Only while the toggle is on: with it off no shop tickets
										    are credited at all, so a count would be a control that
										    does nothing. */}
										{/* One wrapper so Uma and Support always share a line: the
										    row may wrap them under the toggle, never apart. */}
										{shopTicketsOn && (
											<div className="flex items-center gap-4">
												{SHOP_TICKET_FIELDS.map((field) => {
													const defaultCount = field.defaultCount(calculationConstants)
													const max = field.max(calculationConstants)
													return (
														<label key={field.key} className="flex items-center gap-1.5 text-xs text-gray-300">
															{field.label}
															<NumberField
																// Shown through the same resolver the projection
																// reads with, so the box can never show a count
																// the engine isn't using.
																value={shopTicketsPerMonth(userStatsData[field.key], defaultCount, max)}
																onChange={(next) => {
																	const capped = Math.min(next, max)
																	setUserStatsData({
																		...userStatsData,
																		// The default count is stored as null,
																		// "whatever the default is", so it keeps
																		// following the default if an editor
																		// changes it.
																		[field.key]: capped === defaultCount ? null : capped,
																	})
																}}
																mediumStep={1}
																ariaLabel={`${field.label} tickets bought each month`}
																className="w-10 rounded border border-gray-600 bg-gray-800 px-1 py-0.5 text-center text-sm text-gray-100"
															/>
															<span className="text-gray-400">of {max}</span>
														</label>
													)
												})}
											</div>
										)}
									</div>
									{/* Same setting as the toggle on the Selectors page, surfaced here
									    too so it's visible right alongside the other things that change
									    the projection, without switching tabs. */}
									<label className="mt-3 flex items-center justify-center gap-3 border-t border-gray-700 pt-3">
										<ToggleSwitch
											ariaLabel="Include purchases in the calculator projection"
											checked={userStatsData.include_purchases_in_projection}
											onChange={(checked) =>
												setUserStatsData({
													...userStatsData,
													include_purchases_in_projection: checked,
												})
											}
										/>
										<span className="text-sm text-gray-300">Include Selector Purchases</span>
									</label>
								</div>
							</div>
						</div>

						{/* Current Resources */}
						<div className="border-t border-gray-700 p-3 @income-wide:p-5 @income-wide:border-t-0 @income-wide:border-l">
							<h3 className="font-display font-semibold text-center text-sm text-gray-200 mb-2 flex items-center justify-center gap-1.5 @income-wide:mb-4">
								<Diamond className={iconCls} />
								Current Resources
							</h3>
							{/* Capped and centred while compact — see the rank grid above.
							    From @3xl four across in two rows, filled down the columns, so
							    the top row reads carats and tickets and the bottom one crystals
							    and shards. Back to two columns in the narrow desktop track. */}
							<div className="mx-auto grid w-full max-w-[34rem] grid-cols-2 gap-x-2 gap-y-1.5 @3xl:max-w-none @3xl:grid-flow-col @3xl:grid-cols-4 @3xl:grid-rows-2 @3xl:gap-x-6 @income-wide:grid-flow-row @income-wide:grid-cols-2 @income-wide:grid-rows-none @income-wide:gap-y-2">
								<ResourceRow
									icon={<img src="/item_icon_00043.png" alt="Carats" className="w-8 h-8 object-contain" />}
									label="Carats"
									value={userStatsData.current_carat}
									onChange={(v) => setUserStatsData({ ...userStatsData, current_carat: v })}
								/>
								<ResourceRow
									icon={<img src="/item_icon_00144.png" alt="SSR Crystals" className="w-8 h-8 object-contain" />}
									label="SSR Crystals"
									value={userStatsData.ssr_crystals}
									onChange={(v) => setUserStatsData({ ...userStatsData, ssr_crystals: v })}
								/>
								<ResourceRow
									icon={<img src="/item_icon_00043.png" alt="Paid Carats" className="w-8 h-8 object-contain" />}
									label="Paid Carats"
									value={userStatsData.current_paid_carat}
									onChange={(v) =>
										setUserStatsData({
											...userStatsData,
											current_paid_carat: v,
										})
									}
								/>
								<ResourceRow
									icon={<img src="/item_icon_00145.png" alt="SR Crystals" className="w-8 h-8 object-contain" />}
									label="SR Crystals"
									value={userStatsData.sr_crystals}
									onChange={(v) => setUserStatsData({ ...userStatsData, sr_crystals: v })}
								/>
								<ResourceRow
									icon={<img src="/item_icon_00041.png" alt="Uma Tickets" className="w-8 h-8 object-contain" />}
									label="Uma Tickets"
									value={userStatsData.uma_ticket}
									onChange={(v) => setUserStatsData({ ...userStatsData, uma_ticket: v })}
								/>
								<ResourceRow
									icon={<img src="/item_icon_00149.png" alt="SSR Shards" className="w-8 h-8 object-contain" />}
									label="SSR Shards"
									value={userStatsData.ssr_shards}
									onChange={(v) => setUserStatsData({ ...userStatsData, ssr_shards: v })}
								/>
								<ResourceRow
									icon={<img src="/item_icon_00111.png" alt="Support Tickets" className="w-8 h-8 object-contain" />}
									label="Support Tickets"
									value={userStatsData.support_ticket}
									onChange={(v) => setUserStatsData({ ...userStatsData, support_ticket: v })}
								/>
								<ResourceRow
									icon={<img src="/item_icon_00150.png" alt="SR Shards" className="w-8 h-8 object-contain" />}
									label="SR Shards"
									value={userStatsData.sr_shards}
									onChange={(v) => setUserStatsData({ ...userStatsData, sr_shards: v })}
								/>
							</div>
						</div>
					</div>

					{/* ── Bottom row: Average Monthly Income + Uncap Crystals ── */}
					<div className="grid grid-cols-1 border-t border-gray-700 @3xl:grid-cols-2 @income-wide:grid-cols-[2fr_1fr]">
						<div className="p-3 @income-wide:p-5 flex flex-col">
							<h3 className="font-display font-semibold text-sm text-gray-200 mb-2 flex items-center justify-center gap-1.5 @income-wide:mb-3">
								<TrendingUp className={iconCls} />
								Average Monthly Income
							</h3>
							{/* Five stacked tiles cost ~395px on a phone — the panel's second
							    worst block — for five numbers. Compact, each one is a row (label
							    left, figure right) at ~34px; from `@income-wide:` all five sit
							    across. Same markup either way: the tile is a flex box that runs
							    across when it's a row and down when it's a tile.

							    Rows, not tiles, in the 2-column middle layout too (@3xl up to
							    @income-wide): five tiles across a half-width column would be
							    about 100px each. The old 2-column step keyed to 640 to 1280px
							    of VIEWPORT is gone; the middle layout is keyed to the panel. */}
							{/* The figures roll to their new value when an input changes
							    (NumberFlow). No `locales` / `format`, on purpose: NumberFlow
							    then formats with the browser's default Intl.NumberFormat,
							    which is what `toLocaleString()` printed here before, so
							    separators are unchanged. It honours "reduce motion" by
							    default (respectMotionPreference) and snaps instead, and it
							    never animates on first paint, only on a change. No
							    NumberFlowGroup: each figure sits in its own grid cell, so one
							    growing a digit never moves another, which is the only thing
							    a group coordinates. */}
							<div className="mx-auto w-full max-w-[34rem] flex-1 grid grid-cols-1 overflow-hidden rounded-lg border border-gray-700 @income-wide:max-w-none @income-wide:grid-cols-5">
								{monthlyItems.map((item) => (
									<div
										key={item.label}
										className="flex items-center justify-between gap-2 border-b border-gray-700 bg-gray-900 px-3 py-1.5 last:border-b-0 @income-wide:flex-col @income-wide:justify-center @income-wide:gap-1 @income-wide:p-3 @income-wide:border-b-0 @income-wide:border-r @income-wide:last:border-r-0"
									>
										<span className="min-w-0 text-xs text-gray-400 leading-tight @income-wide:text-center">{item.label}</span>
										<div className="flex shrink-0 items-center gap-1.5 @income-wide:w-full @income-wide:justify-center">
											<span className="text-brand">{item.icon}</span>
											<NumberFlow value={item.value} className="text-lg font-bold text-gray-100 @income-wide:text-2xl" />
										</div>
									</div>
								))}
							</div>
						</div>

						<div className="border-t border-gray-700 @3xl:border-t-0 @3xl:border-l">
							<UncapCrystalsPanel />
						</div>
					</div>
				</div>
			</motion.div>
		</div>
	)
}
