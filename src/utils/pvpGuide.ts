/**
 * Pure helpers behind the PvP page: which event to show, the event before it,
 * the cards new since then, the key dates, and how a guide's rows group.
 *
 * Everything takes its inputs as parameters (events, banners, constants, "now"),
 * so the tests can pin each rule with a fixed calendar.
 */

import type {
	BannerSupport,
	BannerUma,
	CalculationConstants,
	RaceEvent,
	SupportCard,
	Uma,
} from "../types"
import type {
	PvpGuide,
	PvpSkillCategory,
	PvpSkillRecommendation,
	PvpSkillRef,
	PvpStyle,
	PvpSupportCardRef,
	PvpUmaRecommendation,
} from "../types/pvpGuide"
import { parseApiDate } from "./dateFormat"
import { refForRaceEvent, sameEvent, type PvpEventRef } from "./pvpEvent"

/** Display order, the same order the API sorts by. */
export const STYLE_ORDER: PvpStyle[] = ["everyone", "runaway", "front", "pace", "late", "end"]

export const STYLE_LABELS: Record<PvpStyle, string> = {
	everyone: "Everyone",
	runaway: "Runaway",
	front: "Front",
	pace: "Pace",
	late: "Late",
	end: "End",
}

function time(value: string): number {
	return parseApiDate(value)?.getTime() ?? Number.NaN
}

/** Every CM and LoH, oldest first by start date. Ties keep CMs first. */
export function raceEventsInOrder(cms: RaceEvent[], lohs: RaceEvent[]): RaceEvent[] {
	return [...cms, ...lohs]
		.filter((event) => !Number.isNaN(time(event.start_date)))
		.sort((a, b) => time(a.start_date) - time(b.start_date))
}

/** True from the event's start until its end has passed. */
export function isRunning(event: RaceEvent, now: Date): boolean {
	return time(event.start_date) <= now.getTime() && now.getTime() <= time(event.end_date)
}

export function hasEnded(event: RaceEvent, now: Date): boolean {
	return time(event.end_date) < now.getTime()
}

/**
 * The event the page opens on with no ?event= in the URL: the one running now,
 * else the next to start, else the most recent one. Null with no events at all.
 */
export function defaultPvpEvent(events: RaceEvent[], now: Date): RaceEvent | null {
	const running = events.find((event) => isRunning(event, now))
	if (running) return running
	const upcoming = events.find((event) => time(event.start_date) > now.getTime())
	if (upcoming) return upcoming
	return events.length > 0 ? events[events.length - 1] : null
}

export function findEvent(events: RaceEvent[], ref: PvpEventRef | null): RaceEvent | null {
	return events.find((event) => sameEvent(refForRaceEvent(event), ref)) ?? null
}

/**
 * The nearest earlier event of EITHER kind: the sheet numbers its PvP list
 * across CMs and LoHs together, so "since the last PvP" means either.
 */
export function previousPvpEvent(events: RaceEvent[], current: RaceEvent): RaceEvent | null {
	const index = events.findIndex((event) => event === current)
	return index > 0 ? events[index - 1] : null
}

export interface NewCards {
	umas: Uma[]
	supports: SupportCard[]
}

/**
 * The cards whose FIRST global banner starts on or after `previousStart` and
 * before `start`: what arrived since the last PvP event. A card's first
 * appearance is the earliest effective start among the banners featuring it,
 * so a rerun never makes an old card look new.
 */
