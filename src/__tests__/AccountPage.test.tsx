/**
 * AccountPage — the four states it can be in, and the two things it can DO.
 *
 * The disconnect guard is the case worth pinning: the server refuses to remove
 * the last sign-in method, and the page should make that refusal unsurprising
 * rather than let someone click into a 400.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountPage } from '../components/account/AccountPage'
import { startAccountLink, unlinkProvider } from '../services/accountLinking'
import { accountDelete, accountPatch } from '../services/accountFetchCalls'
import { umasFetch } from '../services/umasFetchCalls'
import { galleryMyPosts, galleryPostTakeDown } from '../services/galleryFetchCalls'
import { TestQueryProvider } from '../test/TestQueryProvider'
import { getAuthToken, setAuthToken } from '../services/authToken'
import type { Account, AccountStatus } from '../types/account'

vi.mock('../services/accountLinking', () => ({
	startAccountLink: vi.fn(),
	unlinkProvider: vi.fn(),
}))
vi.mock('../services/accountFetchCalls', () => ({ accountDelete: vi.fn(), accountPatch: vi.fn() }))
vi.mock('../services/umasFetchCalls', () => ({ umasFetch: vi.fn() }))
vi.mock('../services/galleryFetchCalls', () => ({
	galleryMyPosts: vi.fn(),
	galleryPostTakeDown: vi.fn(),
	galleryShareUrl: (id: string) => `https://site.example/post/${id}`,
}))
// Navbar and Footer pull in contexts this page does not need under test.
vi.mock('../components/navbar/Navbar', () => ({ Navbar: () => <nav /> }))
vi.mock('../components/footer/Footer', () => ({ Footer: () => null }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const auth = vi.hoisted(() => ({
	isLoggedIn: false,
	status: 'anonymous' as AccountStatus,
	account: null as Account | null,
	isSupporter: false,
	refresh: vi.fn(),
	signOut: vi.fn(),
}))
// The real module, so AuthContext itself exists (useOshiIds reads it for the
// favourite frame); only useAccount is replaced.
vi.mock('../services/AuthContext', async () => ({
	...(await vi.importActual<typeof import('../services/AuthContext')>('../services/AuthContext')),
	useAccount: () => auth,
}))

const mockedStart = vi.mocked(startAccountLink)
const mockedUnlink = vi.mocked(unlinkProvider)
const mockedDelete = vi.mocked(accountDelete)
const mockedPatch = vi.mocked(accountPatch)
const mockedUmas = vi.mocked(umasFetch)
const mockedMyPosts = vi.mocked(galleryMyPosts)
const mockedTakeDown = vi.mocked(galleryPostTakeDown)
const mockedToast = vi.mocked(toast)

function account(overrides: Partial<Account> = {}): Account {
	return {
		username: 'user_a3f9c1',
		display_name: '',
		show_supporter_badge: true,
		avatar_url: null,
		oshis: [],
		// The free slot: every account may hold one favourite.
		oshi_slots: 1,
		oshi_variants: false,
		early_access: false,
		linked_providers: [{ provider: 'google', linked_at: '2026-07-02' }],
		supporter: { is_supporter: false },
		...overrides,
	}
}

/**
 * A umasFetch that behaves like the real fetch about its AbortSignal: it settles
 * with the response on the next tick unless the signal is aborted first, in which
 * case it rejects with an AbortError. A mock that ignored the signal hid a bug where
 * the picker aborted its own request and showed a spinner forever.
 */
function abortableUmas(res: Response) {
	return (signal?: AbortSignal): Promise<Response> =>
		new Promise((resolve, reject) => {
			const abort = () => reject(new DOMException('aborted', 'AbortError'))
			if (signal?.aborted) return abort()
			signal?.addEventListener('abort', abort)
			setTimeout(() => resolve(res), 0)
		})
}

/** A Response-shaped stub: the fetch modules hand back the raw Response. */
function response(status: number, body: unknown = {}): Response {
	return { ok: status < 400, status, json: async () => body } as unknown as Response
}

