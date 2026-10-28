/**
 * The filters on a phone (mock 18-phones.png, the middle phone): a "Filters
 * · N" button fixed at the bottom right (N = filters changed) that opens a
 * bottom sheet with every filter as tap cells, "Reset", and one button that
 * says what the filters leave ("Show 132 decks") and closes it. Hidden from
 * desktop-nav up, where the toolbar's pills show instead; both read the same
 * FilterGroups, so they never disagree.
 *
 * The sheet is the site's native <dialog> (GalleryModal.tsx has the why):
 * the top layer, the page inert behind it, Escape and the backdrop close it.
 * Only opened on a tap, so `document` is never touched at render.
 */

import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { SlidersHorizontal } from "lucide-react"
import type { FilterGroup } from "./FilterToolbar"

export function FilterSheet({ groups, lead, changed, result, onReset }: {
	groups: FilterGroup[]
	/** Drawn first: the Events window, which isn't tick boxes. */
	lead?: ReactNode
	/** How many filters differ from everything on: the button's N. */
	changed: number
	/** The closing button's words: "Show 132 decks". */
	result: string
	onReset: () => void
}) {
	const [open, setOpen] = useState(false)
	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-30 flex items-center gap-1.5 rounded-lg border border-brand bg-brand px-3 py-2 text-xs font-semibold text-gray-900 shadow-lg desktop-nav:hidden"
			>
				<SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
				Filters{changed > 0 ? ` · ${changed}` : ""}
			</button>
			{open && <Sheet groups={groups} lead={lead} result={result} onReset={onReset} onClose={() => setOpen(false)} />}
		</>
	)
}

function Sheet({ groups, lead, result, onReset, onClose }: {
	groups: FilterGroup[]
	lead?: ReactNode
	result: string
	onReset: () => void
	onClose: () => void
}) {
	const dialogRef = useRef<HTMLDialogElement>(null)
	const headingRef = useRef<HTMLHeadingElement>(null)
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

	// Layout effect so the cleanup runs while the element is still in the document.
	useLayoutEffect(() => {
		const dialog = dialogRef.current
		if (!dialog) return
		if (!dialog.open) dialog.showModal?.()
		// The heading, not the first button ("Reset"), takes focus on open.
		headingRef.current?.focus()
		return () => {
			if (dialog.open) dialog.close()
		}
	}, [])

	return (
		<dialog
			ref={dialogRef}
			aria-label="Filters"
			onCancel={(cancel) => {
				cancel.preventDefault()
				onClose()
			}}
			onMouseDown={(mouse) => {
				if (mouse.target === mouse.currentTarget) onClose()
			}}
			className="mb-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border-t border-gray-600 bg-gray-800 p-0 text-gray-100 shadow-2xl backdrop:bg-gray-950/60"
		>
			<div className="flex flex-col gap-2.5 px-3 pb-[calc(0.875rem+env(safe-area-inset-bottom))] pt-2.5">
				<span className="mx-auto h-1 w-9 rounded-full bg-gray-600" aria-hidden="true" />
				<div className="flex items-center justify-between">
					<h2 ref={headingRef} tabIndex={-1} className="text-sm font-semibold outline-none">
						Filters
					</h2>
					<button type="button" onClick={onReset} className="text-[11px] font-medium text-brand">
						Reset
					</button>
				</div>
				{lead}
				{groups.map((group) => {
					const items = group.sections.flat()
					const shown = group.collapse && !expanded.has(group.key) ? items.filter((item) => item.on) : items
					// Nothing hidden (every box ticked) means no "Show all".
					const all = shown.length === items.length
					return (
						<div key={group.key} role="group" aria-label={group.title} className="flex flex-col gap-1">
							<span className="text-[10px] uppercase tracking-wider text-gray-400">
								{group.label}
								{group.changed ? ` · ${group.state}` : ""}
							</span>
							<span className="flex flex-wrap gap-1">
								{shown.map((item) => (
									<button
										key={item.key}
										type="button"
										aria-pressed={item.on}
										onClick={item.toggle}
										className={`rounded-full border px-[9px] py-[3px] text-[11px] transition ${
											item.on ? "border-brand bg-brand/15 text-brand" : "border-gray-600 text-gray-300"
										}`}
									>
										{item.label}
									</button>
								))}
								{!all && (
									<button
										type="button"
										onClick={() => setExpanded(new Set([...expanded, group.key]))}
										className="px-1 text-[11px] text-brand"
									>
										Show all {items.length}
									</button>
								)}
							</span>
						</div>
					)
				})}
				<button type="button" onClick={onClose} className="mt-1 rounded-lg bg-brand py-2 text-sm font-semibold text-gray-900">
					{result}
				</button>
			</div>
		</dialog>
	)
}
