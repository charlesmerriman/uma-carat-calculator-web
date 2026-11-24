/**
 * The Timeline screen's own bar: Timeline and Legend Races (owner,
 * 2026-11-24; notes/navigation-plan.md, PR 3). Legend Races had a navbar tab
 * of its own until then.
 *
 * The bar itself is the shared ScreenTabs (components/ScreenTabs.tsx). Both
 * pages are open to everyone, so this reads nothing but its list, and the bar
 * is the same in the build-time render as after load.
 */

import { CalendarDays, Trophy, type LucideIcon } from "lucide-react"
import { ScreenTabs } from "../ScreenTabs"
import { TIMELINE_TABS, type TimelineTab } from "./timelineTabs"

const ICONS: Record<TimelineTab["to"], LucideIcon> = {
	"/app/timeline": CalendarDays,
	"/app/legend-races": Trophy,
}

export function TimelineTabs() {
	return <ScreenTabs label="Timeline" tabs={TIMELINE_TABS.map((tab) => ({ ...tab, icon: ICONS[tab.to] }))} />
}
