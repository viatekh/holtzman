import { differencePolys } from './clipper'
import { area, pointInPolygon, signedArea } from './polygon'
import type { BuildResult, Point, Polygon } from './types'

export interface ShapeWithHoles {
  outer: Polygon
  holes: Polygon[]
}

export interface FoldPanel {
  id: string
  shapes: ShapeWithHoles[]
  /** Hinge axis in sheet coordinates; absent for the base panel. */
  hingeA?: Point
  hingeB?: Point
  /** Signed degrees, + = toward +z. */
  fold: number
}

/** Groups a flat list of clipper rings (outers positive, holes negative)
 * into outer+holes shapes — the form three.js Shape/ExtrudeGeometry needs. */
export function nestRings(rings: Polygon[]): ShapeWithHoles[] {
  const outers = rings.filter((r) => signedArea(r) > 0).map((outer) => ({ outer, holes: [] as Polygon[], a: area(outer) }))
  outers.sort((a, b) => a.a - b.a)
  for (const hole of rings.filter((r) => signedArea(r) < 0)) {
    const host = outers.find((o) => pointInPolygon(hole[0], o.outer))
    host?.holes.push(hole)
  }
  return outers.map(({ outer, holes }) => ({ outer, holes }))
}

/** Splits the flat cut part into rigid panels: the base sheet (with every
 * flap, cutout and relief removed) plus one panel per flap, each carrying
 * its hinge axis so the 3D view can rotate it into place. */
export function buildFoldPanels(result: BuildResult): FoldPanel[] {
  const holes = [...result.flaps.map((f) => f.polygon), ...result.cutouts.map((c) => c.polygon), ...result.reliefs, ...result.slots]
  const baseRings = differencePolys([result.baseOutline], holes)
  const panels: FoldPanel[] = [{ id: 'base', shapes: nestRings(baseRings), fold: 0 }]
  for (const f of result.flaps) {
    panels.push({ id: f.id, shapes: [{ outer: f.polygon, holes: [] }], hingeA: f.hingeA, hingeB: f.hingeB, fold: f.fold })
  }
  return panels
}
