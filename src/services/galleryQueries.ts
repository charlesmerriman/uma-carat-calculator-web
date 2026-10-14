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

/** A post's comments, a page of top-level comments at a time, oldest first. */
export function useGalleryComments(publicId: string) {
	return useInfiniteQuery({
		queryKey: galleryKeys.comments(publicId),
		queryFn: async ({ pageParam }) =>
			readJson<GalleryThread>(await galleryCommentsFetch(publicId, pageParam), "The comments didn't load."),
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
	my_vote?: boolean
	upvotes?: number
	upvotesDelta?: number
	commentsDelta?: number
}

function patched<T extends GalleryRow>(row: T, patch: PostPatch): T {
	const upvotes = patch.upvotes ?? row.stats.upvotes + (patch.upvotesDelta ?? 0)
	return {
		...row,
		my_vote: patch.my_vote ?? row.my_vote,
		stats: {
			...row.stats,
			upvotes: Math.max(upvotes, 0),
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

/**
 * Upvote or take it back. Optimistic: the arrow and the count move at once
 * everywhere, step back if the server refuses, and settle on the server's
 * count when it answers (other people may have voted meanwhile).
 *
 * One hook per button, so each row has its own pending state.
 */
export function useGalleryVote() {
	const client = useQueryClient()
	return useMutation({
		mutationFn: async ({ publicId, on }: { publicId: string; on: boolean }) =>
			readJson<{ upvotes: number; my_vote: boolean }>(
				await galleryVote(publicId, on),
				"Your upvote didn't go through. Try again in a moment."
			),
		onMutate: ({ publicId, on }) => patchPost(client, publicId, { my_vote: on, upvotesDelta: on ? 1 : -1 }),
		onError: (_error, { publicId, on }) => patchPost(client, publicId, { my_vote: !on, upvotesDelta: on ? -1 : 1 }),
		onSuccess: (body, { publicId }) => patchPost(client, publicId, { my_vote: body.my_vote, upvotes: body.upvotes }),
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
	return {
		...thread,
		pages: thread.pages.map((page) => ({
			...page,
			results: page.results.map((top) =>
				top.id === updated.id
					? { ...top, ...updated, replies: top.replies }
					: { ...top, replies: top.replies.map((reply) => (reply.id === updated.id ? updated : reply)) }
			),
		})),
	}
}

/**
 * Writing in a post's comments. A new comment or an edit goes straight into
 * the cached thread from the server's answer. A delete refetches the pages
 * already loaded instead, because a comment with replies stays as
 * "[deleted]" and one without vanishes, and only the server knows which.
 */
export function useCommentWrites(publicId: string) {
	const client = useQueryClient()
	const key = galleryKeys.comments(publicId)
	const failed = "Your comment couldn't be posted. Try again in a moment."

	const create = useMutation({
		mutationFn: async ({ body, parent }: { body: string; parent: number | null }) =>
			readJson<GalleryComment>(await galleryCommentCreate(publicId, body, parent ?? undefined), failed),
		onSuccess: (comment, { parent }) => {
			client.setQueryData<Thread>(key, (thread) => thread && withComment(thread, comment, parent))
			patchPost(client, publicId, { commentsDelta: 1 })
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
			patchPost(client, publicId, { commentsDelta: -1 })
			void client.invalidateQueries({ queryKey: key })
		},
	})

	return { create, edit, remove }
}
