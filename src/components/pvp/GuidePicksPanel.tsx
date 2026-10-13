/**
 * "Guide picks": the event guide's recommended umas and support cards, beside
 * the team builder, so a player can build against the guide without
 * switching back to the Recommendations view.
 *
 * Two placements, chosen by CSS alone (nothing measures the screen):
 *
 *   xl and up   docked in a left column of the My team view, sticky under the
 *               control band, scrolling on its own when it is long
 *   below xl    retracted behind a "Guide picks" button in the team toolbar,
 *               sliding in from the left over the page (GuidePicksDrawer)
 *
 * Reference only: a tile shows the pick, its stars or the guide's note on
 * hover, and a tick when it is already on the team.
 */

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Check, Loader2, Star, X } from "lucide-react"
import { STYLE_LABELS, guidePicksByStyle, type GuidePicks } from "../../utils/pvpGuide"
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
	const [style, setStyle] = useState<PvpStyle | "all">("all")
	const groups = useMemo(
		() => (guideState.status === "ready" ? guidePicksByStyle(guideState.guide) : []),
		[guideState]
	)
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
	if (groups.length === 0) {
		return <p className="text-sm text-gray-400">No uma or card picks in this event's guide yet.</p>
	}

	const shown = style === "all" ? groups : groups.filter((group) => group.style === style)
	return (
		<div className="flex flex-col gap-4">
			{groups.length > 1 && (
				<div className="flex flex-wrap gap-1" role="group" aria-label="Running style">
					{(["all", ...groups.map((group) => group.style)] as const).map((option) => (
						<button
							key={option}
							type="button"
							aria-pressed={style === option}
							onClick={() => setStyle(option)}
							className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
								style === option
									? "border-brand bg-brand/15 text-brand"
									: "border-gray-600 text-gray-300 hover:border-gray-500"
							}`}
						>
							{option === "all" ? "All" : STYLE_LABELS[option]}
						</button>
					))}
				</div>
			)}
			{shown.map((group) => (
				<StyleGroup key={group.style} group={group} onTeamUmas={onTeamUmas} onTeamCards={onTeamCards} />
			))}
		</div>
	)
}

function StyleGroup({ group, onTeamUmas, onTeamCards }: {
	group: GuidePicks
	onTeamUmas: Set<number>
	onTeamCards: Set<number>
}) {
	return (
		<section aria-label={STYLE_LABELS[group.style]}>
			<h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand">{STYLE_LABELS[group.style]}</h3>
			{group.umas.length > 0 && (
				<>
					<h4 className="mb-1 text-[11px] font-medium text-gray-500">Umas</h4>
					<ul className="mb-3 grid grid-cols-4 gap-1.5">
						{group.umas.map((row) => (
							<PickTile
								key={row.uma.id}
								name={row.uma.name}
								image={row.uma.image}
								shape="square"
								detail={[row.role, row.note].filter(Boolean).join(" · ")}
								stars={row.stars}
								onTeam={onTeamUmas.has(row.uma.id)}
							/>
						))}
					</ul>
				</>
			)}
			{group.cards.length > 0 && (
				<>
					<h4 className="mb-1 text-[11px] font-medium text-gray-500">Support cards</h4>
					<ul className="grid grid-cols-4 gap-1.5">
						{group.cards.map((entry) => (
							<PickTile
								key={entry.card.id}
								name={entry.card.name}
								image={entry.card.image}
								shape="card"
								detail={[entry.source === "mention" ? "Honourable mention" : "", entry.note].filter(Boolean).join(" · ")}
								stars={0}
								onTeam={onTeamCards.has(entry.card.id)}
							/>
						))}
					</ul>
				</>
			)}
		</section>
	)
}

/** One pick. The name and the guide's note are the tooltip; the name also sits under the art. */
function PickTile({ name, image, shape, detail, stars, onTeam }: {
	name: string
	image: string | null
	shape: "square" | "card"
	detail: string
	stars: number
	onTeam: boolean
}) {
	// The ==highlight== markers are for the guide's own page; a tooltip shows plain text.
	const plainDetail = detail.replace(/==/g, "").replace(/\[\[([^\]]+)\]\]/g, "$1")
	return (
		<li className="min-w-0" title={plainDetail ? `${name}: ${plainDetail}` : name}>
			<div className={`relative overflow-hidden rounded-md bg-gray-700 ring-1 ${onTeam ? "ring-brand" : "ring-gray-600"}`}>
				{image ? (
					<img
						src={image}
						alt={name}
						loading="lazy"
						decoding="async"
						className={`${shape === "card" ? "aspect-[3/4]" : "aspect-square"} block w-full object-cover`}
					/>
				) : (
					<span className={`${shape === "card" ? "aspect-[3/4]" : "aspect-square"} block w-full`} aria-hidden="true" />
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

/** The docked column, xl and up. Hidden below, where the drawer takes over. */
export function GuidePicksPanel(props: GuidePicksProps) {
	return (
		<aside
			aria-label="Guide picks"
			className="card-panel hidden self-start p-3 xl:sticky xl:top-[4.5rem] xl:block xl:max-h-[calc(100dvh-10rem)] xl:overflow-y-auto"
		>
			<h2 className={`${PANEL_HEADING} mb-3`}>
				<Star className="h-4 w-4 fill-highlight text-highlight" aria-hidden="true" />
				Guide picks
			</h2>
			<GuidePicksBody {...props} />
		</aside>
	)
}

/**
 * The retracted panel, below xl: slides in from the left over the page, with
 * a backdrop. Escape, the backdrop or the close button put it away. It hides
 * itself at xl in case the window widens while it is open, since the docked
 * column shows there.
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
		<div className="fixed inset-0 z-[60] xl:hidden">
			<div className="absolute inset-0 bg-gray-950/60" onMouseDown={onClose} aria-hidden="true" />
			<section
				role="dialog"
				aria-modal="true"
				aria-label="Guide picks"
				className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-gray-600 bg-gray-800 shadow-2xl motion-safe:animate-[guide-picks-in_160ms_ease-out]"
			>
				<header className="flex items-center justify-between border-b border-gray-700 px-3 py-2.5">
					<h2 className={PANEL_HEADING}>
						<Star className="h-4 w-4 fill-highlight text-highlight" aria-hidden="true" />
						Guide picks
					</h2>
					<button
						type="button"
						aria-label="Close guide picks"
						onClick={onClose}
						className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-700 hover:text-gray-100"
					>
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
