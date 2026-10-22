/**
 * Logic the timeline's banner card and race card both need.
 *
 * Split out of Timeline.tsx when the Champions Meeting card was generalised into
 * RaceEventCard — leaving it in Timeline.tsx would have made the card module
 * import from its own parent. Kept as a plain `.ts` module (no JSX, components
 * live in their own files) so React Fast Refresh isn't disabled here.
 */

import type { RefObject } from "react"
import { differenceInCalendarDays } from "date-fns"
import { parseApiDate } from "../../utils/dateFormat"
import { startOfUtcDay } from "../../utils/utcDates"
import { isRaceEvent } from "../../types"
import type { TimelineFocus } from "../../utils/timelineFocus"
import { refForRaceEvent } from "../../utils/pvpEvent"
import type {
	AnniversaryEvent,
	AttachedAnniversaryEvent,
	BannerCategory,
	BannerTimelineForViewing,
	RaceEvent,
	Scenario,
	TimelineEvent,
} from "../../types"

// Countdown label for the badge in a card's header. Both dates are parsed
// through parseApiDate so date-only strings land on *local* midnight —
// `new Date("2026-08-10")` would parse as UTC and shift the day count by one
// for anyone west of GMT. Comparing calendar days (not elapsed hours) means an
// event starting later today reads "Starts today" rather than "in 0 days".
export function getCountdownLabel(startDate: string, endDate: string, today: Date): string {
	const start = parseApiDate(startDate)
	const end = parseApiDate(endDate)
	if (!start || !end) return ""

	const daysUntilStart = differenceInCalendarDays(start, today)
	if (daysUntilStart > 1) return `In ${daysUntilStart} Days`
	if (daysUntilStart === 1) return "Starts Tomorrow"
	if (daysUntilStart === 0) return "Starts Today"

	// Already started — the countdown flips to how much of it is left.
	const daysUntilEnd = differenceInCalendarDays(end, today)
	if (daysUntilEnd > 1) return `Ends in ${daysUntilEnd} Days`
	if (daysUntilEnd === 1) return "Ends Tomorrow"
	if (daysUntilEnd === 0) return "Ends Today"
	return "Ended"
}

/**
 * Display names for the banner categories, in the order the filter offers them.
 *
 * One source of truth because the same words appear twice — on the chip in a
 * timeline section and in the category filter's dropdown — and a reader
 * filtering for "Golden Week Revival" has to see that exact phrase on the cards
 * that come back.
 *
 * `standard` has a label even though it never renders a chip: the filter still
 * has to name it.
 */
export const CATEGORY_LABELS: Record<BannerCategory, string> = {
	standard: "Standard",
	golden_week_revival: "Golden Week",
	race_prep_support: "10 Select 2 Scout",
	rerun: "Rerun",
}

/** Filter order: the ordinary case first, then the exceptions. */
export const CATEGORY_ORDER: BannerCategory[] = [
	"standard",
	"golden_week_revival",
	"race_prep_support",
	"rerun",
]

/**
 * Display names for the marker kinds, as the filter offers them.
 *
 * Deliberately a SEPARATE map from CATEGORY_LABELS rather than four more
 * entries in it. A marker kind is a different axis from a banner category — a
 * scenario has no `banner_category` and never will — and folding them into one
 * record would blur that boundary the same way merging `banner_type` and
 * `banner_category` does.
 *
 * The words are EventMarkerCard's chips, pluralised ("New scenario" reads as an
 * announcement on a card and as a miscount in a dropdown). A reader filtering
 * for "Campaigns" has to recognise the cards that come back.
 */
export const MARKER_LABELS: Record<TimelineMarker["kind"], string> = {
	scenario: "Scenarios",
	anniversary: "Campaigns",
}

/** Filter order, matching how the two kinds sort against each other. */
export const MARKER_ORDER: TimelineMarker["kind"][] = ["scenario", "anniversary"]

