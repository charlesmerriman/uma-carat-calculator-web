/**
 * The course map's layers as overlays (notes/course-map-plan.md, "The layer
 * menu"): pure functions from the API's per-course skill zones (GET
 * /race-courses/<id>/skill-zones) and the reader's own setup to the strip's
 * `{spans}` contract, so the map itself never changes for a layer.
 *
 * Two layers today: the skill row a reader opened (its zones lit), and "My
 * veterans' skills" (the team's linked veterans, one group of lanes each).
 * Each lit skill carries its verdict in words (verdictLines,
 * notes/course-map-plan-2.md, section 2): the API works out where it fires
 * against the late-race start (skill_verdicts.py); this module only words it.
 */
import type { MemberStyle } from "../types/pvpTeam"
import type { VeteranPicks } from "../services/courseMapStore"
import { formatMetres, phaseStarts, type CourseMarker, type CourseSpan, type SpanKind } from "./courseGeometry"

export interface SkillZone {
	start: number
	end: number
	kind: "fixed" | "random" | "point"
}

/** One skill on one course (the API's skill_zones.py and skill_verdicts.py shape). */
export interface SkillZoneEntry {
	kind: "place" | "anywhere" | "passive" | "never"
	zones: SkillZone[]
	/** The guide's style keys the skill is gated to, or null for every style. */
	styles: string[] | null
	// The verdict, each field only when it says something (api-reference.md).
	effects?: ("accel" | "speed" | "heal" | "debuff")[]
	/** A fixed zone's first metre: it fires there when its other clauses hold then. */
	fires_at?: number
	/** The first and last metre a random trigger can land on. */
	spread?: [number, number]
	/**
	 * Metres from the late-race start (negative is before); odds once the
	 * window is confirmed; for an accel, `useful`, a ranking score never shown.
	 */
	spurt?: { from: number; to: number; odds?: number; useful?: number }
	/** A heal's share landing before the late-race HP check. */
	before_spurt?: number
	/** A speed skill's share still running at the late-race start, and where it must fire for that. */
	carry?: number
	carry_window?: [number, number]
	/** How many times a short-cooldown skill can fire here. */
	repeats?: number
	/** What else must hold, in verified words. */
	needs?: string[]
	/** A clause the map can't read yet: no timing fields at all. */
	unreadable?: boolean
	/** Set off by other skills: "after using 3 or more recovery skills". */
	chain?: { counts: "heal" | "all" | "start" | "middle"; at_least: number }
}

/** Skill id (as a string, JSON's key) -> where it fires on the course. */
export type SkillZoneMap = Record<string, SkillZoneEntry>

/** A labelled span, with the key a pop-in animation tracks it by. */
export interface LayerSpan extends CourseSpan {
	key: string
}

/**
 * One skill's zones as spans, its verdict as their `detail`. Where it can
 * fire anywhere (or always, a passive), one span over the whole course says
 * so; never, nothing.
 */
export function skillSpans(entry: SkillZoneEntry | undefined, distance: number, label: string, lane = 0, key = label): LayerSpan[] {
	if (!entry || entry.kind === "never") return []
	const detail = verdictLines(entry, distance).join(". ")
	if (entry.kind === "anywhere" || entry.kind === "passive") {
		return [{ key: `${key}-all`, start: 0, end: distance, kind: entry.kind as SpanKind, label, lane, detail }]
	}
	return entry.zones.map((zone, index) => ({
		key: `${key}-${index}`,
		start: zone.start,
		end: zone.end,
		kind: zone.kind,
		label,
		lane,
		detail,
	}))
}

// ── The verdict in words (notes/course-map-plan-2.md, sections 2 to 5, 7) ──

// The API's note for a clause skill_text can't word (skill_verdicts.needs_for).
const UNREADABLE_NOTE = "Plus a condition we can't read yet"

function lowerFirst(text: string): string {
	return text.slice(0, 1).toLowerCase() + text.slice(1)
}

function percent(share: number): string {
	return `${Math.round(share * 100)}%`
}

