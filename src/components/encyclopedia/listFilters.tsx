/**
 * The search box and filter chips the uma and card lists share. The Skills
 * page has its own (SkillsPage), older and wider; PR 6 gives it this strip.
 */

import { Search } from "lucide-react"

export function SearchBox({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
	return (
		<div className="relative w-full sm:w-80">
			<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
			<input
				type="search"
				aria-label={label}
				placeholder={`${label}...`}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="w-full rounded-lg border border-gray-600 bg-gray-800 py-2 pl-9 pr-3 text-sm text-gray-100 placeholder-gray-500 focus:border-brand focus:outline-none"
			/>
		</div>
	)
}

export function Chips<T extends string>({ label, options, value, onChange }: {
	label: string
	options: { value: T; label: string }[]
	value: T
	onChange: (value: T) => void
}) {
	return (
		<div role="group" aria-label={label} className="flex flex-wrap gap-1">
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					aria-pressed={value === option.value}
					onClick={() => onChange(option.value)}
					className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
						value === option.value
							? "border-brand bg-brand/15 text-gray-100"
							: "border-gray-600 text-gray-300 hover:border-gray-500"
					}`}
				>
					{option.label}
				</button>
			))}
		</div>
	)
}
