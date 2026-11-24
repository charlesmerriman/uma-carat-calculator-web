/**
 * The navbar's places: the few things the site is, each with its name (owner,
 * 2026-11-24; notes/navigation-plan.md). One list, read by the phone bar and
 * the desktop bar alike, so the two cannot disagree and a new place is one
 * entry here.
 *
 * A PLACE IS NOT A PAGE. Calculator is three pages and Timeline is two; the
 * pages inside a place are switched by that screen's own bar
 * (components/ScreenTabs.tsx), and the place stays lit on all of them, which
 * is what `isOpen` answers. Selectors (2026-11-24, web #456) and Legend Races
 * (PR 3) each had a tab here until they moved under a place; seven tabs was
 * more than a phone could name, and Encyclopedia and Rankings were icons
 * without a word below 1536px.
 *
 * Anything that is not a place (the theme, the account, the info pages) goes
 * in the menu at the end of the bar (SiteMenu), never here.
 */

import { BookOpen, CalendarDays, Calculator, ListOrdered, Swords, type LucideIcon } from "lucide-react"
import { UMA_LIST_PATH, isEncyclopediaPath } from "../../utils/encyclopediaRoutes"
import { isCalculatorScreen } from "../carat-calculator/calculatorTabs"
import { isTimelineScreen } from "../timeline/timelineTabs"

export interface NavPlace {
	id: "calculator" | "timeline" | "pvp" | "encyclopedia" | "rankings"
	label: string
	/** Where the place's link goes: the first of its pages. */
	to: string
	icon: LucideIcon
	/** Whether `pathname` is one of the place's pages. */
	isOpen: (pathname: string) => boolean
	/** A place only some readers get. Rankings is early access for now (owner, 2026-10-27). */
	gate?: "earlyAccess"
}

export const NAV_PLACES: readonly NavPlace[] = [
	{ id: "calculator", label: "Calculator", to: "/app", icon: Calculator, isOpen: isCalculatorScreen },
	{ id: "timeline", label: "Timeline", to: "/app/timeline", icon: CalendarDays, isOpen: isTimelineScreen },
	{ id: "pvp", label: "PvP", to: "/app/pvp", icon: Swords, isOpen: (pathname) => pathname === "/app/pvp" },
	{ id: "encyclopedia", label: "Encyclopedia", to: UMA_LIST_PATH, icon: BookOpen, isOpen: isEncyclopediaPath },
	{ id: "rankings", label: "Rankings", to: "/app/rankings", icon: ListOrdered, isOpen: (pathname) => pathname === "/app/rankings", gate: "earlyAccess" },
]

/**
 * The places this reader gets, in order. The account is unknown during the
 * prerender and while it loads, so a gated place joins after load and never
 * flashes.
 */
export function navPlacesFor({ earlyAccess }: { earlyAccess: boolean }): NavPlace[] {
	return NAV_PLACES.filter((place) => place.gate !== "earlyAccess" || earlyAccess)
}
