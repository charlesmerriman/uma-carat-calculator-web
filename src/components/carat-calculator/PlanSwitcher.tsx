import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { FormEvent, MouseEvent } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown, Copy, Ellipsis, Pencil, Plus, Share2, Trash2, Wallet } from "lucide-react"
import { toast } from "sonner"
import { useCalculatorData } from "../../services/CalculatorContext"
import { PLAN_CAP, PLAN_NAME_MAX_LENGTH } from "../../types"
import type { PlanSharingChanges } from "../../types"
import { sharedPlanPath } from "../../utils/appRoutes"
import { NAV_POPOVER } from "../navbar/navStyles"

/**
 * The PLANS bar above the banner sheet: one tab per plan, a "New" button, and
 * a "..." menu for the open plan (Duplicate / Rename / Separate resources /
 * Share / Delete).
 *
 * SEPARATE RESOURCES. A plan normally reads the account's carats, ranks and
 * income settings. Someone who plays two game accounts can give a plan its
 * own copy instead: a checkable menu item turns it on (the server seeds the
 * copy from the numbers on screen) and off (which discards that copy, so
 * turning it off asks first, like Delete does). A tab whose plan has its own
 * resources carries a small wallet glyph, because otherwise nothing on screen
 * says which numbers the resources form above is editing.
 *
 * SHARING. "Share this plan" opens a face with the link switch, the link and
 * its Copy button, the two things a copy may carry besides the banners (the
 * owner's resources, their notes; both off until ticked, and only tickable
 * while sharing is on), the copy count, and Reset link, which asks first like
 * Delete does because it breaks a link that may already be out there. Nobody
 * opens a shared plan: the link leads to a card whose one action is "copy"
 * (SharedPlanLanding). The face is hidden on an API older than sharing (no
 * `public_id`), the same degrade income_profile_id gets.
 *
 * WHY TABS. The site grew out of a spreadsheet, and sheet tabs are how a
 * spreadsheet says "several versions of this". With the cap at five they
 * always fit on a desktop, switching is one click, and an account with a
 * single plan still sees "Main plan" beside "New", so the feature is visible
 * without opening anything. This replaced a lone dropdown button sitting in an
 * otherwise empty row (2026-09-17), which read as a gap with a button in it.
 *
 * WHY A HEADER BAR. It reuses the INCOME & RESOURCES bar's look (tinted strip,
 * gold uppercase title), so the panel reads as two titled sections instead of
 * one titled section followed by loose controls.
 *
 * TWO LAYOUTS, SWITCHED IN CSS. Five names do not fit a phone, so below
 * `@min-[40rem]` the tabs give way to a single dropdown listing the plans. It
 * is a CONTAINER query on the planner box, the same mechanism as
 * `@banner-table:`, so it follows the space this bar really has, not the
 * viewport. Both layouts are always in the DOM and CSS shows one; nothing in
 * JS knows which, which is why every opener below records for itself what the
 * popover should show (`Face`) and what it is anchored to.
 *
 * SIGNED-IN ONLY. A guest has one unnamed plan on their device (`activePlanId` is
 * null), so this renders nothing, bar included. The same null covers an API
 * from before plans existed.
 *
 * THIS COMPONENT OWNS NO PLAN LOGIC. Every action is a provider function that
 * flushes the pending auto-save before it touches anything, resolves to
 * whether it worked, and toasts its own failure (CalculatorProvider, "Plans").
 * All that happens here is choosing which one to call and closing the popover
 * when it says yes. Keep it that way: the save-before-switch ordering is what
 * stops a switch losing an edit, and it must not depend on which control was
 * clicked.
 *
 * ONE POPOVER, SEVERAL FACES. The action menu, the name form (new / duplicate
 * / rename) and the delete confirmation share one panel instead of stacking a
 * dialog on a menu. On a phone that is two things to dismiss.
 *
 * THE PANEL IS PORTALLED TO <body>, the way CountStepper's pad is. The planner
 * box is `overflow-hidden` AND an `@container`, and a container is the
 * containing block for its fixed-position descendants, so a panel rendered in
 * place is clipped by that box however it is positioned. A brand new plan has
 * no rows, which makes the box shorter than the panel. The portal only ever
 * renders after a click, so it never runs while /app is being prerendered.
 */

