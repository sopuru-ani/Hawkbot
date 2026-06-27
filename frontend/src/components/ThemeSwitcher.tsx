import { LaptopMinimal, Moon, Sun } from 'lucide-react'
import type { Theme } from '../hooks/useTheme'

type ThemeSwitcherProps = {
  theme: Theme
  onChange: (theme: Theme) => void
}

const options: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'system', label: 'System theme', Icon: LaptopMinimal },
  { value: 'light', label: 'Light theme', Icon: Sun },
  { value: 'dark', label: 'Dark theme', Icon: Moon },
]

export function ThemeSwitcher({ theme, onChange }: ThemeSwitcherProps) {
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5"
      role="group"
      aria-label="Theme"
    >
      {options.map(({ value, label, Icon }) => {
        const active = theme === value
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={active}
            onClick={() => onChange(value)}
            className={`rounded p-1 transition-colors ${
              active
                ? 'bg-accent-subtle text-foreground'
                : 'text-muted hover:bg-accent-subtle/60 hover:text-foreground'
            }`}
          >
            <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
