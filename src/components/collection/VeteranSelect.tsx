/**
 * "Which veteran is she?": a dropdown of the player's veterans of ONE outfit,
 * for a My team member and a CM Runs runner. Drawn only when there is a
 * veteran of that uma to pick (or one is linked): a member with none says
 * nothing, so a team without veterans looks as it always did.
 *
 * The list is the Collection's (services/trainedUmaQueries.ts); veterans are
 * added and edited there, only picked here.
 */

import { STAT_KEYS, STAT_LABELS, veteranOptionLabel, veteransOf } from "../../utils/trainedUmas"
import type { TrainedUma } from "../../types/trainedUma"

export function VeteranSelect({ umaId, value, veterans, label, onChange }: {
	umaId: number
	/** The linked veteran's id, or null. */
	value: number | null | undefined
	veterans: TrainedUma[]
	/** For a screen reader: "Veteran for Oguri Cap". */
	label: string
	onChange: (trainedUma: number | null) => void
}) {
	const options = veteransOf(veterans, umaId)
	if (options.length === 0 && !value) return null
	const linked = options.find((veteran) => veteran.id === value)
	return (
		<select
			aria-label={label}
			title={linked ? STAT_KEYS.map((key) => `${STAT_LABELS[key]} ${linked[key]}`).join(", ") : "Pick which of your veterans this is"}
			className="mt-1 w-full max-w-full truncate rounded-md border border-gray-600 bg-gray-900 px-1.5 py-0.5 text-[11px] text-gray-200 outline-none transition hover:border-gray-500 focus-visible:border-brand"
			value={value ?? ""}
			onChange={(change) => onChange(change.target.value ? Number(change.target.value) : null)}
		>
			<option value="">No veteran</option>
			{options.map((veteran) => (
				<option key={veteran.id} value={veteran.id}>
					{veteranOptionLabel(veteran)}
				</option>
			))}
		</select>
	)
}
