import * as THREE from 'three'
import { intersectPolys } from '../geometry/clipper'
import { buildFoldPanels, nestRings, type FoldPanel, type ShapeWithHoles } from '../geometry/fold'
import { bounds } from '../geometry/polygon'
import type { AssemblyArray, BuildResult, FormConfig, Polygon } from '../geometry/types'

interface PreparedPanel {
  panel: FoldPanel
  /** Flat, unfolded vertex positions (non-indexed triangles). */
  base: Float32Array
}

export interface PreparedPart {
  panels: PreparedPanel[]
  thickness: number
  form: FormConfig
  /** Sheet extent along the roll direction. */
  uMin: number
  uMax: number
  vertexCount: number
}

function toShape(s: ShapeWithHoles): THREE.Shape {
  const shape = new THREE.Shape(s.outer.map((p) => new THREE.Vector2(p.x, p.y)))
  for (const h of s.holes) shape.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p.x, p.y))))
  return shape
}

/** Slices shapes into narrow strips across the roll direction, so that
 * when vertices are bent onto a cylinder the faces follow the curve
 * instead of cutting chords through it. */
function stripSplit(shapes: ShapeWithHoles[], vertical: boolean, uMin: number, uMax: number, strip: number): ShapeWithHoles[] {
  const out: ShapeWithHoles[] = []
  for (const s of shapes) {
    const rings: Polygon[] = [s.outer, ...s.holes]
    const b = bounds(s.outer)
    const lo = vertical ? b.minX : b.minY
    const hi = vertical ? b.maxX : b.maxY
    const start = uMin + Math.floor((lo - uMin) / strip) * strip
    for (let u = start; u < hi; u += strip) {
      const u2 = Math.min(u + strip, Math.max(hi, uMax))
      const rect: Polygon = vertical
        ? [
            { x: u, y: b.minY - 1 },
            { x: u2, y: b.minY - 1 },
            { x: u2, y: b.maxY + 1 },
            { x: u, y: b.maxY + 1 },
          ]
        : [
            { x: b.minX - 1, y: u },
            { x: b.maxX + 1, y: u },
            { x: b.maxX + 1, y: u2 },
            { x: b.minX - 1, y: u2 },
          ]
      out.push(...nestRings(intersectPolys(rings, [rect])))
    }
  }
  return out
}

export function preparePart(result: BuildResult, thickness: number, form: FormConfig): PreparedPart {
  const panels = buildFoldPanels(result)
  const bb = bounds(result.baseOutline)
  const vertical = form.kind === 'roll' && form.axis === 'vertical'
  const uMin = vertical ? bb.minX : bb.minY
  const uMax = vertical ? bb.maxX : bb.maxY
  const strip = Math.max(3, (uMax - uMin) / 96)
  let vertexCount = 0
  const prepared = panels.map((panel) => {
    const shapes = form.kind === 'roll' ? stripSplit(panel.shapes, vertical, uMin, uMax, strip) : panel.shapes
    const geo = new THREE.ExtrudeGeometry(shapes.map(toShape), { depth: thickness, bevelEnabled: false, curveSegments: 1 })
    geo.translate(0, 0, -thickness / 2)
    const nonIndexed = geo.index ? geo.toNonIndexed() : geo
    const base = new Float32Array(nonIndexed.getAttribute('position').array)
    geo.dispose()
    if (nonIndexed !== geo) nonIndexed.dispose()
    vertexCount += base.length / 3
    return { panel, base }
  })
  return { panels: prepared, thickness, form, uMin, uMax, vertexCount }
}

/** Rotation about the hinge line by fold × progress; positive lifts the tip
 * toward +z (out of the sheet's top face, or out of a rolled tube). */
export function foldMatrix(panel: FoldPanel, progress: number): THREE.Matrix4 {
  const m = new THREE.Matrix4()
  if (!panel.hingeA || !panel.hingeB || panel.fold === 0 || progress === 0) return m
  const hx = (panel.hingeA.x + panel.hingeB.x) / 2
  const hy = (panel.hingeA.y + panel.hingeB.y) / 2
  // Hinge runs A→B with the flap on its left, so spine = A→B rotated −90°.
  const dx = panel.hingeB.x - panel.hingeA.x
  const dy = panel.hingeB.y - panel.hingeA.y
  const len = Math.hypot(dx, dy) || 1
  const spine = new THREE.Vector3(dy / len, -dx / len, 0)
  const axis = new THREE.Vector3().crossVectors(spine, new THREE.Vector3(0, 0, 1)).normalize()
  m.makeTranslation(hx, hy, 0)
  m.multiply(new THREE.Matrix4().makeRotationAxis(axis, THREE.MathUtils.degToRad(panel.fold * progress)))
  m.multiply(new THREE.Matrix4().makeTranslation(-hx, -hy, 0))
  return m
}

/** With a roll, the first half of the animation folds the flaps and the
 * second half curls the sheet; otherwise folding uses the whole range. */
export function splitProgress(form: FormConfig, progress: number): { fold: number; roll: number } {
  if (form.kind !== 'roll') return { fold: progress, roll: 0 }
  return { fold: Math.min(1, progress * 2), roll: Math.max(0, progress * 2 - 1) }
}

