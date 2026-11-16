import { useId } from "react"
import { ChevronDown } from "lucide-react"
import type { RateUpCard } from "../../utils/rateUpRates"
import { formatRate, type OddsTarget } from "../../utils/oddsDisplay"

/**
 * The two pieces of the "which card are these odds for" control, shown only on
 * a banner with more than one rate-up card:
 *
 *   - OddsCaption: the line at the top of the odds strip. It names the card the
 *     strip is about, and doubles as the button that opens the panel, so the
 *     control costs no space of its own in the fixed-height table row.
 *   - OddsCardsPanel: the strip under the row (a band of the card on phones)
 *     where the player picks that card, ticks a second one for two-card
 *     odds, and chooses how far the first card is taken (one copy up to
 *     MLB). Every control is always rendered, the second-card ones greyed
 *     out until the box is ticked, so nothing moves when it is. Laid out like
 *     the note editor, for the same reason: the table row keeps its height
 *     and its columns.
 *
 * Both are plain view code. The choices they report are saved on the planned
 * row (`primary_card` / `second_card` / `primary_target`), resolved by
 * `oddsCards()` in utils/rateUpRates and `oddsTarget()` in utils/oddsDisplay,
 * and turned into numbers by the row.
 */

interface OddsCaptionProps {
	primary: RateUpCard
	second: RateUpCard | null
	/**
	 * The cell the first card is taken to on a two-card row, "MLB" for a
	 * support or "1x" for an uma (oddsTarget), so the caption matches the strip.
	 */
	targetLabel: string
	open: boolean
	onToggle: () => void
}

export const OddsCaption = ({
	primary,
	second,
	targetLabel,
	open,
	onToggle,
}: OddsCaptionProps) => {
	const text = second
		? `${primary.name} ${targetLabel} + ${second.name}`
		: `Odds for ${primary.name}`
	const title = second
		? `Chance of ${primary.name} at ${targetLabel} and ${second.name} at each level. The boxes add up to ${primary.name}'s ${targetLabel} chance.`
		: "Pick which card these odds are for, or add a second card"

	return (
		<button
			type="button"
			onClick={onToggle}
			aria-expanded={open}
			title={title}
			// leading-3 keeps the line at 12px: the strip, this caption and the
			// table cell's padding have to fit the row's fixed 64px.
			//
			// The band is a shade lighter than the cells below it (the strip's
			// border colour), so the caption reads as a header over the six
			// cells rather than a seventh one; hover steps up one more shade.
			className="flex w-full min-w-0 cursor-pointer items-center justify-center gap-1 px-1 text-[10px] leading-3 text-gray-100 bg-gray-600 transition hover:bg-gray-500"
		>
			<span className="truncate">{text}</span>
			<ChevronDown
				aria-hidden="true"
				className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
			/>
		</button>
	)
}

interface OddsCardsPanelProps {
	cards: RateUpCard[]
	primary: RateUpCard
	second: RateUpCard | null
	/** The first card's target on a two-card row, and the two the toggle offers. */
	target: OddsTarget
	targetChoices: OddsTarget[]
	onPrimaryChange: (id: number) => void
	/** A card id to turn two-card odds on with, or null to turn them off. */
	onSecondChange: (id: number | null) => void
	/** Copies to take the first card to: one of `targetChoices`. */
	onTargetChange: (copies: number) => void
	/**
	 * "inline" is the phone card's sentence row ("Odds for 1x [card]  Also
	 * show [card]"). "stacked" is the desktop drawer's Odds column: a labelled
	 * form whose controls match the row options' 36px fields.
	 */
	layout?: "inline" | "stacked"
	className?: string
}

/** "once", "2 times", ... : the target as a count, the same on both banner types. */
const timesWord = (copies: number): string => (copies === 1 ? "once" : `${copies} times`)

const selectClass =
	"min-w-0 max-w-full rounded-md border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-gray-100 focus:border-gray-400 focus:outline-none disabled:opacity-50"

