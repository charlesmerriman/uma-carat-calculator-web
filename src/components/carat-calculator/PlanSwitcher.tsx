import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { FormEvent } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown, Copy, Pencil, Plus, Trash2 } from "lucide-react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { PLAN_CAP, PLAN_NAME_MAX_LENGTH } from "../../types"
import { NAV_POPOVER } from "../navbar/navStyles"

/**
 * The plan picker above the banner sheet: which plan is open, a menu to switch
 * to another, and New / Duplicate / Rename / Delete.
 *
 * SIGNED-IN ONLY. A guest has one unnamed plan in memory (`activePlanId` is
 * null), so this renders nothing for them. The same null also covers an API
 * from before plans existed, which is the right way to degrade.
 *
 * THIS COMPONENT OWNS NO PLAN LOGIC. Every action is a provider function that
 * flushes the pending auto-save before it touches anything, resolves to
 * whether it worked, and toasts its own failure (CalculatorProvider, "Plans").
 * All that happens here is choosing which one to call and closing the menu
 * when it says yes. Keep it that way: the save-before-switch ordering is what
 * stops a switch losing an edit, and it must not depend on which button was
 * clicked.
 *
 * ONE POPOVER, THREE FACES. The menu, the name form (new / duplicate / rename)
 * and the delete confirmation all render inside the same panel instead of
 * opening a second layer. On a phone a dialog over a popover is two things to
 * dismiss, and the panel is already where the person's eyes are.
 *
 * Same popover idiom as ProfileMenu and SettingsMenu: closes on outside click
 * and Escape. It borrows NAV_POPOVER so every popover in the app has one look.
 *
 * THE PANEL IS PORTALLED TO <body>, the way CountStepper's pad is. The planner
 * box it sits in is `overflow-hidden` AND an `@container`, and a container is
 * the containing block for its fixed-position descendants, so a panel rendered
 * in place is clipped by that box however it is positioned. A brand new plan
 * has no rows, which makes the box shorter than the menu: the bottom half of
 * the menu would be cut off in exactly the state a new user sees first.
 * The portal only ever renders after a click, so it never runs while /app is
 * being prerendered.
 */

// Gap between the trigger and the panel, and the least room kept to any
// viewport edge. Same numbers CountStepper uses.
const GAP = 6
const EDGE = 8

// What the panel is showing. "menu" is the plan list; the rest are its forms.
type Face =
	| { kind: "menu" }
	| { kind: "new" }
	| { kind: "duplicate" }
	| { kind: "rename" }
	| { kind: "delete" }

const MENU_ITEM =
	"flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-gray-300 transition hover:bg-gray-700 hover:text-gray-100 focus-visible:bg-gray-700 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-gray-300"
const BUTTON_PRIMARY =
	"rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-black transition hover:bg-brand/85 disabled:cursor-not-allowed disabled:opacity-50"
const BUTTON_GHOST =
	"rounded-lg border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-300 transition hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
const BUTTON_DANGER =
	"rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"

const FORM_COPY = {
	new: { title: "New plan", submit: "Create" },
	duplicate: { title: "Duplicate this plan", submit: "Duplicate" },
	rename: { title: "Rename plan", submit: "Save" }
} as const

