import { Link } from "react-router-dom"
import { ArrowUpRight, Sparkles } from "lucide-react"
import type { AttachedAnniversaryEvent, BannerStepUpSummary } from "../../types"
import { formatStepUpChip } from "./timelineShared"
import { selectorsCampaignHref } from "../../utils/selectorsFocus"

/**
 * The band that sits flush on top of a banner card when that banner is part of
 * an anniversary or other paid campaign.
 *
 * Rendered ABOVE the card and visually joined to it: this strip keeps only its
 * top corners rounded, and the caller squares the card's top corners to match,
 * so the two read as one unit. Nothing inside the card moves — an unattached
 * banner renders exactly as it always did.
 */

const EVENT_TYPE_STYLES: Record<
	AttachedAnniversaryEvent["event_type"],
	{ label: string; className: string }
> = {
	anniversary: {
		label: "Anniversary",
		className: "border-brand/50 bg-brand/15 text-brand",
	},
	new_year: {
		label: "New Year",
		className: "border-amber-500/50 bg-amber-500/15 text-amber-300",
	},
	campaign: {
		label: "Campaign",
		className: "border-sky-500/50 bg-sky-500/15 text-sky-300",
	},
}

export const AnniversaryEventStrip = ({
	event,
	stepUps = [],
}: {
	event: AttachedAnniversaryEvent
	/** Step-ups running in this window; see formatStepUpChip. */
	stepUps?: BannerStepUpSummary[]
}) => {
	const style = EVENT_TYPE_STYLES[event.event_type] ?? EVENT_TYPE_STYLES.campaign
	// The only place on the site that says step-ups exist without pressing the
	// calculator's new button — the feature is otherwise undiscoverable.
	const stepUpChip = formatStepUpChip(stepUps)

	return (
		<div
			className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-t-xl border border-b-0 px-3 py-1.5 ${style.className}`}
		>
			<Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
			<span className="text-sm font-bold">{event.name}</span>
			<span className="rounded-full border border-current/40 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
				Part {event.part_number}
			</span>
			{event.accent_label && (
				<span className="text-xs font-medium opacity-90">
					{event.accent_label}
				</span>
			)}
			{stepUpChip && (
				<span
					title="Select Step-Up banners run during this campaign: a discounted, paid-carats-only ladder that guarantees a card you choose"
					className="rounded-full border border-purple-400/50 bg-purple-400/15 px-2 py-0.5 text-[11px] font-semibold text-purple-200"
				>
					{stepUpChip}
				</span>
			)}
			{/* Named, not bare: the Selectors page lists every upcoming campaign,
			    so a link with no target lands the reader at the top of a page of
			    near-identical cards to hunt for the one they just clicked. */}
			<Link
				to={selectorsCampaignHref(event.id)}
				className="ml-auto flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
			>
				Plan purchases
				<ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden="true" />
			</Link>
		</div>
	)
}
