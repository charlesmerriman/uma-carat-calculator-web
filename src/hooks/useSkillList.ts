/**
 * GET /skills, shared through the module-level promise in skillsFetchCalls.ts.
 *
 * Returns [] until the list arrives, and stays [] if it fails: the guide
 * editor treats an empty list as "nothing to add" and goes on with global's
 * skills. The Skills page, which needs the list itself, reads the status.
 */

import { useEffect, useState } from "react"
import { loadSkillList } from "../services/skillsFetchCalls"
import type { SkillListRow } from "../types/skills"

const NONE: SkillListRow[] = []

export type SkillListState = { status: "loading" } | { status: "error" } | { status: "ready"; rows: SkillListRow[] }

export function useSkillListState(): SkillListState {
	const [state, setState] = useState<SkillListState>({ status: "loading" })
	useEffect(() => {
		let live = true
		loadSkillList()
			.then((rows) => {
				if (live) setState({ status: "ready", rows })
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