/** An accel's trigger against the late-race start, in metres. */
function spurtWords(entry: SkillZoneEntry, hasNeeds: boolean): string | null {
	const { spurt } = entry
	if (!spurt) return null
	const away = (metres: number) => formatMetres(Math.abs(metres))
	if (entry.fires_at !== undefined) {
		// Rule 1: a fixed zone fires at its start, or from there once its other
		// clauses hold.
		const d = spurt.from
		if (Math.abs(d) < 1) return hasNeeds ? "From the moment the late race starts" : "Fires as the late race starts"
		const where = d < 0 ? `${away(d)} before the late race starts` : `${away(d)} into the late race`
		return hasNeeds ? `From ${where}` : `Fires ${where}`
	}
	const { from, to } = spurt
	if (Math.abs(to) < 1) return `At a random point in the ${away(from)} before the late race starts`
	if (to <= 0) return `At a random point ${away(to)} to ${away(from)} before the late race starts`
	if (from >= 0) {
		return from === 0
			? `At a random point in the first ${away(to)} of the late race`
			: `At a random point ${away(from)} to ${away(to)} into the late race`
	}
	return `At a random point from ${away(from)} before to ${away(to)} into the late race`
}

/** Where on the course, in plain metres, for anything but an accel. */
function placeWords(entry: SkillZoneEntry, hasNeeds: boolean): string | null {
	if (entry.fires_at !== undefined) {
		const where = entry.fires_at === 0 ? "the start" : formatMetres(entry.fires_at)
		return hasNeeds ? `From ${where}` : `Fires at ${where}`
	}
	if (entry.spread) return `At a random point from ${formatMetres(entry.spread[0])} to ${formatMetres(entry.spread[1])}`
	return null
}

/** A heal against the late-race HP check (section 4). */
function healWords(entry: SkillZoneEntry, distance: number): string[] {
	const share = entry.before_spurt
	const lines: string[] = []
	const last = entry.fires_at ?? entry.spread?.[1]
	if (last !== undefined && last < phaseStarts(distance).mid) lines.push("Fires in the early race, while HP is still high")
	if (share === 1) lines.push("Heals in time, before the late-race HP check")
	else if (share === 0) lines.push("Heals after the late-race HP check")
	else if (share !== undefined) lines.push(`${percent(share)} chance to heal in time, before the late-race HP check`)
	return lines
}

/** A speed skill against the late-race start (section 5). */
function carryWords(entry: SkillZoneEntry): string | null {
	const share = entry.carry
	if (share === undefined) return null
	if (share === 1) return "Carries into the late race"
	if (share === 0) return "Ends before the late race"
	return `${percent(share)} chance to carry into the late race`
}

/** What else must hold, as one line (section 3). */
function needsWords(needs: string[] | undefined): string | null {
	if (!needs || needs.length === 0) return null
	const readable = needs.filter((need) => need !== UNREADABLE_NOTE)
	const parts = readable.length > 0 ? [`Also needs: ${readable.map(lowerFirst).join("; ")}`] : []
	if (readable.length < needs.length) parts.push(UNREADABLE_NOTE)
	return parts.join(". ")
}

/**
 * A lit skill's verdict as lines a player reads, from the API's fields:
 * where it fires (against the last spurt for an accel), a heal against the HP
 * check, a speed skill against the spurt, repeats, then what else it needs.
 * Every line assumes the skill passes its Wit check, so none promises it fires.
 */
export function verdictLines(entry: SkillZoneEntry | undefined, distance: number): string[] {
	if (!entry) return []
	if (entry.kind === "never") return ["Can't fire on this course"]
	const lines: string[] = []
	const hasNeeds = (entry.needs?.length ?? 0) > 0
	if (entry.unreadable) {
		lines.push("Part of its trigger can't be read yet, so there's no timing for it")
	} else if (entry.kind === "passive") {
		lines.push("On for the whole race here")
	} else if (entry.kind === "anywhere") {
		lines.push("Not tied to a place on the course")
	} else {
		const accel = entry.effects?.includes("accel") ?? false
		const where = (accel ? spurtWords(entry, hasNeeds) : null) ?? placeWords(entry, hasNeeds)
		if (where) lines.push(where)
		if (accel && entry.spurt?.odds !== undefined) lines.push(`${percent(entry.spurt.odds)} chance to land at the late-race start`)
		if (entry.effects?.includes("heal")) lines.push(...healWords(entry, distance))
		const carry = entry.effects?.includes("speed") ? carryWords(entry) : null
		if (carry) lines.push(carry)
	}
	if (entry.repeats && entry.repeats > 1) lines.push(`Can fire up to ${entry.repeats} times here`)
	const needs = needsWords(entry.needs)
	if (needs) lines.push(needs)
	return lines
}

