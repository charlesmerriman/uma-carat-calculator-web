/**
 * The Timeline screen's pages (owner, 2026-11-24: "Timeline should have legend
 * races and timeline"): the Timeline itself and the Daily Legend Races,
 * switched by the bar at the top of the screen (TimelineTabs.tsx). Both are
 * "what is coming, and when", which is why they share a place.
 *
 * Plain data, like carat-calculator/calculatorTabs.ts, so the navbar can ask
 * "is this the Timeline screen?" without importing a component. Legend Races
 * had a navbar tab of its own until this list existed; the navbar's Timeline
 * place stays lit on both pages now (navbar/navPlaces.ts).
 */

export interface TimelineTab {
	/** The route, which is also how the bar knows which page is open. */
	to: "/app/timeline" | "/app/legend-races"
	label: string
}

export const TIMELINE_TABS: readonly TimelineTab[] = [
	{ to: "/app/timeline", label: "Timeline" },
	{ to: "/app/legend-races", label: "Legend Races" },
]

/** Whether `pathname` is one of the screen's pages, with or without a trailing slash. */
export function isTimelineScreen(pathname: string): boolean {
	const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
	return TIMELINE_TABS.some((tab) => tab.to === path)
}
