/**
 * The words and metres a stretch of the course strip shows (CourseStrip's
 * Segment). Pure, so its fitting rule is tested on its own
 * (__tests__/CourseStrip.test.tsx).
 */
import { formatMetres, metreToFraction } from "./courseGeometry"

/** "290–540m": a stretch's metres, as Daptrius's render writes them. */
function rangeText(start: number, end: number): string {
	return `${Math.round(start).toLocaleString("en-US")}–${formatMetres(end)}`
}

/**
 * What a stretch of a band says: its words (the label, the short label when
 * the stretch is narrow, else none) and its metres (start to end, else the
 * end, else none).
 *
 * Across the page the words are drawn CENTRED and the metres sit in the
 * bottom-right corner, so the metres only clear the words when the stretch's
 * right half holds half the words plus the metres. The rule used to add the
 * two widths as if they sat side by side, and against an assumed 1,000px
 * strip; on a 600px strip (the guide at 1,440 with Skills open) "Corner 3"
 * was drawn over "650–875m" (review item 7, 2026-11-24). `stripPx` is now the
 * strip's measured width where there is one.
 */
export function segmentText({ start, end, distance, vertical, label, shortLabel, icon = false, ranged = false, stripPx }: {
	start: number
	end: number
	distance: number
	vertical: boolean
	label: string
	shortLabel?: string
	icon?: boolean
	ranged?: boolean
	stripPx: number
}): { words?: string; metres?: string } {
	const share = metreToFraction(end, distance) - metreToFraction(start, distance)
	if (vertical) {
		return {
			words: share >= 0.035 ? label : undefined,
			metres: share >= 0.08 && end < distance ? formatMetres(end) : undefined,
		}
	}
	const words = share >= 0.06 ? label : share >= 0.025 ? shortLabel : undefined
	const px = share * stripPx
	// About 7px a bold 11px letter, 5.2px a 9px digit, plus the paddings.
	const wordsPx = words ? words.length * 7 + 8 + (icon ? 14 : 0) : 0
	const metresPx = (text: string) => text.length * 5.2 + 6
	// Half the stretch, less half the words, is the room right of the words.
	const fits = (text: string) => (words ? wordsPx / 2 + metresPx(text) + 4 <= px / 2 : metresPx(text) + 4 <= px)
	const long = rangeText(start, end)
	const short = formatMetres(end)
	return { words, metres: ranged && fits(long) ? long : end < distance && fits(short) ? short : undefined }
}
