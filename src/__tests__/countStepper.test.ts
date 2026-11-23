import { describe, it, expect } from 'vitest'
import { ITEM_CHIPS, buildCopyChips, buildCountChips, buildQuantityChips, coarsePullDelta } from '../utils/countChips'
import type { CountChipSet } from '../utils/countChips'
import { PULLS_PER_PITY_COPY } from '../utils/probabilityCalculations'
import { STEPS_PER_ROUND } from '../utils/stepUpLadder'

const umaChips = (): CountChipSet =>
	buildCountChips({
		rowType: 'Uma',
		stepLimit: Infinity,
		pullsPerPity: PULLS_PER_PITY_COPY,
		stepsPerRound: STEPS_PER_ROUND,
	})

const supportChips = (): CountChipSet =>
	buildCountChips({
		rowType: 'Support',
		stepLimit: Infinity,
		pullsPerPity: PULLS_PER_PITY_COPY,
		stepsPerRound: STEPS_PER_ROUND,
	})

const stepChips = (stepLimit = 10): CountChipSet =>
	buildCountChips({
		rowType: 'StepUp',
		stepLimit,
		pullsPerPity: PULLS_PER_PITY_COPY,
		stepsPerRound: STEPS_PER_ROUND,
	})

/** A chip by its visible label, so a test failure names the button. */
const chip = (set: CountChipSet, label: string) => {
	const found = [...set.deltas, ...set.presets].find((c) => c.label === label)
	if (!found) throw new Error(`no chip labelled "${label}"`)
	return found
}

const labels = (set: CountChipSet): string[] =>
	[...set.deltas, ...set.presets].map((c) => c.label)

describe('buildCountChips — uma rows', () => {
	it('steps by half a pity, with no Max', () => {
		// An uma needs one copy, so nobody plans past the first pity and a ±200
		// would only duplicate "Next pity". Max was cut from pull rows entirely.
		expect(labels(umaChips())).toEqual(['−100', '−10', '+10', '+100', 'Next pity'])
	})

	it('steps past any affordable ceiling rather than clamping', () => {
		// Over-planning is surfaced as a red field, never rewritten — the same
		// contract handlePullCountChange keeps.
		expect(chip(umaChips(), '+100').next(300)).toBe(400)
	})

	it('floors a negative delta at zero', () => {
		expect(chip(umaChips(), '−100').next(10)).toBe(0)
	})

	it('advances Next pity from a value already on a threshold', () => {
		// The `+1` inside toNextMultiple. Landing on 200 again would disable the
		// button (next === current) precisely when someone wants their second copy.
		expect(chip(umaChips(), 'Next pity').next(200)).toBe(400)
		expect(chip(umaChips(), 'Next pity').next(0)).toBe(200)
		expect(chip(umaChips(), 'Next pity').next(150)).toBe(200)
	})

	it('never leaves Next pity spent, at any value', () => {
		const next = chip(umaChips(), 'Next pity').next
		for (const value of [0, 1, 199, 200, 201, 999]) {
			expect(next(value)).toBeGreaterThan(value)
		}
	})
	// The forum's example: 20 already pulled, so the next pity is 180 more.
	it('counts pulls already made toward Next pity', () => {
		const withPrior = (prior: number) =>
			chip(
				buildCountChips({
					rowType: 'Uma',
					stepLimit: Infinity,
					pullsPerPity: PULLS_PER_PITY_COPY,
					stepsPerRound: STEPS_PER_ROUND,
					priorPulls: prior,
				}),
				'Next pity',
			).next
		expect(withPrior(20)(0)).toBe(180)
		expect(withPrior(20)(180)).toBe(380)
		expect(withPrior(250)(0)).toBe(150)
		expect(withPrior(200)(0)).toBe(200)
	})
})

describe('buildCountChips — support rows', () => {
	it('steps by a whole pity, with no ±10 and no Max', () => {
		expect(labels(supportChips())).toEqual(['−200', '+200', 'Next pity'])
	})

	it('moves a whole pity and floors at zero', () => {
		expect(chip(supportChips(), '+200').next(300)).toBe(500)
		expect(chip(supportChips(), '−200').next(10)).toBe(0)
	})
})

describe('buildCountChips — step-up rows', () => {
	it('counts in whole rounds, never single steps or pulls', () => {
		expect(stepChips().deltas.map((c) => c.label)).toEqual(['−5', '+5'])
	})

	it('rounds up to a complete ladder', () => {
		expect(chip(stepChips(), 'Next round').next(0)).toBe(5)
		expect(chip(stepChips(), 'Next round').next(5)).toBe(10)
		expect(chip(stepChips(), 'Next round').next(7)).toBe(10)
	})

	it('jumps Limit to what the banner sells, whatever is affordable', () => {
		// stepLimit is max_steps (banner_count * 5). The builder never sees the
		// affordable ceiling, so two banners is "Limit 10" on any budget.
		expect(chip(stepChips(10), 'Limit 10').next(3)).toBe(10)
		// Spent at the limit: the pad disables a chip whose next() is a no-op.
		expect(chip(stepChips(10), 'Limit 10').next(10)).toBe(10)
	})

	it('drops Limit before a banner is picked rather than offering "Limit Infinity"', () => {
		expect(stepChips(Infinity).presets.map((c) => c.label)).toEqual(['Next round'])
	})
})

describe('the keyboard mirror', () => {
	it('gives Ctrl the same coarse step the pad shows', () => {
		expect(coarsePullDelta('Uma', PULLS_PER_PITY_COPY)).toBe(100)
		expect(coarsePullDelta('Support', PULLS_PER_PITY_COPY)).toBe(200)
		expect(umaChips().hint).toMatch(/Ctrl ±100/)
		expect(supportChips().hint).toMatch(/Ctrl ±200/)
	})

	it('advertises no Ctrl shortcut on a step-up, because NumberField is given no large step', () => {
		expect(coarsePullDelta('StepUp', PULLS_PER_PITY_COPY)).toBeUndefined()
		expect(stepChips().hint).not.toMatch(/Ctrl/)
	})
})

describe('buildCopyChips', () => {
	it('is one copy either way and nothing else', () => {
		const set = buildCopyChips()
		expect(labels(set)).toEqual(['−1', '+1'])
		expect(chip(set, '+1').next(0)).toBe(1)
		expect(chip(set, '−1').next(0)).toBe(0)
	})
})

describe('buildQuantityChips', () => {
	it('is one pack either way plus the purchase limit', () => {
		expect(labels(buildQuantityChips(4))).toEqual(['−1', '+1', 'Max 4'])
		expect(chip(buildQuantityChips(4), 'Max 4').next(0)).toBe(4)
	})

	it('stops +1 at the limit, unlike a pull count', () => {
		// max_quantity is a shop rule, not a budget: there is nothing past it.
		expect(chip(buildQuantityChips(4), '+1').next(3)).toBe(4)
		expect(chip(buildQuantityChips(4), '+1').next(4)).toBe(4)
	})
})

describe('ITEM_CHIPS — tickets, crystals and shards in Current Resources', () => {
	it('steps by one either way, with nothing else on the pad', () => {
		expect(ITEM_CHIPS.deltas.map((chip) => chip.label)).toEqual(['−1', '+1'])
		expect(ITEM_CHIPS.presets).toEqual([])
		expect(ITEM_CHIPS.deltas.map((chip) => chip.next(7))).toEqual([6, 8])
	})

	it('never goes below zero, and has no ceiling', () => {
		expect(ITEM_CHIPS.deltas[0].next(0)).toBe(0)
		expect(ITEM_CHIPS.deltas[1].next(9999)).toBe(10000)
	})
})