export function newCardsBetween(
	previousStart: string,
	start: string,
	umaBanners: BannerUma[],
	supportBanners: BannerSupport[]
): NewCards {
	const from = time(previousStart)
	const to = time(start)

	function firsts<T extends { id: number }>(entries: Array<{ start: number; cards: T[] }>): T[] {
		const first = new Map<number, { start: number; card: T }>()
		for (const { start: bannerStart, cards } of entries) {
			if (Number.isNaN(bannerStart)) continue
			for (const card of cards) {
				const seen = first.get(card.id)
				if (!seen || bannerStart < seen.start) first.set(card.id, { start: bannerStart, card })
			}
		}
		return [...first.values()]
			.filter(({ start: cardStart }) => from <= cardStart && cardStart < to)
			.sort((a, b) => a.start - b.start)
			.map(({ card }) => card)
	}

	return {
		umas: firsts(umaBanners.map((banner) => ({ start: time(banner.banner_timeline.start_date), cards: banner.umas }))),
		supports: firsts(
			supportBanners.map((banner) => ({ start: time(banner.banner_timeline.start_date), cards: banner.support_cards }))
		),
	}
}

/** The styles a guide says something about, in display order. */
export function stylesWithContent(guide: PvpGuide): PvpStyle[] {
	const used = new Set<PvpStyle>()
	for (const row of guide.uma_recommendations) used.add(row.style)
	for (const row of guide.style_notes) used.add(row.style)
	for (const row of guide.decks) used.add(row.style)
	for (const row of guide.honorable_mentions) used.add(row.style)
	for (const row of guide.skill_recommendations) used.add(row.style)
	// "Everyone" rows show above the tabs, never as a tab of their own.
	used.delete("everyone")
	return STYLE_ORDER.filter((style) => used.has(style))
}

// How a guide's skills are grouped, everywhere they show. "other" is what a
// guide files without a category (the sheet's per-style lists), so it reads
// as the core list. Acceleration first: it is what a style lives or dies by;
// the rest in the order a player builds a skill list.
export const SKILL_CATEGORY_LABELS: Record<PvpSkillCategory, string> = {
	acceleration: "Acceleration",
	other: "Core skills",
	speed: "Speed",
	recovery: "Recovery",
	green: "Green skills",
	debuff: "Debuffs",
}
export const SKILL_CATEGORY_ORDER: PvpSkillCategory[] = ["acceleration", "other", "speed", "recovery", "green", "debuff"]

/** The positions a guide recommends skills for, "everyone" left out, in display order. */
export function skillPositions(guide: PvpGuide): PvpStyle[] {
	const used = new Set(guide.skill_recommendations.map((row) => row.style))
	return STYLE_ORDER.filter((style) => style !== "everyone" && used.has(style))
}

/** One recommended skill in the team builder's skills panel. */
export interface GuideSkillPick {
	skill: PvpSkillRef
	/** The best (lowest) tier any row gives it, or null when none has one. */
	tier: number | null
	/** Every style it is recommended for ("everyone" included), in display order. */
	styles: PvpStyle[]
	notes: string[]
}

/**
 * The guide's recommended skills by category, each skill ONCE however many
 * positions recommend it, in the first category (in SKILL_CATEGORY_ORDER) a
 * row files it under. Within a category: best tier first (untiered last),
 * then the guide's order.
 *
 * With a `position`, only that position's rows and the general ("everyone")
 * ones count, the same merge the Recommendations view makes, so a skill's
 * tier and category are the ones the guide gives for that position.
 */
