import { useRememberedOpen } from "../../hooks/useRememberedOpen"
import { Link } from "react-router-dom"
import { ChevronDown, Sparkles } from "lucide-react"
import { timelineFocusHref } from "../../utils/timelineFocus"
import type { PlannerMarker } from "../../utils/plannerSections"

/**
 * A full-width section band between planner rows, marking a scenario launch or
 * an anniversary opening.
 *
 * Deliberately NOT `.banner-grid`: the band spans the row stack rather than
 * occupying columns, so it adds no track and leaves --container-banner-table
 * (and its hard ceiling) alone. Being a plain full-width block is also what
 * lets one component serve both display modes — the stack renders mobile cards
 * below the container width and table rows above it, and this reads correctly
 * either way.
 *
 * This is not AnniversaryEventStrip. That strip is left-aligned with squared
 * bottom corners because it welds onto the top of a timeline card; this is a
 * centred divider that belongs to neither neighbour.
 *
 * Each line links through to the same landmark's card on the Timeline. The band
 * names a scenario or a campaign and says nothing else about it — what launched
 * with it, what it looks like, how long it runs — and the Timeline is where all
 * of that already lives. See `utils/timelineFocus.ts` for why the link names a
 * target instead of pointing at a `#hash`.
 */

/**
 * Per-kind chrome. Scenario reads louder — see the note in the component.
 * `icon` is optional: a scenario band carries no icon, so weight and colour
 * alone distinguish it from an anniversary.
 */
const MARKER_STYLES: Record<
	PlannerMarker["kind"],
	{ text: string; icon?: typeof Sparkles; iconSize?: string; textColor: string; iconShell?: string }
> = {
	scenario: {
		text: "text-sm font-semibold tracking-wide @banner-table:text-base",
		textColor: "text-brand",
	},
	anniversary: {
		text: "text-sm font-medium tracking-wide @banner-table:text-base",
		icon: Sparkles,
		iconSize: "h-3.5 w-3.5 @banner-table:h-4 @banner-table:w-4",
		textColor: "text-gray-200",
		iconShell: "text-brand/85",
	},
}

/** Alternation follows visual order, never marker kind. */
const STRIP_TONES = [
	"bg-gray-900/45",
	"bg-brand/[0.07]",
]

/**
 * The UTC calendar day an ISO instant falls on, for grouping lines by date.
 *
 * UTC because the whole projection is (see utils/utcDates.ts) — reading these
 * as local days would move the grouping around by the viewer's timezone, so two
 * users could see the same band striped differently. Parsed rather than sliced
 * off the string: an instant carrying an offset would otherwise report its local
 * date as if it were the UTC one. An unparseable value falls back to its own raw
 * text, so two identical bad values still group together instead of each
 * becoming its own "date".
 */
function utcDayKey(iso: string): string {
	const ms = Date.parse(iso)
	return Number.isNaN(ms) ? iso : new Date(ms).toISOString().slice(0, 10)
}

/**
 * The tone index for each line: advance only when the DATE changes.
 *
 * Markers collapse into one band by insertion POINT, not by date, so a band can
 * hold two different moments — and it can equally hold two lines that are the
 * same moment (a scenario launching the day an anniversary lands, the common
 * case since scenarios usually debut alongside one). Alternating per line split
 * that shared moment across two fills, which reads as two events on two dates.
 * Alternating per distinct day makes one fill mean "one date" and a change of
 * fill mean "a different one".
 */
function toneIndices(markers: PlannerMarker[]): number[] {
	let tone = 0
	let previousDay: string | null = null
	return markers.map((marker) => {
		const day = utcDayKey(marker.startDate)
		if (previousDay !== null && day !== previousDay) tone += 1
		previousDay = day
		return tone
	})
}

/**
 * Above this many lines a band folds to its first line plus a "Show N more"
 * toggle (design polish item 18). A plan with one row this month and one a year
 * out puts every landmark in between into ONE band, and at a line each that
 * was ten gold bars, a screen and a half of them on a phone, between two rows.
 * Three or fewer still show in full: folding one or two lines away saves less
 * than the toggle costs.
 */
