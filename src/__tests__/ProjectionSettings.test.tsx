import { useEffect, useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ProjectionSettings } from '../components/carat-calculator/ProjectionSettings'
import { CalculatorContext } from '../services/CalculatorContext'
import { AuthContext, type AuthContextType } from '../services/AuthContext'
import { DEFAULT_GUEST_STATS } from '../services/guestMigration'
import { DEFAULT_CONSTANTS } from '../constants/gameConstants'
import type { CalculatorContextType, UserStats } from '../types'

/**
 * The projection settings, as the last row of the Income & Resources panel
 * (the navbar's gear until 2026-11-24). Closed, the row has to say what is on
 * without being opened; open, a switch writes straight onto the stats block,
 * which is the only thing the projection reads.
 */

let latestStats: UserStats | null = null
const resetGuestPlan = vi.fn()

function Harness({ stats: initial, signedIn = true }: { stats?: Partial<UserStats>; signedIn?: boolean }) {
  const [stats, setStats] = useState<UserStats | null>({ ...DEFAULT_GUEST_STATS, ...initial })
  // Reported after render, where the test reads it.
  useEffect(() => {
    latestStats = stats
  }, [stats])
  const calculator = {
    userStatsData: stats,
    setUserStatsData: setStats,
    calculationConstants: DEFAULT_CONSTANTS,
    resetGuestPlan,
  } as unknown as CalculatorContextType
  const auth = { isLoggedIn: signedIn, account: null } as unknown as AuthContextType
  return (
    <AuthContext.Provider value={auth}>
      <CalculatorContext.Provider value={calculator}>
        <ProjectionSettings />
      </CalculatorContext.Provider>
    </AuthContext.Provider>
  )
}

const header = () => screen.getByRole('button', { name: /Projection settings/ })
const open = () => fireEvent.click(header())

describe('ProjectionSettings', () => {
  it('starts closed, and the closed row says how many settings are on and names them', () => {
    render(<Harness />)
    expect(header()).toHaveAttribute('aria-expanded', 'false')
    // The defaults: the four everyday switches on, the two daily-pull ones off.
    expect(header()).toHaveTextContent('4 of 6 on')
    expect(header()).toHaveTextContent('Tickets on banners · Misc earnings · Discounted pulls · Full-price pulls')
    // Closed means out of reach, not just out of sight.
    expect(screen.queryByRole('checkbox', { name: 'Misc Earnings' })).not.toBeInTheDocument()
  })

  it('opens to one switch per setting, and a switch writes the stats block', () => {
    render(<Harness />)
    open()
    expect(header()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('checkbox')).toHaveLength(6)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Discounted Paid Pulls' }))
    expect(latestStats?.discounted_paid_pulls).toBe(false)
    expect(header()).toHaveTextContent('3 of 6 on')

    fireEvent.click(screen.getByRole('checkbox', { name: 'Daily Pull on Every Uma Banner' }))
    expect(latestStats?.daily_pulls_other_uma_banners).toBe(true)
    expect(header()).toHaveTextContent('4 of 6 on')
  })

  it('reads a setting the API did not send as its default', () => {
    // A field newer than the deployed backend arrives undefined. The default-on
    // ones count as on and the default-off ones as off, as the projection assumes.
    render(<Harness stats={{ discounted_paid_pulls: undefined, daily_pulls_other_uma_banners: undefined } as Partial<UserStats>} />)
    expect(header()).toHaveTextContent('4 of 6 on')
    open()
    expect(screen.getByRole('checkbox', { name: 'Discounted Paid Pulls' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Daily Pull on Every Uma Banner' })).not.toBeChecked()
  })

  it('says so when everything is off', () => {
    render(
      <Harness
        stats={{ spend_tickets_on_banners: false, misc_earnings: false, discounted_paid_pulls: false, full_price_paid_pulls: false }}
      />,
    )
    expect(header()).toHaveTextContent('0 of 6 on')
    expect(header()).toHaveTextContent('Everything is off')
  })

  it('shows the misc earnings amount only while Misc Earnings is on', () => {
    render(<Harness />)
    open()
    expect(screen.getByLabelText('Misc earnings carats per month')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Misc Earnings' }))
    expect(screen.queryByLabelText('Misc earnings carats per month')).not.toBeInTheDocument()
  })

  it('lets a guest clear their plan in two presses, and never offers it signed in', () => {
    resetGuestPlan.mockClear()
    const { unmount } = render(<Harness signedIn={false} />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Clear plan and start over' }))
    // The first press only asks.
    expect(resetGuestPlan).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Clear plan' }))
    expect(resetGuestPlan).toHaveBeenCalledTimes(1)
    unmount()

    render(<Harness signedIn />)
    // Still open: the row remembers until a reload.
    expect(header()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryByRole('button', { name: 'Clear plan and start over' })).not.toBeInTheDocument()
  })
})
