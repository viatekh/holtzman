// The ONLY file importing clipper2-ts — swapping boolean engines later means
// touching only this file.
import { inflatePathsD, intersectD, unionD, differenceD, FillRule, JoinType, EndType, type PathD } from 'clipper2-ts'
import type { Point, Polygon } from './types'

const PRECISION = 4
const ARC_TOLERANCE = 0.05

function toPath(poly: Polygon): PathD {
  return poly.map((p) => ({ x: p.x, y: p.y }))
}

function fromPaths(paths: PathD[]): Polygon[] {
  return paths.map((path) => path.map((p): Point => ({ x: p.x, y: p.y }))).filter((p) => p.length >= 3)
}

export function unionPolys(polys: Polygon[]): Polygon[] {
  if (polys.length === 0) return []
  return fromPaths(unionD(polys.map(toPath), FillRule.NonZero))
}

/** Result keeps clipper's orientation convention: outer rings positive
 * (CCW), holes negative — callers that need holes rely on that. */
export function differencePolys(subject: Polygon[], clip: Polygon[]): Polygon[] {
  if (subject.length === 0) return []
  if (clip.length === 0) return subject
  return fromPaths(differenceD(subject.map(toPath), clip.map(toPath), FillRule.NonZero, PRECISION))
}

/** Grows (positive delta) or shrinks (negative) polygons with round joins. */
export function offsetPolys(polys: Polygon[], delta: number): Polygon[] {
  if (delta === 0 || polys.length === 0) return polys
  return fromPaths(
    inflatePathsD(polys.map(toPath), delta, JoinType.Round, EndType.Polygon, 2, PRECISION, ARC_TOLERANCE),
  )
}

export function intersectPolys(subject: Polygon[], clip: Polygon[]): Polygon[] {
  if (subject.length === 0 || clip.length === 0) return []
  return fromPaths(intersectD(subject.map(toPath), clip.map(toPath), FillRule.NonZero, PRECISION))
}
