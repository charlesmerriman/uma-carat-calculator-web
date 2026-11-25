/**
 * The segmented control that picks what one list shows (mock 03-guides.png:
 * Overall, Speed, ... Umas, each with its count). One list with a lens in
 * place of a table per type: the counting runs once and the lens slices it.
 * Also the Events window's All / Next 3 / 5 / 10 inside its menu. Scrolls
 * sideways when it doesn't fit (phones, the pinned window); never wraps.
 *
 * The look is the Encyclopedia's star switch (`.enc-switch`): a pill track,
 * the picked option filled in the page's ink (notes/rankings-polish-plan.md).
 */

export interface LensOption<T extends string | number> {
	id: T
	label: string
	count?: number
}

export function Lens<T extends string | number>({ options, value, onChange, label, className = "" }: {
	options: LensOption<T>[]
	value: T
	onChange: (value: T) => void
	label: string
	className?: string
}) {
	return (
		<div className={`max-w-full overflow-x-auto [scrollbar-width:none] ${className}`}>
			<div role="tablist" aria-label={label} className="inline-flex rounded-full bg-(--card-fill) p-[3px] shadow-(--card-shadow)">
				{options.map((option) => {
					const on = option.id === value
					return (
						<button
							key={option.id}
							type="button"
							role="tab"
							aria-selected={on}
							onClick={() => onChange(option.id)}
							className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold transition ${
								on ? "bg-(--c1-ink) text-gray-900" : "text-gray-400 hover:text-gray-100"
							}`}
						>
							{option.label}
							{option.count !== undefined && <span className="text-xs font-semibold tabular-nums">{option.count}</span>}
						</button>
					)
				})}
			</div>
		</div>
	)
}
