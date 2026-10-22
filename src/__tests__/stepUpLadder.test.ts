// @vitest-environment node
// Pure math functions — no DOM APIs needed, so we skip jsdom for faster teardown.
import { describe, it, expect } from 'vitest'
import {
  STEPS_PER_ROUND,
  cumulativeStepCost,
  guaranteedCopies,
  stepCosts,
  stepLabel,
  stepUpCopyDistribution,
  stepUpPulls,
  stepsAffordable,
} from '../utils/stepUpLadder'
import { DEFAULT_CONSTANTS as C } from '../constants/gameConstants'
import { shiftDistribution } from '../utils/probabilityCalculations'

// ── stepCosts ─────────────────────────────────────────────────────────────────

describe('stepCosts', () => {
  it('reproduces the sheet ladder AL360:AN364', () => {
    expect(stepCosts(C)).toEqual([500, 700, 1000, 1300, 1500])
  })

  it('is five steps long, matching STEPS_PER_ROUND', () => {
    expect(stepCosts(C)).toHaveLength(STEPS_PER_ROUND)
    expect(STEPS_PER_ROUND).toBe(5)
  })
})

// ── cumulativeStepCost ────────────────────────────────────────────────────────

describe('cumulativeStepCost', () => {
  it('walks the first round one step at a time', () => {
    // The sheet's cumulative column: 500, 1200, 2200, 3500, 5000.
    expect(cumulativeStepCost(0, C)).toBe(0)
    expect(cumulativeStepCost(1, C)).toBe(500)
    expect(cumulativeStepCost(2, C)).toBe(1_200)
    expect(cumulativeStepCost(3, C)).toBe(2_200)
    expect(cumulativeStepCost(4, C)).toBe(3_500)
    expect(cumulativeStepCost(5, C)).toBe(5_000)
  })

  it('repeats the cycle past the first round', () => {
    expect(cumulativeStepCost(6, C)).toBe(5_500)
    expect(cumulativeStepCost(7, C)).toBe(6_200)
    expect(cumulativeStepCost(10, C)).toBe(10_000)
  })

  it('holds at the real ceiling of three banners and beyond', () => {
    // banner_count maxes out at 3, so 15 is the largest step count that can
    // actually exist. The closed form keeps going regardless — the clamp is the
    // engine's job, not the ladder's.
    expect(cumulativeStepCost(15, C)).toBe(15_000)
    expect(cumulativeStepCost(20, C)).toBe(20_000)
    expect(cumulativeStepCost(35, C)).toBe(35_000)
  })

  it('costs 5,000 for the 50 pulls that would otherwise cost 7,500', () => {
    // The whole point of the format. Compared against the standard rate, not
    // the once-per-day discounted paid pull, which is a separate mechanic.
    const pulls = STEPS_PER_ROUND * C.step_up_pulls_per_step
    expect(pulls).toBe(50)
    expect(cumulativeStepCost(STEPS_PER_ROUND, C)).toBe(5_000)
    expect(pulls * C.pull_cost_carats).toBe(7_500)
  })

  it('floors fractional steps and refuses negatives', () => {
    expect(cumulativeStepCost(5.9, C)).toBe(5_000)
    expect(cumulativeStepCost(-3, C)).toBe(0)
  })

  it('reads the ladder from the constants rather than a baked-in table', () => {
    // Guards the "constants come from the API" invariant: an admin edit has to
    // move the numbers, so nothing here may close over the defaults.
    const dearer = { ...C, step_up_cost_step_1: 600 }
    expect(cumulativeStepCost(1, dearer)).toBe(600)
    expect(cumulativeStepCost(5, dearer)).toBe(5_100)
  })
})

// ── stepsAffordable ───────────────────────────────────────────────────────────

