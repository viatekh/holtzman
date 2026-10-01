import { cn } from '../../lib/utils'

interface Option<T extends string> {
  value: T
  label: string
}

export function SegmentedControl<T extends string>({ label, value, options, onChange }: { label?: string; value: T; options: Option<T>[]; onChange: (value: T) => void }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      {label && <span className="text-neutral-400">{label}</span>}
      <div className="flex rounded-lg border border-neutral-700 bg-neutral-900 p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 rounded-md px-2 py-1 text-sm transition-colors',
              value === opt.value ? 'bg-purple-500 text-white' : 'text-neutral-400 hover:text-neutral-200',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