/**
 * Banners that open at the same moment, presented as one timeline card.
 *
 * The game regularly runs two banners concurrently — most visibly the Golden
 * Week revivals, where a revival banner of up to eleven umas runs alongside an
 * ordinary two-uma banner. Our data mirrors the source sheet and stores those
 * as separate BannerTimeline rows, which is correct and must stay that way:
 * they are separate gacha pools with separate pity, UserPlannedBanner
 * foreign-keys the BannerUma rather than the timeline, and their end dates can
 * differ — and income is a pure function of a banner's end date, so collapsing
 * them in the database would move real carat numbers.
 *
 * So the merge happens here, at render time, where it costs nothing: one card,
 * one header, one panel per constituent banner, each keeping its own dates and
 * its own "Add to Planner" button.
 *
 * A group of one is the overwhelmingly common case and renders exactly as a
 * lone banner always did — the grouped path is the only path, so there is no
 * second layout to keep in sync.
 *
 * "The same moment" has two readings, and a group accepts either — see
 * groupTimelineEvents: the same global start, or the same JP start. The second
 * is the STAGGERED release: one JP window whose uma and support banners global
 * opened on different days, entered as two rows that share their JP dates.
 */
export interface BannerWindowGroup {
	/**
	 * The EARLIEST opening instant across the group, and the group's identity.
	 * Every constituent shares it unless the release was staggered.
	 */
	start_date: string
	/** The LATEST end across the group, so the header states the union window. */
	end_date: string
	/** True if any constituent's dates are still an estimate. */
	is_predicted: boolean
	/** In API order. Never empty. */
	banners: BannerTimelineForViewing[]
	/**
	 * The first campaign attached to any constituent. Campaigns attach per
	 * banner, but the strip renders above the whole card, so a group can only
	 * show one — and in the data a campaign covers every banner in its window.
	 */
	anniversary_event: AttachedAnniversaryEvent | null
}

/**
 * One row of the rendered timeline: either a race event, or a window of one or
 * more concurrent banners.
 *
 * Tagged rather than shape-tested, for the same reason TimelineEvent is —
 * see the note on isRaceEvent in types/calculator.
 */
export type TimelineRow =
	| { kind: "race"; event: RaceEvent }
	| { kind: "banner_window"; group: BannerWindowGroup }
	| { kind: "marker"; marker: TimelineMarker }
	| { kind: "marker_pair"; scenario: TimelineMarker; anniversary: TimelineMarker }

/**
 * A scenario launch or a campaign opening, rendered as its own card in the
 * stream rather than attached to a banner.
 *
 * A FRONTEND row kind, not a backend union member, and deliberately so:
 * `organizedTimelineData` narrows on the backend's `event_type` tag, but
 * `AnniversaryEvent.event_type` already means something else entirely (the
 * campaign kind — anniversary / new_year / campaign). Tagging these server-side
 * would collide with a shipped field.
 *
 * `endDate` is null for a scenario and only a scenario: a scenario is released
 * and then stays available permanently, so it is a single dated instant with
 * nothing to close. Branch on that rather than on `kind` when deciding whether
 * to render a range.
 */
export interface TimelineMarker {
	/** Collision-proof across kinds; see timelineRowKey. */
	key: string
	kind: "scenario" | "anniversary"
	/**
	 * The Scenario / AnniversaryEvent primary key this was built from.
	 *
	 * Held alongside `key` rather than parsed back out of it: `key` is a React
	 * identity string whose format is this module's business, and a deep link
	 * has to survive that format changing. `kind` + `sourceId` is exactly a
	 * TimelineFocus, which is what makes rowMatchesFocus a plain comparison.
	 */
	sourceId: number
	name: string
	/**
	 * For an anniversary this is its `main_start_date`, so the card lands on the
	 * anniversary rather than on the Part 1 run-up that opens the campaign.
	 */
	startDate: string
	/** Null for scenarios — they have no end. */
	endDate: string | null
	/** Often null: art routinely lands after the row does. */
	image: string | null
	isPredicted: boolean
}

