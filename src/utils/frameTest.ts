/**
 * A TEMPORARY switch for trying a frame fix on a real iPhone before it ships.
 *
 * On an iPhone at the default zoom, about one device pixel of an uma's art
 * shows past her frame's outer edge (board "Issues with Uma SVG Alignment on
 * iOS", 2026-11-17). Nothing here can run iOS Safari, and two fixes written
 * blind went live and missed, the second breaking every frame (web #379). So
 * the candidates live in App.css ("Frame test"), off for everyone, and a
 * tester turns one on for their own tab:
 *
 *   ?frametest=clip    the art keeps its size; its outer 12 units aren't painted
 *   ?frametest=inset   web #379's layout (the art at 96.85%), as a control
 *   ?frametest=off     back to normal
 *
 * The choice is kept for the tab (sessionStorage), so it survives moving
 * between pages and a reload, and a label in the corner says it is on. It
 * sets one attribute on <html>, outside React's root, so hydration never
 * sees it.
 *
 * Delete this file, its call in main.tsx and the "Frame test" block in
 * App.css once the iPhone report is closed.
 */

const STORAGE_KEY = "uma-frame-test"
const VARIANTS = ["clip", "inset"]

/** Client-only: called once from main.tsx, before the app renders. */
export function applyFrameTest(): void {
	try {
		const asked = new URLSearchParams(window.location.search).get("frametest")
		if (asked !== null) {
			// Anything that isn't a known variant ("off" included) turns it off.
			if (VARIANTS.includes(asked)) sessionStorage.setItem(STORAGE_KEY, asked)
			else sessionStorage.removeItem(STORAGE_KEY)
		}
		const variant = sessionStorage.getItem(STORAGE_KEY)
		if (variant && VARIANTS.includes(variant)) document.documentElement.dataset.frameTest = variant
	} catch {
		// Storage can be blocked (a private tab): the site just draws as normal.
	}
}
