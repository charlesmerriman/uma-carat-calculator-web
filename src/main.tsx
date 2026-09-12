import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
// Self-hosted (bundled) variable font — used only by the <Wordmark> brand text.
// Shipping the woff2 ourselves avoids a third-party request on every page load
// and keeps the app working under a strict CSP. Imported before index.css so the
// @font-face rules are registered before the @theme token that references them.
import '@fontsource-variable/outfit'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { shouldHydrate } from './hydrationTarget.ts'

const container = document.getElementById('root')!

const app = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)

// Public routes arrive as prerendered HTML (see src/prerenderRoutes.ts), and
// hydrating attaches React to that markup instead of replacing it. Anything
// else — the empty shell for an unknown path, or a prerendered document served
// for a path it was not built for — is rendered from scratch. See
// hydrationTarget.ts for why the marker, not the presence of children, decides.
if (shouldHydrate(container.dataset.prerendered, window.location.pathname)) {
  hydrateRoot(container, app)
} else {
  container.replaceChildren()
  createRoot(container).render(app)
}
