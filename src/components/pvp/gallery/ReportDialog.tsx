/**
 * Report a post or a comment to the moderators. Signed in only (the caller
 * sends a guest to sign in instead). The reporter learns nothing about what
 * happens next; three reports from different people hide the item until a
 * moderator decides (backend gallery_moderation.py).
 */

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { GalleryModal } from "./GalleryModal"
import { galleryReport, refusalText, type GalleryReportTarget } from "../../../services/galleryFetchCalls"
import { GALLERY_REPORT_NOTE_MAX, GALLERY_REPORT_REASONS, type GalleryReportReason } from "../../../types/gallery"

export function ReportDialog({ target, what, onClose }: {
	target: GalleryReportTarget
	/** "team" or "comment", for the copy. */
	what: "team" | "comment"
	onClose: () => void
}) {
	const [reason, setReason] = useState<GalleryReportReason | null>(null)
	const [note, setNote] = useState("")
	const [sending, setSending] = useState(false)

	const send = async () => {
		if (!reason) return
		setSending(true)
		try {
			const response = await galleryReport(target, reason, note.trim())
			if (response.ok) {
				toast.success("Thanks. A moderator will take a look.")
				onClose()
				return
			}
			toast.error(await refusalText(response, "That report didn't go through. Try again in a moment."))
		} catch {
			toast.error("That report didn't go through. Try again in a moment.")
		} finally {
			setSending(false)
		}
	}

	return (
		<GalleryModal title={`Report this ${what}`} onClose={onClose}>
			<form
				className="flex flex-col gap-4"
				onSubmit={(submit) => {
					submit.preventDefault()
					void send()
				}}
			>
				<fieldset className="flex flex-col gap-2">
					<legend className="mb-1 text-sm text-gray-300">What's wrong with it?</legend>
					{GALLERY_REPORT_REASONS.map((option) => (
						<label key={option.id} className="flex cursor-pointer items-center gap-2 text-sm text-gray-100">
							<input
								type="radio"
								name="reason"
								value={option.id}
								checked={reason === option.id}
								onChange={() => setReason(option.id)}
								className="accent-brand"
							/>
							{option.label}
						</label>
					))}
				</fieldset>
				<label className="flex flex-col gap-1 text-sm text-gray-300">
					Anything a moderator should know? (optional)
					<textarea
						value={note}
						maxLength={GALLERY_REPORT_NOTE_MAX}
						onChange={(change) => setNote(change.target.value)}
						rows={2}
						className="rounded border border-gray-600 bg-gray-900 p-2 text-sm text-gray-100 outline-none focus:border-brand"
					/>
				</label>
				<div className="flex justify-end gap-2">
					<button type="button" onClick={onClose} className="rounded-md border border-gray-600 px-3 py-1.5 text-sm text-gray-200 transition hover:bg-gray-700">
						Cancel
					</button>
					<button
						type="submit"
						disabled={!reason || sending}
						className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-black transition hover:bg-brand/85 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{sending && <Loader2 className="h-4 w-4 animate-spin" />}
						Send report
					</button>
				</div>
			</form>
		</GalleryModal>
	)
}