const UMAS = [
	{ id: 7, name: 'Special Week', image: 'https://cdn.example/umas/special-week.png', is_variant: false },
	{ id: 9, name: 'Gold Ship', image: 'https://cdn.example/umas/gold-ship.png', is_variant: false },
	{ id: 10, name: 'Gold Ship (Summer)', image: 'https://cdn.example/umas/gold-ship-summer.png', is_variant: true },
]

function signedIn(acct: Account) {
	auth.isLoggedIn = true
	auth.status = 'ready'
	auth.account = acct
}

function renderPage() {
	return render(
		<MemoryRouter initialEntries={['/account']}>
			<TestQueryProvider>
				<AccountPage />
			</TestQueryProvider>
		</MemoryRouter>,
	)
}

beforeEach(() => {
	mockedMyPosts.mockReset().mockResolvedValue(response(200, []))
	mockedTakeDown.mockReset()
	auth.isLoggedIn = false
	auth.status = 'anonymous'
	auth.account = null
	auth.refresh.mockReset()
	auth.signOut.mockReset().mockResolvedValue(undefined)
	mockedStart.mockReset()
	mockedUnlink.mockReset()
	mockedDelete.mockReset()
	mockedPatch.mockReset()
	mockedUmas.mockReset()
	mockedToast.success.mockReset()
	mockedToast.error.mockReset()
	localStorage.clear()
})

describe('AccountPage states', () => {
	it('invites a guest to sign in instead of redirecting', () => {
		renderPage()

		expect(screen.getByText(/not signed in/i)).toBeInTheDocument()
		expect(screen.getByRole('link', { name: /^sign in$/i })).toHaveAttribute('href', '/login')
		expect(screen.queryByText(/sign-in methods/i)).toBeNull()
	})

	it('shows a loading state while the account is in flight', () => {
		auth.isLoggedIn = true
		auth.status = 'loading'

		renderPage()

		expect(screen.getByRole('status')).toBeInTheDocument()
	})

	it('offers a retry when the account failed to load', () => {
		auth.isLoggedIn = true
		auth.status = 'error'

		renderPage()

		fireEvent.click(screen.getByRole('button', { name: /retry/i }))
		expect(auth.refresh).toHaveBeenCalled()
	})
})

describe('AccountPage sign-in methods', () => {
	it('lists every provider, connected or not, with the link date formatted', () => {
		signedIn(account())

		renderPage()

		expect(screen.getByText('Connected 2026/7/2')).toBeInTheDocument()
		expect(screen.getAllByText('Not connected')).toHaveLength(2)
		expect(screen.getAllByRole('button', { name: /^connect$/i })).toHaveLength(2)
	})

	it('disables Disconnect on the only sign-in method', () => {
		signedIn(account())

		renderPage()

		const disconnect = screen.getByRole('button', { name: /disconnect/i })
		expect(disconnect).toBeDisabled()
		expect(disconnect).toHaveAttribute('title', expect.stringMatching(/only way to sign in/i))
	})

	it('starts a link for the provider whose Connect was clicked', () => {
		signedIn(account())
		mockedStart.mockReturnValue(new Promise(() => {}))

		renderPage()
		const [discordConnect] = screen.getAllByRole('button', { name: /^connect$/i })
		fireEvent.click(discordConnect)

		expect(mockedStart).toHaveBeenCalledWith('discord')
	})

	it('unlinks and re-reads the account when a second method is disconnected', async () => {
		signedIn(
			account({
				linked_providers: [
					{ provider: 'google', linked_at: '2026-07-02' },
					{ provider: 'patreon', linked_at: '2026-09-08' },
				],
			}),
		)
		mockedUnlink.mockResolvedValue(undefined)

		renderPage()
		const [, patreonDisconnect] = screen.getAllByRole('button', { name: /^disconnect$/i })
		fireEvent.click(patreonDisconnect)

		await waitFor(() => expect(mockedUnlink).toHaveBeenCalledWith('patreon'))
		await waitFor(() => expect(auth.refresh).toHaveBeenCalled())
	})
})

