interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  /** Screen reader text when enabled */
  enabledLabel?: string
  /** Screen reader text when disabled */
  disabledLabel?: string
}

/**
 * Accessible toggle switch component.
 *
 * @example
 * <Switch
 *   checked={isEnabled}
 *   onChange={setIsEnabled}
 *   label="Enable feature"
 * />
 */
export function Switch({
  checked,
  onChange,
  label,
  enabledLabel,
  disabledLabel,
}: SwitchProps) {
  const srText = checked
    ? (disabledLabel ?? `Disable ${label}`)
    : (enabledLabel ?? `Enable ${label}`)

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-6 w-10 flex-shrink-0 cursor-pointer rounded-full
        border-2 border-transparent transition-colors duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2
        ${checked ? 'bg-sky-500' : 'bg-zinc-300'}
      `}
    >
      <span className="sr-only">{srText}</span>
      <span
        aria-hidden="true"
        className={`
          pointer-events-none inline-block h-5 w-5 transform rounded-full
          bg-white shadow ring-0 transition duration-200 ease-in-out
          ${checked ? 'translate-x-4' : 'translate-x-0'}
        `}
      />
    </button>
  )
}
