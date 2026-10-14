/**
 * The box every gallery dialog uses (posting, reporting): the browser's own
 * modal <dialog>, opened with showModal().
 *
 * WHY THE NATIVE ELEMENT. showModal() puts the box in the top layer, above
 * every z-index, so nothing clips it and no portal is needed; it makes the
 * rest of the page inert, so Tab stays inside and screen readers see only the
 * dialog; and Escape goes to the TOP dialog alone, so a dialog opened over
 * another closes by itself. A hand-built overlay had to fake each of those,
 * and its document-wide Escape listener closed both at once.
 *
 * Two consequences to keep in mind:
 *   - Toasts render below the top layer, so a dialog shows its own errors
 *     inline. A toast fired as it closes is fine.
 *   - Focus goes back to whatever opened it when it closes.
 *
 * Rendered only on interaction, never at load, so touching `document` here
 * is safe on the prerendered /app/pvp.
 */

import { useLayoutEffect, useRef, type ReactNode } from "react"
import { X } from "lucide-react"

export function GalleryModal({ title, onClose, children }: {
	title: string
	onClose: () => void
	children: ReactNode
}) {
	const dialogRef = useRef<HTMLDialogElement>(null)
	const headingRef = useRef<HTMLHeadingElement>(null)

	// Layout effect so the cleanup runs while the element is still in the
	// document: close() there is what hands the top layer back.
	useLayoutEffect(() => {
		const dialog = dialogRef.current
		if (!dialog) return
		const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
		if (!dialog.open) dialog.showModal()
		headingRef.current?.focus()
		return () => {
			if (dialog.open) dialog.close()
			if (opener?.isConnected) opener.focus({ preventScroll: true })
		}
	}, [])

	return (
		<dialog
			ref={dialogRef}
			aria-label={title}
			// Escape: the browser's cancel event, sent to the top dialog only.
			// Default prevented so React, not the browser, decides it is closed.
			onCancel={(cancel) => {
				cancel.preventDefault()
				onClose()
			}}
			// Keeps Escape from reaching a panel this dialog was opened over
			// (GalleryPostPanel closes on Escape too). React events bubble
			// through the component tree, not the DOM's.
			onKeyDown={(key) => {
				if (key.key === "Escape") key.stopPropagation()
			}}
			// A press on the backdrop lands on the <dialog> itself, since the
			// box inside fills it. mousedown, so a text selection dragged out
			// of the box does not close it.
			onMouseDown={(mouse) => {
				if (mouse.target === mouse.currentTarget) onClose()
			}}
			className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-xl border border-gray-600 bg-gray-800 p-0 text-gray-100 shadow-2xl backdrop:bg-gray-950/75"
		>
			<div className="flex max-h-[calc(100dvh-2rem)] flex-col">
				<header className="flex items-center gap-2 border-b border-gray-700 px-4 py-3">
					<h2 ref={headingRef} tabIndex={-1} className="min-w-0 flex-1 text-base font-semibold text-gray-100 outline-none">
						{title}
					</h2>
					<button
						type="button"
						aria-label="Close"
						onClick={onClose}
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-700 hover:text-gray-100"
					>
						<X className="h-5 w-5" />
					</button>
				</header>
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
			</div>
		</dialog>
	)
}
