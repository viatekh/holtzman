import type { BedSize, BuildResult, CutPath, Part, Point } from './geometry/types'
import { instanceCount } from './three/partGeometry'

export interface NestItem {
  partId: string
  partName: string
  copy: number
  /** Position of the item's lower-left corner on its bed (mm). */
  x: number
  y: number
  rotated: boolean
  scale: number
  width: number
  height: number
}

export interface NestedBed {
  items: NestItem[]
}

export interface NestResult {
  bed: BedSize
  beds: NestedBed[]
  /** Copies too big for the bed even when rotated. */
  oversize: { partName: string; width: number; height: number }[]
  totalCopies: number
}

/** Per-copy scale factor — only stacks scale their copies, and a scaled
 * copy is physically a different cut. */
export function copyScale(part: Part, copy: number): number {
  return part.array.kind === 'stack' ? Math.max(0.05, 1 + part.array.scaleStep * copy) : 1
}

/** Simple shelf packing — tried with copies kept upright and with copies
 * laid landscape, keeping whichever uses fewer beds. */
export function nestParts(parts: Part[], results: Map<string, BuildResult>, bed: BedSize, gap: number): NestResult {
  const a = shelfPack(parts, results, bed, gap, false)
  const b = shelfPack(parts, results, bed, gap, true)
  const used = (n: NestResult) => n.beds.length * 1e7 + (n.beds.at(-1)?.items.reduce((m, it) => Math.max(m, it.y + it.height), 0) ?? 0)
  return used(b) < used(a) ? b : a
}

function shelfPack(parts: Part[], results: Map<string, BuildResult>, bed: BedSize, gap: number, landscape: boolean): NestResult {
  const pending: Omit<NestItem, 'x' | 'y' | 'rotated'>[] = []
  const oversize: NestResult['oversize'] = []
  for (const part of parts) {
    const r = results.get(part.id)
    if (!r) continue
    const n = instanceCount(part.array)
    for (let copy = 0; copy < n; copy++) {
      const s = copyScale(part, copy)
      pending.push({ partId: part.id, partName: part.name, copy, scale: s, width: r.stats.widthMm * s, height: r.stats.heightMm * s })
    }
  }
  pending.sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height))

  const beds: NestedBed[] = []
  let bedItems: NestItem[] = []
  let cx = gap
  let cy = gap
  let shelfH = 0
  const flush = () => {
    if (bedItems.length) beds.push({ items: bedItems })
    bedItems = []
    cx = gap
    cy = gap
    shelfH = 0
  }

  for (const it of pending) {
    const fitsNormal = it.width + 2 * gap <= bed.width && it.height + 2 * gap <= bed.height
    const fitsRot = it.height + 2 * gap <= bed.width && it.width + 2 * gap <= bed.height
    if (!fitsNormal && !fitsRot) {
      oversize.push({ partName: it.partName, width: it.width, height: it.height })
      continue
    }
    const wantRot = landscape ? it.height > it.width : it.width > it.height && it.width + 2 * gap > bed.width / 2
    const rotated = !fitsNormal || (fitsRot && wantRot)
    const w = rotated ? it.height : it.width
    const h = rotated ? it.width : it.height
    if (cx + w + gap > bed.width) {
      cx = gap
      cy += shelfH + gap
      shelfH = 0
    }
    if (cy + h + gap > bed.height) flush()
    bedItems.push({ ...it, x: cx, y: cy, rotated, width: w, height: h })
    cx += w + gap
    shelfH = Math.max(shelfH, h)
  }
  flush()
  return { bed, beds, oversize, totalCopies: pending.length }
}

/** A part's cut paths placed onto its bed position (mm, bed origin at 0,0). */
export function placedPaths(item: NestItem, result: BuildResult): CutPath[] {
  const { minX, minY } = result.bounds
  const s = item.scale
  const h0 = result.stats.heightMm * s
  return result.paths.map((p) => ({
    ...p,
    points: p.points.map((q): Point => {
      const x = (q.x - minX) * s
      const y = (q.y - minY) * s
      // Rotate 90° CCW and shift back into the positive quadrant.
      return item.rotated ? { x: item.x + (h0 - y), y: item.y + x } : { x: item.x + x, y: item.y + y }
    }),
  }))
}

const BED_GAP = 100

/** Every nested bed side by side in one drawing, each with its boundary on
 * the SHEET reference layer. */
export function nestedPaths(nest: NestResult, results: Map<string, BuildResult>, includeBend: boolean): CutPath[] {
  const out: CutPath[] = []
  nest.beds.forEach((bed, i) => {
    const ox = i * (nest.bed.width + BED_GAP)
    out.push({
      layer: 'sheet',
      closed: true,
      points: [
        { x: ox, y: 0 },
        { x: ox + nest.bed.width, y: 0 },
        { x: ox + nest.bed.width, y: nest.bed.height },
        { x: ox, y: nest.bed.height },
      ],
    })
    for (const item of bed.items) {
      const r = results.get(item.partId)
      if (!r) continue
      for (const p of placedPaths(item, r)) {
        if (p.layer === 'bend' && !includeBend) continue
        out.push({ ...p, points: p.points.map((q) => ({ x: q.x + ox, y: q.y })) })
      }
    }
  })
  return out
}
