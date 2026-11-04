/**
 * Real course records, as the API sends them (the JP bundle built from
 * Daptrius's files, 2026-11-02), for the course map's tests. Each is here for
 * a reason: Chukyo 1200 is the plan's worked example; Nakayama 3600 runs two
 * laps and numbers its corners 1 to 4 twice; Santa Anita 2400 opens with a
 * stretch in neither list, then corner -1, and crosses dirt; Tokyo dirt 1600
 * (CM 22) starts on turf.
 */
import type { RaceCourse } from "../types"

const base = { id: 1, region: "jp", variant: "", later_laps: "inside" } as const

export const CHUKYO_1200: RaceCourse = {
	...base, game_id: 10701, racecourse: "Chukyo", surface: "turf", distance: 1200, direction: "left",
	corners: [{ start: 300, length: 250, number: 3 }, { start: 550, length: 238, number: 4 }],
	straights: [{ start: 0, length: 300, front: 2 }, { start: 788, length: 412, front: 1 }],
	slopes: [{ start: 100, length: 775, slope: -10000 }, { start: 875, length: 100, slope: 20000 }],
	surface_changes: [],
}

export const NAKAYAMA_3600: RaceCourse = {
	...base, game_id: 10507, racecourse: "Nakayama", surface: "turf", distance: 3600, variant: "inner", direction: "right",
	corners: [
		{ start: 290, length: 250, number: 1 }, { start: 540, length: 250, number: 2 },
		{ start: 1115, length: 250, number: 3 }, { start: 1365, length: 250, number: 4 },
		{ start: 1975, length: 250, number: 1 }, { start: 2225, length: 250, number: 2 },
		{ start: 2800, length: 250, number: 3 }, { start: 3050, length: 240, number: 4 },
	],
	straights: [
		{ start: 0, length: 290, front: 1 }, { start: 790, length: 325, front: 2 }, { start: 1615, length: 360, front: 1 },
		{ start: 2475, length: 325, front: 2 }, { start: 3290, length: 310, front: 1 },
	],
	slopes: [
		{ start: 40, length: 110, slope: 20000 }, { start: 240, length: 200, slope: 15000 }, { start: 540, length: 400, slope: -15000 },
		{ start: 1740, length: 110, slope: 20000 }, { start: 1925, length: 200, slope: 15000 }, { start: 2225, length: 400, slope: -15000 },
		{ start: 3425, length: 110, slope: 20000 },
	],
	surface_changes: [],
}

export const SANTA_ANITA_2400: RaceCourse = {
	...base, game_id: 11616, racecourse: "Santa Anita Park", surface: "turf", distance: 2400, direction: "left",
	corners: [
		{ start: 200, length: 500, number: -1 }, { start: 1100, length: 150, number: 1 }, { start: 1250, length: 150, number: 2 },
		{ start: 1800, length: 150, number: 3 }, { start: 1950, length: 150, number: 4 },
	],
	straights: [{ start: 700, length: 400, front: 1 }, { start: 1400, length: 400, front: 2 }, { start: 2100, length: 300, front: 1 }],
	slopes: [{ start: 350, length: 200, slope: -20000 }],
	surface_changes: [{ start: 557, surface: "dirt" }, { start: 604, surface: "turf" }],
}

export const TOKYO_DIRT_1600: RaceCourse = {
	...base, game_id: 10611, racecourse: "Tokyo", surface: "dirt", distance: 1600, direction: "left",
	corners: [{ start: 650, length: 225, number: 3 }, { start: 875, length: 224, number: 4 }],
	straights: [{ start: 0, length: 650, front: 2 }, { start: 1099, length: 501, front: 1 }],
	slopes: [{ start: 575, length: 200, slope: -10000 }, { start: 1100, length: 250, slope: 15000 }],
	surface_changes: [{ start: 0, surface: "turf" }, { start: 100, surface: "dirt" }],
}