describe('AccountPage supporter block', () => {
	it('shows the tier and named benefits for a supporter', () => {
		signedIn(
			account({
				linked_providers: [
					{ provider: 'google', linked_at: '2026-07-02' },
					{ provider: 'patreon', linked_at: '2026-09-08' },
				],
				supporter: { is_supporter: true, tier: 'Junior Class', benefits: ['ad_free', 'unknown_key'] },
			}),
		)

		renderPage()

		expect(screen.getAllByText('Junior Class').length).toBeGreaterThan(0)
		expect(screen.getByText('Ad-free browsing')).toBeInTheDocument()
		// A key with no label is not shown raw.
		expect(screen.queryByText(/unknown_key/)).toBeNull()
	})

	it('explains the daily sync when Patreon is connected but not pledging', () => {
		signedIn(
			account({
				linked_providers: [
					{ provider: 'google', linked_at: '2026-07-02' },
					{ provider: 'patreon', linked_at: '2026-09-08' },
				],
			}),
		)

		renderPage()

		expect(screen.getByText(/don't see an active pledge/i)).toBeInTheDocument()
	})

	it('offers to connect Patreon when it is not linked', () => {
		signedIn(account())
		mockedStart.mockReturnValue(new Promise(() => {}))

		renderPage()
		fireEvent.click(screen.getByRole('button', { name: /connect patreon/i }))

		expect(mockedStart).toHaveBeenCalledWith('patreon')
	})
})

describe('AccountPage display name', () => {
	it('shows the chosen name in the header with the handle beneath it', () => {
		signedIn(account({ display_name: 'Rhondal' }))

		renderPage()

		expect(screen.getByText('Rhondal')).toBeInTheDocument()
		// Once in the header, once in the display-name blurb.
		expect(screen.getAllByText('user_a3f9c1').length).toBeGreaterThanOrEqual(2)
	})

	it('saves a trimmed name and re-reads the account', async () => {
		signedIn(account())
		mockedPatch.mockResolvedValue(response(200))

		renderPage()
		const save = screen.getByRole('button', { name: /^save$/i })
		expect(save).toBeDisabled()
		fireEvent.change(screen.getByRole('textbox', { name: /display name/i }), {
			target: { value: '  Rhondal  ' },
		})
		expect(save).toBeEnabled()
		fireEvent.click(save)

		await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith({ display_name: 'Rhondal' }))
		await waitFor(() => expect(auth.refresh).toHaveBeenCalled())
		expect(mockedToast.success).toHaveBeenCalledWith('Display name saved.')
	})

	it('clears the name by saving it blank', async () => {
		signedIn(account({ display_name: 'Rhondal' }))
		mockedPatch.mockResolvedValue(response(200))

		renderPage()
		fireEvent.change(screen.getByRole('textbox', { name: /display name/i }), { target: { value: '' } })
		fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

		await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith({ display_name: '' }))
		expect(mockedToast.success).toHaveBeenCalledWith('Display name cleared.')
	})

	it("shows the server's reason when the name is refused, and does not re-read", async () => {
		signedIn(account())
		const reason = "That name has characters that can't be shown."
		mockedPatch.mockResolvedValue(response(400, { display_name: [reason] }))

		renderPage()
		fireEvent.change(screen.getByRole('textbox', { name: /display name/i }), { target: { value: 'bad' } })
		fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

		await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith(reason))
		expect(auth.refresh).not.toHaveBeenCalled()
	})
})

