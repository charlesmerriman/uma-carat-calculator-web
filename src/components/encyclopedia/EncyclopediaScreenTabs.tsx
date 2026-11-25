/**
 * The Encyclopedia screen's own bar: Umas, Support cards and Skills, pinned
 * under the navbar while a list scrolls (Daptrius, board "Encyclopedia sticky
 * nav", 2026-11-25). Names only: the masthead's tabs under it keep the counts.
 *
 * The bar is the shared ScreenTabs (components/ScreenTabs.tsx), as the
 * Calculator's and the Timeline's are: a screen brings a list and this
 * one-line wrapper, never a copy of the bar. The three lists are open to
 * everyone, so it reads nothing but its list, and the build-time render draws
 * the same bar.
 *
 * On the three lists only, for now: a detail page has its own pinned jump bar
 * (encyclopedia.css, ".enc-jump"), which would need moving down under this one.
 */

import { BookUser, IdCard, Sparkles, type LucideIcon } from "lucide-react"
import { ScreenTabs } from "../ScreenTabs"
import { CARD_LIST_PATH, ENCYCLOPEDIA_TABS, SKILL_LIST_PATH, UMA_LIST_PATH } from "../../utils/encyclopediaRoutes"

const ICONS: Record<(typeof ENCYCLOPEDIA_TABS)[number]["to"], LucideIcon> = {
	[UMA_LIST_PATH]: BookUser,
	[CARD_LIST_PATH]: IdCard,
	[SKILL_LIST_PATH]: Sparkles,
}

export function EncyclopediaScreenTabs() {
	return <ScreenTabs label="Encyclopedia lists" tabs={ENCYCLOPEDIA_TABS.map((tab) => ({ ...tab, icon: ICONS[tab.to] }))} />
}
