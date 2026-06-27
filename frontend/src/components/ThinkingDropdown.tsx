import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

type ThinkingDropdownProps = {
  steps: string[]
}

export function ThinkingDropdown({ steps }: ThinkingDropdownProps) {
  const [open, setOpen] = useState(false)

  if (steps.length === 0) return null

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
        aria-expanded={open}
      >
        <ChevronDown
          className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
        Thinking
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1 border-l border-border pl-3 text-xs text-muted">
          {steps.map((step, index) => (
            <li key={`${index}-${step}`} className="break-words">
              {step}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
