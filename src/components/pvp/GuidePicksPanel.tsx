/**
 * "Guide picks": the event guide's recommended umas and support cards, beside
 * the team builder, so a player can build against the guide without
 * switching back to the Recommendations view.
 *
 * Two flat lists, each uma and card once (utils/pvpGuide.ts guidePicks): the
 * guide's per-style split lives on the Recommendations view, and here it only
 * repeated the same faces. The styles show in each tile's tooltip.
 *
 * Two placements, chosen by CSS alone (nothing measures the screen):
 *
 *   xl and up   docked in a left column of the My team view, sticky under the
 *               control band. Collapsible; the toolbar's button brings it back.
 *   below xl    retracted behind the toolbar's "Guide picks" button, sliding
 *               in from the left over the page (GuidePicksDrawer).
 *
 * Reference only: a tile shows the pick, its stars or the guide's notes on
 * hover, and a tick when it is already on the team.
 */

import { useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { Check, Loader2, PanelLeftClose, Star, X } from "lucide-react"
import { STYLE_LABELS, guidePicks } from "../../utils/pvpGuide"
import type { PvpGuideState } from "../../hooks/usePvpGuide"
import type { PvpStyle } from "../../types/pvpGuide"
import type { PvpTeamMember } from "../../types/pvpTeam"

interface GuidePicksProps {
	guideState: PvpGuideState
	/** The selected team's members, to tick picks already on it. */
	members: PvpTeamMember[]
}

/** The panel's contents, shared by the docked column and the drawer. */
function GuidePicksBody({ guideState, members }: GuidePicksProps) {
	const picks = useMemo(() => (guideState.status === "ready" ? guidePicks(guideState.guide) : null), [guideState])
	const onTeamUmas = new Set(members.map((member) => member.uma))
	const onTeamCards = new Set(members.flatMap((member) => member.cards.map((card) => card.support_card)))

	if (guideState.status === "loading" || guideState.status === "idle") {
		return (
			<p className="flex items-center gap-2 text-sm text-gray-400" role="status">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading the guide…
			</p>
		)
	}
	if (guideState.status === "error") return <p className="text-sm text-gray-400">The guide didn't load.</p>
	if (guideState.status === "none") return <p className="text-sm text-gray-400">No guide for this event yet.</p>
	if (!picks || (picks.umas.length === 0 && picks.cards.length === 0)) {
		return <p className="text-sm text-gray-400">This event's guide has no uma or card picks yet.</p>
	}

	return (
		<div className="flex flex-col gap-4">
			{picks.umas.length > 0 && (
				<section aria-labelledby="guide-picks-umas">
					<h3 id="guide-picks-umas" className={SECTION_HEADING}>
						Recommended umas <span className="font-normal text-gray-500">({picks.umas.length})</span>
					</h3>
					<ul className="grid grid-cols-4 gap-1.5">
						{picks.umas.map((pick) => (
							<PickTile
								key={pick.ref.id}
								name={pick.ref.name}
								image={pick.ref.image}
								shape="square"
								detail={describe(pick.styles, pick.notes)}
								stars={pick.stars}
								onTeam={onTeamUmas.has(pick.ref.id)}
							/>
						))}
					</ul>
				</section>
			)}
			{picks.cards.length > 0 && (
				<section aria-labelledby="guide-picks-cards">
					<h3 id="guide-picks-cards" className={SECTION_HEADING}>
						Recommended support cards <span className="font-normal text-gray-500">({picks.cards.length})</span>
					</h3>
					<ul className="grid grid-cols-4 gap-1.5">
						{picks.cards.map((pick) => (
							<PickTile
								key={pick.ref.id}
								name={pick.ref.name}
								image={pick.ref.image}
								shape="card"
								detail={describe(pick.styles, pick.inDeck ? pick.notes : ["Honourable mention", ...pick.notes])}
								stars={0}
								onTeam={onTeamCards.has(pick.ref.id)}
							/>
						))}
					</ul>
				</section>
			)}
		</div>
	)
}

const SECTION_HEADING = "mb-2 text-xs font-semibold uppercase tracking-wider text-brand"

/** "Front, Pace. Use as runaway." for the tooltip; the guide's markup made plain. */
function describe(styles: PvpStyle[], notes: string[]): string {
	const plain = notes.map((text) => text.replace(/==/g, "").replace(/\[\[([^\]]+)\]\]/g, "$1"))
	return [styles.map((style) => STYLE_LABELS[style]).join(", "), ...plain].filter(Boolean).join(". ")
}

