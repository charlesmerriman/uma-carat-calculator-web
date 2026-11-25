import { describe, expect, it } from "vitest"
import { readReplayFile } from "../utils/gameImport/umadumpReplays"
import fixture from "./fixtures/umadumpReplay.json"

/**
 * Reading one umadump race replay (notes/cm-runs-plan-2.md, PR 5). The fixture
 * is one of the owner's CM 22 races (Tokyo dirt mile, 2026-11-25), cut to the
 * fields the parser reads; every trainer name, account id and veteran id was
 * replaced (fake ones kept, so the test can prove they never come out). The
 * player's three are horses 2, 3 and 7.
 */

const AT = Date.UTC(2026, 10, 25, 8, 9, 31)
const copy = () => JSON.parse(JSON.stringify(fixture)) as typeof fixture

describe("readReplayFile", () => {
	it("reads the player's three, the winner, and the file's time", () => {
		const result = readReplayFile(fixture, AT)
		expect(result.kind).toBe("race")
		if (result.kind !== "race") return
		expect(result.race.at).toBe(AT)
		// finishOrder counts from 0; running_style 1 is front, 2 pace.
		expect(result.race.runners).toEqual([
			{ card: 106801, style: "front", trainedCharaId: 1001, place: 8, lossReason: "ProperGround" },
			{ card: 102001, style: "front", trainedCharaId: 1002, place: 9, lossReason: "ProperGround" },
			{ card: 101502, style: "pace", trainedCharaId: 1003, place: 7, lossReason: "ProperDistance" },
		])
		// Another player's Oguri Cap won, running late (3).
		expect(result.race.winner).toEqual({ card: 100601, style: "late", mine: false })
	})

	it("never carries a name or an account id out of the file", () => {
		const text = JSON.stringify(readReplayFile(fixture, AT))
		expect(text).not.toMatch(/Trainer|viewer|50000/)
		// Other runners' veteran ids stay behind too: only ours are read.
		expect(text).not.toMatch(/900\d/)
	})

	it("knows a win of ours, and blanks a loss code it doesn't list", () => {
		const file = copy()
		// Horse 7 (ours) first, the Oguri Cap that won second.
		file.raceHorse[7].finishOrder = 0
		file.raceHorse[0].finishOrder = 6
		file.playerTeamMemberArray[2].finishOrder = 0
		file.playerTeamMemberArray[0].defeat = "SomethingNew"
		const result = readReplayFile(file, AT)
		if (result.kind !== "race") throw new Error("not read")
		expect(result.race.winner).toEqual({ card: 101502, style: "pace", mine: true })
		expect(result.race.runners[0].lossReason).toBe("")
		expect(result.race.runners[2].place).toBe(1)
	})

	it("takes CM races only, and anything else isn't a replay", () => {
		expect(readReplayFile({ ...copy(), raceType: "Heroes" }, AT)).toEqual({ kind: "other-race", raceType: "Heroes" })
		// Recognised by shape: a Collection export is not a replay, whatever its name.
		expect(readReplayFile([{ trained_chara_id: 1 }], AT)).toEqual({ kind: "not-a-replay" })
		expect(readReplayFile({ raceType: "Champions" }, AT)).toEqual({ kind: "not-a-replay" })
	})
})
