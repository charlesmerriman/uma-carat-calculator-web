/**
 * The PvP page's "My team" view: the player's teams for the selected event.
 *
 * A row of the event's teams ("Team 1", a name, "+ New team"), the grid, and
 * the save line. Picking a place on the grid opens PvpCardPicker; the edit
 * goes through PvpTeamsProvider, which saves it (to the device for a guest, to
 * the account after a short pause when signed in).
 *
 * An event with no team still shows an empty grid. The first pick creates
 * the team, so there is no "Start a team" step to get through.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Check, CloudAlert, CloudCheck, HardDrive, Loader2, PanelLeftOpen, Pencil, Plus, Star, Trash2 } from "lucide-react"
import { usePvpTeams } from "../../services/PvpTeamsContext"
import { usePvpCatalogue, type PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"
import { usePvpGuide } from "../../hooks/usePvpGuide"
import { refForRaceEvent, sameEvent } from "../../utils/pvpEvent"
import {
	MEMBER_STYLES,
	PVP_BORROW_SLOT,
	PVP_TEAM_CAP_PER_EVENT,
	cardBlockReason,
	clearCard,
	clearMember,
	memberAt,
	recommendedIds,
	setCard,
	setMemberStyle,
	setMemberUma,
	umaBlockReason,
} from "../../utils/pvpTeams"
import { GuidePicksDrawer, GuidePicksPanel } from "./GuidePicksPanel"
import { PvpCardPicker } from "./PvpCardPicker"
import { TeamGrid } from "./TeamGrid"
import type { RaceEvent } from "../../types"
import type { MemberStyle, PvpTeam, PvpTeamMember } from "../../types/pvpTeam"
import type { PvpTeamsContextType } from "../../services/PvpTeamsContext"

type PickerTarget = { pool: "uma"; position: number } | { pool: "support"; position: number; slot: number }

/** "Team 2" when the player hasn't named it. */
function teamLabel(team: PvpTeam, index: number): string {
	return team.name.trim() || `Team ${index + 1}`
}

export function TeamBuilder({ event }: { event: RaceEvent }) {
	const teamsState = usePvpTeams()
	const { status, ensureLoaded } = teamsState
	const catalogue = usePvpCatalogue()

	useEffect(() => {
		ensureLoaded()
	}, [ensureLoaded])

	if (status === "error") {
		return <Notice>Your teams didn't load. Reload the page to try again.</Notice>
	}
	if (catalogue.status === "error") {
		return <Notice>The uma and card list didn't load. Reload the page to try again.</Notice>
	}
	if (status !== "ready" || catalogue.status !== "ready") {
		return (
			<div className="flex items-center gap-2 text-sm text-gray-400" role="status">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading your teams…
			</div>
		)
	}
	// Keyed by event, so switching events starts on that event's first team.
	return <ReadyBuilder key={`${event.event_type}-${event.id}`} event={event} teamsState={teamsState} index={catalogue} />
}

