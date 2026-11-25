import '@testing-library/jest-dom'
import { afterEach } from 'vitest'
import { forgetRememberedOpen } from '../hooks/useRememberedOpen'
import { forgetRememberedFilters } from '../hooks/useRememberedFilter'
import { forgetSkillRowsDrawn } from '../hooks/useSkillList'

afterEach(forgetRememberedOpen)
afterEach(forgetRememberedFilters)
afterEach(forgetSkillRowsDrawn)

// No test talks to a real server. A component that fetches on mount (every uma
// and card tile asks for the catalogue behind its Encyclopedia link, for
// everyone since 2026-11-18) would otherwise reach whatever API the developer
// has running on :8000, and the same test would draw different things on a
// laptop and on CI. So an unmocked fetch fails the same way everywhere: like a
// server that is down. A test that needs an answer mocks the call it makes
// (vi.mock on the fetch module, vi.spyOn or vi.stubGlobal on fetch), and those
// restore to this, never to the real thing, because it is assigned directly.
globalThis.fetch = () => Promise.reject(new TypeError('fetch is not mocked in this test'))

// jsdom doesn't implement matchMedia, which some components (e.g. IncomeForm,
// which reads the mobile breakpoint once to pick its default collapsed state)
// call on mount. Provide a minimal no-match stub so those components can render
// under test — matches: false means tests see the desktop default.
if (typeof window !== 'undefined' && !window.matchMedia) {
	window.matchMedia = (query: string): MediaQueryList =>
		({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}) as MediaQueryList
}

// jsdom has <dialog> but not showModal() or close() (GalleryModal uses both).
// Enough of them to render: `open` set and cleared, and the close event.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
	HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
		this.setAttribute('open', '')
	}
	HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
		this.setAttribute('open', '')
	}
	HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
		if (!this.hasAttribute('open')) return
		this.removeAttribute('open')
		this.dispatchEvent(new Event('close'))
	}
}

// jsdom lays nothing out, so it has no scrollIntoView (GalleryView brings the
// open post into view on a phone). A no-op is all a test needs.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
	Element.prototype.scrollIntoView = function scrollIntoView() {}
}