describe('AccountPage oshis', () => {
	const SPECIAL_WEEK = { position: 0, id: 7, name: 'Special Week', image: UMAS[0].image }
	const GOLD_SHIP = { position: 1, id: 9, name: 'Gold Ship', image: UMAS[1].image }

	it('offers a free account one tile and the Patreon link for more', () => {
		signedIn(account())

		renderPage()

		expect(screen.getByText(/free accounts get one/i)).toBeInTheDocument()
		expect(screen.getAllByRole('button', { name: /^pick/i })).toHaveLength(1)
		expect(screen.getByRole('button', { name: /pick your picture/i })).toBeInTheDocument()
		expect(screen.getByRole('link', { name: /more slots on patreon/i })).toHaveAttribute(
			'href',
			expect.stringContaining('patreon.com'),
		)
	})

	it('lets a free account pick its picture from /umas and saves the list', async () => {
		signedIn(account())
		mockedUmas.mockImplementation(abortableUmas(response(200, UMAS)))
		mockedPatch.mockResolvedValue(response(200))

		renderPage()
		expect(screen.getByText('Your favourite uma musume')).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: /pick your picture/i }))
		const dialog = await screen.findByRole('dialog', { name: /choose a favourite/i })
		fireEvent.click(await within(dialog).findByRole('button', { name: /^gold ship$/i }))

		await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith({ oshis: [9] }))
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
		expect(mockedToast.success).toHaveBeenCalledWith('Your picture is now Gold Ship.')
		expect(auth.refresh).toHaveBeenCalled()
	})

	it('appends to a later slot and disables umas already picked', async () => {
		signedIn(account({
			oshi_slots: 3,
			oshis: [SPECIAL_WEEK],
			avatar_url: SPECIAL_WEEK.image,
			supporter: { is_supporter: true, tier: 'Junior Class', benefits: ['oshi'] },
		}))
		mockedUmas.mockImplementation(abortableUmas(response(200, UMAS)))
		mockedPatch.mockResolvedValue(response(200))

		renderPage()
		expect(screen.getByText(/your tier covers 3\./i)).toBeInTheDocument()
		expect(screen.getByText(/your picture is special week/i)).toBeInTheDocument()
		// Two empty tiles for the two unfilled slots; none of them is "your picture".
		const empties = screen.getAllByRole('button', { name: /^pick a favourite$/i })
		expect(empties).toHaveLength(2)
		fireEvent.click(empties[0])
		const dialog = await screen.findByRole('dialog')
		expect(await within(dialog).findByRole('button', { name: /special week/i })).toBeDisabled()
		fireEvent.click(within(dialog).getByRole('button', { name: /^gold ship$/i }))

		await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith({ oshis: [7, 9] }))
		expect(mockedToast.success).toHaveBeenCalledWith('Gold Ship added to your favourites.')
	})

	it('makes a later favourite the picture by moving it first', async () => {
		signedIn(account({ oshi_slots: 3, oshis: [SPECIAL_WEEK, GOLD_SHIP], avatar_url: SPECIAL_WEEK.image }))
		mockedPatch.mockResolvedValue(response(200))

		renderPage()
		// The first oshi already is the picture, so only the second offers it.
		expect(screen.queryByRole('button', { name: /make special week your picture/i })).toBeNull()
		fireEvent.click(screen.getByRole('button', { name: /make gold ship your picture/i }))

		await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith({ oshis: [9, 7] }))
		expect(mockedToast.success).toHaveBeenCalledWith('Your picture is now Gold Ship.')
	})

	it('removes a favourite by saving the list without it', async () => {
		signedIn(account({ oshi_slots: 3, oshis: [SPECIAL_WEEK, GOLD_SHIP], avatar_url: SPECIAL_WEEK.image }))
		mockedPatch.mockResolvedValue(response(200))

		renderPage()
		fireEvent.click(screen.getByRole('button', { name: /remove special week/i }))

		await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith({ oshis: [9] }))
		expect(mockedToast.success).toHaveBeenCalledWith('Special Week removed from your favourites.')
	})

	it('replaces the picture in place through Change, marking the current tile', async () => {
		signedIn(account({ oshi_slots: 1, oshis: [SPECIAL_WEEK], avatar_url: SPECIAL_WEEK.image }))
		mockedUmas.mockImplementation(abortableUmas(response(200, UMAS)))
		mockedPatch.mockResolvedValue(response(200))

		renderPage()
		fireEvent.click(screen.getByRole('button', { name: /change special week/i }))
		const dialog = await screen.findByRole('dialog')
		expect(await within(dialog).findByRole('button', { name: /special week/i })).toHaveAttribute(
			'aria-pressed',
			'true',
		)
		fireEvent.change(within(dialog).getByRole('searchbox'), { target: { value: 'gold' } })
		expect(within(dialog).queryByRole('button', { name: /special week/i })).toBeNull()
		fireEvent.click(within(dialog).getByRole('button', { name: /^gold ship$/i }))

		await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith({ oshis: [9] }))
	})

	it('locks costume variants for a free account and opens them for a supporter', async () => {
		signedIn(account())
		mockedUmas.mockImplementation(abortableUmas(response(200, UMAS)))

		const { unmount } = renderPage()
		fireEvent.click(screen.getByRole('button', { name: /pick your picture/i }))
		let dialog = await screen.findByRole('dialog')
		expect(await within(dialog).findByRole('button', { name: /gold ship \(summer\)/i })).toBeDisabled()
		expect(within(dialog).getByText(/supporters only/i)).toBeInTheDocument()
		expect(within(dialog).getByRole('button', { name: /^gold ship$/i })).toBeEnabled()
		unmount()

		signedIn(account({ oshi_slots: 3, oshi_variants: true, supporter: { is_supporter: true, tier: 'Junior Class', benefits: ['oshi'] } }))
		renderPage()
		fireEvent.click(screen.getByRole('button', { name: /pick your picture/i }))
		dialog = await screen.findByRole('dialog')
		expect(await within(dialog).findByRole('button', { name: /gold ship \(summer\)/i })).toBeEnabled()
		expect(within(dialog).queryByText(/supporters only/i)).toBeNull()
	})

	it('keeps the picker open when the server refuses the pick', async () => {
		signedIn(account({ oshi_slots: 1 }))
		mockedUmas.mockImplementation(abortableUmas(response(200, UMAS)))
		mockedPatch.mockResolvedValue(response(400, { oshis: ['Your tier covers 3 favourites.'] }))

		renderPage()
		fireEvent.click(screen.getByRole('button', { name: /pick your picture/i }))
		const dialog = await screen.findByRole('dialog')
		fireEvent.click(await within(dialog).findByRole('button', { name: /^gold ship$/i }))

		await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith('Your tier covers 3 favourites.'))
		expect(screen.getByRole('dialog')).toBeInTheDocument()
		expect(auth.refresh).not.toHaveBeenCalled()
	})

	it('keeps a lapsed supporter\'s picture and greys the rest: kept, removable, not changeable', () => {
		// A lapse leaves the free slot, so the first pick stays the picture.
		signedIn(account({ oshi_slots: 1, oshis: [SPECIAL_WEEK, GOLD_SHIP], avatar_url: SPECIAL_WEEK.image }))

		renderPage()

		expect(screen.getByText(/greyed ones are kept/i)).toBeInTheDocument()
		expect(screen.getByText(/your picture is special week/i)).toBeInTheDocument()
		expect(screen.getAllByText(/not covered/i)).toHaveLength(1)
		expect(screen.getByRole('button', { name: /change special week/i })).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: /change gold ship/i })).toBeNull()
		expect(screen.queryByRole('button', { name: /make .* your picture/i })).toBeNull()
		expect(screen.getByRole('button', { name: /remove gold ship/i })).toBeInTheDocument()
		expect(screen.getByRole('link', { name: /renew on patreon/i })).toBeInTheDocument()
	})

	it('greys out what a downgrade stopped covering and offers no Change on it', () => {
		signedIn(account({
			oshi_slots: 3,
			oshis: [SPECIAL_WEEK, GOLD_SHIP, { position: 2, id: 11, name: 'Haru Urara', image: '' }, { position: 3, id: 12, name: 'Rice Shower', image: '' }],
			avatar_url: SPECIAL_WEEK.image,
			supporter: { is_supporter: true, tier: 'Junior Class', benefits: ['oshi'] },
		}))

		renderPage()

		expect(screen.getByText(/greyed ones are kept/i)).toBeInTheDocument()
		expect(screen.getByText(/not covered/i)).toBeInTheDocument()
		expect(screen.getByRole('button', { name: /change special week/i })).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: /change rice shower/i })).toBeNull()
		expect(screen.getByRole('button', { name: /remove rice shower/i })).toBeInTheDocument()
		// A supporter is not sent to Patreon for more.
		expect(screen.queryByRole('link', { name: /patreon/i })).toBeNull()
	})
})

