import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
// Self-hosted (bundled) variable font — used only by the <Wordmark> brand text.
// Shipping the woff2 ourselves avoids a third-party request on every page load
// and keeps the app working under a strict CSP. Imported before index.css so the
// @font-face rules are registered before the @theme token that references them.
import '@fontsource-variable/outfit'
// The palette themes' faces (index.css: Winning Live's headings; Tracen's
// headings and body). Only the @font-face rules ship to everyone; a browser
// fetches a font file when something on the page uses it, so the other twelve
// themes never download these.
import '@fontsource-variable/unbounded'
import '@fontsource-variable/nunito'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { shouldHydrate } from './hydrationTarget.ts'
import { SiteContentProvider } from './services/SiteContentProvider.tsx'
import { EMBED_ELEMENT_ID } from './services/siteContent.ts'
import type { SiteContent } from './types/siteContent.ts'
import type { QueryClient } from '@tanstack/react-query'
import { PrimedQueryClientContext, makeQueryClient } from './services/queryClient.ts'
import { PAGE_DATA_ELEMENT_ID, primeEncyclopediaPage } from './services/encyclopediaQueries.ts'
import { encyclopediaPageOf } from './utils/encyclopediaRoutes.ts'

const container = document.getElementById('root')!

/**
 * The site content the prerender embedded in this document, if any. A
 * prerendered page carries the rows it rendered with, so that the first client
 * render matches the markup byte for byte and hydration attaches cleanly. The
 * empty shell carries none; SiteContentProvider then fetches it. Client-only
 * code, so reading `document` here is fine.
 */
function readEmbeddedContent(): SiteContent | null {
  const element = document.getElementById(EMBED_ELEMENT_ID)
  if (!element?.textContent) return null
  try {
    return JSON.parse(element.textContent) as SiteContent
  } catch {
    return null
  }
}

/**
 * A query client holding the Encyclopedia page this document was built with,
 * or null. A built detail page (/app/umas/<id> and its twins) carries its
 * payload as #page-data; putting it in the cache before the first render is
 * what lets that render match the markup, instead of drawing a skeleton over
 * it. Marked old (`updatedAt: 0`), so the page refetches at once and anything
 * changed since the build lands. Only for a document built for THIS path: the
 * caller checks the marker first, or another page's data would fill this one.
 */
function readEmbeddedPage(): QueryClient | null {
  const page = encyclopediaPageOf(window.location.pathname)
  const element = document.getElementById(PAGE_DATA_ELEMENT_ID)
  if (!page || page.gameId === null || !element?.textContent) return null
  try {
    const client = makeQueryClient()
    primeEncyclopediaPage(client, { kind: page.kind, gameId: page.gameId }, JSON.parse(element.textContent), { updatedAt: 0 })
    return client
  } catch {
    return null
  }
}

// Public routes arrive as prerendered HTML (see src/prerenderRoutes.ts, and the
// Encyclopedia's detail pages, scripts/prerender.mjs), and hydrating attaches
// React to that markup instead of replacing it. Anything else — the empty shell
// for an unknown path, or a prerendered document served for a path it was not
// built for — is rendered from scratch. See hydrationTarget.ts for why the
// marker, not the presence of children, decides.
const hydrating = shouldHydrate(container.dataset.prerendered, window.location.pathname)

const app = (
  <StrictMode>
    <SiteContentProvider initial={readEmbeddedContent()}>
      <PrimedQueryClientContext.Provider value={hydrating ? readEmbeddedPage() : null}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PrimedQueryClientContext.Provider>
    </SiteContentProvider>
  </StrictMode>
)

if (hydrating) {
  hydrateRoot(container, app)
} else {
  container.replaceChildren()
  createRoot(container).render(app)
}
