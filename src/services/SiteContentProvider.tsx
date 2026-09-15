import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { SiteContentContext } from "./SiteContentContext"
import { buildSiteContentValue, sameContent } from "./siteContent"
import { siteContentFetch } from "./siteContentFetchCalls"
import type { SiteContent } from "../types/siteContent"

/**
 * Supplies the pages and the FAQ to the client tree.
 *
 * `initial` is what the document already carried: the JSON a prerendered page
 * embeds (read by main.tsx), or null for the empty shell and the dev server.
 * The first render uses it untouched, which is what keeps hydration
 * byte-identical to the build-time markup.
 *
 * Then, from an effect, one fetch of /site-content. It does two jobs: it fills
 * in whatever nothing embedded (a page reached by client-side navigation from
 * a document that only carried another page's row), and it revalidates what
 * was embedded, so an admin edit shows up on the next page load rather than
 * the next site rebuild. Content that comes back unchanged is dropped before
 * it reaches state, so a page whose words did not change does not re-render.
 * A failed fetch is not an error state: the baked words are still on the page,
 * and a page that had nothing keeps its loading state, which is the honest
 * thing to show.
 *
 * Not strict: in the browser a missing row is the loading state, not a crash.
 */
export function SiteContentProvider({ initial, children }: { initial: SiteContent | null; children: ReactNode }) {
	const [content, setContent] = useState<SiteContent | null>(initial)

	useEffect(() => {
		const controller = new AbortController()
		async function load() {
			try {
				const res = await siteContentFetch(controller.signal)
				if (!res.ok) return
				const fresh = (await res.json()) as SiteContent
				setContent((current) => (sameContent(current, fresh) ? current : fresh))
			} catch {
				// AbortError under StrictMode's double mount, or the API being
				// unreachable. Either way the page keeps what it has.
			}
		}
		load()
		return () => controller.abort()
	}, [])

	const value = useMemo(() => buildSiteContentValue(content), [content])
	return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>
}
