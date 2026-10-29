/**
 * The pull plan as a picture: what the picture prints, and the button that
 * makes it. The drawing itself (html-to-image) needs a real browser, so the
 * button's tests stub it; it was checked by hand in headless Chrome.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PlanPicture } from '../components/carat-calculator/share/PlanPicture'
import { SharePlanButton } from '../components/carat-calculator/share/SharePlanButton'
import { EMPTY_BANNER_RESOURCES } from '../hooks/bannerResources'
import type { BannerResources } from '../hooks/bannerResources'
import type { PlannerRow } from '../utils/plannerSections'
import type { BannerUma, UserPlannedBanner } from '../types'
import { downloadImage, renderNodeToPng, shareSupport } from '../utils/shareImage'

vi.mock('../utils/shareImage', () => ({
  renderNodeToPng: vi.fn(() => Promise.resolve({ blob: new Blob(['png'], { type: 'image/png' }), missingArt: 0 })),
  shareSupport: vi.fn(() => ({ copy: false, share: false, preferShare: false })),
  newDrawCache: () => ({ fonts: new Map(), images: new Map() }),
  copyImage: vi.fn(),
  shareImageFile: vi.fn(),
  downloadImage: vi.fn(),
}))
let displayName = ''
let avatarUrl: string | null = null
vi.mock('../services/AuthContext', async () => ({
  ...(await vi.importActual<typeof import('../services/AuthContext')>('../services/AuthContext')),
  useAccount: () => ({
    account: displayName ? { display_name: displayName, avatar_url: avatarUrl } : null,
    isLoggedIn: !!displayName,
  }),
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

function renderPicture(props: Partial<Parameters<typeof PlanPicture>[0]> = {}) {
  return render(
    <PlanPicture
      plannerRows={ROWS}
      bannerResources={RESOURCES}
      umaBannerData={[]}
      supportBannerData={[]}
      userStepUpSelectionData={[]}
      ownerName={null}
      ownerPicture={null}
      hideSpend={false}
      now={NOW}
      {...props}
    />
  )
}

/** A headline figure: the tile holding `label`, read for its value. */
const tile = (label: string) => screen.getByText(label).parentElement?.textContent

describe('PlanPicture', () => {
  it('prints each row, the totals and the shortfall the forecast would', () => {
    renderPicture()

    expect(screen.getByRole('heading', { name: 'My pull plan' })).toBeInTheDocument()
    expect(screen.getByText('Kitasan Black')).toBeInTheDocument()
    expect(screen.getByText('Satono Diamond')).toBeInTheDocument()
    expect(screen.getByText(/^2 banners/)).toBeInTheDocument()
    expect(tile('Pulls planned')).toContain('150')
    expect(tile('Free carats spent')).toContain('22,500')
    expect(tile('Paid carats spent')).toContain('1,500')
    // 5,000 before the second banner, 7,500 spent on it.
    expect(tile('Carats short')).toContain('2,500')
  })

  it("marks a count the carats can't cover", () => {
    renderPicture()

    // 50 planned on the second banner against a ceiling of 33.
    expect(screen.getAllByText('Over budget')).toHaveLength(1)
  })

  it('blanks the paid figures under Hide paid carats', () => {
    renderPicture({ hideSpend: true })

    expect(screen.queryByText('Paid carats spent')).not.toBeInTheDocument()
    expect(screen.getAllByText('Paid Carat Est.')[0].nextSibling?.textContent).toBe('–')
  })

  it('names the plan, with its picture, only when asked to', () => {
    const { container } = renderPicture({ ownerName: 'MooncakeMile', ownerPicture: 'https://example.com/oguri.png' })

    expect(screen.getByRole('heading', { name: "MooncakeMile's pull plan" })).toBeInTheDocument()
    expect(container.querySelector('img[src="https://example.com/oguri.png"]')).not.toBeNull()
  })
})

describe('SharePlanButton', () => {
  afterEach(() => {
    displayName = ''
    avatarUrl = null
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
    expect(downloadImage).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/^uma-plan-\d{4}-\d{2}-\d{2}-\d{4}\.png$/))
  })

  it('makes one picture for boxes ticked in a row, not one each', async () => {
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: 'Share picture' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled())

    const box = screen.getByRole('checkbox', { name: 'Hide paid carats' })
    fireEvent.click(box)
    fireEvent.click(box)
    fireEvent.click(box)
    // The picture no longer matches the boxes, so the actions wait for it.
    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled())
    expect(renderNodeToPng).toHaveBeenCalledTimes(2)
  })

  it('offers the name only to an account that has one, off by default', async () => {
    displayName = 'MooncakeMile'
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: 'Share picture' }))

    expect(screen.getByRole('checkbox', { name: 'Show my name (MooncakeMile)' })).not.toBeChecked()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled())
  })

  it('says the picture comes with the name when the account has one', async () => {
    displayName = 'MooncakeMile'
    avatarUrl = 'https://example.com/oguri.png'
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: 'Share picture' }))

    expect(screen.getByRole('checkbox', { name: 'Show my name and picture (MooncakeMile)' })).not.toBeChecked()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled())
  })

  it('says so when some art did not load', async () => {
    vi.mocked(renderNodeToPng).mockResolvedValueOnce({ blob: new Blob(['png'], { type: 'image/png' }), missingArt: 2 })
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: 'Share picture' }))

    expect(await screen.findByText(/Some art didn't load/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled()
  })

  it('leads with Save or share on an iPhone, and leaves Download out', async () => {
    vi.mocked(shareSupport).mockReturnValueOnce({ copy: true, share: true, preferShare: true })
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: 'Share picture' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save or share' })).toBeEnabled())
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument()
  })

  it('closes on Escape and takes the hidden picture with it', async () => {
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
