/**
 * The account page's "Your gallery posts": every team the person has posted,
 * with its numbers, whether it is live or waiting for a moderator, and the
 * ways to open, share or take it down.
 *
 * Fetched when the section mounts (the account page renders only for a
 * signed-in person). Event names come with each post, because the account
 * page is outside /app and has no event list of its own.
 */

import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowBigUp, Copy, Eye, Link2, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import { galleryMyPosts, galleryPostTakeDown, galleryShareUrl } from "../../services/galleryFetchCalls"
import { formatDate } from "../../utils/dateFormat"
import type { GalleryPost } from "../../types/gallery"

export function MyGalleryPosts({ className, titleClassName }: { className: string; titleClassName: string }) {
	const [posts, setPosts] = useState<GalleryPost[] | null>(null)
	const [failed, setFailed] = useState(false)
	const [confirming, setConfirming] = useState<string | null>(null)

	useEffect(() => {
		let live = true
		galleryMyPosts()
			.then(async (response) => {
				if (!response.ok) throw new Error(String(response.status))
				const body = (await response.json()) as GalleryPost[]
				if (live) setPosts(body)
			})
			.catch(() => {
				if (live) setFailed(true)
			})
		return () => {
			live = false
		}
	}, [])

	const takeDown = async (publicId: string) => {
		const response = await galleryPostTakeDown(publicId).catch(() => null)
		if (!response?.ok) {
			toast.error("Your post couldn't be taken down. Try again in a moment.")
			return
		}
		setPosts((current) => (current ?? []).filter((post) => post.public_id !== publicId))
		setConfirming(null)
		toast.success("Your post is down.")
	}

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
			{failed ? (
				<p className="mt-2 text-sm text-gray-400">Your posts didn't load. Try again in a moment.</p>
			) : posts === null ? (
				<p className="mt-2 text-sm text-gray-400">Loading your posts…</p>
			) : posts.length === 0 ? (
				<p className="mt-2 text-sm leading-relaxed text-gray-300">
					You haven't posted a team yet. Build one on the{" "}
					<Link to="/app/pvp?view=team" className="text-brand hover:text-brand/75">
						PvP page
					</Link>{" "}
					and post it from there.
				</p>
			) : (
				<ul className="mt-3 flex flex-col gap-3">
					{posts.map((post) => (
						<li key={post.public_id} className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
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
							{post.caption && <p className="mt-1 break-words text-sm text-gray-300">{post.caption}</p>}
							<p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-400">
								<span className="flex items-center gap-1">
									<Eye className="h-3.5 w-3.5" aria-hidden="true" />
									{post.stats.views} views
								</span>
								<span className="flex items-center gap-1">
									<ArrowBigUp className="h-3.5 w-3.5" aria-hidden="true" />
									{post.stats.upvotes} upvotes
								</span>
								<span className="flex items-center gap-1">
									<MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
									{post.stats.comments} comments
								</span>
								<span className="flex items-center gap-1">
									<Copy className="h-3.5 w-3.5" aria-hidden="true" />
									{post.stats.copies} copies
								</span>
								<span>Posted {formatDate(post.published_at)}</span>
							</p>
							<div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
								<Link
									to={`/app/pvp?event=${post.event.kind}-${post.event.id}&view=gallery&post=${post.public_id}`}
									className="rounded-md border border-gray-600 px-2.5 py-1 text-gray-100 transition hover:border-brand hover:text-brand"
								>
									Open
								</Link>
								<button
									type="button"
									onClick={() => void share(post.public_id)}
									className="flex items-center gap-1 rounded-md border border-gray-600 px-2.5 py-1 text-gray-100 transition hover:border-brand hover:text-brand"
								>
									<Link2 className="h-3.5 w-3.5" aria-hidden="true" />
									Copy link
								</button>
								{confirming === post.public_id ? (
									<span className="flex items-center gap-1.5 text-gray-300">
										Take it down?
										<button
											type="button"
											onClick={() => void takeDown(post.public_id)}
											className="rounded-md border border-highlight/60 px-2 py-1 text-highlight transition hover:bg-highlight/10"
										>
											Take down
										</button>
										<button type="button" onClick={() => setConfirming(null)} className="rounded-md border border-gray-600 px-2 py-1 transition hover:bg-gray-700">
											Keep
										</button>
									</span>
								) : (
									<button
										type="button"
										onClick={() => setConfirming(post.public_id)}
										className="rounded-md border border-gray-600 px-2.5 py-1 text-gray-300 transition hover:border-highlight hover:text-highlight"
									>
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
