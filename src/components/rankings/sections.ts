/**
 * The Rankings page's tabs, in order, shared by the page's tab bar and the
 * pinned panel's section menu. A plain module (no components) so both can
 * import it. A `gated` tab is drawn only for the Raptive gate
 * (useRankingsPullPlans).
 */

import { useMemo, useState } from "react"
import { BookOpen, CalendarRange, Swords, Users, type LucideIcon } from "lucide-react"
import { useRankingsPullPlans } from "../../hooks/useRankingsPullPlans"
import { useCalculatorData } from "../../services/CalculatorContext"
import type { RankingsSection } from "../../services/rankingsPinStore"
import { defaultPvpEvent, findEvent, raceEventsInOrder } from "../../utils/pvpGuide"
import { parsePvpEvent, shortEventName } from "../../utils/pvpEvent"

export interface SectionEntry {
	id: RankingsSection
	label: string
	icon: LucideIcon
	gated?: boolean
}

const SECTIONS: SectionEntry[] = [
	{ id: "guides", label: "Guides", icon: BookOpen },
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

/**
 * The small badge after each tab's name (mock 03-guides.png): how many
 * events have a published guide, and the PvP tab's event ("CM 21": the one
 * in `pvpEvent`, else the running or next one). Read from the calculator's
 * events, so no tab's payload is fetched to draw the bar. Pull plans and
 * Players have none yet.
 */
export function useSectionBadges(pvpEvent: string | null): Partial<Record<RankingsSection, string>> {
	const { championsMeetingData, leagueOfHeroesData } = useCalculatorData()
	// One clock reading per mount, like the tabs.
	const [now] = useState(() => new Date())
	return useMemo(() => {
		const events = raceEventsInOrder(championsMeetingData, leagueOfHeroesData)
		const guides = events.filter((event) => event.has_guide).length
		const event = findEvent(events, parsePvpEvent(pvpEvent)) ?? defaultPvpEvent(events, now)
		return {
			...(guides > 0 ? { guides: String(guides) } : {}),
			...(event ? { pvp: shortEventName(event) } : {}),
		}
	}, [championsMeetingData, leagueOfHeroesData, pvpEvent, now])
}
