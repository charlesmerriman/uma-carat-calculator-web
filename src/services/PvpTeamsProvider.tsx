/**
 * The player's PvP teams, shared by everything under /app.
 *
 * ONE PROVIDER, NOT A HOOK PER PAGE. The PvP page's builder and the navbar's
 * team drawer (R2b) edit the same teams, so they read one copy and save
 * through one queue. Mounted in AppShell, inside the calculator provider.
 *
 * LOADED ON FIRST USE. Nothing is read on /app load: the first component
 * that needs teams calls ensureLoaded() (the PvP page's My team view, later
 * the drawer opening).
 *
 * A TAB SAVES THE WAY IT LOADED. Whether this tab is a guest's (teams on the
 * device, services/guestPvpTeamStore.ts) or an account's (the /pvp-teams
 * routes) is decided ONCE, at that first load, from the token, and latched in
 * `modeRef`. The CalculatorProvider's `loadedAsRef` decision, for the same
 * reasons: a guest tab must never start writing to an account because a token
 * appeared in another tab, and an account tab must never leave its teams on a
 * shared computer because the token went away.
 *
 * SAVING. A guest's teams are written to the device on every change; there is
 * nothing to batch. An account's create, rename, pin and delete go out at
 * once; edits to members and notes mark the team dirty and are PUT after a
 * short pause (hooks/useAutoSave.ts), one request per dirty team. Two tabs
 * editing one team: the last write wins, as with plans.
 *
 * MOVING A GUEST'S TEAMS ON SIGN-IN. The first account load finds any teams
 * still on the device, POSTs each one, and clears the ones that landed. A
 * refused one (an event that left the site, a team the server's rules
 * refuse) stays on the device and is offered again next load, never lost.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { useAccount } from "./AuthContext"
import { useCalculatorData } from "./CalculatorContext"
import {
	PvpTeamsContext,
	type PvpTeamsContextType,
	type PvpTeamsSaveState,
	type PvpTeamsStatus,
} from "./PvpTeamsContext"
import {
	clearGuestPvpTeams,
	readGuestPvpTeams,
	subscribeToGuestPvpTeams,
	writeGuestPvpTeams,
	type GuestPvpTeam,
} from "./guestPvpTeamStore"
import {
	pvpTeamCreate,
	pvpTeamDelete,
	pvpTeamPatch,
	pvpTeamReplace,
	pvpTeamsFetch,
} from "./pvpTeamFetchCalls"
import { useAutoSave } from "../hooks/useAutoSave"
import { PVP_TEAM_CAP_PER_EVENT } from "../utils/pvpTeams"
import { sameEvent, type PvpEventRef } from "../utils/pvpEvent"
import type { PvpTeam, PvpTeamContent, PvpTeamPayload } from "../types/pvpTeam"

/** How long after the last edit an account's teams are PUT. */
const SAVE_DELAY_MS = 1500

/** The toast when a POST or PUT is refused without a reason in the body. */
const SAVE_FAILED = "Your team couldn't be saved. Try again in a moment."

let nextLocalKey = 1
const localKey = (): string => `local-${nextLocalKey++}`

function fromPayload(payload: PvpTeamPayload): PvpTeam {
	return {
		key: `team-${payload.id}`,
		id: payload.id,
		kind: payload.kind,
		event: payload.event,
		name: payload.name,
		isFocus: payload.is_focus,
		notes: payload.notes,
		members: payload.members,
		updatedAt: Date.parse(payload.updated_at) || 0,
		post: payload.post ?? null,
	}
}

function fromGuest(team: GuestPvpTeam): PvpTeam {
	return {
		key: localKey(),
		id: null,
		kind: team.kind,
		event: team.event,
		name: team.name,
		isFocus: team.focus,
		notes: team.notes,
		members: team.members,
		updatedAt: team.updatedAt,
	}
}

function toGuest(team: PvpTeam): GuestPvpTeam {
	return {
		kind: team.kind,
		event: team.event,
		name: team.name,
		focus: team.isFocus,
		notes: team.notes,
		members: team.members,
		updatedAt: team.updatedAt,
	}
}

