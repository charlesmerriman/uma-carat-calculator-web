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

import { useEffect, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Check, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { usePvpTeams } from "../../services/PvpTeamsContext"
import { usePvpCatalogue, type PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"
import { usePvpGuide } from "../../hooks/usePvpGuide"
import { refForRaceEvent, sameEvent } from "../../utils/pvpEvent"
import {
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
import { PvpCardPicker } from "./PvpCardPicker"
import { TeamGrid } from "./TeamGrid"
import type { RaceEvent } from "../../types"
import type { PvpTeam, PvpTeamMember } from "../../types/pvpTeam"
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

	return (
		<div className="flex flex-col gap-3">
			<TeamTabs
				teams={eventTeams}
				selected={team}
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

			<div className="mx-auto w-full max-w-3xl">
				<TeamGrid
					members={members}
					umasById={index.umasById}
					cardsById={index.cardsById}
					onPickUma={(position) => setPicker({ pool: "uma", position })}
					onPickCard={(position, slot) => setPicker({ pool: "support", position, slot })}
					onStyleChange={(position, style) => applyMembers(setMemberStyle(members, position, style))}
					onClearUma={(position) => applyMembers(clearMember(members, position))}
					onClearCard={(position, slot) => applyMembers(clearCard(members, position, slot))}
				/>
				<SaveLine mode={mode} saveState={saveState} hasTeam={team !== null} />
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

function TeamTabs({ teams, selected, onSelect, onCreate, onRename, onDelete }: {
	teams: PvpTeam[]
	selected: PvpTeam | null
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
		<div className="flex flex-wrap items-center gap-2">
			<div className="flex flex-wrap gap-1.5" role="group" aria-label="Your teams for this event">
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
						className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
							team === selected
								? "border-brand bg-brand/15 text-brand"
								: "border-gray-600 text-gray-300 hover:border-gray-500 hover:text-gray-100"
						}`}
					>
						{teamLabel(team, index)}
					</button>
				))}
				{teams.length > 0 && (
					<button
						type="button"
						disabled={atCap}
						title={atCap ? `You can keep up to ${PVP_TEAM_CAP_PER_EVENT} teams for one event.` : undefined}
						onClick={onCreate}
						className="flex items-center gap-1 rounded-full border border-dashed border-gray-600 px-3 py-1 text-sm text-gray-300 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
					>
						<Plus className="h-3.5 w-3.5" />
						New team
					</button>
				)}
			</div>

			{selected && (
				<div className="ml-auto flex items-center gap-1.5">
					{renaming ? (
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
								className="rounded border border-highlight/60 px-2 py-0.5 text-highlight transition hover:bg-highlight/10"
								onClick={() => {
									onDelete()
									setConfirmingDelete(false)
								}}
							>
								Delete
							</button>
							<button
								type="button"
								className="rounded border border-gray-600 px-2 py-0.5 transition hover:bg-gray-700"
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
					)}
				</div>
			)}
		</div>
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
			className="flex h-8 w-8 items-center justify-center rounded border border-gray-600 text-gray-300 transition hover:bg-gray-700 hover:text-gray-100"
		>
			{children}
		</button>
	)
}

function SaveLine({ mode, saveState, hasTeam }: {
	mode: PvpTeamsContextType["mode"]
	saveState: PvpTeamsContextType["saveState"]
	hasTeam: boolean
}) {
	let text: ReactNode
	if (saveState === "error") {
		text = mode === "guest"
			? "This browser didn't keep your last change."
			: "Your last change didn't save. Your next change will try again."
	} else if (!hasTeam) {
		text = "Pick an uma to start a team."
	} else if (mode === "guest") {
		text = (
			<>
				Saved on this device.{" "}
				<Link to="/login" className="text-brand transition hover:text-brand/75">
					Sign in
				</Link>{" "}
				to keep your teams on every device.
			</>
		)
	} else if (saveState === "pending" || saveState === "saving") {
		text = "Saving…"
	} else {
		text = "Saved to your account."
	}
	return (
		<p className="mt-2 text-xs text-gray-400" role="status" aria-live="polite">
			{text}
		</p>
	)
}

function Notice({ children }: { children: ReactNode }) {
	return <p className="rounded-xl border border-gray-700 bg-gray-800/60 p-4 text-sm text-gray-300">{children}</p>
}
