/**
 * The overlay every gallery dialog uses: a backdrop, Escape and a click on the
 * backdrop close it, and focus moves into it when it opens.
 *
 *   dialog  a centred box (posting, reporting)
 *   sheet   the post panel: full screen on a phone, a sheet on the right from
 *           the desktop nav up, so the feed stays visible beside it
 *
 * Portalled to <body>, like PvpCardPicker, so no parent's overflow or stacking
 * clips it. Rendered only on interaction, never at load, so touching
 * `document` here is safe on the prerendered /app/pvp.
 */

import { useEffect, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

const BOX: Record<"dialog" | "sheet", string> = {
	dialog:
		"flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gray-600 bg-gray-800 shadow-2xl",
	sheet:
		"fixed inset-0 flex flex-col overflow-hidden bg-gray-900 desktop-nav:inset-y-0 desktop-nav:left-auto desktop-nav:right-0 desktop-nav:w-[34rem] desktop-nav:border-l desktop-nav:border-gray-600 desktop-nav:shadow-2xl",
}

export function GalleryModal({ title, onClose, variant = "dialog", headerExtra, children }: {
	title: string
	onClose: () => void
	variant?: "dialog" | "sheet"
	headerExtra?: ReactNode
	children: ReactNode
}) {
	const headingRef = useRef<HTMLHeadingElement>(null)

	useEffect(() => {
		headingRef.current?.focus()
	}, [])
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose()
		}
		document.addEventListener("keydown", onKey)
		return () => document.removeEventListener("keydown", onKey)
	}, [onClose])

	return createPortal(
		<div
			className={`fixed inset-0 z-[10000] bg-gray-950/75 ${variant === "dialog" ? "flex items-center justify-center p-4" : ""}`}
			onMouseDown={(mouse) => {
				if (mouse.target === mouse.currentTarget) onClose()
			}}
		>
			<section role="dialog" aria-modal="true" aria-label={title} className={BOX[variant]}>
				<header className="flex items-center gap-2 border-b border-gray-700 px-4 py-3">
					<h2 ref={headingRef} tabIndex={-1} className="min-w-0 flex-1 truncate text-base font-semibold text-gray-100 outline-none">
						{title}
					</h2>
					{headerExtra}
					<button
						type="button"
						aria-label="Close"
						onClick={onClose}
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-700 hover:text-gray-100"
					>
						<X className="h-5 w-5" />
					</button>
				</header>
				<div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
			</section>
		</div>,
		document.body
	)
}
