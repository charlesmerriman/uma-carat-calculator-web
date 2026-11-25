/**
 * CM Runs' "Fill from replays" (notes/cm-runs-plan-2.md, PR 5): umadump's race
 * replay files, dropped or chosen, read in the browser, previewed per day,
 * then saved ticket by ticket through useSaveRun, the path every tap takes.
 *
 * Read: utils/gameImport/umadumpReplays.ts (only the player's own three and
 * the winning uma ever leave a file). Slotted and merged:
 * utils/replayTickets.ts (a tapped result is never overwritten; a ticket that
 * disagrees is shown and left as it is).
 *
 * The site never tells a player to run umadump (it reads game memory, at the
 * player's own risk): the copy says "if you use umadump" and links it as a
 * community tool, like the Collection import.
 *
 * Folders: "Choose the folder" uses `webkitdirectory`, which every desktop
 * browser has; any file in it that isn't a CM race replay is counted and
 * skipped, so picking umadump's whole folder works too. A dropped folder isn't
 * read (that needs the entry API); dropping its files is.
 */

import { useMemo, useState, type DragEvent } from "react"
import { toast } from "sonner"
import { FileUp, FolderOpen } from "lucide-react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { readReplayFile, type ReplayRace } from "../../utils/gameImport/umadumpReplays"
import { mergeReplays, planReplays, type PlannedGroup, type ReplayContext } from "../../utils/replayTickets"
import { ACTION_BUTTON, PRIMARY_BUTTON } from "./gallery/galleryStyles"
import type { RunChange } from "../../services/pvpRunQueries"
import type { RaceEvent } from "../../types"
import type { CatalogueUma, PvpTeam } from "../../types/pvpTeam"
import type { PvpRun, PvpRunSlot } from "../../types/pvpRun"
import type { TrainedUma } from "../../types/trainedUma"

/** Where umadump is published: a community tool the site does not make. */
const UMADUMP_URL = "https://github.com/Werseter/umadump"