/**
 * A React key that survives re-filtering and can't collide across row kinds.
 *
 * Ids are unique only within a model, so a bare id would let Champions Meeting
 * 4 and a banner window share a key. Banner windows key on their start date
 * rather than an id: every start instant belongs to exactly one group (see
 * groupTimelineEvents), so it is unique across the list by construction, and
 * it stays stable if the API reorders the banners within a group. Markers
 * carry their own already-prefixed key.
 */
export function timelineRowKey(row: TimelineRow): string {
	if (row.kind === "race") {
		return `${row.event.event_type === "champions_meeting" ? "cm" : "loh"}-${row.event.id}`
	}
	if (row.kind === "marker") {
		return row.marker.key
	}
	if (row.kind === "marker_pair") {
		// Both halves' keys, so the pair is distinct from either marker on its own
		// (a kind filter renders the halves as lone markers, and the two lists
		// must not share a key).
		return `${row.scenario.key}+${row.anniversary.key}`
	}
	return `win-${row.group.start_date}`
}

/**
 * Whether a rendered row is the one a deep link is pointing at.
 *
 * The counterpart to `timelineFocusHref` on the calculator side — see
 * `utils/timelineFocus.ts` for why the link names a target instead of using a
 * plain `#hash`.
 *
 * A banner focus matches a WINDOW containing that BannerTimeline, not a row
 * whose id equals it: concurrent banners merge into one card (see
 * BannerWindowGroup), so the card a reader lands on is routinely shared with a
 * banner they did not click. A marker focus likewise matches the PAIR row
 * holding that marker when it launched alongside its other half (see
 * pairSameDayMarkers) — the shared panel is the card the reader lands on. A
 * "cm" / "loh" focus (the PvP page's "View on Timeline") matches the race
 * event of that kind and id, through refForRaceEvent, the one place that maps
 * the backend's event_type onto the kind.
 */
export function rowMatchesFocus(row: TimelineRow, focus: TimelineFocus): boolean {
	if (focus.kind === "cm" || focus.kind === "loh") {
		if (row.kind !== "race") return false
		const ref = refForRaceEvent(row.event)
		return ref.kind === focus.kind && ref.id === focus.id
	}
	if (focus.kind === "banner") {
		return (
			row.kind === "banner_window" &&
			row.group.banners.some((banner) => banner.id === focus.id)
		)
	}
	const matchesMarker = (marker: TimelineMarker): boolean =>
		marker.kind === focus.kind && marker.sourceId === focus.id
	if (row.kind === "marker") return matchesMarker(row.marker)
	if (row.kind === "marker_pair") {
		return matchesMarker(row.scenario) || matchesMarker(row.anniversary)
	}
	return false
}

/**
 * What a timeline card needs in order to BE a deep link's target.
 *
 * Both props are absent on every card but one, which is the point: the Timeline
 * holds a single ref for the focused card and hands it to whichever card that
 * is, so there is no per-row ref bookkeeping and no way for two cards to claim
 * the highlight at once.
 */
export interface TimelineFocusProps {
	/** Attached to the card's outermost node, for scrollIntoView. */
	focusRef?: RefObject<HTMLDivElement | null>
	/** Draws the arrival highlight — see TIMELINE_FOCUS_HIGHLIGHT. */
	isFocused?: boolean
}

/**
 * The ring that says "this is the card you clicked through for".
 *
 * Applied to the card PANEL rather than a card's outer wrapper, so it follows
 * the panel's own rounding and sits just off its edge.
 *
 * An OUTLINE, not a Tailwind `ring-*`. A ring is drawn with `box-shadow`, and
 * until 2026-10-18 every theme set `box-shadow` on `.card-panel` itself
 * (index.css), which outranked the utility, so the ring was silently dropped.
 * The card's shadow now composes with a ring, but the outline stays: no
 * shadow rule can touch it, and its offset gap is see-through, so it needs no
 * colour matched to the page background either.
 *
 * Shared with the Legend Races page's cards (LegendRaceReleaseCard).
 */
