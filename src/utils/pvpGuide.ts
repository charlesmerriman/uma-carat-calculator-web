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
	PvpDeck,
	PvpGuide,
	PvpSkillCategory,
	PvpSkillRecommendation,
	PvpSkillRef,
	PvpStyle,
	PvpStyleTab,
	PvpSupportCardRef,
	PvpUmaRecommendation,
	PvpSkillVersion,
} from "../types/pvpGuide"
import { parseApiDate } from "./dateFormat"
import { aptitudeKeysForEvent, aptitudeLetter } from "./courseAptitude"
import type { AptitudeKey } from "../types/pvpTeam"
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
export function stylesWithContent(guide: PvpGuide): Array<Exclude<PvpStyle, "everyone">> {
	const used = new Set<PvpStyle>()
	for (const row of guide.uma_recommendations) used.add(row.style)
	for (const row of guide.style_notes) used.add(row.style)
	for (const row of guide.decks) used.add(row.style)
	for (const row of guide.skill_recommendations) used.add(row.style)
	// "Everyone" rows show in the side column, never as a tab of their own.
	used.delete("everyone")
	return STYLE_ORDER.filter((style): style is Exclude<PvpStyle, "everyone"> => style !== "everyone" && used.has(style))
}

/** The query parameter the PvP page reads its running style from: `?style=pace`. */
export const PVP_STYLE_PARAM = "style"

/** The "All" tab's value in `?style=` and its label. */
export const ALL_STYLES_TAB = "all"
export const ALL_STYLES_LABEL = "All"

/**
 * "pace" -> "pace", "all" -> "all"; anything that is not a style tab -> null.
 * "everyone" is a style in the data but never a tab, so it is refused here too.
 */
export function parsePvpStyle(value: string | null | undefined): PvpStyleTab | null {
	if (value === ALL_STYLES_TAB) return ALL_STYLES_TAB
	const style = STYLE_ORDER.find((candidate) => candidate === value)
	return style && style !== "everyone" ? style : null
}

/**
 * The tabs a guide offers: "All" first, then its styles. No "All" for a guide
 * with one style, where it would show the same pane twice.
 */
export function styleTabs(styles: PvpStyleTab[]): PvpStyleTab[] {
	return styles.length > 1 ? [ALL_STYLES_TAB, ...styles] : styles
}

/** The mark between two steps of a style ranking: ahead, a clear gap, or level. */
export type RankingGap = ">" | ">>" | ">=" | "="

export interface RankingStep {
	/** The running style the word names, or null for a word that isn't one (CM 20's "Blaze"). */
	style: Exclude<PvpStyle, "everyone"> | null
	/** The word as the guide wrote it. */
	label: string
	/** The mark before this step; null on the first. */
	gap: RankingGap | null
}

// What a ranking word may say for each style: the site's label, and the
// game's own English names, which some authors write out in full.
const RANKING_WORDS: Record<string, Exclude<PvpStyle, "everyone">> = {
	runaway: "runaway",
	front: "front",
	"front runner": "front",
	pace: "pace",
	"pace chaser": "pace",
	late: "late",
	"late surger": "late",
	end: "end",
	"end closer": "end",
}

/**
 * A guide's `style_ranking` as steps: "Pace>>End>Late>Front" -> Pace, then End
 * after a clear gap, then Late, then Front. Spaces around the marks are
 * optional. A word that names no style stays a step with `style: null`, so a
 * ranking that mentions a strategy ("Front>>Blaze>=End") keeps its order. An
 * empty ranking is no steps.
 */
export function parseStyleRanking(text: string): RankingStep[] {
	const steps: RankingStep[] = []
	let gap: RankingGap | null = null
	for (const part of text.split(/(>>|>=|>|=)/)) {
		const word = part.trim()
		if (word === ">>" || word === ">=" || word === ">" || word === "=") {
			gap = word
			continue
		}
		if (!word) continue
		steps.push({ style: RANKING_WORDS[word.toLowerCase()] ?? null, label: word, gap: steps.length > 0 ? gap : null })
		gap = null
	}
	return steps
}

/** The style a word names ("Pace", "pace chaser"), or null. */
export function styleForWord(word: string): Exclude<PvpStyle, "everyone"> | null {
	return RANKING_WORDS[word.trim().toLowerCase()] ?? null
}

/** A running style's colour, as a CSS value: Hakuraku's (the --color-style-* tokens, index.css). */
export function styleColor(style: Exclude<PvpStyle, "everyone">): string {
	return `var(--color-style-${style})`
}

