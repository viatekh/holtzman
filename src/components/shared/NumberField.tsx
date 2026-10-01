import { useEffect, useRef } from 'react'
import { clamp } from '../../lib/utils'

interface NumberFieldProps {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  suffix?: string
  slider?: boolean
  onChange: (value: number) => void
}

export function NumberField({ label, value, min = 0, max = 1000, step = 1, suffix, slider = true, onChange }: NumberFieldProps) {
  // Coalesce slider input to one commit per animation frame — every commit
  // rebuilds the whole part, so 60+ events/sec while dragging would queue.
  const rafRef = useRef<number | null>(null)
  const pendingRef = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    },
    [],
  )
  const scheduleChange = (v: number) => {
    pendingRef.current = v
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        if (pendingRef.current != null) {
          onChange(pendingRef.current)
          pendingRef.current = null
        }
      })
    }
  }
  const display = Math.round(value * 1000) / 1000

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex items-center justify-between text-neutral-400">
        <span>{label}</span>
        <span className="text-neutral-200 tabular-nums">
          {display}
          {suffix ?? ''}
        </span>
      </span>
      <div className="flex items-center gap-2">
        {slider && (
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => scheduleChange(clamp(Number(e.target.value), min, max))}
            className="min-w-0 flex-1 accent-purple-500"
          />
        )}
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={display}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (Number.isFinite(v)) onChange(clamp(v, min, max))
          }}
          className="w-20 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-right text-sm"
        />
      </div>
    </label>
  )
}
