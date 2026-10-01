import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Pause, Play } from 'lucide-react'
import { useDesignStore } from '../../store/designStore'
import { buildFoldPanels, type FoldPanel } from '../../lib/geometry/fold'
import type { BuildResult, MaterialKind, Polygon } from '../../lib/geometry/types'
import { SegmentedControl } from '../shared/SegmentedControl'

const MM = 0.001

const MATERIAL_LOOK: Record<MaterialKind, { color: string; metalness: number; roughness: number }> = {
  corten: { color: '#7a3f22', metalness: 0.35, roughness: 0.85 },
  'mild-steel': { color: '#5d636b', metalness: 0.75, roughness: 0.5 },
  stainless: { color: '#c3c8ce', metalness: 0.9, roughness: 0.28 },
  aluminium: { color: '#cfd3d8', metalness: 0.8, roughness: 0.4 },
  brass: { color: '#b39245', metalness: 0.9, roughness: 0.32 },
  copper: { color: '#b46a43', metalness: 0.9, roughness: 0.35 },
}

function toShape(outer: Polygon, holes: Polygon[]): THREE.Shape {
  const shape = new THREE.Shape(outer.map((p) => new THREE.Vector2(p.x, p.y)))
  for (const h of holes) shape.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p.x, p.y))))
  return shape
}

function panelGeometry(panel: FoldPanel, thickness: number): THREE.BufferGeometry {
  const shapes = panel.shapes.map((s) => toShape(s.outer, s.holes))
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: thickness, bevelEnabled: false, curveSegments: 1 })
  geo.translate(0, 0, -thickness / 2)
  geo.computeVertexNormals()
  return geo
}

/** Rotation about the hinge line by the panel's fold × progress. The axis is
 * spine × ẑ, so a positive angle always lifts the tip toward +z. */
function foldMatrix(panel: FoldPanel, progress: number): THREE.Matrix4 {
  const m = new THREE.Matrix4()
  if (!panel.hingeA || !panel.hingeB || panel.fold === 0) return m
  const hx = (panel.hingeA.x + panel.hingeB.x) / 2
  const hy = (panel.hingeA.y + panel.hingeB.y) / 2
  // Spine is perpendicular to the hinge; hinge runs A→B with the flap on the
  // left (A is the right-hand end), so spine = hinge direction rotated −90°.
  const dx = panel.hingeB.x - panel.hingeA.x
  const dy = panel.hingeB.y - panel.hingeA.y
  const len = Math.hypot(dx, dy) || 1
  const spine = new THREE.Vector3(dy / len, -dx / len, 0)
  const axis = new THREE.Vector3().crossVectors(spine, new THREE.Vector3(0, 0, 1)).normalize()
  const angle = THREE.MathUtils.degToRad(panel.fold * progress)
  m.makeTranslation(hx, hy, 0)
  m.multiply(new THREE.Matrix4().makeRotationAxis(axis, angle))
  m.multiply(new THREE.Matrix4().makeTranslation(-hx, -hy, 0))
  return m
}

function Sculpture({ result }: { result: BuildResult }) {
  const sheet = useDesignStore((s) => s.design.sheet)
  const progress = useDesignStore((s) => s.foldProgress)
  const orientation = useDesignStore((s) => s.orientation)
  const outerRef = useRef<THREE.Group>(null)
  const innerRef = useRef<THREE.Group>(null)

  const panels = useMemo(() => buildFoldPanels(result), [result])
  const geometries = useMemo(() => panels.map((p) => panelGeometry(p, sheet.thickness)), [panels, sheet.thickness])
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries])

  const look = MATERIAL_LOOK[sheet.material]
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: look.color, metalness: look.metalness, roughness: look.roughness, side: THREE.DoubleSide }),
    [look],
  )
  useEffect(() => () => material.dispose(), [material])

  // Sit the piece on the ground and centre it, whatever its folds do.
  useLayoutEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    inner.position.set(0, 0, 0)
    inner.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(inner)
    const c = box.getCenter(new THREE.Vector3())
    inner.position.set(-c.x, -box.min.y, -c.z)
  })

  return (
    <group ref={outerRef}>
      <group ref={innerRef}>
        <group scale={MM} rotation={orientation === 'flat' ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
          {panels.map((panel, i) => (
            <mesh
              key={panel.id}
              geometry={geometries[i]}
              material={material}
              matrixAutoUpdate={false}
              matrix={foldMatrix(panel, progress)}
              castShadow
              receiveShadow
            />
          ))}
        </group>
      </group>
    </group>
  )
}

/** Re-frames the camera when the piece's size changes a lot (e.g. loading a
 * preset), but leaves the user's orbit alone for ordinary edits. */
function CameraRig({ span, standing }: { span: number; standing: boolean }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  const last = useRef({ span, standing })
  useEffect(() => {
    const ratio = span / last.current.span
    if (ratio > 0.8 && ratio < 1.25 && standing === last.current.standing) return
    last.current = { span, standing }
    const ty = standing ? span * 0.5 : span * 0.15
    camera.position.set(span * 1.3, ty + span, span * 1.6)
    controls?.target.set(0, ty, 0)
    controls?.update()
  }, [span, standing, camera, controls])
  return null
}

export function FoldView({ result }: { result: BuildResult }) {
  const progress = useDesignStore((s) => s.foldProgress)
  const setProgress = useDesignStore((s) => s.setFoldProgress)
  const orientation = useDesignStore((s) => s.orientation)
  const setOrientation = useDesignStore((s) => s.setOrientation)
  const [playing, setPlaying] = useState(false)
  const span = Math.max(result.stats.widthMm, result.stats.heightMm) * MM

  useEffect(() => {
    if (!playing) return
    let raf = 0
    const start = performance.now()
    const from = useDesignStore.getState().foldProgress >= 0.999 ? 0 : useDesignStore.getState().foldProgress
    const tick = (now: number) => {
      const p = Math.min(1, from + (now - start) / 2500)
      setProgress(p)
      if (p < 1) raf = requestAnimationFrame(tick)
      else setPlaying(false)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, setProgress])

  return (
    <div className="relative h-full w-full bg-gradient-to-b from-neutral-900 to-neutral-950">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [span * 1.3, span * 1.15, span * 1.6], fov: 40, near: 0.005, far: 100 }}>
        <hemisphereLight args={['#dfe6ff', '#1a1410', 0.5]} />
        <directionalLight position={[span * 2, span * 3, span * 1.5]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}>
          <orthographicCamera attach="shadow-camera" args={[-span * 1.5, span * 1.5, span * 1.5, -span * 1.5, 0.01, span * 10]} />
        </directionalLight>
        <Environment resolution={256}>
          <Lightformer form="rect" intensity={2} position={[0, 4, 2]} scale={[8, 2, 1]} />
          <Lightformer form="rect" intensity={1} position={[-4, 1, -2]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} />
          <Lightformer form="ring" intensity={1.5} color="#ffd9b3" position={[4, 2, 3]} scale={2} />
        </Environment>
        <Sculpture result={result} />
        <CameraRig span={span} standing={orientation === 'standing'} />
        <ContactShadows position={[0, 0, 0]} scale={span * 3} blur={2.2} opacity={0.6} far={span} />
        <OrbitControls makeDefault target={[0, orientation === 'standing' ? span * 0.5 : span * 0.15, 0]} maxPolarAngle={Math.PI / 2 - 0.02} />
      </Canvas>

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
          Folded
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
