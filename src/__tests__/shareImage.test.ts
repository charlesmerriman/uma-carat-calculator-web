// Which browsers draw the share picture more than once (utils/shareImage.ts):
// only Safari's engine needs the extra passes, so every other browser skips
// them. And the scale a picture is drawn at, so it never passes an iPhone's
// canvas cap.
import { describe, expect, it } from 'vitest'
import { needsSecondPass, pixelRatioFor } from '../utils/shareImage'

const SAFARI_ENGINE = {
  'Safari on an iPhone': ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1', 5],
  'Chrome on an iPhone': ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/156.0.0.0 Mobile/15E148 Safari/604.1', 5],
  'an iPad asking for the desktop site': ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15', 5],
  'Safari on a Mac': ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15', 0],
} as const

const OTHERS = {
  'Chrome on Windows': ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36', 0],
  'Chrome on a Mac': ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36', 0],
  'Chrome on Android': ['Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36', 5],
  'Edge on Windows': ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', 0],
  'Firefox on Windows': ['Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:159.0) Gecko/20100101 Firefox/159.0', 0],
} as const

describe('needsSecondPass', () => {
  it.each(Object.entries(SAFARI_ENGINE))('draws twice for %s', (_name, [userAgent, touchPoints]) => {
    expect(needsSecondPass(userAgent, touchPoints)).toBe(true)
  })

  it.each(Object.entries(OTHERS))('draws once for %s', (_name, [userAgent, touchPoints]) => {
    expect(needsSecondPass(userAgent, touchPoints)).toBe(false)
  })
})

describe('pixelRatioFor', () => {
  it('draws a short picture at twice its size', () => {
    // A 10-banner plan: 960 x about 1,550 CSS px.
    expect(pixelRatioFor(960, 1550)).toBe(2)
  })

  it('draws a long plan smaller, never past an iPhone canvas (16,777,216 px)', () => {
    // About 40 and 80 banners: 960 x 5,150 and 960 x 9,950 CSS px.
    for (const height of [5150, 9950]) {
      const ratio = pixelRatioFor(960, height)
      expect(ratio).toBeLessThan(2)
      expect(960 * ratio * height * ratio).toBeLessThanOrEqual(16_777_216)
    }
    expect(pixelRatioFor(960, 5150)).toBeCloseTo(1.8, 1)
  })
})
