import { useState, type Dispatch, type SetStateAction } from "react"

/**
 * Open/closed state that outlives the page, until a reload (Daptrius,
 * 2026-10-30: panels closing themselves on every page change). A reload clearing
 * it is the point: it's the quick way back to the defaults, so this is module
 * scope rather than storage. View state only, never part of a plan or a save.
 *
 * Only reachable behind a click or inside /app, so a prerender never writes it.
 */
const remembered = new Map<string, boolean>()

export function useRememberedOpen(key: string | null, initial: boolean | (() => boolean) = false): [boolean, Dispatch<SetStateAction<boolean>>] {
	const [open, setOpen] = useState(() => {
		const saved = key === null ? undefined : remembered.get(key)
		if (saved !== undefined) return saved
		return typeof initial === "function" ? initial() : initial
	})
	const set: Dispatch<SetStateAction<boolean>> = (next) => {
		const value = typeof next === "function" ? next(open) : next
		if (key !== null) remembered.set(key, value)
		setOpen(value)
	}
	return [open, set]
}

/** Test setup: one test's open panel must not reach the next. */
export function forgetRememberedOpen(): void {
	remembered.clear()
}
