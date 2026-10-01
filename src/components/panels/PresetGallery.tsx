import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useDesignStore } from '../../store/designStore'
import { PRESET_CATEGORIES, PRESETS, type Preset, type PresetCategory } from '../../lib/presetLibrary'
import { buildDesign } from '../../lib/geometry/build'
import { instanceCount } from '../../lib/three/partGeometry'
import { cn } from '../../lib/utils'
import type { Point } from '../../lib/geometry/types'

interface Thumb {
  viewBox: string
  sheet: string
  up: string
  down: string
  copies: number
  parts: number
}

const thumbs = new Map<string, Thumb>()

function ring(pts: Point[]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(0)} ${(-p.y).toFixed(0)}`).join('') + 'Z'
}

function makeThumb(preset: Preset): Thumb {
  const project = preset.make()
  const part = project.parts[0]
  const r = buildDesign(part)
  const b = r.bounds
  const pad = Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.06
  return {
    viewBox: `${b.minX - pad} ${-b.maxY - pad} ${b.maxX - b.minX + pad * 2} ${b.maxY - b.minY + pad * 2}`,
    sheet: [...r.outline.map(ring), ...r.cutouts.map((c) => ring(c.polygon))].join(' '),
    up: r.flaps.filter((f) => f.fold >= 0).map((f) => ring(f.polygon)).join(' '),
    down: r.flaps.filter((f) => f.fold < 0).map((f) => ring(f.polygon)).join(' '),
    copies: project.parts.reduce((s, p) => s + instanceCount(p.array), 0),
    parts: project.parts.length,
  }
}

/** Builds thumbnails one per frame so opening the gallery never freezes. */
function useThumbs(presets: Preset[]): number {
  const [, setTick] = useState(0)
  useEffect(() => {
    let cancelled = false
    let i = 0
    const step = () => {
      if (cancelled) return
      while (i < presets.length && thumbs.has(presets[i].id)) i++
      if (i >= presets.length) return
      thumbs.set(presets[i].id, makeThumb(presets[i]))
      setTick((t) => t + 1)
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
    return () => {
      cancelled = true
    }
  }, [presets])
  return thumbs.size
}

export function PresetGallery({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState<PresetCategory | 'All'>('All')
  const loadPreset = useDesignStore((s) => s.loadPreset)
  const shown = category === 'All' ? PRESETS : PRESETS.filter((p) => p.category === category)
  useThumbs(shown)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 px-4 py-3">
          <h2 className="mr-2 text-sm font-semibold text-neutral-100">Start from a design</h2>
          {(['All', ...PRESET_CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn('rounded-full px-3 py-1 text-xs', category === c ? 'bg-purple-500 text-white' : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200')}
            >
              {c} {c === 'All' ? PRESETS.length : PRESETS.filter((p) => p.category === c).length}
            </button>
          ))}
          <button type="button" onClick={onClose} className="ml-auto text-neutral-500 hover:text-neutral-200" title="Close">
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid auto-rows-max grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {shown.map((p) => {
            const t = thumbs.get(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  loadPreset(p.id)
                  onClose()
                }}
                className="group flex flex-col rounded-lg border border-neutral-800 text-left hover:border-purple-500"
              >
                <div className="relative aspect-square w-full rounded-t-lg bg-neutral-900">
                  {t ? (
                    <svg viewBox={t.viewBox} className="absolute inset-0 h-full w-full p-2">
                      <path d={t.sheet} fillRule="evenodd" fill="#3f3f46" stroke="#71717a" strokeWidth="0.4%" vectorEffect="non-scaling-stroke" />
                      <path d={t.up} fill="#fb923c" fillOpacity={0.75} />
                      <path d={t.down} fill="#2dd4bf" fillOpacity={0.75} />
                    </svg>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-neutral-600">…</div>
                  )}
                  {t && t.copies > 1 && (
                    <span className="absolute top-1.5 right-1.5 rounded bg-purple-500/80 px-1.5 py-0.5 text-[10px] text-white">
                      {t.parts > 1 ? `${t.parts} parts · ` : ''}×{t.copies}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 p-2">
                  <span className="text-sm text-neutral-100">{p.name}</span>
                  <span className="text-[11px] leading-snug text-neutral-500">{p.blurb}</span>
                </div>
              </button>
            )
          })}
        </div>
        </div>
      </div>
    </div>
  )
}