const FOLD_ABOVE = 3

/** "Show 9 more scenarios" when the hidden lines are all one kind, else "Show 9 more". */
function moreLabel(hidden: PlannerMarker[]): string {
	const kinds = new Set(hidden.map((marker) => marker.kind))
	const noun = kinds.size === 1 ? (kinds.has("scenario") ? " scenarios" : " campaigns") : ""
	return `Show ${hidden.length} more${noun}`
}

export const PlannerSectionBand = ({ markers }: { markers: PlannerMarker[] }) => {
	// By its first line, which stays the same if the plan around it changes.
	const first = markers.at(0)
	const [expanded, setExpanded] = useRememberedOpen(first ? `band-${first.key}` : null)
	// Markers arrive sorted by date (see compareMarkers), which is what lets the
	// tone walk be a single pass over neighbours rather than a grouping pass.
	// Computed over ALL markers, so a line keeps its fill whether the band is
	// folded or not.
	const tones = toneIndices(markers)
	const folds = markers.length > FOLD_ABOVE
	const shown = folds && !expanded ? markers.slice(0, 1) : markers

	/*
	 * role="presentation" so the band doesn't read as a data row to a screen
	 * reader: it's a landmark between rows, and its text is already announced.
	 * The outer surface uses the semantic gray ramp and the scenario treatment
	 * uses --color-brand, so every theme supplies its own contrast and accent.
	 * Strip fills alternate per DATE rather than per line, while weight, colour
	 * and the anniversary's sparkle still communicate what kind of landmark it
	 * is. The surrounding rules make the otherwise empty row width read as a
	 * deliberate ledger divider rather than a large button.
	 */
	return (
		<div
			role="presentation"
			className="flex w-full flex-col border-y border-brand/20 bg-gray-900/20"
		>
			{shown.map((marker, index) => {
				const style = MARKER_STYLES[marker.kind]
				const Icon = style.icon
				const tone = STRIP_TONES[tones[index] % STRIP_TONES.length]
				return (
					/*
					 * The whole strip is the link rather than just the label: the row is
					 * otherwise empty, so a text-width target in the middle of a
					 * full-width band would be needlessly hard to hit. `group` lets the
					 * name underline on hover — the affordance is carried by the text
					 * and a faint wash, with no arrow glyph, because a scenario line is
					 * distinguished from an anniversary one by having NO icon.
					 *
					 * `hover:` fills only. The alternating tone is the sole bare `bg-`
					 * class on this element, and adding a second one would change which
					 * fill a reader (and the band's test) sees as the strip's colour.
					 */
					<Link
						key={marker.key}
						to={timelineFocusHref({ kind: marker.kind, id: marker.sourceId })}
						title={`View ${marker.name} on the timeline`}
						className={`group flex min-h-9 w-full items-center justify-center px-4 py-1.5 transition-colors hover:bg-brand/10 ${index > 0 ? "border-t border-gray-700/80" : ""} ${tone}`}
					>
						<div className={`flex shrink-0 items-center gap-2 text-center ${style.text} ${style.textColor}`}>
							{Icon && <Icon className={`${style.iconSize} ${style.iconShell}`} aria-hidden="true" />}
							<span className="underline-offset-4 group-hover:underline">{marker.name}</span>
						</div>
					</Link>
				)
			})}
			{folds && (
				/* Quieter than a landmark line (small gray text, no fill of its own)
				   so it reads as the band's control, not as one more landmark. */
				<button
					type="button"
					onClick={() => setExpanded((open) => !open)}
					aria-expanded={expanded}
					className="flex min-h-8 w-full items-center justify-center gap-1.5 border-t border-gray-700/80 px-4 py-1 text-xs font-medium text-gray-400 transition-colors hover:bg-brand/10 hover:text-gray-100"
				>
					{expanded ? "Show fewer" : moreLabel(markers.slice(1))}
					<ChevronDown
						className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
						aria-hidden="true"
					/>
				</button>
			)}
		</div>
	)
}