/** What the chosen files held. */
interface ReadReplays {
	races: ReplayRace[]
	/** Replays of other race types (League of Heroes, room matches...). */
	otherRaces: number
	/** Files that aren't race replays, or aren't JSON. */
	notReplays: number
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

// `webkitdirectory` isn't in React's input types; every desktop browser has it.
const FOLDER_PICKER = { webkitdirectory: "" } as Record<string, string>

export function ReplayImport({ event, runs, teams, umas, veterans, onSave, onSaved, onClose }: {
	event: RaceEvent
	runs: PvpRun[]
	/** The event's teams: a new ticket takes a matching one's spots and id. */
	teams: PvpTeam[]
	umas: CatalogueUma[]
	veterans: TrainedUma[]
	onSave: (slot: PvpRunSlot, change: RunChange) => void
	/** After saving: the first day written, to show it. */
	onSaved: (day: number | "final") => void
	onClose: () => void
}) {
	const { calculationConstants } = useCalculatorData()
	const [read, setRead] = useState<ReadReplays | null>(null)
	const [reading, setReading] = useState(false)
	const [dragging, setDragging] = useState(false)

	const ctx: ReplayContext = useMemo(
		() => ({
			event,
			constants: calculationConstants,
			umaByCard: new Map(umas.filter((uma) => uma.game_id != null).map((uma) => [uma.game_id as number, uma.id])),
			veteranByKey: new Map(veterans.filter((veteran) => veteran.import_key != null).map((veteran) => [veteran.import_key as number, veteran.id])),
			teams,
		}),
		[event, calculationConstants, umas, veterans, teams]
	)
	// Worked out against the runs as they are now, so a tap meanwhile shows.
	const plan = useMemo(() => (read ? planReplays(read.races, runs, ctx) : null), [read, runs, ctx])
	const saving = plan?.groups.filter((group) => group.slot && (group.outcome.status === "new" || group.outcome.status === "fill")) ?? []
	const savedRaces = saving.reduce((sum, group) => sum + group.races.length, 0)

	const open = async (files: FileList | File[] | null) => {
		const list = Array.from(files ?? [])
		if (list.length === 0) return
		setReading(true)
		const next: ReadReplays = { races: [], otherRaces: 0, notReplays: 0 }
		for (const file of list) {
			if (!file.name.toLowerCase().endsWith(".json")) {
				next.notReplays += 1
				continue
			}
			let json: unknown
			try {
				json = JSON.parse(await file.text())
			} catch {
				next.notReplays += 1
				continue
			}
			// The file's own time is when the race was seen; nothing inside says.
			const result = readReplayFile(json, file.lastModified)
			if (result.kind === "race") next.races.push(result.race)
			else if (result.kind === "other-race") next.otherRaces += 1
			else next.notReplays += 1
		}
		setRead(next)
		setReading(false)
	}

	const drop = (dropped: DragEvent<HTMLElement>) => {
		dropped.preventDefault()
		setDragging(false)
		void open(dropped.dataTransfer.files)
	}

	const save = () => {
		for (const group of saving) {
			const slot = group.slot as PvpRunSlot
			// Merged again on the ticket as it is when the save runs: a tap still wins.
			onSave(slot, (current) => mergeReplays(current, group.races, ctx, slot.stage === "final").content ?? current)
		}
		toast.success(`Filled ${plural(saving.length, "ticket")} from ${plural(savedRaces, "race")}.`)
		if (saving[0]) onSaved(saving[0].day)
		onClose()
	}

	return (
		<section className="card-panel flex flex-col gap-3 p-4" aria-label="Fill from replays">
			<h3 className="text-sm font-semibold text-gray-100">Fill from replays</h3>
			<p className="text-xs leading-relaxed text-gray-400">
				If you use{" "}
				<a href={UMADUMP_URL} target="_blank" rel="noreferrer" className="text-brand hover:text-brand/75">
					umadump
				</a>{" "}
				(a community tool we don&apos;t make, for the Steam version), its daemon mode writes a file for each race you run, in{" "}
				<code className="text-gray-300">race_replays/champions_race</code> inside the folder umadump ran from. Run as administrator,
				that&apos;s <code className="text-gray-300">C:\Windows\System32</code>. The files are read here, in your browser. Only your own
				umas&apos; places, why they lost and the uma that won each race are saved. Other players&apos; names and builds stay on your
				device.
			</p>

			<div
				onDragOver={(over) => {
					over.preventDefault()
					setDragging(true)
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={drop}
				className={`flex flex-col items-center gap-2.5 rounded-xl border-2 border-dashed px-4 py-5 text-center text-sm ${
					dragging ? "border-brand text-gray-100" : "border-gray-600 text-gray-300"
				}`}
			>
				Drop the replay files here, or
				<span className="flex flex-wrap justify-center gap-2">
					<label className={`${ACTION_BUTTON} cursor-pointer`}>
						<FileUp className="h-4 w-4" aria-hidden="true" />
						Choose files
						<input type="file" multiple accept=".json,application/json" className="sr-only" onChange={(change) => void open(change.target.files)} />
					</label>
					<label className={`${ACTION_BUTTON} cursor-pointer`}>
						<FolderOpen className="h-4 w-4" aria-hidden="true" />
						Choose the folder
						<input type="file" {...FOLDER_PICKER} className="sr-only" onChange={(change) => void open(change.target.files)} />
					</label>
				</span>
			</div>

			{reading && <p className="text-sm text-gray-400" role="status">Reading the files…</p>}

			{read && plan && (
				<section className="flex flex-col gap-2" aria-label="What the replays fill">
					{read.races.length === 0 ? (
						<p className="text-sm text-highlight" role="alert">
							None of these files is a Champions Meeting race replay.
						</p>
					) : (
						<p className="text-sm text-gray-300">{plural(read.races.length, "CM race")} in the files.</p>
					)}
					<Preview groups={plan.groups} />
					<ul className="flex flex-col gap-0.5 text-xs text-gray-400">
						{plan.outside > 0 && <li>{plural(plan.outside, "race isn't", "races aren't")} from this CM&apos;s days, left out.</li>}
						{read.otherRaces > 0 && <li>{plural(read.otherRaces, "replay is", "replays are")} of another kind of race, left out.</li>}
						{read.notReplays > 0 && <li>{plural(read.notReplays, "file isn't a race replay", "files aren't race replays")}, skipped.</li>}
					</ul>
					<p className="text-xs text-gray-400">
						Races are grouped by when each file was written: five to a ticket, or a new ticket when your three change. Anything
						you already logged stays as you logged it. The replays only add what&apos;s missing.
					</p>
				</section>
			)}

			<div className="flex justify-end gap-2">
				<button type="button" className={ACTION_BUTTON} onClick={onClose}>
					Cancel
				</button>
				<button type="button" className={PRIMARY_BUTTON} disabled={saving.length === 0} onClick={save}>
					{/* Mock 06's label: the races the save writes. */}
					{savedRaces > 1 ? `Save ${savedRaces} races` : "Save"}
				</button>
			</div>
		</section>
	)
}

/** Per day: each group's ticket and what saving does there. */
function Preview({ groups }: { groups: PlannedGroup[] }) {
	const days = [...new Set(groups.map((group) => group.day))]
	return (
		<div className="flex flex-col gap-2">
			{days.map((day) => {
				const inDay = groups.filter((group) => group.day === day)
				const races = inDay.reduce((sum, group) => sum + group.races.length, 0)
				return (
					<div key={day} className="rounded-lg border border-edge bg-gray-900/40 px-3 py-2">
						<div className="text-xs font-semibold text-gray-100">
							{day === "final" ? "Finals" : `Day ${day}`}: {plural(races, "race")}
						</div>
						<ul className="mt-1 flex flex-col gap-0.5 text-xs">
							{inDay.map((group, index) => (
								<li key={index} className={group.outcome.status === "mismatch" ? "text-highlight" : "text-gray-300"}>
									{slotName(group)} · {plural(group.races.length, "race")} · {outcomeText(group)}
								</li>
							))}
						</ul>
					</div>
				)
			})}
		</div>
	)
}

function slotName(group: PlannedGroup): string {
	if (!group.slot) return "No ticket left"
	return group.slot.stage === "final" ? "Finals" : `Ticket ${group.slot.ticket}`
}

function outcomeText({ outcome }: PlannedGroup): string {
	switch (outcome.status) {
		case "new":
			return "new"
		case "same":
			return "nothing to add"
		case "mismatch":
			return `left out: ${outcome.reason}`
		case "fill": {
			const parts = [
				outcome.added > 0 && `${plural(outcome.added, "race")} added`,
				outcome.placed > 0 && `places on ${plural(outcome.placed, "race")}`,
				outcome.named > 0 && `who won ${plural(outcome.named, "loss", "losses")}`,
			].filter(Boolean)
			return parts.join(", ")
		}
	}
}