/**
 * A team comp as its three places: "2 Pace + 1 End/Late" -> [pace], [pace],
 * [end, late]. Each place is the style or styles it may run. Null when the
 * text is not a count of styles adding up to one to three places, so the comp
 * shows as its words alone.
 */
export function parseTeamComp(text: string): Array<Array<Exclude<PvpStyle, "everyone">>> | null {
	const places: Array<Array<Exclude<PvpStyle, "everyone">>> = []
	const parts = text.split("+").map((part) => part.trim()).filter(Boolean)
	for (const part of parts) {
		const match = /^(\d)\s*(.+)$/.exec(part)
		if (!match) return null
		const styles = match[2].split("/").map(styleForWord)
		if (styles.some((style) => style === null)) return null
		for (let i = 0; i < Number(match[1]); i += 1) places.push(styles as Array<Exclude<PvpStyle, "everyone">>)
	}
	return places.length >= 1 && places.length <= 3 ? places : null
}

/**
 * Each ranked style's place, 1 first: the step's position in the ranking, so a
 * non-style word ahead of it still counts ("Front>>Blaze>=End": End is 3rd).
 * A style named twice keeps its first place.
 */
export function styleRanks(ranking: RankingStep[]): Map<PvpStyle, number> {
	const ranks = new Map<PvpStyle, number>()
	ranking.forEach((step, index) => {
		if (step.style && !ranks.has(step.style)) ranks.set(step.style, index + 1)
	})
	return ranks
}

/**
 * The style tab a guide shows: the one asked for when the guide has it, else
 * the guide's top-ranked style it has (owner, 2026-10-23: a reader lands on
 * the style the guide says to run), else its first. A guide with nothing for
 * the asked-for style falls back WITHOUT forgetting it, so a link's pick comes
 * back on the next event that has it. "All" is kept wherever the guide has
 * more than one style.
 */
export function pickStyle(
	styles: PvpStyleTab[],
	wanted: PvpStyleTab | null,
	ranking: RankingStep[] = []
): PvpStyleTab | null {
	if (wanted && styleTabs(styles).includes(wanted)) return wanted
	const top = ranking.find((step) => step.style !== null && styles.includes(step.style))
	return top?.style ?? styles[0] ?? null
}

/**
 * How a skill tier is labelled on the guide. The words are Henry's to choose
 * (guide-visuals-plan.md, open question 1); until then the tiers keep their
 * numbers. One place, so the words drop in here.
 */
export const TIER_LABELS = ["T0", "T1", "T2", "T3", "T4"]

