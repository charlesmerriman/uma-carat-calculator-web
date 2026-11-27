/**
 * The Timeline screen's header: Timeline and Legend Races (owner,
 * 2026-11-24; notes/navigation-plan.md, PR 3). Legend Races had a navbar tab
 * of its own until then.
 *
 * The header itself is the shared ScreenHeader (components/ScreenHeader.tsx).
 * Both pages are open to everyone, so this reads nothing but its list, and the
 * header is the same in the build-time render as after load.
 */

import { CalendarDays, Trophy, type LucideIcon } from "lucide-react"
import { ScreenHeader } from "../ScreenHeader"
import { TIMELINE_TABS, type TimelineTab } from "./timelineTabs"

const ICONS: Record<TimelineTab["to"], LucideIcon> = {
	"/app/timeline": CalendarDays,
	"/app/legend-races": Trophy,
}

export function TimelineTabs() {
	return (
		<ScreenHeader
			kind="links"
			title="Timeline"
			icon={CalendarDays}
			label="Timeline"
			column="max-w-[96rem]"
			// Legend Races draws its own <h1> (the admin's title); the Timeline's is the header's.
			tabs={TIMELINE_TABS.map((tab) => ({ ...tab, icon: ICONS[tab.to], ownHeading: tab.to === "/app/legend-races" }))}
		/>
	)
}
