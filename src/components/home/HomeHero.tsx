/**
 * The home page's hero (design polish item 17): type alone, large, straight on
 * the page, with the game's carat icon after the headline's full stop. Picked
 * by the owner on 2026-10-19 from three options (a mascot card, a row of game
 * item tiles, and this); a first version with an example planner widget
 * beside the pitch was dropped. No card: the cards below it carry the page's
 * content, and the hero is the page's title. Static, so it prerenders as is.
 *
 * It spans the content width on a desktop, the same 80rem the cards below it
 * use (the owner: the left-aligned two-line version "too left-leaning"). From
 * lg the headline is one line and the pitch and the buttons share the row
 * under it, one at each end. Narrower, both stack.
 */
import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"

type HeroProps = {
	isLoggedIn: boolean
	onPrefetch: () => void
}

/** The hero's two actions; signed in, only the first ("Open your plan"). */
function HeroActions({ isLoggedIn, onPrefetch }: HeroProps) {
	return (
		<div className="flex shrink-0 flex-col gap-2 sm:flex-row">
			<Link
				to="/app"
				className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-bold text-black transition hover:brightness-110"
				onMouseEnter={onPrefetch}
				onFocus={onPrefetch}
			>
				{isLoggedIn ? "Open your plan" : "Open the calculator"}
				<ArrowRight className="h-4 w-4" aria-hidden="true" />
			</Link>
			{!isLoggedIn && (
				<Link
					to="/login"
					className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-600 px-5 text-sm font-semibold text-gray-200 transition hover:border-gray-500 hover:bg-gray-700"
				>
					Sign in to sync your plan
				</Link>
			)}
		</div>
	)
}

export function HomeHero(props: HeroProps) {
	return (
		<section className="pb-4 pt-6 sm:pt-12">
			{/* Each sentence is its own unbreakable run, and the only break point
			    is the space between them: one line where the width holds both
			    (from lg, sized so it does), one sentence a line where it does
			    not, never a break mid-phrase. 2rem on a phone keeps "Know your
			    carats." and its icon on one line down to a 360px screen. */}
			<h1 className="font-display text-[2rem] leading-[1.1] font-bold tracking-tight text-gray-100 sm:text-6xl sm:leading-[1.05] lg:text-[3.25rem] xl:text-[4.25rem]">
				<span className="block sm:inline sm:whitespace-nowrap">Plan your pulls.</span>{" "}
				<span className="block sm:inline sm:whitespace-nowrap">
					Know your{" "}
					{/* The icon follows the full stop, after the sentence, not inside
					    it, in the same unbreakable run so it never wraps alone. */}
					<span className="whitespace-nowrap">
						<span className="text-brand">carats</span>.
						<img
							src="/item_icon_00043.png"
							alt=""
							width={256}
							height={256}
							className="ml-3 inline-block h-[0.95em] w-[0.95em] -translate-y-[0.08em] rounded-[22%] align-middle shadow-lg"
						/>
					</span>
				</span>
			</h1>
			<div className="mt-5 flex flex-col gap-6 lg:mt-7 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
				<p className="max-w-2xl text-lg text-pretty text-gray-300 sm:text-xl">
					A simple planner for your Uma Musume banners, income, and pull goals.
				</p>
				<HeroActions {...props} />
			</div>
		</section>
	)
}
