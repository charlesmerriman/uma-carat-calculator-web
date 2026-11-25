/**
 * An opened row's breakdown (mock 01-kit-row-open.png): small blocks side by
 * side, each a heading over what it draws, wrapping to one column when narrow.
 * The blocks sit on ONE inset surface (the Encyclopedia's `--enc-inset`) with
 * the Encyclopedia's small caps headings (notes/rankings-polish-plan.md).
 */

import type { ReactNode } from "react"

export function Detail({ children }: { children: ReactNode }) {
	return (
		<div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-x-6 gap-y-4 rounded-[0.875rem] bg-(--enc-inset) p-4">
			{children}
		</div>
	)
}

export function DetailBlock({ heading, children }: { heading: string; children: ReactNode }) {
	return (
		<div className="flex min-w-0 flex-col gap-2">
			<span className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">{heading}</span>
			{children}
		</div>
	)
}
