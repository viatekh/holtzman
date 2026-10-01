interface Option<T extends string> {
  value: T
  label: string
}

export function Select<T extends string>({ label, value, options, onChange }: { label?: string; value: T; options: Option<T>[]; onChange: (value: T) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label && <span className="text-neutral-400">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-200 outline-none focus:border-purple-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}
