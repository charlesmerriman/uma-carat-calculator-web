/**
 * An event's or banner's status as a small pill (mocks 07-pull.png,
 * 09-pvp.png): running now, upcoming, ended, or on predicted dates. The
 * colours are the `--color-status-*` tokens in index.css, redrawn for the
 * light themes; the word is always there, so the colour is never alone.
 */

export type Status = "running" | "upcoming" | "ended" | "predicted"

const LOOK: Record<Status, { label: string; className: string }> = {
	running: { label: "Running", className: "bg-status-running/15 text-status-running" },
	upcoming: { label: "Upcoming", className: "bg-status-upcoming/15 text-status-upcoming" },
	ended: { label: "Ended", className: "bg-gray-700 text-status-ended" },
	predicted: { label: "Predicted", className: "bg-status-predicted/15 text-status-predicted" },
}

export function StatusPill({ status }: { status: Status }) {
	const look = LOOK[status]
	return (
		<span className={`inline-block shrink-0 rounded-full px-1.5 py-[3px] text-[10px] font-semibold leading-none ${look.className}`}>
			{look.label}
		</span>
	)
}
