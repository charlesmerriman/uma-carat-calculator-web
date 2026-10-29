import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { createPortal } from "react-dom"
import { Copy, Download, ImageDown, Loader2, Share2 } from "lucide-react"
import { toast } from "sonner"
import { copyImage, downloadImage, newDrawCache, renderNodeToPng, shareImageFile, shareSupport } from "../../utils/shareImage"
import type { DrawCache, DrawnPicture, ShareSupport } from "../../utils/shareImage"
import { fileStamp } from "../../utils/shareFileName"

// Gap between the button and the panel, and the least room kept to any
// viewport edge. Same numbers CountStepper and PlanSwitcher use.
const GAP = 6
const EDGE = 8

// How long a redraw waits after the last checkbox change: ticking two or three
// boxes in a row then makes one picture, not one each. The first picture of an
// opening doesn't wait.
const REDRAW_DELAY_MS = 250

/**
 * "Share picture": a button, and a panel with the caller's options and Copy,
 * Share and Download, each shown only where the browser can do it. The pull
 * plan (SharePlanButton) and a PvP team (ShareTeamButton) each wrap it with
 * their own picture and options (notes/share-plan-image-plan.md,
 * notes/team-picture-plan.md).
 *
 * The picture is made when the panel OPENS (and again when `optionsKey`
 * changes), not when an action is clicked. Safari lets a page write to the
 * clipboard or open the share sheet only during the click itself, and drawing
 * the picture takes a second or two; with the picture ready, every action runs
 * inside the click. While it is being made the actions wait, and say so.
 *
 * The picture is mounted off screen only while the panel is open, so there's
 * no hidden copy of it in the page the rest of the time, and nothing is drawn.
 *
 * Drawing is the expensive part (the browser lays the whole poster out again
 * and paints it at twice its size), so a redraw waits REDRAW_DELAY_MS for the
 * checkboxes to settle, only one runs at a time, and the fonts and art it
 * embeds are gathered once per opening (renderNodeToPng). Art that couldn't
 * be loaded is said so under the actions, never handed over silently.
 *
 * On an iPhone or iPad the panel leads with Share, as "Save or share", and
 * leaves Download out: Download lands in Files, and the share sheet's "Save
 * Image" is the only way a page can put a picture in Photos.
 *
 * THE PANEL IS PORTALLED TO <body>, like PlanSwitcher's (see its comment): the
 * planner box is `overflow-hidden` and an `@container`, so a panel rendered in
 * place is clipped by it, and under the PLANS bar of a one-row plan the box
 * ends before the panel does. The portal renders only after a click, never
 * during the prerender.
 */
