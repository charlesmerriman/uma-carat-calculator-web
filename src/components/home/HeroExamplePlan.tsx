/**
 * The home hero's right-hand panel: three planner rows, drawn the way the
 * calculator draws them, so a first-time visitor sees what the tool gives back
 * before they type anything (design polish item 17).
 *
 * An EXAMPLE, labelled as one, with fixed numbers. Live figures were the other
 * option and were turned down: the home page is prerendered and only PREFETCHES
 * /calculator-data for the calculator's sake (a response body can be read once,
 * and the provider reads it), so live numbers would have meant a second parse
 * of a ~1 MB payload and figures popping in after the page had painted.
 *
 * Colours come from the same tokens as the real rows (`--color-type-*` for the
 * kind, `--color-pull-ok` / `--color-pull-over` for the pity signal), so every
 * theme, colorblind mode included, draws it the way it draws the planner.
 * Render-time code here touches no browser API: the page is prerendered.
 */

type ExampleRow = {
	kind: "uma" | "support"
	title: string
	ends: string
	pulls: number
}

// Pity is 200 pulls. A copy for the example, not the engine's constant: the
// numbers below are illustrations, and nothing is calculated from them.
const PITY = 200

const ROWS: ExampleRow[] = [
	{ kind: "uma", title: "Next uma banner", ends: "Ends in 9 days", pulls: 212 },
	{ kind: "support", title: "Support banner", ends: "Ends in 3 weeks", pulls: 164 },
	{ kind: "uma", title: "Anniversary banner", ends: "Ends in 4 months", pulls: 238 },
]

const KIND_CLASSES: Record<ExampleRow["kind"], { label: string; chip: string }> = {
	uma: { label: "Uma", chip: "bg-type-uma text-type-uma-ink" },
	support: { label: "Support", chip: "bg-type-support text-type-support-ink" },
}

export function HeroExamplePlan({ className = "" }: { className?: string }) {
	return (
		<figure
			className={`rounded-xl border border-edge bg-gray-900/55 p-4 ${className}`}
			aria-label="An example plan: three banners and how many pulls you would have when each one ends."
		>
			<figcaption className="flex items-baseline justify-between gap-3">
				<span className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Example plan</span>
				<span className="text-xs text-gray-500">Pulls you'll have by each end date</span>
			</figcaption>
			<ul className="mt-3 flex flex-col gap-2" aria-hidden="true">
				{ROWS.map((row) => {
					const covered = row.pulls >= PITY
					const kind = KIND_CLASSES[row.kind]
					return (
						<li key={row.title} className="rounded-lg border border-edge bg-gray-800 px-3 py-2.5">
							<div className="flex items-center gap-2.5">
								<span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${kind.chip}`}>
									{kind.label}
								</span>
								<span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-100">{row.title}</span>
								<span className="text-sm font-bold text-gray-100 tabular-nums">{row.pulls}</span>
								<span className="text-xs text-gray-500">pulls</span>
							</div>
							{/* The bar reads against pity: full at 200, the way the
							    planner's pull field turns green at 200. */}
							<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-700">
								<div
									className={`h-full rounded-full ${covered ? "bg-pull-ok-border" : "bg-pull-over-border"}`}
									style={{ width: `${Math.min(100, (row.pulls / PITY) * 100)}%` }}
								/>
							</div>
							<div className="mt-1.5 flex justify-between text-xs">
								<span className="text-gray-400">{row.ends}</span>
								<span className={covered ? "text-pull-ok" : "text-pull-over"}>
									{covered ? "Pity covered" : `${PITY - row.pulls} short of pity`}
								</span>
							</div>
						</li>
					)
				})}
			</ul>
		</figure>
	)
}