// ── An accel's grade (notes/course-map-visual-plan.md, "The verdict card") ──

export interface Grade {
	word: string
	/** How good: the card and the list colour the pill by it. */
	tone: "great" | "good" | "ok" | "poor"
	/** A random accel's odds of landing at the late-race start, shown beside the word. */
	odds?: number
}

/**
 * An accel's grade against the late-race start (owner, 2026-11-03: a word
 * with the odds beside it). A fixed zone that opens at the start is "At the
 * spurt"; one that opens before it and waits on a placing is "Ready before
 * it" (it fires when the placing holds, which can be at the start); one with
 * nothing to wait for fires at its start, early or late. A random point is
 * graded by its odds. Nothing for a skill that isn't an accel, has no
 * verdict, or whose odds aren't confirmed.
 */
export function grade(entry: SkillZoneEntry | undefined): Grade | null {
	if (!entry?.spurt || !entry.effects?.includes("accel") || entry.unreadable) return null
	const { spurt } = entry
	if (entry.fires_at !== undefined) {
		if (Math.abs(spurt.from) < 1) return { word: "At the spurt", tone: "great" }
		if (spurt.from < 0) return (entry.needs?.length ?? 0) > 0 ? { word: "Ready before it", tone: "good" } : { word: "Early", tone: "poor" }
		return { word: "Late", tone: "poor" }
	}
	if (spurt.odds === undefined) return null
	const odds = spurt.odds
	if (odds >= 0.9) return { word: "At the spurt", tone: "great", odds }
	if (odds >= 0.5) return { word: "Usually lands", tone: "good", odds }
	if (odds >= 0.2) return { word: "Sometimes lands", tone: "ok", odds }
	return { word: "Rarely lands", tone: "poor", odds }
}

// ── Skills set off by other skills (notes/course-map-plan-2.md, section 6) ──

export type ChainResult = { from: number; to: number } | { missing: number; have: number }

const COUNT_WORDS: Record<NonNullable<SkillZoneEntry["chain"]>["counts"], string> = {
	heal: "recovery skills",
	all: "skills",
	start: "early-race skills",
	middle: "mid-race skills",
}

/**
 * Where a skill set off by others can fire, given the skills that can set it
 * off (`members`: the same runner's other skills on this course). The N-th of
 * them lands no earlier than the N-th smallest earliest point and no later
 * than the N-th smallest latest point; the skill then fires from its own
 * zone's start. Counted by each member's earliest point ("start": in the early
 * race; "middle": in the mid race). A member with no place (anywhere, never,
 * unreadable) can't be placed, so it isn't counted. Null without a chain.
 */
export function resolveChain(entry: SkillZoneEntry, members: (SkillZoneEntry | undefined)[], distance: number): ChainResult | null {
	const { chain } = entry
	if (!chain) return null
	const { mid, late } = phaseStarts(distance)
	const points = members.flatMap((member) => {
		if (!member || member.kind !== "place" || member.unreadable) return []
		const first = member.fires_at ?? member.spread?.[0]
		const last = member.fires_at ?? member.spread?.[1]
		if (first === undefined || last === undefined) return []
		const counts = chain.counts === "heal" ? (member.effects?.includes("heal") ?? false)
			: chain.counts === "start" ? first < mid
				: chain.counts === "middle" ? first >= mid && first < late
					: true
		return counts ? [{ first, last }] : []
	})
	if (points.length < chain.at_least) return { missing: chain.at_least - points.length, have: points.length }
	const nth = (values: number[]) => [...values].sort((a, b) => a - b)[chain.at_least - 1]
	const own = entry.fires_at ?? entry.spread?.[0] ?? 0
	return { from: Math.max(own, nth(points.map((point) => point.first))), to: Math.max(own, nth(points.map((point) => point.last))) }
}

