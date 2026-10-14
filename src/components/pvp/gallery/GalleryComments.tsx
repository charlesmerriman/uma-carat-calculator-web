/**
 * A post's comments: the thread, oldest first, one level of replies, and the
 * box to add one. Reading needs nothing; writing needs an account with a
 * display name (the box says what will show, the way the post dialog does).
 *
 * Plain text only. Line breaks are kept and nothing is turned into a link:
 * the API refuses links outright (gallery_moderation.py), and drawing one
 * would undo that.
 */

import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Flag, Loader2, Pencil, Reply, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Avatar } from "../../account/Avatar"
import { PosterLine } from "./GalleryBits"
import { ReportDialog } from "./ReportDialog"
import {
	galleryCommentCreate,
	galleryCommentDelete,
	galleryCommentEdit,
	galleryCommentsFetch,
	refusalText,
} from "../../../services/galleryFetchCalls"
import { formatDate } from "../../../utils/dateFormat"
import { GALLERY_COMMENT_MAX, type GalleryComment, type GalleryThread } from "../../../types/gallery"

const SMALL_BUTTON =
	"flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-400 transition hover:bg-gray-700 hover:text-gray-100"

export function GalleryComments({ publicId, signedIn, displayName, onCountChange }: {
	publicId: string
	signedIn: boolean
	/** The account's display name, "" when unset. */
	displayName: string
	/** The visible count changed (a comment added or deleted). */
	onCountChange: (delta: number) => void
}) {
	const [thread, setThread] = useState<GalleryComment[] | null>(null)
	const [failed, setFailed] = useState(false)
	const [page, setPage] = useState(1)
	const [hasMore, setHasMore] = useState(false)
	const [replyTo, setReplyTo] = useState<number | null>(null)
	const [reporting, setReporting] = useState<number | null>(null)

	const load = useCallback(
		async (pageToLoad: number) => {
			try {
				const response = await galleryCommentsFetch(publicId, pageToLoad)
				if (!response.ok) throw new Error(String(response.status))
				const body = (await response.json()) as GalleryThread
				setThread((current) => (pageToLoad === 1 ? body.results : [...(current ?? []), ...body.results]))
				setHasMore(body.has_more)
				setPage(pageToLoad)
			} catch {
				setFailed(true)
			}
		},
		[publicId]
	)

	useEffect(() => {
		void load(1)
	}, [load])

	const added = (comment: GalleryComment, parent: number | null) => {
		setThread((current) => {
			if (!current) return [comment]
			if (parent === null) return [...current, comment]
			return current.map((top) =>
				top.id === parent || top.replies.some((reply) => reply.id === parent)
					? { ...top, replies: [...top.replies, comment] }
					: top
			)
		})
		setReplyTo(null)
		onCountChange(1)
	}

	const replaced = (updated: GalleryComment) =>
		setThread((current) =>
			(current ?? []).map((top) =>
				top.id === updated.id
					? { ...top, ...updated, replies: top.replies }
					: { ...top, replies: top.replies.map((reply) => (reply.id === updated.id ? updated : reply)) }
			)
		)

	const removed = async (comment: GalleryComment) => {
		const response = await galleryCommentDelete(comment.id).catch(() => null)
		if (!response?.ok) {
			toast.error("That comment couldn't be deleted. Try again in a moment.")
			return
		}
		// Reload rather than guess: a comment with replies stays as "[deleted]".
		onCountChange(-1)
		void load(1)
	}

	return (
		<section aria-label="Comments" className="flex flex-col gap-3">
			<h3 className="text-sm font-semibold text-gray-100">Comments</h3>
			{signedIn ? (
				displayName ? (
					<CommentBox publicId={publicId} onAdded={(comment) => added(comment, null)} />
				) : (
					<p className="text-sm text-gray-400">
						<Link to="/account" className="text-brand hover:text-brand/75">
							Set a display name
						</Link>{" "}
						to comment.
					</p>
				)
			) : (
				<p className="text-sm text-gray-400">
					<Link to="/login" className="text-brand hover:text-brand/75">
						Sign in
					</Link>{" "}
					to comment.
				</p>
			)}

			{failed ? (
				<p className="text-sm text-gray-400">The comments didn't load. Try again in a moment.</p>
			) : thread === null ? (
				<p className="flex items-center gap-2 text-sm text-gray-400" role="status">
					<Loader2 className="h-4 w-4 animate-spin" />
					Loading comments…
				</p>
			) : thread.length === 0 ? (
				<p className="text-sm text-gray-400">No comments yet.</p>
			) : (
				<ol className="flex flex-col gap-3">
					{thread.map((comment) => (
						<li key={comment.id} className="flex flex-col gap-2">
							<CommentItem
								comment={comment}
								signedIn={signedIn}
								onReply={() => setReplyTo(comment.id)}
								onReport={() => setReporting(comment.id)}
								onEdited={replaced}
								onDelete={() => void removed(comment)}
							/>
							{(comment.replies.length > 0 || replyTo === comment.id) && (
								<ol className="ml-6 flex flex-col gap-2 border-l border-gray-700 pl-3">
									{comment.replies.map((reply) => (
										<li key={reply.id}>
											<CommentItem
												comment={reply}
												signedIn={signedIn}
												onReply={() => setReplyTo(comment.id)}
												onReport={() => setReporting(reply.id)}
												onEdited={replaced}
												onDelete={() => void removed(reply)}
											/>
										</li>
									))}
									{replyTo === comment.id && displayName && (
										<li>
											<CommentBox
												publicId={publicId}
												parent={comment.id}
												autoFocus
												onAdded={(reply) => added(reply, comment.id)}
												onCancel={() => setReplyTo(null)}
											/>
										</li>
									)}
								</ol>
							)}
						</li>
					))}
				</ol>
			)}
			{hasMore && (
				<button type="button" onClick={() => void load(page + 1)} className="self-start text-sm text-brand hover:text-brand/75">
					More comments
				</button>
			)}
			{reporting !== null && (
				<ReportDialog target={{ comment: reporting }} what="comment" onClose={() => setReporting(null)} />
			)}
		</section>
	)
}

