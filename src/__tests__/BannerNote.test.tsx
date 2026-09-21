import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import {
	BannerNoteButton,
	BannerNoteEditor,
	NOTE_MAX_LENGTH,
} from '../components/carat-calculator/BannerNote'

describe('BannerNoteEditor', () => {
	it('commits once, on blur, never per keystroke', async () => {
		// The reason the draft is local: each commit reaches the plan, and every
		// plan change schedules an auto-save of the whole row list.
		const onCommit = vi.fn()
		render(<BannerNoteEditor note="" bannerName="Kitasan Black" onCommit={onCommit} />)

		const field = screen.getByLabelText('Note for Kitasan Black')
		await userEvent.type(field, 'save for the rerun')
		expect(onCommit).not.toHaveBeenCalled()

		await userEvent.tab()
		expect(onCommit).toHaveBeenCalledTimes(1)
		expect(onCommit).toHaveBeenCalledWith('save for the rerun')
	})

	it('trims what it commits, matching what the server stores', async () => {
		const onCommit = vi.fn()
		render(<BannerNoteEditor note="" bannerName="x" onCommit={onCommit} />)

		await userEvent.type(screen.getByLabelText('Note for x'), '  padded  ')
		await userEvent.tab()
		expect(onCommit).toHaveBeenCalledWith('padded')
	})

	it('does not commit when nothing changed', async () => {
		const onCommit = vi.fn()
		render(<BannerNoteEditor note="as saved" bannerName="x" onCommit={onCommit} />)

		await userEvent.click(screen.getByLabelText('Note for x'))
		await userEvent.tab()
		expect(onCommit).not.toHaveBeenCalled()
	})

	it('picks up a note that changed underneath it', () => {
		const { rerender } = render(
			<BannerNoteEditor note="first" bannerName="x" onCommit={vi.fn()} />
		)
		rerender(<BannerNoteEditor note="second" bannerName="x" onCommit={vi.fn()} />)
		expect(screen.getByLabelText('Note for x')).toHaveValue('second')
	})

	it('cannot hold more than the cap, and only counts near it', () => {
		const { rerender } = render(
			<BannerNoteEditor note="short" bannerName="x" onCommit={vi.fn()} />
		)
		expect(screen.getByLabelText('Note for x')).toHaveAttribute(
			'maxlength', String(NOTE_MAX_LENGTH)
		)
		expect(screen.queryByText(/\/500$/)).toBeNull()

		rerender(
			<BannerNoteEditor note={'x'.repeat(450)} bannerName="x" onCommit={vi.fn()} />
		)
		expect(screen.getByText('450/500')).toBeInTheDocument()
	})
})

describe('BannerNoteButton', () => {
	it('says whether the row has a note, and shows it on hover', () => {
		const { rerender } = render(
			<BannerNoteButton note="" open={false} onToggle={vi.fn()} className="" />
		)
		expect(screen.getByRole('button', { name: 'Add a note' })).toBeInTheDocument()

		rerender(
			<BannerNoteButton note="rerun bait" open onToggle={vi.fn()} className="" />
		)
		const button = screen.getByRole('button', { name: 'Edit note' })
		expect(button).toHaveAttribute('title', 'rerun bait')
		expect(button).toHaveAttribute('aria-expanded', 'true')
	})
})
