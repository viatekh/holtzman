import * as THREE from 'three'
import { intersectPolys, offsetOpenPath, offsetPolys, unionPolys } from '../geometry/clipper'
import { buildFoldPanels } from '../geometry/fold'
import { area } from '../geometry/polygon'
import type { BuildResult, JoineryConfig, Part, Point, Polygon } from '../geometry/types'
import { arrayMatrices, foldMatrix, instanceCount, posedGeometry, preparePart } from './partGeometry'

export const DEFAULT_JOINERY: JoineryConfig = { autoSlots: true, clearance: 1 }

const boxCache = new WeakMap<BuildResult, Map<string, THREE.Box3>>()

/** The posed part's local bounding box — what array matrices pivot on. */
export function posedBox(part: Part, result: BuildResult): THREE.Box3 {
  let m = boxCache.get(result)
  if (!m) {
    m = new Map()
    boxCache.set(result, m)
  }
  const key = `${part.sheet.thickness}|${JSON.stringify(part.form)}`
  let box = m.get(key)
  if (!box) {
    const g = posedGeometry(preparePart(result, part.sheet.thickness, part.form), 1)
    box = g.boundingBox!.clone()
    g.dispose()
    m.set(key, box)
  }
  return box
}

/** World matrices of every copy of a part (mm, y-up). */
export function partMatrices(part: Part, result: BuildResult): THREE.Matrix4[] {
  return arrayMatrices(part.array, posedBox(part, result))
}

/** Sutherland–Hodgman clip of a planar 3D polygon against s·p ≥ c. */
function clipPlane(poly: THREE.Vector3[], n: THREE.Vector3, c: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const da = a.dot(n) - c
    const db = b.dot(n) - c
    if (da >= 0) out.push(a)
    if (da >= 0 !== db >= 0) out.push(a.clone().lerp(b, da / (da - db)))
  }
  return out
}

const Z = new THREE.Vector3(0, 0, 1)

/** The slab |z| ≤ h of a plate (in that plate's own frame) intersected with
 * another flat panel, optionally cut in half along the crossing line. */
function slabSection(poly: THREE.Vector3[], h: number): THREE.Vector3[] {
  let p = clipPlane(poly, Z, -h)
  if (p.length >= 3) p = clipPlane(p, Z.clone().negate(), -h)
  return p
}

function extent(poly: THREE.Vector3[], d: THREE.Vector3): [number, number] {
  let lo = Infinity
  let hi = -Infinity
  for (const p of poly) {
    const s = p.dot(d)
    lo = Math.min(lo, s)
    hi = Math.max(hi, s)
  }
  return [lo, hi]
}

/** Footprint of a clipped section on the plate, widened to fit the other
 * panel's thickness (`halfWidth`, already corrected for crossing angle). */
function footprint(section: THREE.Vector3[], halfWidth: number): Polygon[] {
  const pts: Point[] = section.map((v) => ({ x: v.x, y: v.y }))
  if (pts.length >= 3 && area(pts) > 0.5) return offsetPolys([convexHull(pts)], halfWidth)
  // Edge-on crossing: the section projects to a line — thicken it.
  let a = pts[0]
  let b = pts[0]
  let best = -1
  for (const p of pts)
    for (const q of pts) {
      const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2
      if (d > best) {
        best = d
        a = p
        b = q
      }
    }
  return best > 0.01 ? offsetOpenPath([a, b], halfWidth) : []
}

