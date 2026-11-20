/**
 * An uma's layered art (the API's `portrait_layers`, notes/layered-uma-art-plan.md):
 * a square `base` drawn under the site's frame, and a `foreground` drawn over
 * it holding whatever sticks out past the frame (ears, hair, hats). The
 * foreground's canvas is the frame's box plus a sixth above and 16/360 each
 * side (Daptrius's 392x420 export).
 *
 * The API sends both or null, never half: the two only line up as a pair.
 * Every type that carries an uma's `portrait` carries this beside it, and
 * FramedUma draws it in place of `portrait` wherever the frame is on.
 */
export interface PortraitLayers {
	base: string
	foreground: string
}
