import type { ReactNode } from "react"
import { Outlet, Route, Routes, useParams } from "react-router-dom"
import { useCalculatorData } from "../services/CalculatorContext"
import { Navbar } from "../components/navbar/Navbar.tsx"
import { CaratCalculator } from "../components/carat-calculator/CaratCalculator"
import { Timeline } from "../components/timeline/Timeline"
import { Selectors } from "../components/selectors/Selectors"
import { DailyLegendRaces } from "../components/legend-races/DailyLegendRaces"
import { PvpGuidePage } from "../components/pvp/PvpGuidePage"
import { Footer } from "../components/footer/Footer.tsx"
import { NotFound } from "../components/NotFound"
import { OguriSpinner } from "../components/OguriSpinner"
import { AppRouteMeta } from "./AppRouteMeta"
import { SharedPlanLanding } from "../components/shared-plan/SharedPlanLanding"
import { isPublicId } from "../utils/appRoutes"

/* The page area while the initial fetch is still out. Sized to roughly fill the
   space the calculator will occupy, so the footer doesn't ride up under the
   navbar and then jump down when the data lands. */
const PageLoading = () => (
	<div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
		<OguriSpinner />
		<span className="sr-only">Loading your plan…</span>
	</div>
)

const PageError = () => (
	<div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-gray-100">
		<h1 className="text-2xl font-bold">Failed to load data</h1>
		<p className="text-white/60">The server may be down. Please try again.</p>
		<button
			className="rounded bg-brand px-4 py-2 font-semibold text-black transition-opacity hover:opacity-80"
			onClick={() => window.location.reload()}
		>
			Reload page
		</button>
	</div>
)

/**
 * The app's frame: navbar, the scrolling page area behind the loading gate,
 * the route meta and the footer. Every /app page renders inside it: the tabs
 * through the layout route's <Outlet />, a shared plan's landing card as
 * `children` (see SharedPlanRoute).
 */
const AppShell = ({ children }: { children?: ReactNode }) => {
	// Gates the page area only. The navbar and footer around it render
	// immediately, so /app is visibly the app while the payload is still in
	// flight rather than a spinner on a blank background.
	const { isLoading, fetchError } = useCalculatorData()

	return (
		<div className="flex min-h-dvh flex-col bg-gray-900 app-shell:h-dvh app-shell:overflow-hidden">
			<Navbar />
			{/* The footer sits INSIDE the scroll region, not as a sibling of it: on
			    desktop this shell is a fixed-height, no-scroll frame (app-shell:h-dvh
			    app-shell:overflow-hidden), so a footer outside the scroller would be
			    permanently pinned to the bottom of the screen. Inside, it scrolls
			    away with the calculator/timeline content like on every other page.

			    The scroller is itself a flex column so the page wrapper below can
			    absorb any leftover height: with the calculator's income section
			    collapsed and few banner rows, the slack goes ABOVE the footer
			    instead of below it.
			    Otherwise that slack renders as gray-900 directly beneath a gray-900
			    footer, and the footer's top border makes the whole band read as one
			    enormous footer. */}
			{/* `relative` is load-bearing, not cosmetic. This scroller is the
			    app's clipping context, but `overflow` alone does NOT make an
			    element a containing block for absolutely positioned descendants.
			    Any `absolute` inside here with no positioned ancestor therefore
			    resolves against the INITIAL containing block, escapes the clip,
			    and extends the DOCUMENT to wherever its static position falls.

			    Tailwind's `sr-only` is `position: absolute`, so a screen-reader
			    label deep in a long list (ReservedColumnIcons, once per
			    MobileBannerCard) dragged the document ~400px past the viewport.
			    On the fixed-height shell that produced a SECOND scrollbar: the
			    document's, beside this scroller's own. It only showed between
			    1024px and --container-banner-table, because that is the one band
			    where the shell is clipped AND rows render as cards — the desktop
			    table's cells are `relative`, so the same spans stay contained.

			    Making this element the containing block fixes the whole class of
			    bug rather than that one span. It creates no stacking context
			    (no z-index) and does not affect `fixed` descendants. */}
			{/* `data-app-scroller` is how hooks/useScrollReset.ts finds this
			    element. It cannot query for the scroller generically: below
			    the app-shell breakpoint this same div still carries
			    overflow-y-auto but never scrolls internally, so "has an
			    overflow style" would not identify the live scroller. */}
			<div data-app-scroller className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
				{/* Plain block wrapper (not <Outlet /> directly) so the calculator and
				    timeline keep a normal block formatting context and don't become
				    flex items themselves. flex-1 grows it into the slack; min-height:auto
				    stops it shrinking below its content, so tall content still scrolls. */}
				{/* The routed pages mount only once the data is here — they
				    all assume their collections are populated. */}
				<div className="flex-1">
					{isLoading ? (
						<PageLoading />
					) : fetchError ? (
						<PageError />
					) : (
						children ?? <Outlet />
					)}
				</div>
				{/* Outside the gate above on purpose: it owns the page's document
				    title, which has to be right while the spinner shows and in a
				    build-time render. Renders nothing; see AppRouteMeta. */}
				<AppRouteMeta />
				<Footer />
			</div>
		</div>
	)
}

/**
 * /app/<segment> that is not one of the tabs. A segment shaped like a share
 * id (utils/appRoutes.ts) is a shared plan's link and gets the landing card in
 * the app's frame, behind the loading gate, because the card resolves the
 * plan's banners against the catalogue. Anything else is a typo and gets the
 * same NotFound as every other unmatched /app path.
 *
 * A route of its own rather than a child of the layout route below: a child
 * renders inside the frame, and NotFound brings its own navbar and footer.
 * The tabs' static paths outrank this param, so /app/timeline (eight letters,
 * the shape of an id) never arrives here.
 */
const SharedPlanRoute = () => {
	const { publicId } = useParams()
	if (!isPublicId(publicId)) return <NotFound />
	return (
		<AppShell>
			{/* Keyed so a different link is a fresh card, not the last one's state. */}
			<SharedPlanLanding key={publicId} publicId={publicId} />
		</AppShell>
	)
}

export const ApplicationViews = () => (
	<Routes>
		<Route path="/" element={<AppShell />}>
			<Route index element={<CaratCalculator />} />
			<Route path="timeline" element={<Timeline />}/>
			<Route path="selectors" element={<Selectors />}/>
			<Route path="legend-races" element={<DailyLegendRaces />}/>
			{/* A static path, so it outranks the ":publicId" share route below;
			    "pvp" is also too short to pass isPublicId. */}
			<Route path="pvp" element={<PvpGuidePage />}/>
		</Route>
		<Route path=":publicId" element={<SharedPlanRoute />} />
		{/* Unmatched path under /app. A SIBLING of the layout route, not a child:
		    NotFound brings its own Navbar and Footer, so nesting it would render a
		    second set of both inside the app shell.

		    Without this, /app/anything-else matched nothing here and rendered a
		    BLANK page — App.tsx's catch-all never sees these paths, because
		    /app/* already matched there and handed off to this Routes. */}
		<Route path="*" element={<NotFound />} />
	</Routes>
)
