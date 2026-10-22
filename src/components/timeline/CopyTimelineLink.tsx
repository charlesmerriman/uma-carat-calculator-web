import { Link2 } from "lucide-react"
import { toast } from "sonner"
import { timelineFocusHref, type TimelineFocus } from "../../utils/timelineFocus"

/**
 * "Copy link" on a Timeline card: puts the card's deep link on the clipboard,
 * so a reader can send someone straight to one banner or event.
 *
 * The link is the same `?focus=` the calculator and the PvP page already use
 * (utils/timelineFocus.ts), so opening it widens the list, flips to past
 * events if needed, scrolls to the card and rings it. Nothing new on the
 * receiving end.
 *
 * Built in the click handler from the page's own origin, never at render time:
 * the Timeline is prerendered, and render-time code must not touch `window`. It
 * also means a link copied on a dev server points at that server. A refused
 * clipboard (an insecure origin, or a denied permission) shows the link in a
 * toast to copy by hand, as the PvP guide's "Copy link" does.
 */
export const CopyTimelineLink = ({ focus, name }: { focus: TimelineFocus; name: string }) => {
	const copy = async () => {
		const url = `${window.location.origin}${timelineFocusHref(focus)}`
		try {
			await navigator.clipboard.writeText(url)
			toast.success("Link copied.")
		} catch {
			toast(url)
		}
	}

	return (
		<button
			type="button"
			onClick={copy}
			// Starts with the visible text, so voice control users can say what they see.
			aria-label={`Copy link to ${name}`}
			className="flex w-fit items-center gap-1.5 rounded-full border border-gray-600 bg-gray-700 px-3 py-1 text-sm font-semibold text-gray-100 transition hover:border-brand/60 hover:text-brand"
		>
			<Link2 className="h-4 w-4 text-brand" aria-hidden="true" />
			Copy link
		</button>
	)
}
