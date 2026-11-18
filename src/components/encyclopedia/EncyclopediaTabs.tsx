/**
 * The Encyclopedia's frame: its title and the three lists' tabs (Umas,
 * Support cards, Skills), and the wrapper every Encyclopedia page renders
 * through. A masthead: the title large, one line saying what this is, and the
 * three lists as tabs whose headline is how many each holds ("270 Umas"),
 * once some page this session has counted them (utils/encyclopediaCounts.ts).
 *
 * OPEN TO EVERYONE since 2026-11-18 (the owner; supporters and staff had it
 * first, from 2026-11-12). The wrapper was the supporters-first gate until
 * then; it only adds the back-to-top arrow now.
 */

import type { ReactNode } from "react"
import { NavLink } from "react-router-dom"
import { BookOpen } from "lucide-react"
import { CARD_LIST_PATH, SKILL_LIST_PATH, UMA_LIST_PATH } from "../../utils/encyclopediaRoutes"
import { FloatingBackToTop } from "../BackToTop"
import { useBackToTop } from "../../hooks/useBackToTop"
import { useEncyclopediaCounts, type EncyclopediaKind } from "../../utils/encyclopediaCounts"

const TABS: { to: string; label: string; kind: EncyclopediaKind }[] = [
	{ to: UMA_LIST_PATH, label: "Umas", kind: "umas" },
	{ to: CARD_LIST_PATH, label: "Support cards", kind: "cards" },
	{ to: SKILL_LIST_PATH, label: "Skills", kind: "skills" },
]

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

export function EncyclopediaTabs() {
	const counts = useEncyclopediaCounts()
	return (
		<header className="enc-head enc-head--mast">
			<div>
				<Title />
				<p className="enc-head__sub">Every uma, support card and skill in the game, on global and in JP.</p>
			</div>
			<nav aria-label="Encyclopedia" className="enc-tabs">
				{/* NavLink marks the open list with aria-current="page", which is what the rule under it keys off. */}
				{TABS.map(({ to, label, kind }) => (
					<NavLink key={to} to={to} end className="enc-tab">
						{/* The count leads once it is known; the name alone until then. */}
						{/* The space is for the link's name ("270 Umas"); the tab is a column, so it draws nothing. */}
						{counts[kind] !== undefined && <><b>{counts[kind]?.toLocaleString("en-US")}</b>{" "}</>}
						<span>{label}</span>
					</NavLink>
				))}
			</nav>
		</header>
	)
}
