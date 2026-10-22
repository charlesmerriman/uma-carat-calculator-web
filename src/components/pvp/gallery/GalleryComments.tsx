/**
 * A comment thread: the thread, oldest first, one level of replies, and the
 * box to add one. Reading needs nothing; writing needs an account with a
 * display name, and until then the thread says which one is missing instead
 * of offering a Reply that cannot work.
 *
 * Whose thread is the `source`'s business (services/galleryQueries.ts): a
 * gallery post's (postThread) or one section of a PvP guide's (guideThread,
 * services/guideComments.ts). The thread is cached per source: a new comment
 * or an edit goes straight in from the server's answer, and a delete reloads
 * the pages already open, never just the first.
 *
 * Every comment shows its thumbs-up count; a signed-in reader can give one to
 * anyone's comment but their own (Henry, 2026-10-20). Who gave them is never
 * shown, and never sent.
 *
 * Plain text only. Line breaks are kept and nothing is turned into a link:
 * the API refuses links outright (gallery_moderation.py), and drawing one
 * would undo that. A refusal shows under the box it is about.
 */

import { useState } from "react"
import { Link } from "react-router-dom"
import { Flag, Loader2, Pencil, Reply, ThumbsUp, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Avatar } from "../../account/Avatar"
import { PosterLine, YouChip } from "./GalleryBits"
import { ReportDialog } from "./ReportDialog"
import { DANGER_BUTTON_SMALL, FIELD, PRIMARY_BUTTON_SMALL, SECONDARY_BUTTON, SECONDARY_BUTTON_SMALL, SMALL_BUTTON } from "./galleryStyles"
import { useAccount } from "../../../services/AuthContext"
import {
	failureText,
	useCommentWrites,
	useGalleryComments,
	type CommentThreadSource,
} from "../../../services/galleryQueries"
import { useSignInPrompt } from "../../../hooks/useSignInPrompt"
import { formatDate } from "../../../utils/dateFormat"
import { formatTimeAgo } from "../../../utils/relativeDate"
import { GALLERY_COMMENT_MAX, type GalleryComment } from "../../../types/gallery"

type Writes = ReturnType<typeof useCommentWrites>

/**
 * `placeholder` is the new-comment box's prompt, which says what the thread
 * is for; `heading` is false where the caller already titles the section.
 */
