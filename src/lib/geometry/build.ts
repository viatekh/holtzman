import { differencePolys, unionPolys } from './clipper'
import { foldAngleFor, placeSites } from './placement'
import {
  area,
  bounds,
  boundsOfPolygons,
  boundsOverlap,
  circlePolygon,
  distance,
  decimate,
  ensureCCW,
  insetClearance,
  pointInPolygon,
  polygonGap,
  polylineLength,
  signedArea,
  transformPoints,
} from './polygon'
import { buildCutoutLocal, buildFlapLocal, buildOutline } from './shapes'
import type {
  Bounds,
  BuildResult,
  CutoutGroup,
  CutPath,
  Design,
  FlapGroup,
  HingeConfig,
  Issue,
  MaterialKind,
  Point,
  Polygon,
  ResolvedCutout,
  ResolvedFlap,
} from './types'

export const MATERIAL_DENSITY: Record<MaterialKind, number> = {
  'mild-steel': 7.85,
  corten: 7.85,
  stainless: 8.0,
  aluminium: 2.7,
  brass: 8.5,
  copper: 8.96,
}

interface Candidate {
  id: string
  kind: 'flap' | 'cutout'
  polygon: Polygon
  /** Coarser copy used only for spacing checks. */
  check: Polygon
  bounds: Bounds
  attach?: 'inset' | 'edge'
}

function resolveFlaps(group: FlapGroup, base: Polygon, design: Design): ResolvedFlap[] {
  const out: ResolvedFlap[] = []
  const { minBridge, hinge } = design.sheet
  const reliefR = hinge.reliefHoles ? hinge.reliefDiameter / 2 : 0
  for (const site of placeSites(group.placement, base)) {
    const shape = { ...group.shape, width: group.shape.width * site.scale, length: group.shape.length * site.scale }
    const local = buildFlapLocal(shape)
    let cx = site.x
    let cy = site.y
    const sx = Math.cos(site.angle)
    const sy = Math.sin(site.angle)

    if (site.outward && group.attach === 'inset') {
      // Edge placement of an interior flap: pull it inside the sheet so its
      // nearest point keeps a full bridge (plus relief) of metal to the edge.
      const pullIn = minBridge + reliefR + 1
      const pointingIn = sx * site.outward.x + sy * site.outward.y < 0
      const depth = pointingIn ? pullIn : pullIn + shape.length
      cx -= site.outward.x * depth
      cy -= site.outward.y * depth
    }

    const rot = site.angle - Math.PI / 2
    let pts = transformPoints(local, cx, cy, rot)
    let hingeA = pts[0]
    let hingeB = pts[pts.length - 1]

    if (group.attach === 'edge') {
      // Slide back along the spine until both hinge ends sit inside the
      // sheet, so the flap is properly joined (matters on curved edges).
      let guard = 0
      const step = 0.5
      while ((!pointInPolygon(hingeA, base) || !pointInPolygon(hingeB, base)) && guard < 400) {
        cx -= sx * step
        cy -= sy * step
        pts = transformPoints(local, cx, cy, rot)
        hingeA = pts[0]
        hingeB = pts[pts.length - 1]
        guard++
      }
    }

    out.push({
      id: `${group.id}:${site.index}`,
      groupId: group.id,
      index: site.index,
      attach: group.attach,
      polygon: pts,
      cutPath: pts,
      hingeA,
      hingeB,
      fold: foldAngleFor(group.fold, site),
      spine: { x: sx, y: sy },
    })
  }
  return out
}

function resolveCutouts(group: CutoutGroup, base: Polygon, design: Design): ResolvedCutout[] {
  const local = buildCutoutLocal(group.shape)
  const extra = (group.rotation * Math.PI) / 180
  return placeSites(group.placement, base).map((site) => {
    let x = site.x
    let y = site.y
    if (site.outward) {
      const pull = design.sheet.minBridge + 1 + (bounds(local).maxY - bounds(local).minY) / 2
      x -= site.outward.x * pull
      y -= site.outward.y * pull
    }
    return {
      id: `${group.id}:${site.index}`,
      groupId: group.id,
      index: site.index,
      polygon: transformPoints(local, x, y, site.angle - Math.PI / 2 + extra, site.scale),
    }
  })
}

/** Evenly spaced cut segments along a hinge, leaving solid bridges between
 * them and at both ends. */
export function perforationSegments(a: Point, b: Point, hinge: HingeConfig): [Point, Point][] {
  const len = distance(a, b)
  const slot = Math.max(0.5, hinge.slotLength)
  const bridge = Math.max(0.5, hinge.bridgeLength)
  const n = Math.floor((len - bridge) / (slot + bridge))
  if (n < 1) return []
  const endBridge = (len - n * slot - (n - 1) * bridge) / 2
  const ux = (b.x - a.x) / len
  const uy = (b.y - a.y) / len
  const segs: [Point, Point][] = []
  for (let i = 0; i < n; i++) {
    const s = endBridge + i * (slot + bridge)
    segs.push([
      { x: a.x + ux * s, y: a.y + uy * s },
      { x: a.x + ux * (s + slot), y: a.y + uy * (s + slot) },
    ])
  }
  return segs
}

