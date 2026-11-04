/**
 * Walk the course (owner, 2026-11-02, "Motion"): a Play button runs a marker
 * from the gate to the line at a compressed pace, the same few seconds on any
 * course, lighting each label as it passes. The marker is a metre on a motion
 * value (`cursor`, -1 while no walk runs), which both the strip and the track
 * read, so no React render happens per frame; it is the run view's cursor
 * before the run view exists.
 *
 * Under reduced motion it never glides: it steps phase by phase.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { animate, useMotionValue, useReducedMotion } from "framer-motion"
import { phaseStarts } from "../../utils/courseGeometry"

const WALK_SECONDS = 6
const STEP_MS = 900
// How long the marker rests on the line before it clears.
const REST_MS = 1000

export function useWalk(distance: number) {
	const reduceMotion = useReducedMotion()
	const cursor = useMotionValue(-1)
	const [walking, setWalking] = useState(false)
	const stopCurrent = useRef<(() => void) | null>(null)

	const stop = useCallback(() => {
		stopCurrent.current?.()
		stopCurrent.current = null
		cursor.set(-1)
		setWalking(false)
	}, [cursor])

	const play = useCallback(() => {
		stopCurrent.current?.()
		setWalking(true)
		const timers: ReturnType<typeof setTimeout>[] = []
		const finish = () => timers.push(setTimeout(() => {
			cursor.set(-1)
			setWalking(false)
		}, REST_MS))

		if (reduceMotion) {
			const { mid, late, finalSixth } = phaseStarts(distance)
			const stops = [0, mid, late, finalSixth, distance]
			stops.forEach((metre, index) => timers.push(setTimeout(() => {
				cursor.set(metre)
				if (index === stops.length - 1) finish()
			}, index * STEP_MS)))
			stopCurrent.current = () => timers.forEach(clearTimeout)
			return
		}

		cursor.set(0)
		const animation = animate(cursor, distance, { duration: WALK_SECONDS, ease: "linear", onComplete: finish })
		stopCurrent.current = () => {
			animation.stop()
			timers.forEach(clearTimeout)
		}
	}, [cursor, distance, reduceMotion])

	// Leaving the page mid-walk stops it.
	useEffect(() => () => stopCurrent.current?.(), [])

	return { cursor, walking, play, stop }
}
