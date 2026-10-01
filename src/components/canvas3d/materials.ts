import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { MaterialKind } from '../../lib/geometry/types'

export const MM = 0.001

const MATERIAL_LOOK: Record<MaterialKind, { color: string; metalness: number; roughness: number }> = {
  corten: { color: '#7a3f22', metalness: 0.35, roughness: 0.85 },
  'mild-steel': { color: '#5d636b', metalness: 0.75, roughness: 0.5 },
  stainless: { color: '#c3c8ce', metalness: 0.9, roughness: 0.28 },
  aluminium: { color: '#cfd3d8', metalness: 0.8, roughness: 0.4 },
  brass: { color: '#b39245', metalness: 0.9, roughness: 0.32 },
  copper: { color: '#b46a43', metalness: 0.9, roughness: 0.35 },
}

export function useMetalMaterial(material: MaterialKind): THREE.MeshStandardMaterial {
  const look = MATERIAL_LOOK[material]
  const m = useMemo(
    () => new THREE.MeshStandardMaterial({ color: look.color, metalness: look.metalness, roughness: look.roughness, side: THREE.DoubleSide }),
    [look],
  )
  useEffect(() => () => m.dispose(), [m])
  return m
}