export const OddsCardsPanel = ({
	cards,
	primary,
	second,
	target,
	targetChoices,
	onPrimaryChange,
	onSecondChange,
	onTargetChange,
	layout = "inline",
	className = "",
}: OddsCardsPanelProps) => {
	const others = cards.filter((card) => card.id !== primary.id)
	// What ticking the box turns on: the card already chosen, or the first
	// other one. The select shows it greyed out until then, so the player can
	// see what the box will add.
	const secondChoice = second ?? others[0]
	const primarySelectId = useId()

	const option = (card: RateUpCard) => (
		<option key={card.id} value={card.id}>
			{card.name} ({formatRate(card.rate)})
		</option>
	)

	const LABEL = "text-[11px] font-semibold uppercase tracking-wide text-gray-400"
	const tallSelect =
		"h-9 min-w-0 w-full rounded-md border border-gray-600 bg-gray-900 px-2 text-sm text-gray-100 focus:border-gray-400 focus:outline-none disabled:opacity-50"
	const targetGroup = (tall: boolean) => (
		<div
			role="radiogroup"
			aria-label="First card target"
			aria-disabled={second === null}
			className={`flex w-max shrink-0 overflow-hidden rounded-md border border-gray-600 ${second === null ? "opacity-50" : ""}`}
		>
			{targetChoices.map((choice) => {
				const chosen = choice.copies === target.copies
				return (
					<button
						key={choice.copies}
						type="button"
						role="radio"
						aria-checked={chosen}
						disabled={second === null}
						title={second ? `Take ${primary.name} to ${choice.label} first` : undefined}
						onClick={() => onTargetChange(choice.copies)}
						className={`${tall ? "h-9 px-2.5 text-sm" : "px-2 py-1 text-xs"} transition ${
							chosen ? "bg-brand/20 font-semibold text-brand" : "bg-gray-900 text-gray-300 enabled:hover:bg-gray-700"
						}`}
					>
						{choice.label}
					</button>
				)
			})}
		</div>
	)
	const alsoShow = (
		<label className={`flex shrink-0 cursor-pointer items-center gap-1.5 ${LABEL}`}>
			<input
				type="checkbox"
				checked={second !== null}
				onChange={(event) => onSecondChange(event.target.checked ? secondChoice.id : null)}
				className="h-3.5 w-3.5 shrink-0 accent-[var(--color-brand)]"
			/>
			<span>Also show</span>
		</label>
	)
	const secondSelect = (
		<select
			value={secondChoice.id}
			disabled={second === null}
			aria-label="Second card"
			onChange={(event) => onSecondChange(Number(event.target.value))}
			className={tallSelect}
		>
			{others.map(option)}
		</select>
	)
	// Two lines reserved either way, so ticking "Also show" never changes the drawer's height.
	const helper = (
		<p className="min-h-[2lh] text-[11px] leading-snug text-gray-400">
			{second
				? `Each box shows the chance of getting ${primary.name} ${timesWord(target.copies)} and ${second.name} at the indicated level.`
				: `Each box is the chance of getting ${primary.name} at the indicated level.`}
		</p>
	)

	if (layout === "stacked") {
		return (
			<div className={`grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-4 gap-y-2.5 ${className}`}>
				{/* Under the column's "Odds" heading the row says "Card"; the select keeps "Odds for" as its name. */}
				<label htmlFor={primarySelectId} className={`cursor-pointer ${LABEL}`}>Card</label>
				<select id={primarySelectId} aria-label="Odds for" value={primary.id} onChange={(event) => onPrimaryChange(Number(event.target.value))} className={tallSelect}>
					{cards.map(option)}
				</select>
				{alsoShow}
				{secondSelect}
				<span className={LABEL}>First card to</span>
				{targetGroup(true)}
				<div className="col-span-2">{helper}</div>
			</div>
		)
	}

	return (
		<div className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-300 ${className}`}>
			{/*
			  "Odds for [target] [card]": the copies the player is after
			  (1x..5x on an uma banner, 0LB..MLB on a support) sit between the
			  words and the card, so the pick reads as one phrase.

			  The words are a <label htmlFor> instead of a wrapping <label>: a
			  wrapping label names its FIRST labelable descendant, and the
			  target's buttons now come before the select, so wrapping would
			  hand "Odds for" to a button. useId because the panel renders
			  twice (table row and phone card), and each copy needs its own id.
			*/}
			<div className="flex min-w-0 items-center gap-1.5">
				<label htmlFor={primarySelectId} className="shrink-0 cursor-pointer">
					Odds for
				</label>

				{/*
				  How far the first card is taken. Always rendered, greyed out
				  until a second card is on (like the second select), so ticking
				  the box changes nothing's position. On its own the strip shows
				  every level and has no target.
				*/}
				<div
					role="radiogroup"
					aria-label="First card target"
					aria-disabled={second === null}
					className={`flex shrink-0 overflow-hidden rounded-md border border-gray-600 ${
						second === null ? "opacity-50" : ""
					}`}
				>
					{targetChoices.map((choice) => {
						const chosen = choice.copies === target.copies
						return (
							<button
								key={choice.copies}
								type="button"
								role="radio"
								aria-checked={chosen}
								disabled={second === null}
								title={second ? `Take ${primary.name} to ${choice.label} first` : undefined}
								onClick={() => onTargetChange(choice.copies)}
								className={`px-2 py-1 text-xs transition ${
									chosen
										? "bg-brand/20 font-semibold text-brand"
										: "bg-gray-900 text-gray-300 enabled:hover:bg-gray-700"
								}`}
							>
								{choice.label}
							</button>
						)
					})}
				</div>

				<select
					id={primarySelectId}
					value={primary.id}
					onChange={(event) => onPrimaryChange(Number(event.target.value))}
					className={selectClass}
				>
					{cards.map(option)}
				</select>
			</div>

			<div className="flex min-w-0 items-center gap-1.5">
				<label className="flex shrink-0 cursor-pointer items-center gap-1.5">
					<input
						type="checkbox"
						checked={second !== null}
						onChange={(event) =>
							onSecondChange(event.target.checked ? secondChoice.id : null)
						}
						className="h-4 w-4 shrink-0 accent-[var(--color-brand)]"
					/>
					<span>Also show</span>
				</label>
				<select
					value={secondChoice.id}
					disabled={second === null}
					aria-label="Second card"
					onChange={(event) => onSecondChange(Number(event.target.value))}
					className={selectClass}
				>
					{others.map(option)}
				</select>
			</div>

			{/*
			  What the boxes mean in the current state, one line either way so
			  the panel keeps its height. The one-card line says what the strip
			  always said; the two-card line is the joint reading.
			*/}
			<p className="w-full text-[11px] leading-snug text-gray-400">
				{second
					? `Each box shows the chance of getting ${primary.name} ${timesWord(target.copies)} and ${second.name} at the indicated level.`
					: `Each box is the chance of getting ${primary.name} at the indicated level.`}
			</p>
		</div>
	)
}
