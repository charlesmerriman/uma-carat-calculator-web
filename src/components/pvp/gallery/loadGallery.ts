/**
 * The dynamic imports of the gallery, for the `lazy()`s that draw it.
 *
 * The app ships as one JavaScript file unless something is imported this way
 * (loadForecastPlot.ts says why that matters), and every visitor to the
 * calculator paid for the gallery's feed, post panel and comment thread, PvP
 * fan or not (board "Load the gallery only when someone opens it"). Now:
 *
 *   loadGalleryView      the Gallery tab: the feed, the post panel and its
 *                        comments. PvpGuidePage starts it when the tab is
 *                        hovered or focused, so a click rarely waits.
 *   loadGalleryComments  a thread on its own, for a PvP guide's sections
 *                        (GuideComments), fetched when one is opened.
 *
 * The small shared pieces (styles, the poster line, the modal, the post
 * dialog) stay in the main bundle: the team builder and the editor use them.
 */
export const loadGalleryView = () => import("./GalleryView")
export const loadGalleryComments = () => import("./GalleryComments")
