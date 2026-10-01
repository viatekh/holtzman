import { useDeferredValue, useMemo } from 'react'
import { buildDesign } from '../lib/geometry/build'
import type { BuildResult, Part, Project } from '../lib/geometry/types'

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

/** Every part's build, deferred so slider drags stay responsive. */
export function useProjectBuilds(project: Project): { results: Map<string, BuildResult>; stale: boolean } {
  const deferred = useDeferredValue(project)
  const results = useMemo(() => new Map(deferred.parts.map((p) => [p.id, buildPart(p)])), [deferred])
  return { results, stale: deferred !== project }
}
