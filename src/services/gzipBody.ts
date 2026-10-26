/**
 * Gzip for a request body: the game-export imports (veterans, the roster) send
 * megabytes of JSON that pack to kilobytes, against the API's 2.5 MB body limit.
 * The API reads `Content-Encoding: gzip` (views/trained_uma.GzipJSONParser).
 */

/**
 * `text` gzipped, or null where the browser can't compress (then the caller
 * sends it plain). Through Response streams rather than Blob.stream(), which
 * not every runtime has.
 */
export async function gzipText(text: string): Promise<ArrayBuffer | null> {
	if (typeof CompressionStream === "undefined") return null
	try {
		const packed = new Response(text).body?.pipeThrough(new CompressionStream("gzip"))
		return packed ? await new Response(packed).arrayBuffer() : null
	} catch {
		return null
	}
}