const isKnownEvent = (known: Set<string>, team: { kind: string; event: number }): boolean =>
	known.has(`${team.kind}-${team.event}`)

const contentOf = (team: Pick<PvpTeam, "name" | "notes" | "members">): PvpTeamContent => ({
	name: team.name,
	notes: team.notes,
	members: team.members,
})

/** The refusal sentence the server wrote for the player, if the body has one. */
async function refusalMessage(response: Response): Promise<string> {
	try {
		const body = (await response.json()) as { error?: unknown }
		return typeof body.error === "string" && body.error ? body.error : SAVE_FAILED
	} catch {
		return SAVE_FAILED
	}
}

export function PvpTeamsProvider({ children }: { children: ReactNode }) {
	const { isLoggedIn } = useAccount()
	const { championsMeetingData, leagueOfHeroesData } = useCalculatorData()

	const [status, setStatus] = useState<PvpTeamsStatus>("idle")
	const [mode, setMode] = useState<"guest" | "account" | null>(null)
	const [teams, setTeams] = useState<PvpTeam[]>([])
	const [requestState, setRequestState] = useState<"idle" | "saving" | "saved" | "error">("idle")

	// The latest teams for code that runs outside a render (the save queue,
	// the create callbacks). Written by commit() together with the state.
	const teamsRef = useRef<PvpTeam[]>([])
	const modeRef = useRef<"guest" | "account" | null>(null)
	const startedRef = useRef(false)
	// Account teams with member or note edits not yet PUT, by key.
	const dirtyRef = useRef(new Set<string>())
	// Keys deleted while their create was still out; the create's reply
	// deletes the server copy instead of adopting it.
	const deletedRef = useRef(new Set<string>())
	const warnedStorageRef = useRef(false)

	// The events this site still lists. A team for an event that left it is
	// kept (on the device or the server) but not shown: filtering here, at
	// read time, rather than when the teams load, because the first load runs
	// from a child's effect in the same commit that brings the events in.
	const knownEvents = useMemo(() => {
		const keys = new Set<string>()
		for (const event of championsMeetingData ?? []) keys.add(`cm-${event.id}`)
		for (const event of leagueOfHeroesData ?? []) keys.add(`loh-${event.id}`)
		return keys
	}, [championsMeetingData, leagueOfHeroesData])
	const shownTeams = useMemo(() => teams.filter((team) => isKnownEvent(knownEvents, team)), [teams, knownEvents])

	/** Set the teams, and for a guest put them on the device. */
	const commit = useCallback((next: PvpTeam[]) => {
		teamsRef.current = next
		setTeams(next)
		if (modeRef.current !== "guest") return
		const landed = writeGuestPvpTeams(next.map(toGuest))
		setRequestState(landed ? "saved" : "error")
		if (!landed && !warnedStorageRef.current) {
			// Once per tab: every later edit would refuse the same way.
			warnedStorageRef.current = true
			toast.error("This browser won't keep your teams. Sign in to save them to your account.")
		}
	}, [])

	const update = useCallback(
		(key: string, change: (team: PvpTeam) => PvpTeam) =>
			commit(teamsRef.current.map((team) => (team.key === key ? change(team) : team))),
		[commit]
	)

	// ── The account save queue ──────────────────────────────────────────────

	const saveDirty = useCallback(async () => {
		const keys = [...dirtyRef.current]
		if (keys.length === 0) return
		setRequestState("saving")
		let failed = false
		for (const key of keys) {
			const team = teamsRef.current.find((candidate) => candidate.key === key)
			if (!team) {
				dirtyRef.current.delete(key)
				continue
			}
			// Still being created: its create reply re-arms the timer.
			if (team.id === null) continue
			dirtyRef.current.delete(key)
			try {
				const response = await pvpTeamReplace(team.id, team.members, team.notes)
				if (!response.ok) {
					failed = true
					// A refusal is about this exact team; sending it again would be
					// refused again. The player's next edit tries once more.
					toast.error(await refusalMessage(response))
				}
			} catch {
				failed = true
				// The network: keep it dirty so the next edit's save retries it.
				dirtyRef.current.add(key)
			}
		}
		setRequestState(failed ? "error" : "saved")
	}, [])

	const { timerIsGoing, startTimer } = useAutoSave({ saveFn: saveDirty, delayMs: SAVE_DELAY_MS })

	// Leaving /app unmounts this provider, and useAutoSave's own cleanup would
	// drop a pending save on the floor. Send it instead.
	useEffect(() => () => void saveDirty(), [saveDirty])

	// ── Loading ─────────────────────────────────────────────────────────────

	/** Device teams into the account. Returns the payloads that landed. */
	const importGuestTeams = useCallback(async (): Promise<PvpTeamPayload[]> => {
		const stored = readGuestPvpTeams()
		if (stored.length === 0) return []
		const landed: PvpTeamPayload[] = []
		const kept: GuestPvpTeam[] = []
		for (const team of stored) {
			try {
				const response = await pvpTeamCreate({ kind: team.kind, id: team.event }, contentOf(team))
				if (response.ok) landed.push((await response.json()) as PvpTeamPayload)
				else kept.push(team)
			} catch {
				kept.push(team)
			}
		}
		if (kept.length === 0) clearGuestPvpTeams()
		else writeGuestPvpTeams(kept)
		if (landed.length > 0) toast.success("Your teams from this device were added to your account.")
		return landed
	}, [])

	const loadAccount = useCallback(async () => {
		try {
			await importGuestTeams()
			const response = await pvpTeamsFetch()
			if (!response.ok) throw new Error(`GET /pvp-teams failed: ${response.status}`)
			const payloads = (await response.json()) as PvpTeamPayload[]
			commit(payloads.map(fromPayload))
			setStatus("ready")
		} catch (error) {
			console.error(error)
			setStatus("error")
		}
	}, [commit, importGuestTeams])

	const loadGuest = useCallback(() => {
		teamsRef.current = readGuestPvpTeams().map(fromGuest)
		setTeams(teamsRef.current)
		setStatus("ready")
	}, [])

	const ensureLoaded = useCallback(() => {
		if (startedRef.current) return
		startedRef.current = true
		const latched = isLoggedIn ? "account" : "guest"
		modeRef.current = latched
		setMode(latched)
		setStatus("loading")
		if (latched === "account") void loadAccount()
		else loadGuest()
	}, [isLoggedIn, loadAccount, loadGuest])

	// Another guest tab changed the teams: take its copy, so this tab's next
	// edit does not write an old list over newer work.
	useEffect(() => {
		if (mode !== "guest") return
		return subscribeToGuestPvpTeams(() => {
			teamsRef.current = readGuestPvpTeams().map(fromGuest)
			setTeams(teamsRef.current)
		})
	}, [mode])

	// ── Edits ───────────────────────────────────────────────────────────────

	const markDirty = useCallback(
		(key: string) => {
			if (modeRef.current !== "account") return
			dirtyRef.current.add(key)
			startTimer()
		},
		[startTimer]
	)

	/** An account team's create came back: adopt its id, then catch up on whatever changed meanwhile. */
	const adoptCreated = useCallback(
		async (key: string, payload: PvpTeamPayload) => {
			if (deletedRef.current.has(key)) {
				deletedRef.current.delete(key)
				void pvpTeamDelete(payload.id)
				return
			}
			update(key, (team) => ({ ...team, id: payload.id }))
			const team = teamsRef.current.find((candidate) => candidate.key === key)
			if (!team) return
			if (team.name !== payload.name || team.isFocus !== payload.is_focus) {
				void pvpTeamPatch(payload.id, { name: team.name, is_focus: team.isFocus })
			}
			if (dirtyRef.current.has(key)) startTimer()
		},
		[startTimer, update]
	)

	const createTeam = useCallback(
		(ref: PvpEventRef, content: Partial<PvpTeamContent> = {}): string | null => {
			const forEvent = teamsRef.current.filter((team) => sameEvent({ kind: team.kind, id: team.event }, ref))
			if (forEvent.length >= PVP_TEAM_CAP_PER_EVENT) return null
			const team: PvpTeam = {
				key: localKey(),
				id: null,
				kind: ref.kind,
				event: ref.id,
				name: content.name ?? "",
				isFocus: false,
				notes: content.notes ?? [],
				members: content.members ?? [],
				updatedAt: Date.now(),
			}
			commit([...teamsRef.current, team])
			if (modeRef.current === "account") {
				setRequestState("saving")
				void pvpTeamCreate(ref, contentOf(team))
					.then(async (response) => {
						if (!response.ok) {
							commit(teamsRef.current.filter((candidate) => candidate.key !== team.key))
							dirtyRef.current.delete(team.key)
							setRequestState("error")
							toast.error(await refusalMessage(response))
							return
						}
						await adoptCreated(team.key, (await response.json()) as PvpTeamPayload)
						setRequestState("saved")
					})
					.catch(() => {
						commit(teamsRef.current.filter((candidate) => candidate.key !== team.key))
						setRequestState("error")
						toast.error(SAVE_FAILED)
					})
			}
			return team.key
		},
		[adoptCreated, commit]
	)

	const editTeam = useCallback<PvpTeamsContextType["editTeam"]>(
		(key, changes) => {
			update(key, (team) => ({ ...team, ...changes, updatedAt: Date.now() }))
			markDirty(key)
		},
		[markDirty, update]
	)

	const renameTeam = useCallback(
		(key: string, name: string) => {
			update(key, (team) => ({ ...team, name, updatedAt: Date.now() }))
			const team = teamsRef.current.find((candidate) => candidate.key === key)
			// No id yet: adoptCreated sends the name once there is one.
			if (modeRef.current === "account" && team?.id != null) void pvpTeamPatch(team.id, { name })
		},
		[update]
	)

	const pinTeam = useCallback(
		(key: string | null) => {
			const previous = teamsRef.current.find((team) => team.isFocus)
			if ((previous?.key ?? null) === key) return
			commit(teamsRef.current.map((team) => ({ ...team, isFocus: team.key === key })))
			if (modeRef.current !== "account") return
			// One request: pinning moves the server's pin, unpinning clears it.
			const target = key ? teamsRef.current.find((team) => team.key === key) : previous
			if (target?.id != null) void pvpTeamPatch(target.id, { is_focus: key !== null })
		},
		[commit]
	)

	const deleteTeam = useCallback(
		(key: string) => {
			const team = teamsRef.current.find((candidate) => candidate.key === key)
			if (!team) return
			commit(teamsRef.current.filter((candidate) => candidate.key !== key))
			dirtyRef.current.delete(key)
			if (modeRef.current !== "account") return
			if (team.id === null) deletedRef.current.add(key)
			else void pvpTeamDelete(team.id)
		},
		[commit]
	)

	const setTeamPost = useCallback(
		(key: string, publicId: string | null) => {
			const team = teamsRef.current.find((candidate) => candidate.key === key)
			if (!team) return
			// One post per event: posting this team moves the post off any other
			// team for the same event, as the server does.
			commit(
				teamsRef.current.map((candidate) => {
					if (candidate.key === key) return { ...candidate, post: publicId }
					const sameEventTeam = candidate.kind === team.kind && candidate.event === team.event
					return sameEventTeam && publicId !== null ? { ...candidate, post: null } : candidate
				})
			)
		},
		[commit]
	)

	const saveState: PvpTeamsSaveState = timerIsGoing ? "pending" : requestState

	const value = useMemo<PvpTeamsContextType>(
		() => ({
			status,
			mode,
			teams: shownTeams,
			saveState,
			ensureLoaded,
			createTeam,
			editTeam,
			renameTeam,
			pinTeam,
			deleteTeam,
			setTeamPost,
		}),
		[status, mode, shownTeams, saveState, ensureLoaded, createTeam, editTeam, renameTeam, pinTeam, deleteTeam, setTeamPost]
	)

	return <PvpTeamsContext.Provider value={value}>{children}</PvpTeamsContext.Provider>
}
