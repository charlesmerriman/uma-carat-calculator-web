/**
 * The segmented control that picks what one list shows (mock 03-guides.png:
 * Overall, Speed, ... Umas, each with its count). One list with a lens in
 * place of a table per type: the counting runs once and the lens slices it.
 * Also the Events window's All / Next 3 / 5 / 10 inside its menu. Scrolls
 * sideways when it doesn't fit (phones, the pinned window); never wraps.
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
			<div role="tablist" aria-label={label} className="inline-flex gap-0.5 rounded-[9px] border border-edge bg-gray-900/70 p-0.5">
				{options.map((option) => {
					const on = option.id === value
					return (
						<button
							key={option.id}
							type="button"
							role="tab"
							aria-selected={on}
							onClick={() => onChange(option.id)}
							className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[7px] px-2.5 py-[5px] text-xs font-medium transition ${
								on ? "bg-gray-700 text-brand shadow-sm" : "text-gray-400 hover:text-gray-100"
							}`}
						>
							{option.label}
							{option.count !== undefined && <span className="text-[10px] tabular-nums text-gray-400">{option.count}</span>}
						</button>
					)
				})}
			</div>
		</div>
	)
}
