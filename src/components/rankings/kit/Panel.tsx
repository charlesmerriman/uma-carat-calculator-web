/**
 * A titled panel on a Rankings tab (mocks 07 to 11): the title in brand, a
 * short muted hint beside it, and the content. Its accessible name is the
 * title. RankedList draws the same head for a list.
 */

import type { ReactNode } from "react"

export function PanelHead({ title, hint }: { title: string; hint?: ReactNode }) {
	return (
		<div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-1">
			<h2 className="font-display text-[15px] font-bold text-brand">{title}</h2>
			{hint && <p className="text-[11px] text-gray-400">{hint}</p>}
		</div>
	)
}

export function Panel({ title, hint, children, className = "" }: { title: string; hint?: ReactNode; children: ReactNode; className?: string }) {
	return (
		<section aria-label={title} className={`card-panel flex min-w-0 flex-col gap-2.5 p-3 ${className}`}>
			<PanelHead title={title} hint={hint} />
			{children}
		</section>
	)
}
