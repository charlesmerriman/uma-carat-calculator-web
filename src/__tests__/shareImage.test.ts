// Which browsers draw the share picture twice (utils/shareImage.ts): only
// Safari's engine needs the second pass, so every other browser skips it.
import { describe, expect, it } from 'vitest'
import { needsSecondPass } from '../utils/shareImage'

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