/** Writes the posed (folded + rolled) vertex positions into `out`. */
export function posePart(part: PreparedPart, progress: number, out: Float32Array): void {
  const { fold, roll } = splitProgress(part.form, progress)
  const v = new THREE.Vector3()
  const form = part.form
  const rolling = form.kind === 'roll' && roll > 0 && form.wrapDeg > 0
  const vertical = form.kind === 'roll' && form.axis === 'vertical'
  const span = part.uMax - part.uMin
  const theta = rolling ? (form.wrapDeg * Math.PI * roll) / 180 : 0
  const R = rolling ? span / theta : Infinity
  const uc = (part.uMin + part.uMax) / 2
  let o = 0
  for (const { panel, base } of part.panels) {
    const m = foldMatrix(panel, fold)
    for (let i = 0; i < base.length; i += 3) {
      v.set(base[i], base[i + 1], base[i + 2]).applyMatrix4(m)
      if (rolling) {
        const u = vertical ? v.x : v.y
        // Anything past the closing edge (seam tabs) tucks one plate
        // thickness inside the opposite edge instead of clashing with it.
        const z = u > part.uMax + 0.01 ? v.z - part.thickness : v.z
        const a = (u - uc) / R
        const r = R + z
        const nu = uc + r * Math.sin(a)
        const nz = r * Math.cos(a) - R
        if (vertical) v.set(nu, v.y, nz)
        else v.set(v.x, nu, nz)
      }
      out[o++] = v.x
      out[o++] = v.y
      out[o++] = v.z
    }
  }
}

/** A posed part as one BufferGeometry (fresh — caller disposes). */
export function posedGeometry(part: PreparedPart, progress: number): THREE.BufferGeometry {
  const pos = new Float32Array(part.vertexCount * 3)
  posePart(part, progress, pos)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.computeVertexNormals()
  g.computeBoundingBox()
  return g
}

// ─── Assembly ───────────────────────────────────────────────────────────────

const D = THREE.MathUtils.degToRad

/** World matrices (y-up, mm) for every copy of a part. `box` is the posed
 * part's local bounding box — copies pivot on its bottom-centre edge when
 * standing, and its centre when stacked flat. */
export function arrayMatrices(array: AssemblyArray, box: THREE.Box3): THREE.Matrix4[] {
  const size = box.getSize(new THREE.Vector3())
  const c = box.getCenter(new THREE.Vector3())
  const standPivot = new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z)
  const centrePivot = new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z)
  const out: THREE.Matrix4[] = []
  const mul = (...ms: THREE.Matrix4[]) => ms.reduce((a, b) => a.multiply(b), new THREE.Matrix4())

  switch (array.kind) {
    case 'single': {
      const r = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(D(array.rx), D(array.ry), D(array.rz), 'XYZ'))
      out.push(mul(new THREE.Matrix4().makeTranslation(array.x, array.y, array.z), r, standPivot))
      break
    }
    case 'ring': {
      const n = Math.max(1, Math.round(array.count))
      const radius = array.joinEdges && n > 2 ? size.x / (2 * Math.tan(Math.PI / n)) : array.radius
      for (let i = 0; i < n; i++) {
        const mirror = array.alternateMirror && i % 2 === 1 ? new THREE.Matrix4().makeScale(-1, 1, 1) : new THREE.Matrix4()
        out.push(
          mul(
            new THREE.Matrix4().makeRotationY((i / n) * Math.PI * 2),
            new THREE.Matrix4().makeTranslation(0, array.height, radius),
            new THREE.Matrix4().makeRotationX(D(array.tiltDeg)),
            new THREE.Matrix4().makeRotationZ(D(array.spinDeg)),
            mirror,
            standPivot,
          ),
        )
      }
      break
    }
    case 'grid': {
      const rows = Math.max(1, Math.round(array.rows))
      const cols = Math.max(1, Math.round(array.cols))
      const sx = array.joinEdges ? size.x : array.spacingX
      const sy = array.joinEdges ? size.y : array.spacingY
      for (let r = 0; r < rows; r++) {
        for (let k = 0; k < cols; k++) {
          const shift = array.stagger && r % 2 === 1 ? sx / 2 : 0
          const flip = array.alternateFlip && (r + k) % 2 === 1 ? new THREE.Matrix4().makeRotationZ(Math.PI) : new THREE.Matrix4()
          out.push(
            mul(
              new THREE.Matrix4().makeTranslation((k - (cols - 1) / 2) * sx + shift, r * sy + size.y / 2, 0),
              flip,
              centrePivot,
            ),
          )
        }
      }
      break
    }
    case 'stack': {
      const n = Math.max(1, Math.round(array.count))
      for (let i = 0; i < n; i++) {
        const s = Math.max(0.05, 1 + array.scaleStep * i)
        out.push(
          mul(
            new THREE.Matrix4().makeTranslation(0, i * array.spacing + size.z / 2, 0),
            new THREE.Matrix4().makeRotationY(D(array.twistDeg * i)),
            new THREE.Matrix4().makeRotationX(-Math.PI / 2),
            new THREE.Matrix4().makeScale(s, s, 1),
            centrePivot,
          ),
        )
      }
      break
    }
  }
  return out
}

export function instanceCount(array: AssemblyArray): number {
  switch (array.kind) {
    case 'single':
      return 1
    case 'ring':
      return Math.max(1, Math.round(array.count))
    case 'grid':
      return Math.max(1, Math.round(array.rows)) * Math.max(1, Math.round(array.cols))
    case 'stack':
      return Math.max(1, Math.round(array.count))
  }
}
