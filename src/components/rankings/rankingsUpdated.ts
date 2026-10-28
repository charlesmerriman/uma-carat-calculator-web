/**
 * "Updated N minutes ago" in the Rankings page's header, read from the open
 * tab's payload (notes/rankings-redesign-plan.md, step 1). The page provides
 * a setter; a tab reports its payload's `generated_at` while it is mounted
 * and clears it when it goes, so a tab switch never shows the last tab's
 * time. In the pinned window there is no provider and reporting does nothing.
 */

import { createContext, useContext, useEffect } from "react"

export const RankingsUpdatedContext = createContext<((generatedAt: string | null) => void) | null>(null)

export function useReportUpdated(generatedAt: string | null): void {
	const report = useContext(RankingsUpdatedContext)
	useEffect(() => {
		if (!report) return
		report(generatedAt)
		return () => report(null)
	}, [report, generatedAt])
}
