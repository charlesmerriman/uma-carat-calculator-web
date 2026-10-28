/**
 * The band every Rankings tab opens with (mock 03-guides.png, top): a lead
 * (a heading and one sentence) and up to three figures. Four columns from
 * 47.5rem (760 px) of container; under it the lead runs across and the
 * figures sit three abreast (the mock's two left a lonely third on phones).
 */

import type { ReactNode } from "react"

export interface StatFigure {
	label: string
	value: ReactNode
	/** Small, after the value: "carats", "/ 51". */
	suffix?: string
}

export function StatBand({ title, children, stats }: { title: string; children: ReactNode; stats: StatFigure[] }) {
	return (
		<section aria-label={title} className="grid grid-cols-3 gap-2 @min-[47.5rem]:gap-2.5 @min-[47.5rem]:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
			<div className="col-span-3 flex flex-col justify-center gap-1 pr-2 @min-[47.5rem]:col-span-1">
				<h2 className="font-display text-[17px] font-bold text-balance text-gray-100">{title}</h2>
				<p className="text-xs text-gray-400">{children}</p>
			</div>
			{stats.map((stat) => (
				<div key={stat.label} className="flex min-w-0 flex-col gap-0.5 rounded-[10px] border border-edge bg-gray-800 px-2.5 py-2 @min-[47.5rem]:px-3 @min-[47.5rem]:py-2.5">
					<b className="font-display text-[22px] font-bold leading-tight tabular-nums text-gray-100">
						{stat.value}
						{/* Under the figure on a narrow band, beside it from 47.5rem. */}
						{stat.suffix && <small className="block text-[11px] font-medium text-gray-400 @min-[47.5rem]:ml-1 @min-[47.5rem]:inline @min-[47.5rem]:text-xs">{stat.suffix}</small>}
					</b>
					<span className="text-[10px] uppercase tracking-wider text-gray-400 @min-[47.5rem]:text-[11px]">{stat.label}</span>
				</div>
			))}
		</section>
	)
}
