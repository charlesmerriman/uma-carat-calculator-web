// @vitest-environment node
// Pure date helpers — no DOM needed.
import { formatDate, formatTime, formatUtcDay, localZoneName, parseApiDate } from '../utils/dateFormat'

describe('formatDate', () => {
  it('formats a date-only string as YYYY/M/D with no zero padding', () => {
    expect(formatDate('2026-07-05')).toBe('2026/7/5')
  })

  it('keeps two-digit months and days intact', () => {
    expect(formatDate('2026-12-25')).toBe('2026/12/25')
  })

  it('formats a full instant using the local calendar day', () => {
    // A banner date as DRF sends it. Built from local parts so the expectation
    // holds in whatever timezone the test runs in — the point being that the
    // instant is converted to a local day, not sliced off the string.
    const instant = new Date('2025-06-26T22:00:00Z')
    const expected = `${instant.getFullYear()}/${instant.getMonth() + 1}/${instant.getDate()}`
    expect(formatDate('2025-06-26T22:00:00Z')).toBe(expected)
  })

  it('does not shift a date-only string across the UTC boundary', () => {
    // The regression this helper exists to prevent: `new Date("2026-01-01")` is
    // UTC midnight, which is still 2025-12-31 anywhere west of Greenwich.
    expect(formatDate('2026-01-01')).toBe('2026/1/1')
  })

  it('returns an empty string for null and undefined', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
  })

  it('falls back to the raw string when unparseable', () => {
    expect(formatDate('garbage')).toBe('garbage')
  })
})

describe('parseApiDate', () => {
  it('parses a date-only string to local midnight', () => {
    const date = parseApiDate('2026-07-05')!
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(6) // zero-indexed
    expect(date.getDate()).toBe(5)
    expect(date.getHours()).toBe(0)
  })

  it('parses a full instant as an absolute point in time', () => {
    expect(parseApiDate('2025-06-26T22:00:00Z')!.toISOString()).toBe(
      '2025-06-26T22:00:00.000Z'
    )
  })

  it('returns null for unparseable input', () => {
    expect(parseApiDate('garbage')).toBeNull()
    expect(parseApiDate('')).toBeNull()
  })
})

describe('formatUtcDay', () => {
  // Node re-reads TZ when it changes, so one test can stand in a zone behind
  // UTC and one ahead of it. Unstubbed after each test so no other file sees it.
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // The forecast chart's hover bug: a daily sample is a UTC midnight holding
  // that day's rewards, and a local reading labelled it the day before.
  const sample = new Date(Date.UTC(2029, 10, 2))

  it('names the UTC day west of Greenwich, where a local reading is a day early', () => {
    vi.stubEnv('TZ', 'America/New_York')
    expect(formatDate(sample.toISOString())).toBe('2029/11/1')
    expect(formatUtcDay(sample)).toBe('2029/11/2')
  })

  it('names the same UTC day east of Greenwich', () => {
    vi.stubEnv('TZ', 'Asia/Tokyo')
    expect(formatUtcDay(sample)).toBe('2029/11/2')
  })
})

// The clock style follows the viewer's locale, so these accept either one:
// "3:00 PM" (\s also matches the narrow no-break space newer ICU puts before
// PM) or "15:00".
describe('formatTime', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("reads an instant in the viewer's zone", () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    expect(formatTime('2026-10-31T22:00:00Z')).toMatch(/^(3:00\sPM|15:00)$/)
  })

  it('follows a clock change: the same UTC hour a week later is an hour earlier', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    expect(formatTime('2026-11-07T22:00:00Z')).toMatch(/^(2:00\sPM|14:00)$/)
  })

  it('drops the seconds of an end time, never rounding it up', () => {
    vi.stubEnv('TZ', 'Asia/Tokyo')
    expect(formatTime('2026-11-06T21:59:59Z')).toMatch(/^(6:59\sAM|0?6:59)$/)
  })

  it('has nothing to show for a date-only, empty or unreadable value', () => {
    expect(formatTime('2026-10-31')).toBe('')
    expect(formatTime(null)).toBe('')
    expect(formatTime('soon')).toBe('')
  })
})

describe('localZoneName', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('names the zone the same on both sides of a clock change', () => {
    // CM 21 runs across the US switch on 2026-11-01: one label must fit both ends.
    vi.stubEnv('TZ', 'America/Los_Angeles')
    const before = localZoneName('2026-10-31T22:00:00Z')
    expect(before).not.toBe('')
    expect(localZoneName('2026-11-05T22:00:00Z')).toBe(before)
  })

  it('is empty for a missing or unreadable value', () => {
    expect(localZoneName(undefined)).toBe('')
    expect(localZoneName('soon')).toBe('')
  })
})