export const TIMELINE_FOCUS_HIGHLIGHT =
	"outline-2 outline-offset-2 outline-brand"


/**
 * Folds banner events that open at the same instant into one row, leaving race
 * events untouched.
 *
 * Grouping is on the exact `start_date` string, not on its calendar day. Both
 * agree on every row in production (eight groups, sixteen rows), and exact
 * equality is the stricter, unambiguous rule: two banners opening at the same
 * UTC instant are the same window for every reader, whereas a same-UTC-day test
 * could merge two banners that a reader west of GMT sees on different dates.
 *
 * A SHARED JP START GROUPS TOO, whatever the global starts are. JP runs a
 * release as one window; global has (2026-10, Hokko Tarumae) opened the uma
 * banner days before the support banner of that same window. The data stores
 * that as two BannerTimeline rows with identical JP dates and their own global
 * dates — correct, since each half's income is a function of its own end date —
 * and the shared `jp_start_date` is what says they are one release. No flag to
 * tick in the admin: copying the JP dates onto the second row is the whole
 * workflow. An unconfirmed pair predicts to the same instant from the same JP
 * date, so the JP rule only ever adds a group for rows global has confirmed
 * apart.
 *
 * The two rules are a UNION, not a replacement: the launch window holds rows
 * with one global start and two different JP starts, and must stay one card.
 * The global start is looked up first and a key is never re-pointed, so every
 * start instant belongs to exactly one group — which is what keeps
 * timelineRowKey unique.
 *
 * Order is preserved — a group sits where its first constituent sat, so the
 * caller's sort still holds. The input is ascending by start, so that first
 * constituent is also the group's earliest.
 *
 * Pure, and called on an already-filtered list: grouping must run AFTER the
 * past/future split, or a group could straddle the boundary and drag an ended
 * banner into the current view. A staggered pair whose halves END on different
 * days therefore splits across that boundary once the first half is over.
 */
export function groupTimelineEvents(events: TimelineEvent[]): TimelineRow[] {
	const rows: TimelineRow[] = []
	// Prefixed, so a JP instant can never be mistaken for a global one.
	const groupsByKey = new Map<string, BannerWindowGroup>()

	for (const event of events) {
		if (isRaceEvent(event)) {
			rows.push({ kind: "race", event })
			continue
		}

		const startKey = `start:${event.start_date}`
		const jpKey = event.jp_start_date ? `jp:${event.jp_start_date}` : null
		const existing =
			groupsByKey.get(startKey) ?? (jpKey ? groupsByKey.get(jpKey) : undefined)
		if (existing) {
			existing.banners.push(event)
			// This banner's own keys now lead here as well (never overwriting one
			// that already leads somewhere), so a later row matching it on either
			// date joins the same card.
			if (!groupsByKey.has(startKey)) groupsByKey.set(startKey, existing)
			if (jpKey && !groupsByKey.has(jpKey)) groupsByKey.set(jpKey, existing)
			// Widen the header's window to cover every constituent, and keep the
			// predicted badge if any one of them is still an estimate. ISO-8601
			// strings compare correctly with `>`, which is why the dates never
			// need parsing here.
			if (event.start_date < existing.start_date) existing.start_date = event.start_date
			if (event.end_date > existing.end_date) existing.end_date = event.end_date
			existing.is_predicted ||= event.is_predicted
			existing.anniversary_event ??= event.anniversary_event
			continue
		}

		// Held in both the map and the row list on purpose — same object, so the
		// appends above are visible to the row already pushed here.
		const group: BannerWindowGroup = {
			start_date: event.start_date,
			end_date: event.end_date,
			is_predicted: event.is_predicted,
			banners: [event],
			anniversary_event: event.anniversary_event,
		}
		groupsByKey.set(startKey, group)
		if (jpKey && !groupsByKey.has(jpKey)) groupsByKey.set(jpKey, group)
		rows.push({ kind: "banner_window", group })
	}

	return rows
}