/** A resolved chain in words, for the span's hover. */
function chainWords(result: { from: number; to: number }, chain: NonNullable<SkillZoneEntry["chain"]>): string {
	const where = result.from === result.to ? `fires at ${formatMetres(result.from)}` : `fires from ${formatMetres(result.from)} to ${formatMetres(result.to)}`
	return `Set off by her ${chain.at_least} ${COUNT_WORDS[chain.counts]}: ${where}`
}

export interface AccelRow {
	skillId: number
	entry: SkillZoneEntry
	/** The API's ranking score: the share landing at the spurt start times the speed it adds. */
	useful: number
}

/**
 * "Accels on this course" (notes/course-map-plan-2.md, section 8; owner,
 * 2026-11-03: only the accels "actually useful on the track", "ranked by
 * usefulness", by position with an "all"): every accel that can land at the
 * last spurt's start for this style, most useful first (the API's `useful`),
 * ties by `rank` (uniques first), then id. An accel that can only fire before
 * or after the start, or whose timing can't be read, is left out.
 */
export function accelRows(zones: SkillZoneMap, style: MemberStyle | "all", rank: (skillId: number) => number = () => 0): AccelRow[] {
	const rows: AccelRow[] = []
	for (const [key, entry] of Object.entries(zones)) {
		if (!entry.effects?.includes("accel") || entry.kind !== "place" || entry.unreadable) continue
		if (style !== "all" && !firesForStyle(entry, style)) continue
		const useful = entry.spurt?.useful ?? 0
		if (useful > 0) rows.push({ skillId: Number(key), entry, useful })
	}
	return rows.sort((a, b) => b.useful - a.useful || rank(a.skillId) - rank(b.skillId) || a.skillId - b.skillId)
}

/**
 * The open skill's layer: its zones (lane 0), the carry-over band when the API
 * has one (lane 1), and a "Heal before here" mark at the late-race start while
 * a heal is lit (section 4; opt-in like every layer).
 */
export function focusLayer(entry: SkillZoneEntry | undefined, distance: number, name: string, skillId: number): { spans: LayerSpan[]; markers: CourseMarker[] } {
	const spans = skillSpans(entry, distance, name, 0, `focus-${skillId}`)
	const markers: CourseMarker[] = []
	if (entry?.carry_window) {
		const [start, end] = entry.carry_window
		spans.push({ key: `carry-${skillId}`, start, end, kind: "window", label: "Carry-over window", lane: 1 })
	}
	if (entry?.effects?.includes("heal") && entry.kind !== "never") {
		markers.push({ at: phaseStarts(distance).late, kind: "heal-check", label: "Heal before here" })
	}
	return { spans, markers }
}

/** Whether a skill fires for a runner of this style ("runaway" is a front runner). */
export function firesForStyle(entry: SkillZoneEntry, style: MemberStyle): boolean {
	if (entry.styles === null) return true
	return entry.styles.includes(style === "runaway" ? "front" : style)
}

/**
 * Rows for labels so none overlaps another: a span takes the first row whose
 * last span ends before it starts (counting its label's width, a share of the
 * race), the way the plan's `packLabels` reads. Returns a row per span, in the
 * order given.
 */
export function packLabels(spans: { start: number; end: number; labelShare: number }[], distance: number): number[] {
	const rows: number[] = []
	const ends: number[] = []
	const order = spans.map((_, index) => index).sort((a, b) => spans[a].start - spans[b].start)
	for (const index of order) {
		const span = spans[index]
		const reach = Math.max(span.end, span.start + span.labelShare * distance)
		let row = ends.findIndex((end) => end <= span.start)
		if (row === -1) row = ends.length
		ends[row] = reach
		rows[index] = row
	}
	return rows
}

export interface VeteranInLayer {
	/** The team member's position, for keys. */
	key: string
	/** Her trained uma's id: the reader's picks for her follow it (courseMapStore). */
	veteranId: number
	umaId: number
	style: MemberStyle
	skillIds: number[]
}

/** Whether the reader shows this veteran: yes unless they unticked her. */
export function veteranShown(picks: VeteranPicks, veteran: VeteranInLayer): boolean {
	return picks.veterans[veteran.veteranId] ?? true
}

