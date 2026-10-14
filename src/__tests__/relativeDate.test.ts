// @vitest-environment node
// Pure date helpers — no DOM needed.
import { formatRelativeDate, formatTimeAgo } from '../utils/relativeDate'
import { formatDate } from '../utils/dateFormat'
import { countLabel } from '../utils/plural'

/** A "YYYY-MM-DD" string offset by `n` days from today (local time). */
function dateOffset(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

describe('formatRelativeDate', () => {
  it('returns "today" for the current day', () => {
    expect(formatRelativeDate(dateOffset(0))).toBe('today')
  })

  it('buckets recent past days', () => {
    // numeric:"auto" renders -1 day as "yesterday".
    expect(formatRelativeDate(dateOffset(-1))).toBe('yesterday')
    expect(formatRelativeDate(dateOffset(-3))).toMatch(/3 days ago/)
  })

  it('buckets by weeks under a month', () => {
    expect(formatRelativeDate(dateOffset(-14))).toMatch(/2 weeks ago/)
  })

  it('buckets by months under a year', () => {
    expect(formatRelativeDate(dateOffset(-60))).toMatch(/2 months ago/)
  })

  it('buckets by years past a year', () => {
    expect(formatRelativeDate(dateOffset(-800))).toMatch(/2 years ago/)
  })

  it('returns empty string for unparseable input', () => {
    expect(formatRelativeDate('not-a-date')).toBe('')
  })
})

describe('formatTimeAgo', () => {
  const now = Date.parse('2026-10-14T12:00:00Z')
  const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString()

  it('counts elapsed time down to the minute', () => {
    expect(formatTimeAgo(ago(20), now)).toBe('just now')
    expect(formatTimeAgo(ago(60), now)).toBe('1 minute ago')
    expect(formatTimeAgo(ago(5 * 60), now)).toBe('5 minutes ago')
    expect(formatTimeAgo(ago(3 * 3600), now)).toBe('3 hours ago')
    expect(formatTimeAgo(ago(26 * 3600), now)).toBe('1 day ago')
    expect(formatTimeAgo(ago(29 * 86400), now)).toBe('29 days ago')
  })

  it('gives the calendar date past a month, and never a future time', () => {
    expect(formatTimeAgo(ago(31 * 86400), now)).toBe(formatDate(ago(31 * 86400)))
    expect(formatTimeAgo(ago(-600), now)).toBe('just now')
  })

  it('passes through what it cannot read', () => {
    expect(formatTimeAgo('not a date', now)).toBe('not a date')
    expect(formatTimeAgo(null, now)).toBe('')
  })
})

describe('countLabel', () => {
  it('says one as one, and takes an irregular plural', () => {
    expect(countLabel(1, 'comment')).toBe('1 comment')
    expect(countLabel(0, 'comment')).toBe('0 comments')
    expect(countLabel(1, 'copy', 'copies')).toBe('1 copy')
    expect(countLabel(3, 'copy', 'copies')).toBe('3 copies')
  })
})
