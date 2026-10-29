import { useCallback, useEffect, useRef, useState } from "react"

interface UseAutoSaveParams {
	saveFn: () => Promise<void>
	delayMs?: number
}

/**
 * Manages a debounced auto-save with a visual indicator.
 * Returns `timerIsGoing` (whether a save is pending), `saveNow` (to flush
 * immediately), `cancelTimer` (to drop a pending save unrun) and `waitForSave`
 * (to wait out a save already sent).
 * The hook also registers a beforeunload warning when a save is pending.
 */
export function useAutoSave({ saveFn, delayMs = 5000 }: UseAutoSaveParams) {
	const [timerIsGoing, setTimerIsGoing] = useState(false)
	const timer = useRef<number | null>(null)
	const saveFnRef = useRef(saveFn)
	// The save currently on the wire, if any. See waitForSave.
	const inFlight = useRef<Promise<void> | null>(null)

	// Keep the save function ref current without triggering re-renders
	useEffect(() => {
		saveFnRef.current = saveFn
	}, [saveFn])

	// Warn on page unload if a save is pending
	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (timerIsGoing) {
				e.preventDefault()
				e.returnValue = ""
			}
		}
		window.addEventListener("beforeunload", handleBeforeUnload)
		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload)
		}
	}, [timerIsGoing])

	// Every save goes through here, so inFlight always names the latest one.
	const runSave = useCallback(async () => {
		const save = saveFnRef.current()
		inFlight.current = save
		try {
			await save
		} finally {
			if (inFlight.current === save) inFlight.current = null
		}
	}, [])

	const startTimer = useCallback(() => {
		if (timer.current) {
			clearTimeout(timer.current)
		}
		setTimerIsGoing(true)
		// Use an async IIFE so we can await the save before clearing the indicator.
		// Without await, setTimerIsGoing(false) would fire before the network request
		// finishes, making the UI look done while the save is still in flight.
		timer.current = window.setTimeout(() => {
			void (async () => {
				await runSave()
				setTimerIsGoing(false)
			})()
		}, delayMs)
	}, [delayMs, runSave])

	const saveNow = useCallback(async () => {
		if (timer.current) {
			clearTimeout(timer.current)
		}
		await runSave()
		setTimerIsGoing(false)
	}, [runSave])

	// Drop a pending save WITHOUT running it. For the one case where the thing
	// the timer would save no longer exists: the user deleted the plan they were
	// editing. Letting it fire would PATCH a plan id the server just removed and
	// show "Save failed" for an edit nobody wants saved.
	const cancelTimer = useCallback(() => {
		if (timer.current) {
			clearTimeout(timer.current)
			timer.current = null
		}
		setTimerIsGoing(false)
	}, [])

	// Resolves once the save already on the wire has finished, however it went;
	// at once if there is none. cancelTimer can't call back a save the timer has
	// already fired, and a request sent while it is still running races it on
	// the server: deleting the plan being saved deadlocked Postgres
	// (2026-10-28). Never rejects, since the caller only wants it out of the way.
	const waitForSave = useCallback(async () => {
		await inFlight.current?.catch(() => undefined)
	}, [])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (timer.current) {
				clearTimeout(timer.current)
			}
		}
	}, [])

	return { timerIsGoing, startTimer, saveNow, cancelTimer, waitForSave }
}