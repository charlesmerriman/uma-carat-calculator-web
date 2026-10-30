/**
 * The site search's way in: the navbar's button and the palette, which loads
 * on the first opening so nobody who never searches pays for it. Closed, this
 * renders no more than the button, so it's safe in a prerender. Ctrl+K is
 * hooks/useSiteSearch.ts.
 */

import { Suspense, lazy } from "react"
import { Search } from "lucide-react"
import { NAV_ICON_BUTTON } from "../navbar/navStyles"

const SearchPalette = lazy(() => import("./SearchPalette"))

export function SiteSearchButton({ onOpen }: { onOpen: () => void }) {
	return (
		<button type="button" aria-label="Search" title="Search (Ctrl+K)" onClick={onOpen} className={NAV_ICON_BUTTON}>
			<Search className="h-4 w-4" aria-hidden="true" />
		</button>
	)
}

export function SiteSearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	if (!open) return null
	return (
		<Suspense fallback={null}>
			<SearchPalette onClose={onClose} />
		</Suspense>
	)
}
