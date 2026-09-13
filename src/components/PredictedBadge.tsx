import { Sparkles } from "lucide-react"

/**
 * Small "Estimated" pill shown next to dates that the backend predicted from
 * the JP schedule (rather than official confirmed global dates). Render it
 * conditionally on `is_predicted`.
 */
export default function PredictedBadge({ className = "" }: { className?: string }) {
	return (
		<span
			title="Estimated from the JP schedule. Not yet officially confirmed."
			className={`inline-flex items-center gap-1 rounded-full border border-brand/50 bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand ${className}`}
		>
			<Sparkles className="h-3 w-3" />
			Estimated
		</span>
	)
}
