import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { Copy, Download, ImageDown, Loader2, Share2 } from "lucide-react"
import { toast } from "sonner"
import type { BannerSupport, BannerUma, UserStepUpSelection } from "../../../types"
import type { BannerResources } from "../../../hooks/bannerResources"
import type { PlannerRow } from "../../../utils/plannerSections"
import { useAccount } from "../../../services/AuthContext"
import { copyImage, downloadImage, renderNodeToPng, shareImageFile, shareSupport } from "../../../utils/shareImage"
import type { ShareSupport } from "../../../utils/shareImage"
import { ShareableBannerTable } from "./ShareableBannerTable"

/** `uma-plan-2026-10-29.png`, the viewer's own date. */
function pictureFilename(now: Date): string {
	const pad = (value: number) => String(value).padStart(2, "0")
	return `uma-plan-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.png`
}

/**
 * "Share picture" on the calculator: a panel with two options and Copy, Share
 * and Download, each shown only where the browser can do it.
 *
 * The picture is made when the panel OPENS (and again when an option changes),
 * not when an action is clicked. Safari lets a page write to the clipboard or
 * open the share sheet only during the click itself, and drawing the picture
 * takes a second or two; with the picture ready, every action runs inside the
 * click. While it is being made the actions wait, and say so.
 *
 * The table is mounted off screen only while the panel is open, so there's no
 * hidden copy of the plan in the page the rest of the time.
 */
export function SharePlanButton({ plannerRows, bannerResources, umaBannerData, supportBannerData, userStepUpSelectionData }: {
	plannerRows: PlannerRow[]
	bannerResources: BannerResources[]
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	userStepUpSelectionData: UserStepUpSelection[]
}) {
	const { account } = useAccount()
	const name = account?.display_name.trim() || null
	const [open, setOpen] = useState(false)
	// Off by default (board post, 2026-10-21): the share link's preview never
	// shows a name either, so showing it is the player's choice each time.
	const [showName, setShowName] = useState(false)
	const [hideSpend, setHideSpend] = useState(false)
	const [now, setNow] = useState(() => new Date())
	const [picture, setPicture] = useState<{ blob: Blob; options: string } | null>(null)
	const [failed, setFailed] = useState(false)
	// Read when the panel opens, in the click: it asks `navigator`, which a
	// prerendered page may not touch while rendering.
	const [support, setSupport] = useState<ShareSupport>({ copy: false, share: false })
	const panelRef = useRef<HTMLDivElement>(null)
	const stageRef = useRef<HTMLDivElement>(null)

	const options = `${showName && !!name}|${hideSpend}`
	const ready = picture !== null && picture.options === options

	// Make the picture once the table is in the page: on opening, and whenever
	// an option changes while open.
	useEffect(() => {
		if (!open) return
		const node = stageRef.current?.firstElementChild
		if (!(node instanceof HTMLElement)) return
		let cancelled = false
		void (async () => {
			try {
				// One frame, so the table has been laid out before it is drawn.
				await new Promise((resolve) => requestAnimationFrame(resolve))
				const blob = await renderNodeToPng(node)
				if (!cancelled) setPicture({ blob, options })
			} catch {
				if (!cancelled) setFailed(true)
			}
		})()
		return () => {
			cancelled = true
		}
	}, [open, options])

	// Close on Escape or a click outside the panel.
	useEffect(() => {
		if (!open) return
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false)
		}
		const onPointer = (event: PointerEvent) => {
			if (!panelRef.current?.contains(event.target as Node)) setOpen(false)
		}
		document.addEventListener("keydown", onKey)
		document.addEventListener("pointerdown", onPointer)
		return () => {
			document.removeEventListener("keydown", onKey)
			document.removeEventListener("pointerdown", onPointer)
		}
	}, [open])

	const toggle = () => {
		if (!open) {
			setNow(new Date())
			setSupport(shareSupport())
			setPicture(null)
			setFailed(false)
		}
		setOpen(!open)
	}

	const filename = pictureFilename(now)

	const copy = async () => {
		if (!ready) return
		try {
			await copyImage(picture.blob)
			toast.success("Picture copied. Paste it wherever you like.")
		} catch {
			toast.error("Your browser wouldn't copy the picture. Try Download instead.")
		}
	}

	const share = async () => {
		if (!ready) return
		try {
			await shareImageFile(picture.blob, filename, "My Uma Musume pull plan")
		} catch (error) {
			// Closing the share sheet is a choice, not a failure.
			if (error instanceof DOMException && error.name === "AbortError") return
			toast.error("Couldn't open the share menu. Try Download instead.")
		}
	}

	const download = () => {
		if (!ready) return
		downloadImage(picture.blob, filename)
	}

	return (
		<div ref={panelRef} className="relative">
			<button
				type="button"
				aria-expanded={open}
				onClick={toggle}
				className="flex items-center gap-1.5 rounded-md border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-200 transition hover:border-brand hover:text-brand"
			>
				<ImageDown className="h-4 w-4" aria-hidden="true" />
				Share picture
			</button>

			{open && (
				<div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-lg border border-gray-600 bg-gray-900 p-3 text-sm text-gray-300 shadow-lg">
					<p className="mb-2 text-gray-400">A picture of your plan, to post anywhere.</p>
					<div className="mb-3 flex flex-col gap-1.5">
						{name && (
							<label className="flex items-center gap-2">
								<input type="checkbox" checked={showName} onChange={(event) => setShowName(event.target.checked)} />
								Show my name ({name})
							</label>
						)}
						<label className="flex items-center gap-2">
							<input type="checkbox" checked={hideSpend} onChange={(event) => setHideSpend(event.target.checked)} />
							Hide paid carats
						</label>
					</div>
					{failed ? (
						<p className="text-highlight" role="alert">
							Couldn't make the picture. Close this and try again.
						</p>
					) : (
						<div className="flex flex-wrap gap-2">
							{support.copy && (
								<ActionButton disabled={!ready} onClick={copy} icon={<Copy className="h-4 w-4" aria-hidden="true" />}>
									Copy
								</ActionButton>
							)}
							{support.share && (
								<ActionButton disabled={!ready} onClick={share} icon={<Share2 className="h-4 w-4" aria-hidden="true" />}>
									Share
								</ActionButton>
							)}
							<ActionButton disabled={!ready} onClick={download} icon={<Download className="h-4 w-4" aria-hidden="true" />}>
								Download
							</ActionButton>
						</div>
					)}
					{!ready && !failed && (
						<p className="mt-2 flex items-center gap-1.5 text-xs text-gray-400" role="status">
							<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
							Making the picture…
						</p>
					)}
				</div>
			)}

			{/* Off screen and hidden from screen readers: it exists only to be drawn. */}
			{open && (
				<div ref={stageRef} aria-hidden="true" className="pointer-events-none fixed left-[-10000px] top-0">
					<ShareableBannerTable
						plannerRows={plannerRows}
						bannerResources={bannerResources}
						umaBannerData={umaBannerData}
						supportBannerData={supportBannerData}
						userStepUpSelectionData={userStepUpSelectionData}
						ownerName={showName ? name : null}
						hideSpend={hideSpend}
						now={now}
					/>
				</div>
			)}
		</div>
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
