/**
 * Reads umadump's race replay files in the browser, for CM Runs' "Fill from
 * replays" (notes/cm-runs-plan-2.md, PR 5).
 *
 * umadump (github.com/Werseter/umadump) is a community tool the site does not
 * make. Started with `--rerun-mode daemon` it writes one JSON file per race it
 * sees, into `race_replays/champions_race/` under the folder it was started
 * from (run as administrator, that is C:\Windows\System32; owner, 2026-11-25).
 *
 * WHAT IS READ, AND WHAT NEVER LEAVES THE DEVICE
 * ----------------------------------------------
 * A replay holds all nine runners with their trainers' names, account ids,
 * stats and skills. This reads exactly, and keeps nothing else:
 *
 *   per one of the player's three   card_id (the outfit), running_style,
 *                                   trained_chara_id (the Collection import's
 *                                   import_key), finishOrder, defeat
 *   for the race's winner           card_id, running_style, whether she is ours
 *   the file                        its modified time (to group races into tickets)
 *
 * No name or account id is copied out of the file, so none can be sent.
 *
 * RECOGNISED BY SHAPE, NEVER BY NAME: `raceType`, `raceHorse` and
 * `playerTeamMemberArray`, as the Collection import does. Only `Champions`
 * (a CM race) is taken; League of Heroes (`Heroes`) waits until its field
 * size is known.
 *
 * WHAT THE OWNER'S CM 22 FILES SHOWED (2026-11-25, five Round 2 races):
 * `finishOrder` counts from 0, so place = finishOrder + 1; `running_style`
 * 1 to 4 is front, pace, late, end (the game's nige, senko, sashi, oikomi);
 * a race whose animation is skipped still writes a file; and there is no race
 * or ticket number in it, so tickets come from the files' times
 * (utils/replayTickets.ts).
 */

import type { MemberStyle } from "../../types/pvpTeam"

/** The game's own reasons a runner lost (umadump's DefeatType), as the API's PvpLossReason lists them. */
export const LOSS_REASONS = [
	"Win",
	"Lose",
	"RunningStyleMany",
	"Temptaion", // sic, the game's spelling
	"GutsOrder",
	"Stamina",
	"LastSpurtFalse",
	"LastSpurtTargetSpeedDec",
	"PassiveSkillNum",
	"BlockFrontTime",
	"Speed",
	"ProperDistance",
	"ProperGround",
	"Motivation",
] as const

/** `running_style` 1 to 4, in the game's order. */
const STYLES: Record<number, MemberStyle> = { 1: "front", 2: "pace", 3: "late", 4: "end" }

/** One of the player's three in one race. */
export interface ReplayRunner {
	/** The outfit (our Uma.game_id). */
	card: number
	style: MemberStyle | null
	/** The veteran's id in the game: the Collection import's `import_key`. */
	trainedCharaId: number | null
	/** 1 to 9. */
	place: number
	/** A code from LOSS_REASONS, or "" for one this list doesn't know (a new game code never blocks an import). */
	lossReason: string
}

/** One CM race as the import uses it. */
export interface ReplayRace {
	/** The file's modified time, ms since 1970: when the race was seen. */
	at: number
	/** The player's three, in the file's order. */
	runners: ReplayRunner[]
	/** The race's winner: her outfit and style, and whether she is one of the player's. */
	winner: { card: number; style: MemberStyle | null; mine: boolean } | null
}

export type ReplayFileResult =
	| { kind: "race"; race: ReplayRace }
	/** A replay, but of another race type (League of Heroes, a room match...). */
	| { kind: "other-race"; raceType: string }
	| { kind: "not-a-replay" }

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value)
const numberOr = (value: unknown, fallback: number | null): number | null => (typeof value === "number" && Number.isFinite(value) ? value : fallback)

/** The shape every umadump race replay has. */
export function isRaceReplay(json: unknown): json is Json {
	return isObject(json) && typeof json.raceType === "string" && Array.isArray(json.raceHorse) && Array.isArray(json.playerTeamMemberArray)
}

/**
 * One file's race, or why it isn't one. `modified` is the File's
 * `lastModified`; nothing in the file says when the race was run.
 */
export function readReplayFile(json: unknown, modified: number): ReplayFileResult {
	if (!isRaceReplay(json)) return { kind: "not-a-replay" }
	if (json.raceType !== "Champions") return { kind: "other-race", raceType: String(json.raceType) }
	const own = (json.playerTeamMemberArray as unknown[]).filter(isObject)
	const ownIndex = new Set(own.map((member) => member.horseIndex))
	const runners: ReplayRunner[] = []
	for (const member of own) {
		const data = isObject(member.responseHorseData) ? member.responseHorseData : {}
		const card = numberOr(data.card_id, null)
		const order = numberOr(member.finishOrder, null)
		if (card === null || order === null) continue
		const defeat = typeof member.defeat === "string" ? member.defeat : ""
		runners.push({
			card,
			style: STYLES[numberOr(data.running_style, 0) ?? 0] ?? null,
			trainedCharaId: numberOr(data.trained_chara_id, null),
			place: order + 1,
			lossReason: (LOSS_REASONS as readonly string[]).includes(defeat) ? defeat : "",
		})
	}
	// The winner is finishOrder 0 (umadump's own rule), among all nine.
	const first = (json.raceHorse as unknown[]).filter(isObject).find((horse) => horse.finishOrder === 0)
	const firstData = first && isObject(first.responseHorseData) ? first.responseHorseData : null
	const winnerCard = firstData ? numberOr(firstData.card_id, null) : null
	const winner =
		first && winnerCard !== null
			? { card: winnerCard, style: STYLES[numberOr(firstData?.running_style, 0) ?? 0] ?? null, mine: ownIndex.has(first.horseIndex) }
			: null
	return { kind: "race", race: { at: modified, runners, winner } }
}
