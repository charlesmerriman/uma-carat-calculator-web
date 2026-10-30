/**
 * The gallery's server state: what is cached, under which key, and how a
 * change made here reaches every place a post is drawn.
 *
 * One post can be on screen three times at once: as a feed row (in every
 * cached sort and filter of its event), in the post panel, and on the account
 * page's "Your gallery posts". A vote or a new comment patches all of them
 * through patchPost, so the row and the panel can never disagree, and nothing
 * has to pass the change back up through props.
 *
 * Every fetcher throws an HttpError carrying the API's own sentence
 * (refusalText), so a component shows `error.message` and never invents one.
 * The routes themselves are services/galleryFetchCalls.ts.
 */

import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
	type InfiniteData,
	type QueryClient,
} from "@tanstack/react-query"
import {
	galleryCommentCreate,
	galleryCommentDelete,
	galleryCommentEdit,
	galleryCommentVote,
	galleryCommentsFetch,
	galleryFeedFetch,
	galleryMyPosts,
	galleryPostFetch,
	galleryPostTakeDown,
	galleryVote,
	refusalText,
} from "./galleryFetchCalls"
import { HttpError } from "./queryClient"
import type { PvpEventRef } from "../utils/pvpEvent"
import type {
	GalleryComment,
	GalleryFeed,
	GalleryPost,
	GalleryRow,
	GallerySort,
	GalleryThread,
	VoteChoice,
	VoteSplit,
} from "../types/gallery"

/** Throws the API's sentence (or `fallback`) for anything but a 2xx. */
async function readJson<T>(response: Response, fallback: string): Promise<T> {
	if (!response.ok) throw new HttpError(response.status, await refusalText(response, fallback))
	return (await response.json()) as T
}

async function expectOk(response: Response, fallback: string): Promise<void> {
	if (!response.ok) throw new HttpError(response.status, await refusalText(response, fallback))
}

/** The message to show for a failure, whatever was thrown. */
export function failureText(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback
}

/**
 * Every gallery key starts with "gallery", so one call can reach them all.
 * A feed's key holds everything that changes its rows: event, sort, filter
 * and how many rows were asked for.
 */
export const galleryKeys = {
	all: ["gallery"] as const,
	feeds: () => ["gallery", "feed"] as const,
	feed: (ref: PvpEventRef, sort: GallerySort, uma: number | null, limit: number) =>
		["gallery", "feed", ref.kind, ref.id, sort, uma, limit] as const,
	post: (publicId: string) => ["gallery", "post", publicId] as const,
	comments: (publicId: string) => ["gallery", "comments", publicId] as const,
	mine: () => ["gallery", "mine"] as const,
}

// ── Reads ────────────────────────────────────────────────────────────────

/**
 * One event's feed. While a new sort, filter or longer list loads, the rows
 * already on screen stay (marked `isPlaceholderData`) instead of the list
 * collapsing to a spinner, but only within the same event: another event's
 * teams standing in for this one's would be wrong, not just old.
 */
export function useGalleryFeed(ref: PvpEventRef, sort: GallerySort, uma: number | null, limit: number) {
	return useQuery({
		queryKey: galleryKeys.feed(ref, sort, uma, limit),
		queryFn: async () =>
			readJson<GalleryFeed>(await galleryFeedFetch(ref, { sort, uma, limit }), "The gallery didn't load."),
		placeholderData: (previous, previousQuery) =>
			previousQuery && previousQuery.queryKey[2] === ref.kind && previousQuery.queryKey[3] === ref.id
				? previous
				: undefined,
	})
}

/** One post in full. A 404 (missing, hidden or taken down) is an HttpError with status 404. */
export function useGalleryPost(publicId: string | null) {
	return useQuery({
		queryKey: galleryKeys.post(publicId ?? ""),
		queryFn: async () => readJson<GalleryPost>(await galleryPostFetch(publicId ?? ""), "The team didn't load."),
		enabled: publicId !== null,
	})
}

/**
 * Where a comment thread lives. A post's comments and each section of a PvP
 * guide's are the same kind of thread (the API's GalleryComment, with a post
 * OR a guide as its parent), so one component draws both and only this
 * differs: the cache key, how a page is fetched, how a comment is added, and
 * who else counts the thread's comments (a post's stats, a guide's tabs).
 * Built by postThread here and guideThread (services/guideComments.ts).
 */
export interface CommentThreadSource {
	key: readonly unknown[]
	fetchPage: (page: number) => Promise<Response>
	create: (body: string, parent?: number) => Promise<Response>
	/** A visible comment came (+1) or went (-1): patch whatever else counts them. */
	countChanged: (client: QueryClient, delta: number) => void
}

/** A gallery post's thread. */
export function postThread(publicId: string): CommentThreadSource {
	return {
		key: galleryKeys.comments(publicId),
		fetchPage: (page) => galleryCommentsFetch(publicId, page),
		create: (body, parent) => galleryCommentCreate(publicId, body, parent),
		countChanged: (client, delta) => patchPost(client, publicId, { commentsDelta: delta }),
	}
}

