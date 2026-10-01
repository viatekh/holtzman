import { useMemo } from 'react'
import type { BuildResult, CutPath } from '../../lib/geometry/types'
import type { NestResult } from '../../lib/nest'
import { placedPaths } from '../../lib/nest'

function d(path: CutPath, height: number, ox: number): string {
  const pts = path.points
  let s = `M${(pts[0].x + ox).toFixed(1)} ${(height - pts[0].y).toFixed(1)}`
  for (let i = 1; i < pts.length; i++) s += `L${(pts[i].x + ox).toFixed(1)} ${(height - pts[i].y).toFixed(1)}`
  return path.closed ? s + 'Z' : s
}

const PART_TINTS = ['#a855f7', '#f97316', '#14b8a6', '#eab308', '#ec4899', '#3b82f6', '#84cc16']

/** Every copy of every part, packed onto as many cutting beds as needed. */
export function NestView({ nest, results, partOrder }: { nest: NestResult; results: Map<string, BuildResult>; partOrder: string[] }) {
  const gap = nest.bed.width * 0.08
  const total = Math.max(1, nest.beds.length)
  const W = total * nest.bed.width + (total - 1) * gap
  const H = nest.bed.height

  const drawn = useMemo(
    () =>
      nest.beds.map((bed, bi) => {
        const ox = bi * (nest.bed.width + gap)
        return bed.items.map((item, ii) => {
          const r = results.get(item.partId)
          if (!r) return null
          const tint = PART_TINTS[Math.max(0, partOrder.indexOf(item.partId)) % PART_TINTS.length]
          const paths = placedPaths(item, r)
          return (
            <g key={`${bi}-${ii}`}>
              <rect x={item.x + ox} y={H - item.y - item.height} width={item.width} height={item.height} fill={tint} fillOpacity={0.06} />
              {paths
                .filter((p) => p.layer === 'cut')
                .map((p, k) => (
                  <path key={k} d={d(p, H, ox)} fill="none" stroke={tint} strokeWidth={W / 900} />
                ))}
            </g>
          )
        })
      }),
    [nest, results, gap, H, W, partOrder],
  )

  return (
    <div className="flex h-full w-full flex-col bg-neutral-950">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-neutral-800 px-4 py-2 text-xs text-neutral-400">
        <span>
          <b className="text-neutral-200">{nest.totalCopies}</b> pieces on <b className="text-neutral-200">{nest.beds.length}</b> bed{nest.beds.length === 1 ? '' : 's'} of {nest.bed.width} × {nest.bed.height} mm
        </span>
        {nest.oversize.length > 0 && <span className="text-red-400">{nest.oversize.length} piece(s) too big for the bed</span>}
        <span className="text-neutral-500">Simple shelf packing — your CAM's nesting will usually do tighter.</span>
      </div>
      <div className="min-h-0 flex-1 p-6">
        <svg viewBox={`${-gap / 2} ${-gap / 2} ${W + gap} ${H + gap}`} className="h-full w-full">
          {nest.beds.map((_, bi) => (
            <g key={bi}>
              <rect x={bi * (nest.bed.width + gap)} y={0} width={nest.bed.width} height={H} fill="#18181b" stroke="#3f3f46" strokeWidth={W / 600} />
              <text x={bi * (nest.bed.width + gap)} y={-gap / 8} fontSize={gap / 3} fill="#71717a">
                Bed {bi + 1}
              </text>
            </g>
          ))}
          {drawn}
        </svg>
      </div>
    </div>
  )
}
