/**
 * The course map's icons: Daptrius's set (his "SVG Overlays" folder,
 * 2026-11-02; the owner chose them for the map on 2026-11-03,
 * notes/course-map-visual-plan.md). Each is one path on a 32 x 32 box centred
 * at 0, drawn in `currentColor`, so a callout or a strip segment colours it.
 *
 * A corner's arrow turns the way the course turns (`direction`); the final
 * straight gets the double arrow; hills the triangles; the flag marks the
 * last spurt.
 *
 * On the track, the corner and straight icons turn to the way the race runs
 * (`rotate`, Daptrius, 2026-11-04); hills and the flag stay upright, and so
 * does every icon on the strip and in the legend. The shapes' own headings:
 * `straight` and `finalStraight` point right (+x), and `cornerLeft` /
 * `cornerRight` start at the bottom heading up (-y) before they turn.
 */
const PATHS = {
	cornerLeft: "M 12 12 L 12 6 Q 12 -8 0 -8 L -3 -8 L -3 -14 L -14 -4 L -3 6 L -3 0 L 0 0 Q 4 0 4 6 L 4 12 Z",
	cornerRight: "M -12 12 L -12 6 Q -12 -8 0 -8 L 3 -8 L 3 -14 L 14 -4 L 3 6 L 3 0 L 0 0 Q -4 0 -4 6 L -4 12 Z",
	straight: "M -12 -4.5 L 1 -4.5 L 1 -11 L 14 0 L 1 11 L 1 4.5 L -12 4.5 Z",
	finalStraight: "M -14 -4.5 L -4 -4.5 L -4 -10 L 1.5 -4.5 L 2.821 -4.5 L 2.821 -10 L 13.932 0 L 2.821 10 L 2.821 4.5 L 1.5 4.5 L -4 10 L -4 4.5 L -14 4.5 Z",
	uphill: "M 0 -10 L 10 9 L -10 9 Z",
	downhill: "M -10 -9 L 10 -9 L 0 10 Z",
	flag: "M -8 13 V -12 M -8 -12 L 10 -7 L -8 -2 Z",
} as const

export type CourseIconName = keyof typeof PATHS

export default function CourseIcon({ name, className = "", rotate }: {
	name: CourseIconName
	className?: string
	/** Degrees clockwise on screen (CSS's sense). Left out, the icon stays upright. */
	rotate?: number
}) {
	// The flag is a stroke; everything else a filled shape.
	const stroked = name === "flag"
	return (
		<svg
			viewBox="-16 -16 32 32"
			className={className}
			aria-hidden="true"
			focusable="false"
			data-course-icon={name}
			style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}
		>
			<path
				d={PATHS[name]}
				fill={stroked ? "none" : "currentColor"}
				stroke="currentColor"
				strokeWidth={stroked ? 3 : 0}
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
		</svg>
	)
}