describe('stepsAffordable', () => {
  it('buys nothing below the first step', () => {
    expect(stepsAffordable(0, C)).toBe(0)
    expect(stepsAffordable(499, C)).toBe(0)
  })

  it('rounds down — a part-paid step is not a step', () => {
    expect(stepsAffordable(500, C)).toBe(1)
    expect(stepsAffordable(1_199, C)).toBe(1)
    expect(stepsAffordable(1_200, C)).toBe(2)
    expect(stepsAffordable(4_999, C)).toBe(4)
  })

  it('crosses a round boundary cleanly', () => {
    expect(stepsAffordable(5_000, C)).toBe(5)
    expect(stepsAffordable(5_499, C)).toBe(5)
    expect(stepsAffordable(5_500, C)).toBe(6)
  })

  it('handles the projected 5th-anniversary paid balance', () => {
    // ~21,700 paid carats by the 5th anniversary: four full ladders plus two
    // steps into a fifth, i.e. affordability really does bind before the
    // 25,000 that running all five banners would need.
    expect(stepsAffordable(21_700, C)).toBe(22)
    expect(stepsAffordable(25_000, C)).toBe(25)
  })

  it('returns 0 for junk input rather than propagating it', () => {
    // NaN compares false against everything, so a `<= 0` guard would let it
    // through and poison the odds downstream.
    expect(stepsAffordable(-1, C)).toBe(0)
    expect(stepsAffordable(NaN, C)).toBe(0)
  })

  it('round-trips against cumulativeStepCost at every step count', () => {
    for (let n = 0; n <= 40; n++) {
      expect(stepsAffordable(cumulativeStepCost(n, C), C)).toBe(n)
    }
  })

  it('never claims a step the carats cannot pay for', () => {
    for (let paid = 0; paid <= 12_000; paid += 137) {
      expect(cumulativeStepCost(stepsAffordable(paid, C), C)).toBeLessThanOrEqual(
        paid
      )
    }
  })
})

// ── stepLabel ─────────────────────────────────────────────────────────────────

describe('stepLabel', () => {
  it('writes a partial first round as a bare number', () => {
    expect(stepLabel(1)).toBe('1')
    expect(stepLabel(3)).toBe('3')
    expect(stepLabel(4)).toBe('4')
  })

  it('writes completed rounds as 5xN', () => {
    expect(stepLabel(5)).toBe('5x1')
    expect(stepLabel(10)).toBe('5x2')
    expect(stepLabel(15)).toBe('5x3')
    expect(stepLabel(35)).toBe('5x7')
  })

  it('writes a remainder after completed rounds as 5xN-r', () => {
    expect(stepLabel(6)).toBe('5x1-1')
    expect(stepLabel(7)).toBe('5x1-2')
    expect(stepLabel(14)).toBe('5x2-4')
  })

  it('spells zero as 0, not 5x0', () => {
    expect(stepLabel(0)).toBe('0')
  })
})

// ── guaranteedCopies ──────────────────────────────────────────────────────────

describe('guaranteedCopies', () => {
  it('grants one copy per completed round and nothing part-way', () => {
    expect(guaranteedCopies(0)).toBe(0)
    expect(guaranteedCopies(4)).toBe(0)
    expect(guaranteedCopies(5)).toBe(1)
    expect(guaranteedCopies(9)).toBe(1)
    expect(guaranteedCopies(10)).toBe(2)
    expect(guaranteedCopies(15)).toBe(3)
  })

  it('keeps counting past MLB — the clamp belongs to the odds, not here', () => {
    expect(guaranteedCopies(35)).toBe(7)
  })
})

// ── stepUpPulls ───────────────────────────────────────────────────────────────

describe('stepUpPulls', () => {
  it('splits one round into 47 pool pulls, 2 selection slots and 1 pick', () => {
    expect(stepUpPulls(5, C)).toEqual({ poolPulls: 47, selectionSlots: 2, guaranteed: 1 })
  })

  it('counts only the guaranteed slots a partial round has reached', () => {
    expect(stepUpPulls(0, C)).toEqual({ poolPulls: 0, selectionSlots: 0, guaranteed: 0 })
    expect(stepUpPulls(2, C)).toEqual({ poolPulls: 20, selectionSlots: 0, guaranteed: 0 })
    expect(stepUpPulls(3, C)).toEqual({ poolPulls: 29, selectionSlots: 1, guaranteed: 0 })
    expect(stepUpPulls(4, C)).toEqual({ poolPulls: 38, selectionSlots: 2, guaranteed: 0 })
    expect(stepUpPulls(8, C)).toEqual({ poolPulls: 76, selectionSlots: 3, guaranteed: 1 })
  })

  it('reaches the three-banner ceiling as 141, 6 and 3', () => {
    // The numbers from the #requests report: 141 pulls at 0.3%, 6 at 10%,
    // and 3 selections.
    expect(stepUpPulls(15, C)).toEqual({ poolPulls: 141, selectionSlots: 6, guaranteed: 3 })
  })

  it('never loses a pull: the three kinds always add up to steps x 10', () => {
    for (let steps = 0; steps <= 35; steps++) {
      const { poolPulls, selectionSlots, guaranteed } = stepUpPulls(steps, C)
      expect(poolPulls + selectionSlots + guaranteed).toBe(steps * C.step_up_pulls_per_step)
    }
  })
})