describe('AccountPage sign out', () => {
	it('signs out through the provider and leaves for the home page', async () => {
		signedIn(account())
		const assign = vi.fn()
		Object.defineProperty(window, 'location', {
			configurable: true,
			value: { ...window.location, assign },
		})

		renderPage()
		fireEvent.click(screen.getByRole('button', { name: /sign out/i }))

		await waitFor(() => expect(auth.signOut).toHaveBeenCalled())
		await waitFor(() => expect(assign).toHaveBeenCalledWith('/'))
	})
})

describe('AccountPage delete account', () => {
	function stubLocation() {
		const assign = vi.fn()
		Object.defineProperty(window, 'location', {
			configurable: true,
			value: { ...window.location, assign },
		})
		return assign
	}

	it('arms the button only once the phrase is typed', () => {
		signedIn(account())

		renderPage()
		const button = screen.getByRole('button', { name: /delete my account/i })
		expect(button).toBeDisabled()

		fireEvent.change(screen.getByRole('textbox', { name: /to confirm/i }), { target: { value: 'delet' } })
		expect(button).toBeDisabled()

		fireEvent.change(screen.getByRole('textbox', { name: /to confirm/i }), { target: { value: ' Delete ' } })
		expect(button).toBeEnabled()
	})

	it('deletes, forgets the token and leaves for the home page', async () => {
		signedIn(account())
		setAuthToken('T0K3N')
		mockedDelete.mockResolvedValue({ ok: true, status: 204 } as unknown as Response)
		const assign = stubLocation()

		renderPage()
		fireEvent.change(screen.getByRole('textbox', { name: /to confirm/i }), { target: { value: 'delete' } })
		fireEvent.click(screen.getByRole('button', { name: /delete my account/i }))

		await waitFor(() => expect(mockedDelete).toHaveBeenCalled())
		await waitFor(() => expect(assign).toHaveBeenCalledWith('/'))
		expect(getAuthToken()).toBeNull()
	})

	it('keeps the token when the server refuses', async () => {
		signedIn(account())
		setAuthToken('T0K3N')
		mockedDelete.mockResolvedValue({ ok: false, status: 403 } as unknown as Response)
		const assign = stubLocation()

		renderPage()
		fireEvent.change(screen.getByRole('textbox', { name: /to confirm/i }), { target: { value: 'delete' } })
		fireEvent.click(screen.getByRole('button', { name: /delete my account/i }))

		await waitFor(() => expect(mockedDelete).toHaveBeenCalled())
		expect(assign).not.toHaveBeenCalled()
		expect(getAuthToken()).toBe('T0K3N')
	})
})

