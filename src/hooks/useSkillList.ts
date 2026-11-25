/**
 * GET /skills, shared through the module-level promise in skillsFetchCalls.ts.
 *
 * Returns [] until the list arrives, and stays [] if it fails: the guide
 * editor treats an empty list as "nothing to add" and goes on with global's
 * skills. The Skills page, which needs the list itself, reads the status.
 */

import { useEffect, useState } from "react"
import { loadSkillList, skillListIfLoaded } from "../services/skillsFetchCalls"
import type { SkillListRow } from "../types/skills"

const NONE: SkillListRow[] = []

export type SkillListState = { status: "loading" } | { status: "error" } | { status: "ready"; rows: SkillListRow[] }

export function useSkillListState(): SkillListState {
	// Already fetched this page load (a way back to the Skills page): ready in
	// the first render, so the rows are there when the scroll is put back
	// (hooks/useScrollReset.ts) instead of a skeleton for one render. A fresh
	// load starts "loading", which is also what the prerender drew.
	const [state, setState] = useState<SkillListState>(() => {
		const rows = skillListIfLoaded()
		return rows ? { status: "ready", rows } : { status: "loading" }
	})
	useEffect(() => {
		let live = true
		loadSkillList()
			.then((rows) => {
				// The same array when it was already here, so nothing re-renders.
				if (live) setState((was) => (was.status === "ready" && was.rows === rows ? was : { status: "ready", rows }))
			})
			.catch((error: unknown) => {
				console.error(error)
				if (live) setState({ status: "error" })
			})
		return () => {
			live = false
		}
	}, [])
	return state
}

/** The rows, or a stable [] while loading or after a failure. */
export function useSkillList(): SkillListRow[] {
	const state = useSkillListState()
	return state.status === "ready" ? state.rows : NONE
}

/**
 * HOW FAR THE SKILLS LIST WAS DRAWN, for the way back to it (Daptrius, board
 * "Skills Load Issues with Scrolled Pages", 2026-11-25). The list draws a
 * page of rows and grows as you scroll. Coming back to it, by Back or a link,
 * put the scroll back where you were but drew 60 rows again, so the rows you
 * had been reading arrived a page at a time from the top, over a second or
 * two. Kept with the filters it was drawn for, so a different search still
 * starts at one page. Module scope, like useScrollReset's offsets: a reload
 * forgets both and starts at the top.
 */
let drawnRows: { filters: string; count: number } | null = null

/** How many rows the list had drawn when it was left with these filters, if it was. */
export function skillRowsDrawn(filters: string): number | null {
	return drawnRows?.filters === filters ? drawnRows.count : null
}

export function rememberSkillRowsDrawn(filters: string, count: number): void {
	drawnRows = { filters, count }
}

/** Tests only (test/setup.ts, after each): forget it, so one test's scrolling doesn't reach the next. */
export function forgetSkillRowsDrawn(): void {
	drawnRows = null
}
