/**
 * The Rankings page's tabs, in order, shared by the page's tab bar and the
 * pinned panel's section menu. A plain module (no components) so both can
 * import it. A `gated` tab is drawn only for the Raptive gate
 * (useRankingsPullPlans).
 */

import { BookOpen, CalendarRange, Swords, Users, type LucideIcon } from "lucide-react"
import { useRankingsPullPlans } from "../../hooks/useRankingsPullPlans"
import type { RankingsSection } from "../../services/rankingsPinStore"

export interface SectionEntry {
	id: RankingsSection
	label: string
	icon: LucideIcon
	gated?: boolean
}

const SECTIONS: SectionEntry[] = [
	{ id: "guides", label: "Guide rankings", icon: BookOpen },
	{ id: "pull-plans", label: "Pull plans", icon: CalendarRange, gated: true },
	{ id: "pvp", label: "PvP", icon: Swords },
	{ id: "players", label: "Players", icon: Users },
]

/** The tabs this reader may open. */
export function useVisibleSections(): SectionEntry[] {
	const pullPlans = useRankingsPullPlans()
	return SECTIONS.filter((entry) => !entry.gated || pullPlans)
}

/** The section a `?view=` value (or a stored pin) names among `shown`; anything else is the first tab. */
export function parseSection(value: string | null, shown: SectionEntry[]): RankingsSection {
	return shown.find((entry) => entry.id === value)?.id ?? "guides"
}

/** The Rankings page on one tab. */
export function sectionHref(section: RankingsSection): string {
	return section === "guides" ? "/app/rankings" : `/app/rankings?view=${section}`
}
