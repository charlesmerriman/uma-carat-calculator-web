/**
 * "Post to gallery": the moment a person agrees to show their name, picture
 * and supporter tier beside a team. The dialog says exactly what will show,
 * and the box must be ticked: the API refuses a post without
 * `confirm_public_identity: true` (backend gallery.publish_team).
 *
 * A display name is required. Without one the dialog sends them to the
 * account page to set it, rather than posting a nameless team.
 *
 * Posting again for the same event replaces the earlier post: same link,
 * same comments, upvotes back to zero. The dialog says so when it applies.
 */

import { useState } from "react"
import { Link } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { GalleryModal } from "./GalleryModal"
import { pvpTeamPublish, refusalText } from "../../../services/galleryFetchCalls"
import { GALLERY_CAPTION_MAX, type GalleryPost } from "../../../types/gallery"

export function PublishDialog({ teamId, displayName, replacing, onPosted, onClose }: {
	teamId: number
	/** The account's display name, "" when unset. */
	displayName: string
	/** This event already has the person's post: posting replaces it. */
	replacing: boolean
	onPosted: (post: GalleryPost) => void
	onClose: () => void
}) {
	const [caption, setCaption] = useState("")
	const [agreed, setAgreed] = useState(false)
	const [sending, setSending] = useState(false)

	const send = async () => {
		setSending(true)
		try {
			const response = await pvpTeamPublish(teamId, caption.trim())
			if (response.ok) {
				onPosted((await response.json()) as GalleryPost)
				toast.success(replacing ? "Your post is updated." : "Your team is in the gallery.")
				onClose()
				return
			}
			toast.error(await refusalText(response, "Your team couldn't be posted. Try again in a moment."))
		} catch {
			toast.error("Your team couldn't be posted. Try again in a moment.")
		} finally {
			setSending(false)
		}
	}

	return (
		<GalleryModal title={replacing ? "Update your post" : "Post this team to the gallery"} onClose={onClose}>
			{displayName ? (
				<form
					className="flex flex-col gap-4 text-sm text-gray-300"
					onSubmit={(submit) => {
						submit.preventDefault()
						void send()
					}}
				>
					<p>
						Everyone who opens the gallery will see this team with your display name,{" "}
						<span className="font-semibold text-gray-100">{displayName}</span>, your favourite uma picture and,
						if you support us on Patreon, your tier. You can take it down any time.
					</p>
					{replacing && (
						<p className="rounded-lg border border-gray-600 bg-gray-900/60 p-3">
							You already have a post for this event. This team replaces it: the link and the comments stay,
							and its upvotes go back to zero.
						</p>
					)}
					<label className="flex flex-col gap-1">
						Caption (optional)
						<input
							type="text"
							value={caption}
							maxLength={GALLERY_CAPTION_MAX}
							onChange={(change) => setCaption(change.target.value)}
							placeholder="Runaway blocker and two pace"
							className="rounded border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100 outline-none placeholder:text-gray-500 focus:border-brand"
						/>
						<span className="text-xs text-gray-500">
							{caption.length}/{GALLERY_CAPTION_MAX}. No links.
						</span>
					</label>
					<label className="flex cursor-pointer items-start gap-2 text-gray-100">
						<input
							type="checkbox"
							checked={agreed}
							onChange={(change) => setAgreed(change.target.checked)}
							className="mt-0.5 accent-brand"
						/>
						Show my name, picture and tier with this team
					</label>
					<p className="text-xs text-gray-500">
						You can hide your tier on your{" "}
						<Link to="/account" className="text-brand hover:text-brand/75">
							account page
						</Link>
						. Please keep to the{" "}
						<Link to="/terms" className="text-brand hover:text-brand/75">
							posting rules
						</Link>
						.
					</p>
					<div className="flex justify-end gap-2">
						<button type="button" onClick={onClose} className="rounded-md border border-gray-600 px-3 py-1.5 text-gray-200 transition hover:bg-gray-700">
							Cancel
						</button>
						<button
							type="submit"
							disabled={!agreed || sending}
							className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 font-semibold text-black transition hover:bg-brand/85 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{sending && <Loader2 className="h-4 w-4 animate-spin" />}
							{replacing ? "Update post" : "Post team"}
						</button>
					</div>
				</form>
			) : (
				<div className="flex flex-col gap-4 text-sm text-gray-300">
					<p>A post shows your display name, and you haven't set one yet.</p>
					<div className="flex justify-end gap-2">
						<button type="button" onClick={onClose} className="rounded-md border border-gray-600 px-3 py-1.5 text-gray-200 transition hover:bg-gray-700">
							Not now
						</button>
						<Link to="/account" className="rounded-md bg-brand px-3 py-1.5 font-semibold text-black transition hover:bg-brand/85">
							Set a display name
						</Link>
					</div>
				</div>
			)}
		</GalleryModal>
	)
}
