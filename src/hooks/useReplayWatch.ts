/**
 * CM Runs watching umadump's folder (notes/cm-runs-plan-2.md, PR 6), and the
 * one ReplayContext the watch and "Fill from replays" share.
 *
 * While the view is open and the tab visible, the folder is read every five
 * seconds. Each file is opened once (by name and modified time) and read by
 * umadumpReplays; a file that isn't whole yet fails to parse and is tried
 * again next time. The races found go through planReplays with the runs as
 * they are, and watchStep picks what to do:
 *
 *   - a group with a race that arrived while watching, which adds cleanly
 *     (a new ticket, or a fill), is saved at once through useSaveRun, merged
 *     again at save time (mergeReplays), so a tap still wins;
 *   - anything else that needs the player is counted ("3 replays need a
 *     look"), and the button opens the preview with every race read.
 *
 * The files there when the watch starts are never saved on their own: they
 * may be another day's, already typed in by hand.
 *
 * Polls only once the runs and the catalogue are loaded (`ready`): a plan
 * against an empty list would call every logged ticket new.
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { canWatchFolder, folderPermission, forgetFolder, listReplayFiles, pickFolder, replayFolderOf, savedFolder, type DirectoryHandle } from "../services/replayFolder"
import { readReplayFile, type ReplayRace } from "../utils/gameImport/umadumpReplays"
import { mergeReplays, planReplays, watchStep, type PlannedGroup, type ReplayContext } from "../utils/replayTickets"
import { formatTime } from "../utils/dateFormat"
import type { RunChange } from "../services/pvpRunQueries"
import type { CalculationConstants, RaceEvent } from "../types"
import type { CatalogueUma, PvpTeam } from "../types/pvpTeam"
import type { PvpRun, PvpRunSlot } from "../types/pvpRun"
import type { TrainedUma } from "../types/trainedUma"

/** The plan's interval: fast enough to follow a ticket, slow enough to be free. */
const POLL_MS = 5_000

/** The game's ids to the site's, from the catalogue and the account's veterans. */
export function useReplayContext(event: RaceEvent, constants: CalculationConstants, umas: CatalogueUma[], veterans: TrainedUma[], teams: PvpTeam[]): ReplayContext {
	return useMemo(
		() => ({
			event,
			constants,
			umaByCard: new Map(umas.filter((uma) => uma.game_id != null).map((uma) => [uma.game_id as number, uma.id])),
			veteranByKey: new Map(veterans.filter((veteran) => veteran.import_key != null).map((veteran) => [veteran.import_key as number, veteran.id])),
			teams,
		}),
		[event, constants, umas, veterans, teams]
	)
}

const noSubscription = () => () => {}

export type WatchState = "off" | "needs-grant" | "watching"

export interface ReplayWatch {
	/** Chrome and Edge only; false on the server and in other browsers. */
	supported: boolean
	state: WatchState
	/** The folder's name, as the browser gives it. */
	folderName: string | null
	/** "Day 4, Ticket 1: race 3 added at 14:05", the last save, or null. */
	last: string | null
	/** Races that need the player: open the preview with `races`. */
	needLook: number
	/** Every CM race read from the folder, for the preview. */
	races: ReplayRace[]
	start: () => void
	regrant: () => void
	stop: () => void
}

