/**
 * A support card's training effects at any level, on its page
 * (notes/encyclopedia-plan.md, Phase 2): pick a limit break or step the level,
 * and every effect shows its value there, with the game's own help text under
 * its name. An effect the card doesn't have yet at that level is greyed and
 * says when it unlocks; so is the unique effect below its level.
 *
 * The numbers come ready from the API (backend support_effects.py, where the
 * growth rule and its check are): `values` holds one per level from 1 to the
 * card's top cap, so this component only looks one up. It never works a value
 * out, and it writes a unit only where the API names a format.
 *
 * It never adds the unique effect to a row either: a unique Friendship Bonus
 * or Specialty Priority multiplies with the card's own (35 with a unique 40
 * acts like (100 + 35) x 1.4 = 189, so 89, not 75; Daptrius, 2026-11-13). The
 * API names which of the two apply (`unique.multiplies`); the page used to
 * say so in a line under the unique effect, cut as noise (Daptrius, same day).
 *
 * Opens at the level the owner's copy can reach (their limit break's cap)
 * when they own the card, else at the top level.
 */

import { useState } from "react"
import { Lock, Minus, Plus } from "lucide-react"
import type { CardEffect, CardUniqueEffect } from "../../types/encyclopedia"
import { effectValue } from "../../utils/encyclopedia"

/** "Speed Bonus 1, Skill Point Bonus 1": a unique effect's numbers, which no sentence of the game's states. */
function uniqueAmounts(unique: CardUniqueEffect): string | null {
	const parts = unique.amounts ?? []
	return parts.length > 0 ? parts.map((part) => `${part.name} ${effectValue(part.value, part.format)}`).join(", ") : null
}
import { Section, Switch } from "./pieces"

/** The limit break switch's words, by index: 0 to 3, then the game's "MLB" for all four. */
const LIMIT_BREAK_WORDS = ["0", "1", "2", "3", "MLB"]

const STEPS = [-5, -1, 1, 5]

export function CardEffects({ id, effects, caps, unique, limitBreak }: {
	id?: string
	effects: CardEffect[]
	/** The level cap at each limit break, 0 to 4. */
	caps: number[]
	unique: CardUniqueEffect | null
	/** The owner's limit break (0..4) when they own the card. */
	limitBreak?: number
}) {
	const top = caps[caps.length - 1]
	// Until the reader picks a level, follow what they own. The Collection
	// loads after the page, so this is derived, not copied into state once.
	const [picked, setPicked] = useState<number | null>(null)
	const level = picked ?? (limitBreak !== undefined ? caps[Math.min(limitBreak, caps.length - 1)] : top)
	// The fewest limit breaks a copy needs to reach this level: how many caps sit below it.
	const breaksNeeded = caps.filter((cap) => cap < level).length
	const step = (by: number) => setPicked(Math.min(top, Math.max(1, level + by)))

	return (
		<Section
			id={id}
			title="Effects"
			count={effects.length}
			aside={
				<Switch
					label="Limit break"
					options={caps.map((cap, index) => ({ value: cap, label: LIMIT_BREAK_WORDS[index] ?? String(index) }))}
					value={level}
					onChange={setPicked}
				/>
			}
		>
			<div className="enc-level">
				<div className="enc-level__steps">
					{STEPS.filter((by) => by < 0).map((by) => (
						<button key={by} type="button" onClick={() => step(by)} disabled={level <= 1} aria-label={`${-by} ${by === -1 ? "level" : "levels"} down`}>
							<Minus aria-hidden="true" />{-by}
						</button>
					))}
				</div>
				<p className="enc-level__now" aria-live="polite">
					<span>Level <b>{level}</b></span>
					<span className="enc-level__breaks">
						{breaksNeeded === 0 ? "No limit break needed" : breaksNeeded === caps.length - 1 ? "Needs max limit break" : `Needs limit break ${breaksNeeded}`}
					</span>
				</p>
				<div className="enc-level__steps">
					{STEPS.filter((by) => by > 0).map((by) => (
						<button key={by} type="button" onClick={() => step(by)} disabled={level >= top} aria-label={`${by} ${by === 1 ? "level" : "levels"} up`}>
							<Plus aria-hidden="true" />{by}
						</button>
					))}
				</div>
			</div>

			{unique && (
				<div className="enc-unique" data-locked={level < unique.level}>
					<span className="enc-unique__label">
						{level < unique.level && <Lock aria-hidden="true" />}
						Unique effect
					</span>
					<span className="enc-unique__text">
						{unique.text}
						{uniqueAmounts(unique) && <span className="enc-unique__amounts">{uniqueAmounts(unique)}</span>}
					</span>
					<span className="enc-unique__level">{level < unique.level ? `Unlocks at level ${unique.level}` : `From level ${unique.level}`}</span>
				</div>
			)}

			<ul className="enc-effects">
				{effects.map((effect) => {
					const value = effect.values[level - 1] ?? null
					return (
						<li key={effect.type} className="enc-effect" data-locked={value === null}>
							<b className="enc-effect__value">{value === null ? <Lock aria-label="Locked" /> : effectValue(value, effect.format)}</b>
							<span className="enc-effect__text">
								<span className="enc-effect__name">{effect.name}</span>
								<span className="enc-effect__help">{value === null ? `Unlocks at level ${effect.unlock}` : effect.help}</span>
							</span>
						</li>
					)
				})}
			</ul>
		</Section>
	)
}
