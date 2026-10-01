import { sampleBoundary } from './polygon'
import { hash32, mulberry32 } from './random'
import type { FoldConfig, Placement, Point, Polygon } from './types'

export interface PlacedSite {
  index: number
  /** Hinge centre (flaps) or shape centre (cutouts). */
  x: number
  y: number
  /** Direction the feature points, radians (flaps: hinge → tip). */
  angle: number
  scale: number
  /** 0..1 progress through the group (inner→outer, first→last row) —
   * drives fold gradients. */
  t: number
  /** Set for edge placements: unit outward normal at the sample. */
  outward?: Point
}

const DEG = Math.PI / 180

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function pointingAngle(radial: number, pointing: 'out' | 'in' | 'tangent'): number {
  if (pointing === 'in') return radial + Math.PI
  if (pointing === 'tangent') return radial + Math.PI / 2
  return radial
}

export function placeSites(placement: Placement, baseOutline: Polygon): PlacedSite[] {
  const sites: PlacedSite[] = []
  switch (placement.kind) {
    case 'single':
      sites.push({ index: 0, x: placement.x, y: placement.y, angle: placement.angle * DEG, scale: 1, t: 0 })
      break
    case 'radial': {
      const rings = Math.max(1, Math.round(placement.rings))
      let index = 0
      for (let k = 0; k < rings; k++) {
        const t = rings > 1 ? k / (rings - 1) : 0
        const r = placement.innerRadius + k * placement.ringSpacing
        const n = Math.max(1, Math.round(placement.perRing + k * placement.perRingGrowth))
        const offset = placement.staggerRings && k % 2 === 1 ? Math.PI / n : 0
        for (let i = 0; i < n; i++) {
          const a = placement.startAngle * DEG + offset + (i / n) * Math.PI * 2
          sites.push({
            index: index++,
            x: placement.cx + r * Math.cos(a),
            y: placement.cy + r * Math.sin(a),
            angle: pointingAngle(a, placement.pointing),
            scale: lerp(placement.scaleInner, placement.scaleOuter, t),
            t,
          })
        }
      }
      break
    }
    case 'grid': {
      const rows = Math.max(1, Math.round(placement.rows))
      const cols = Math.max(1, Math.round(placement.cols))
      let index = 0
      for (let r = 0; r < rows; r++) {
        const shift = placement.stagger && r % 2 === 1 ? placement.spacingX / 2 : 0
        for (let c = 0; c < cols; c++) {
          sites.push({
            index: index++,
            x: placement.cx + (c - (cols - 1) / 2) * placement.spacingX + shift,
            y: placement.cy + (r - (rows - 1) / 2) * placement.spacingY,
            angle: placement.angle * DEG,
            scale: 1,
            t: rows > 1 ? r / (rows - 1) : 0,
          })
        }
      }
      break
    }
    case 'spiral': {
      const count = Math.max(1, Math.round(placement.count))
      const start = Math.max(0, Math.round(placement.startIndex))
      for (let i = 0; i < count; i++) {
        const n = start + i
        const r = placement.spacing * Math.sqrt(n)
        const a = n * placement.divergence * DEG
        const t = count > 1 ? i / (count - 1) : 0
        sites.push({
          index: i,
          x: placement.cx + r * Math.cos(a),
          y: placement.cy + r * Math.sin(a),
          angle: pointingAngle(a, placement.pointing),
          scale: lerp(placement.scaleInner, placement.scaleOuter, t),
          t,
        })
      }
      break
    }
    case 'line': {
      const count = Math.max(1, Math.round(placement.count))
      for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) : 0.5
        sites.push({
          index: i,
          x: lerp(placement.x1, placement.x2, t),
          y: lerp(placement.y1, placement.y2, t),
          angle: placement.angle * DEG,
          scale: lerp(placement.scaleStart, placement.scaleEnd, t),
          t,
        })
      }
      break
    }
    case 'edge': {
      const count = Math.max(1, Math.round(placement.count))
      const samples = sampleBoundary(baseOutline, count, placement.phase)
      samples.forEach((s, i) => {
        const out = Math.atan2(s.outward.y, s.outward.x)
        sites.push({
          index: i,
          x: s.point.x,
          y: s.point.y,
          angle: placement.pointing === 'in' ? out + Math.PI : out,
          scale: 1,
          t: count > 1 ? i / (count - 1) : 0,
          outward: s.outward,
        })
      })
      break
    }
  }
  return sites
}

/** Signed fold angle (deg, + = up) for one flap. */
export function foldAngleFor(fold: FoldConfig, site: PlacedSite): number {
  let a = fold.angle
  const v = fold.variation
  switch (v.kind) {
    case 'constant':
      break
    case 'gradient':
      a = lerp(fold.angle, v.endAngle, site.t)
      break
    case 'wave': {
      const dir = v.direction * DEG
      const d = site.x * Math.cos(dir) + site.y * Math.sin(dir)
      a = fold.angle + v.amplitude * Math.sin((2 * Math.PI * d) / Math.max(1, v.wavelength))
      break
    }
    case 'random': {
      const rng = mulberry32(hash32(v.seed, site.index))
      a = fold.angle + (rng() * 2 - 1) * v.spread
      break
    }
  }
  a = Math.max(0, Math.min(180, a))
  const sign = fold.direction === 'down' ? -1 : fold.direction === 'alternate' && site.index % 2 === 1 ? -1 : 1
  return sign * a
}
