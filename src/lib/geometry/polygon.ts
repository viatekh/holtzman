import type { Bounds, Point, Polygon } from './types'

/** Signed shoelace area — positive for counter-clockwise (y-up) rings. */
export function signedArea(poly: Polygon): number {
  let a = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y)
  }
  return -a / 2
}

export function area(poly: Polygon): number {
  return Math.abs(signedArea(poly))
}

export function bounds(poly: Point[]): Bounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of poly) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

export function boundsOfPolygons(polys: Point[][]): Bounds {
  const b: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const p of polys) {
    if (p.length === 0) continue
    const pb = bounds(p)
    b.minX = Math.min(b.minX, pb.minX)
    b.minY = Math.min(b.minY, pb.minY)
    b.maxX = Math.max(b.maxX, pb.maxX)
    b.maxY = Math.max(b.maxY, pb.maxY)
  }
  if (!Number.isFinite(b.minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  return b
}

export function boundsOverlap(a: Bounds, b: Bounds, margin = 0): boolean {
  return a.minX - margin <= b.maxX && b.minX - margin <= a.maxX && a.minY - margin <= b.maxY && b.minY - margin <= a.maxY
}

export function centroid(poly: Polygon): Point {
  let cx = 0
  let cy = 0
  let a = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const f = poly[j].x * poly[i].y - poly[i].x * poly[j].y
    cx += (poly[j].x + poly[i].x) * f
    cy += (poly[j].y + poly[i].y) * f
    a += f
  }
  if (Math.abs(a) < 1e-9) {
    const n = poly.length || 1
    return { x: poly.reduce((s, p) => s + p.x, 0) / n, y: poly.reduce((s, p) => s + p.y, 0) / n }
  }
  return { x: cx / (3 * a), y: cy / (3 * a) }
}

export function pointInPolygon(pt: Point, poly: Polygon): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function pointSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = cross(c, d, a)
  const d2 = cross(c, d, b)
  const d3 = cross(a, b, c)
  const d4 = cross(a, b, d)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

export function segmentDistance(a: Point, b: Point, c: Point, d: Point): number {
  if (segmentsIntersect(a, b, c, d)) return 0
  return Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b),
  )
}

/** Smallest gap between two closed polygons' boundaries — 0 when they cross,
 * negative when one sits wholly inside the other. Early-outs once it finds a
 * gap below `stopBelow`, since callers only care about "closer than X". */
export function polygonGap(p: Polygon, q: Polygon, stopBelow = 0): number {
  if (pointInPolygon(p[0], q) || pointInPolygon(q[0], p)) return -1
  let best = Infinity
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    for (let k = 0, l = q.length - 1; k < q.length; l = k++) {
      const d = segmentDistance(p[j], p[i], q[l], q[k])
      if (d < best) {
        best = d
        if (best < stopBelow) return best
      }
    }
  }
  return best
}

/** Smallest distance from any vertex/edge of `inner` to the boundary of
 * `outer` — used for "how much metal is left between this cut and the
 * sheet edge". Returns a negative value if any vertex lies outside. */
export function insetClearance(inner: Point[], outer: Polygon, stopBelow = 0): number {
  for (const p of inner) if (!pointInPolygon(p, outer)) return -1
  let best = Infinity
  for (let i = 1; i < inner.length + 1; i++) {
    const a = inner[i - 1]
    const b = inner[i % inner.length]
    for (let k = 0, l = outer.length - 1; k < outer.length; l = k++) {
      const d = segmentDistance(a, b, outer[l], outer[k])
      if (d < best) {
        best = d
        if (best < stopBelow) return best
      }
    }
  }
  return best
}

export function polylineLength(pts: Point[], closed: boolean): number {
  let len = 0
  for (let i = 1; i < pts.length; i++) len += distance(pts[i - 1], pts[i])
  if (closed && pts.length > 2) len += distance(pts[pts.length - 1], pts[0])
  return len
}

export function transformPoints(pts: Point[], tx: number, ty: number, angleRad: number, scale = 1): Point[] {
  const c = Math.cos(angleRad) * scale
  const s = Math.sin(angleRad) * scale
  return pts.map((p) => ({ x: tx + p.x * c - p.y * s, y: ty + p.x * s + p.y * c }))
}

export function ensureCCW(poly: Polygon): Polygon {
  return signedArea(poly) < 0 ? [...poly].reverse() : poly
}

export interface BoundarySample {
  point: Point
  /** Unit tangent, following the ring's own (CCW) order. */
  tangent: Point
  /** Unit outward normal. */
  outward: Point
}

/** `count` evenly arc-length-spaced samples around a closed ring, starting
 * `phase` (0..1 of the perimeter) along. */
export function sampleBoundary(poly: Polygon, count: number, phase = 0): BoundarySample[] {
  const ring = ensureCCW(poly)
  const total = polylineLength(ring, true)
  if (count <= 0 || total === 0) return []
  const out: BoundarySample[] = []
  const step = total / count
  let seg = 0
  let segStart = 0
  const segLen = (i: number) => distance(ring[i], ring[(i + 1) % ring.length])
  for (let k = 0; k < count; k++) {
    const target = (((phase % 1) + 1) % 1) * total + k * step
    const t = target % total
    if (t < segStart) {
      seg = 0
      segStart = 0
    }
    while (segStart + segLen(seg) < t && seg < ring.length - 1) {
      segStart += segLen(seg)
      seg++
    }
    const a = ring[seg]
    const b = ring[(seg + 1) % ring.length]
    const len = segLen(seg) || 1
    const u = (t - segStart) / len
    // Average the tangent across a small window so polygon corners and
    // tessellated curves don't produce kinked normals.
    const prev = ring[(seg - 1 + ring.length) % ring.length]
    const next = ring[(seg + 2) % ring.length]
    let tx = b.x - a.x + (u < 0.5 ? (a.x - prev.x) * (0.5 - u) : (next.x - b.x) * (u - 0.5))
    let ty = b.y - a.y + (u < 0.5 ? (a.y - prev.y) * (0.5 - u) : (next.y - b.y) * (u - 0.5))
    const tl = Math.hypot(tx, ty) || 1
    tx /= tl
    ty /= tl
    out.push({
      point: { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u },
      tangent: { x: tx, y: ty },
      outward: { x: ty, y: -tx },
    })
  }
  return out
}

/** Circle as a polygon with enough segments to look round at plate scale. */
export function circlePolygon(cx: number, cy: number, r: number, segments?: number): Polygon {
  const n = segments ?? Math.max(16, Math.min(96, Math.round(r * 2)))
  const pts: Point[] = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) })
  }
  return pts
}

/** Keeps every k-th vertex so the ring has at most `maxPoints` — a cheap,
 * slightly conservative stand-in for spacing checks on smooth outlines. */
export function decimate(poly: Polygon, maxPoints: number): Polygon {
  if (poly.length <= maxPoints) return poly
  const step = poly.length / maxPoints
  const out: Point[] = []
  for (let i = 0; i < maxPoints; i++) out.push(poly[Math.floor(i * step)])
  if (out[out.length - 1] !== poly[poly.length - 1]) out.push(poly[poly.length - 1])
  return out
}