export function GalleryComments({
	source,
	placeholder = "Leave some feedback on this team",
	heading = true,
}: {
	source: CommentThreadSource
	placeholder?: string
	heading?: boolean
}) {
	const { isLoggedIn, account } = useAccount()
	const { signInState } = useSignInPrompt()
	const thread = useGalleryComments(source)
	const writes = useCommentWrites(source)
	const [replyTo, setReplyTo] = useState<number | null>(null)
	const [reporting, setReporting] = useState<number | null>(null)
	const canWrite = isLoggedIn && Boolean(account?.display_name)
	const comments = thread.data?.pages.flatMap((page) => page.results) ?? []

	return (
		<section aria-label="Comments" className="flex min-w-0 flex-col gap-3">
			{heading && <h3 className="text-sm font-semibold text-gray-100">Comments</h3>}
			{canWrite ? (
				<CommentBox writes={writes} placeholder={placeholder} />
			) : isLoggedIn ? (
				<p className="text-sm text-gray-400">
					<Link to="/account" className="text-brand hover:text-brand/75">
						Set a display name
					</Link>{" "}
					to comment.
				</p>
			) : (
				<p className="text-sm text-gray-400">
					<Link to="/login" state={signInState} className="text-brand hover:text-brand/75">
						Sign in
					</Link>{" "}
					to comment.
				</p>
			)}

			{thread.isPending ? (
				<p className="flex items-center gap-2 text-sm text-gray-400" role="status">
					<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
					Loading comments…
				</p>
			) : thread.isError && comments.length === 0 ? (
				<div className="flex flex-col items-start gap-2 text-sm text-gray-400" role="alert">
					The comments didn't load.
					<button type="button" onClick={() => void thread.refetch()} className={SECONDARY_BUTTON}>
						Try again
					</button>
				</div>
			) : comments.length === 0 ? (
				<p className="text-sm text-gray-400">No comments yet.</p>
			) : (
				<ol className="flex flex-col gap-4">
					{comments.map((comment) => (
						<li key={comment.id} className="flex flex-col gap-2">
							<CommentItem
								comment={comment}
								canWrite={canWrite}
								signedIn={isLoggedIn}
								writes={writes}
								onReply={() => setReplyTo(comment.id)}
								onReport={() => setReporting(comment.id)}
							/>
							{(comment.replies.length > 0 || replyTo === comment.id) && (
								<ol className="ml-4 flex flex-col gap-3 border-l border-gray-700 pl-3">
									{comment.replies.map((reply) => (
										<li key={reply.id}>
											<CommentItem
												comment={reply}
												canWrite={canWrite}
												signedIn={isLoggedIn}
												writes={writes}
												onReply={() => setReplyTo(comment.id)}
												onReport={() => setReporting(reply.id)}
											/>
										</li>
									))}
									{replyTo === comment.id && (
										<li>
											<CommentBox writes={writes} parent={comment.id} onDone={() => setReplyTo(null)} />
										</li>
									)}
								</ol>
							)}
						</li>
					))}
				</ol>
			)}
			{thread.hasNextPage && (
				<div className="flex flex-wrap items-center gap-2">
					<button
						type="button"
						disabled={thread.isFetchingNextPage}
						onClick={() => void thread.fetchNextPage()}
						className="flex items-center gap-1.5 text-sm text-brand hover:text-brand/75 disabled:opacity-50"
					>
						{thread.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
						More comments
					</button>
					{thread.isFetchNextPageError && <span className="text-xs text-highlight">Those didn't load. Try again.</span>}
				</div>
			)}
			{reporting !== null && (
				<ReportDialog target={{ comment: reporting }} what="comment" onClose={() => setReporting(null)} />
			)}
		</section>
	)
}

function CommentItem({ comment, canWrite, signedIn, writes, onReply, onReport }: {
	comment: GalleryComment
	/** Signed in with a display name: may reply. */
	canWrite: boolean
	signedIn: boolean
	writes: Writes
	onReply: () => void
	onReport: () => void
}) {
	const [editing, setEditing] = useState(false)
	const [confirmDelete, setConfirmDelete] = useState(false)

	if (comment.state === "deleted" || comment.state === "removed" || !comment.poster) {
		return (
			<div className="flex items-center gap-2 text-sm italic text-gray-500">
				<Avatar src={null} size="sm" />
				{comment.state === "removed" ? "[removed]" : "[deleted]"}
			</div>
		)
	}

	const remove = () =>
		writes.remove.mutate(comment.id, {
			onError: (error) => toast.error(failureText(error, "That comment couldn't be deleted. Try again in a moment.")),
		})

	const meta = (
		<span className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
			{comment.is_author && <span className="rounded bg-brand/15 px-1.5 py-0.5 font-semibold text-brand">Author</span>}
			{comment.is_mine && !comment.is_author && <YouChip />}
			<time dateTime={comment.created_at} title={formatDate(comment.created_at)}>
				{formatTimeAgo(comment.created_at)}
			</time>
			{comment.edited && <span>(edited)</span>}
		</span>
	)

	return (
		<div className="flex flex-col gap-1">
			<PosterLine poster={comment.poster} mine={comment.is_mine} extra={meta} />
			{comment.earlier_version && (
				<p className="text-xs text-gray-500">On an earlier version of this team</p>
			)}
			{comment.state === "under_review" && (
				<p className="text-xs text-highlight">Hidden while we review it. Only you can see it.</p>
			)}
			{editing ? (
				<CommentBox writes={writes} editing={comment} onDone={() => setEditing(false)} />
			) : (
				<p className="whitespace-pre-line break-words text-sm text-gray-200">{comment.body}</p>
			)}
			{!editing && (
				<div className="flex flex-wrap items-center gap-1">
					<ThumbsUpButton comment={comment} signedIn={signedIn} writes={writes} />
					{canWrite && (
						<button type="button" className={SMALL_BUTTON} onClick={onReply}>
							<Reply className="h-3.5 w-3.5" aria-hidden="true" />
							Reply
						</button>
					)}
					{comment.is_mine ? (
						confirmDelete ? (
							<span className="flex items-center gap-1 text-xs text-gray-300">
								Delete it?
								<button type="button" className={DANGER_BUTTON_SMALL} disabled={writes.remove.isPending} onClick={remove}>
									Delete
								</button>
								<button type="button" className={SMALL_BUTTON} onClick={() => setConfirmDelete(false)}>
									Keep
								</button>
							</span>
						) : (
							<>
								<button type="button" className={SMALL_BUTTON} onClick={() => setEditing(true)}>
									<Pencil className="h-3.5 w-3.5" aria-hidden="true" />
									Edit
								</button>
								<button type="button" className={SMALL_BUTTON} onClick={() => setConfirmDelete(true)}>
									<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
									Delete
								</button>
							</>
						)
					) : (
						signedIn && (
							<button type="button" className={SMALL_BUTTON} onClick={onReport}>
								<Flag className="h-3.5 w-3.5" aria-hidden="true" />
								Report
							</button>
						)
					)}
				</div>
			)}
		</div>
	)
}

/**
 * A comment's thumbs-up: the count, pressed when you gave one. Just the count
 * on your own comment and for a guest, who has nothing to press.
 */
function ThumbsUpButton({ comment, signedIn, writes }: { comment: GalleryComment; signedIn: boolean; writes: Writes }) {
	const count = comment.upvotes
	const label = `${count} thumbs-up`
	if (!signedIn || comment.is_mine) {
		if (count === 0) return null
		return (
			<span className="flex items-center gap-1 px-1.5 text-xs tabular-nums text-gray-400" aria-label={label} title={label}>
				<ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
				{count}
			</span>
		)
	}
	return (
		<button
			type="button"
			className={`${SMALL_BUTTON} tabular-nums ${comment.my_vote ? "text-brand" : ""}`}
			aria-pressed={comment.my_vote}
			aria-label={comment.my_vote ? `Take back your thumbs-up (${count})` : `Give a thumbs-up (${count})`}
			onClick={() =>
				writes.vote.mutate(
					{ id: comment.id, on: !comment.my_vote },
					{ onError: (error) => toast.error(failureText(error, "That didn't go through. Try again in a moment.")) }
				)
			}
		>
			<ThumbsUp className={`h-3.5 w-3.5 ${comment.my_vote ? "fill-current" : ""}`} aria-hidden="true" />
			{count > 0 && count}
		</button>
	)
}

/**
 * The text box, for a new comment, a reply (`parent`) or an edit
 * (`editing`). Says what will show beside the comment, once, under a new
 * top-level box. `onDone` closes a reply or an edit once it is saved, or
 * when cancelled.
 */
function CommentBox({ writes, parent, editing, onDone, placeholder }: {
	writes: Writes
	parent?: number
	editing?: GalleryComment
	onDone?: () => void
	placeholder?: string
}) {
	const [body, setBody] = useState(editing?.body ?? "")
	const [error, setError] = useState<string | null>(null)
	const mutation = editing ? writes.edit : writes.create
	const sending = mutation.isPending

	const send = () => {
		const text = body.trim()
		if (!text) return
		setError(null)
		const settled = {
			onSuccess: () => {
				setBody("")
				onDone?.()
			},
			onError: (failure: unknown) =>
				setError(failureText(failure, "Your comment couldn't be posted. Try again in a moment.")),
		}
		if (editing) writes.edit.mutate({ id: editing.id, body: text }, settled)
		else writes.create.mutate({ body: text, parent: parent ?? null }, settled)
	}

	return (
		<form
			className="flex flex-col gap-1.5"
			onSubmit={(submit) => {
				submit.preventDefault()
				send()
			}}
		>
			<textarea
				aria-label={editing ? "Edit your comment" : parent ? "Your reply" : "Your comment"}
				value={body}
				autoFocus={Boolean(editing || parent)}
				maxLength={GALLERY_COMMENT_MAX}
				rows={editing || parent ? 2 : 3}
				onChange={(change) => setBody(change.target.value)}
				placeholder={parent || editing ? "Write a reply" : placeholder}
				aria-invalid={error !== null}
				className={FIELD}
			/>
			{error && (
				<p className="text-xs text-highlight" role="alert">
					{error}
				</p>
			)}
			<div className="flex flex-wrap items-center gap-2">
				{!editing && !parent && (
					<span className="text-xs text-gray-500">Your display name and favorite uma picture show with your comment.</span>
				)}
				<span className="ml-auto text-xs tabular-nums text-gray-500">
					{body.length}/{GALLERY_COMMENT_MAX}
				</span>
				{onDone && (
					<button type="button" onClick={onDone} className={SECONDARY_BUTTON_SMALL}>
						Cancel
					</button>
				)}
				<button type="submit" disabled={!body.trim() || sending} className={PRIMARY_BUTTON_SMALL}>
					{sending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
					{editing ? "Save" : parent ? "Reply" : "Comment"}
				</button>
			</div>
		</form>
	)
}
