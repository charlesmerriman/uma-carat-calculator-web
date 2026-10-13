/**
 * "Guide picks": the event guide's recommended umas and support cards, beside
 * the team builder, so a player can build against the guide without
 * switching back to the Recommendations view.
 *
 * Two flat lists, each uma and card once (utils/pvpGuide.ts guidePicks): the
 * guide's per-style split lives on the Recommendations view, and here it only
 * repeated the same faces. The styles show in each tile's tooltip.
 *
 * Docked in the left column from xl, a drawer from the left below that
 * (components/pvp/SidePanel.tsx has both placements).
 *
 * A tile shows the pick, its stars or the guide's notes on hover, and a tick
 * when it is already on the team. Clicking it opens an action row under its
 * row of tiles (inline, not a popover, which the panel's scroll area would
 * clip) with the ways to add it: the caller (TeamBuilder) works those out,
 * since it holds the team and its rules.
 */

import { Fragment, useMemo, useState } from "react"
import { Check, Loader2, Star } from "lucide-react"
import { STYLE_LABELS, guidePicks } from "../../utils/pvpGuide"
import type { PvpGuideState } from "../../hooks/usePvpGuide"
import type { PvpStyle } from "../../types/pvpGuide"
import type { PvpTeamMember } from "../../types/pvpTeam"

/** One button in a pick's action row. A disabled one says why. */
export interface PickButton {
	label: string
	disabledReason: string | null
	run: () => void
}

/** One line of a pick's action row: "Spot 2 · Gold Ship" [Replace]. */
export interface PickAction {
	key: string
	label: string
	buttons: PickButton[]
}

/** How to add a pick to the team, worked out by the caller. */
export interface GuidePickActions {
	/** `styles` are the guide's styles for her, so she can join on the first. */
	uma: (umaId: number, styles: PvpStyle[]) => PickAction[]
	card: (cardId: number) => PickAction[]
	/** Shown instead of rows when there is nothing to add a card to. */
	emptyCardHint: string | null
}

interface GuidePicksProps {
	guideState: PvpGuideState
	/** The selected team's members, to tick picks already on it. */
	members: PvpTeamMember[]
	actions: GuidePickActions
}

/** A grid row is four tiles; the action row follows the clicked tile's row. */
const COLUMNS = 4