// Gap between the anchor and the panel, and the least room kept to any
// viewport edge. Same numbers CountStepper uses.
const GAP = 6
const EDGE = 8

/**
 * What the popover is showing.
 *   list    - every plan plus the actions. The phone dropdown's menu.
 *   actions - the actions alone. The "..." menu beside the tabs, where a plan
 *             list would only repeat the tabs.
 *   the rest are the forms either menu leads to.
 */
type Face =
	| "list"
	| "actions"
	| "new"
	| "duplicate"
	| "rename"
	| "delete"
	| "resourcesOff"
	| "share"
	| "resetLink"
type NameFormFace = "new" | "duplicate" | "rename"

const isNameForm = (face: Face): face is NameFormFace =>
	face === "new" || face === "duplicate" || face === "rename"

const MENU_ITEM =
	"flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-gray-300 transition hover:bg-gray-700 hover:text-gray-100 focus-visible:bg-gray-700 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-gray-300"
const BUTTON_PRIMARY =
	"rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-black transition hover:bg-brand/85 disabled:cursor-not-allowed disabled:opacity-50"
const BUTTON_GHOST =
	"rounded-lg border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-300 transition hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
const BUTTON_DANGER =
	"rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"

// Shared by every tab. `-mb-px` pulls each one down over the bar's bottom
// border; what differs between the open tab and the rest is below.
const TAB_BASE =
	"-mb-px flex min-w-0 max-w-44 shrink items-center rounded-t-lg border px-3.5 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand disabled:cursor-not-allowed"
// The open tab takes the PANEL's background and paints its bottom border in
// that same colour, so the bar's rule breaks under it and the tab reads as
// part of the sheet below. The gold top edge is the "you are here".
const TAB_OPEN =
	"border-gray-700 border-b-gray-900 border-t-brand bg-gray-900 font-semibold text-gray-100"
const TAB_CLOSED =
	"border-transparent font-medium text-gray-400 hover:bg-gray-800 hover:text-gray-100 disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-gray-400"
// The small controls on the bar ("New" and "..."), sized to sit with the
// Income & Resources chevron box above.
const BAR_BUTTON =
	"h-8 shrink-0 items-center justify-center gap-1 rounded-md border border-gray-600 px-2 text-sm font-medium text-gray-300 transition hover:border-gray-400 hover:bg-gray-800 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-600 disabled:hover:bg-transparent disabled:hover:text-gray-300"

const FORM_COPY: Record<NameFormFace, { title: string; submit: string }> = {
	new: { title: "New plan", submit: "Create" },
	duplicate: { title: "Duplicate this plan", submit: "Duplicate" },
	rename: { title: "Rename plan", submit: "Save" }
}

const CAP_MESSAGE = `You can keep up to ${PLAN_CAP} plans.`

const copiedLine = (count: number): string =>
	count === 0 ? "Not copied yet." : count === 1 ? "Copied once." : `Copied ${count} times.`

