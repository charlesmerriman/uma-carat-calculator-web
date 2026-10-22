/**
 * The gallery: teams players posted for an event, their comments, and what a
 * post shows about the person who made it.
 *
 * Mirrors backend views/gallery.py and views/pvp_gallery.py; shapes and
 * refusals in backend/docs/api-reference.md ("Gallery").
 */

import type { PvpEventKind } from "../utils/pvpEvent"
import type { MemberStyle, PvpTeamMember } from "./pvpTeam"

/**
 * A supporter's look on a post, by tier: the game's rarity ladder at the top
 * (an SSR rainbow foil, then SR gold) and a rose edge for the first tier. A
 * KEY the CSS styles by (`data-gallery-style`), never a tier order: the client
 * does no tier arithmetic.
 */
export type GalleryStyle = "ssr" | "sr" | "rose"

export type GallerySort = "hot" | "top" | "new"
export const GALLERY_SORTS: Array<{ id: GallerySort; label: string }> = [
	{ id: "hot", label: "Hot" },
	{ id: "top", label: "Top" },
	{ id: "new", label: "New" },
]

/** What a post or comment shows about the person who made it. */
export interface GalleryPoster {
	/** "" once they blank it: the UI says "Unnamed trainer". */
	display_name: string
	portrait: string | null
	/** Their Patreon tier's name, or null (no pledge, or they hid it). */
	tier_name: string | null
	gallery_style: GalleryStyle | null
}

export interface GalleryStats {
	views: number
	/** People who upvoted. The weighted points that rank the feed stay on the server. */
	upvotes: number
	comments: number
}

/** One post in a feed: a compact row. */
export interface GalleryRow {
	public_id: string
	caption: string
	published_at: string
	content_updated_at: string
	is_mine: boolean
	umas: Array<{ uma: number; style: MemberStyle }>
	stats: GalleryStats
	/** null for a guest: "not voted" and "can't vote" are drawn differently. */
	my_vote: boolean | null
	poster: GalleryPoster
}

/** One post in full, for the post panel. */
export interface GalleryPost extends GalleryRow {
	/**
	 * The longer text ("Strategy"), "" when there is none. Only here, never
	 * on a feed row. Not "notes": that is a team's private notes, which no
	 * gallery payload may carry.
	 */
	strategy: string
	team: PvpTeamMember[]
	/** `label` is the event's name. */
	event: { kind: PvpEventKind; id: number; label: string }
	/** Hidden by moderation. Only ever true for the author's own post. */
	hidden: boolean
	stats: GalleryStats & { copies: number }
}

/**
 * One event's feed: the top `limit` rows. "Load more" asks for a longer
 * limit rather than a next page, because Hot and Top are re-ranked on every
 * request and an offset page would repeat or skip posts that moved.
 */
export interface GalleryFeed {
	/** Posts matching the filter, all of them, not just the rows sent. */
	count: number
	sort: GallerySort
	limit: number
	has_more: boolean
	results: GalleryRow[]
	/** Every uma in the event's posts, filter or not, most-used first. */
	umas: Array<{ uma: number; count: number }>
}

/** Rows a feed asks for at first, and how many more each "Load more" adds. */
export const GALLERY_FEED_STEP = 20

/**
 * visible       shown with its text and person
 * deleted       "[deleted]": its author deleted it after people replied
 * removed       "[removed]": hidden by moderation, kept for its replies
 * under_review  your OWN hidden comment, so you know why nobody sees it
 */
export type GalleryCommentState = "visible" | "deleted" | "removed" | "under_review"

export interface GalleryComment {
	id: number
	state: GalleryCommentState
	body: string
	created_at: string
	edited: boolean
	/** Written before the post's author last re-posted the team. */
	earlier_version: boolean
	/** Written by the post's author. */
	is_author: boolean
	is_mine: boolean
	poster: GalleryPoster | null
	/** Thumbs-up count (people, blocked accounts not counted); who voted is never sent. */
	upvotes: number
	/** The viewer gave it a thumbs-up. */
	my_vote: boolean
	replies: GalleryComment[]
}

export interface GalleryThread {
	count: number
	page: number
	has_more: boolean
	results: GalleryComment[]
}

export type GalleryReportReason = "spam" | "harassment" | "sexual_or_violent" | "personal_info" | "other"

export const GALLERY_REPORT_REASONS: Array<{ id: GalleryReportReason; label: string }> = [
	{ id: "spam", label: "Spam or advertising" },
	{ id: "harassment", label: "Harassment or hate" },
	{ id: "sexual_or_violent", label: "Sexual or violent content" },
	{ id: "personal_info", label: "Someone's personal information" },
	{ id: "other", label: "Something else" },
]

/** The team "Copy to my teams" adds. */
export interface GalleryCopy {
	kind: PvpEventKind
	event: number
	members: PvpTeamMember[]
}

export const GALLERY_CAPTION_MAX = 140
export const GALLERY_STRATEGY_MAX = 2000
export const GALLERY_COMMENT_MAX = 500
export const GALLERY_REPORT_NOTE_MAX = 200
