/**
 * A fresh query cache per rendered test, with no retries (a mocked 500 should
 * fail at once, not after a back-off) and nothing kept between tests.
 */

import { useState, type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

export function TestQueryProvider({ children }: { children: ReactNode }) {
	const [client] = useState(
		() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } })
	)
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