export const PlanSwitcher = () => {
	const {
		plans,
		activePlanId,
		isPlanBusy,
		switchPlan,
		createPlan,
		renamePlan,
		deletePlan
	} = useCalculatorData()

	const [open, setOpen] = useState(false)
	const [face, setFace] = useState<Face>({ kind: "menu" })
	const [nameDraft, setNameDraft] = useState("")
	const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
	const anchorRef = useRef<HTMLDivElement>(null)
	const panelRef = useRef<HTMLDivElement>(null)
	const nameInputRef = useRef<HTMLInputElement>(null)

	// Under the trigger, left edges aligned, pulled back inside the viewport if
	// it would overflow the right edge (a phone) or the bottom (then it opens
	// upward). Fixed coordinates, so it is recomputed on scroll and resize.
	const place = useCallback((): void => {
		const anchorEl = anchorRef.current
		const panelEl = panelRef.current
		if (!anchorEl || !panelEl) return
		const anchor = anchorEl.getBoundingClientRect()
		const panelWidth = panelEl.offsetWidth
		const panelHeight = panelEl.offsetHeight
		const left = Math.max(
			EDGE,
			Math.min(anchor.left, window.innerWidth - panelWidth - EDGE)
		)
		const below = anchor.bottom + GAP
		const fitsBelow = below + panelHeight <= window.innerHeight - EDGE
		const above = anchor.top - GAP - panelHeight
		setPosition({ left, top: fitsBelow || above < EDGE ? below : above })
	}, [])

	// Layout effect so the panel is measured and placed before the browser
	// paints it. `face` is a dep because the three faces differ in height.
	useLayoutEffect(() => {
		if (open) place()
	}, [open, face, place])

	useEffect(() => {
		if (!open) return
		// Capture phase: the scroll that matters may be on an ancestor, and
		// scroll events do not bubble.
		const reposition = (): void => place()
		window.addEventListener("scroll", reposition, true)
		window.addEventListener("resize", reposition)
		const handlePointerDown = (e: PointerEvent) => {
			const target = e.target as Node
			// The panel lives in <body>, outside the anchor, so both are checked.
			if (anchorRef.current?.contains(target)) return
			if (panelRef.current?.contains(target)) return
			setOpen(false)
		}
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false)
		}
		document.addEventListener("pointerdown", handlePointerDown)
		document.addEventListener("keydown", handleKeyDown)
		return () => {
			window.removeEventListener("scroll", reposition, true)
			window.removeEventListener("resize", reposition)
			document.removeEventListener("pointerdown", handlePointerDown)
			document.removeEventListener("keydown", handleKeyDown)
		}
	}, [open, place])

	// Focus and select the name when a form face opens, so typing replaces the
	// suggestion straight away. In an effect because the input does not exist
	// until the face has rendered.
	const showsNameForm =
		face.kind === "new" || face.kind === "duplicate" || face.kind === "rename"
	useEffect(() => {
		if (open && showsNameForm) nameInputRef.current?.select()
	}, [open, showsNameForm])

	const activePlan = plans.find((plan) => plan.id === activePlanId)
	// Guest, an API without plans, or the list not loaded yet.
	if (activePlanId === null || !activePlan) return null

	const atCap = plans.length >= PLAN_CAP
	const isOnlyPlan = plans.length <= 1

	const toggleOpen = (): void => {
		// Always reopen on the list, never on a half-filled form from last time.
		setFace({ kind: "menu" })
		// Cleared so the panel is hidden until place() has measured it, instead
		// of flashing at last time's coordinates.
		setPosition(null)
		setOpen((prev) => !prev)
	}

	const openNameForm = (kind: "new" | "duplicate" | "rename"): void => {
		setNameDraft(
			kind === "rename"
				? activePlan.name
				: kind === "duplicate"
					// Trimmed to fit: "<40 chars> copy" would be refused by the server.
					? `${activePlan.name} copy`.slice(0, PLAN_NAME_MAX_LENGTH)
					: ""
		)
		setFace({ kind })
	}

	const handleSwitch = async (planId: number): Promise<void> => {
		if (await switchPlan(planId)) setOpen(false)
	}

	const handleNameSubmit = async (e: FormEvent): Promise<void> => {
		e.preventDefault()
		const name = nameDraft.trim()
		if (!name) return
		const worked =
			face.kind === "rename"
				? await renamePlan(activePlan.id, name)
				: await createPlan(name, face.kind === "duplicate" ? activePlan.id : undefined)
		if (worked) setOpen(false)
	}

	const handleDelete = async (): Promise<void> => {
		if (await deletePlan(activePlan.id)) setOpen(false)
	}

	return (
		// The row is this component's own, so a guest (who gets null above) is
		// left with no empty padded strip above the add-banner buttons. No bottom
		// padding: the button row below brings its own top padding.
		<div className="flex px-3 pt-3 sm:px-4 sm:pt-4">
		<div ref={anchorRef} className="min-w-0">
			<button
				type="button"
				onClick={toggleOpen}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label={`Plan: ${activePlan.name}. Open the plan menu`}
				className={`flex max-w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ${
					open ? "border-brand/70" : "border-gray-600 hover:border-gray-400 hover:bg-gray-800"
				}`}
			>
				<span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-400">
					Plan
				</span>
				<span className="truncate font-medium text-gray-100">{activePlan.name}</span>
				<ChevronDown
					className={`h-4 w-4 shrink-0 text-gray-400 transition ${open ? "rotate-180" : ""}`}
					aria-hidden="true"
				/>
			</button>

			{open && createPortal(
				<div
					ref={panelRef}
					style={{
						left: position?.left ?? 0,
						top: position?.top ?? 0,
						// Invisible, not unmounted, until placed: place() needs the
						// panel's real size, so it has to be in the DOM to be measured.
						visibility: position ? "visible" : "hidden"
					}}
					className={`${NAV_POPOVER} fixed z-50 w-72 max-w-[calc(100vw-1rem)] p-1.5`}
				>
					{face.kind === "menu" && (
						<div role="menu" aria-label="Plans">
							{plans.map((plan) => (
								<button
									key={plan.id}
									type="button"
									role="menuitemradio"
									aria-checked={plan.id === activePlanId}
									disabled={isPlanBusy}
									onClick={() => void handleSwitch(plan.id)}
									className={MENU_ITEM}
								>
									{/* A fixed-width slot, filled or not, so the names line up. */}
									<span className="flex h-4 w-4 shrink-0 items-center justify-center">
										{plan.id === activePlanId && (
											<Check className="h-4 w-4 text-brand" aria-hidden="true" />
										)}
									</span>
									<span className="truncate">{plan.name}</span>
								</button>
							))}

							<div className="my-1 border-t border-gray-700" />

							<button
								type="button"
								role="menuitem"
								disabled={isPlanBusy || atCap}
								onClick={() => openNameForm("new")}
								className={MENU_ITEM}
							>
								<Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
								New plan
							</button>
							<button
								type="button"
								role="menuitem"
								disabled={isPlanBusy || atCap}
								onClick={() => openNameForm("duplicate")}
								className={MENU_ITEM}
							>
								<Copy className="h-4 w-4 shrink-0" aria-hidden="true" />
								Duplicate this plan
							</button>
							<button
								type="button"
								role="menuitem"
								disabled={isPlanBusy}
								onClick={() => openNameForm("rename")}
								className={MENU_ITEM}
							>
								<Pencil className="h-4 w-4 shrink-0" aria-hidden="true" />
								Rename
							</button>
							<button
								type="button"
								role="menuitem"
								disabled={isPlanBusy || isOnlyPlan}
								onClick={() => setFace({ kind: "delete" })}
								className={`${MENU_ITEM} text-red-400 hover:text-red-300`}
							>
								<Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
								Delete this plan
							</button>

							{/* Says why two items are greyed out, and what a plan does and
							    does not carry, which is the first thing people ask. */}
							<p className="px-2.5 pb-1 pt-2 text-xs leading-snug text-gray-400">
								{atCap
									? `You can keep up to ${PLAN_CAP} plans. `
									: ""}
								Each plan has its own banners. Your carats, ranks and purchases
								are shared by all of them.
							</p>
						</div>
					)}

					{showsNameForm && (
						<form onSubmit={(e) => void handleNameSubmit(e)} className="p-2">
							<label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
								{FORM_COPY[face.kind].title}
								<input
									ref={nameInputRef}
									type="text"
									value={nameDraft}
									onChange={(e) => setNameDraft(e.target.value)}
									maxLength={PLAN_NAME_MAX_LENGTH}
									placeholder="Plan name"
									className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm font-normal normal-case tracking-normal text-gray-100 outline-none transition placeholder:text-gray-500 focus:border-brand"
								/>
							</label>
							<div className="mt-3 flex justify-end gap-2">
								<button
									type="button"
									onClick={() => setFace({ kind: "menu" })}
									className={BUTTON_GHOST}
								>
									Back
								</button>
								<button
									type="submit"
									disabled={isPlanBusy || nameDraft.trim() === ""}
									className={BUTTON_PRIMARY}
								>
									{FORM_COPY[face.kind].submit}
								</button>
							</div>
						</form>
					)}

					{face.kind === "delete" && (
						<div className="p-2">
							<p className="text-sm text-gray-200">
								Delete <span className="font-semibold">{activePlan.name}</span>?
							</p>
							<p className="mt-1 text-xs leading-snug text-gray-400">
								Its banners are deleted with it. This can't be undone. Your other
								plans, carats and purchases stay as they are.
							</p>
							<div className="mt-3 flex justify-end gap-2">
								<button
									type="button"
									onClick={() => setFace({ kind: "menu" })}
									className={BUTTON_GHOST}
								>
									Back
								</button>
								<button
									type="button"
									disabled={isPlanBusy}
									onClick={() => void handleDelete()}
									className={BUTTON_DANGER}
								>
									Delete plan
								</button>
							</div>
						</div>
					)}
				</div>,
				document.body
			)}
		</div>
		</div>
	)
}
