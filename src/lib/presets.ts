import { generateId } from './utils'
import type { AssemblyArray, CutoutGroup, FlapGroup, FlapShape, FormConfig, Part, Placement, SheetConfig } from './geometry/types'

export const BED_PRESETS = [
  { label: '4 × 4 ft (1220 × 1220)', width: 1220, height: 1220 },
  { label: '4 × 8 ft (1220 × 2440)', width: 1220, height: 2440 },
  { label: '5 × 10 ft (1525 × 3050)', width: 1525, height: 3050 },
  { label: '1250 × 2500', width: 1250, height: 2500 },
  { label: '1500 × 3000', width: 1500, height: 3000 },
  { label: '2 × 2 ft (610 × 610)', width: 610, height: 610 },
]

export function defaultSheet(): SheetConfig {
  return {
    outline: { kind: 'rect', width: 600, height: 600, cornerRadius: 20 },
    material: 'corten',
    thickness: 2,
    kerf: 1.5,
    minBridge: 4,
    bed: { width: 1220, height: 2440 },
    hinge: { style: 'solid', reliefHoles: true, reliefDiameter: 4, slotLength: 12, bridgeLength: 6 },
  }
}

export function defaultFlapShape(kind: FlapShape['kind'] = 'petal'): FlapShape {
  const base: Record<FlapShape['kind'], FlapShape> = {
    tab: { kind: 'tab', width: 60, length: 80, taper: 0.7, roundness: 0.15, curl: 0 },
    spike: { kind: 'spike', width: 50, length: 110, taper: 0.2, roundness: 0, curl: 0 },
    leaf: { kind: 'leaf', width: 30, length: 90, taper: 0.5, roundness: 0, curl: 0 },
    petal: { kind: 'petal', width: 50, length: 70, taper: 0.35, roundness: 0.5, curl: 0 },
    scale: { kind: 'scale', width: 60, length: 50, taper: 0.1, roundness: 0.9, curl: 0 },
    flame: { kind: 'flame', width: 34, length: 110, taper: 0.4, roundness: 0, curl: 35 },
  }
  return { ...base[kind] }
}

export function defaultPlacement(kind: Placement['kind']): Placement {
  switch (kind) {
    case 'single':
      return { kind: 'single', x: 0, y: 0, angle: 90 }
    case 'radial':
      return {
        kind: 'radial',
        rings: 2,
        perRing: 8,
        perRingGrowth: 4,
        innerRadius: 80,
        ringSpacing: 100,
        startAngle: 90,
        staggerRings: true,
        pointing: 'out',
        scaleInner: 0.9,
        scaleOuter: 1.1,
        cx: 0,
        cy: 0,
      }
    case 'grid':
      return { kind: 'grid', rows: 5, cols: 6, spacingX: 85, spacingY: 85, stagger: true, angle: 90, cx: 0, cy: 0 }
    case 'spiral':
      return {
        kind: 'spiral',
        count: 80,
        spacing: 28,
        startIndex: 4,
        divergence: 137.508,
        pointing: 'out',
        scaleInner: 0.5,
        scaleOuter: 1.1,
        cx: 0,
        cy: 0,
      }
    case 'edge':
      return { kind: 'edge', count: 8, phase: 0, pointing: 'out' }
    case 'line':
      return { kind: 'line', count: 6, x1: -200, y1: 0, x2: 200, y2: 0, angle: 90, scaleStart: 1, scaleEnd: 1 }
  }
}

export function defaultForm(kind: FormConfig['kind'] = 'flat'): FormConfig {
  return kind === 'flat' ? { kind: 'flat' } : { kind: 'roll', axis: 'vertical', wrapDeg: 360, seamTabs: true, seamTabCount: 4, seamTabLength: 25 }
}

export function defaultArray(kind: AssemblyArray['kind'] = 'single'): AssemblyArray {
  switch (kind) {
    case 'single':
      return { kind: 'single', x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 }
    case 'ring':
      return { kind: 'ring', count: 6, radius: 300, joinEdges: true, tiltDeg: 0, spinDeg: 0, height: 0, alternateMirror: false }
    case 'grid':
      return { kind: 'grid', rows: 2, cols: 3, spacingX: 600, spacingY: 600, joinEdges: true, stagger: false, alternateFlip: false }
    case 'stack':
      return { kind: 'stack', count: 6, spacing: 80, twistDeg: 15, scaleStep: 0 }
  }
}

export function newPart(name = 'Part'): Part {
  return { id: generateId(), name, sheet: defaultSheet(), groups: [newFlapGroup('Flaps')], form: defaultForm(), array: defaultArray() }
}

export function newFlapGroup(name = 'Flaps'): FlapGroup {
  return {
    id: generateId(),
    name,
    type: 'flap',
    visible: true,
    attach: 'inset',
    shape: defaultFlapShape('petal'),
    placement: defaultPlacement('radial'),
    fold: { angle: 60, direction: 'up', variation: { kind: 'constant' } },
    autoPrune: true,
  }
}

export function newCutoutGroup(name = 'Cutouts'): CutoutGroup {
  return {
    id: generateId(),
    name,
    type: 'cutout',
    visible: true,
    shape: { kind: 'circle', diameter: 40 },
    placement: defaultPlacement('single'),
    rotation: 0,
    autoPrune: true,
  }
}