function CommentItem({ comment, signedIn, onReply, onReport, onEdited, onDelete }: {
	comment: GalleryComment
	signedIn: boolean
	onReply: () => void
	onReport: () => void
	onEdited: (comment: GalleryComment) => void
	onDelete: () => void
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

	const meta = (
		<span className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
			{comment.is_author && <span className="rounded bg-brand/15 px-1.5 py-0.5 font-semibold text-brand">Author</span>}
			{formatDate(comment.created_at)}
			{comment.edited && <span>(edited)</span>}
		</span>
	)

	return (
		<div className="flex flex-col gap-1">
			<PosterLine poster={comment.poster} extra={meta} />
			{comment.earlier_version && (
				<p className="text-xs text-gray-500">On an earlier version of this team</p>
			)}
			{comment.state === "under_review" && (
				<p className="text-xs text-highlight">Hidden while we review it. Only you can see it.</p>
			)}
			{editing ? (
				<CommentBox
					initial={comment.body}
					commentId={comment.id}
					autoFocus
					onAdded={(updated) => {
						onEdited(updated)
						setEditing(false)
					}}
					onCancel={() => setEditing(false)}
				/>
			) : (
				<p className="whitespace-pre-line break-words text-sm text-gray-200">{comment.body}</p>
			)}
			{!editing && (
				<div className="flex flex-wrap items-center gap-1">
					{signedIn && (
						<button type="button" className={SMALL_BUTTON} onClick={onReply}>
							<Reply className="h-3.5 w-3.5" aria-hidden="true" />
							Reply
						</button>
					)}
					{comment.is_mine ? (
						confirmDelete ? (
							<span className="flex items-center gap-1 text-xs text-gray-300">
								Delete it?
								<button type="button" className={`${SMALL_BUTTON} text-highlight`} onClick={onDelete}>
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
 * The text box, for a new comment, a reply (`parent`) or an edit
 * (`commentId`). Says what will show beside the comment, once, under a new
 * top-level box.
 */
function CommentBox({ publicId, parent, commentId, initial = "", autoFocus = false, onAdded, onCancel }: {
	publicId?: string
	parent?: number
	commentId?: number
	initial?: string
	autoFocus?: boolean
	onAdded: (comment: GalleryComment) => void
	onCancel?: () => void
}) {
	const [body, setBody] = useState(initial)
	const [sending, setSending] = useState(false)
	const editing = commentId !== undefined

	const send = async () => {
		const text = body.trim()
		if (!text) return
		setSending(true)
		try {
			const response = editing
				? await galleryCommentEdit(commentId, text)
				: await galleryCommentCreate(publicId ?? "", text, parent)
			if (response.ok) {
				onAdded((await response.json()) as GalleryComment)
				setBody("")
				return
			}
			toast.error(await refusalText(response, "Your comment couldn't be posted. Try again in a moment."))
		} catch {
			toast.error("Your comment couldn't be posted. Try again in a moment.")
		} finally {
			setSending(false)
		}
	}

	return (
		<form
			className="flex flex-col gap-1.5"
			onSubmit={(submit) => {
				submit.preventDefault()
				void send()
			}}
		>
			<textarea
				aria-label={editing ? "Edit your comment" : parent ? "Your reply" : "Your comment"}
				value={body}
				autoFocus={autoFocus}
				maxLength={GALLERY_COMMENT_MAX}
				rows={editing || parent ? 2 : 3}
				onChange={(change) => setBody(change.target.value)}
				placeholder={parent ? "Write a reply" : "Leave some feedback on this team"}
				className="rounded border border-gray-600 bg-gray-900 p-2 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-brand"
			/>
			<div className="flex flex-wrap items-center gap-2">
				{!editing && !parent && (
					<span className="text-xs text-gray-500">Your display name and favourite uma picture show with your comment.</span>
				)}
				<span className="ml-auto text-xs tabular-nums text-gray-500">
					{body.length}/{GALLERY_COMMENT_MAX}
				</span>
				{onCancel && (
					<button type="button" onClick={onCancel} className="rounded-md border border-gray-600 px-2.5 py-1 text-xs text-gray-200 transition hover:bg-gray-700">
						Cancel
					</button>
				)}
				<button
					type="submit"
					disabled={!body.trim() || sending}
					className="flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-black transition hover:bg-brand/85 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
					{editing ? "Save" : parent ? "Reply" : "Comment"}
				</button>
			</div>
		</form>
	)
}
