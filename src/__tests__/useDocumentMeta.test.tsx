import { render } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { vi } from "vitest"
import { SITE_NAME, SITE_ORIGIN, useDocumentMeta } from "../hooks/useDocumentMeta"
import { HeadMetaContext } from "../services/HeadMetaContext"
import type { HeadMeta } from "../services/HeadMetaContext"

const Page = ({ title, noindex = false }: { title: string | null; noindex?: boolean }) => {
	useDocumentMeta(title, "A description.", noindex)
	return <p>page</p>
}

function renderAt(path: string, element: React.ReactNode, reporter?: (meta: HeadMeta) => void) {
	const tree = <MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>
	return render(
		reporter ? <HeadMetaContext.Provider value={reporter}>{tree}</HeadMetaContext.Provider> : tree,
	)
}

afterEach(() => {
	document.head.querySelectorAll('meta[name="robots"], link[rel="canonical"]').forEach((tag) => tag.remove())
})

describe("useDocumentMeta in the browser", () => {
	it("writes the title, description and canonical onto the live head", () => {
		renderAt("/about", <Page title="About" />)

		expect(document.title).toBe(`About | ${SITE_NAME}`)
		expect(document.head.querySelector('meta[name="description"]')?.getAttribute("content")).toBe("A description.")
		expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(`${SITE_ORIGIN}/about`)
		expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
	})

	it("titles the homepage as the site itself", () => {
		renderAt("/", <Page title={null} />)
		expect(document.title).toBe(SITE_NAME)
	})

	it("adds a robots tag for noindex pages and removes it again for the next page", () => {
		const { unmount } = renderAt("/login", <Page title="Sign In" noindex />)
		expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, nofollow")
		unmount()

		renderAt("/about", <Page title="About" />)
		expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
	})
})

describe("useDocumentMeta at build time", () => {
	it("reports the same values through HeadMetaContext when one is provided", () => {
		const reporter = vi.fn()
		renderAt("/faq", <Page title="FAQ" />, reporter)

		expect(reporter).toHaveBeenCalledWith({
			title: `FAQ | ${SITE_NAME}`,
			description: "A description.",
			canonical: `${SITE_ORIGIN}/faq`,
			noindex: false,
		})
	})
})
