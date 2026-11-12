/**
 * The Encyclopedia's frame: the three lists' tab strip (Umas, Support cards,
 * Skills) and the supporters-first gate every Encyclopedia page sits behind.
 *
 * THE GATE (owner, 2026-11-12: supporters and staff first): early access
 * draws the page; anyone else gets SupportersFirstNote, as Rankings does. The
 * API refuses them too (401 / 403); this only decides what to draw.
 */

import type { ReactNode } from "react"
import { NavLink } from "react-router-dom"
import { BookOpen } from "lucide-react"
import { useSkillsPreview } from "../../hooks/useSkillsPreview"
import { CARD_LIST_PATH, SKILL_LIST_PATH, UMA_LIST_PATH } from "../../utils/encyclopediaRoutes"
import { SupportersFirstNote } from "../SupportersFirstNote"
import { PAGE_CONTAINER } from "../../utils/encyclopedia"

const TABS = [
	{ to: UMA_LIST_PATH, label: "Umas" },
	{ to: CARD_LIST_PATH, label: "Support cards" },
	{ to: SKILL_LIST_PATH, label: "Skills" },
]

/** Children only for early access; the note for anyone else. */
export function EncyclopediaGate({ children }: { children: ReactNode }) {
	const allowed = useSkillsPreview()
	if (!allowed) {
		return (
			<div className={PAGE_CONTAINER}>
				<SupportersFirstNote feature="The Encyclopedia is" />
			</div>
		)
	}
	return <>{children}</>
}

export function EncyclopediaTabs() {
	return (
		<header className="flex flex-col gap-2">
			<h1 className="font-display flex items-center gap-2 text-xl font-bold text-brand">
				<BookOpen className="h-5 w-5 shrink-0" />
				Encyclopedia
			</h1>
			<nav aria-label="Encyclopedia" className="flex flex-wrap gap-1">
				{TABS.map((tab) => (
					<NavLink
						key={tab.to}
						to={tab.to}
						end
						className={({ isActive }) => `rounded-lg border px-3 py-1.5 text-sm transition ${
							isActive ? "border-brand/50 bg-brand/10 text-brand" : "border-gray-600 text-gray-300 hover:border-gray-500"
						}`}
					>
						{tab.label}
					</NavLink>
				))}
			</nav>
		</header>
	)
}
