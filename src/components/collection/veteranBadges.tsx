/**
 * The small pieces a veteran tile and her card share: the grade hexagon and a
 * flag chip. What they show is utils/veteranLook.ts.
 */

import { gradeTier, type FlagTone } from "../../utils/veteranLook"

/** The game's grade letters on its hexagon. `className` sizes it; longer letters ("UG1") take a smaller size. */
export function GradeBadge({ grade, className }: { grade: string; className: string }) {
	return (
		<span className={`grade-badge ${className}`} data-tier={gradeTier(grade)}>
			{grade}
		</span>
	)
}

const FLAG_TONES: Record<FlagTone, string> = {
	plain: "border-gray-600 text-gray-300",
	borrowed: "border-[color:var(--color-spark-stat)] text-gray-200",
	missing: "border-highlight/60 text-highlight",
}

export function FlagChip({ tone, title, children, className = "" }: {
	tone: FlagTone
	title?: string
	children: string
	className?: string
}) {
	return (
		<span className={`rounded-full border px-2 py-px text-[11px] font-medium ${FLAG_TONES[tone]} ${className}`} title={title}>
			{children}
		</span>
	)
}
