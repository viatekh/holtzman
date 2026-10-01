import { offsetPolys } from './clipper'
import { centroid, circlePolygon, ensureCCW } from './polygon'
import { hash32, mulberry32 } from './random'
import type { CutoutShape, FlapShape, OutlineShape, Point, Polygon } from './types'

const CURVE_SEGMENTS = 160

// ─── Sheet outlines ─────────────────────────────────────────────────────────

function roundedRect(w: number, h: number, r: number): Polygon {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  const hw = w / 2
  const hh = h / 2
  if (rr === 0)
    return [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
    ]
  const pts: Point[] = []
  const corners = [
    { cx: hw - rr, cy: -hh + rr, a0: -Math.PI / 2 },
    { cx: hw - rr, cy: hh - rr, a0: 0 },
    { cx: -hw + rr, cy: hh - rr, a0: Math.PI / 2 },
    { cx: -hw + rr, cy: -hh + rr, a0: Math.PI },
  ]
  const seg = Math.max(4, Math.round(rr / 2))
  for (const c of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = c.a0 + (i / seg) * (Math.PI / 2)
      pts.push({ x: c.cx + rr * Math.cos(a), y: c.cy + rr * Math.sin(a) })
    }
  }
  return pts
}

function roundPolygonCorners(poly: Polygon, r: number): Polygon {
  if (r <= 0) return poly
  const shrunk = offsetPolys([poly], -r)
  if (shrunk.length === 0) return poly
  return offsetPolys(shrunk, r)[0] ?? poly
}

function signedPow(v: number, e: number): number {
  return Math.sign(v) * Math.abs(v) ** e
}

export function buildOutline(shape: OutlineShape): Polygon {
  switch (shape.kind) {
    case 'rect':
      return roundedRect(shape.width, shape.height, shape.cornerRadius)
    case 'ellipse': {
      const pts: Point[] = []
      for (let i = 0; i < CURVE_SEGMENTS; i++) {
        const t = (i / CURVE_SEGMENTS) * Math.PI * 2
        pts.push({ x: (shape.width / 2) * Math.cos(t), y: (shape.height / 2) * Math.sin(t) })
      }
      return pts
    }
    case 'polygon': {
      const n = Math.max(3, Math.round(shape.sides))
      const rot = (shape.rotation * Math.PI) / 180 + Math.PI / 2
      const pts: Point[] = []
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * Math.PI * 2
        pts.push({ x: shape.radius * Math.cos(a), y: shape.radius * Math.sin(a) })
      }
      return ensureCCW(roundPolygonCorners(pts, shape.cornerRadius))
    }
    case 'superellipse': {
      const p = 2 / Math.max(0.3, shape.exponent)
      const pts: Point[] = []
      for (let i = 0; i < CURVE_SEGMENTS; i++) {
        const t = (i / CURVE_SEGMENTS) * Math.PI * 2
        pts.push({ x: (shape.width / 2) * signedPow(Math.cos(t), p), y: (shape.height / 2) * signedPow(Math.sin(t), p) })
      }
      return pts
    }
    case 'blob': {
      const maxH = Math.max(2, Math.round(shape.complexity))
      const rng = mulberry32(hash32(shape.seed))
      const harmonics: { k: number; amp: number; phase: number }[] = []
      for (let k = 2; k <= maxH; k++) harmonics.push({ k, amp: rng(), phase: rng() * Math.PI * 2 })
      const total = harmonics.reduce((s, h) => s + h.amp, 0) || 1
      const irr = Math.min(0.9, Math.max(0, shape.irregularity))
      const pts: Point[] = []
      for (let i = 0; i < CURVE_SEGMENTS; i++) {
        const th = (i / CURVE_SEGMENTS) * Math.PI * 2
        let r = shape.radius
        for (const h of harmonics) r += shape.radius * irr * (h.amp / total) * Math.cos(h.k * th + h.phase)
        pts.push({ x: r * Math.cos(th), y: r * Math.sin(th) })
      }
      return pts
    }
  }
}

// ─── Flap profiles ──────────────────────────────────────────────────────────

/** Half-width at t (0 = hinge, 1 = tip), as a fraction of half the hinge
 * width, before tip rounding. */
function halfWidthFactor(shape: FlapShape, t: number): number {
  const { taper } = shape
  switch (shape.kind) {
    case 'tab':
      return Math.max(0, 1 + (taper - 1) * t)
    case 'spike':
    case 'flame':
      return Math.max(0, (1 - t) * (1 + taper * Math.sin(Math.PI * t)))
    case 'leaf':
      return Math.max(0, (1 - t) ** 0.8 * (1 + taper * 1.6 * Math.sin(Math.PI * t)))
    case 'petal':
      return Math.max(0, 1 + taper * Math.sin(Math.PI * Math.min(1, t * 1.1)))
    case 'scale':
      return Math.max(0, 1 + taper * t)
  }
}

