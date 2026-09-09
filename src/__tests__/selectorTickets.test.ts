// @vitest-environment node
// Pure bucket arithmetic — no DOM needed.
import {
  addSelectorTickets,
  isCardEligible,
  isCardSelectable,
  spendSelectorTickets,
  totalSelectorTickets,
} from '../utils/selectorTickets'
import type { SelectorTicketBucket } from '../utils/selectorTickets'

describe('addSelectorTickets', () => {
  it('ignores a non-positive count', () => {
    const buckets: SelectorTicketBucket[] = []
    expect(addSelectorTickets(buckets, '2024-01-31', 0)).toBe(buckets)
    expect(addSelectorTickets(buckets, '2024-01-31', -2)).toBe(buckets)
  })

  it('merges into an existing bucket with the same cutoff', () => {
    const once = addSelectorTickets([], '2024-01-31', 1)
    expect(addSelectorTickets(once, '2024-01-31', 2)).toEqual([
      { jpCutoff: '2024-01-31', count: 3 },
    ])
  })

  it('keeps buckets sorted weakest-first with unrestricted last', () => {
    let buckets = addSelectorTickets([], null, 1)
    buckets = addSelectorTickets(buckets, '2026-01-30', 1)
    buckets = addSelectorTickets(buckets, '2024-01-31', 1)

    expect(buckets.map((b) => b.jpCutoff)).toEqual([
      '2024-01-31',
      '2026-01-30',
      null,
    ])
  })

  it('does not mutate the input', () => {
    const original = addSelectorTickets([], '2024-01-31', 1)
    addSelectorTickets(original, '2025-01-31', 1)
    expect(original).toEqual([{ jpCutoff: '2024-01-31', count: 1 }])
  })
})

describe('totalSelectorTickets', () => {
  it('sums every bucket', () => {
    let buckets = addSelectorTickets([], '2024-01-31', 2)
    buckets = addSelectorTickets(buckets, null, 3)
    expect(totalSelectorTickets(buckets)).toBe(5)
  })

  it('is zero for an empty pool', () => {
    expect(totalSelectorTickets([])).toBe(0)
  })
})

describe('isCardSelectable', () => {
  it('admits an ordinary uma', () => {
    expect(isCardSelectable({ id: 1, is_time_limited: false, is_three_star: true })).toBe(true)
  })

  it('refuses a time-limited uma', () => {
    expect(isCardSelectable({ id: 1, is_time_limited: true, is_three_star: true })).toBe(false)
  })

  it('refuses a uma that is not three star', () => {
    expect(isCardSelectable({ id: 1, is_time_limited: false, is_three_star: false })).toBe(false)
  })

  it('treats a card with neither flag as unrestricted', () => {
    // A support card carries no intrinsic gate. Absent must not read as ★1.
    expect(isCardSelectable({ id: 1 })).toBe(true)
  })

  it('is independent of any cutoff', () => {
    // The whole point of the second gate: an unrestricted (null) cutoff makes
    // isCardEligible wave everything through, and this must still refuse.
    expect(isCardEligible('2020-01-01', null)).toBe(true)
    expect(isCardSelectable({ id: 1, is_time_limited: true })).toBe(false)
  })
})

describe('isCardEligible', () => {
  it('accepts anything when the cutoff is null', () => {
    expect(isCardEligible('2030-01-01T00:00:00Z', null)).toBe(true)
    expect(isCardEligible(null, null)).toBe(true)
  })

  it('is inclusive on the cutoff date', () => {
    // Sakura Bakushin O debuted exactly on the 3rd Anniversary's cutoff and the
    // source sheet lists her as selectable.
    expect(isCardEligible('2024-01-31T22:00:00Z', '2024-01-31')).toBe(true)
  })

  it('rejects a card released the day after', () => {
    expect(isCardEligible('2024-02-01T00:00:00Z', '2024-01-31')).toBe(false)
  })

  it('rejects an unknown release date under a real cutoff', () => {
    // Conservative: claiming a selector covers a card it cannot is worse than
    // hiding one it could.
    expect(isCardEligible(null, '2024-01-31')).toBe(false)
    expect(isCardEligible(undefined, '2024-01-31')).toBe(false)
  })
})

describe('spendSelectorTickets', () => {
  const OLD = '2020-01-01T00:00:00Z'
  const NEW = '2030-01-01T00:00:00Z'

  it('spends nothing when nothing is wanted', () => {
    const buckets = addSelectorTickets([], null, 3)
    expect(spendSelectorTickets(buckets, 0, OLD)).toEqual({ buckets, spent: 0 })
  })

  it('takes the WEAKEST qualifying bucket first', () => {
    let buckets = addSelectorTickets([], '2024-01-31', 1)
    buckets = addSelectorTickets(buckets, null, 1)

    const result = spendSelectorTickets(buckets, 1, OLD)

    expect(result.spent).toBe(1)
    // The unrestricted ticket — usable anywhere — is preserved.
    expect(result.buckets).toEqual([{ jpCutoff: null, count: 1 }])
  })

  it('skips buckets whose cutoff the card misses', () => {
    let buckets = addSelectorTickets([], '2024-01-31', 2)
    buckets = addSelectorTickets(buckets, null, 1)

    const result = spendSelectorTickets(buckets, 1, NEW)

    expect(result.spent).toBe(1)
    // Only the unrestricted ticket could cover a 2030 card.
    expect(result.buckets).toEqual([{ jpCutoff: '2024-01-31', count: 2 }])
  })

  it('spends across several buckets when one is not enough', () => {
    let buckets = addSelectorTickets([], '2024-01-31', 1)
    buckets = addSelectorTickets(buckets, '2026-01-30', 1)

    const result = spendSelectorTickets(buckets, 2, OLD)

    expect(result.spent).toBe(2)
    expect(result.buckets).toEqual([])
  })

  it('reports a shortfall instead of over-spending', () => {
    const buckets = addSelectorTickets([], '2024-01-31', 1)
    const result = spendSelectorTickets(buckets, 4, OLD)

    expect(result.spent).toBe(1)
    expect(result.buckets).toEqual([])
  })

  it('spends nothing when no bucket qualifies', () => {
    const buckets = addSelectorTickets([], '2024-01-31', 3)
    const result = spendSelectorTickets(buckets, 2, NEW)

    expect(result.spent).toBe(0)
    expect(result.buckets).toEqual(buckets)
  })

  it('drops emptied buckets rather than leaving zero-count entries', () => {
    const buckets = addSelectorTickets([], '2024-01-31', 2)
    expect(spendSelectorTickets(buckets, 2, OLD).buckets).toEqual([])
  })
})
