/**
 * The one dynamic import of the guide editor, for the `lazy()` in
 * PvpGuidePage. The editor (and dnd-kit with it) is a chunk of its own,
 * fetched the first time an editor opens the Edit tab; a visitor's bundle
 * never carries it. The same shape as loadForecastPlot.ts.
 */
export const loadGuideEditor = () => import("./GuideEditor")
