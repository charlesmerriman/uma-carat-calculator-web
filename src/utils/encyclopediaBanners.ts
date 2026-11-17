/**
 * An outfit's or a card's banners and release dates, read from the banners
 * /calculator-data already loaded (with their predicted dates). The
 * Encyclopedia's API sends no dates on purpose: date prediction lives in ONE
 * place, the backend's, and the page only reads what it decided.
 */

import type { BannerSupport, BannerUma } from "../types"
import { parseApiDate } from "./dateFormat"
import { timelineFocusHref } from "./timelineFocus"

export interface BannerLink {
	timelineId: number
	name: string
	start: string
	end: string
	predicted: boolean
	href: string
	/** The banner's own picture, when it has one. */
	image: string | null
	/** Who else is on it (never the page's own subject), in the banner's order. */
	featured: BannerFace[]
	/** What `featured` holds, so the page draws umas framed and cards as cards. */
	kind: "uma" | "card"
}

/** Someone else on a banner: an uma's portrait or a card's picture. */
export interface BannerFace {
	id: number
	name: string
	art: string | null
}

export interface Releases {
	/** Every banner featuring it, oldest first. */
	banners: BannerLink[]
	/** Its first JP banner (the API's first_jp_date), when it has been on one. */
	jpDate: string | null
	/** Its first banner on Global, as the site dates it. */
	globalDate: string | null
	/** True when that Global date is the site's prediction. */
	predicted: boolean
}

const startOf = (link: BannerLink) => parseApiDate(link.start)?.getTime() ?? 0

function releases<B extends { name: string; banner_timeline: BannerUma["banner_timeline"] }, C extends { id: number; name: string; image: string; portrait?: string | null; first_jp_date: string | null }>(
	banners: B[],
	cardsOf: (banner: B) => C[],
	id: number,
	kind: BannerLink["kind"],
): Releases {
	let jpDate: string | null = null
	const links: BannerLink[] = []
	for (const banner of banners) {
		const card = cardsOf(banner).find((entry) => entry.id === id)
		if (!card) continue
		jpDate = jpDate ?? card.first_jp_date
		const timeline = banner.banner_timeline
		links.push({
			timelineId: timeline.id,
			name: banner.name || timeline.name,
			start: timeline.start_date,
			end: timeline.end_date,
			predicted: timeline.is_predicted,
			href: timelineFocusHref({ kind: "banner", id: timeline.id }),
			image: timeline.image || null,
			featured: cardsOf(banner)
				.filter((entry) => entry.id !== id)
				.map((entry) => ({ id: entry.id, name: entry.name, art: entry.portrait || entry.image || null })),
			kind,
		})
	}
	links.sort((a, b) => startOf(a) - startOf(b))
	return { banners: links, jpDate, globalDate: links[0]?.start ?? null, predicted: links[0]?.predicted ?? false }
}

export const umaReleases = (banners: BannerUma[], umaId: number): Releases =>
	releases(banners, (banner) => banner.umas, umaId, "uma")

export const cardReleases = (banners: BannerSupport[], cardId: number): Releases =>
	releases(banners, (banner) => banner.support_cards, cardId, "card")
