/**
 * The deep-link contract between the calculator sheet and the Timeline.
 *
 * The calculator is a ledger: it tells you what a banner costs, not what is on
 * it or what else is happening that week. The Timeline answers that, so the
 * sheet links across — a scenario band opens that scenario's card, a row's card
 * art opens the banner window it belongs to.
 *
 * A plain `#hash` anchor cannot do this. The Timeline windows its list (ten
 * cards a page, or a growing prefix under infinite scroll) and hides past
 * events by default, so the target element usually is not in the DOM for the
 * browser to scroll to. The link therefore names the target and the Timeline
 * resolves it — widening its own window and flipping to the past view as
 * needed. See `Timeline.tsx`.
 *
 * Lives in `utils/` rather than beside the Timeline because both ends of the
 * link have to agree on the format, and the calculator must not have to reach
 * into the timeline's component folder to build a URL.
 */

/**
 * What a link points at.
 *
 * `id` is the SOURCE ROW's primary key — a `BannerTimeline`, a `Scenario` or an
 * `AnniversaryEvent` — never a rendered row's index or React key, both of which
 * shift as the list is filtered.
 *
 * `kind` deliberately mirrors `TimelineMarker["kind"]` for the two marker
 * cases, so neither surface needs a translation table: a marker of kind
 * "scenario" focuses a focus of kind "scenario".
 *
 * NOTE a banner's id is its `BannerTimeline`, not the `BannerUma` /
 * `BannerSupport` / `BannerStepUp` a planner row actually points at. Concurrent
 * banners are merged into one timeline card, and all three planner row kinds
 * carry the same `banner_timeline` FK, so the timeline is the only id that
 * identifies a card from any of them.
 */
export interface TimelineFocus {
	kind: "banner" | "scenario" | "anniversary" | "cm" | "loh"
	id: number
}

/*
 * "cm" / "loh" name a Champions Meeting or League of Heroes event by its id:
 * the PvP page's "View on Timeline" link. The same `cm-12` form as the PvP
 * page's own ?event= (utils/pvpEvent.ts), so a PvpEventRef IS a TimelineFocus
 * and neither side needs a translation.
 */

/** The query parameter carrying the target. */
export const TIMELINE_FOCUS_PARAM = "focus"

/** The Timeline route, so link builders don't repeat the path. */
const TIMELINE_PATH = "/app/timeline"

/**
 * `kind-id`, e.g. `banner-812`.
 *
 * Kind-prefixed rather than a bare id because ids are unique only within a
 * model: `12` could be a banner window, a scenario or a campaign, and guessing
 * would send a reader to the wrong card rather than to none.
 */
export function formatTimelineFocus(focus: TimelineFocus): string {
	return `${focus.kind}-${focus.id}`
}

/**
 * Parse a `focus` parameter, or null for anything unrecognised.
 *
 * Null rather than throwing: this value comes off the URL, which a user can
 * type, edit or truncate. A malformed focus must degrade to "no focus" — the
 * ordinary Timeline — never to a broken route.
 */
export function parseTimelineFocus(raw: string | null | undefined): TimelineFocus | null {
	if (!raw) return null
	const separator = raw.lastIndexOf("-")
	if (separator <= 0) return null

	const kind = raw.slice(0, separator)
	if (kind !== "banner" && kind !== "scenario" && kind !== "anniversary" && kind !== "cm" && kind !== "loh") {
		return null
	}

	// Number() rather than parseInt: parseInt("12abc") is 12, which would send a
	// reader to a card the URL never named. The positivity check is doing real
	// work rather than tidying up — Number("") is 0, and 0 is an integer, so
	// `banner-` would otherwise parse as a focus on primary key 0. Django keys
	// start at 1, so nothing legitimate is turned away.
	const id = Number(raw.slice(separator + 1))
	if (!Number.isInteger(id) || id <= 0) return null

	return { kind, id }
}

/** The `to` for a react-router `<Link>`. */
export function timelineFocusHref(focus: TimelineFocus): string {
	return `${TIMELINE_PATH}?${TIMELINE_FOCUS_PARAM}=${formatTimelineFocus(focus)}`
}