/**
 * One section of a banner window card: usually one BannerTimeline, or the two
 * halves of a staggered release drawn as one.
 *
 * `umaWindow` and `supportWindow` are the rows each PANEL reads its banner and
 * its dates from. On an ordinary section both are the same row as `primary`;
 * on a fused one they differ, and each panel's stage button, expiry and date
 * line follow its own row.
 */
export interface BannerWindowSection {
	/** Supplies the name, the category chrome and (first choice) the art. */
	primary: BannerTimelineForViewing
	umaWindow: BannerTimelineForViewing
	supportWindow: BannerTimelineForViewing
	/** `primary`'s art, else the other half's. */
	image: string | null
	/** True when two rows were fused into this section. */
	isFused: boolean
	/**
	 * True when the two panels run on different days. The card header then
	 * says how each side differs from the window it states.
	 */
	isStaggered: boolean
}

/**
 * A Timeline banner card's title: who the window features (design polish item
 * 20). The card used to lead with its date range and put the names three
 * levels down, inside the panels; a reader scanning the list is looking for a
 * character, so the names lead and the dates become the subtitle.
 *
 * Umas first, the primary axis, then support cards, each name once (a support
 * card often shares an uma's name). Three names at most, "A, B and C"; past
 * that the first two and a count, because a Golden Week revival features up to
 * eleven and a title that wraps to four lines is no longer a title. Null when
 * nothing is announced yet, and the card keeps the dates as its title.
 */
