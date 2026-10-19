/**
 * The one dynamic import of the forecast plot, shared by the `lazy()` in
 * CaratForecastChart and the early start in AppShell.
 *
 * WHY THE CHART LOADS SEPARATELY
 * ------------------------------
 * The app ships as one JavaScript file, so anything imported normally is
 * downloaded by every page, the home page and the FAQ included. Recharts adds
 * ~108 kB gzipped (~370 kB to parse) for one chart on one page. A dynamic
 * `import()` makes Vite put ForecastPlot and Recharts in a chunk of their own,
 * fetched only when this function first runs.
 *
 * WHY THERE IS AN EARLY START
 * ---------------------------
 * The calculator cannot render until its ~1.2 MB `/calculator-data` payload
 * arrives. AppShell calls this as soon as /app opens on the calculator, so
 * the chart's chunk downloads during that wait instead of after it; by the
 * time the rows appear, the plot is usually already in memory. Both callers
 * share one module specifier, so the browser fetches it once.
 */
export const loadForecastPlot = () => import("./ForecastPlot")