export function guideSkillsByCategory(
	guide: PvpGuide,
	position: PvpStyle | null = null
): Array<{ category: PvpSkillCategory; skills: GuideSkillPick[] }> {
	const rank = (category: PvpSkillCategory) => SKILL_CATEGORY_ORDER.indexOf(category)
	const picks = new Map<number, GuideSkillPick & { category: PvpSkillCategory; first: number }>()
	guide.skill_recommendations.forEach((row, index) => {
		if (position !== null && row.style !== position && row.style !== "everyone") return
		const pick = picks.get(row.skill.id) ?? {
			skill: row.skill, tier: null, styles: [], notes: [], category: row.category, first: index,
		}
		if (rank(row.category) < rank(pick.category)) pick.category = row.category
		if (row.tier !== null && (pick.tier === null || row.tier < pick.tier)) pick.tier = row.tier
		if (!pick.styles.includes(row.style)) pick.styles.push(row.style)
		if (row.note && !pick.notes.includes(row.note)) pick.notes.push(row.note)
		picks.set(row.skill.id, pick)
	})
	const tierRank = (tier: number | null) => (tier === null ? Number.MAX_SAFE_INTEGER : tier)
	return SKILL_CATEGORY_ORDER.map((category) => ({
		category,
		skills: [...picks.values()]
			.filter((pick) => pick.category === category)
			.sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.first - b.first)
			.map(({ skill, tier, styles, notes }) => ({
				skill,
				tier,
				styles: [...styles].sort((a, b) => STYLE_ORDER.indexOf(a) - STYLE_ORDER.indexOf(b)),
				notes,
			})),
	})).filter((group) => group.skills.length > 0)
}

/**
 * Every id a recommended skill answers to: its own and its other versions'.
 * A guide names one version; a team that can get ANY of them has the skill
 * (sometimes a worse one, which `familySources` says).
 */
export function skillFamilyIds(skill: PvpSkillRef): number[] {
	return [skill.id, ...skill.versions.map((version) => version.id)]
}

/**
 * Where a team gets a recommended skill or any version of it, from the
 * team's skill sources (`teamSkillSources` in utils/pvpTeams). A source that
 * gives another version says which: "Kitasan Black (hint), as ◎ gold". Null
 * when the team gets none of them.
 */
export function familySources(sources: Map<number, string[]>, skill: PvpSkillRef): string[] | null {
	const found: string[] = []
	for (const from of sources.get(skill.id) ?? []) found.push(from)
	for (const version of skill.versions) {
		for (const from of sources.get(version.id) ?? []) found.push(`${from}, as ${version.version}`)
	}
	return found.length > 0 ? found : null
}

/** True when a white skill has a gold version to show a ◎ badge for. */
export function hasGoldVersion(skill: PvpSkillRef): boolean {
	return skill.rarity === 1 && skill.versions.some((version) => version.tier === 2 && !version.is_evolved)
}

/** One recommended uma or card in the team builder's Guide picks panel. */
export interface GuidePick<Ref> {
	ref: Ref
	/** Every style the guide lists it under, in display order. */
	styles: PvpStyle[]
	/** The guide's notes on it, each once ("Use as runaway", "Gold + Link"). */
	notes: string[]
}

export interface GuidePicks {
	/** Highest stars first; ties keep the guide's order. */
	umas: Array<GuidePick<PvpUmaRecommendation["uma"]> & { stars: number }>
	/** Deck cards first (in the guide's order), then honourable mentions. */
	cards: Array<GuidePick<PvpSupportCardRef> & { inDeck: boolean }>
}

/**
 * The guide's recommended umas and support cards as two flat lists, each uma
 * and card ONCE however many styles, decks or mentions name it. An uma keeps
 * her best star rating; a card counts as a deck card if any deck runs it.
 */
export function guidePicks(guide: PvpGuide): GuidePicks {
	const note = <T extends { notes: string[] }>(pick: T, text: string) => {
		if (text && !pick.notes.includes(text)) pick.notes.push(text)
	}
	const style = <T extends { styles: PvpStyle[] }>(pick: T, value: PvpStyle) => {
		if (!pick.styles.includes(value)) pick.styles.push(value)
		pick.styles.sort((a, b) => STYLE_ORDER.indexOf(a) - STYLE_ORDER.indexOf(b))
	}

	const umas = new Map<number, GuidePicks["umas"][number]>()
	for (const row of guide.uma_recommendations) {
		const pick = umas.get(row.uma.id) ?? { ref: row.uma, styles: [], notes: [], stars: 0 }
		pick.stars = Math.max(pick.stars, row.stars)
		style(pick, row.style)
		note(pick, row.note)
		umas.set(row.uma.id, pick)
	}

	const cards = new Map<number, GuidePicks["cards"][number]>()
	const addCard = (card: PvpSupportCardRef, value: PvpStyle, text: string, inDeck: boolean) => {
		const pick = cards.get(card.id) ?? { ref: card, styles: [], notes: [], inDeck }
		pick.inDeck = pick.inDeck || inDeck
		style(pick, value)
		note(pick, text)
		cards.set(card.id, pick)
	}
	for (const deck of guide.decks) {
		for (const slot of deck.slots) if (slot.support_card) addCard(slot.support_card, deck.style, slot.note, true)
	}
	for (const mention of guide.honorable_mentions) addCard(mention.support_card, mention.style, mention.note, false)

	return {
		// Array.prototype.sort is stable, so equal stars keep the guide's order.
		umas: [...umas.values()].sort((a, b) => b.stars - a.stars),
		cards: [...cards.values()],
	}
}