export function featuredTitle(umaNames: string[], supportNames: string[]): string | null {
	const names = [...new Set([...umaNames, ...supportNames])]
	if (names.length === 0) return null
	if (names.length > 3) return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`
	if (names.length === 1) return names[0]
	return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

/**
 * A group's banners as the sections its card draws, fusing a staggered pair.
 *
 * Two rows fuse when they are COMPLEMENTARY: one carries an uma banner and no
 * support banner, the other a support banner and no uma banner, in the same
 * category. Drawn separately each would be a full section with an empty panel,
 * and the pair reads as two half-finished banners; fused they are the ordinary
 * art | umas | supports row, which is what the release is.
 *
 * Anything else stacks as before. A revival beside a standard banner is two uma
 * banners (two pools), not two halves of one, and a category mismatch would put
 * one half under the other's chip.
 *
 * The fused section sits where its uma half sat; the support half is consumed.
 */
export function buildWindowSections(
	banners: BannerTimelineForViewing[]
): BannerWindowSection[] {
	const isUmaOnly = (banner: BannerTimelineForViewing): boolean =>
		banner.banner_umas.length > 0 && banner.banner_supports.length === 0
	const isSupportOnly = (banner: BannerTimelineForViewing): boolean =>
		banner.banner_supports.length > 0 && banner.banner_umas.length === 0

	// Decide the pairs first, so a support half listed BEFORE its uma half is
	// still consumed rather than drawn and then drawn again.
	const supportHalfFor = new Map<number, BannerTimelineForViewing>()
	const consumed = new Set<number>()
	for (const banner of banners) {
		if (!isUmaOnly(banner)) continue
		const partner = banners.find(
			(other) =>
				isSupportOnly(other) &&
				!consumed.has(other.id) &&
				other.banner_category === banner.banner_category
		)
		if (!partner) continue
		supportHalfFor.set(banner.id, partner)
		consumed.add(partner.id)
	}

	const sections: BannerWindowSection[] = []
	for (const banner of banners) {
		if (consumed.has(banner.id)) continue
		const supportHalf = supportHalfFor.get(banner.id)
		sections.push({
			isStaggered:
				supportHalf !== undefined &&
				(supportHalf.start_date !== banner.start_date ||
					supportHalf.end_date !== banner.end_date),
			primary: banner,
			umaWindow: banner,
			supportWindow: supportHalf ?? banner,
			image: banner.image ?? supportHalf?.image ?? null,
			isFused: supportHalf !== undefined,
		})
	}
	return sections
}

/**
 * Caption for the step-ups running in a campaign window, e.g. "2 ★3 + 3 SSR
 * Step-Up". Returns null when there are none, so the caller renders nothing.
 *
 * Counts are summed per pool rather than listed per row: a campaign stores one
 * BannerStepUp per pool carrying how many banners it runs, and "2 ★3" is what a
 * player recognises — the individual rows have administrative names.
 *
 * ★3 and SSR are the game's own words for the two pools, and are what the
 * step-up row in the calculator shows, so the Timeline uses them too.
 */
export function formatStepUpChip(
	stepUps: { card_type: "uma" | "support"; banner_count: number }[]
): string | null {
	const totals = { uma: 0, support: 0 }
	for (const stepUp of stepUps) {
		totals[stepUp.card_type] += stepUp.banner_count
	}

	const parts: string[] = []
	if (totals.uma > 0) parts.push(`${totals.uma} ★3`)
	if (totals.support > 0) parts.push(`${totals.support} SSR`)

	return parts.length > 0 ? `${parts.join(" + ")} Step-Up` : null
}

/**
 * Turn scenarios and campaigns into timeline markers, dropping the undated.
 *
 * Undated is a normal state, not an error: a scenario with no launch banner
 * yet, or a campaign with no linked parts, has nothing to sort by and so has no
 * place in a chronological list.
 */
export function buildTimelineMarkers(
	scenarios: Scenario[],
	anniversaryEvents: AnniversaryEvent[]
): TimelineMarker[] {
	const markers: TimelineMarker[] = []

	for (const scenario of scenarios) {
		if (!scenario.start_date) continue
		markers.push({
			key: `sce-${scenario.id}`,
			kind: "scenario",
			sourceId: scenario.id,
			name: scenario.name,
			startDate: scenario.start_date,
			// Not "unknown" — a scenario genuinely has no end. It stays playable
			// after release, so there is nothing here to fill in later.
			endDate: null,
			image: scenario.image,
			isPredicted: scenario.is_predicted,
		})
	}

	for (const event of anniversaryEvents) {
		// Where the event ITSELF falls, so the card sits beside the anniversary
		// banner rather than ten days earlier beside the Part 1 run-up. The
		// fallback covers campaign kinds with no separate main part, for which
		// the backend resolves both to the same instant.
		const startDate = event.main_start_date ?? event.start_date
		if (!startDate) continue
		// `event_type: "campaign"` is the one-off-promotion catch-all — today only
		// the Trainer Support Pack, a permanently purchasable bundle. It marks no
		// moment on the calendar, so it gets no card, exactly as it gets no band
		// in the planner. Excluded by type, not by being undated.
		if (event.event_type === "campaign") continue
		markers.push({
			key: `ann-${event.id}`,
			kind: "anniversary",
			sourceId: event.id,
			name: event.name,
			startDate,
			// Deliberately NOT the main part's own end. The card reads "<the
			// anniversary opens> through <the campaign closes>", which is the
			// true span a player can still buy packs and pull the later parts in.
			endDate: event.end_date,
			image: event.image,
			isPredicted: event.is_predicted,
		})
	}

	return markers
}

/**
 * Whether any uma or support banner in this window carries the editorial
 * Recommended flag — the gold star from the planner's dropdown (see
 * RecommendedMark, isRecommendedBanner in utils/bannerHelpers.ts). Mirrored
 * here rather than reused, because that helper reads a `PlannableBanner` (the
 * planner's own union) and a window holds the raw nested arrays instead.
 *
 * A step-up has no such flag, matching isRecommendedBanner. `=== true` rather
 * than a truthiness read, for the same reason: a banner missing the field
 * (a deploy in progress) reads as not recommended.
 */
export function bannerWindowHasRecommended(banner: BannerTimelineForViewing): boolean {
	return (
		banner.banner_umas.some((uma) => uma.is_recommended === true) ||
		banner.banner_supports.some((support) => support.is_recommended === true)
	)
}

/**
 * Does either side of this banner window hand out free pulls?
 *
 * The same question as bannerWindowHasRecommended above, asked of `free_pulls`:
 * it lives on each junction row (the uma side and the support side are counted
 * apart), so a window qualifies when any of them carries some. `> 0` rather
 * than truthiness so a payload from before the field existed reads as none.
 */
export function bannerWindowHasFreePulls(banner: BannerTimelineForViewing): boolean {
	return (
		banner.banner_umas.some((uma) => uma.free_pulls > 0) ||
		banner.banner_supports.some((support) => support.free_pulls > 0)
	)
}

/**
 * Fold a scenario and a campaign that land on the same UTC day into one row.
 *
 * Scenarios almost always debut alongside an anniversary (the planner's section
 * band makes the same observation), and two full-width cards stacked for what
 * a player experiences as one launch read as two events on two dates. The
 * shared panel says "these arrived together" the way BannerWindowGroup does
 * for concurrent banners — and, as there, the fold is render-side only: the
 * Scenario and AnniversaryEvent rows stay separate in the data.
 *
 * Same calendar DAY rather than the same instant, deliberately. Either date
 * can be a prediction, and a predicted campaign resolved a few hours off a
 * real scenario launch is still the same launch. UTC, like every other date
 * comparison in the projection.
 *
 * Only the scenario + campaign pairing exists: two campaigns on one day, or
 * two scenarios, stay separate cards. The pair layout knows which half is
 * which, and a third combination would need its own design, not a silent
 * reuse of this one.
 *
 * Expects markers sorted the way buildMarkerRows sorts them (by instant,
 * scenario before campaign), so a pair is always two NEIGHBOURS with the
 * scenario first and one pass over adjacent entries finds every one.
 */
function pairSameDayMarkers(sortedMarkers: TimelineMarker[]): TimelineRow[] {
	const utcDay = (iso: string): number => startOfUtcDay(new Date(iso)).getTime()

	const rows: TimelineRow[] = []
	for (let index = 0; index < sortedMarkers.length; index += 1) {
		const marker = sortedMarkers[index]
		const following = sortedMarkers[index + 1]
		if (
			marker.kind === "scenario" &&
			following?.kind === "anniversary" &&
			utcDay(marker.startDate) === utcDay(following.startDate)
		) {
			rows.push({ kind: "marker_pair", scenario: marker, anniversary: following })
			index += 1
			continue
		}
		rows.push({ kind: "marker", marker })
	}
	return rows
}

/**
 * The markers a row holds: one for a marker row, both for a pair, none for a
 * banner window or a race.
 *
 * Every filter the timeline applies to markers goes through this, so a pair is
 * judged by EITHER half — the same "a group survives if any constituent
 * matches" rule the banner windows use. Filtering the markers before pairing
 * instead would strip the other half first, so the same launch would be a
 * pair under "All events" and a lone card under "Scenarios". That is not only
 * inconsistent to look at: the row's KEY changes with it, and the key is what
 * the list anchors on when a filter is lifted (see anchorRowKey in Timeline),
 * so the reader would lose their place on the way back to "All".
 */
function rowMarkers(row: TimelineRow): TimelineMarker[] {
	if (row.kind === "marker") return [row.marker]
	if (row.kind === "marker_pair") return [row.scenario, row.anniversary]
	return []
}

/** Whether a marker row holds a marker of `kind` — a pair holds both. */
export function markerRowMatchesKind(
	row: TimelineRow,
	kind: TimelineMarker["kind"]
): boolean {
	return rowMarkers(row).some((marker) => marker.kind === kind)
}

/** Whether any marker in the row is named by the (already lowercased) query. */
export function markerRowMatchesSearch(row: TimelineRow, query: string): boolean {
	return rowMarkers(row).some((marker) => marker.name.toLowerCase().includes(query))
}

/**
 * A row's opening instant in ms, or +Infinity for one that cannot be parsed
 * (which sorts it last rather than throwing the splice off).
 *
 * A pair answers with its scenario's instant: the scenario is the earlier half
 * by construction (see buildMarkerRows' sort), so the pair sits where the
 * scenario alone would have — and the past/future split judges the pair by
 * that same instant, so two halves a few hours apart across today can never
 * land on different sides of the toggle.
 */
export function timelineRowStart(row: TimelineRow): number {
	const iso =
		row.kind === "race" ? row.event.start_date
			: row.kind === "banner_window" ? row.group.start_date
				: row.kind === "marker" ? row.marker.startDate
					: row.scenario.startDate
	const ms = new Date(iso).getTime()
	return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms
}

/**
 * Markers to rows: sorted, then paired.
 *
 * A scenario sorts above a campaign at the same instant — the same rule the
 * calculator's section bands use, so the two surfaces agree — and that order
 * is what lets pairSameDayMarkers find every pair among neighbours.
 *
 * This runs BEFORE any filter, deliberately; see rowMarkers for why.
 */
export function buildMarkerRows(markers: TimelineMarker[]): TimelineRow[] {
	const sorted = [...markers].sort((a, b) => {
		const byTime =
			new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
		if (byTime !== 0) return byTime
		if (a.kind !== b.kind) return a.kind === "scenario" ? -1 : 1
		return a.name.localeCompare(b.name)
	})
	return pairSameDayMarkers(sorted)
}

/**
 * Splice already-sorted marker rows into an already-grouped, already-sorted
 * row list.
 *
 * Must run AFTER groupTimelineEvents, for the same reason grouping runs after
 * filtering: it consumes the final row order and inserts against it, so running
 * earlier would let a marker land inside a window that later folds together.
 *
 * A marker row sits before the first row starting at or after it. Markers
 * past the last row are appended, unlike in the planner: the timeline is the
 * whole calendar, so there is no "between" to fall outside of.
 */
export function spliceMarkerRows(
	rows: TimelineRow[],
	markerRows: TimelineRow[]
): TimelineRow[] {
	if (markerRows.length === 0) return rows

	const out: TimelineRow[] = []
	let next = 0
	for (const row of rows) {
		const start = timelineRowStart(row)
		while (next < markerRows.length && timelineRowStart(markerRows[next]) <= start) {
			out.push(markerRows[next])
			next += 1
		}
		out.push(row)
	}
	for (; next < markerRows.length; next += 1) {
		out.push(markerRows[next])
	}
	return out
}

/**
 * buildMarkerRows then spliceMarkerRows, for a caller with nothing to filter
 * in between.
 */
export function mergeTimelineMarkers(
	rows: TimelineRow[],
	markers: TimelineMarker[]
): TimelineRow[] {
	return spliceMarkerRows(rows, buildMarkerRows(markers))
}

// ── Control band styles ──────────────────────────────────────────────────────
// Shared by the Timeline's sticky band and the PvP page's, so the two bars of
// buttons read as the same control set. Moved here from Timeline.tsx.

export const controlButtonClass =
	"inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-100 shadow-sm transition hover:border-gray-500 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-45 md:min-h-0 md:py-1.5"
export const paginationButtonClass = `${controlButtonClass} min-w-28`
export const pageIndicatorClass =
	"inline-flex min-h-10 items-center justify-center rounded-md border border-gray-700 bg-gray-950/50 px-4 py-2 text-sm font-semibold text-gray-200 shadow-inner md:min-h-0 md:py-1.5"
// Matches controlButtonClass so the filter reads as a third control in that row
// rather than a form field that wandered in.
export const categorySelectClass =
	"inline-flex min-h-10 items-center rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-100 shadow-sm transition hover:border-gray-500 hover:bg-gray-700 focus:border-gray-500 focus:outline-none md:min-h-0 md:py-1.5"