export function buildDesign(design: Design): BuildResult {
  const { sheet } = design
  const base = ensureCCW(buildOutline(sheet.outline))
  const baseCheck = decimate(base, 120)
  const issues: Issue[] = []
  const invalidIds = new Set<string>()
  const reliefR = sheet.hinge.reliefHoles ? sheet.hinge.reliefDiameter / 2 : 0

  const accepted: Candidate[] = []
  const flaps: ResolvedFlap[] = []
  const cutouts: ResolvedCutout[] = []
  let outsideCount = 0
  let overlapCount = 0
  let prunedCount = 0
  const outsideIds: string[] = []
  const overlapIds: string[] = []
  const notEdgeIds: string[] = []
  const flapById = new Map<string, ResolvedFlap>()
  const cutoutById = new Map<string, ResolvedCutout>()

  const tooClose = (cand: Candidate): boolean => {
    for (const other of accepted) {
      if (!boundsOverlap(cand.bounds, other.bounds, sheet.minBridge)) continue
      // Edge flaps may share their hinge zone with the base, but never with
      // each other or with interior features.
      if (polygonGap(cand.check, other.check, sheet.minBridge) < sheet.minBridge) return true
    }
    return false
  }

  for (const group of design.groups) {
    if (!group.visible) continue
    const items: Candidate[] =
      group.type === 'flap'
        ? resolveFlaps(group, base, design).map((f) => {
            flapById.set(f.id, f)
            return { id: f.id, kind: 'flap', polygon: f.polygon, check: decimate(f.polygon, 40), bounds: bounds(f.polygon), attach: f.attach }
          })
        : resolveCutouts(group, base, design).map((c) => {
            cutoutById.set(c.id, c)
            return { id: c.id, kind: 'cutout', polygon: c.polygon, check: decimate(c.polygon, 40), bounds: bounds(c.polygon) }
          })

    for (const cand of items) {
      let outside = false
      if (cand.attach === 'edge') {
        const f = flapById.get(cand.id)!
        const tipInside = cand.polygon.every((p) => pointInPolygon(p, base))
        if (tipInside) {
          notEdgeIds.push(cand.id)
          outside = true
        } else if (distance(f.hingeA, f.hingeB) < 1) outside = true
      } else {
        const need = sheet.minBridge + (cand.kind === 'flap' ? reliefR * 0.5 : 0)
        outside = insetClearance(cand.check, baseCheck, need) < need
      }
      const overlap = !outside && tooClose(cand)
      const bad = outside || overlap
      if (bad && group.autoPrune) {
        prunedCount++
        continue
      }
      if (outside) {
        outsideCount++
        outsideIds.push(cand.id)
      }
      if (overlap) {
        overlapCount++
        overlapIds.push(cand.id)
      }
      if (bad) invalidIds.add(cand.id)
      accepted.push(cand)
      if (cand.kind === 'flap') flaps.push(flapById.get(cand.id)!)
      else cutouts.push(cutoutById.get(cand.id)!)
    }
  }

  // ── Outline: base ∪ edge flaps − edge-hinge reliefs ──
  const edgeFlaps = flaps.filter((f) => f.attach === 'edge' && !invalidIds.has(f.id))
  const insetFlaps = flaps.filter((f) => f.attach === 'inset')
  const reliefFor = (f: ResolvedFlap) => [circlePolygon(f.hingeA.x, f.hingeA.y, reliefR, 20), circlePolygon(f.hingeB.x, f.hingeB.y, reliefR, 20)]
  let outline: Polygon[] = edgeFlaps.length > 0 ? unionPolys([base, ...edgeFlaps.map((f) => f.polygon)]) : [base]
  const edgeReliefs = reliefR > 0 ? edgeFlaps.flatMap(reliefFor) : []
  if (edgeReliefs.length > 0) outline = differencePolys(outline, edgeReliefs)
  const insetReliefs = reliefR > 0 ? insetFlaps.flatMap(reliefFor) : []

  // ── Cut paths ──
  const paths: CutPath[] = []
  for (const c of cutouts) paths.push({ layer: 'cut', points: c.polygon, closed: true })
  for (const r of insetReliefs) paths.push({ layer: 'cut', points: r, closed: true })
  for (const f of insetFlaps) paths.push({ layer: 'cut', points: f.cutPath, closed: false })
  for (const f of flaps) {
    if (sheet.hinge.style === 'perforated') {
      for (const [a, b] of perforationSegments(f.hingeA, f.hingeB, sheet.hinge)) {
        paths.push({ layer: 'cut', points: [a, b], closed: false })
      }
    }
    paths.push({ layer: 'bend', points: [f.hingeA, f.hingeB], closed: false })
  }
  for (const ring of outline) paths.push({ layer: 'cut', points: ring, closed: true })

  // ── Stats ──
  const b = boundsOfPolygons(outline)
  const widthMm = b.maxX - b.minX
  const heightMm = b.maxY - b.minY
  const outlineArea = outline.reduce((s, r) => s + signedArea(r), 0)
  const dropArea = cutouts.reduce((s, c) => s + area(c.polygon), 0) + insetReliefs.reduce((s, r) => s + area(r), 0)
  const cutPaths = paths.filter((p) => p.layer === 'cut')
  const stats = {
    widthMm,
    heightMm,
    fitsBed: widthMm <= sheet.bed.width && heightMm <= sheet.bed.height,
    fitsBedRotated: heightMm <= sheet.bed.width && widthMm <= sheet.bed.height,
    cutLengthMm: cutPaths.reduce((s, p) => s + polylineLength(p.points, p.closed), 0),
    pierces: cutPaths.length,
    flaps: flaps.length,
    cutouts: cutouts.length,
    weightKg: (Math.max(0, outlineArea - dropArea) * sheet.thickness * MATERIAL_DENSITY[sheet.material]) / 1e6,
    outlineAreaMm2: outlineArea,
    dropAreaMm2: dropArea,
  }

  // ── Issues ──
  if (!stats.fitsBed && !stats.fitsBedRotated) {
    issues.push({
      severity: 'error',
      code: 'bed',
      message: `Part is ${Math.round(widthMm)} × ${Math.round(heightMm)} mm — larger than the ${sheet.bed.width} × ${sheet.bed.height} mm bed.`,
    })
  } else if (!stats.fitsBed) {
    issues.push({ severity: 'info', code: 'bed-rotate', message: 'Fits the bed only when rotated 90°.' })
  }
  if (outsideCount > 0)
    issues.push({
      severity: 'error',
      code: 'outside',
      message: `${outsideCount} feature${outsideCount > 1 ? 's' : ''} closer than ${sheet.minBridge} mm to the sheet edge.`,
      featureIds: outsideIds,
    })
  if (notEdgeIds.length > 0)
    issues.push({
      severity: 'warning',
      code: 'edge-flap-inside',
      message: `${notEdgeIds.length} edge flap${notEdgeIds.length > 1 ? 's don’t' : ' doesn’t'} reach past the sheet edge.`,
      featureIds: notEdgeIds,
    })
  if (overlapCount > 0)
    issues.push({
      severity: 'error',
      code: 'overlap',
      message: `${overlapCount} feature${overlapCount > 1 ? 's' : ''} overlap or leave less than ${sheet.minBridge} mm bridge to a neighbour.`,
      featureIds: overlapIds,
    })
  if (prunedCount > 0)
    issues.push({ severity: 'info', code: 'pruned', message: `${prunedCount} generated feature${prunedCount > 1 ? 's' : ''} dropped (auto-prune).` })

  const minHole = Math.max(3, sheet.thickness)
  const tinyCutouts = cutouts.filter((c) => 2 * Math.sqrt(area(c.polygon) / Math.PI) < minHole)
  if (tinyCutouts.length > 0)
    issues.push({
      severity: 'warning',
      code: 'small-hole',
      message: `${tinyCutouts.length} cutout${tinyCutouts.length > 1 ? 's are' : ' is'} smaller than ~${minHole} mm — plasma holes under plate thickness come out ragged.`,
      featureIds: tinyCutouts.map((c) => c.id),
    })
  if (reliefR > 0 && sheet.hinge.reliefDiameter < sheet.thickness)
    issues.push({ severity: 'warning', code: 'relief-small', message: 'Relief holes smaller than plate thickness may not cut cleanly.' })
  const narrow = flaps.filter((f) => distance(f.hingeA, f.hingeB) < sheet.thickness * 4)
  if (narrow.length > 0)
    issues.push({
      severity: 'warning',
      code: 'narrow-hinge',
      message: `${narrow.length} flap hinge${narrow.length > 1 ? 's are' : ' is'} under 4× plate thickness — likely to twist or snap when bent.`,
      featureIds: narrow.map((f) => f.id),
    })
  if (sheet.hinge.style === 'solid' && sheet.thickness >= 3) {
    const long = flaps.filter((f) => distance(f.hingeA, f.hingeB) > 120)
    if (long.length > 0)
      issues.push({
        severity: 'info',
        code: 'stiff-hinge',
        message: `${long.length} long solid hinge${long.length > 1 ? 's' : ''} in ${sheet.thickness} mm plate — consider perforated hinges for hand folding.`,
      })
  }
  if (sheet.minBridge < sheet.kerf * 2)
    issues.push({ severity: 'warning', code: 'bridge-kerf', message: 'Minimum bridge is less than 2× kerf — thin webs will burn through.' })

  return { baseOutline: base, outline, flaps, cutouts, reliefs: [...insetReliefs, ...edgeReliefs], paths, bounds: b, stats, issues, invalidIds }
}