/**
 * One position's recommended skills: its own picks merged with the GENERAL
 * ones (style "everyone", which apply to every position), as one list.
 *
 * Ordered by tier (0 first, untiered last), then the position's own picks
 * before the general ones within a tier, then the editor's order. Category is
 * left to the caller, which splits the list into its subcategories.
 */
export function skillsForPosition(rows: PvpSkillRecommendation[], style: PvpStyle): PvpSkillRecommendation[] {
	const tierRank = (row: PvpSkillRecommendation) => (row.tier === null ? Number.MAX_SAFE_INTEGER : row.tier)
	const generalRank = (row: PvpSkillRecommendation) => (row.style === "everyone" ? 1 : 0)
	return rows
		.map((row, index) => ({ row, index }))
		.filter(({ row }) => row.style === style || row.style === "everyone")
		.sort(
			(a, b) =>
				tierRank(a.row) - tierRank(b.row) ||
				generalRank(a.row) - generalRank(b.row) ||
				a.row.order - b.row.order ||
				a.index - b.index
		)
		.map(({ row }) => row)
}

export interface SkillTierGroup {
	/** Null for skills the guide gives no tier. */
	tier: number | null
	skills: PvpSkillRecommendation[]
}

/** Rows grouped by tier, in the order they arrived (tier 0 first, untiered last). */
export function groupSkillsByTier(rows: PvpSkillRecommendation[]): SkillTierGroup[] {
	const groups: SkillTierGroup[] = []
	for (const row of rows) {
		const last = groups[groups.length - 1]
		if (last && last.tier === row.tier) last.skills.push(row)
		else groups.push({ tier: row.tier, skills: [row] })
	}
	return groups
}

export interface Milestone {
	label: string
	/** ISO instant. */
	date: string
}

/**
 * The event's key dates, from its start date plus the per-kind hour offsets
 * in the calculation constants. Round 1 is the start itself. A milestone whose
 * offset is null (League of Heroes, until its schedule is known) is left out.
 */
export function milestones(event: RaceEvent, constants: CalculationConstants): Milestone[] {
	const start = parseApiDate(event.start_date)
	if (!start) return []
	const isCm = event.event_type === "champions_meeting"
	const offsets: Array<[string, number | null]> = [
		["Registration opens", isCm ? constants.cm_registration_opens_hours : constants.loh_registration_opens_hours],
		["Round 1", 0],
		["Round 2", isCm ? constants.cm_round_two_hours : constants.loh_round_two_hours],
		[
			"Finals registration closes",
			isCm ? constants.cm_finals_registration_closes_hours : constants.loh_finals_registration_closes_hours,
		],
		["Finals", isCm ? constants.cm_finals_hours : constants.loh_finals_hours],
	]
	return offsets
		.filter((entry): entry is [string, number] => entry[1] !== null && entry[1] !== undefined)
		.map(([label, hours]) => ({
			label,
			date: new Date(start.getTime() + hours * 3_600_000).toISOString(),
		}))
}
