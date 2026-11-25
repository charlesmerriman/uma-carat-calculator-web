/**
 * Community plans' four filters (Henry's notes, decision 12): Range,
 * Strategy, Spending level, Sweat level. From `lg` up they are a column
 * beside the list, in the page's flow; below it the page shows a "Filters"
 * button that opens the same controls in a sheet (GalleryModal).
 *
 * Every label, and each spending level's meaning (written into its option,
 * spendingOptionLabel), comes from the feed's `filters` block, so nothing
 * here is hard-coded and a new level needs no client change. The values live in the page's address (CommunityPlansPage
 * reads and writes them); this only draws them.
 *
 * How each matches is the server's (plan_gallery.filtered): Spending and
 * Sweat, the post has that value; Strategy, the post has ANY ticked one;
 * Range, the post runs up to that scenario or an earlier one.
 */

import { useId } from "react"
import type { PlanFilterChoices, PlanFilters as Filters, PlanSpending, PlanStrategy, PlanSweat } from "../../types/gallery"
import { NO_PLAN_FILTERS } from "../../types/gallery"
import { filtersSet, spendingOptionLabel } from "../../utils/planFeedView"

const HEADING = "text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400"
const SELECT =
	"w-full rounded-lg border border-gray-600 bg-gray-900 px-2.5 py-2 text-sm text-gray-100 outline-none transition focus:border-brand"

export function PlanFilters({ choices, value, onChange }: {
	choices: PlanFilterChoices
	value: Filters
	onChange: (next: Filters) => void
}) {
	const ids = { range: useId(), spending: useId(), sweat: useId() }

	const toggleStrategy = (style: PlanStrategy, on: boolean) =>
		onChange({
			...value,
			// Kept in the API's order, so the address doesn't change with the
			// order the boxes were ticked in.
			strategies: choices.strategies
				.map((choice) => choice.value)
				.filter((candidate) => (candidate === style ? on : value.strategies.includes(candidate))),
		})

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-1.5">
				<label htmlFor={ids.range} className={HEADING}>
					Range
				</label>
				<select
					id={ids.range}
					value={value.range ?? ""}
					onChange={(e) => onChange({ ...value, range: e.target.value === "" ? null : Number(e.target.value) })}
					className={SELECT}
				>
					<option value="">Any</option>
					{choices.ranges.map((range) => (
						<option key={range.value} value={range.value}>
							Up to {range.label}
						</option>
					))}
				</select>
				<p className="text-xs text-gray-400">Plans that run up to a scenario.</p>
			</div>

			<fieldset className="flex flex-col gap-1.5">
				<legend className={`${HEADING} mb-1.5`}>Strategy</legend>
				<div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
					{choices.strategies.map((style) => (
						<label key={style.value} className="flex cursor-pointer items-center gap-2 text-sm text-gray-200">
							<input
								type="checkbox"
								checked={value.strategies.includes(style.value)}
								onChange={(e) => toggleStrategy(style.value, e.target.checked)}
								className="h-4 w-4 accent-brand"
							/>
							{style.label}
						</label>
					))}
				</div>
			</fieldset>

			<div className="flex flex-col gap-1.5">
				<label htmlFor={ids.spending} className={HEADING}>
					Spending level
				</label>
				{/* Each option says what its level means ("Minnow - Daily Carat
				    Pack only"), so it reads before anything is picked, on a phone
				    too, where an option's hover title never shows. */}
				<select
					id={ids.spending}
					value={value.spending ?? ""}
					onChange={(e) => onChange({ ...value, spending: (e.target.value || null) as PlanSpending | null })}
					className={SELECT}
				>
					<option value="">Any</option>
					{choices.spending.map((level) => (
						<option key={level.value} value={level.value}>
							{spendingOptionLabel(level)}
						</option>
					))}
				</select>
			</div>

			<div className="flex flex-col gap-1.5">
				<label htmlFor={ids.sweat} className={HEADING}>
					Sweat level
				</label>
				<select
					id={ids.sweat}
					value={value.sweat ?? ""}
					onChange={(e) => onChange({ ...value, sweat: (e.target.value || null) as PlanSweat | null })}
					className={SELECT}
				>
					<option value="">Any</option>
					{choices.sweat.map((level) => (
						<option key={level.value} value={level.value}>
							{level.label}
						</option>
					))}
				</select>
			</div>

			{filtersSet(value) > 0 && (
				<button
					type="button"
					onClick={() => onChange(NO_PLAN_FILTERS)}
					className="self-start text-sm font-medium text-brand transition hover:text-brand/75"
				>
					Clear filters
				</button>
			)}
		</div>
	)
}