function ReadyBuilder({ event, teamsState, index }: {
	event: RaceEvent
	teamsState: PvpTeamsContextType
	index: PvpCatalogueIndex
}) {
	const { teams, mode, saveState, createTeam, editTeam, renameTeam, deleteTeam } = teamsState
	const ref = refForRaceEvent(event)
	const eventTeams = teams.filter((team) => sameEvent({ kind: team.kind, id: team.event }, ref))

	const [selectedKey, setSelectedKey] = useState<string | null>(null)
	const [picker, setPicker] = useState<PickerTarget | null>(null)
	// The retracted Guide picks drawer, below xl. A stable close function, so
	// the drawer's Escape listener is not re-added on every render.
	const [picksOpen, setPicksOpen] = useState(false)
	const closePicks = useCallback(() => setPicksOpen(false), [])
	const team =
		eventTeams.find((candidate) => candidate.key === selectedKey) ??
		eventTeams.find((candidate) => candidate.isFocus) ??
		eventTeams[0] ??
		null
	const members = team?.members ?? []

	// Stars come from the event's guide; usePvpGuide caches it, so this is
	// free when the player has just read the Recommendations view.
	const guideState = usePvpGuide(ref)
	const guide = guideState.status === "ready" ? guideState.guide : null

	/** Apply an edit to the selected team, creating the team on the first one. */
	const applyMembers = (next: PvpTeamMember[]) => {
		if (team) {
			editTeam(team.key, { members: next })
			return
		}
		const key = createTeam(ref, { members: next })
		if (key) setSelectedKey(key)
	}

	const pickerMember = picker ? memberAt(members, picker.position) : undefined
	const pickerStyle = pickerMember?.style ?? null
	const recommended = recommendedIds(guide, pickerStyle ?? "front")
	const umaName = (position: number): string => {
		const member = memberAt(members, position)
		return (member && index.umasById.get(member.uma)?.name) || `uma ${position + 1}`
	}

	// The guide's picks per style, worked out once per guide for the grid's stars.
	const picksByStyle = useMemo(
		() => new Map(MEMBER_STYLES.map((style) => [style, recommendedIds(guide, style)])),
		[guide]
	)
	const isRecommended = (pool: "uma" | "support", id: number, style: MemberStyle): boolean => {
		const picks = picksByStyle.get(style)
		return picks !== undefined && (pool === "uma" ? picks.umas : picks.cards).has(id)
	}

	return (
		// From xl the guide's picks dock in a left column and the builder keeps
		// its 56rem; below xl they retract behind the toolbar's button.
		<div className="mx-auto grid w-full max-w-4xl items-start gap-4 xl:max-w-[76rem] xl:grid-cols-[19rem_minmax(0,1fr)]">
			<GuidePicksPanel guideState={guideState} members={members} />
			<GuidePicksDrawer guideState={guideState} members={members} open={picksOpen} onClose={closePicks} />

			<div className="flex min-w-0 flex-col gap-3">
				<TeamToolbar
					leading={
						<button
							type="button"
							aria-expanded={picksOpen}
							onClick={() => setPicksOpen(true)}
							className="flex items-center gap-1.5 rounded-md border border-gray-600 px-2.5 py-1.5 text-sm font-medium text-gray-200 transition hover:border-brand hover:text-brand xl:hidden"
						>
							<PanelLeftOpen className="h-4 w-4" />
							Guide picks
						</button>
					}
					teams={eventTeams}
					selected={team}
					mode={mode}
					saveState={saveState}
					onSelect={setSelectedKey}
					onCreate={() => {
						const key = createTeam(ref)
						if (key) setSelectedKey(key)
					}}
					onRename={(name) => team && renameTeam(team.key, name)}
					onDelete={() => {
						if (!team) return
						deleteTeam(team.key)
						setSelectedKey(null)
					}}
				/>

				<TeamGrid
					members={members}
					umasById={index.umasById}
					cardsById={index.cardsById}
					course={event}
					isRecommended={isRecommended}
					onPickUma={(position) => setPicker({ pool: "uma", position })}
					onPickCard={(position, slot) => setPicker({ pool: "support", position, slot })}
					onStyleChange={(position, style) => applyMembers(setMemberStyle(members, position, style))}
					onClearUma={(position) => applyMembers(clearMember(members, position))}
					onClearCard={(position, slot) => applyMembers(clearCard(members, position, slot))}
				/>

				{guide && (
					<p className="flex items-center gap-1.5 text-xs text-gray-500">
						<Star className="h-3 w-3 fill-highlight text-highlight" aria-hidden="true" />
						Recommended by this event's guide for that running style.
					</p>
				)}
				{mode === "guest" && (
					<p className="text-xs text-gray-400">
						Your teams are saved on this device.{" "}
						<Link to="/login" className="font-medium text-brand transition hover:text-brand/75">
							Sign in
						</Link>{" "}
						to keep them on every device.
					</p>
				)}
			</div>

			{picker?.pool === "uma" && (
				<PvpCardPicker
					pool="uma"
					items={index.catalogue.umas}
					title={`Uma ${picker.position + 1}`}
					skillsById={index.skillsById}
					event={event}
					style={pickerStyle}
					recommended={recommended.umas}
					blockReason={(id) => {
						const candidate = index.umasById.get(id)
						return candidate ? umaBlockReason(members, picker.position, candidate, index.umasById) : null
					}}
					selectedId={pickerMember?.uma ?? null}
					onPick={(id) => {
						const uma = index.umasById.get(id)
						if (uma) applyMembers(setMemberUma(members, picker.position, uma))
						setPicker(null)
					}}
					onRemove={
						pickerMember
							? () => {
									applyMembers(clearMember(members, picker.position))
									setPicker(null)
								}
							: undefined
					}
					onClose={() => setPicker(null)}
				/>
			)}
			{picker?.pool === "support" && (
				<PvpCardPicker
					pool="support"
					items={index.catalogue.support_cards}
					title={`${picker.slot === PVP_BORROW_SLOT ? "Borrowed card" : `Card ${picker.slot}`} for ${umaName(picker.position)}`}
					skillsById={index.skillsById}
					event={event}
					style={pickerStyle}
					recommended={recommended.cards}
					blockReason={(id) => cardBlockReason(pickerMember, picker.slot, id)}
					selectedId={pickerMember?.cards.find((card) => card.slot === picker.slot)?.support_card ?? null}
					onPick={(id) => {
						applyMembers(setCard(members, picker.position, picker.slot, id))
						setPicker(null)
					}}
					onRemove={
						pickerMember?.cards.some((card) => card.slot === picker.slot)
							? () => {
									applyMembers(clearCard(members, picker.position, picker.slot))
									setPicker(null)
								}
							: undefined
					}
					onClose={() => setPicker(null)}
				/>
			)}
		</div>
	)
}

