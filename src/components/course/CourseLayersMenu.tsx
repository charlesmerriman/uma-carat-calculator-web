/**
 * The course map's Layers menu (owner, 2026-11-02, "The layer menu"): a
 * dropdown of checkboxes on the Course map block's bar, every layer off by
 * default, the ticks remembered on the device (services/courseMapStore.ts).
 * Every later layer that passes its gate (notes/course-map-later.md) joins
 * this menu; nothing else adds a toggle to the block.
 *
 * Today one layer, "My veterans' skills": the team's linked veterans' skills
 * that fire at a place in this race, all of them or only the guide's.
 */
import { useEffect, useId, useRef, useState } from "react"
import { Layers } from "lucide-react"
import { setCourseLayers, useCourseLayers } from "../../services/courseMapStore"

export default function CourseLayersMenu({ signedIn, veteransNote }: {
	signedIn: boolean
	/** Why the veterans layer draws nothing, when it doesn't ("Link a veteran..."). */
	veteransNote: string | null
}) {
	const [open, setOpen] = useState(false)
	const layers = useCourseLayers()
	const panelId = useId()
	const root = useRef<HTMLDivElement>(null)

	// A click outside or Escape closes it.
	useEffect(() => {
		if (!open) return
		const close = (event: MouseEvent | KeyboardEvent) => {
			if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) setOpen(false)
		}
		document.addEventListener("mousedown", close)
		document.addEventListener("keydown", close)
		return () => {
			document.removeEventListener("mousedown", close)
			document.removeEventListener("keydown", close)
		}
	}, [open])

	return (
		<div ref={root} className="relative">
			<button
				type="button"
				onClick={() => setOpen((was) => !was)}
				aria-expanded={open}
				aria-controls={panelId}
				className="flex items-center gap-1.5 rounded-lg border border-gray-600 px-2.5 py-1 text-xs font-semibold text-gray-200 transition hover:bg-gray-700/60"
			>
				<Layers className="h-3.5 w-3.5" aria-hidden="true" />
				Layers
			</button>
			{open && (
				<div id={panelId} className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-gray-700 bg-gray-800 p-3 text-sm shadow-lg">
					<label className={`flex items-start gap-2 ${signedIn ? "" : "opacity-60"}`}>
						<input
							type="checkbox"
							className="mt-0.5"
							checked={signedIn && layers.veterans}
							disabled={!signedIn}
							onChange={(event) => setCourseLayers({ veterans: event.target.checked })}
						/>
						<span>
							<span className="font-semibold text-gray-100">My veterans' skills</span>
							<span className="block text-xs text-gray-400">
								{signedIn
									? "Your team's veterans' skills that fire at a place in this race."
									: "Sign in to show your team's veterans."}
							</span>
						</span>
					</label>
					{signedIn && layers.veterans && (
						<div role="radiogroup" aria-label="Which skills" className="mt-2 space-y-1 pl-6 text-xs text-gray-200">
							<label className="flex items-center gap-2">
								<input type="radio" name={`${panelId}-scope`} checked={layers.scope === "all"} onChange={() => setCourseLayers({ scope: "all" })} />
								All that fire at a place
							</label>
							<label className="flex items-center gap-2">
								<input type="radio" name={`${panelId}-scope`} checked={layers.scope === "guide"} onChange={() => setCourseLayers({ scope: "guide" })} />
								Only the guide's
							</label>
							{veteransNote && <p className="pt-1 text-gray-400">{veteransNote}</p>}
						</div>
					)}
					{signedIn && layers.veterans && (
						// Off by default like every layer (owner, 2026-11-03: "toggleable
						// in the view"); it changes where the veterans' layer draws them.
						<label className="mt-3 flex items-start gap-2">
							<input
								type="checkbox"
								className="mt-0.5"
								checked={layers.chains}
								onChange={(event) => setCourseLayers({ chains: event.target.checked })}
							/>
							<span>
								<span className="font-semibold text-gray-100">Skills set off by other skills</span>
								<span className="block text-xs text-gray-400">
									Placed where her own skills set them off, like Christmas Oguri's unique after three heals.
								</span>
							</span>
						</label>
					)}
				</div>
			)}
		</div>
	)
}
