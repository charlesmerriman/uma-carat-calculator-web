import { OguriSpinner } from "../OguriSpinner"

/**
 * What a content page shows while its words are on their way.
 *
 * Only ever seen when a page is reached without its content already in the
 * document: the empty shell for a path with no prerendered file, the dev
 * server, or a client-side navigation from a page whose document embedded
 * only its own row. The prerendered documents carry their words, so a visitor
 * landing on /about never sees this.
 */
export function ContentLoading({ what }: { what: string }) {
	return (
		<div className="mt-10 flex justify-center" role="status" aria-live="polite">
			<OguriSpinner />
			<span className="sr-only">Loading {what}…</span>
		</div>
	)
}
