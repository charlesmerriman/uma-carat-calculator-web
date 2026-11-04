/**
 * The course map's layers as overlays (notes/course-map-plan.md, "The layer
 * menu"): pure functions from the API's per-course skill zones (GET
 * /race-courses/<id>/skill-zones) and the reader's own setup to the strip's
 * `{spans}` contract, so the map itself never changes for a layer.
 *
 * Two layers today: the skill row a reader opened (its zones lit), and "My
 * veterans' skills" (the team's linked veterans, one group of lanes each).
 */
import type { MemberStyle } from "../types/pvpTeam"
import type { CourseSpan, SpanKind } from "./courseGeometry"

export interface SkillZone {
	start: number
	end: number
	kind: "fixed" | "random" | "point"
}

/** One skill on one course (the API's skill_zones.py shape). */
export interface SkillZoneEntry {
	kind: "place" | "anywhere" | "passive" | "never"
	zones: SkillZone[]
	/** The guide's style keys the skill is gated to, or null for every style. */
	styles: string[] | null
}

/** Skill id (as a string, JSON's key) -> where it fires on the course. */
export type SkillZoneMap = Record<string, SkillZoneEntry>

/** A labelled span, with the key a pop-in animation tracks it by. */
export interface LayerSpan extends CourseSpan {
	key: string
}

/**
 * One skill's zones as spans. Where it can fire anywhere (or always, a
 * passive), one span over the whole course says so; never, nothing.
 */
export function skillSpans(entry: SkillZoneEntry | undefined, distance: number, label: string, lane = 0, key = label): LayerSpan[] {
	if (!entry || entry.kind === "never") return []
	if (entry.kind === "anywhere" || entry.kind === "passive") {
		return [{ key: `${key}-all`, start: 0, end: distance, kind: entry.kind as SpanKind, label, lane }]
	}
	return entry.zones.map((zone, index) => ({
		key: `${key}-${index}`,
		start: zone.start,
		end: zone.end,
		kind: zone.kind,
		label,
		lane,
	}))
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
	umaId: number
	style: MemberStyle
	skillIds: number[]
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
 * are not drawn.
 */
export function veteranLayer(
	veterans: VeteranInLayer[],
	zones: SkillZoneMap,
	distance: number,
	names: ReadonlyMap<number, string>,
	keep: (skillId: number, veteran: VeteranInLayer) => boolean,
): { spans: LayerSpan[]; lanes: VeteranLane[] } {
	const spans: LayerSpan[] = []
	const lanes: VeteranLane[] = []
	let nextLane = 0
	for (const veteran of veterans) {
		const own: LayerSpan[] = []
		for (const skillId of veteran.skillIds) {
			const entry = zones[String(skillId)]
			if (!entry || entry.kind !== "place" || !firesForStyle(entry, veteran.style) || !keep(skillId, veteran)) continue
			own.push(...skillSpans(entry, distance, names.get(skillId) ?? `Skill ${skillId}`, 0, `${veteran.key}-${skillId}`))
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
