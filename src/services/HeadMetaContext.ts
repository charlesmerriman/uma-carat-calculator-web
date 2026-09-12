/**
 * How a build-time render learns each page's <head> tags.
 *
 * `useDocumentMeta` sets the title, description and canonical on the live DOM from an
 * effect, and effects never run inside `renderToString`. So during a server render the
 * hook ALSO reports the same values through this context, and src/entry-server.tsx
 * provides a reporter that captures them. On the client nothing provides the context,
 * the reporter is null, and the hook does exactly what it always did.
 *
 * The value is a function rather than a mutable object on purpose: the hook calls it
 * during render, and calling a function is fine where mutating something obtained from
 * a hook is not (react-hooks/immutability).
 *
 * Context and types only, no component — the same split as ThemeContext/ThemeProvider,
 * so fast refresh keeps working for the files that import it.
 */
import { createContext } from "react"

export interface HeadMeta {
	/** The full <title>, site name included. */
	title: string
	description: string
	/** Absolute canonical URL for the route. */
	canonical: string
	/** True for pages that carry a noindex robots tag. */
	noindex: boolean
}

export type HeadMetaReporter = (meta: HeadMeta) => void

export const HeadMetaContext = createContext<HeadMetaReporter | null>(null)
