/**
 * The course map's draw-in (owner, 2026-11-02, "Motion"): the first time the
 * map is on screen, it traces itself from the gate to the finish, once.
 *
 * `progress` is a motion value that is 1 ("fully drawn") on the first paint,
 * so the prerendered page shows the finished map; after mount an
 * IntersectionObserver sets it to 0 and animates it to 1. The strip turns it
 * into a clip, the track into each line's drawn length; nothing re-renders
 * through React per frame. Reduced motion, or a browser (or test DOM) without
 * an observer, leaves the map still.
 */
import { useEffect, useRef } from "react"
import { animate, useMotionValue, useReducedMotion } from "framer-motion"

export function useDrawIn<T extends Element>(duration = 1) {
	const reduceMotion = useReducedMotion()
	const ref = useRef<T>(null)
	const progress = useMotionValue(1)

	useEffect(() => {
		const element = ref.current
		if (reduceMotion || !element || typeof IntersectionObserver === "undefined") return
		let controls: ReturnType<typeof animate> | undefined
		const observer = new IntersectionObserver(([entry]) => {
			if (!entry?.isIntersecting) return
			observer.disconnect()
			progress.set(0)
			controls = animate(progress, 1, { duration, ease: [0.4, 0, 0.2, 1] })
		}, { threshold: 0.3 })
		observer.observe(element)
		return () => {
			observer.disconnect()
			controls?.stop()
			progress.set(1)
		}
	}, [reduceMotion, progress, duration])

	return { ref, progress }
}
