/**
 * One post, opened from the feed or from its link (`?post=<public_id>`, which
 * is where /post/<id> sends people). The whole team, its numbers, and what can
 * be done with it: upvote, copy it into My team, share its link, report it,
 * and, on your own post, take it down. The comments sit underneath.
 *
 * Opening it counts one view (the server ignores your own, and counts each
 * person once a day). A post that is hidden, taken down or never existed says
 * so, the same way for all three.
 */

import { useEffect, useRef, useState } from "react"
import { Copy, Eye, Flag, Link2, Loader2, MessageSquare, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { GalleryModal } from "./GalleryModal"
import { GalleryComments } from "./GalleryComments"
import { GalleryTeam, PosterLine, UpvoteButton } from "./GalleryBits"
import { ReportDialog } from "./ReportDialog"
import { useAccount } from "../../../services/AuthContext"
import { usePvpTeams } from "../../../services/PvpTeamsContext"
import { useCardReleases } from "../../../hooks/useCardReleases"
import type { PvpCatalogueIndex } from "../../../hooks/usePvpCatalogue"
import {
	galleryCopy,
	galleryPostFetch,
	galleryPostTakeDown,
	galleryShareUrl,
	galleryView,
	galleryVote,
	refusalText,
} from "../../../services/galleryFetchCalls"
import { PVP_TEAM_CAP_PER_EVENT, withinRelease } from "../../../utils/pvpTeams"
import { refForRaceEvent } from "../../../utils/pvpEvent"
import { formatDate } from "../../../utils/dateFormat"
import type { RaceEvent } from "../../../types"
import type { GalleryCopy, GalleryPost, GalleryRow } from "../../../types/gallery"

type Load = { status: "loading" } | { status: "missing" } | { status: "error" } | { status: "ready"; post: GalleryPost }

export function GalleryPostPanel({ publicId, event, index, onClose, onChange, onTakenDown, onOpenMyTeam }: {
	publicId: string
	event: RaceEvent
	index: PvpCatalogueIndex
	onClose: () => void
	/** The post's counts or vote changed, so the feed row can follow. */
	onChange: (publicId: string, changes: Partial<GalleryRow>) => void
	onTakenDown: (publicId: string) => void
	onOpenMyTeam: () => void
}) {
	const { isLoggedIn, account } = useAccount()
	const { teams, createTeam, ensureLoaded, setTeamPost } = usePvpTeams()
	const releaseFor = useCardReleases(event, index)
	const [load, setLoad] = useState<Load>({ status: "loading" })
	const [voting, setVoting] = useState(false)
	const [reporting, setReporting] = useState(false)
	const [confirmTakeDown, setConfirmTakeDown] = useState(false)
	const viewed = useRef<string | null>(null)

	useEffect(() => {
		let live = true
		setLoad({ status: "loading" })
		galleryPostFetch(publicId)
			.then(async (response) => {
				if (!live) return
				if (response.status === 404) return setLoad({ status: "missing" })
				if (!response.ok) return setLoad({ status: "error" })
				const post = (await response.json()) as GalleryPost
				if (!live) return
				setLoad({ status: "ready", post })
				if (viewed.current !== publicId) {
					viewed.current = publicId
					galleryView(publicId)
				}
			})
			.catch(() => {
				if (live) setLoad({ status: "error" })
			})
		return () => {
			live = false
		}
	}, [publicId])

	const update = (changes: Partial<GalleryPost>) => {
		setLoad((current) => (current.status === "ready" ? { status: "ready", post: { ...current.post, ...changes } } : current))
		onChange(publicId, changes)
	}

	const vote = async (post: GalleryPost) => {
		if (post.my_vote === null) {
			toast("Sign in to upvote teams.")
			return
		}
		setVoting(true)
		try {
			const response = await galleryVote(publicId, !post.my_vote)
			if (!response.ok) {
				toast.error(await refusalText(response, "Your upvote didn't go through. Try again in a moment."))
				return
			}
			const body = (await response.json()) as { upvotes: number; my_vote: boolean }
			update({ my_vote: body.my_vote, stats: { ...post.stats, upvotes: body.upvotes } })
		} catch {
			toast.error("Your upvote didn't go through. Try again in a moment.")
		} finally {
			setVoting(false)
		}
	}

	const copy = async () => {
		ensureLoaded()
		try {
			const response = await galleryCopy(publicId)
			if (!response.ok) {
				toast.error(await refusalText(response, "That team couldn't be copied. Try again in a moment."))
				return
			}
			const copied = (await response.json()) as GalleryCopy
			const key = createTeam(refForRaceEvent(event), { members: withinRelease(copied.members, releaseFor) })
			if (!key) {
				toast.error(`You can keep up to ${PVP_TEAM_CAP_PER_EVENT} teams for one event.`)
				return
			}
			toast.success("Copied to My team.", { action: { label: "Open", onClick: onOpenMyTeam } })
		} catch {
			toast.error("That team couldn't be copied. Try again in a moment.")
		}
	}

	const share = async () => {
		const url = galleryShareUrl(publicId)
		try {
			await navigator.clipboard.writeText(url)
			toast.success("Link copied.")
		} catch {
			toast(url)
		}
	}

	const takeDown = async () => {
		const response = await galleryPostTakeDown(publicId).catch(() => null)
		if (!response?.ok) {
			toast.error("Your post couldn't be taken down. Try again in a moment.")
			return
		}
		const team = teams.find((candidate) => candidate.post === publicId)
		if (team) setTeamPost(team.key, null)
		toast.success("Your post is down.")
		onTakenDown(publicId)
		onClose()
	}

	const title = load.status === "ready" ? load.post.caption || "A team from the gallery" : "Team"

	return (
		<GalleryModal title={title} variant="sheet" onClose={onClose}>
			{load.status === "loading" ? (
				<p className="flex items-center gap-2 text-sm text-gray-400" role="status">
					<Loader2 className="h-4 w-4 animate-spin" />
					Loading the team…
				</p>
			) : load.status === "missing" ? (
				<p className="text-sm text-gray-300">This team isn't available any more.</p>
			) : load.status === "error" ? (
				<p className="text-sm text-gray-300">The team didn't load. Try again in a moment.</p>
			) : (
				<div className="flex flex-col gap-5">
					{load.post.hidden && (
						<p className="rounded-lg border border-highlight/50 bg-highlight/10 p-3 text-sm text-gray-100">
							Hidden while we review it. Only you can see it.
						</p>
					)}
					<div className="flex flex-col gap-1">
						<PosterLine poster={load.post.poster} />
						<p className="text-xs text-gray-500">
							Posted {formatDate(load.post.published_at)}
							{load.post.content_updated_at !== load.post.published_at &&
								`, updated ${formatDate(load.post.content_updated_at)}`}
						</p>
					</div>

					<GalleryTeam members={load.post.team} index={index} />

					<div className="flex flex-wrap items-center gap-2">
						<UpvoteButton
							count={load.post.stats.upvotes}
							voted={load.post.my_vote}
							own={load.post.is_mine}
							busy={voting}
							onClick={() => void vote(load.post)}
						/>
						<span className="flex items-center gap-3 text-xs text-gray-400">
							<span className="flex items-center gap-1" title="Views">
								<Eye className="h-3.5 w-3.5" aria-hidden="true" />
								{load.post.stats.views} views
							</span>
							<span className="flex items-center gap-1">
								<MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
								{load.post.stats.comments}
							</span>
							<span className="flex items-center gap-1">
								<Copy className="h-3.5 w-3.5" aria-hidden="true" />
								{load.post.stats.copies} copies
							</span>
						</span>
					</div>

					<div className="flex flex-wrap gap-2">
						<button type="button" onClick={() => void copy()} className={ACTION}>
							<Copy className="h-4 w-4" aria-hidden="true" />
							Copy to my teams
						</button>
						<button type="button" onClick={() => void share()} className={ACTION}>
							<Link2 className="h-4 w-4" aria-hidden="true" />
							Copy link
						</button>
						{load.post.is_mine ? (
							confirmTakeDown ? (
								<span className="flex items-center gap-1.5 text-sm text-gray-300">
									Take it down?
									<button type="button" onClick={() => void takeDown()} className="rounded-md border border-highlight/60 px-2 py-1 text-highlight transition hover:bg-highlight/10">
										Take down
									</button>
									<button type="button" onClick={() => setConfirmTakeDown(false)} className="rounded-md border border-gray-600 px-2 py-1 transition hover:bg-gray-700">
										Keep
									</button>
								</span>
							) : (
								<button type="button" onClick={() => setConfirmTakeDown(true)} className={ACTION}>
									<Trash2 className="h-4 w-4" aria-hidden="true" />
									Take down
								</button>
							)
						) : (
							<button
								type="button"
								onClick={() => (isLoggedIn ? setReporting(true) : toast("Sign in to report a team."))}
								className={ACTION}
							>
								<Flag className="h-4 w-4" aria-hidden="true" />
								Report
							</button>
						)}
					</div>

					<GalleryComments
						publicId={publicId}
						signedIn={isLoggedIn}
						displayName={account?.display_name ?? ""}
						onCountChange={(delta) =>
							update({ stats: { ...load.post.stats, comments: Math.max(load.post.stats.comments + delta, 0) } })
						}
					/>
				</div>
			)}
			{reporting && <ReportDialog target={{ post: publicId }} what="team" onClose={() => setReporting(false)} />}
		</GalleryModal>
	)
}

const ACTION =
	"flex items-center gap-1.5 rounded-md border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-100 transition hover:border-brand hover:text-brand"
