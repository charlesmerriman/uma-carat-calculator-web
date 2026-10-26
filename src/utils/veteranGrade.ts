/**
 * How a veteran is told apart from another of the same uma: her label or memo
 * if she has one, and the game's grade and evaluation score, "A+ 13,815", the
 * way the game shows them (owner, 2026-10-26). On the owner's real export the
 * score alone was unique among every same-uma pair (252 veterans); stat lines
 * only go in a tooltip now.
 *
 * THE GRADE LETTERS. The API sends the game's grade NUMBER (`rank_grade`, from
 * an import only). The letters below were fixed against the owner's file, whose
 * grade numbers and scores fit exactly this ladder and the published U-rank
 * starts (NamuWiki: UG 19,600, UF 23,900):
 *
 *   1..18   G, G+, F, F+, E, E+, D, D+, C, C+, B, B+, A, A+, S, S+, SS, SS+
 *   19..    UG, UG1..UG9, then UF, UF1..UF9, then UE, UE1..UE9 (ten a tier)
 *
 * Past UE9 the letters are not confirmed, so a higher grade shows no letter,
 * only the score: a wrong letter is worse than none.
 */

import { statLine } from "./trainedUmas"
import type { TrainedUma } from "../types/trainedUma"

const LADDER = ["G", "G+", "F", "F+", "E", "E+", "D", "D+", "C", "C+", "B", "B+", "A", "A+", "S", "S+", "SS", "SS+"]
const U_TIERS = ["UG", "UF", "UE"]
const FIRST_U = LADDER.length + 1

/** The game's grade number as its letters ("A+", "UG1"), or null when unknown or unconfirmed. */
export function gradeLabel(rank: number | null | undefined): string | null {
	if (rank == null || !Number.isInteger(rank) || rank < 1) return null
	if (rank < FIRST_U) return LADDER[rank - 1]
	const step = rank - FIRST_U
	const tier = U_TIERS[Math.floor(step / 10)]
	if (!tier) return null
	return step % 10 === 0 ? tier : `${tier}${step % 10}`
}

/** "13,815". */
export function formatScore(score: number): string {
	return score.toLocaleString("en-US")
}

/** "A+ 13,815", "13,815" (no grade: a hand entry), or null (no score). */
export function veteranTag(veteran: Pick<TrainedUma, "rank_score" | "rank_grade">): string | null {
	if (veteran.rank_score == null) return null
	const grade = gradeLabel(veteran.rank_grade)
	return grade ? `${grade} ${formatScore(veteran.rank_score)}` : formatScore(veteran.rank_score)
}

/**
 * One line that names her: "Main Oguri · A+ 13,815", the label (else her game
 * memo) and the tag, whichever she has; the stat line only when she has
 * neither (a hand entry with no label and no score).
 */
export function veteranText(veteran: TrainedUma): string {
	const name = veteran.label || veteran.memo
	const tag = veteranTag(veteran)
	if (name && tag) return `${name} · ${tag}`
	return name || tag || statLine(veteran)
}

/** "Speed 1200, Stamina 800, ...": the full stats, for a tooltip. */
export function statsTitle(veteran: Pick<TrainedUma, "speed" | "stamina" | "power" | "guts" | "wit">): string {
	return `Speed ${veteran.speed}, Stamina ${veteran.stamina}, Power ${veteran.power}, Guts ${veteran.guts}, Wit ${veteran.wit}`
}
