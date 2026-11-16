/**
 * A detail page's real title once its data lands. AppRouteMeta gives every
 * /app/umas/<id> a generic title from the first frame (it sits outside the
 * loading gate); this replaces it with the outfit's or card's name. In an
 * effect, so nothing touches `document` at render time.
 */

import { useEffect } from "react"
import { SITE_NAME } from "../../hooks/useDocumentMeta"

export function usePageTitle(name: string | null | undefined): void {
	useEffect(() => {
		if (name) document.title = `${name} | ${SITE_NAME}`
	}, [name])
}
