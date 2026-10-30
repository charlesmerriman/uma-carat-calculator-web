/**
 * "Post to gallery": the moment a person agrees to show their name, picture
 * and supporter tier beside a team. The dialog says exactly what will show,
 * and the box must be ticked: the API refuses a post without
 * `confirm_public_identity: true` (backend gallery.publish_team).
 *
 * A display name is required. Without one the dialog sends them to the
 * account page to set it, rather than posting a nameless team.
 *
 * Two texts, both optional: the caption (one line, on the feed's row) and
 * the strategy (up to 2,000 characters, only on the open post).
 *
 * Posting again for the same event replaces the earlier post: same link,
 * same comments. Upvotes go back to zero if the team changed and stay if
 * only the words did (backend gallery.publish_team). The dialog says so when
 * it applies. Re-posting the team that is already up starts from its current
 * words, waiting for them to load, so updating the cards can't wipe a long
 * strategy by accident.
 *
 * A refusal (a blocked word in the caption, say) shows inside the dialog,
 * next to what caused it: toasts sit below a modal dialog (GalleryModal).
 * When the API names the box (`field`), that box is marked too.
 * The post goes into the gallery's cache, and the feeds are refetched
 * (rememberPublished), so the Gallery tab shows it without a reload.
 */

import { useId, useState } from "react"
import { Link } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { GalleryModal } from "./GalleryModal"
import { FIELD, PRIMARY_BUTTON, SECONDARY_BUTTON } from "./galleryStyles"
import { pvpTeamPublish, refusal } from "../../../services/galleryFetchCalls"
import { rememberPublished, useGalleryPost } from "../../../services/galleryQueries"
import { GALLERY_CAPTION_MAX, GALLERY_STRATEGY_MAX, type GalleryPost } from "../../../types/gallery"

const FAILED = "Your team couldn't be posted. Try again in a moment."

interface PublishProps {
	teamId: number
	/** The account's display name, "" when unset. */
	displayName: string
	/** This event already has the person's post: posting replaces it. */
	replacing: boolean
	onPosted: (post: GalleryPost) => void
	onClose: () => void
}

export function PublishDialog({ ownPost = null, ...props }: PublishProps & {
	/** This team's own post, when it is the one that's up: the form starts from its words. */
	ownPost?: string | null
}) {
	const existing = useGalleryPost(ownPost)
	// A disabled query also reads as pending, hence the ownPost check. A post
	// that doesn't load (taken down meanwhile) just means blank boxes.
	const loading = ownPost !== null && existing.isPending
	const { displayName, replacing, onClose } = props

	return (
		<GalleryModal title={replacing ? "Update your post" : "Post this team to the gallery"} onClose={onClose}>
			{!displayName ? (
				<div className="flex flex-col gap-4 text-sm text-gray-300">
					<p>A post shows your display name, and you haven't set one yet.</p>
					<div className="flex justify-end gap-2">
						<button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
							Not now
						</button>
						<Link to="/account" className={PRIMARY_BUTTON}>
							Set a display name
						</Link>
					</div>
				</div>
			) : loading ? (
				<div className="flex items-center justify-center gap-2 p-6 text-sm text-gray-400" role="status">
					<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
					Loading your post…
				</div>
			) : (
				<PublishForm {...props} initial={existing.data} />
			)}
		</GalleryModal>
	)
}

function PublishForm({ teamId, displayName, replacing, onPosted, onClose, initial }: PublishProps & {
	/** The post being updated, when it is this team's: its words fill the boxes. */
	initial: GalleryPost | undefined
}) {
	const [caption, setCaption] = useState(initial?.caption ?? "")
	const [strategy, setStrategy] = useState(initial?.strategy ?? "")
	const [agreed, setAgreed] = useState(false)
	const [sending, setSending] = useState(false)
	const [error, setError] = useState<{ text: string; field: string | null } | null>(null)
	const errorId = useId()
	const queryClient = useQueryClient()

	/** Marks the box a refusal named, and points it at the message. */
	const faultProps = (field: string) =>
		error?.field === field ? { "aria-invalid": true, "aria-describedby": errorId } : {}

	const send = async () => {
		setSending(true)
		setError(null)
		try {
			const response = await pvpTeamPublish(teamId, caption.trim(), strategy.trim())
			if (response.ok) {
				const post = (await response.json()) as GalleryPost
				rememberPublished(queryClient, post)
				onPosted(post)
				onClose()
				// After the close, so it is not hidden under the dialog.
				toast.success(replacing ? "Your post is updated." : "Your team is in the gallery.")
				return
			}
			setError(await refusal(response, FAILED))
		} catch {
			setError({ text: FAILED, field: null })
		} finally {
			setSending(false)
		}
	}

	return (
		<form
			className="flex flex-col gap-4 text-sm text-gray-300"
			onSubmit={(submit) => {
				submit.preventDefault()
				void send()
			}}
		>
			<p>
				Everyone who opens the gallery will see this team with your display name,{" "}
				<span className="font-semibold text-gray-100">{displayName}</span>, your favorite uma picture and,
				if you support us on Patreon, your tier. Your name opens your profile card, with your favorites
				and other teams. You can take it down any time.
			</p>
			{replacing && (
				<p className="rounded-lg border border-gray-600 bg-gray-900/60 p-3">
					You already have a post for this event, and this replaces it. The link and comments stay.
					Upvotes reset if the team changed, and stay if you only changed the words.
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
					className={`${FIELD} aria-invalid:border-highlight`}
					{...faultProps("caption")}
				/>
				<span className="text-xs text-gray-500">
					{caption.length}/{GALLERY_CAPTION_MAX}. Shows in the gallery list. No links.
				</span>
			</label>
			<label className="flex flex-col gap-1">
				Strategy (optional)
				<textarea
					value={strategy}
					maxLength={GALLERY_STRATEGY_MAX}
					rows={6}
					onChange={(change) => setStrategy(change.target.value)}
					placeholder="Why these three, what each deck is for, how it did in your rounds"
					className={`${FIELD} resize-y aria-invalid:border-highlight`}
					{...faultProps("strategy")}
				/>
				<span className="text-xs text-gray-500">
					{strategy.length}/{GALLERY_STRATEGY_MAX}. Shows when someone opens your team. No links.
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
			{error && (
				<p id={errorId} className="rounded-lg border border-highlight/50 bg-highlight/10 p-3 text-gray-100" role="alert">
					{error.text}
				</p>
			)}
			<div className="flex justify-end gap-2">
				<button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
					Cancel
				</button>
				<button type="submit" disabled={!agreed || sending} className={PRIMARY_BUTTON}>
					{sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
					{replacing ? "Update post" : "Post team"}
				</button>
			</div>
		</form>
	)
}
