/**
 * What Ctrl+K can find, and how it finds it. Pure, so the matching has plain
 * tests (src/__tests__/siteSearch.test.ts); components/search draws it.
 *
 * WHERE A RESULT GOES
 * -------------------
 * An uma or a support card has no page of its own, so it opens the Timeline on
 * its banner: the next one still to end, else the latest. One with no banner
 * isn't listed, because there is nowhere to send anyone. A race event opens its
 * PvP guide. A skill has no page either (the Skills page is shelved), so it has
 * no `href`: the palette shows what it does and who teaches it instead.
 *
 * WHY FUSE
 * --------
 * People type names from memory, and these names are long and foreign:
 * "kitsan blk" should still find Kitasan Black. Fuse scores near misses; a
 * substring match finds nothing there. `ignoreLocation` because the word that
 * matters can sit anywhere in a name.
 */

import Fuse from "fuse.js"
import { formatDate, parseApiDate } from "./dateFormat"
import { pvpEventHref, refForRaceEvent, shortEventName } from "./pvpEvent"
import { timelineFocusHref } from "./timelineFocus"
import type { AnniversaryEvent, BannerStepUp, BannerSupport, BannerUma, RaceEvent, Scenario } from "../types"
import type { CatalogueSkill, PvpCatalogue } from "../types/pvpTeam"

export type SearchKind = "page" | "uma" | "card" | "banner" | "event" | "skill"

export interface SearchEntry {
	/** Unique across kinds, and what the palette's list is keyed on. */
	id: string
	kind: SearchKind
	title: string
	/** The second line. */
	detail: string
	/** Other words that should find it, never shown. */
	keywords: string
	/** Where it goes. Absent on a skill, which opens in the palette. */
	href?: string
	image?: string | null
	/** Set on an uma, so the palette can draw it in the site's frame. */
	umaId?: number
	/** Set on a skill: its row in the PvP catalogue. */
	skillId?: number
}

export interface SearchSources {
	umaBanners: BannerUma[]
	supportBanners: BannerSupport[]
	stepUps: BannerStepUp[]
	events: RaceEvent[]
	scenarios: Scenario[]
	campaigns: AnniversaryEvent[]
	skills: CatalogueSkill[]
}

const page = (title: string, href: string, keywords = ""): SearchEntry => ({
	id: `page-${href}`,
	kind: "page",
	title,
	detail: "Page",
	keywords,
	href,
})

/** Every page a visitor can go to, in the order the empty palette lists them. */
export function pageEntries(earlyAccess: boolean): SearchEntry[] {
	return [
		page("Calculator", "/app", "planner pull plan carats tickets"),
		page("Timeline", "/app/timeline", "banners events calendar"),
		page("Selectors", "/app/selectors", "selector tickets campaign packs step-up"),
		page("Legend Races", "/app/legend-races", "daily"),
		page("PvP", "/app/pvp", "guides teams gallery champions meeting league of heroes"),
		...(earlyAccess ? [page("Rankings", "/app/rankings", "most used")] : []),
		page("Collection", "/app/collection", "veterans owned cards history"),
		page("FAQ", "/faq", "questions income help"),
		page("Changelog", "/changelog", "patch notes updates"),
		page("Feedback", "/feedback", "bug report suggestion"),
		page("About", "/about"),
		page("Privacy Policy", "/privacy-policy"),
		page("Terms", "/terms"),
	]
}

/**
 * The banner to open for a card on several: the first still to end, because
 * that's the one a player can still act on, else the most recent.
 */
function pickBanner<T extends { banner_timeline: { end_date: string } }>(banners: T[], now: Date): T {
	const ending = (banner: T) => parseApiDate(banner.banner_timeline.end_date)?.getTime() ?? 0
	const sorted = [...banners].sort((a, b) => ending(a) - ending(b))
	return sorted.find((banner) => ending(banner) >= now.getTime()) ?? sorted[sorted.length - 1]
}

