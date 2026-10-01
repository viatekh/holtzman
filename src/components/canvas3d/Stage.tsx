import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

/** Centres its children on the origin and sits them on the ground plane,
 * re-measured after every render (child layout effects run first, so any
 * geometry they just re-posed is already in place). */
export function Grounded({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    const g = ref.current
    if (!g) return
    g.position.set(0, 0, 0)
    g.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(g)
    if (box.isEmpty()) return
    const c = box.getCenter(new THREE.Vector3())
    g.position.set(-c.x, -box.min.y, -c.z)
  })
  return <group ref={ref}>{children}</group>
}

/** Re-frames the camera when the piece's size changes a lot (loading a
 * preset, switching views) but leaves the user's orbit alone otherwise. */
function CameraRig({ span, targetY }: { span: number; targetY: number }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  const last = useRef<{ span: number; targetY: number } | null>(null)
  useEffect(() => {
    const prev = last.current
    if (prev && controls) {
      const ratio = span / prev.span
      if (ratio > 0.8 && ratio < 1.25 && Math.abs(targetY - prev.targetY) < span * 0.2) return
    }
    if (!controls) return
    last.current = { span, targetY }
    camera.position.set(span * 1.2, targetY + span * 0.9, span * 1.5)
    controls.target.set(0, targetY, 0)
    controls.update()
  }, [span, targetY, camera, controls])
  return null
}

/** Shared lit studio for the folded-part and assembly views. `span` and
 * `targetY` are in metres. */
export function Stage({ span, targetY, children }: { span: number; targetY: number; children: ReactNode }) {
  const s = Math.max(span, 0.1)
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [s * 1.2, targetY + s * 0.9, s * 1.5], fov: 40, near: 0.005, far: 200 }}>
      <hemisphereLight args={['#dfe6ff', '#1a1410', 0.5]} />
      <directionalLight position={[s * 2, s * 3, s * 1.5]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}>
        <orthographicCamera attach="shadow-camera" args={[-s * 1.5, s * 1.5, s * 1.5, -s * 1.5, 0.01, s * 10]} />
      </directionalLight>
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2} position={[0, 4, 2]} scale={[8, 2, 1]} />
        <Lightformer form="rect" intensity={1} position={[-4, 1, -2]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="ring" intensity={1.5} color="#ffd9b3" position={[4, 2, 3]} scale={2} />
      </Environment>
      {children}
      <ContactShadows position={[0, 0, 0]} scale={s * 3} blur={2.2} opacity={0.6} far={s} />
      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.02} />
      <CameraRig span={s} targetY={targetY} />
    </Canvas>
  )
}
