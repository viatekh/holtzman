import { generateId } from './utils'
import type { CutoutGroup, Design, FlapGroup, FlapShape, Placement, SheetConfig } from './geometry/types'

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
  }
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

function flap(partial: Partial<FlapGroup> & Pick<FlapGroup, 'name' | 'shape' | 'placement' | 'fold'>): FlapGroup {
  return { id: generateId(), type: 'flap', visible: true, attach: 'inset', autoPrune: true, ...partial }
}

function cutout(partial: Partial<CutoutGroup> & Pick<CutoutGroup, 'name' | 'shape' | 'placement'>): CutoutGroup {
  return { id: generateId(), type: 'cutout', visible: true, rotation: 0, autoPrune: true, ...partial }
}

export interface DesignPreset {
  id: string
  name: string
  blurb: string
  make: () => Design
}

export const DESIGN_PRESETS: DesignPreset[] = [
  {
    id: 'bloom',
    name: 'Bloom',
    blurb: 'Rings of petals opening wider toward the rim',
    make: () => ({
      version: 1,
      name: 'Bloom',
      sheet: { ...defaultSheet(), outline: { kind: 'ellipse', width: 760, height: 760 } },
      groups: [
        flap({
          name: 'Petals',
          shape: { kind: 'petal', width: 46, length: 72, taper: 0.4, roundness: 0.55, curl: 0 },
          placement: { ...(defaultPlacement('radial') as Extract<Placement, { kind: 'radial' }>), rings: 3, perRing: 8, perRingGrowth: 6, innerRadius: 70, ringSpacing: 92, scaleInner: 0.8, scaleOuter: 1.15 },
          fold: { angle: 40, direction: 'up', variation: { kind: 'gradient', endAngle: 105 } },
        }),
        cutout({ name: 'Eye', shape: { kind: 'circle', diameter: 56 }, placement: defaultPlacement('single') }),
      ],
    }),
  },
  {
    id: 'scales',
    name: 'Scales',
    blurb: 'Staggered fish scales lifting in a wave',
    make: () => ({
      version: 1,
      name: 'Scales',
      sheet: { ...defaultSheet(), outline: { kind: 'superellipse', width: 900, height: 560, exponent: 4 } },
      groups: [
        flap({
          name: 'Scales',
          shape: { kind: 'scale', width: 62, length: 52, taper: 0.1, roundness: 0.95, curl: 0 },
          placement: { kind: 'grid', rows: 6, cols: 10, spacingX: 78, spacingY: 76, stagger: true, angle: 90, cx: 0, cy: -20 },
          fold: { angle: 35, direction: 'up', variation: { kind: 'wave', amplitude: 28, wavelength: 520, direction: 0 } },
        }),
      ],
    }),
  },
  {
    id: 'sunflower',
    name: 'Sunflower',
    blurb: 'Phyllotaxis spiral of leaves, steeper toward the edge',
    make: () => ({
      version: 1,
      name: 'Sunflower',
      sheet: { ...defaultSheet(), outline: { kind: 'ellipse', width: 820, height: 820 } },
      groups: [
        flap({
          name: 'Leaves',
          shape: { kind: 'leaf', width: 22, length: 46, taper: 0.45, roundness: 0, curl: 0 },
          placement: { ...(defaultPlacement('spiral') as Extract<Placement, { kind: 'spiral' }>), count: 140, spacing: 30, startIndex: 5, scaleInner: 0.55, scaleOuter: 1.25 },
          fold: { angle: 15, direction: 'up', variation: { kind: 'gradient', endAngle: 85 } },
        }),
      ],
    }),
  },
  {
    id: 'crown',
    name: 'Crown',
    blurb: 'Edge spikes fold up into a vessel; leaves flick in and out',
    make: () => ({
      version: 1,
      name: 'Crown',
      sheet: { ...defaultSheet(), outline: { kind: 'polygon', sides: 14, radius: 260, rotation: 0, cornerRadius: 6 } },
      groups: [
        flap({
          name: 'Spikes',
          attach: 'edge',
          shape: { kind: 'spike', width: 100, length: 220, taper: 0.25, roundness: 0, curl: 0 },
          placement: { kind: 'edge', count: 14, phase: 0.5 / 14, pointing: 'out' },
          fold: { angle: 80, direction: 'up', variation: { kind: 'constant' } },
          autoPrune: false,
        }),
        flap({
          name: 'Leaves',
          shape: { kind: 'flame', width: 30, length: 95, taper: 0.4, roundness: 0, curl: 30 },
          placement: { ...(defaultPlacement('radial') as Extract<Placement, { kind: 'radial' }>), rings: 1, perRing: 14, perRingGrowth: 0, innerRadius: 110, ringSpacing: 0, startAngle: 0, pointing: 'out', scaleInner: 1, scaleOuter: 1 },
          fold: { angle: 55, direction: 'alternate', variation: { kind: 'constant' } },
        }),
        cutout({ name: 'Centre', shape: { kind: 'polygon', sides: 7, radius: 46 }, placement: defaultPlacement('single') }),
      ],
    }),
  },
  {
    id: 'creature',
    name: 'Creature',
    blurb: 'Organic blob on folded legs, flames rippling across its back',
    make: () => ({
      version: 1,
      name: 'Creature',
      sheet: { ...defaultSheet(), outline: { kind: 'blob', radius: 300, complexity: 5, irregularity: 0.28, seed: 7 } },
      groups: [
        flap({
          name: 'Legs',
          attach: 'edge',
          shape: { kind: 'tab', width: 70, length: 120, taper: 0.55, roundness: 0.25, curl: 0 },
          placement: { kind: 'edge', count: 4, phase: 0.125, pointing: 'out' },
          fold: { angle: 90, direction: 'down', variation: { kind: 'constant' } },
          autoPrune: false,
        }),
        flap({
          name: 'Flames',
          shape: { kind: 'flame', width: 30, length: 80, taper: 0.4, roundness: 0, curl: 40 },
          placement: { kind: 'grid', rows: 6, cols: 7, spacingX: 62, spacingY: 76, stagger: true, angle: 75, cx: 0, cy: -30 },
          fold: { angle: 50, direction: 'up', variation: { kind: 'random', spread: 30, seed: 3 } },
        }),
      ],
    }),
  },
]

export function defaultDesign(): Design {
  return DESIGN_PRESETS[0].make()
}
