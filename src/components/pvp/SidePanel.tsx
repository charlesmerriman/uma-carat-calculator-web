/**
 * The two placements of a panel beside the team builder, shared by Guide
 * picks (left) and Recommended skills (right).
 *
 *   DockedPanel  a column of the My team view's grid, sticky under the
 *                control band, scrolling on its own. Shown only from the
 *                side's breakpoint up, and collapsible.
 *   SideDrawer   below that breakpoint: slides in over the page from the
 *                panel's own edge, with a backdrop. Escape, the backdrop or
 *                the close button put it away.
 *
 * The breakpoints differ because both columns plus the builder need room:
 * the left column docks from xl (1280px), the right from 2xl (1536px). CSS
 * alone decides, so nothing measures the screen, and a drawer left open
 * when the window widens hides itself where the docked column takes over.
 */

import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { PanelLeftClose, PanelRightClose, X } from "lucide-react"

export type PanelSide = "left" | "right"

// Literal class strings per side, so Tailwind sees every one of them.
const DOCK_CLASSES: Record<PanelSide, string> = {
	left: "hidden xl:sticky xl:top-18 xl:flex xl:max-h-[calc(100dvh-10rem)] xl:flex-col",
	right: "hidden 2xl:sticky 2xl:top-18 2xl:flex 2xl:max-h-[calc(100dvh-10rem)] 2xl:flex-col",
}
const DRAWER_CLASSES: Record<PanelSide, { root: string; sheet: string }> = {
	left: {
		root: "xl:hidden",
		sheet: "left-0 border-r motion-safe:animate-[side-panel-in-left_160ms_ease-out]",
	},
	right: {
		root: "2xl:hidden",
		sheet: "right-0 border-l motion-safe:animate-[side-panel-in-right_160ms_ease-out]",
	},
}

const HEADING = "flex items-center gap-1.5 text-sm font-semibold text-gray-100"
const ICON_BUTTON =
	"flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-700 hover:text-gray-100"

interface PanelChrome {
	side: PanelSide
	title: string
	icon: ReactNode
	children: ReactNode
}

/** The docked column. The caller renders it only while it is open. */
export function DockedPanel({ side, title, icon, onCollapse, children }: PanelChrome & { onCollapse: () => void }) {
	const CollapseIcon = side === "left" ? PanelLeftClose : PanelRightClose
	return (
		<aside aria-label={title} className={`card-panel self-start ${DOCK_CLASSES[side]}`}>
			<header className="flex items-center justify-between border-b border-gray-700 py-1.5 pl-3 pr-1.5">
				<h2 className={HEADING}>
					{icon}
					{title}
				</h2>
				<button type="button" aria-label={`Hide ${title.toLowerCase()}`} title={`Hide ${title.toLowerCase()}`} onClick={onCollapse} className={ICON_BUTTON}>
					<CollapseIcon className="h-4 w-4" />
				</button>
			</header>
			<div className="min-h-0 overflow-y-auto p-3">{children}</div>
		</aside>
	)
}

/** The retracted panel, sliding in from its side. */
export function SideDrawer({ side, title, icon, open, onClose, children }: PanelChrome & { open: boolean; onClose: () => void }) {
	useEffect(() => {
		if (!open) return
		const closeOnEscape = (keydown: KeyboardEvent) => {
			if (keydown.key === "Escape") onClose()
		}
		window.addEventListener("keydown", closeOnEscape)
		return () => window.removeEventListener("keydown", closeOnEscape)
	}, [open, onClose])

	if (!open) return null
	const classes = DRAWER_CLASSES[side]
	return createPortal(
		<div className={`fixed inset-0 z-60 ${classes.root}`}>
			<div className="absolute inset-0 bg-gray-950/60" onMouseDown={onClose} aria-hidden="true" />
			<section
				role="dialog"
				aria-modal="true"
				aria-label={title}
				className={`absolute inset-y-0 flex w-[min(20rem,88vw)] flex-col border-gray-600 bg-gray-800 shadow-2xl ${classes.sheet}`}
			>
				<header className="flex items-center justify-between border-b border-gray-700 py-1.5 pl-3 pr-1.5">
					<h2 className={HEADING}>
						{icon}
						{title}
					</h2>
					<button type="button" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose} className={ICON_BUTTON}>
						<X className="h-4 w-4" />
					</button>
				</header>
				<div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
			</section>
		</div>,
		document.body
	)
}