function TeamToolbar({ leading, teams, selected, mode, saveState, onSelect, onCreate, onRename, onDelete }: {
	/** Drawn first: the Guide picks button, below xl. */
	leading?: ReactNode
	teams: PvpTeam[]
	selected: PvpTeam | null
	mode: PvpTeamsContextType["mode"]
	saveState: PvpTeamsContextType["saveState"]
	onSelect: (key: string) => void
	onCreate: () => void
	onRename: (name: string) => void
	onDelete: () => void
}) {
	const [renaming, setRenaming] = useState(false)
	const [confirmingDelete, setConfirmingDelete] = useState(false)
	const atCap = teams.length >= PVP_TEAM_CAP_PER_EVENT
	const selectedIndex = selected ? teams.indexOf(selected) : -1

	return (
		<div className="card-panel flex flex-wrap items-center gap-2 p-2">
			{leading}
			{teams.length === 0 ? (
				<p className="px-2 text-sm text-gray-400">Pick an uma below to start your first team for this event.</p>
			) : (
				<>
					<div className="flex flex-wrap gap-1 rounded-lg bg-gray-900/70 p-1" role="group" aria-label="Your teams for this event">
						{teams.map((team, index) => (
							<button
								key={team.key}
								type="button"
								aria-pressed={team === selected}
								onClick={() => {
									onSelect(team.key)
									setRenaming(false)
									setConfirmingDelete(false)
								}}
								className={`max-w-[12rem] truncate rounded-md px-3 py-1.5 text-sm font-medium transition ${
									team === selected
										? "bg-gray-700 text-brand shadow-sm"
										: "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
								}`}
							>
								{teamLabel(team, index)}
							</button>
						))}
					</div>
					<button
						type="button"
						disabled={atCap}
						title={atCap ? `You can keep up to ${PVP_TEAM_CAP_PER_EVENT} teams for one event.` : undefined}
						onClick={onCreate}
						className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-gray-300 transition hover:bg-gray-700 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
					>
						<Plus className="h-4 w-4" />
						New team
					</button>
				</>
			)}

			<div className="ml-auto flex items-center gap-1.5">
				<SaveStatus mode={mode} saveState={saveState} hasTeam={selected !== null} />
				{selected &&
					(renaming ? (
						<RenameField
							initial={selected.name}
							placeholder={teamLabel(selected, selectedIndex)}
							onDone={(name) => {
								if (name !== null) onRename(name)
								setRenaming(false)
							}}
						/>
					) : confirmingDelete ? (
						<span className="flex items-center gap-1.5 text-sm text-gray-300">
							Delete {teamLabel(selected, selectedIndex)}?
							<button
								type="button"
								className="rounded-md border border-highlight/60 px-2 py-1 text-highlight transition hover:bg-highlight/10"
								onClick={() => {
									onDelete()
									setConfirmingDelete(false)
								}}
							>
								Delete
							</button>
							<button
								type="button"
								className="rounded-md border border-gray-600 px-2 py-1 transition hover:bg-gray-700"
								onClick={() => setConfirmingDelete(false)}
							>
								Keep
							</button>
						</span>
					) : (
						<>
							<IconButton label="Rename team" onClick={() => setRenaming(true)}>
								<Pencil className="h-4 w-4" />
							</IconButton>
							<IconButton label="Delete team" onClick={() => setConfirmingDelete(true)}>
								<Trash2 className="h-4 w-4" />
							</IconButton>
						</>
					))}
			</div>
		</div>
	)
}

