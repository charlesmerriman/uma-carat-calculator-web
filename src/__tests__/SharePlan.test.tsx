/**
 * The pull plan as a picture: what the read-only table prints, and the button
 * that makes it. The drawing itself (html-to-image) needs a real browser, so
 * the button's tests stub it; it was checked by hand in headless Chrome.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShareableBannerTable } from '../components/carat-calculator/share/ShareableBannerTable'
import { SharePlanButton } from '../components/carat-calculator/share/SharePlanButton'
import { EMPTY_BANNER_RESOURCES } from '../hooks/bannerResources'
import type { BannerResources } from '../hooks/bannerResources'
import type { PlannerRow } from '../utils/plannerSections'
import type { BannerUma, UserPlannedBanner } from '../types'
import { downloadImage, renderNodeToPng } from '../utils/shareImage'

vi.mock('../utils/shareImage', () => ({
  renderNodeToPng: vi.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' }))),
  shareSupport: () => ({ copy: false, share: false }),
  copyImage: vi.fn(),
  shareImageFile: vi.fn(),
  downloadImage: vi.fn(),
}))
let displayName = ''
vi.mock('../services/AuthContext', async () => ({
  ...(await vi.importActual<typeof import('../services/AuthContext')>('../services/AuthContext')),
  useAccount: () => ({ account: displayName ? { display_name: displayName } : null, isLoggedIn: !!displayName }),
}))

const NOW = new Date('2099-01-15T12:00:00Z')

const row = (id: number, name: string, pulls: number): UserPlannedBanner => ({
  id,
  number_of_pulls: pulls,
  reserved_copies: 0,
  banner_uma: {
    id, name, admin_comments: '', umas: [], free_pulls: 0, is_recommended: false,
    banner_timeline: {
      id, name, start_date: '2099-01-01T22:00:00Z', end_date: '2099-02-01T21:59:59Z', is_predicted: false,
      banner_category: 'standard', schedule_offset_days: 0, applied_offset_days: 0,
      jp_start_date: null, jp_end_date: null, global_start_date: null, global_end_date: null, image: '',
    },
  } as BannerUma,
}) as UserPlannedBanner

const ROWS: PlannerRow[] = [
  { kind: 'banner', banner: row(1, 'Kitasan Black', 100), index: 0 },
  { kind: 'banner', banner: row(2, 'Satono Diamond', 50), index: 1 },
]
const resources = (free: number, spent: number, paid = 0, paidSpent = 0): BannerResources => ({
  ...EMPTY_BANNER_RESOURCES,
  freeCarats: free,
  freeCaratsSpent: spent,
  paidCarats: paid,
  paidCaratsSpent: paidSpent,
  maxPossiblePulls: Math.floor(free / 150),
})
const RESOURCES = [resources(20_000, 15_000, 3_000, 1_500), resources(5_000, 7_500)]

function renderTable(props: Partial<Parameters<typeof ShareableBannerTable>[0]> = {}) {
  return render(
    <ShareableBannerTable
      plannerRows={ROWS}
      bannerResources={RESOURCES}
      umaBannerData={[]}
      supportBannerData={[]}
      userStepUpSelectionData={[]}
      ownerName={null}
      hideSpend={false}
      now={NOW}
      {...props}
    />
  )
}

describe('ShareableBannerTable', () => {
  it('prints each row, the totals and the shortfall the forecast would', () => {
    renderTable()

    expect(screen.getByRole('heading', { name: 'Pull plan' })).toBeInTheDocument()
    expect(screen.getByText('Kitasan Black')).toBeInTheDocument()
    expect(screen.getByText('Satono Diamond')).toBeInTheDocument()
    expect(screen.getByText(/2 banners · 150 pulls · 22,500 free carats spent · 1,500 paid carats spent/)).toBeInTheDocument()
    // 5,000 before the second banner, 7,500 spent on it.
    expect(screen.getByText(/Short by 2,500 carats/)).toBeInTheDocument()
  })

  it('blanks the paid box and drops the paid total under Hide paid carats', () => {
    renderTable({ hideSpend: true })

    expect(screen.queryByText(/paid carats spent/)).not.toBeInTheDocument()
    expect(screen.getAllByText('Paid Carat Est.')[0].nextSibling?.textContent).toBe('–')
  })

  it("names the plan only when asked to", () => {
    renderTable({ ownerName: 'MooncakeMile' })
    expect(screen.getByRole('heading', { name: "MooncakeMile's pull plan" })).toBeInTheDocument()
  })
})

describe('SharePlanButton', () => {
  afterEach(() => {
    displayName = ''
    vi.clearAllMocks()
  })

  function renderButton() {
    render(
      <MemoryRouter>
        <SharePlanButton
          plannerRows={ROWS}
          bannerResources={RESOURCES}
          umaBannerData={[]}
          supportBannerData={[]}
          userStepUpSelectionData={[]}
        />
      </MemoryRouter>
    )
  }

  it('makes the picture when the panel opens, then downloads it on click', async () => {
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: 'Share picture' }))

    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled())
    expect(renderNodeToPng).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Download' }))
    expect(downloadImage).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/^uma-plan-\d{4}-\d{2}-\d{2}\.png$/))
  })

  it('offers the name only to an account that has one, off by default', async () => {
    displayName = 'MooncakeMile'
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: 'Share picture' }))

    expect(screen.getByRole('checkbox', { name: 'Show my name (MooncakeMile)' })).not.toBeChecked()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled())
  })

  it('closes on Escape and takes the hidden table with it', async () => {
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: 'Share picture' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled())

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument()
    expect(screen.queryByText('Kitasan Black')).not.toBeInTheDocument()
  })
})
