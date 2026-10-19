import { Component } from "react"
import type { ReactNode, ErrorInfo } from "react"

interface Props {
	children: ReactNode
}

interface State {
	hasError: boolean
}

/**
 * Catches unhandled render errors anywhere in the tree and shows a fallback
 * instead of a blank screen. Must be a class component — React's error boundary
 * API (getDerivedStateFromError / componentDidCatch) isn't available to hooks.
 */
export class ErrorBoundary extends Component<Props, State> {
	state: State = { hasError: false }

	static getDerivedStateFromError(): State {
		return { hasError: true }
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("Uncaught error:", error, info)
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="flex flex-col items-center justify-center min-h-screen gap-4 text-gray-100">
					<h1 className="text-2xl font-bold">Something went wrong</h1>
					<p className="text-white/60">An unexpected error occurred.</p>
					<button
						className="px-4 py-2 rounded-md bg-brand text-black font-semibold hover:opacity-80 transition-opacity"
						onClick={() => window.location.reload()}
					>
						Reload page
					</button>
				</div>
			)
		}

		return this.props.children
	}
}
