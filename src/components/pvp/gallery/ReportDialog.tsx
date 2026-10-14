/**
 * Report a post or a comment to the moderators. Signed in only (the caller
 * sends a guest to sign in instead). The reporter learns nothing about what
 * happens next; three reports from different people hide the item until a
 * moderator decides (backend gallery_moderation.py).
 *
 * A refusal (a repeat report, say) shows inside the dialog: toasts sit below
 * a modal dialog's top layer (GalleryModal).
 */

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { GalleryModal } from "./GalleryModal"
import { FIELD, PRIMARY_BUTTON, SECONDARY_BUTTON } from "./galleryStyles"
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
	const [error, setError] = useState<string | null>(null)

	const send = async () => {
		if (!reason) return
		setSending(true)
		setError(null)
		try {
			const response = await galleryReport(target, reason, note.trim())
			if (response.ok) {
				onClose()
				// After the close, so it is not hidden under the dialog.
				toast.success("Thanks. A moderator will take a look.")
				return
			}
			setError(await refusalText(response, "That report didn't go through. Try again in a moment."))
		} catch {
			setError("That report didn't go through. Try again in a moment.")
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
						className={FIELD}
					/>
				</label>
				{error && (
					<p className="rounded-lg border border-highlight/50 bg-highlight/10 p-3 text-sm text-gray-100" role="alert">
						{error}
					</p>
				)}
				<div className="flex justify-end gap-2">
					<button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
						Cancel
					</button>
					<button type="submit" disabled={!reason || sending} className={PRIMARY_BUTTON}>
						{sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
						Send report
					</button>
				</div>
			</form>
		</GalleryModal>
	)
}
