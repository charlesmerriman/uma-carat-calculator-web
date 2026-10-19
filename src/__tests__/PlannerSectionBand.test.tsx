import { fireEvent, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { PlannerSectionBand } from '../components/carat-calculator/PlannerSectionBand'
import type { PlannerMarker } from '../utils/plannerSections'

/**
 * The band's fill rule: one fill means one date.
 *
 * A band collapses markers by insertion POINT, not by date, so it can hold two
 * lines that are the same moment (a scenario launching the day an anniversary
 * lands) or two that aren't. Alternating per line would split a shared moment
 * across two colours, saying "two dates" where there is one.
 *
 * The assertions compare tones by EQUALITY rather than naming a class, so the
 * palette can be restyled without rewriting the test — what matters is which
 * lines match each other, not which gray they landed on.
 */

function marker(
	key: string,
	kind: PlannerMarker['kind'],
	name: string,
	startDate: string
): PlannerMarker {
	// sourceId only has to be unique enough to build a link from — these tests
	// assert fills and icons, not hrefs.
	return { key, kind, sourceId: 1, name, startDate, bannerTimelineId: null }
}

/** The fill utility on each strip, in visual order. */
function tones(container: HTMLElement): string[] {
	// Strips are the band's direct children; the fill is the only bg-* class on them.
	return Array.from(container.firstElementChild!.children).map((strip) => {
		const fill = Array.from(strip.classList).find((c) => c.startsWith('bg-'))
		return fill ?? ''
	})
}

describe('PlannerSectionBand strip fills', () => {
	it('gives two markers on the same date the same fill', () => {
		const { container } = render(
			<PlannerSectionBand
				markers={[
					marker('scenario-1', 'scenario', 'Mecha', '2028-03-01T00:00:00Z'),
					marker('anniversary-1', 'anniversary', '4th Anniversary', '2028-03-01T00:00:00Z'),
				]}
			/>,
			{ wrapper: MemoryRouter }
		)
		const [first, second] = tones(container)
		expect(first).toBeTruthy()
		expect(second).toBe(first)
	})

	it('alternates the fill when the date changes', () => {
		const { container } = render(
			<PlannerSectionBand
				markers={[
					marker('scenario-1', 'scenario', 'Mecha', '2028-03-01T00:00:00Z'),
					marker('anniversary-1', 'anniversary', '4th Anniversary', '2028-03-08T00:00:00Z'),
				]}
			/>,
			{ wrapper: MemoryRouter }
		)
		const [first, second] = tones(container)
		expect(second).not.toBe(first)
	})

	it('groups by UTC day, not by raw instant', () => {
		// Same calendar day, different times — the band prints a day, so these are
		// one date as far as the reader is concerned.
		const { container } = render(
			<PlannerSectionBand
				markers={[
					marker('scenario-1', 'scenario', 'Mecha', '2028-03-01T00:00:00Z'),
					marker('anniversary-1', 'anniversary', '4th Anniversary', '2028-03-01T15:00:00Z'),
				]}
			/>,
			{ wrapper: MemoryRouter }
		)
		const [first, second] = tones(container)
		expect(second).toBe(first)
	})

	it('runs same-date groups together and alternates between them', () => {
		const { container } = render(
			<PlannerSectionBand
				markers={[
					marker('scenario-1', 'scenario', 'Mecha', '2028-03-01T00:00:00Z'),
					marker('anniversary-1', 'anniversary', '4th Anniversary', '2028-03-01T00:00:00Z'),
					marker('anniversary-2', 'anniversary', 'New Years', '2028-03-08T00:00:00Z'),
				]}
			/>,
			{ wrapper: MemoryRouter }
		)
		const [a, b, c] = tones(container)
		expect(b).toBe(a)
		expect(c).not.toBe(a)
	})

	it('keeps a line\'s fill when the band is unfolded', () => {
		const markers = [
			marker('scenario-1', 'scenario', 'Mecha', '2028-03-01T00:00:00Z'),
			marker('scenario-2', 'scenario', 'Twinkle', '2028-05-01T00:00:00Z'),
			marker('scenario-3', 'scenario', 'Island', '2028-07-01T00:00:00Z'),
			marker('scenario-4', 'scenario', 'Hot Springs', '2028-10-01T00:00:00Z'),
		]
		const { container, getByRole } = render(<PlannerSectionBand markers={markers} />, { wrapper: MemoryRouter })
		const folded = tones(container)[0]
		fireEvent.click(getByRole('button'))
		expect(tones(container)[0]).toBe(folded)
	})

	it('draws no icon on a scenario line and one on an anniversary', () => {
		const { container } = render(
			<PlannerSectionBand
				markers={[
					marker('scenario-1', 'scenario', 'Mecha', '2028-03-01T00:00:00Z'),
					marker('anniversary-1', 'anniversary', '4th Anniversary', '2028-03-08T00:00:00Z'),
				]}
			/>,
			{ wrapper: MemoryRouter }
		)
		const strips = Array.from(container.firstElementChild!.children)
		expect(strips[0].querySelector('svg')).toBeNull()
		expect(strips[1].querySelector('svg')).not.toBeNull()
	})
})

describe('PlannerSectionBand folding', () => {
	const many = [
		marker('scenario-1', 'scenario', 'Grand Masters', '2027-01-01T00:00:00Z'),
		marker('scenario-2', 'scenario', 'Mecha', '2027-03-01T00:00:00Z'),
		marker('scenario-3', 'scenario', 'Twinkle', '2027-05-01T00:00:00Z'),
		marker('scenario-4', 'scenario', 'Island', '2027-07-01T00:00:00Z'),
	]

	it('shows every line when there are three or fewer', () => {
		const { queryByRole, getAllByRole } = render(<PlannerSectionBand markers={many.slice(0, 3)} />, {
			wrapper: MemoryRouter,
		})
		expect(getAllByRole('link')).toHaveLength(3)
		expect(queryByRole('button')).toBeNull()
	})

	it('folds a longer band to its first line and a count of the rest', () => {
		const { getAllByRole, getByRole } = render(<PlannerSectionBand markers={many} />, { wrapper: MemoryRouter })
		expect(getAllByRole('link').map((link) => link.textContent)).toEqual(['Grand Masters'])
		const toggle = getByRole('button', { name: /Show 3 more scenarios/ })
		expect(toggle.getAttribute('aria-expanded')).toBe('false')
	})

	it('opens to every line and closes again', () => {
		const { getAllByRole, getByRole } = render(<PlannerSectionBand markers={many} />, { wrapper: MemoryRouter })
		fireEvent.click(getByRole('button'))
		expect(getAllByRole('link')).toHaveLength(4)
		expect(getByRole('button', { name: /Show fewer/ }).getAttribute('aria-expanded')).toBe('true')
		fireEvent.click(getByRole('button'))
		expect(getAllByRole('link')).toHaveLength(1)
	})

	it('names no kind when the hidden lines are mixed', () => {
		const mixed = [...many.slice(0, 3), marker('anniversary-1', 'anniversary', '3rd Anniversary', '2027-08-01T00:00:00Z')]
		const { getByRole } = render(<PlannerSectionBand markers={mixed} />, { wrapper: MemoryRouter })
		expect(getByRole('button').textContent).toBe('Show 3 more')
	})
})
