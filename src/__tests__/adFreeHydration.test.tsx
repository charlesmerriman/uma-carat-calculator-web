/**
 * The ad-free class must survive hydration.
 *
 * Every public route is prerendered, so the browser HYDRATES AuthProvider.
 * During hydration useSyncExternalStore answers with the server snapshot (no
 * token), so the first commit sees a guest. If the ad-free effect acts on that
 * commit, it strips the class the head-start script in index.html just added,
 * and deletes the stored hint, until GET /account answers. Raptive's script
 * reads the class in that window, which is how a supporter "occasionally" got
 * an interstitial.
 */

import { act } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../services/AuthProvider'
import { accountFetch } from '../services/accountFetchCalls'
import { AD_FREE_BODY_CLASS, AD_FREE_STORAGE_KEY } from '../services/adFreeClass'

vi.mock('../services/accountFetchCalls', () => ({ accountFetch: vi.fn() }))
vi.mock('../services/userServices', () => ({ userLogout: vi.fn() }))

describe('the ad-free class through hydration', () => {
	beforeEach(() => {
		localStorage.clear()
		document.body.className = ''
		document.body.innerHTML = ''
	})

	it('is never dropped while the account lookup is pending', async () => {
		// What the head-start script did before the bundle ran.
		localStorage.setItem('authToken', 'a-real-token')
		localStorage.setItem(AD_FREE_STORAGE_KEY, 'true')
		document.body.classList.add(AD_FREE_BODY_CLASS)

		// Record every moment the class goes missing.
		const drops: string[] = []
		const observer = new MutationObserver(() => {
			if (!document.body.classList.contains(AD_FREE_BODY_CLASS)) drops.push('dropped')
		})
		observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })

		// The lookup never answers: we only care about the window before it does.
		vi.mocked(accountFetch).mockReturnValue(new Promise(() => {}))

		const tree = (
			<AuthProvider>
				<p>page</p>
			</AuthProvider>
		)
		const container = document.createElement('div')
		container.innerHTML = renderToString(tree)
		document.body.appendChild(container)

		await act(async () => {
			hydrateRoot(container, tree)
		})
		await new Promise((resolve) => setTimeout(resolve, 0))
		observer.disconnect()

		expect(drops).toEqual([])
		expect(document.body.classList.contains(AD_FREE_BODY_CLASS)).toBe(true)
		expect(localStorage.getItem(AD_FREE_STORAGE_KEY)).toBe('true')
	})
})
