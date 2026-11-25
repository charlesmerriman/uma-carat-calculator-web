/**
 * A titled panel on a Rankings tab: the Encyclopedia section's look
 * (notes/rankings-polish-plan.md): one soft surface with no border
 * (`rk-panel`), the heading flagged in the page's two colours
 * (`enc-section__title`), and a short hint, at the right when it fits and
 * under the heading when it wraps. Its accessible name is the title.
 * RankedList draws the same head for a list.
 */

import type { ReactNode } from "react"

/** The panel's surface and padding (no gap: each user sets its own): also RankedList's and the rail's. */
export const PANEL = "rk-panel flex min-w-0 flex-col px-4 py-4 @min-[40rem]:px-5 @min-[40rem]:pt-5 @min-[40rem]:pb-[1.1rem]"

export function PanelHead({ title, hint }: { title: string; hint?: ReactNode }) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-0.5">
			<h2 className="enc-section__title text-[1.3125rem]">{title}</h2>
			{hint && <p className="text-[13px] text-gray-400">{hint}</p>}
		</div>
	)
}

export function Panel({ title, hint, children, className = "" }: { title: string; hint?: ReactNode; children: ReactNode; className?: string }) {
	return (
		<section aria-label={title} className={`${PANEL} gap-[0.9rem] ${className}`}>
			<PanelHead title={title} hint={hint} />
			{children}
		</section>
	)
}
