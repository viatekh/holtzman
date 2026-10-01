import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { Pause, Play } from 'lucide-react'
import { useActivePart, useDesignStore } from '../../store/designStore'
import { posePart, preparePart } from '../../lib/three/partGeometry'
import { rollRadius } from '../../lib/geometry/build'
import type { BuildResult } from '../../lib/geometry/types'
import { SegmentedControl } from '../shared/SegmentedControl'
import { Grounded, Stage } from './Stage'
import { MM, useMetalMaterial } from './materials'

function Sculpture({ result }: { result: BuildResult }) {
  const part = useActivePart()
  const progress = useDesignStore((s) => s.foldProgress)
  const orientation = useDesignStore((s) => s.orientation)
  const material = useMetalMaterial(part.sheet.material)

  const prepared = useMemo(() => preparePart(result, part.sheet.thickness, part.form), [result, part.sheet.thickness, part.form])
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(prepared.vertexCount * 3), 3))
    return g
  }, [prepared])
  useEffect(() => () => geometry.dispose(), [geometry])

  useLayoutEffect(() => {
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute
    posePart(prepared, progress, attr.array as Float32Array)
    attr.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
  }, [geometry, prepared, progress])

  return (
    <group scale={MM} rotation={orientation === 'flat' ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
    </group>
  )
}

export function FoldView({ result }: { result: BuildResult }) {
  const part = useActivePart()
  const progress = useDesignStore((s) => s.foldProgress)
  const setProgress = useDesignStore((s) => s.setFoldProgress)
  const orientation = useDesignStore((s) => s.orientation)
  const setOrientation = useDesignStore((s) => s.setOrientation)
  const [playing, setPlaying] = useState(false)
  const span = Math.max(result.stats.widthMm, result.stats.heightMm) * MM
  const rolled = rollRadius(result.baseOutline, part.form) != null

  useEffect(() => {
    if (!playing) return
    let raf = 0
    const start = performance.now()
    const from = useDesignStore.getState().foldProgress >= 0.999 ? 0 : useDesignStore.getState().foldProgress
    const duration = rolled ? 4000 : 2500
    const tick = (now: number) => {
      const p = Math.min(1, from + (now - start) / duration)
      setProgress(p)
      if (p < 1) raf = requestAnimationFrame(tick)
      else setPlaying(false)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, setProgress, rolled])

  return (
    <div className="relative h-full w-full bg-gradient-to-b from-neutral-900 to-neutral-950">
      <Stage span={span} targetY={orientation === 'standing' ? span * 0.5 : span * 0.15}>
        <Grounded>
          <Sculpture result={result} />
        </Grounded>
      </Stage>

      <div className="absolute right-3 bottom-3 left-3 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/85 px-3 py-2 backdrop-blur">
        <button type="button" onClick={() => setPlaying(!playing)} className="rounded-md bg-purple-500 p-1.5 text-white hover:bg-purple-400" title={playing ? 'Pause' : 'Play fold'}>
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <label className="flex min-w-40 flex-1 items-center gap-2 text-xs text-neutral-400">
          Flat
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            onChange={(e) => {
              setPlaying(false)
              setProgress(Number(e.target.value))
            }}
            className="min-w-0 flex-1 accent-purple-500"
          />
          {rolled ? 'Folded + rolled' : 'Folded'}
        </label>
        <div className="w-44">
          <SegmentedControl
            value={orientation}
            options={[
              { value: 'flat', label: 'Lay flat' },
              { value: 'standing', label: 'Stand up' },
            ]}
            onChange={setOrientation}
          />
        </div>
      </div>
    </div>
  )
}
