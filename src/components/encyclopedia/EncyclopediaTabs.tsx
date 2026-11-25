/**
 * The Encyclopedia's frame: the wrapper every Encyclopedia page renders through.
 *
 * The lists' masthead (the title, one line, and the three lists as tabs) is
 * the shared screen header now (EncyclopediaScreenTabs, mounted by AppShell
 * above the page; owner, 2026-11-25), the same one the Calculator, the
 * Timeline and Rankings draw.
 *
 * OPEN TO EVERYONE since 2026-11-18 (the owner; supporters and staff had it
 * first, from 2026-11-12). The wrapper was the supporters-first gate until
 * then; it only adds the back-to-top arrow now.
 */

import type { ReactNode } from "react"
import { FloatingBackToTop } from "../BackToTop"
import { useBackToTop } from "../../hooks/useBackToTop"

/**
 * What every list and every uma, card and skill page renders through: the
 * page, plus the floating "back to top" arrow (Daptrius, board "Mobile UI
 * issues on Encyclopedia", 2026-11-13). The anchor is an empty node above the
 * page; useBackToTop measures it and scrolls it into view, whichever element
 * is the live scroller.
 */
export function EncyclopediaFrame({ children }: { children: ReactNode }) {
	const { topRef, isAwayFromTop, scrollToTop } = useBackToTop()
	return (
		<>
			<div ref={topRef} aria-hidden="true" />
			{children}
			<FloatingBackToTop onClick={scrollToTop} visible={isAwayFromTop} column="72rem" />
		</>
	)
}