/** A thread's comments, a page of top-level comments at a time, oldest first. */
export function useGalleryComments(source: CommentThreadSource) {
	return useInfiniteQuery({
		queryKey: source.key,
		queryFn: async ({ pageParam }) =>
			readJson<GalleryThread>(await source.fetchPage(pageParam), "The comments didn't load."),
		initialPageParam: 1,
		getNextPageParam: (last) => (last.has_more ? last.page + 1 : undefined),
	})
}

/** The signed-in person's posts, every event, hidden ones too. */
export function useMyGalleryPosts() {
	return useQuery({
		queryKey: galleryKeys.mine(),
		queryFn: async () => readJson<GalleryPost[]>(await galleryMyPosts(), "Your posts didn't load."),
	})
}

// ── Writing to every copy of a post ──────────────────────────────────────

/**
 * A change to one post. Deltas rather than totals where the client is
 * guessing (an optimistic vote, a comment added), totals where the server
 * said (a vote's answer).
 */
interface PostPatch {
	my_vote?: VoteChoice
	/** The server's answer: the score, and the split when the viewer is staff. */
	votes?: VoteAnswer
	scoreDelta?: number
	commentsDelta?: number
}

/** What a vote PUT or DELETE answers, on a post or a comment. */
interface VoteAnswer {
	score: number
	my_vote: VoteChoice
	split?: VoteSplit
}

const VOTE_VALUE: Record<VoteChoice, number> = { up: 1, none: 0, down: -1 }

/**
 * How far the score moves going from one vote to another: up to down is -2.
 * The shown score is floored at 0, so near 0 this is a guess that the
 * server's answer corrects a moment later.
 */
export function voteDelta(from: VoteChoice | null, to: VoteChoice): number {
	return VOTE_VALUE[to] - VOTE_VALUE[from ?? "none"]
}

function patched<T extends GalleryRow>(row: T, patch: PostPatch): T {
	const score = patch.votes?.score ?? row.stats.score + (patch.scoreDelta ?? 0)
	const split = patch.votes ? patch.votes.split : row.stats.split
	return {
		...row,
		my_vote: patch.votes?.my_vote ?? patch.my_vote ?? row.my_vote,
		stats: {
			...row.stats,
			score: Math.max(score, 0),
			...(split ? { split } : {}),
			comments: Math.max(row.stats.comments + (patch.commentsDelta ?? 0), 0),
		},
	}
}

/** Applies `patch` to the post wherever it is cached: every feed, the post itself, your posts. */
function patchPost(client: QueryClient, publicId: string, patch: PostPatch): void {
	client.setQueriesData<GalleryFeed>({ queryKey: galleryKeys.feeds() }, (feed) =>
		feed && {
			...feed,
			results: feed.results.map((row) => (row.public_id === publicId ? patched(row, patch) : row)),
		}
	)
	client.setQueryData<GalleryPost>(galleryKeys.post(publicId), (post) => post && patched(post, patch))
	client.setQueryData<GalleryPost[]>(galleryKeys.mine(), (posts) =>
		posts?.map((post) => (post.public_id === publicId ? patched(post, patch) : post))
	)
}

// ── Writes ───────────────────────────────────────────────────────────────

/** A vote to send: the choice, and the one it replaces (to step back on a refusal). */
export interface VoteWrite {
	choice: VoteChoice
	previous: VoteChoice | null
}

/**
 * Vote up, down, or take it back. Optimistic: the arrows and the score move
 * at once everywhere, step back if the server refuses, and settle on the
 * server's score when it answers (other people may have voted meanwhile).
 *
 * One hook per button pair, so each row has its own pending state.
 */
export function useGalleryVote() {
	const client = useQueryClient()
	return useMutation({
		mutationFn: async ({ publicId, choice }: VoteWrite & { publicId: string }) =>
			readJson<VoteAnswer>(await galleryVote(publicId, choice), "Your vote didn't go through. Try again in a moment."),
		onMutate: ({ publicId, choice, previous }) =>
			patchPost(client, publicId, { my_vote: choice, scoreDelta: voteDelta(previous, choice) }),
		onError: (_error, { publicId, choice, previous }) =>
			patchPost(client, publicId, { my_vote: previous ?? "none", scoreDelta: -voteDelta(previous, choice) }),
		onSuccess: (votes, { publicId }) => patchPost(client, publicId, { votes }),
	})
}

/**
 * Take your own post down. It leaves every cached feed at once; the feeds
 * on screen are then refetched so counts and the uma filter catch up.
 */
