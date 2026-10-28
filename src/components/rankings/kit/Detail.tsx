/**
 * An opened row's breakdown (mocks 04-guides-row-open.png,
 * 10-pvp-row-open.png): blocks side by side as the row's width allows, each
 * a small uppercase heading over its drawing.
 */

import type { ReactNode } from "react"

export function Detail({ children }: { children: ReactNode }) {
	return <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-x-[18px] gap-y-2.5">{children}</div>
}

export function DetailBlock({ heading, children }: { heading: string; children: ReactNode }) {
	return (
		<div className="flex min-w-0 flex-col gap-1.5">
			<span className="text-[10px] uppercase tracking-wider text-gray-400">{heading}</span>
			{children}
		</div>
	)
}
