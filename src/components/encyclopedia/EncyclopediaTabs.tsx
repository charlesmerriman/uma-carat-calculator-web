/**
 * The Encyclopedia's frame: its masthead (the title large, one line saying
 * what this is) and the wrapper every Encyclopedia page renders through.
 *
 * The three lists' tabs used to sit in the masthead with each list's count as
 * their headline ("270 Umas"). The Encyclopedia's screen bar names the lists
 * now, pinned while a list scrolls (EncyclopediaScreenTabs, web #512), so the
 * owner dropped the masthead's tabs and their counts (2026-11-25). The
 * `.enc-tabs` / `.enc-tab` rules stay in encyclopedia.css: the Rankings page
 * draws its tabs with them.
 *
 * OPEN TO EVERYONE since 2026-11-18 (the owner; supporters and staff had it
 * first, from 2026-11-12). The wrapper was the supporters-first gate until
 * then; it only adds the back-to-top arrow now.
 */

import type { ReactNode } from "react"
import { BookOpen } from "lucide-react"
import { FloatingBackToTop } from "../BackToTop"
import { useBackToTop } from "../../hooks/useBackToTop"

function Title() {
	return (
		<h1 className="enc-head__title">
			<BookOpen aria-hidden="true" />
			Encyclopedia
		</h1>
	)
}

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

/** The three lists' masthead: the title and what the Encyclopedia holds. */
export function EncyclopediaTabs() {
	return (
		<header className="enc-head enc-head--mast">
			<div>
				<Title />
				<p className="enc-head__sub">Every uma, support card and skill in the game, on global and in JP.</p>
			</div>
		</header>
	)
}