/**
 * Whether the reader shows one of her skills: their tick if they made one,
 * else her accels only, the skills that decide races (owner, 2026-11-03), so
 * the layer starts legible on the track.
 */
export function skillShown(picks: VeteranPicks, veteran: VeteranInLayer, skillId: number, entry: SkillZoneEntry | undefined): boolean {
	return picks.skills[`${veteran.veteranId}:${skillId}`] ?? (entry?.effects?.includes("accel") ?? false)
}

/** Where a skill first fires here, for listing in race order. */
function firstMetre(entry: SkillZoneEntry): number {
	return entry.fires_at ?? entry.spread?.[0] ?? entry.zones[0]?.start ?? Infinity
}

/**
 * The skills of hers that can fire at a place on this course for her style
 * (what the Layers menu lists under her), in race order, filtered by the
 * "Only the guide's" choice when it is on.
 */
export function veteranSkillChoices(veteran: VeteranInLayer, zones: SkillZoneMap, keep: (skillId: number) => boolean): number[] {
	return veteran.skillIds
		.filter((skillId) => {
			const entry = zones[String(skillId)]
			return entry !== undefined && entry.kind === "place" && firesForStyle(entry, veteran.style) && keep(skillId)
		})
		.sort((a, b) => firstMetre(zones[String(a)]) - firstMetre(zones[String(b)]))
}

export interface VeteranLane {
	key: string
	umaId: number
	/** The first lane this veteran's spans use, and how many. */
	firstLane: number
	lanes: number
}

/** ~ how much of the strip a label takes: 6px a character plus padding, of ~1100px. */
function labelShareOf(label: string): number {
	return (label.length * 6 + 16) / 1100
}

/**
 * The veterans' layer (owner, 2026-11-02): each veteran's learned skills that
 * fire at a PLACE on this course for her style, as labels, one group of lanes
 * per veteran (packed so labels don't overlap). `keep` is the "All that fire
 * at a place" / "Only the guide's" choice; anywhere, passive and never skills
 * are not drawn. With `chains` ("Skills set off by other skills", owner
 * 2026-11-03: every such skill, toggleable), a skill set off by others is
 * drawn where her own skills set it off (resolveChain), and not at all when
 * she lacks enough of them.
 */
export function veteranLayer(
	veterans: VeteranInLayer[],
	zones: SkillZoneMap,
	distance: number,
	names: ReadonlyMap<number, string>,
	keep: (skillId: number, veteran: VeteranInLayer) => boolean,
	options: { chains?: boolean } = {},
): { spans: LayerSpan[]; lanes: VeteranLane[] } {
	const spans: LayerSpan[] = []
	const lanes: VeteranLane[] = []
	let nextLane = 0
	for (const veteran of veterans) {
		const own: LayerSpan[] = []
		for (const skillId of veteran.skillIds) {
			const entry = zones[String(skillId)]
			if (!entry || entry.kind !== "place" || !firesForStyle(entry, veteran.style) || !keep(skillId, veteran)) continue
			const label = names.get(skillId) ?? `Skill ${skillId}`
			const key = `${veteran.key}-${skillId}`
			if (options.chains && entry.chain) {
				const others = veteran.skillIds.filter((other) => other !== skillId).map((other) => zones[String(other)])
				const result = resolveChain(entry, others, distance)
				if (result && "missing" in result) continue
				if (result) {
					const kind = result.from === result.to ? "fixed" : "random"
					own.push({ key: `${key}-chain`, start: result.from, end: result.to, kind, label, lane: 0, detail: chainWords(result, entry.chain) })
					continue
				}
			}
			own.push(...skillSpans(entry, distance, label, 0, key))
		}
		if (own.length === 0) continue
		const rows = packLabels(own.map((span) => ({ start: span.start, end: span.end, labelShare: labelShareOf(span.label ?? "") })), distance)
		const count = Math.max(...rows) + 1
		own.forEach((span, index) => spans.push({ ...span, lane: nextLane + rows[index] }))
		lanes.push({ key: veteran.key, umaId: veteran.umaId, firstLane: nextLane, lanes: count })
		nextLane += count
	}
	return { spans, lanes }
}
