/**
 * How pages read the admin-editable content. Context and hook only; the
 * component that owns the fetch is SiteContentProvider (the same split as
 * ThemeContext / ThemeProvider, so fast refresh keeps working).
 */
import { createContext, useContext } from "react"
import type { SiteContentValue } from "./siteContent"

export const SiteContentContext = createContext<SiteContentValue | undefined>(undefined)

export function useSiteContent(): SiteContentValue {
	const value = useContext(SiteContentContext)
	if (value === undefined) {
		throw new Error("useSiteContent must be used within a SiteContentProvider")
	}
	return value
}
