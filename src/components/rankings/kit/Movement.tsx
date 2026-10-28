/**
 * A row's rank movement over the week (mock 02-kit-row.png): "▲2", "▼1" or
 * "new", beside the name. Step 5 of notes/rankings-redesign-plan.md feeds
 * it from the server's week-old snapshot; until then nothing passes one and
 * the slot stays empty. Reuses the status tokens: up = running green, down =
 * predicted orange, new = upcoming blue. Zero draws nothing.
 */

export type MovementValue = number | "new"

export function Movement({ value }: { value: MovementValue | null | undefined }) {
	if (value === null || value === undefined || value === 0) return null
	const chip = "shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold leading-none tabular-nums"
	if (value === "new") {
		return <span className={`${chip} bg-status-upcoming/15 text-status-upcoming`}>new</span>
	}
	const up = value > 0
	return (
		<span
			className={`${chip} ${up ? "bg-status-running/15 text-status-running" : "bg-status-predicted/15 text-status-predicted"}`}
			title={`${up ? "Up" : "Down"} ${Math.abs(value)} this week`}
		>
			<span aria-hidden="true">{up ? "▲" : "▼"}</span>
			<span className="sr-only">{up ? "up " : "down "}</span>
			{Math.abs(value)}
		</span>
	)
}