function convexHull(pts: Point[]): Point[] {
  const s = [...pts].sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower: Point[] = []
  for (const p of s) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Point[] = []
  for (let i = s.length - 1; i >= 0; i--) {
    const p = s[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

interface WorldPanel {
  partIndex: number
  copy: number
  isBase: boolean
  /** Panel outline in world space, on the panel's mid-plane. */
  outer: THREE.Vector3[]
  normal: THREE.Vector3
  thickness: number
  box: THREE.Box3
}

/**
 * For every flat (unrolled) part, the slots its base plate needs so the
 * other assembled parts can pass through it — in that part's own sheet
 * coordinates. A flap or rolled part crossing a plate gets a full-depth
 * slot; two base plates crossing each other get matching half-depth
 * (egg-crate) slots so they slide together.
 */
export function computeSlots(parts: Part[], results: Map<string, BuildResult>, config: JoineryConfig): Map<string, Polygon[]> {
  const out = new Map<string, Polygon[]>()
  if (!config.autoSlots || parts.reduce((n, p) => n + instanceCount(p.array), 0) < 2) return out

  const matrices = parts.map((p) => {
    const r = results.get(p.id)
    return r ? partMatrices(p, r) : []
  })

  // Every flat panel of every copy, placed in the world.
  const world: WorldPanel[] = []
  parts.forEach((part, pi) => {
    const r = results.get(part.id)
    if (!r || part.form.kind === 'roll') return
    const panels = buildFoldPanels(r)
    matrices[pi].forEach((W, copy) => {
      for (const panel of panels) {
        const M = W.clone().multiply(foldMatrix(panel, 1))
        const normal = Z.clone().transformDirection(M)
        for (const shape of panel.shapes) {
          const outer = shape.outer.map((q) => new THREE.Vector3(q.x, q.y, 0).applyMatrix4(M))
          world.push({ partIndex: pi, copy, isBase: panel.id === 'base', outer, normal, thickness: part.sheet.thickness, box: new THREE.Box3().setFromPoints(outer) })
        }
      }
    })
  })

  parts.forEach((part, ai) => {
    const r = results.get(part.id)
    if (!r || part.form.kind === 'roll') return
    const h = part.sheet.thickness / 2
    const found: Polygon[] = []
    const bases = world.filter((w) => w.partIndex === ai && w.isBase)

    for (const plate of bases) {
      const WA = matrices[ai][plate.copy]
      const inv = WA.clone().invert()
      const nA = plate.normal
      const plateBox = plate.box.clone().expandByScalar(h + 2)

      for (const other of world) {
        if (other.partIndex === ai && other.copy === plate.copy) continue
        // Two copies of the same plate would get each other's half-slots
        // unioned into one through-cut — leave those to the designer.
        if (other.partIndex === ai && other.isBase) continue
        if (!other.box.intersectsBox(plateBox)) continue

        const local = other.outer.map((v) => v.clone().applyMatrix4(inv))
        const nLocal = other.normal.clone().transformDirection(inv)
        const sin = Math.sqrt(Math.max(0, 1 - nLocal.z * nLocal.z))
        if (sin < 0.15) continue // near-parallel: stacked, not crossing
        let section = slabSection(local, h)
        if (section.length < 3) continue

        if (other.isBase) {
          // Egg-crate: each plate keeps the half of the crossing on the
          // side of (own normal × other normal) — opposite halves, since
          // that direction flips when the roles swap.
          const d = new THREE.Vector3().crossVectors(nA, other.normal).normalize()
          const otherInv = matrices[other.partIndex][other.copy].clone().invert()
          const mine = plate.outer.map((v) => v.clone().applyMatrix4(otherInv))
          const theirs = slabSection(mine, other.thickness / 2).map((v) => v.applyMatrix4(matrices[other.partIndex][other.copy]))
          if (theirs.length < 3) continue
          const ownWorld = section.map((v) => v.clone().applyMatrix4(WA))
          const [a0, a1] = extent(ownWorld, d)
          const [b0, b1] = extent(theirs, d)
          const mid = (Math.max(a0, b0) + Math.min(a1, b1)) / 2
          const dLocal = d.clone().transformDirection(inv)
          const cLocal = mid - new THREE.Vector3().applyMatrix4(WA).dot(d)
          section = clipPlane(section, dLocal, cLocal)
          if (section.length < 3) continue
        }

        const half = other.thickness / (2 * sin) + config.clearance
        found.push(...footprint(section, half))
      }
    }
    // Keep only slots that actually land on this plate's metal.
    const onPlate = unionPolys(found).filter((slot) => intersectPolys([slot], r.outline).some((piece) => area(piece) > 0.5))
    if (onPlate.length > 0) out.set(part.id, onPlate)
  })
  return out
}
