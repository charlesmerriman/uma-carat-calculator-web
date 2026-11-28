import { createContext, useContext } from "react"

/**
 * Whether the markdown below was written by a player rather than the site's
 * own editors (a community guide, notes/community-guides-plan.md). Then
 * MarkdownContent draws no pictures and no links: a picture from any host in a
 * stranger's text is a tracking pixel, and a link is refused when they post
 * anyway, so whatever slips through reads as plain text.
 *
 * A context rather than a prop because a guide's text is drawn from several
 * components deep (the guide band, each style's advice, notes under tiles);
 * the community guide reader sets it once around the whole guide.
 */
export const UntrustedTextContext = createContext(false)

export function useUntrustedText(): boolean {
	return useContext(UntrustedTextContext)
}
