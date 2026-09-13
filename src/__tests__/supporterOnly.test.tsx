/**
 * SupporterOnly / useHasBenefit — the one paywall boundary.
 *
 * It gates on a benefit KEY and fails CLOSED while the account is unknown; the
 * ad loader (which must fail open) is documented as the exception and does not
 * use this component.
 */
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupporterOnly } from '../components/account/SupporterOnly'
import type { Account } from '../types/account'

const auth = vi.hoisted(() => ({ account: null as Account | null }))
vi.mock('../services/AuthContext', () => ({ useAccount: () => auth }))

function account(benefits?: string[]): Account {
	return {
		username: 'user_a3f9c1',
		avatar_url: null,
		linked_providers: [],
		supporter: benefits ? { is_supporter: true, tier: 'Junior Class', benefits } : { is_supporter: false },
	}
}

beforeEach(() => {
	auth.account = null
})

describe('SupporterOnly', () => {
	it('renders children when the account holds the benefit key', () => {
		auth.account = account(['ad_free'])

		render(<SupporterOnly benefit="ad_free" fallback={<p>fallback</p>}><p>gated</p></SupporterOnly>)

		expect(screen.getByText('gated')).toBeInTheDocument()
		expect(screen.queryByText('fallback')).toBeNull()
	})

	it('renders the fallback for a supporter who lacks THIS key', () => {
		auth.account = account(['some_other_benefit'])

		render(<SupporterOnly benefit="ad_free" fallback={<p>fallback</p>}><p>gated</p></SupporterOnly>)

		expect(screen.getByText('fallback')).toBeInTheDocument()
	})

	it('fails closed while the account is unknown, and for a non-supporter', () => {
		render(<SupporterOnly benefit="ad_free" fallback={<p>fallback</p>}><p>gated</p></SupporterOnly>)
		expect(screen.getByText('fallback')).toBeInTheDocument()

		auth.account = account()
		render(<SupporterOnly benefit="ad_free"><p>gated-2</p></SupporterOnly>)
		expect(screen.queryByText('gated-2')).toBeNull()
	})
})
