/**
 * The bands behind a skill number or time that scales ("Velocity +0.28 to
 * +0.42, by fan count"), opened from a small button beside it.
 *
 * WHY A POPOVER: the first build (web #406) put a table under every scaled
 * line, and a skill with two scaled effects grew its "How it works" card to
 * twice its height. The owner (2026-11-20) asked for the details behind a
 * dropdown that does NOT lengthen the page when opened, so the table floats
 * over the page in a portal, the way the site's hover cards do, and closes on
 * a second click, a click elsewhere or Escape.
 */

import { useState, type CSSProperties } from "react"
import {
	flip,
	FloatingFocusManager,
	FloatingPortal,
	offset,
	shift,
	size,
	useClick,
	useDismiss,
	useFloating,
	useInteractions,
	useRole,
	useTransitionStyles,
} from "@floating-ui/react"
import { useReducedMotion } from "framer-motion"
import { ChevronDown } from "lucide-react"
import type { SkillScaling } from "../../types/pvpGuide"
import { autoUpdateClearOfAds, popupEdges } from "../pvp/hoverPopup"

interface Props {
	scaling: SkillScaling
	/** The line it explains, repeated at the top of the popover. */
	title: string
	/** The value column's heading: "Value" for an effect, "Lasts" for a time. */
	column: string
}

export function ScalingPopover({ scaling, title, column }: Props) {
	const [open, setOpen] = useState(false)
	// The page's accent (--c1, the skill's colour) lives on the page's own
	// elements, and the popover is portalled out to <body>, so it would lose
	// it. It is read off the button when the popover opens: an event, so
	// never at render time (the page is prerendered).
	const [accent, setAccent] = useState<CSSProperties>({})
	const reducedMotion = useReducedMotion()
	// The two elements as state, handed to Floating UI, so render never
	// reads a ref (react-hooks/refs flags `refs.setFloating` in JSX).
	const [button, setButton] = useState<HTMLButtonElement | null>(null)
	const [panel, setPanel] = useState<HTMLDivElement | null>(null)
	const { floatingStyles, context } = useFloating({
		elements: { reference: button, floating: panel },
		open,
		onOpenChange(next) {
			if (next && button) {
				const style = getComputedStyle(button)
				setAccent({
					"--c1": style.getPropertyValue("--c1"),
					"--c1-ink": style.getPropertyValue("--c1-ink"),
				} as CSSProperties)
			}
			setOpen(next)
		},
		placement: "bottom-start",
		whileElementsMounted: autoUpdateClearOfAds,
		middleware: [
			offset(6),
			flip(() => ({ padding: popupEdges() })),
			shift(() => ({ padding: popupEdges() })),
			// Never taller than the room left: a long table (Love from fans
			// has seven bands) scrolls inside itself.
			size({
				padding: 8,
				apply({ availableHeight, elements }) {
					elements.floating.style.maxHeight = `${Math.max(160, availableHeight)}px`
				},
			}),
		],
	})
	const { getReferenceProps, getFloatingProps } = useInteractions([
		useClick(context),
		useDismiss(context),
		useRole(context, { role: "dialog" }),
	])
	const { isMounted, styles } = useTransitionStyles(context, {
		duration: reducedMotion ? 0 : 140,
		initial: { opacity: 0, transform: "translateY(-4px)" },
	})

	return (
		<>
			<button
				ref={setButton}
				type="button"
				className="enc-bands-toggle"
				aria-label={`Every value (${scaling.heading})`}
				{...getReferenceProps()}
			>
				Values
				<ChevronDown aria-hidden="true" className="enc-bands-toggle__chevron" />
			</button>
			{isMounted && (
				<FloatingPortal>
					<FloatingFocusManager context={context} modal={false} initialFocus={-1}>
						<div
							ref={setPanel}
							className="enc-bands"
							style={{ ...floatingStyles, ...accent }}
							aria-label={title}
							{...getFloatingProps()}
						>
							<div style={styles}>
								<p className="enc-bands__title">{title}</p>
								<table className="enc-scale">
									<thead>
										<tr><th scope="col">{scaling.heading}</th><th scope="col">{column}</th></tr>
									</thead>
									<tbody>
										{scaling.rows.map((row) => (
											<tr key={row.when}><td>{row.when}</td><td>{row.value}</td></tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</FloatingFocusManager>
				</FloatingPortal>
			)}
		</>
	)
}
