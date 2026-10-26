/**
 * One line above My team's grid saying how ready the team is:
 * "Umas 3/3 · Cards 12/18 · Aptitudes 2 to fix · Skills 9 of 14".
 *
 * The counts are utils/pvpReadiness.ts. A finished count turns gold with a
 * tick. The aptitude chip lists the letters in its tooltip ("Spot 2: Long
 * D"); the skills chip opens the Recommended skills panel, which has the
 * detail. No skills chip without a guide that recommends any.
 */

import type { ReactNode } from "react"
import { Check } from "lucide-react"
import type { Count, Readiness } from "../../utils/pvpReadiness"

const CHIP = "flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium"
const DONE = "border-brand/50 text-brand"
const OPEN = "border-gray-600 text-gray-300"

const complete = (count: Count) => count.have >= count.of

export function ReadinessStrip({ readiness, onShowSkills }: { readiness: Readiness; onShowSkills: () => void }) {
	const { umas, cards, aptitudes, skills } = readiness
	const gaps = aptitudes.map((gap) => `Spot ${gap.position + 1}: ${gap.label} ${gap.letter}`).join("\n")
	return (
		<ul className="flex flex-wrap items-center gap-1.5" aria-label="How ready this team is">
			<Chip done={complete(umas)}>Umas {umas.have}/{umas.of}</Chip>
			<Chip done={complete(cards)}>Cards {cards.have}/{cards.of}</Chip>
			{umas.have > 0 && (
				<Chip done={aptitudes.length === 0} title={gaps || "Every letter this race asks for is A or better."}>
					{aptitudes.length === 0 ? "Aptitudes A or better" : `Aptitudes ${aptitudes.length} to fix`}
				</Chip>
			)}
			{skills && (
				<li>
					<button
						type="button"
						onClick={onShowSkills}
						title="Open Recommended skills"
						className={`${CHIP} ${complete(skills) ? DONE : OPEN} transition hover:border-brand hover:text-brand`}
					>
						{complete(skills) && <Check className="h-3 w-3" aria-hidden="true" />}
						Skills {skills.have} of {skills.of}
					</button>
				</li>
			)}
		</ul>
	)
}

function Chip({ done, title, children }: { done: boolean; title?: string; children: ReactNode }) {
	return (
		<li className={`${CHIP} ${done ? DONE : OPEN}`} title={title}>
			{done && <Check className="h-3 w-3" aria-hidden="true" />}
			{children}
		</li>
	)
}