// ── the step-up odds path through copyDistribution ────────────────────────────

describe('stepUpCopyDistribution', () => {
  const stepUpOdds = (steps: number) => stepUpCopyDistribution(steps, C)

  it('credits the step 3 slot as a 1-in-10 chance', () => {
    // 3 steps: 29 pool pulls and 1 selection slot. Zero copies means every
    // one of them misses.
    expect(stepUpOdds(3)[0]).toBeCloseTo(Math.pow(0.997, 29) * 0.9 * 100, 9)
  })

  it('combines both kinds of roll on top of the step 5 pick', () => {
    // One full round: the pick makes 1 copy certain, so "exactly 1" is
    // "no random hits" and "exactly 2" is "one hit from either source".
    const noPoolHit = Math.pow(0.997, 47)
    const onePoolHit = 47 * 0.003 * Math.pow(0.997, 46)
    const odds = stepUpOdds(5)

    expect(odds[0]).toBe(0)
    expect(odds[1]).toBeCloseTo(noPoolHit * 0.81 * 100, 9)
    expect(odds[2]).toBeCloseTo(
      (onePoolHit * 0.81 + noPoolHit * 2 * 0.1 * 0.9) * 100,
      9
    )
  })

  it('matches an independent model at the three-banner ceiling', () => {
    // Reference values from a separate Python implementation (exact binomials
    // convolved): 34.79 / 37.96 / 27.25. The sheet's model showed 7.5% MLB.
    const odds = stepUpOdds(15)
    expect(odds[3]).toBeCloseTo(34.791438, 5)
    expect(odds[4]).toBeCloseTo(37.955353, 5)
    expect(odds[5]).toBeCloseTo(27.253209, 5)
  })

  it("shifts by a funded reserved copy to Daptrius's numbers", () => {
    // Two full rounds starting from one copy already in hand (board post
    // "Step-up odds ignore copies you already own", 2026-10-17). The row
    // applies the shift (BannerRow), so this is the maths it now reaches.
    const odds = shiftDistribution(stepUpOdds(10), 1)
    expect(odds[3]).toBeCloseTo(49.47, 2)
    expect(odds[4]).toBeCloseTo(35.98, 2)
    expect(odds[5]).toBeCloseTo(14.56, 2)
  })

  it('runs at the 0.3% target rate, not the 0.75% featured rate', () => {
    // One step, no guarantee yet: a plain binomial over 10 pulls.
    const [zeroCopies] = stepUpOdds(1)
    expect(zeroCopies).toBeCloseTo(Math.pow(1 - 0.003, 10) * 100, 9)
    expect(C.step_up_target_rate).toBe(0.003)
  })

  it('sums to 100 and floors out below the guarantee', () => {
    const odds = stepUpOdds(15)
    expect(odds).toHaveLength(6)
    expect(odds.reduce((sum, p) => sum + p, 0)).toBeCloseTo(100, 6)
    // Three completed rounds hand over three copies, so 0/1/2 are unreachable.
    expect(odds.slice(0, 3)).toEqual([0, 0, 0])
    expect(odds[3]).toBeGreaterThan(0)
  })

  it('reads one step as ten pulls, not as one', () => {
    // The bug this helper exists to prevent: a step-up row's input is STEPS, so
    // feeding it to the standard binomial would understate a plan tenfold.
    const oneStep = stepUpOdds(1)[0]
    const tenPulls = Math.pow(1 - C.step_up_target_rate, 10) * 100
    const onePull = Math.pow(1 - C.step_up_target_rate, 1) * 100
    expect(oneStep).toBeCloseTo(tenPulls, 9)
    expect(oneStep).not.toBeCloseTo(onePull, 4)
  })

  it('clamps guarantees past MLB into a certainty', () => {
    // Seven rounds guarantee seven copies; there is no 5LB, so the top bucket
    // takes everything rather than the distribution collapsing to all zeroes.
    const odds = stepUpOdds(35)
    expect(odds).toEqual([0, 0, 0, 0, 0, 100])
  })
})