export function useReplayWatch({ ready, runs, ctx, onSave }: {
	/** The runs and the catalogue are loaded. */
	ready: boolean
	runs: PvpRun[]
	ctx: ReplayContext
	onSave: (slot: PvpRunSlot, change: RunChange) => void
}): ReplayWatch {
	const supported = useSyncExternalStore(noSubscription, canWatchFolder, () => false)
	const [folder, setFolder] = useState<DirectoryHandle | null>(null)
	const [state, setState] = useState<WatchState>("off")
	const [last, setLast] = useState<string | null>(null)
	const [needLook, setNeedLook] = useState(0)
	const [races, setRaces] = useState<ReplayRace[]>([])
	// The poll reads the latest of these without restarting.
	const live = useRef({ runs, ctx, onSave })
	useEffect(() => {
		live.current = { runs, ctx, onSave }
	}, [runs, ctx, onSave])
	// Each file once, by name and time: its race, or null for a file that isn't one.
	const seen = useRef(new Map<string, ReplayRace | null>())
	const started = useRef(false)
	const fresh = useRef(new Set<ReplayRace>())

	const reset = () => {
		seen.current = new Map()
		started.current = false
		fresh.current = new Set()
		setRaces([])
		setNeedLook(0)
		setLast(null)
	}

	// A folder picked on an earlier visit, with the grant the browser kept.
	useEffect(() => {
		if (!supported) return
		let cancelled = false
		void savedFolder().then(async (handle) => {
			if (!handle || cancelled) return
			const permission = await folderPermission(handle)
			if (cancelled) return
			setFolder(handle)
			setState(permission === "granted" ? "watching" : "needs-grant")
		})
		return () => {
			cancelled = true
		}
	}, [supported])

	useEffect(() => {
		if (state !== "watching" || !folder || !ready) return
		let busy = false
		const poll = async () => {
			if (busy || document.hidden) return
			busy = true
			try {
				const files = await listReplayFiles(await replayFolderOf(folder))
				const first = !started.current
				for (const file of files) {
					const key = `${file.name}:${file.lastModified}`
					if (seen.current.has(key)) continue
					let json: unknown
					try {
						json = JSON.parse(await file.text())
					} catch {
						// Not whole yet (umadump still writing it), or not JSON: next time.
						continue
					}
					const result = readReplayFile(json, file.lastModified)
					const race = result.kind === "race" ? result.race : null
					seen.current.set(key, race)
					if (race && !first) fresh.current.add(race)
				}
				started.current = true
				const all = [...seen.current.values()].filter((race): race is ReplayRace => race !== null)
				const { runs: current, ctx: context, onSave: save } = live.current
				const step = watchStep(planReplays(all, current, context), fresh.current)
				for (const group of step.save) {
					const slot = group.slot as PvpRunSlot
					save(slot, (content) => mergeReplays(content, group.races, context, slot.stage === "final").content ?? content)
				}
				const saved = step.save.at(-1)
				if (saved) setLast(describe(saved, fresh.current))
				setNeedLook(step.look.reduce((sum, group) => sum + group.races.length, 0))
				setRaces(all)
			} catch {
				// The folder went away or the grant was taken back: one click asks again.
				setState("needs-grant")
			} finally {
				busy = false
			}
		}
		void poll()
		const timer = window.setInterval(() => void poll(), POLL_MS)
		const onVisible = () => {
			if (!document.hidden) void poll()
		}
		document.addEventListener("visibilitychange", onVisible)
		return () => {
			window.clearInterval(timer)
			document.removeEventListener("visibilitychange", onVisible)
		}
	}, [state, folder, ready])

	return {
		supported,
		state,
		folderName: folder?.name ?? null,
		last,
		needLook,
		races,
		start: () => {
			void pickFolder().then((handle) => {
				if (!handle) return
				reset()
				setFolder(handle)
				setState("watching")
			})
		},
		regrant: () => {
			if (!folder) return
			void folderPermission(folder, true).then((permission) => {
				if (permission === "granted") setState("watching")
			})
		},
		stop: () => {
			void forgetFolder()
			reset()
			setFolder(null)
			setState("off")
		},
	}
}

/** "Day 4, Ticket 1: race 3 added at 14:05": the races of the group that arrived while watching. */
function describe(group: PlannedGroup, fresh: ReadonlySet<ReplayRace>): string {
	const where = group.slot?.stage === "final" ? "Finals" : `Day ${group.day}, Ticket ${group.slot && "ticket" in group.slot ? group.slot.ticket : "?"}`
	const numbers = group.races.flatMap((race, index) => (fresh.has(race) ? [index + 1] : []))
	const which = numbers.length === 1 ? `race ${numbers[0]}` : `races ${numbers.join(", ")}`
	return `${where}: ${which} added at ${formatTime(new Date().toISOString())}`
}
