interface ToggleSwitchProps {
	checked: boolean
	onChange: (checked: boolean) => void
	/** Accessible label for the switch (there's no visible text inside it). */
	ariaLabel: string
}

/**
 * A small styled on/off switch built on a visually-hidden checkbox (the `peer`)
 * plus a Tailwind-styled track/knob. Shared by the Income form and its
 * projection settings so the toggle look stays consistent in one place.
 */
export const ToggleSwitch = ({ checked, onChange, ariaLabel }: ToggleSwitchProps) => (
	<label className="relative inline-flex items-center cursor-pointer">
		<input
			type="checkbox"
			className="sr-only peer"
			checked={checked}
			onChange={(e) => onChange(e.target.checked)}
			aria-label={ariaLabel}
		/>
		<div className="relative w-10 h-6 rounded-full bg-gray-600 peer-checked:bg-brand after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-4" />
	</label>
)
