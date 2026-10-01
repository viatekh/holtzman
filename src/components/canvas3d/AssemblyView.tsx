import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useDesignStore } from '../../store/designStore'
import { arrayMatrices, posedGeometry, preparePart } from '../../lib/three/partGeometry'
import type { BuildResult, Part } from '../../lib/geometry/types'
import { Grounded, Stage } from './Stage'
import { MM, useMetalMaterial } from './materials'

const geometryCache = new WeakMap<BuildResult, Map<string, THREE.BufferGeometry>>()

function partGeometry(part: Part, result: BuildResult): THREE.BufferGeometry {
  let byForm = geometryCache.get(result)
  if (!byForm) {
    byForm = new Map()
    geometryCache.set(result, byForm)
  }
  const key = `${part.sheet.thickness}|${JSON.stringify(part.form)}`
  let g = byForm.get(key)
  if (!g) {
    g = posedGeometry(preparePart(result, part.sheet.thickness, part.form), 1)
    byForm.set(key, g)
  }
  return g
}

function PartCopies({ part, result, highlight }: { part: Part; result: BuildResult; highlight: boolean }) {
  const base = useMetalMaterial(part.sheet.material)
  const material = useMemo(() => {
    if (!highlight) return base
    const m = base.clone()
    m.emissive = new THREE.Color('#7c3aed')
    m.emissiveIntensity = 0.035
    return m
  }, [base, highlight])
  useEffect(() => () => {
    if (material !== base) material.dispose()
  }, [material, base])
  const geometry = useMemo(() => partGeometry(part, result), [part, result])
  const matrices = useMemo(() => arrayMatrices(part.array, geometry.boundingBox ?? new THREE.Box3()), [part.array, geometry])
  return (
    <>
      {matrices.map((m, i) => (
        <mesh key={i} geometry={geometry} material={material} matrixAutoUpdate={false} matrix={m} castShadow receiveShadow />
      ))}
    </>
  )
}

export function AssemblyView({ results }: { results: Map<string, BuildResult> }) {
  const project = useDesignStore((s) => s.project)
  const activeId = useDesignStore((s) => s.activePartId)

  // Rough overall size for camera framing.
  const span = useMemo(() => {
    const box = new THREE.Box3()
    for (const p of project.parts) {
      const r = results.get(p.id)
      if (!r) continue
      const g = partGeometry(p, r)
      for (const m of arrayMatrices(p.array, g.boundingBox ?? new THREE.Box3())) box.union(g.boundingBox!.clone().applyMatrix4(m))
    }
    if (box.isEmpty()) return 1
    const s = box.getSize(new THREE.Vector3())
    return { w: Math.max(s.x, s.z) * MM, h: s.y * MM }
  }, [project.parts, results])
  const size = typeof span === 'number' ? { w: span, h: span } : span

  return (
    <div className="relative h-full w-full bg-gradient-to-b from-neutral-900 to-neutral-950">
      <Stage span={Math.max(size.w, size.h)} targetY={size.h * 0.45}>
        <Grounded>
          <group scale={MM}>
            {project.parts.map((p) => {
              const r = results.get(p.id)
              return r ? <PartCopies key={p.id} part={p} result={r} highlight={p.id === activeId && project.parts.length > 1} /> : null
            })}
          </group>
        </Grounded>
      </Stage>
      <div className="pointer-events-none absolute bottom-3 left-3 text-[11px] text-neutral-500">
        Assembled sculpture · {project.parts.length} part{project.parts.length > 1 ? 's' : ''} · the selected part glows
      </div>
    </div>
  )
}