function effectiveRoundness(shape: FlapShape): number {
  const r = Math.min(1, Math.max(0, shape.roundness))
  if (shape.kind === 'petal') return Math.max(0.25, r)
  return r
}

function headingAt(shape: FlapShape, t: number): number {
  const curl = (shape.curl * Math.PI) / 180
  if (shape.kind === 'flame') return Math.PI / 2 + curl * Math.sin(2 * Math.PI * t) * 0.6 + curl * t * 0.4
  return Math.PI / 2 + curl * t
}

/** Builds a flap in its local frame: hinge along the x axis from (+w/2, 0)
 * to (−w/2, 0), the flap rising toward +y. Returns the open cut path (hinge
 * end A, round the tip, to hinge end B); the closed polygon is that same
 * ring with the hinge as its closing edge. */
export function buildFlapLocal(shape: FlapShape): Point[] {
  const L = Math.max(1, shape.length)
  const hw0 = Math.max(0.5, shape.width / 2)
  const r = effectiveRoundness(shape)
  const N = 56
  const right: Point[] = []
  const left: Point[] = []
  let px = 0
  let py = 0
  let prevT = 0
  for (let i = 0; i <= N; i++) {
    // Denser sampling toward the tip, where rounding curves fastest.
    const t = Math.sin(((i / N) * Math.PI) / 2)
    if (i > 0) {
      const tm = (t + prevT) / 2
      const h = headingAt(shape, tm)
      const ds = (t - prevT) * L
      px += Math.cos(h) * ds
      py += Math.sin(h) * ds
    }
    prevT = t
    const heading = headingAt(shape, t)
    let f = halfWidthFactor(shape, t)
    if (r > 0 && t > 1 - r) {
      const u = (t - (1 - r)) / r
      f *= Math.sqrt(Math.max(0, 1 - u * u))
    }
    // Keep the inner side of a curled flap from folding over itself.
    let hw = f * hw0
    const curl = Math.abs((shape.curl * Math.PI) / 180)
    if (curl > 1e-3) hw = Math.min(hw, (0.85 * L) / curl)
    const nx = -Math.sin(heading)
    const ny = Math.cos(heading)
    if (i === 0) {
      right.push({ x: hw0, y: 0 })
      left.push({ x: -hw0, y: 0 })
      continue
    }
    right.push({ x: px - nx * hw, y: py - ny * hw })
    left.push({ x: px + nx * hw, y: py + ny * hw })
  }
  // Collapse a pointed tip to a single vertex.
  const tipR = right[right.length - 1]
  const tipL = left[left.length - 1]
  if (Math.hypot(tipR.x - tipL.x, tipR.y - tipL.y) < 1e-6) left.pop()
  return [...right, ...left.reverse()]
}

// ─── Cutout shapes ──────────────────────────────────────────────────────────

/** A drop-out shape centred on the origin, pointing toward +y. */
export function buildCutoutLocal(shape: CutoutShape): Polygon {
  switch (shape.kind) {
    case 'circle':
      return circlePolygon(0, 0, Math.max(0.5, shape.diameter / 2))
    case 'slot': {
      const w = Math.max(0.5, shape.width)
      return roundedRect(w, Math.max(w, shape.length), w / 2)
    }
    case 'polygon': {
      const n = Math.max(3, Math.round(shape.sides))
      const pts: Point[] = []
      for (let i = 0; i < n; i++) {
        const a = Math.PI / 2 + (i / n) * Math.PI * 2
        pts.push({ x: shape.radius * Math.cos(a), y: shape.radius * Math.sin(a) })
      }
      return pts
    }
    case 'profile': {
      const local = buildFlapLocal(shape.profile)
      const c = centroid(local)
      return local.map((p) => ({ x: p.x - c.x, y: p.y - c.y }))
    }
  }
}

/** Rough "radius" of a cutout — used to space generated copies. */
export function cutoutExtent(shape: CutoutShape): number {
  switch (shape.kind) {
    case 'circle':
      return shape.diameter / 2
    case 'slot':
      return Math.max(shape.length, shape.width) / 2
    case 'polygon':
      return shape.radius
    case 'profile':
      return Math.max(shape.profile.length, shape.profile.width) / 2
  }
}
