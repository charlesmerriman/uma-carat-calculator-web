/**
 * The dynamic import of community guides (the list, the reader and, with
 * PR 4, the writer's bar), for the `lazy()` that draws them. Only a reader the
 * "Site guide / Community guides" switch is drawn for ever loads it, the way
 * the gallery and the editor are chunks of their own (gallery/loadGallery.ts).
 */
export const loadCommunityGuides = () => import("./CommunityGuides")