export function SharePictureButton({ picture, options, optionsKey, filename, shareTitle, blurb, buttonClassName, className = "" }: {
	/** The picture, drawn off screen while the panel is open. `now` is fixed
	 *  when the panel opens, so the picture's date and the file's agree. */
	picture: (now: Date) => ReactNode
	/** The caller's checkboxes, drawn in the panel above the actions. */
	options: ReactNode
	/** Changes whenever an option the picture reads changes: the picture is redrawn. */
	optionsKey: string
	/** The file's name, from the viewer's date and time ("2026-10-29-1615",
	 *  utils/shareFileName.ts), so two pictures never share one. */
	filename: (stamp: string) => string
	/** The share sheet's title. */
	shareTitle: string
	/** The panel's first line. */
	blurb: string
	/** The button's look; each place dresses it to match its own bar. */
	buttonClassName: string
	/** The wrapper's placement in its row. */
	className?: string
}) {
	const [open, setOpen] = useState(false)
	const [now, setNow] = useState(() => new Date())
	const [drawn, setDrawn] = useState<(DrawnPicture & { optionsKey: string }) | null>(null)
	const [failed, setFailed] = useState(false)
	// Read when the panel opens, in the click: it asks `navigator`, which a
	// prerendered page may not touch while rendering.
	const [support, setSupport] = useState<ShareSupport>({ copy: false, share: false, preferShare: false })
	const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
	const buttonRef = useRef<HTMLButtonElement>(null)
	const panelRef = useRef<HTMLDivElement>(null)
	const stageRef = useRef<HTMLDivElement>(null)
	// The draw in progress, if any. A draw can't be stopped once it has
	// started, so a newer one waits for it to finish (its picture is then
	// thrown away) instead of running beside it and doubling the work.
	const drawing = useRef<Promise<void> | null>(null)
	// Whether this opening has scheduled its first picture yet: only redraws wait.
	const scheduled = useRef(false)
	// The embedded-font CSS and the inlined art, kept for this opening's redraws (renderNodeToPng).
	const cache = useRef<DrawCache>(newDrawCache())

	const ready = drawn !== null && drawn.optionsKey === optionsKey

	// Make the picture once it is in the page: on opening, and whenever an
	// option changes while open.
	useEffect(() => {
		if (!open) return
		let cancelled = false
		const delay = scheduled.current ? REDRAW_DELAY_MS : 0
		scheduled.current = true
		const timer = setTimeout(() => {
			const previous = drawing.current
			drawing.current = (async () => {
				await previous
				// One frame, so the picture has been laid out before it is drawn.
				await new Promise((resolve) => requestAnimationFrame(resolve))
				// Read now, not when scheduled: the options may have redrawn it.
				const node = stageRef.current?.firstElementChild
				if (cancelled || !(node instanceof HTMLElement)) return
				try {
					const picture = await renderNodeToPng(node, cache.current)
					if (!cancelled) setDrawn({ ...picture, optionsKey })
				} catch {
					if (!cancelled) setFailed(true)
				}
			})()
		}, delay)
		return () => {
			cancelled = true
			clearTimeout(timer)
		}
	}, [open, optionsKey])

	// Under the button, right edges aligned (it sits at the right end of its
	// row), pulled back inside the viewport, and opening upward when there is
	// no room below. Fixed coordinates, so it is recomputed on scroll and resize.
	const place = useCallback((): void => {
		const button = buttonRef.current
		const panel = panelRef.current
		if (!button || !panel) return
		const anchor = button.getBoundingClientRect()
		const left = Math.max(EDGE, Math.min(anchor.right - panel.offsetWidth, window.innerWidth - panel.offsetWidth - EDGE))
		const below = anchor.bottom + GAP
		const fitsBelow = below + panel.offsetHeight <= window.innerHeight - EDGE
		const above = anchor.top - GAP - panel.offsetHeight
		setPosition({ left, top: fitsBelow || above < EDGE ? below : above })
	}, [])

	// Before paint, and again when the panel's height changes (the loading line
	// goes, an error replaces the buttons).
	useLayoutEffect(() => {
		if (open) place()
	}, [open, ready, failed, place])

	// Close on Escape or a click outside both the button and the panel (the
	// panel lives in <body>, outside the button's box); follow scrolls and resizes.
	useEffect(() => {
		if (!open) return
		const close = () => {
			setOpen(false)
			setPosition(null)
		}
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") close()
		}
		const onPointer = (event: PointerEvent) => {
			const target = event.target as Node
			if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return
			close()
		}
		// Capture phase: the scroll that matters may be an ancestor's, and
		// scroll events do not bubble.
		const reposition = () => place()
		document.addEventListener("keydown", onKey)
		document.addEventListener("pointerdown", onPointer)
		window.addEventListener("scroll", reposition, true)
		window.addEventListener("resize", reposition)
		return () => {
			document.removeEventListener("keydown", onKey)
			document.removeEventListener("pointerdown", onPointer)
			window.removeEventListener("scroll", reposition, true)
			window.removeEventListener("resize", reposition)
		}
	}, [open, place])

	const toggle = () => {
		if (!open) {
			setNow(new Date())
			setSupport(shareSupport())
			setDrawn(null)
			setFailed(false)
			// A new opening: its first picture doesn't wait, and the fonts and
			// art are gathered afresh (the theme may have changed since).
			scheduled.current = false
			cache.current = newDrawCache()
		}
		setPosition(null)
		setOpen(!open)
	}

	const file = filename(fileStamp(now))

	const copy = async () => {
		if (!ready) return
		try {
			await copyImage(drawn.blob)
			toast.success("Picture copied. Paste it wherever you like.")
		} catch {
			toast.error("Your browser wouldn't copy the picture. Try Download instead.")
		}
	}

	const share = async () => {
		if (!ready) return
		try {
			await shareImageFile(drawn.blob, file, shareTitle)
		} catch (error) {
			// Closing the share sheet is a choice, not a failure.
			if (error instanceof DOMException && error.name === "AbortError") return
			toast.error("Couldn't open the share menu. Try Download instead.")
		}
	}

	const download = () => {
		if (!ready) return
		downloadImage(drawn.blob, file)
	}

	return (
		<div className={`relative flex shrink-0 ${className}`}>
			<button ref={buttonRef} type="button" aria-expanded={open} onClick={toggle} title="Share picture" className={buttonClassName}>
				<ImageDown className="h-4 w-4" aria-hidden="true" />
				{/* Icon only on a phone, where the row is already full; the
				    accessible name is the same at every width. */}
				<span className="sr-only sm:not-sr-only">Share picture</span>
			</button>

			{open && createPortal(
				<div
					ref={panelRef}
					style={{
						left: position?.left ?? 0,
						top: position?.top ?? 0,
						// Invisible, not unmounted, until placed: place() measures it.
						visibility: position ? "visible" : "hidden",
					}}
					className="fixed z-50 w-72 max-w-[calc(100vw-1rem)] rounded-lg border border-gray-600 bg-gray-900 p-3 text-sm text-gray-300 shadow-lg"
				>
					<p className="mb-2 text-gray-400">{blurb}</p>
					<div className="mb-3 flex flex-col gap-1.5">{options}</div>
					{failed ? (
						<p className="text-highlight" role="alert">
							Couldn't make the picture. Close this and try again.
						</p>
					) : (
						<div className="flex flex-wrap gap-2">
							{support.preferShare && (
								<ActionButton disabled={!ready} onClick={share} icon={<Share2 className="h-4 w-4" aria-hidden="true" />}>
									Save or share
								</ActionButton>
							)}
							{support.copy && (
								<ActionButton disabled={!ready} onClick={copy} icon={<Copy className="h-4 w-4" aria-hidden="true" />}>
									Copy
								</ActionButton>
							)}
							{support.share && !support.preferShare && (
								<ActionButton disabled={!ready} onClick={share} icon={<Share2 className="h-4 w-4" aria-hidden="true" />}>
									Share
								</ActionButton>
							)}
							{!support.preferShare && (
								<ActionButton disabled={!ready} onClick={download} icon={<Download className="h-4 w-4" aria-hidden="true" />}>
									Download
								</ActionButton>
							)}
						</div>
					)}
					{ready && drawn.missingArt > 0 && (
						<p className="mt-2 text-xs text-highlight" role="status">
							Some art didn't load, so the picture has blank spots. Close this and try again.
						</p>
					)}
					{!ready && !failed && (
						<p className="mt-2 flex items-center gap-1.5 text-xs text-gray-400" role="status">
							<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
							Making the picture…
						</p>
					)}
				</div>,
				document.body
			)}

			{/* Off screen and hidden from screen readers: it exists only to be drawn. */}
			{open && (
				<div ref={stageRef} aria-hidden="true" className="pointer-events-none fixed left-[-10000px] top-0">
					{picture(now)}
				</div>
			)}
		</div>
	)
}

/** One of the panel's checkboxes. */
export function ShareOption({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode }) {
	return (
		<label className="flex items-center gap-2">
			<input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
			{children}
		</label>
	)
}

function ActionButton({ disabled, onClick, icon, children }: {
	disabled: boolean
	onClick: () => void
	icon: ReactNode
	children: ReactNode
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			className="flex items-center gap-1.5 rounded-md border border-gray-600 px-3 py-1.5 font-medium text-gray-100 transition enabled:hover:border-brand enabled:hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
		>
			{icon}
			{children}
		</button>
	)
}