describe('AccountPage gallery', () => {
	const post = {
		public_id: 'k3Df8aQ2', caption: 'Runaway blocker', published_at: '2026-10-10T00:00:00Z',
		content_updated_at: '2026-10-10T00:00:00Z', is_mine: true, umas: [], my_vote: null,
		poster: { display_name: 'Rhondal', portrait: null, tier_name: null, gallery_style: null },
		stats: { views: 212, upvotes: 14, comments: 5, copies: 3 },
		team: [], event: { kind: 'cm', id: 19, label: 'Libra Cup' }, hidden: true,
	}

	it('lists the posts with their numbers and status, and takes one down', async () => {
		mockedMyPosts.mockResolvedValue(response(200, [post]))
		mockedTakeDown.mockResolvedValue(response(204))
		signedIn(account())
		renderPage()
		const section = await screen.findByRole('region', { name: 'Your gallery posts' })
		expect(await within(section).findByText('Libra Cup')).toBeInTheDocument()
		expect(within(section).getByText('Hidden while we review it')).toBeInTheDocument()
		expect(within(section).getByText('212 views')).toBeInTheDocument()
		expect(within(section).getByRole('link', { name: 'Open' })).toHaveAttribute(
			'href', '/app/pvp?event=cm-19&view=gallery&post=k3Df8aQ2',
		)
		fireEvent.click(within(section).getByRole('button', { name: 'Take down' }))
		fireEvent.click(within(section).getByRole('button', { name: 'Take down' }))
		await waitFor(() => expect(within(section).queryByText('Libra Cup')).not.toBeInTheDocument())
		expect(mockedTakeDown).toHaveBeenCalledWith('k3Df8aQ2')
	})

	it('lets a supporter hide their tier in the gallery', async () => {
		mockedPatch.mockResolvedValue(response(200, {}))
		signedIn(account({ supporter: { is_supporter: true, tier: 'Junior Class', benefits: [] } }))
		renderPage()
		const toggle = screen.getByRole('checkbox', { name: 'Show my tier on my gallery posts and comments' })
		expect(toggle).toBeChecked()
		fireEvent.click(toggle)
		await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith({ show_supporter_badge: false }))
	})
})