/** Where the team is saved, as a small icon and a word or two. */
function SaveStatus({ mode, saveState, hasTeam }: {
	mode: PvpTeamsContextType["mode"]
	saveState: PvpTeamsContextType["saveState"]
	hasTeam: boolean
}) {
	if (!hasTeam && saveState !== "error") return null
	let icon: ReactNode
	let text: string
	let tone = "text-gray-400"
	if (saveState === "error") {
		icon = <CloudAlert className="h-4 w-4" />
		text = mode === "guest" ? "Not saved on this device" : "Not saved"
		tone = "text-highlight"
	} else if (mode === "guest") {
		icon = <HardDrive className="h-4 w-4" />
		text = "On this device"
	} else if (saveState === "pending" || saveState === "saving") {
		icon = <Loader2 className="h-4 w-4 animate-spin" />
		text = "Saving…"
	} else {
		icon = <CloudCheck className="h-4 w-4" />
		text = "Saved"
	}
	return (
		<span
			className={`mr-1 flex items-center gap-1.5 text-xs font-medium ${tone}`}
			role="status"
			aria-live="polite"
			title={saveState === "error" && mode !== "guest" ? "Your next change will try again." : undefined}
		>
			{icon}
			{text}
		</span>
	)
}

/** Enter or the tick saves, Escape cancels (null). */
function RenameField({ initial, placeholder, onDone }: {
	initial: string
	placeholder: string
	onDone: (name: string | null) => void
}) {
	const [value, setValue] = useState(initial)
	return (
		<form
			className="flex items-center gap-1"
			onSubmit={(submit) => {
				submit.preventDefault()
				onDone(value.trim())
			}}
		>
			<input
				autoFocus
				aria-label="Team name"
				maxLength={40}
				value={value}
				placeholder={placeholder}
				onChange={(change) => setValue(change.target.value)}
				onKeyDown={(keydown) => {
					if (keydown.key === "Escape") onDone(null)
				}}
				className="w-44 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-gray-100 outline-none focus:border-brand"
			/>
			<IconButton label="Save name" submit>
				<Check className="h-4 w-4" />
			</IconButton>
		</form>
	)
}

function IconButton({ label, onClick, submit = false, children }: {
	label: string
	onClick?: () => void
	submit?: boolean
	children: ReactNode
}) {
	return (
		<button
			type={submit ? "submit" : "button"}
			aria-label={label}
			title={label}
			onClick={onClick}
			className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-700 hover:text-gray-100"
		>
			{children}
		</button>
	)
}

function Notice({ children }: { children: ReactNode }) {
	return <p className="rounded-xl border border-gray-700 bg-gray-800/60 p-4 text-sm text-gray-300">{children}</p>
}
