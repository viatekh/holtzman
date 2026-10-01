import { useDeferredValue, useMemo } from 'react'
import { buildDesign } from '../lib/geometry/build'
import { computeSlots, DEFAULT_JOINERY } from '../lib/three/joinery'
import type { BuildResult, Part, Polygon, Project } from '../lib/geometry/types'

// Parts are immutable store objects, so identity is a safe cache key —
// editing one part never rebuilds the others.
const cache = new WeakMap<Part, BuildResult>()

export function buildPart(part: Part): BuildResult {
  let r = cache.get(part)
  if (!r) {
    r = buildDesign(part)
    cache.set(part, r)
  }
  return r
}

const slottedCache = new WeakMap<Part, { key: string; result: BuildResult }>()

function buildSlotted(part: Part, slots: Polygon[]): BuildResult {
  const key = JSON.stringify(slots.map((s) => s.map((p) => [Math.round(p.x * 10), Math.round(p.y * 10)])))
  const hit = slottedCache.get(part)
  if (hit && hit.key === key) return hit.result
  const result = buildDesign({ ...part, slots })
  slottedCache.set(part, { key, result })
  return result
}

export interface ProjectBuilds {
  /** Final per-part builds, joinery slots included — what gets cut. */
  results: Map<string, BuildResult>
  /** Builds before slotting — fixes where copies sit in the assembly. */
  placement: Map<string, BuildResult>
  stale: boolean
}

/** Every part's build (two passes: place the parts, then cut slots where
 * they pass through each other), deferred so slider drags stay smooth. */
export function useProjectBuilds(project: Project): ProjectBuilds {
  const deferred = useDeferredValue(project)
  const { results, placement } = useMemo(() => {
    const placement = new Map(deferred.parts.map((p) => [p.id, buildPart(p)]))
    const slots = computeSlots(deferred.parts, placement, deferred.joinery ?? DEFAULT_JOINERY)
    const results = new Map(deferred.parts.map((p) => [p.id, slots.has(p.id) ? buildSlotted(p, slots.get(p.id)!) : placement.get(p.id)!]))
    return { results, placement }
  }, [deferred])
  return { results, placement, stale: deferred !== project }
}