export const PlanSwitcher = () => {
	const {
		plans,
		activePlanId,
		isPlanBusy,
		switchPlan,
		createPlan,
		renamePlan,
		deletePlan,
		setSeparateIncome,
		setPlanSharing,
		resetPlanLink
	} = useCalculatorData()

	const [open, setOpen] = useState(false)
	const [face, setFace] = useState<Face>("list")
	// The menu a form's "Back" returns to. null when the form was opened
	// straight from the bar's "New" button, where there is no menu behind it
	// and the button says "Cancel" instead.
	const [homeFace, setHomeFace] = useState<"list" | "actions" | null>(null)
	const [nameDraft, setNameDraft] = useState("")
	const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
	// Whichever control opened the popover. There are three, only some of them
	// visible at any width, so the anchor is recorded per open, not per mount.
	const anchorRef = useRef<HTMLElement | null>(null)
	const panelRef = useRef<HTMLDivElement>(null)
	const nameInputRef = useRef<HTMLInputElement>(null)

	const close = useCallback((): void => {
		setOpen(false)
		// Cleared with it, so the next open is hidden until place() has measured
		// it instead of flashing at last time's coordinates.
		setPosition(null)
	}, [])

	// Under the anchor, left edges aligned, pulled back inside the viewport if
	// it would overflow the right edge (the "..." button lives there) or the
	// bottom (then it opens upward). Fixed coordinates, so it is recomputed on
	// scroll and resize.
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
	// paints it. `face` is a dep because the faces differ in height.
	useLayoutEffect(() => {
		if (open) place()
	}, [open, face, place])

	useEffect(() => {
		if (!open) return
		// Capture phase: the scroll that matters may be on an ancestor, and
		// scroll events do not bubble.
		const reposition = (): void => place()
		// A resize can flip the container query and hide the control this panel
		// hangs from (rotating a phone does it). A hidden element has no client
		// rects, and a panel with no anchor has nowhere sensible to be.
		const handleResize = (): void => {
			if (anchorRef.current?.getClientRects().length === 0) close()
			else place()
		}
		window.addEventListener("scroll", reposition, true)
		window.addEventListener("resize", handleResize)
		const handlePointerDown = (e: PointerEvent) => {
			const target = e.target as Node
			// The panel lives in <body>, outside the bar, so both are checked.
			if (anchorRef.current?.contains(target)) return
			if (panelRef.current?.contains(target)) return
			close()
		}
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") close()
		}
		document.addEventListener("pointerdown", handlePointerDown)
		document.addEventListener("keydown", handleKeyDown)
		return () => {
			window.removeEventListener("scroll", reposition, true)
			window.removeEventListener("resize", handleResize)
			document.removeEventListener("pointerdown", handlePointerDown)
			document.removeEventListener("keydown", handleKeyDown)
		}
	}, [open, place, close])

	// Focus and select the name when a form face opens, so typing replaces the
	// suggestion straight away. In an effect because the input does not exist
	// until the face has rendered.
	const showsNameForm = isNameForm(face)
	useEffect(() => {
		if (open && showsNameForm) nameInputRef.current?.select()
	}, [open, showsNameForm])

	const activePlan = plans.find((plan) => plan.id === activePlanId)
	// Guest, an API without plans, or the list not loaded yet.
	if (activePlanId === null || !activePlan) return null

	const atCap = plans.length >= PLAN_CAP
	const isOnlyPlan = plans.length <= 1
	// `!= null` on purpose: an API older than this feature omits the key, and
	// undefined and null both mean "reads the account's stats".
	const hasOwnResources = activePlan.income_profile_id != null
	const ownResourcesTitle = "This plan has its own resources and income settings"
	// Undefined on an API older than sharing, which hides the Share item.
	const publicId = activePlan.public_id
	const isShared = activePlan.is_shared === true

	const draftFor = (kind: NameFormFace): string =>
		kind === "rename"
			? activePlan.name
			: kind === "duplicate"
				// Trimmed to fit: "<40 chars> copy" would be refused by the server.
				? `${activePlan.name} copy`.slice(0, PLAN_NAME_MAX_LENGTH)
				: ""

	/**
	 * Open the popover on `next`, anchored to the control that was clicked.
	 * Clicking the control that already has it open closes it instead.
	 */
	const openFrom = (e: MouseEvent<HTMLElement>, next: "list" | "actions" | "new"): void => {
		const clicked = e.currentTarget
		if (open && anchorRef.current === clicked) {
			close()
			return
		}
		anchorRef.current = clicked
		setPosition(null)
		setHomeFace(next === "new" ? null : next)
		if (next === "new") setNameDraft(draftFor("new"))
		setFace(next)
		setOpen(true)
	}

	const openNameForm = (kind: NameFormFace): void => {
		setNameDraft(draftFor(kind))
		setFace(kind)
	}

	const goBack = (): void => {
		if (homeFace) setFace(homeFace)
		else close()
	}

	const handleSwitch = async (planId: number): Promise<void> => {
		if (await switchPlan(planId)) close()
	}

	const handleNameSubmit = async (e: FormEvent): Promise<void> => {
		e.preventDefault()
		const name = nameDraft.trim()
		if (!name || !isNameForm(face)) return
		const worked =
			face === "rename"
				? await renamePlan(activePlan.id, name)
				: await createPlan(name, face === "duplicate" ? activePlan.id : undefined)
		if (worked) close()
	}

	const handleDelete = async (): Promise<void> => {
		if (await deletePlan(activePlan.id)) close()
	}

	const handleSeparateIncome = async (on: boolean): Promise<void> => {
		if (await setSeparateIncome(activePlan.id, on)) close()
	}

	// The share face stays open on success: it shows the change it made.
	const handleSharing = (changes: PlanSharingChanges): void => {
		void setPlanSharing(activePlan.id, changes)
	}

	const handleResetLink = async (): Promise<void> => {
		if (await resetPlanLink(activePlan.id)) setFace("share")
	}

	// Read at click time, from the page the person is on, so a link copied on a
	// local dev server points at that server. Only ever called from the open
	// panel, which never renders during a build.
	const shareLink = (id: string): string => `${window.location.origin}${sharedPlanPath(id)}`

	const copyLink = async (id: string): Promise<void> => {
		try {
			await navigator.clipboard.writeText(shareLink(id))
			toast.success("Link copied")
		} catch {
			// No clipboard access (an insecure origin, or a refused permission).
			// The link is in a text box beside the button, ready to select.
			toast.error("Couldn't copy the link. Select it and copy it yourself.")
		}
	}

	// The actions on the open plan, shared by both menus.
	const planActions = (
		<>
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
			{/* A checkbox item, not a toggle in the sheet: it is a property of the
			    plan, set rarely, and belongs with the plan's other actions. Turning
			    it OFF discards the plan's own numbers, so that direction confirms. */}
			<button
				type="button"
				role="menuitemcheckbox"
				aria-checked={hasOwnResources}
				disabled={isPlanBusy}
				onClick={() =>
					hasOwnResources ? setFace("resourcesOff") : void handleSeparateIncome(true)
				}
				className={MENU_ITEM}
			>
				<Wallet className="h-4 w-4 shrink-0" aria-hidden="true" />
				<span className="flex-1">Use separate resources for this plan</span>
				{hasOwnResources && (
					<Check className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
				)}
			</button>
			{publicId !== undefined && (
				<button
					type="button"
					role="menuitem"
					disabled={isPlanBusy}
					onClick={() => setFace("share")}
					className={MENU_ITEM}
				>
					<Share2 className="h-4 w-4 shrink-0" aria-hidden="true" />
					<span className="flex-1">Share this plan</span>
					{isShared && <span className="text-xs font-semibold text-brand">On</span>}
				</button>
			)}
			<button
				type="button"
				role="menuitem"
				disabled={isPlanBusy || isOnlyPlan}
				onClick={() => setFace("delete")}
				className={`${MENU_ITEM} text-red-400 hover:text-red-300`}
			>
				<Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
				Delete this plan
			</button>
			{/* Says why an item is greyed out, and what a plan does and does not
			    carry, which is the first thing people ask. */}
			<p className="px-2.5 pb-1 pt-2 text-xs leading-snug text-gray-400">
				{atCap ? `${CAP_MESSAGE} ` : ""}
				{hasOwnResources
					? "This plan keeps its own carats, ranks, purchases and income settings."
					: "Each plan has its own banners. Your carats, ranks and purchases are shared by all of them, unless a plan uses separate resources."}
			</p>
		</>
	)

	return (
		// Same strip as the Income & Resources header: tinted, ruled underneath,
		// gold uppercase title. `items-end` so the tabs stand on the rule.
		<div className="flex items-end gap-2 border-b border-gray-700 bg-gray-800/50 px-3 sm:gap-3 sm:px-4">
			<span className="self-center py-3 text-base font-semibold uppercase tracking-wide text-brand">
				Plans
			</span>

			{/* ── Wide: the tabs ─────────────────────────────────────────────── */}
			{/* A <nav> of buttons with aria-current, not role="tablist". The ARIA
			    tab pattern promises arrow-key roving focus and a tabpanel; these are
			    buttons that swap the sheet's rows, and saying so is the honest
			    semantics. */}
			<nav
				aria-label="Plans"
				className="hidden min-w-0 flex-1 items-end gap-1 pt-2 @min-[40rem]:flex"
			>
				{plans.map((plan) => {
					const isOpenPlan = plan.id === activePlanId
					return (
						<button
							key={plan.id}
							type="button"
							aria-current={isOpenPlan ? "true" : undefined}
							// The open tab stays enabled while busy (it does nothing when
							// clicked) so it never greys out under the person's cursor.
							disabled={isPlanBusy && !isOpenPlan}
							onClick={() => void handleSwitch(plan.id)}
							// The full name, for a tab whose label has been truncated, and
							// what the wallet glyph means when there is one.
							title={
								plan.income_profile_id != null
									? `${plan.name}. ${ownResourcesTitle}`
									: plan.name
							}
							className={`${TAB_BASE} ${isOpenPlan ? TAB_OPEN : TAB_CLOSED}`}
						>
							{plan.income_profile_id != null && (
								<Wallet
									data-testid="own-resources-marker"
									className="mr-1.5 h-3.5 w-3.5 shrink-0 text-brand"
									aria-hidden="true"
								/>
							)}
							<span className="truncate">{plan.name}</span>
						</button>
					)
				})}
				<button
					type="button"
					aria-haspopup="dialog"
					disabled={isPlanBusy || atCap}
					onClick={(e) => openFrom(e, "new")}
					title={atCap ? CAP_MESSAGE : "Start a new plan"}
					className={`${BAR_BUTTON} mb-1.5 ml-1 flex`}
				>
					<Plus className="h-4 w-4" aria-hidden="true" />
					New
				</button>
			</nav>
			<button
				type="button"
				aria-haspopup="menu"
				aria-label={`Options for ${activePlan.name}`}
				title="Duplicate, rename, share or delete this plan, or give it separate resources"
				onClick={(e) => openFrom(e, "actions")}
				className={`${BAR_BUTTON} hidden w-8 self-center @min-[40rem]:flex`}
			>
				<Ellipsis className="h-4 w-4" aria-hidden="true" />
			</button>

			{/* ── Narrow: one dropdown ───────────────────────────────────────── */}
			<button
				type="button"
				onClick={(e) => openFrom(e, "list")}
				aria-haspopup="menu"
				aria-label={`Plan: ${activePlan.name}. Open the plan menu`}
				className="ml-auto flex min-w-0 items-center gap-2 self-center rounded-lg border border-gray-600 px-3 py-1.5 text-sm transition hover:border-gray-400 hover:bg-gray-800 @min-[40rem]:hidden"
			>
				<span className="truncate font-medium text-gray-100">{activePlan.name}</span>
				<ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
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
					{face === "list" && (
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
									{plan.income_profile_id != null && (
										<Wallet
											className="ml-auto h-3.5 w-3.5 shrink-0 text-brand"
											aria-hidden="true"
										/>
									)}
								</button>
							))}

							<div className="my-1 border-t border-gray-700" />

							{/* Only in this menu: on a wide bar "New" is its own button. */}
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
							{planActions}
						</div>
					)}

					{face === "actions" && (
						<div role="menu" aria-label={`Options for ${activePlan.name}`}>
							{planActions}
						</div>
					)}

					{isNameForm(face) && (
						<form onSubmit={(e) => void handleNameSubmit(e)} className="p-2">
							<label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
								{FORM_COPY[face].title}
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
								<button type="button" onClick={goBack} className={BUTTON_GHOST}>
									{homeFace ? "Back" : "Cancel"}
								</button>
								<button
									type="submit"
									disabled={isPlanBusy || nameDraft.trim() === ""}
									className={BUTTON_PRIMARY}
								>
									{FORM_COPY[face].submit}
								</button>
							</div>
						</form>
					)}

					{face === "resourcesOff" && (
						<div className="p-2">
							<p className="text-sm text-gray-200">
								Use your account's resources for{" "}
								<span className="font-semibold">{activePlan.name}</span> again?
							</p>
							<p className="mt-1 text-xs leading-snug text-gray-400">
								The carats, ranks and income settings this plan kept for itself
								are discarded. Your account's own numbers aren't touched.
							</p>
							<div className="mt-3 flex justify-end gap-2">
								<button type="button" onClick={goBack} className={BUTTON_GHOST}>
									Back
								</button>
								<button
									type="button"
									disabled={isPlanBusy}
									onClick={() => void handleSeparateIncome(false)}
									className={BUTTON_DANGER}
								>
									Use account resources
								</button>
							</div>
						</div>
					)}

					{face === "share" && publicId !== undefined && (
						<div className="p-2">
							<p className="text-sm font-semibold text-gray-100">
								Share <span className="font-semibold">{activePlan.name}</span>
							</p>
							<label className="mt-3 flex cursor-pointer items-start gap-2.5">
								<input
									type="checkbox"
									role="switch"
									checked={isShared}
									disabled={isPlanBusy}
									onChange={(e) => handleSharing({ is_shared: e.target.checked })}
									className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
								/>
								<span>
									<span className="block text-sm text-gray-200">Share with a link</span>
									<span className="block text-xs leading-snug text-gray-400">
										Anyone with the link can copy this plan into their own. They can't change yours.
									</span>
								</span>
							</label>

							{isShared && (
								<div className="mt-3 flex gap-2">
									<input
										type="text"
										readOnly
										aria-label="Share link"
										value={shareLink(publicId)}
										onFocus={(e) => e.target.select()}
										className="min-w-0 flex-1 rounded-lg border border-gray-600 bg-gray-900 px-2.5 py-1.5 text-xs text-gray-200 outline-none focus:border-brand"
									/>
									<button
										type="button"
										onClick={() => void copyLink(publicId)}
										className={BUTTON_GHOST}
									>
										Copy
									</button>
								</div>
							)}

							{/* Off and greyed until sharing is on, so the owner can read what
							    each one would hand out before turning anything on. */}
							<label className={`mt-3 flex items-start gap-2.5 ${isShared ? "cursor-pointer" : "opacity-50"}`}>
								<input
									type="checkbox"
									checked={activePlan.share_stats === true}
									disabled={isPlanBusy || !isShared}
									onChange={(e) => handleSharing({ share_stats: e.target.checked })}
									className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
								/>
								<span>
									<span className="block text-sm text-gray-200">Include my resources</span>
									<span className="block text-xs leading-snug text-gray-400">
										Copies start with your carats, tickets and ranks. Your planned purchases stay private.
									</span>
								</span>
							</label>
							<label className={`mt-2 flex items-start gap-2.5 ${isShared ? "cursor-pointer" : "opacity-50"}`}>
								<input
									type="checkbox"
									checked={activePlan.share_notes === true}
									disabled={isPlanBusy || !isShared}
									onChange={(e) => handleSharing({ share_notes: e.target.checked })}
									className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
								/>
								<span>
									<span className="block text-sm text-gray-200">Include my notes</span>
									<span className="block text-xs leading-snug text-gray-400">
										Copies keep the notes you wrote on each banner.
									</span>
								</span>
							</label>

							<p className="mt-3 text-xs text-gray-400">
								{copiedLine(activePlan.copy_count ?? 0)}
							</p>

							<div className="mt-3 flex justify-between gap-2">
								{isShared ? (
									<button
										type="button"
										disabled={isPlanBusy}
										onClick={() => setFace("resetLink")}
										className={BUTTON_GHOST}
									>
										Reset link
									</button>
								) : (
									<span />
								)}
								<button type="button" onClick={goBack} className={BUTTON_GHOST}>
									{homeFace ? "Back" : "Close"}
								</button>
							</div>
						</div>
					)}

					{face === "resetLink" && (
						<div className="p-2">
							<p className="text-sm text-gray-200">
								Reset the link for <span className="font-semibold">{activePlan.name}</span>?
							</p>
							<p className="mt-1 text-xs leading-snug text-gray-400">
								The old link stops working, so anyone you sent it to will need the new one.
								Copies people already made are theirs to keep.
							</p>
							<div className="mt-3 flex justify-end gap-2">
								<button type="button" onClick={() => setFace("share")} className={BUTTON_GHOST}>
									Back
								</button>
								<button
									type="button"
									disabled={isPlanBusy}
									onClick={() => void handleResetLink()}
									className={BUTTON_DANGER}
								>
									Reset link
								</button>
							</div>
						</div>
					)}

					{face === "delete" && (
						<div className="p-2">
							<p className="text-sm text-gray-200">
								Delete <span className="font-semibold">{activePlan.name}</span>?
							</p>
							<p className="mt-1 text-xs leading-snug text-gray-400">
								Its banners are deleted with it. This can't be undone. Your other
								plans, carats and purchases stay as they are.
							</p>
							<div className="mt-3 flex justify-end gap-2">
								<button type="button" onClick={goBack} className={BUTTON_GHOST}>
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
	)
}
