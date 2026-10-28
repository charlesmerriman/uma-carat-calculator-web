/**
 * Filters that say their state (mocks 03-guides.png, the Scenario menu open
 * in 05-guides-scenario-menu.png): a row of pills, each "Label state"
 * ("Scenario 3 of 12"), a menu of tick boxes behind each, and a token line
 * for whatever differs from "everything on". Replaces the old 38-chip grid;
 * the source sheet's filters stay one to one, only their housing changed.
 *
 *   FilterToolbar   the row; keeps which menu is open (one at a time)
 *   FilterPill      a pill and its menu; `changed` draws it in brand
 *   GroupPill       a FilterGroup (a filter as data) as its pill; the phone
 *                   sheet (FilterSheet.tsx) draws the same groups
 *   TickItems       a menu's tick boxes, each with a muted count
 *   Tokens          "Showing 11 guides ... for [token ×] Reset"
 *   tickSummary     a pill's state from its ticks (tickSummary.ts)
 *
 * A menu closes on a click outside it, on Escape (focus goes back to its
 * pill) and when another opens. Every control is a real button, checkbox or
 * select, so the keyboard reaches all of it.
 */

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react"
import { ChevronDown, X } from "lucide-react"

const OpenMenu = createContext<{ open: string | null; setOpen: (id: string | null) => void } | null>(null)

export function FilterToolbar({ children, className = "" }: { children: ReactNode; className?: string }) {
	const [open, setOpen] = useState<string | null>(null)
	return (
		<OpenMenu.Provider value={{ open, setOpen }}>
			<div role="group" aria-label="Filters" className={`flex flex-wrap items-center gap-1.5 ${className}`}>
				{children}
			</div>
		</OpenMenu.Provider>
	)
}

export function FilterPill({ label, state, changed, title, onAll, children }: {
	label: string
	/** Bold after the label: "All guides", "3 of 12". */
	state: string
	/** Differs from the default (everything on): drawn in brand. */
	changed: boolean
	/** The menu's small heading ("Training scenario"). */
	title: string
	/** Ticks every box; the menu's "All" button. Omit for a menu with no boxes. */
	onAll?: () => void
	children: ReactNode
}) {
	const id = useId()
	const menu = useContext(OpenMenu)
	const open = menu?.open === id
	const wrapRef = useRef<HTMLDivElement>(null)
	const buttonRef = useRef<HTMLButtonElement>(null)

	useEffect(() => {
		if (!open) return
		const onDown = (event: MouseEvent) => {
			if (!wrapRef.current?.contains(event.target as Node)) menu?.setOpen(null)
		}
		document.addEventListener("mousedown", onDown)
		return () => document.removeEventListener("mousedown", onDown)
	}, [open, menu])

	return (
		<div
			ref={wrapRef}
			className="relative"
			onKeyDown={(event) => {
				if (event.key === "Escape" && open) {
					event.stopPropagation()
					menu?.setOpen(null)
					buttonRef.current?.focus()
				}
			}}
		>
			<button
				ref={buttonRef}
				type="button"
				aria-expanded={open}
				aria-controls={`${id}-menu`}
				onClick={() => menu?.setOpen(open ? null : id)}
				className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border py-[5px] pl-[11px] pr-2.5 text-xs transition ${
					changed ? "border-brand bg-brand/15 text-brand" : "border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500"
				}`}
			>
				{label} <b className={`font-semibold ${changed ? "text-brand" : "text-gray-100"}`}>{state}</b>
				<ChevronDown className={`h-[13px] w-[13px] transition-transform ${changed ? "" : "text-gray-400"} ${open ? "rotate-180" : ""}`} aria-hidden="true" />
			</button>
			{open && (
				<div
					id={`${id}-menu`}
					role="group"
					aria-label={title}
					className="absolute left-0 top-[calc(100%+6px)] z-30 flex max-h-[min(70vh,28rem)] min-w-[15rem] flex-col gap-1 overflow-y-auto rounded-[10px] border border-gray-600 bg-gray-800 p-2 shadow-2xl"
				>
					<div className="flex items-center justify-between px-1.5 pb-1.5 pt-0.5 text-[11px] text-gray-400">
						<span>{title}</span>
						{onAll && (
							<button type="button" onClick={onAll} className="text-brand transition hover:text-brand/75">
								All
							</button>
						)}
					</div>
					{children}
				</div>
			)}
		</div>
	)
}

/** One tick box: what the pills' menus and the phone sheet both draw. */
export interface TickItem {
	key: string
	label: string
	/** Muted at the right: "38 guides", "214". */
	count?: ReactNode
	on: boolean
	toggle: () => void
}

/**
 * A tick-box filter as data, so the toolbar's pill and the phone sheet
 * (FilterSheet.tsx) read one definition: its pill's label and state, the
 * menu's title, its boxes in one or more sections (Include has two), and
 * how to put it back to everything on.
 */
export interface FilterGroup {
	key: string
	label: string
	title: string
	state: string
	changed: boolean
	reset: () => void
	sections: TickItem[][]
	/** In the sheet, show the ticked boxes only behind "Show all N" (Scenario's twelve). */
	collapse?: boolean
}

export function TickItems({ items }: { items: TickItem[] }) {
	return (
		<>
			{items.map((item) => (
				<label key={item.key} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-[5px] text-xs text-gray-100 transition hover:bg-gray-700">
					<input type="checkbox" checked={item.on} onChange={item.toggle} className="h-3.5 w-3.5 shrink-0 accent-brand" />
					<span className="min-w-0 flex-1">{item.label}</span>
					{item.count !== undefined && <span className="shrink-0 text-[11px] tabular-nums text-gray-400">{item.count}</span>}
				</label>
			))}
		</>
	)
}

/** A FilterGroup as a pill with its menu. */
export function GroupPill({ group }: { group: FilterGroup }) {
	return (
		<FilterPill label={group.label} state={group.state} changed={group.changed} title={group.title} onAll={group.reset}>
			{group.sections.map((items, index) => (
				<div key={index} className={index > 0 ? "mt-0.5 border-t border-gray-600 pt-1" : ""}>
					<TickItems items={items} />
				</div>
			))}
		</FilterPill>
	)
}

export interface FilterToken {
	key: string
	label: string
	/** What the × button is read as: "Remove the Scenario filter". */
	removeLabel: string
	onRemove: () => void
}

/** The line under the toolbar: what's counted, a token per changed filter, and Reset. */
export function Tokens({ summary, tokens, onReset }: { summary: ReactNode; tokens: FilterToken[]; onReset: () => void }) {
	return (
		<p className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-400">
			<span>{summary}</span>
			{tokens.map((token) => (
				<span
					key={token.key}
					className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/15 py-[3px] pl-2.5 pr-1.5 text-brand"
				>
					{token.label}
					<button type="button" aria-label={token.removeLabel} title={token.removeLabel} onClick={token.onRemove} className="rounded-full transition hover:text-brand/75">
						<X className="h-[11px] w-[11px]" aria-hidden="true" />
					</button>
				</span>
			))}
			{tokens.length > 0 && (
				<button type="button" onClick={onReset} className="text-brand transition hover:text-brand/75">
					Reset
				</button>
			)}
		</p>
	)
}
