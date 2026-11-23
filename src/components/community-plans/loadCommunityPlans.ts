/**
 * The one dynamic import of Community plans (/app/plans), for the `lazy()` in
 * views/ApplicationViews.tsx. The page, its feed row, the opened post and the
 * filters are their own chunk: a visitor to the calculator never downloads
 * them (loadForecastPlot.ts says why that matters).
 */
export const loadCommunityPlans = () => import("./CommunityPlansPage")