/** One pick. The name and the guide's notes are the tooltip; the name also sits under the art. */
function PickTile({ name, image, shape, detail, stars, onTeam }: {
	name: string
	image: string | null
	shape: "square" | "card"
	detail: string
	stars: number
	onTeam: boolean
}) {
	const aspect = shape === "card" ? "aspect-[3/4]" : "aspect-square"
	return (
		<li className="min-w-0" title={detail ? `${name}: ${detail}` : name}>
			<div className={`relative overflow-hidden rounded-md bg-gray-700 ring-1 ${onTeam ? "ring-2 ring-brand" : "ring-gray-600"}`}>
				{image ? (
					<img src={image} alt={name} loading="lazy" decoding="async" className={`${aspect} block w-full object-cover`} />
				) : (
					<span className={`${aspect} block w-full`} aria-hidden="true" />
				)}
				{onTeam && (
					<span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-black" title="On your team">
						<Check className="h-3 w-3" aria-label="On your team" />
					</span>
				)}
			</div>
			{stars > 0 && (
				<span className="mt-0.5 flex justify-center gap-px text-highlight" aria-label={`${stars} of 5 stars`}>
					{Array.from({ length: stars }, (_, index) => (
						<Star key={index} className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
					))}
				</span>
			)}
			<p className="mt-0.5 truncate text-center text-[10px] leading-tight text-gray-300">{name}</p>
		</li>
	)
}

const PANEL_HEADING = "flex items-center gap-1.5 text-sm font-semibold text-gray-100"
const ICON_BUTTON =
	"flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-700 hover:text-gray-100"

/**
 * The docked column, xl and up (hidden below, where the drawer takes over).
 * The caller renders it only while it is open; its button collapses it.
 */
export function GuidePicksPanel({ onCollapse, ...props }: GuidePicksProps & { onCollapse: () => void }) {
	return (
		<aside
			aria-label="Guide picks"
			className="card-panel hidden self-start xl:sticky xl:top-18 xl:flex xl:max-h-[calc(100dvh-10rem)] xl:flex-col"
		>
			<header className="flex items-center justify-between border-b border-gray-700 py-1.5 pl-3 pr-1.5">
				<h2 className={PANEL_HEADING}>
					<Star className="h-4 w-4 fill-highlight text-highlight" aria-hidden="true" />
					Guide picks
				</h2>
				<button type="button" aria-label="Hide guide picks" title="Hide guide picks" onClick={onCollapse} className={ICON_BUTTON}>
					<PanelLeftClose className="h-4 w-4" />
				</button>
			</header>
			<div className="min-h-0 overflow-y-auto p-3">
				<GuidePicksBody {...props} />
			</div>
		</aside>
	)
}

/**
 * The retracted panel, below xl: slides in from the left over the page, with
 * a backdrop. Escape, the backdrop or the close button put it away. It hides
 * itself at xl in case the window widens while it is open, since the docked
 * column takes over there.
 */
export function GuidePicksDrawer({ open, onClose, ...props }: GuidePicksProps & { open: boolean; onClose: () => void }) {
	useEffect(() => {
		if (!open) return
		const closeOnEscape = (keydown: KeyboardEvent) => {
			if (keydown.key === "Escape") onClose()
		}
		window.addEventListener("keydown", closeOnEscape)
		return () => window.removeEventListener("keydown", closeOnEscape)
	}, [open, onClose])

	if (!open) return null
	return createPortal(
		<div className="fixed inset-0 z-60 xl:hidden">
			<div className="absolute inset-0 bg-gray-950/60" onMouseDown={onClose} aria-hidden="true" />
			<section
				role="dialog"
				aria-modal="true"
				aria-label="Guide picks"
				className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-gray-600 bg-gray-800 shadow-2xl motion-safe:animate-[guide-picks-in_160ms_ease-out]"
			>
				<header className="flex items-center justify-between border-b border-gray-700 py-1.5 pl-3 pr-1.5">
					<h2 className={PANEL_HEADING}>
						<Star className="h-4 w-4 fill-highlight text-highlight" aria-hidden="true" />
						Guide picks
					</h2>
					<button type="button" aria-label="Close guide picks" onClick={onClose} className={ICON_BUTTON}>
						<X className="h-4 w-4" />
					</button>
				</header>
				<div className="min-h-0 flex-1 overflow-y-auto p-3">
					<GuidePicksBody {...props} />
				</div>
			</section>
		</div>,
		document.body
	)
}
