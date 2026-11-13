/**
 * The Encyclopedia's frame: its title and the three lists' tabs (Umas,
 * Support cards, Skills), and the supporters-first gate every Encyclopedia
 * page sits behind. The frame follows the Rankings page: a display-face
 * title, one line saying what this is, underlined tabs (encyclopedia.css).
 *
 * THE GATE (owner, 2026-11-12: supporters and staff first): early access
 * draws the page; anyone else gets SupportersFirstNote, as Rankings does. The
 * API refuses them too (401 / 403); this only decides what to draw.
 */

import type { ReactNode } from "react"
import { NavLink } from "react-router-dom"
import { BookOpen, Layers, Users, Zap } from "lucide-react"
import { useSkillsPreview } from "../../hooks/useSkillsPreview"
import { CARD_LIST_PATH, SKILL_LIST_PATH, UMA_LIST_PATH } from "../../utils/encyclopediaRoutes"
import { SupportersFirstNote } from "../SupportersFirstNote"
import { PAGE_CONTAINER } from "../../utils/encyclopedia"

const TABS = [
	{ to: UMA_LIST_PATH, label: "Umas", icon: Users },
	{ to: CARD_LIST_PATH, label: "Support cards", icon: Layers },
	{ to: SKILL_LIST_PATH, label: "Skills", icon: Zap },
]

function Title() {
	return (
		<h1 className="enc-head__title">
			<BookOpen aria-hidden="true" />
			Encyclopedia
		</h1>
	)
}

/** Children only for early access; the note for anyone else. */
export function EncyclopediaGate({ children }: { children: ReactNode }) {
	const allowed = useSkillsPreview()
	if (!allowed) {
		return (
			<div className={PAGE_CONTAINER}>
				<header className="enc-head">
					<Title />
				</header>
				<SupportersFirstNote feature="The Encyclopedia is" className="card-panel p-4" />
			</div>
		)
	}
	return <>{children}</>
}

export function EncyclopediaTabs() {
	return (
		<header className="enc-head">
			<Title />
			<p className="enc-head__sub">Every uma, support card and skill in the game, on global and in JP.</p>
			<nav aria-label="Encyclopedia" className="enc-tabs">
				{/* NavLink marks the open list with aria-current="page", which is what the rule under it keys off. */}
				{TABS.map(({ to, label, icon: Icon }) => (
					<NavLink key={to} to={to} end className="enc-tab">
						<Icon aria-hidden="true" />
						{label}
					</NavLink>
				))}
			</nav>
		</header>
	)
}
