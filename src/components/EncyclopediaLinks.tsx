/**
 * The two small ways into an uma or a card's Encyclopedia page, for places
 * where the tile itself can't be the link. Where it can (a Timeline tile, a
 * Legend Races face, a ranking row that doesn't open), the tile is a plain
 * <Link> and neither of these is needed. The hrefs come from
 * useEncyclopediaHrefs (or the payload's game_id); a null href draws nothing.
 */

import { useContext } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, BookOpen } from "lucide-react"
import { InsidePopupContext } from "./pvp/hoverPopup"

/**
 * A round book button over a tile's corner, for tiles that are already a
 * button (pick, add, edit). It must be the tile's SIBLING inside a `relative`
 * box, never its child: a link inside a button is invalid HTML and the click
 * would do both. The caller places it with `className` (`absolute left-1 bottom-1`).
 */
export function EncyclopediaIconLink({ href, name, className = "" }: {
	href: string | null
	name: string
	className?: string
}) {
	if (!href) return null
	return (
		<Link
			to={href}
			aria-label={`Open ${name} in the Encyclopedia`}
			title="Open in the Encyclopedia"
			className={`flex h-6 w-6 items-center justify-center rounded-full border border-gray-600 bg-gray-900/90 text-gray-300 transition hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-brand ${className}`}
		>
			<BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
		</Link>
	)
}

/**
 * A name in a list or chip that opens the page when there is one, else the
 * same bold text it always was (Rankings' search results, Players' picks,
 * Your team).
 */
export function EncyclopediaName({ href, name, className }: { href: string | null; name: string; className: string }) {
	return href ? (
		<Link to={href} title="Open in the Encyclopedia" className={`${className} transition-colors hover:text-brand hover:underline`}>
			{name}
		</Link>
	) : (
		<b className={className}>{name}</b>
	)
}

/**
 * "Open its page", the line a skill card ends with (SkillDetail), for an uma
 * or card's hover card and a ranking row's breakdown. Inside a drawn popup it
 * takes clicks but leaves the Tab order: the popup is aria-hidden and the
 * screen reader's copy has the same link (hoverPopup.tsx).
 */
export function OpenPageLink({ href, className = "" }: { href: string | null; className?: string }) {
	const inPopup = useContext(InsidePopupContext)
	if (!href) return null
	return (
		<Link
			to={href}
			tabIndex={inPopup ? -1 : undefined}
			className={`inline-flex items-center gap-1 text-xs font-semibold text-brand transition hover:opacity-80 ${className}`}
		>
			Open its page
			<ArrowRight className="h-3 w-3" aria-hidden="true" />
		</Link>
	)
}