/** Each card once, against every banner featuring it. */
function groupByCard<B, C extends { id: number }>(banners: B[], cardsOf: (banner: B) => C[]): Map<number, { card: C; banners: B[] }> {
	const byCard = new Map<number, { card: C; banners: B[] }>()
	for (const banner of banners) {
		for (const card of cardsOf(banner)) {
			const seen = byCard.get(card.id)
			if (seen) seen.banners.push(banner)
			else byCard.set(card.id, { card, banners: [banner] })
		}
	}
	return byCard
}

const onBanner = (label: string, banner: { banner_timeline: { id: number; end_date: string } }) => ({
	detail: `${label} · ends ${formatDate(banner.banner_timeline.end_date)}`,
	href: timelineFocusHref({ kind: "banner", id: banner.banner_timeline.id }),
})

export function buildSearchEntries(sources: SearchSources, now: Date, earlyAccess: boolean): SearchEntry[] {
	const entries = pageEntries(earlyAccess)

	for (const { card: uma, banners } of groupByCard(sources.umaBanners, (banner) => banner.umas).values()) {
		entries.push({
			id: `uma-${uma.id}`,
			kind: "uma",
			title: uma.name,
			keywords: "",
			image: uma.portrait ?? uma.image,
			umaId: uma.id,
			...onBanner("Uma banner", pickBanner(banners, now)),
		})
	}
	for (const { card, banners } of groupByCard(sources.supportBanners, (banner) => banner.support_cards).values()) {
		entries.push({
			id: `card-${card.id}`,
			kind: "card",
			title: card.name,
			keywords: "",
			image: card.image,
			...onBanner("Support banner", pickBanner(banners, now)),
		})
	}
	for (const stepUp of sources.stepUps) {
		entries.push({
			id: `step-up-${stepUp.id}`,
			kind: "banner",
			title: stepUp.name,
			keywords: "step up",
			...onBanner("Step-up banner", stepUp),
		})
	}
	for (const event of sources.events) {
		entries.push({
			id: `event-${event.event_type}-${event.id}`,
			kind: "event",
			title: event.name,
			detail: `${shortEventName(event)} guide · starts ${formatDate(event.start_date)}`,
			keywords: `${shortEventName(event)} pvp guide`,
			href: pvpEventHref(refForRaceEvent(event)),
		})
	}
	for (const scenario of sources.scenarios) {
		entries.push({
			id: `scenario-${scenario.id}`,
			kind: "banner",
			title: scenario.name,
			detail: "Scenario on the Timeline",
			keywords: "scenario",
			href: timelineFocusHref({ kind: "scenario", id: scenario.id }),
		})
	}
	for (const campaign of sources.campaigns) {
		entries.push({
			id: `campaign-${campaign.id}`,
			kind: "banner",
			title: campaign.name,
			detail: "Campaign on the Timeline",
			keywords: "campaign anniversary",
			href: timelineFocusHref({ kind: "anniversary", id: campaign.id }),
		})
	}
	for (const skill of sources.skills) {
		entries.push({
			id: `skill-${skill.id}`,
			kind: "skill",
			title: skill.name,
			detail: skill.description,
			keywords: "",
			image: skill.image,
			skillId: skill.id,
		})
	}
	return entries
}

const MAX_RESULTS = 30

export function createSearcher(entries: SearchEntry[]): (query: string) => SearchEntry[] {
	const fuse = new Fuse(entries, {
		keys: [
			{ name: "title", weight: 3 },
			{ name: "keywords", weight: 1 },
		],
		threshold: 0.4,
		ignoreLocation: true,
	})
	return (query) => fuse.search(query, { limit: MAX_RESULTS }).map((result) => result.item)
}

const MAX_TEACHERS = 8

/** Who teaches a skill, by name, for the palette's detail view. */
export function skillTeachers(skillId: number, catalogue: PvpCatalogue): { umas: string[]; cards: string[] } {
	const names = (rows: { name: string; skills: { skill: number }[] }[]) => {
		const teaching = rows.filter((row) => row.skills.some((link) => link.skill === skillId)).map((row) => row.name)
		return [...new Set(teaching)].slice(0, MAX_TEACHERS)
	}
	return { umas: names(catalogue.umas), cards: names(catalogue.support_cards) }
}
