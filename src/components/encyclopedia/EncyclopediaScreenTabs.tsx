/**
 * The Encyclopedia screen's header: its title, and Umas, Support cards and
 * Skills as tabs, pinned as a slim bar under the navbar while a list scrolls (Daptrius, board "Encyclopedia sticky nav",
 * 2026-11-25). Names only, no counts (the owner dropped them the same day).
 *
 * The header is the shared ScreenHeader (components/ScreenHeader.tsx), as the
 * Calculator's, the Timeline's and Rankings' are: a screen brings a list and
 * this one-line wrapper, never a copy of the markup. The three lists are open
 * to everyone, so it reads nothing but its list, and the build-time render
 * draws the same header.
 *
 * On the three lists only, for now: a detail page has its own pinned jump bar
 * (encyclopedia.css, ".enc-jump"), which would need moving down under this one.
 */

import { BookOpen, BookUser, IdCard, Sparkles, type LucideIcon } from "lucide-react"
import { ScreenHeader } from "../ScreenHeader"
import { CARD_LIST_PATH, ENCYCLOPEDIA_TABS, SKILL_LIST_PATH, UMA_LIST_PATH } from "../../utils/encyclopediaRoutes"

const ICONS: Record<(typeof ENCYCLOPEDIA_TABS)[number]["to"], LucideIcon> = {
	[UMA_LIST_PATH]: BookUser,
	[CARD_LIST_PATH]: IdCard,
	[SKILL_LIST_PATH]: Sparkles,
}

export function EncyclopediaScreenTabs() {
	return (
		<ScreenHeader
			kind="links"
			title="Encyclopedia"
			icon={BookOpen}
			label="Encyclopedia lists"
			// The lists' column (utils/encyclopedia.ts, PAGE_CONTAINER).
			column="max-w-6xl"
			tabs={ENCYCLOPEDIA_TABS.map((tab) => ({ ...tab, icon: ICONS[tab.to] }))}
		/>
	)
}
