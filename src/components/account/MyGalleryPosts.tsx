/**
 * The account page's "Your gallery posts": every team the person has posted,
 * with its umas, its numbers, whether it is live or waiting for a moderator,
 * and the ways to open, share or take it down.
 *
 * Read from the gallery's query cache (services/galleryQueries.ts), so a vote
 * or a take-down made on the PvP page in this tab is already reflected. The
 * account page renders only for a signed-in person. Event names come with
 * each post, because the account page is outside /app and has no event list;
 * the uma pictures come from the small /umas list for the same reason.
 */

import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowBigUp, Copy, Eye, Link2, Loader2, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import { UmaPortrait } from "../pvp/gallery/GalleryBits"
import { ACTION_BUTTON, DANGER_BUTTON, SECONDARY_BUTTON } from "../pvp/gallery/galleryStyles"
import { galleryShareUrl } from "../../services/galleryFetchCalls"
import { failureText, useMyGalleryPosts, useTakeDownPost } from "../../services/galleryQueries"
import { useUmaPictures } from "../../hooks/useUmaPictures"
import { formatDate } from "../../utils/dateFormat"
import { formatTimeAgo } from "../../utils/relativeDate"
import { countLabel } from "../../utils/plural"
import { STYLE_LABELS } from "../../utils/pvpGuide"

export function MyGalleryPosts({ className, titleClassName }: { className: string; titleClassName: string }) {
	const posts = useMyGalleryPosts()
	const pictures = useUmaPictures((posts.data?.length ?? 0) > 0)
	const takeDown = useTakeDownPost()
	const [confirming, setConfirming] = useState<string | null>(null)

	const remove = (publicId: string) =>
		takeDown.mutate(publicId, {
			onSuccess: () => {
				setConfirming(null)
				toast.success("Your post is down.")
			},
			onError: (error) => toast.error(failureText(error, "Your post couldn't be taken down. Try again in a moment.")),
		})

	const share = async (publicId: string) => {
		const url = galleryShareUrl(publicId)
		try {
			await navigator.clipboard.writeText(url)
			toast.success("Link copied.")
		} catch {
			toast(url)
		}
	}

	return (
		<section className={className} aria-labelledby="gallery-posts">
			<h2 id="gallery-posts" className={titleClassName}>
				Your gallery posts
			</h2>
			{posts.isError ? (
				<div className="mt-2 flex flex-col items-start gap-2 text-sm text-gray-400" role="alert">
					Your posts didn't load.
					<button type="button" onClick={() => void posts.refetch()} className={SECONDARY_BUTTON}>
						Try again
					</button>
				</div>
			) : posts.isPending ? (
				<p className="mt-2 flex items-center gap-2 text-sm text-gray-400" role="status">
					<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
					Loading your posts…
				</p>
			) : posts.data.length === 0 ? (
				<p className="mt-2 text-sm leading-relaxed text-gray-300">
					You haven't posted a team yet. Build one on the{" "}
					<Link to="/app/pvp?view=team" className="text-brand hover:text-brand/75">
						PvP page
					</Link>{" "}
					and post it from there.
				</p>
			) : (
				<ul className="mt-3 flex flex-col gap-3">
					{posts.data.map((post) => (
						<li key={post.public_id} className="flex flex-col gap-2 rounded-lg border border-gray-700 bg-gray-900/40 p-3">
							<div className="flex flex-wrap items-center gap-2">
								<span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-100">{post.event.label}</span>
								{post.hidden ? (
									<span className="rounded-full bg-highlight/15 px-2 py-0.5 text-xs font-medium text-highlight">
										Hidden while we review it
									</span>
								) : (
									<span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-medium text-brand">Live</span>
								)}
							</div>
							{post.caption && <p className="break-words text-sm text-gray-300">{post.caption}</p>}
							<ul className="flex gap-3" aria-label="Umas">
								{post.umas.map((member) => {
									const uma = pictures.get(member.uma)
									return (
										<li key={member.uma} className="flex w-16 flex-col items-center gap-0.5 text-center">
											{/* The account page is an owner-named exception to the frame rule. */}
											<UmaPortrait uma={uma} className="w-12" frame={false} />
											<span className="w-full truncate text-[11px] text-gray-300">{uma?.name ?? ""}</span>
											<span className="text-[11px] text-gray-500">{STYLE_LABELS[member.style]}</span>
										</li>
									)
								})}
							</ul>
							<p className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
								<span className="flex items-center gap-1">
									<ArrowBigUp className="h-3.5 w-3.5" aria-hidden="true" />
									{countLabel(post.stats.upvotes, "upvote")}
								</span>
								<span className="flex items-center gap-1">
									<MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
									{countLabel(post.stats.comments, "comment")}
								</span>
								<span className="flex items-center gap-1">
									<Eye className="h-3.5 w-3.5" aria-hidden="true" />
									{countLabel(post.stats.views, "view")}
								</span>
								<span className="flex items-center gap-1">
									<Copy className="h-3.5 w-3.5" aria-hidden="true" />
									{countLabel(post.stats.copies, "copy", "copies")}
								</span>
								<time dateTime={post.published_at} title={formatDate(post.published_at)}>
									Posted {formatTimeAgo(post.published_at)}
								</time>
							</p>
							<div className="flex flex-wrap items-center gap-2">
								<Link
									to={`/app/pvp?event=${post.event.kind}-${post.event.id}&view=gallery&post=${post.public_id}`}
									className={ACTION_BUTTON}
								>
									Open
								</Link>
								<button type="button" onClick={() => void share(post.public_id)} className={ACTION_BUTTON}>
									<Link2 className="h-4 w-4" aria-hidden="true" />
									Copy link
								</button>
								{confirming === post.public_id ? (
									<span className="flex items-center gap-1.5 text-sm text-gray-300">
										Take it down?
										<button
											type="button"
											disabled={takeDown.isPending}
											onClick={() => remove(post.public_id)}
											className={DANGER_BUTTON}
										>
											Take down
										</button>
										<button type="button" onClick={() => setConfirming(null)} className={SECONDARY_BUTTON}>
											Keep
										</button>
									</span>
								) : (
									<button type="button" onClick={() => setConfirming(post.public_id)} className={ACTION_BUTTON}>
										Take down
									</button>
								)}
							</div>
						</li>
					))}
				</ul>
			)}
		</section>
	)
}
