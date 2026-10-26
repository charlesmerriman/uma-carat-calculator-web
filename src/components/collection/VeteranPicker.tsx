/**
 * "Which veteran is she?": a button under a My team member or a CM Runs
 * runner that opens a picker of the player's veterans of ONE outfit (owner,
 * 2026-10-26: a picker, not a dropdown). Each choice is a card with her
 * portrait, stats, best aptitudes, skills, memo and when she was trained, so
 * two Oguri Caps can be told apart. Drawn only when there is a veteran of that
 * uma to pick (or one is linked): a member with none looks as it always did.
 *
 * An overlay like PvpCardPicker (portal, Escape and a click outside close it),
 * not a native <dialog>: it opens from inside pages that already hold one.
 * Veterans are added and edited on the Collection page, only picked here.
 */

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Check, X } from "lucide-react"
import { FramedUma } from "../FramedUma"
import { formatDate } from "../../utils/dateFormat"
import { aptitudeSummary, statLine, veteransOf } from "../../utils/trainedUmas"
import type { CatalogueUma } from "../../types/pvpTeam"
import type { TrainedUma } from "../../types/trainedUma"

export function VeteranPicker({ uma, value, veterans, oshi, onChange }: {
	uma: Pick<CatalogueUma, "id" | "name" | "portrait" | "image"> | undefined
	/** The linked veteran's id, or null. */
	value: number | null | undefined
	veterans: TrainedUma[]
	/** Draws the rainbow frame (one of the player's favorites). */
	oshi: boolean
	onChange: (trainedUma: number | null) => void
}) {
	const [open, setOpen] = useState(false)
	const options = uma ? veteransOf(veterans, uma.id) : []
	if (!uma || (options.length === 0 && !value)) return null
	const linked = options.find((veteran) => veteran.id === value)
	return (
		<>
			<button
				type="button"
				aria-label={`Veteran for ${uma.name}: ${linked ? veteranName(linked, uma) : "none"}`}
				onClick={() => setOpen(true)}
				className="mt-1 w-full max-w-full truncate rounded-md border border-gray-600 bg-gray-900 px-1.5 py-0.5 text-left text-[11px] text-gray-200 transition hover:border-brand hover:text-brand"
			>
				{linked ? `${linked.label ? `${linked.label} · ` : ""}${statLine(linked)}` : "Pick a veteran"}
			</button>
			{open && (
				<PickerOverlay
					uma={uma}
					options={options}
					value={value ?? null}
					oshi={oshi}
					onPick={(trainedUma) => {
						setOpen(false)
						if (trainedUma !== (value ?? null)) onChange(trainedUma)
					}}
					onClose={() => setOpen(false)}
				/>
			)}
		</>
	)
}

/** Her label, else the uma's name. */
function veteranName(veteran: TrainedUma, uma: Pick<CatalogueUma, "name">): string {
	return veteran.label || uma.name
}

function PickerOverlay({ uma, options, value, oshi, onPick, onClose }: {
	uma: Pick<CatalogueUma, "name" | "portrait" | "image">
	options: TrainedUma[]
	value: number | null
	oshi: boolean
	onPick: (trainedUma: number | null) => void
	onClose: () => void
}) {
	useEffect(() => {
		const closeOnEscape = (keydown: KeyboardEvent) => {
			if (keydown.key === "Escape") onClose()
		}
		window.addEventListener("keydown", closeOnEscape)
		return () => window.removeEventListener("keydown", closeOnEscape)
	}, [onClose])

	const choice = (selected: boolean) =>
		`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition ${
			selected ? "border-brand bg-brand/10" : "border-gray-600 bg-gray-700/40 hover:border-gray-500 hover:bg-gray-700"
		}`

	return createPortal(
		<div
			className="fixed inset-0 z-[10000] flex items-center justify-center bg-gray-950/75 p-4"
			onMouseDown={(mouse) => {
				if (mouse.target === mouse.currentTarget) onClose()
			}}
		>
			<section
				role="dialog"
				aria-modal="true"
				aria-label={`Which ${uma.name} is she?`}
				className="flex max-h-[min(40rem,calc(100vh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-edge bg-gray-800 shadow-2xl"
			>
				<header className="flex items-center gap-3 border-b border-gray-700 px-4 py-3">
					<h2 className="min-w-0 flex-1 truncate text-base font-semibold text-gray-100">Which {uma.name} is she?</h2>
					<button
						type="button"
						aria-label="Close"
						onClick={onClose}
						className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-600 text-gray-300 hover:bg-gray-700"
					>
						<X className="h-4 w-4" />
					</button>
				</header>
				<ul className="flex min-h-0 flex-col gap-2 overflow-y-auto p-3">
					{options.map((veteran) => {
						const strong = aptitudeSummary(veteran.apt)
						return (
							<li key={veteran.id}>
								<button type="button" aria-pressed={veteran.id === value} onClick={() => onPick(veteran.id)} className={choice(veteran.id === value)}>
									<FramedUma src={uma.portrait ?? uma.image} oshi={oshi} alt="" className="w-12 shrink-0" />
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm font-semibold text-gray-100">
											{veteranName(veteran, uma)}
											{veteran.is_borrowed && <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">Borrowed</span>}
										</span>
										<span className="block text-xs text-gray-300">{statLine(veteran)}</span>
										<span className="block text-xs text-gray-400">
											{[strong, `${veteran.skills.length} ${veteran.skills.length === 1 ? "skill" : "skills"}`, veteran.trained_at && `trained ${formatDate(veteran.trained_at)}`]
												.filter(Boolean)
												.join(" · ")}
										</span>
										{veteran.memo && <span className="block text-xs italic text-gray-400">“{veteran.memo}”</span>}
									</span>
									{veteran.id === value && <Check className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />}
								</button>
							</li>
						)
					})}
					<li>
						<button type="button" aria-pressed={value === null} onClick={() => onPick(null)} className={choice(value === null)}>
							<span className="flex-1 text-sm text-gray-300">No veteran</span>
							{value === null && <Check className="h-4 w-4 text-brand" aria-hidden="true" />}
						</button>
					</li>
				</ul>
			</section>
		</div>,
		document.body
	)
}