export function tierLabel(tier: number): string {
	return TIER_LABELS[tier] ?? `T${tier}`
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
 * ones count, so a skill's tier and category are the ones the guide gives for
 * that position. (The Recommendations view does NOT merge them: it shows the
 * general skills in a section of their own, see skillsForPosition.)
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
 * A guide names one version; the rest are the same effect in another form.
 */
export function skillFamilyIds(skill: PvpSkillRef): number[] {
	return [skill.id, ...skill.versions.map((version) => version.id)]
}

/**
 * The game's skill rarities a family is made of. A family's ○ and ◎ are both
 * white; only a gold is gold. Read the colour from these, never from `tier`:
 * in a ○/◎ family tier 2 is the white ◎ and the gold is tier 3.
 */
export const WHITE_SKILL_RARITY = 1
export const GOLD_SKILL_RARITY = 2

/**
 * A skill version's colour as a reader says it: "white", "gold", "unique" or
 * "evolved". The guide's hover card shows this rather than the API's
 * `version` ("○ white", "◎ gold"): the circles read as noise there (Daptrius,
 * 2026-10-17), and a ○/◎ white already carries its circle in its name. The
 * team builder keeps `version`, where "as ○ white" vs "as ◎ white" matters.
 */
export function skillColour(skill: { rarity: number; is_evolved: boolean }): string {
	if (skill.is_evolved) return "evolved"
	if (skill.rarity === GOLD_SKILL_RARITY) return "gold"
	if (skill.rarity === WHITE_SKILL_RARITY) return "white"
	return "unique"
}

/**
 * Does a source teaching `version` give a team the pick `skill`?
 *
 * The direction matters: a card that teaches the gold teaches the white too
 * (owner, 2026-10-14), so a gold on the team covers a white pick, and a
 * white never covers a gold. The ○ and ◎ of one white are one skill to a
 * team (owner, 2026-10-16), so each covers the other: no card or uma teaches
 * a ◎ in the game data, so a ◎ pick is only ever met through its ○. No card
 * teaches an evolved skill; an evolved pick is covered by a base version,
 * which is what gets evolved.
 */
function versionCovers(skill: PvpSkillRef, version: PvpSkillVersion): boolean {
	if (skill.is_evolved) return !version.is_evolved
	if (version.is_evolved) return false
	// Anything else in the family covers, except a white for a gold pick.
	return version.rarity === GOLD_SKILL_RARITY || skill.rarity !== GOLD_SKILL_RARITY
}

/**
 * Where a team gets a recommended skill, from the team's skill sources
 * (`teamSkillSources` in utils/pvpTeams): the pick itself, or a version that
 * covers it (`versionCovers`). A source that gives another version says
 * which: "Kitasan Black (hint), as ◎ gold"; the base of an evolved pick says
 * "(evolve it)". Null when the team gets none of them.
 */
export function familySources(sources: Map<number, string[]>, skill: PvpSkillRef): string[] | null {
	const found: string[] = []
	for (const from of sources.get(skill.id) ?? []) found.push(from)
	for (const version of skill.versions) {
		if (!versionCovers(skill, version)) continue
		const suffix = skill.is_evolved ? " (evolve it)" : ""
		for (const from of sources.get(version.id) ?? []) found.push(`${from}, as ${version.version}${suffix}`)
	}
	return found.length > 0 ? found : null
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
	/** The decks' cards, in the guide's order. */
	cards: Array<GuidePick<PvpSupportCardRef>>
}

/**
 * The guide's recommended umas and support cards as two flat lists, each uma
 * and card ONCE however many styles or decks name it. An uma keeps her best
 * star rating.
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
	for (const deck of guide.decks) {
		for (const slot of deck.slots) {
			if (!slot.support_card) continue
			const pick = cards.get(slot.support_card.id) ?? { ref: slot.support_card, styles: [], notes: [] }
			style(pick, deck.style)
			note(pick, slot.note)
			cards.set(slot.support_card.id, pick)
		}
	}

	return {
		// Array.prototype.sort is stable, so equal stars keep the guide's order.
		umas: [...umas.values()].sort((a, b) => b.stars - a.stars),
		cards: [...cards.values()],
	}
}

/**
 * One style's recommended skills, that style's OWN rows only: a position's
 * picks for its tab, or "everyone" for the general skills, which the
 * Recommendations view shows once, in the side column under the Overview
 * (owner, 2026-10-17). Merged into every tab, they read as that position's
 * picks. The team builder's skills panel still merges them, through
 * guideSkillsByCategory, because it is a checklist for one position's team.
 *
 * Ordered by tier (0 first, untiered last), then the editor's order. Category
 * is left to the caller, which splits the list into its subcategories.
 */
export function skillsForPosition(rows: PvpSkillRecommendation[], style: PvpStyle): PvpSkillRecommendation[] {
	const tierRank = (row: PvpSkillRecommendation) => (row.tier === null ? Number.MAX_SAFE_INTEGER : row.tier)
	return rows
		.map((row, index) => ({ row, index }))
		.filter(({ row }) => row.style === style)
		.sort((a, b) => tierRank(a.row) - tierRank(b.row) || a.row.order - b.row.order || a.index - b.index)
		.map(({ row }) => row)
}

export interface UmaAptitude {
	/** "Sprint", "Pace", "Dirt": the aptitude's name as the game prints it. */
	label: string
	/** "A", "F". */
	letter: string
	/** 1..8 (G..S), for its colour. */
	value: number
}

/**
 * The aptitude letters a guide's uma tile shows (release 4 of
 * guide-visuals-plan.md): this event's distance and the row's style, plus its
 * surface only when that is below A (nearly every uma is A on its surface, and
 * a letter that never changes is noise). The keys come from the card picker's
 * own reading of the course (aptitudeKeysForEvent). Null when the uma carries
 * no aptitudes at all (an older API answer), so the tile leaves the row out.
 */
export function guideUmaAptitudes(
	apt: Partial<Record<AptitudeKey, number | null>> | null | undefined,
	event: Pick<RaceEvent, "surface_type" | "distance" | "length"> | null | undefined,
	style: PvpStyle
): UmaAptitude[] | null {
	if (!apt || !event || style === "everyone") return null
	const letters: UmaAptitude[] = []
	for (const { key, label } of aptitudeKeysForEvent(event, style)) {
		const value = apt[key]
		const letter = aptitudeLetter(value)
		if (letter === null || value == null) continue
		if ((key === "turf" || key === "dirt") && value >= 7) continue
		letters.push({ label, letter, value })
	}
	return letters
}

const APTITUDE_ROLE = /^(?:(?:sprint|short|mile|medium|middle|long|turf|dirt|runaway|front|pace|late|end)\s+[SABCDEFG]\b[\s,/]*)+$/i

/**
 * A role that only restates aptitudes ("Sprint F Front E", "Sprint E End D"),
 * which the guide used to type by hand: hidden once the letters are drawn.
 * A real role ("Normal Front", "RA", "Runaway blocker") is not one.
 */
export function isAptitudeOnlyRole(role: string): boolean {
	return APTITUDE_ROLE.test(role.trim())
}

/**
 * One style's umas under their stars, most stars first; within a group the
 * guide's order. The guide draws a stars header per group and every tile at
 * one size beneath it.
 */
export function umasByStars(rows: PvpUmaRecommendation[]): Array<{ stars: number; rows: PvpUmaRecommendation[] }> {
	const groups = new Map<number, PvpUmaRecommendation[]>()
	for (const row of rows) groups.set(row.stars, [...(groups.get(row.stars) ?? []), row])
	return [...groups.entries()].sort(([a], [b]) => b - a).map(([stars, list]) => ({ stars, rows: list }))
}

/**
 * The All tab's face line (owner, 2026-10-24): a style's umas most stars
 * first, the guide's order within a star group, the first `count`, and how
 * many more there are.
 */
export function topUmas(rows: PvpUmaRecommendation[], count: number): { shown: PvpUmaRecommendation[]; more: number } {
	const ordered = umasByStars(rows).flatMap((group) => group.rows)
	return { shown: ordered.slice(0, count), more: Math.max(0, ordered.length - count) }
}

/**
 * The All tab's skill line: a position's own skills in its best tier (T0 when
 * it has one), in the order the style's tab shows them. A guide with no tiers
 * (the sheet era) gives all its skills under tier null, for the caller to cut.
 */
export function topTierSkills(rows: PvpSkillRecommendation[], style: PvpStyle): { tier: number | null; skills: PvpSkillRecommendation[] } {
	const own = skillsForPosition(rows, style)
	if (own.length === 0) return { tier: null, skills: [] }
	const tier = own[0].tier
	return { tier, skills: own.filter((row) => row.tier === tier) }
}

/** Styles in the guide's ranking order, any it doesn't rank after them in their own order. */
export function stylesByRank<S extends PvpStyle>(styles: S[], ranking: RankingStep[]): S[] {
	const ranks = styleRanks(ranking)
	const rank = (style: S) => ranks.get(style) ?? Number.MAX_SAFE_INTEGER
	return styles
		.map((style, index) => ({ style, index }))
		.sort((a, b) => rank(a.style) - rank(b.style) || a.index - b.index)
		.map(({ style }) => style)
}

/** A deck's own cards, main rows only, in slot order, each once. */
function deckCards(deck: PvpDeck): PvpSupportCardRef[] {
	const cards = new Map<number, PvpSupportCardRef>()
	for (const row of [...deck.slots].sort((a, b) => a.slot - b.slot || a.order - b.order)) {
		if (row.order === 0 && row.support_card && !cards.has(row.support_card.id)) cards.set(row.support_card.id, row.support_card)
	}
	return [...cards.values()]
}

/**
 * The cards in every deck of a style's ladder (Beginner, Standard, Whale), in
 * the first deck's order: the line over the decks that says what never
 * changes. Empty with fewer than two decks.
 */
export function cardsInEveryDeck(ladder: PvpDeck[]): PvpSupportCardRef[] {
	if (ladder.length < 2) return []
	const others = ladder.slice(1).map((deck) => new Set(deckCards(deck).map((card) => card.id)))
	return deckCards(ladder[0]).filter((card) => others.every((ids) => ids.has(card.id)))
}

export interface DeckChange {
	/** The deck it is compared with: the one before it in the ladder. */
	previous: string
	added: PvpSupportCardRef[]
	removed: PvpSupportCardRef[]
}

/**
 * What each deck after the first changes from the one before it, by card,
 * keyed by deck id. Main rows only: an alternative is not the deck's card.
 */
export function deckChanges(ladder: PvpDeck[]): Map<number, DeckChange> {
	const changes = new Map<number, DeckChange>()
	ladder.forEach((deck, index) => {
		if (index === 0) return
		const before = deckCards(ladder[index - 1])
		const now = deckCards(deck)
		const beforeIds = new Set(before.map((card) => card.id))
		const nowIds = new Set(now.map((card) => card.id))
		changes.set(deck.id, {
			previous: ladder[index - 1].label,
			added: now.filter((card) => !beforeIds.has(card.id)),
			removed: before.filter((card) => !nowIds.has(card.id)),
		})
	})
	return changes
}

/** "A", "A and B", "A, B and C". */
export function listWords(words: string[]): string {
	if (words.length <= 1) return words.join("")
	return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`
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
