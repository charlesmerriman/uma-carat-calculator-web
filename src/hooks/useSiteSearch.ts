import { useEffect, useState } from "react"

/** Whether the site search is open, and Ctrl+K / Cmd+K anywhere to toggle it. */
export function useSiteSearch() {
	const [open, setOpen] = useState(false)
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
				// Or the browser focuses its own address bar.
				event.preventDefault()
				setOpen((isOpen) => !isOpen)
			}
		}
		document.addEventListener("keydown", onKeyDown)
		return () => document.removeEventListener("keydown", onKeyDown)
	}, [])
	return { open, setOpen }
}