/** The panel's contents. TeamBuilder wraps it in a DockedPanel or a SideDrawer (SidePanel.tsx). */
export function GuidePicksBody({ guideState, members, actions }: GuidePicksProps) {
	const picks = useMemo(() => (guideState.status === "ready" ? guidePicks(guideState.guide) : null), [guideState])
	// The one pick whose action row is open, as "uma-41" / "card-302".
	const [openKey, setOpenKey] = useState<string | null>(null)
	const toggle = (key: string) => setOpenKey((current) => (current === key ? null : key))
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
					<PickGrid
						items={picks.umas.map((pick) => ({
							key: `uma-${pick.ref.id}`,
							name: pick.ref.name,
							image: pick.ref.image,
							detail: describe(pick.styles, pick.notes),
							stars: pick.stars,
							onTeam: onTeamUmas.has(pick.ref.id),
							actions: () => actions.uma(pick.ref.id, pick.styles),
							emptyHint: null,
						}))}
						shape="square"
						openKey={openKey}
						onToggle={toggle}
						onDone={() => setOpenKey(null)}
					/>
				</section>
			)}
			{picks.cards.length > 0 && (
				<section aria-labelledby="guide-picks-cards">
					<h3 id="guide-picks-cards" className={SECTION_HEADING}>
						Recommended support cards <span className="font-normal text-gray-500">({picks.cards.length})</span>
					</h3>
					<PickGrid
						items={picks.cards.map((pick) => ({
							key: `card-${pick.ref.id}`,
							name: pick.ref.name,
							image: pick.ref.image,
							detail: describe(pick.styles, pick.inDeck ? pick.notes : ["Honourable mention", ...pick.notes]),
							stars: 0,
							onTeam: onTeamCards.has(pick.ref.id),
							actions: () => actions.card(pick.ref.id),
							emptyHint: actions.emptyCardHint,
						}))}
						shape="card"
						openKey={openKey}
						onToggle={toggle}
						onDone={() => setOpenKey(null)}
					/>
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

interface PickItem {
	key: string
	name: string
	image: string | null
	detail: string
	stars: number
	onTeam: boolean
	/** Called only for the open pick, so the rows are worked out on demand. */
	actions: () => PickAction[]
	emptyHint: string | null
}

/** Four tiles a row, with the open pick's action row after its row. */
function PickGrid({ items, shape, openKey, onToggle, onDone }: {
	items: PickItem[]
	shape: "square" | "card"
	openKey: string | null
	onToggle: (key: string) => void
	onDone: () => void
}) {
	const openIndex = items.findIndex((item) => item.key === openKey)
	// The last tile of the open pick's row (or of the list, on a short last row).
	const rowEnd = openIndex < 0 ? -1 : Math.min(Math.floor(openIndex / COLUMNS) * COLUMNS + COLUMNS - 1, items.length - 1)
	return (
		<ul className="grid grid-cols-4 gap-1.5">
			{items.map((item, index) => (
				<Fragment key={item.key}>
					<PickTile item={item} shape={shape} open={item.key === openKey} onClick={() => onToggle(item.key)} />
					{index === rowEnd && openIndex >= 0 && (
						<ActionRow item={items[openIndex]} onDone={onDone} />
					)}
				</Fragment>
			))}
		</ul>
	)
}

/** One pick: a button showing the art, a tick when it is on the team, stars, the name. */
function PickTile({ item, shape, open, onClick }: {
	item: PickItem
	shape: "square" | "card"
	open: boolean
	onClick: () => void
}) {
	const aspect = shape === "card" ? "aspect-[3/4]" : "aspect-square"
	return (
		<li className="min-w-0">
			<button
				type="button"
				aria-expanded={open}
				title={item.detail ? `${item.name}: ${item.detail}` : item.name}
				onClick={onClick}
				className="group block w-full rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-brand"
			>
				<span
					className={`relative block overflow-hidden rounded-md bg-gray-700 transition ${
						open ? "ring-2 ring-brand" : item.onTeam ? "ring-2 ring-brand/70" : "ring-1 ring-gray-600 group-hover:ring-gray-400"
					}`}
				>
					{item.image ? (
						<img src={item.image} alt={item.name} loading="lazy" decoding="async" className={`${aspect} block w-full object-cover`} />
					) : (
						<span className={`${aspect} block w-full`} aria-hidden="true" />
					)}
					{item.onTeam && (
						<span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-black" title="On your team">
							<Check className="h-3 w-3" aria-label="On your team" />
						</span>
					)}
				</span>
				{item.stars > 0 && (
					<span className="mt-0.5 flex justify-center gap-px text-highlight" aria-label={`${item.stars} of 5 stars`}>
						{Array.from({ length: item.stars }, (_, index) => (
							<Star key={index} className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
						))}
					</span>
				)}
				<span className={`mt-0.5 block truncate text-center text-[10px] leading-tight ${open ? "text-brand" : "text-gray-300"}`}>
					{item.name}
				</span>
			</button>
		</li>
	)
}

/** The ways to add the open pick, one line per spot or per uma. */
function ActionRow({ item, onDone }: { item: PickItem; onDone: () => void }) {
	const rows = item.actions()
	return (
		<li className="col-span-4 rounded-lg border border-brand/40 bg-gray-900/80 p-2" aria-label={`Add ${item.name}`}>
			<p className="mb-1.5 truncate text-xs font-semibold text-gray-100">Add {item.name}</p>
			{rows.length === 0 ? (
				<p className="text-xs text-gray-400">{item.emptyHint}</p>
			) : (
				<ul className="flex flex-col gap-1">
					{rows.map((row) => (
						<li key={row.key} className="flex items-center gap-1.5">
							<span className="min-w-0 flex-1 truncate text-xs text-gray-300" title={row.label}>
								{row.label}
							</span>
							{row.buttons.map((button) => (
								<button
									key={button.label}
									type="button"
									disabled={button.disabledReason !== null}
									title={button.disabledReason ?? undefined}
									aria-label={`${button.label}: ${row.label}`}
									onClick={() => {
										button.run()
										onDone()
									}}
									className="shrink-0 rounded-md border border-gray-600 px-2 py-0.5 text-xs font-medium text-gray-100 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-600 disabled:hover:text-gray-100"
								>
									{button.label}
								</button>
							))}
						</li>
					))}
				</ul>
			)}
		</li>
	)
}
