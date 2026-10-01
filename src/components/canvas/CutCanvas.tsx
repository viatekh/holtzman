import { useEffect, useMemo, useRef, useState } from 'react'
import { Maximize } from 'lucide-react'
import { useActivePart, useDesignStore } from '../../store/designStore'
import { perforationSegments } from '../../lib/geometry/build'
import type { BuildResult, Point } from '../../lib/geometry/types'

interface View {
  x: number
  y: number
  w: number
}

/** World is y-up (mm); SVG is y-down, so every point is drawn at (x, −y). */
function d(points: Point[], closed: boolean): string {
  if (points.length === 0) return ''
  let s = `M${points[0].x.toFixed(2)} ${(-points[0].y).toFixed(2)}`
  for (let i = 1; i < points.length; i++) s += `L${points[i].x.toFixed(2)} ${(-points[i].y).toFixed(2)}`
  return closed ? s + 'Z' : s
}

function foldFill(fold: number): string {
  const t = Math.min(1, Math.abs(fold) / 120)
  return fold >= 0 ? `rgba(251, 146, 60, ${0.12 + t * 0.45})` : `rgba(45, 212, 191, ${0.12 + t * 0.45})`
}

export function CutCanvas({ result }: { result: BuildResult }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [view, setView] = useState<View | null>(null)
  const [autoFit, setAutoFit] = useState(true)
  const design = useActivePart()
  const selectedId = useDesignStore((s) => s.selectedGroupId)
  const selectGroup = useDesignStore((s) => s.selectGroup)
  const updateGroup = useDesignStore((s) => s.updateGroup)
  const dragRef = useRef<{ kind: 'pan' | 'move'; start: Point; view: View; groupId?: string; origin?: Point; moved: boolean } | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { bed } = design.sheet
  const b = result.bounds
  const bedRotated = !result.stats.fitsBed && result.stats.fitsBedRotated
  const bedW = bedRotated ? bed.height : bed.width
  const bedH = bedRotated ? bed.width : bed.height

  const fitView = useMemo((): View => {
    const pad = 40
    const w = Math.max(b.maxX - b.minX, 10) + pad * 2
    const h = Math.max(b.maxY - b.minY, 10) + pad * 2
    const aspect = size.w / Math.max(1, size.h)
    const vw = Math.max(w, h * aspect)
    const cx = (b.minX + b.maxX) / 2
    const cy = -(b.minY + b.maxY) / 2
    return { x: cx - vw / 2, y: cy - vw / aspect / 2, w: vw }
  }, [b.minX, b.minY, b.maxX, b.maxY, size.w, size.h])

  const v = autoFit || !view ? fitView : view
  const vh = (v.w * size.h) / Math.max(1, size.w)
  const mmPerPx = v.w / Math.max(1, size.w)

  const toWorld = (clientX: number, clientY: number): Point => {
    const rect = svgRef.current!.getBoundingClientRect()
    return { x: v.x + ((clientX - rect.left) / rect.width) * v.w, y: -(v.y + ((clientY - rect.top) / rect.height) * vh) }
  }

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const fx = (e.clientX - rect.left) / rect.width
      const fy = (e.clientY - rect.top) / rect.height
      const k = Math.exp(e.deltaY * 0.0015)
      setAutoFit(false)
      setView((prev) => {
        const cur = prev && !autoFit ? prev : v
        const w = cur.w * k
        const h0 = (cur.w * size.h) / Math.max(1, size.w)
        return { x: cur.x + fx * (cur.w - w), y: cur.y + fy * (h0 - h0 * k), w }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [v, autoFit, size.w, size.h])

  const groupById = useMemo(() => new Map(design.groups.map((g) => [g.id, g])), [design.groups])

  const onFeatureDown = (e: React.PointerEvent, groupId: string) => {
    e.stopPropagation()
    selectGroup(groupId)
    const g = groupById.get(groupId)
    if (g?.placement.kind === 'single') {
      ;(e.target as Element).setPointerCapture(e.pointerId)
      dragRef.current = { kind: 'move', start: toWorld(e.clientX, e.clientY), view: v, groupId, origin: { x: g.placement.x, y: g.placement.y }, moved: false }
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    dragRef.current = { kind: 'pan', start: { x: e.clientX, y: e.clientY }, view: v, moved: false }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    if (drag.kind === 'pan') {
      const dx = ((e.clientX - drag.start.x) / size.w) * drag.view.w
      const dy = ((e.clientY - drag.start.y) / size.w) * drag.view.w
      if (Math.abs(dx) + Math.abs(dy) > 0) drag.moved = true
      setAutoFit(false)
      setView({ ...drag.view, x: drag.view.x - dx, y: drag.view.y - dy })
    } else if (drag.groupId && drag.origin) {
      const p = toWorld(e.clientX, e.clientY)
      const g = groupById.get(drag.groupId)
      if (g?.placement.kind !== 'single') return
      drag.moved = true
      updateGroup(drag.groupId, {
        placement: { ...g.placement, x: Math.round(drag.origin.x + p.x - drag.start.x), y: Math.round(drag.origin.y + p.y - drag.start.y) },
      })
    }
  }

  const onPointerUp = () => {
    if (dragRef.current?.kind === 'pan' && !dragRef.current.moved) selectGroup(null)
    dragRef.current = null
  }

  const outlineD = result.outline.map((r) => d(r, true)).join(' ')
  const holesD = result.cutouts.map((c) => d(c.polygon, true)).join(' ')
  const strokeW = Math.max(0.3, mmPerPx * 1.2)
  const perforated = design.sheet.hinge.style === 'perforated'

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-neutral-950">
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        viewBox={`${v.x} ${v.y} ${v.w} ${vh}`}
        className="block touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Cutting bed, anchored at the part's lower-left corner. */}
        <rect
          x={b.minX}
          y={-(b.minY + bedH)}
          width={bedW}
          height={bedH}
          fill="none"
          stroke={result.stats.fitsBed || result.stats.fitsBedRotated ? '#3f3f46' : '#ef4444'}
          strokeWidth={strokeW}
          strokeDasharray={`${strokeW * 6} ${strokeW * 4}`}
        />
        <path d={`${outlineD} ${holesD}`} fillRule="evenodd" fill="#27272a" stroke="#3b82f6" strokeWidth={strokeW} />

        {result.flaps.map((f) => {
          const invalid = result.invalidIds.has(f.id)
          const selected = f.groupId === selectedId
          const g = groupById.get(f.groupId)
          return (
            <g key={f.id} onPointerDown={(e) => onFeatureDown(e, f.groupId)} className={g?.placement.kind === 'single' ? 'cursor-move' : 'cursor-pointer'}>
              <path d={d(f.polygon, true)} fill={invalid ? 'rgba(239,68,68,0.45)' : foldFill(f.fold)} stroke="none" />
              {f.attach === 'inset' && <path d={d(f.cutPath, false)} fill="none" stroke={selected ? '#c084fc' : '#3b82f6'} strokeWidth={selected ? strokeW * 1.8 : strokeW} />}
              {f.attach === 'edge' && selected && <path d={d(f.polygon, true)} fill="none" stroke="#c084fc" strokeWidth={strokeW * 1.8} />}
              <path d={d([f.hingeA, f.hingeB], false)} stroke="#fb923c" strokeWidth={strokeW} strokeDasharray={`${strokeW * 4} ${strokeW * 3}`} />
              {perforated &&
                perforationSegments(f.hingeA, f.hingeB, design.sheet.hinge).map(([a, b2], i) => (
                  <path key={i} d={d([a, b2], false)} stroke="#3b82f6" strokeWidth={strokeW * 1.5} />
                ))}
            </g>
          )
        })}

        {result.cutouts.map((c) => {
          const invalid = result.invalidIds.has(c.id)
          const selected = c.groupId === selectedId
          const g = groupById.get(c.groupId)
          return (
            <path
              key={c.id}
              d={d(c.polygon, true)}
              onPointerDown={(e) => onFeatureDown(e, c.groupId)}
              className={g?.placement.kind === 'single' ? 'cursor-move' : 'cursor-pointer'}
              fill={invalid ? 'rgba(239,68,68,0.45)' : 'rgba(10,10,10,0.01)'}
              stroke={selected ? '#c084fc' : '#3b82f6'}
              strokeWidth={selected ? strokeW * 1.8 : strokeW}
            />
          )
        })}

        {result.reliefs.map((r, i) => (
          <path key={i} d={d(r, true)} fill="#0a0a0a" stroke="#3b82f6" strokeWidth={strokeW * 0.8} />
        ))}
      </svg>

      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-3 text-[11px] text-neutral-500">
        <span className="flex items-center gap-1">
          <i className="inline-block h-0.5 w-4 bg-blue-500" /> cut
        </span>
        <span className="flex items-center gap-1">
          <i className="inline-block h-0.5 w-4 border-t border-dashed border-orange-400" /> bend
        </span>
        <span className="flex items-center gap-1">
          <i className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-400/50" /> folds up
        </span>
        <span className="flex items-center gap-1">
          <i className="inline-block h-2.5 w-2.5 rounded-sm bg-teal-400/50" /> folds down
        </span>
        <span className="flex items-center gap-1">
          <i className="inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-neutral-500" /> bed
        </span>
      </div>
      <button
        type="button"
        onClick={() => setAutoFit(true)}
        title="Fit to view"
        className="absolute top-3 right-3 rounded-md border border-neutral-700 bg-neutral-900/80 p-1.5 text-neutral-400 hover:text-neutral-100"
      >
        <Maximize size={14} />
      </button>
    </div>
  )
}