export function useTakeDownPost() {
	const client = useQueryClient()
	return useMutation({
		mutationFn: async (publicId: string) =>
			expectOk(await galleryPostTakeDown(publicId), "Your post couldn't be taken down. Try again in a moment."),
		onSuccess: (_nothing, publicId) => {
			client.setQueriesData<GalleryFeed>({ queryKey: galleryKeys.feeds() }, (feed) => {
				if (!feed?.results.some((row) => row.public_id === publicId)) return feed
				return {
					...feed,
					count: Math.max(feed.count - 1, 0),
					results: feed.results.filter((row) => row.public_id !== publicId),
				}
			})
			client.setQueryData<GalleryPost[]>(galleryKeys.mine(), (posts) =>
				posts?.filter((post) => post.public_id !== publicId)
			)
			client.removeQueries({ queryKey: galleryKeys.post(publicId) })
			client.removeQueries({ queryKey: galleryKeys.comments(publicId) })
			void client.invalidateQueries({ queryKey: galleryKeys.feeds() })
		},
	})
}

/**
 * A post was made or replaced (PublishDialog): the post's cache takes the
 * answer, and the feeds and your posts are refetched, since a new post or a
 * re-post (votes back to zero, newest again) moves it in every sort.
 */
export function rememberPublished(client: QueryClient, post: GalleryPost): void {
	client.setQueryData(galleryKeys.post(post.public_id), post)
	void client.invalidateQueries({ queryKey: galleryKeys.feeds() })
	void client.invalidateQueries({ queryKey: galleryKeys.mine() })
}

type Thread = InfiniteData<GalleryThread, number>

/** `comment` added to the cached thread: at the end, or under its top-level parent. */
function withComment(thread: Thread, comment: GalleryComment, parent: number | null): Thread {
	if (parent === null) {
		const pages = [...thread.pages]
		const last = pages[pages.length - 1]
		pages[pages.length - 1] = { ...last, results: [...last.results, comment] }
		return { ...thread, pages }
	}
	return {
		...thread,
		pages: thread.pages.map((page) => ({
			...page,
			results: page.results.map((top) =>
				top.id === parent || top.replies.some((reply) => reply.id === parent)
					? { ...top, replies: [...top.replies, comment] }
					: top
			),
		})),
	}
}

/** The cached thread with `updated` in place of the comment it edits; a top comment keeps its replies. */
function withEdit(thread: Thread, updated: GalleryComment): Thread {
	return withPatch(thread, updated.id, (comment) => ({ ...comment, ...updated, replies: comment.replies }))
}

/** The cached thread with one comment (top or reply) changed by `change`. */
function withPatch(thread: Thread, id: number, change: (comment: GalleryComment) => GalleryComment): Thread {
	return {
		...thread,
		pages: thread.pages.map((page) => ({
			...page,
			results: page.results.map((top) =>
				top.id === id
					? change(top)
					: { ...top, replies: top.replies.map((reply) => (reply.id === id ? change(reply) : reply)) }
			),
		})),
	}
}

/**
 * Writing in a thread. A new comment or an edit goes straight into the cached
 * thread from the server's answer. A delete refetches the pages already
 * loaded instead, because a comment with replies stays as "[deleted]" and one
 * without vanishes, and only the server knows which. A thumbs-up shows at
 * once and takes the server's count when it answers.
 */
export function useCommentWrites(source: CommentThreadSource) {
	const client = useQueryClient()
	const key = source.key
	const failed = "Your comment couldn't be posted. Try again in a moment."

	const create = useMutation({
		mutationFn: async ({ body, parent }: { body: string; parent: number | null }) =>
			readJson<GalleryComment>(await source.create(body, parent ?? undefined), failed),
		onSuccess: (comment, { parent }) => {
			client.setQueryData<Thread>(key, (thread) => thread && withComment(thread, comment, parent))
			source.countChanged(client, 1)
		},
	})

	const edit = useMutation({
		mutationFn: async ({ id, body }: { id: number; body: string }) =>
			readJson<GalleryComment>(await galleryCommentEdit(id, body), failed),
		onSuccess: (comment) => client.setQueryData<Thread>(key, (thread) => thread && withEdit(thread, comment)),
	})

	const remove = useMutation({
		mutationFn: async (id: number) =>
			expectOk(await galleryCommentDelete(id), "That comment couldn't be deleted. Try again in a moment."),
		onSuccess: () => {
			source.countChanged(client, -1)
			void client.invalidateQueries({ queryKey: key })
		},
	})

	const vote = useMutation({
		mutationFn: async ({ id, choice }: { id: number; choice: VoteChoice }) =>
			readJson<VoteAnswer>(await galleryCommentVote(id, choice), "That didn't go through. Try again in a moment."),
		onMutate: ({ id, choice }) =>
			client.setQueryData<Thread>(key, (thread) =>
				thread &&
				withPatch(thread, id, (comment) =>
					comment.my_vote === choice
						? comment
						: { ...comment, my_vote: choice, score: Math.max(comment.score + voteDelta(comment.my_vote, choice), 0) }
				)
			),
		onSuccess: (answer, { id }) =>
			client.setQueryData<Thread>(key, (thread) => thread && withPatch(thread, id, (comment) => ({ ...comment, ...answer }))),
		onError: () => void client.invalidateQueries({ queryKey: key }),
	})

	return { create, edit, remove, vote }
}
