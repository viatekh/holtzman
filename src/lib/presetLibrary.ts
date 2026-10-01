import { generateId } from './utils'
import { defaultArray, defaultFlapShape, defaultPlacement, defaultSheet } from './presets'
import type {
  AssemblyArray,
  CutoutGroup,
  CutoutShape,
  FlapAttach,
  FlapGroup,
  FlapShape,
  FlapShapeKind,
  FoldConfig,
  FoldVariation,
  FormConfig,
  OutlineShape,
  Part,
  Placement,
  Project,
  SheetConfig,
} from './geometry/types'

// ─── Terse builders, so each preset reads like a recipe ─────────────────────

type P<K extends Placement['kind']> = Extract<Placement, { kind: K }>

const rect = (width: number, height: number, cornerRadius = 20): OutlineShape => ({ kind: 'rect', width, height, cornerRadius })
const ellipse = (width: number, height = width): OutlineShape => ({ kind: 'ellipse', width, height })
const poly = (sides: number, radius: number, rotation = 0, cornerRadius = 6): OutlineShape => ({ kind: 'polygon', sides, radius, rotation, cornerRadius })
const squircle = (width: number, height: number, exponent = 4): OutlineShape => ({ kind: 'superellipse', width, height, exponent })
const blob = (radius: number, seed: number, irregularity = 0.25, complexity = 5): OutlineShape => ({ kind: 'blob', radius, complexity, irregularity, seed })

const sheet = (outline: OutlineShape, extra: Partial<SheetConfig> = {}): SheetConfig => ({ ...defaultSheet(), outline, ...extra })

const shape = (kind: FlapShapeKind, width: number, length: number, extra: Partial<FlapShape> = {}): FlapShape => ({
  ...defaultFlapShape(kind),
  width,
  length,
  ...extra,
})

const radial = (p: Partial<P<'radial'>>): P<'radial'> => ({ ...(defaultPlacement('radial') as P<'radial'>), ...p })
const grid = (p: Partial<P<'grid'>>): P<'grid'> => ({ ...(defaultPlacement('grid') as P<'grid'>), ...p })
const spiral = (p: Partial<P<'spiral'>>): P<'spiral'> => ({ ...(defaultPlacement('spiral') as P<'spiral'>), ...p })
const edge = (count: number, phase = 0, pointing: 'out' | 'in' = 'out'): P<'edge'> => ({ kind: 'edge', count, phase, pointing })
const line = (count: number, x1: number, y1: number, x2: number, y2: number, angle: number, scaleStart = 1, scaleEnd = 1): P<'line'> => ({
  kind: 'line',
  count,
  x1,
  y1,
  x2,
  y2,
  angle,
  scaleStart,
  scaleEnd,
})
const single = (x = 0, y = 0, angle = 90): P<'single'> => ({ kind: 'single', x, y, angle })

const constant: FoldVariation = { kind: 'constant' }
const grad = (endAngle: number): FoldVariation => ({ kind: 'gradient', endAngle })
const wave = (amplitude: number, wavelength: number, direction = 0): FoldVariation => ({ kind: 'wave', amplitude, wavelength, direction })
const rand = (spread: number, seed = 1): FoldVariation => ({ kind: 'random', spread, seed })
const fold = (angle: number, direction: FoldConfig['direction'] = 'up', variation: FoldVariation = constant): FoldConfig => ({ angle, direction, variation })

function flaps(name: string, s: FlapShape, placement: Placement, f: FoldConfig, attach: FlapAttach = 'inset', autoPrune = true): FlapGroup {
  return { id: generateId(), name, type: 'flap', visible: true, attach, shape: s, placement, fold: f, autoPrune }
}

function holes(name: string, s: CutoutShape, placement: Placement, rotation = 0): CutoutGroup {
  return { id: generateId(), name, type: 'cutout', visible: true, shape: s, placement, rotation, autoPrune: true }
}

const circle = (diameter: number): CutoutShape => ({ kind: 'circle', diameter })
const slot = (length: number, width: number): CutoutShape => ({ kind: 'slot', length, width })
const ngon = (sides: number, radius: number): CutoutShape => ({ kind: 'polygon', sides, radius })
const profile = (p: FlapShape): CutoutShape => ({ kind: 'profile', profile: p })

const tube = (wrapDeg = 360, axis: 'vertical' | 'horizontal' = 'vertical', seamTabs = true, seamTabCount = 4): FormConfig => ({
  kind: 'roll',
  axis,
  wrapDeg,
  seamTabs,
  seamTabCount,
  seamTabLength: 25,
})

function part(name: string, s: SheetConfig, groups: (FlapGroup | CutoutGroup)[], form: FormConfig = { kind: 'flat' }, array: AssemblyArray = defaultArray()): Part {
  return { id: generateId(), name, sheet: s, groups, form, array }
}

const ring = (p: Partial<Extract<AssemblyArray, { kind: 'ring' }>>): AssemblyArray => ({ ...(defaultArray('ring') as Extract<AssemblyArray, { kind: 'ring' }>), ...p })
const tiles = (p: Partial<Extract<AssemblyArray, { kind: 'grid' }>>): AssemblyArray => ({ ...(defaultArray('grid') as Extract<AssemblyArray, { kind: 'grid' }>), ...p })
const stack = (p: Partial<Extract<AssemblyArray, { kind: 'stack' }>>): AssemblyArray => ({ ...(defaultArray('stack') as Extract<AssemblyArray, { kind: 'stack' }>), ...p })
const at = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): AssemblyArray => ({ kind: 'single', x, y, z, rx, ry, rz })

// ─── The library ────────────────────────────────────────────────────────────

export type PresetCategory = 'Flora' | 'Creatures' | 'Geometric' | 'Kinetic surfaces' | 'Tubes & vessels' | 'Assemblies'

export interface Preset {
  id: string
  name: string
  category: PresetCategory
  blurb: string
  /** Preferred 3D display for this piece. */
  view?: 'flat' | 'standing'
  make: () => Project
}

const one = (name: string, p: Part): Project => ({ version: 2, name, parts: [p] })
const many = (name: string, ...parts: Part[]): Project => ({ version: 2, name, parts })

export const PRESETS: Preset[] = [
  // ── Flora ──
  {
    id: 'bloom',
    name: 'Bloom',
    category: 'Flora',
    blurb: 'Rings of petals opening wider toward the rim',
    make: () =>
      one('Bloom', part('Bloom', sheet(ellipse(760)), [
        flaps('Petals', shape('petal', 46, 72, { taper: 0.4, roundness: 0.55 }), radial({ rings: 3, perRing: 8, perRingGrowth: 6, innerRadius: 70, ringSpacing: 92, scaleInner: 0.8, scaleOuter: 1.15 }), fold(40, 'up', grad(105))),
        holes('Eye', circle(56), single()),
      ])),
  },
  {
    id: 'sunflower',
    name: 'Sunflower',
    category: 'Flora',
    blurb: 'Phyllotaxis spiral of leaves, steeper toward the edge',
    make: () =>
      one('Sunflower', part('Sunflower', sheet(ellipse(820)), [
        flaps('Leaves', shape('leaf', 22, 46, { taper: 0.45 }), spiral({ count: 140, spacing: 30, startIndex: 5, scaleInner: 0.55, scaleOuter: 1.25 }), fold(15, 'up', grad(85))),
      ])),
  },
  {
    id: 'lotus',
    name: 'Lotus',
    category: 'Flora',
    blurb: 'Broad curled petals in three staggered tiers',
    make: () =>
      one('Lotus', part('Lotus', sheet(poly(12, 420, 0, 30)), [
        flaps('Inner petals', shape('petal', 60, 90, { taper: 0.5, roundness: 0.7, curl: 12 }), radial({ rings: 1, perRing: 6, innerRadius: 60, scaleInner: 1, scaleOuter: 1 }), fold(85)),
        flaps('Middle petals', shape('petal', 80, 120, { taper: 0.45, roundness: 0.6, curl: -12 }), radial({ rings: 1, perRing: 9, innerRadius: 175, startAngle: 110, scaleInner: 1, scaleOuter: 1 }), fold(60)),
        flaps('Outer petals', shape('petal', 90, 110, { taper: 0.3, roundness: 0.6 }), radial({ rings: 1, perRing: 12, innerRadius: 285, startAngle: 105, scaleInner: 1, scaleOuter: 1 }), fold(30)),
      ])),
  },
  {
    id: 'fern',
    name: 'Fern frond',
    category: 'Flora',
    blurb: 'Pinnate leaflets either side of a spine, rising toward the tip',
    view: 'standing',
    make: () =>
      one('Fern frond', part('Frond', sheet(squircle(380, 1300, 2.6)), [
        flaps('Left leaflets', shape('leaf', 26, 120, { taper: 0.3, curl: -15 }), line(13, -14, -560, -14, 520, 150, 1.25, 0.55), fold(20, 'up', grad(70))),
        flaps('Right leaflets', shape('leaf', 26, 120, { taper: 0.3, curl: 15 }), line(13, 14, -540, 14, 540, 30, 1.25, 0.55), fold(20, 'up', grad(70))),
      ])),
  },
  {
    id: 'dandelion',
    name: 'Dandelion clock',
    category: 'Flora',
    blurb: 'Hundreds of fine spikes in a golden-angle spiral',
    make: () =>
      one('Dandelion clock', part('Clock', sheet(ellipse(700), { thickness: 1.5 }), [
        flaps('Seeds', shape('spike', 12, 38, { taper: 0.1 }), spiral({ count: 260, spacing: 20, startIndex: 8, scaleInner: 0.6, scaleOuter: 1.2 }), fold(70, 'up', rand(15, 4))),
        holes('Core', circle(40), single()),
      ])),
  },
  {
    id: 'thistle',
    name: 'Thistle',
    category: 'Flora',
    blurb: 'Curling flames spiralling out from a cut-out heart',
    make: () =>
      one('Thistle', part('Thistle', sheet(ellipse(760, 860)), [
        flaps('Bracts', shape('flame', 24, 70, { curl: 45 }), spiral({ count: 120, spacing: 33, startIndex: 9, scaleInner: 0.7, scaleOuter: 1.3 }), fold(30, 'up', grad(95))),
        holes('Heart', ngon(9, 50), single()),
      ])),
  },
  {
    id: 'wheat',
    name: 'Wheat sheaf',
    category: 'Flora',
    blurb: 'Columns of grains alternating in and out',
    view: 'standing',
    make: () =>
      one('Wheat sheaf', part('Sheaf', sheet(rect(520, 1200, 60)), [
        flaps('Grains', shape('leaf', 22, 60, { taper: 0.7 }), grid({ rows: 14, cols: 5, spacingX: 90, spacingY: 78, stagger: true, angle: 90 }), fold(45, 'alternate')),
      ])),
  },
  {
    id: 'rose',
    name: 'Rose',
    category: 'Flora',
    blurb: 'Tight curled petals that open toward the rim',
    make: () =>
      one('Rose', part('Rose', sheet(ellipse(640)), [
        flaps('Petals', shape('petal', 54, 70, { taper: 0.5, roundness: 0.8, curl: 30 }), radial({ rings: 4, perRing: 5, perRingGrowth: 3, innerRadius: 45, ringSpacing: 68, pointing: 'tangent', scaleInner: 0.7, scaleOuter: 1.1 }), fold(110, 'up', grad(40))),
      ])),
  },
  {
    id: 'succulent',
    name: 'Succulent',
    category: 'Flora',
    blurb: 'Pointed rosette leaves, flatter as they grow outward',
    make: () =>
      one('Succulent', part('Succulent', sheet(poly(10, 380, 0, 40)), [
        flaps('Leaves', shape('spike', 56, 95, { taper: 0.6, roundness: 0.15 }), radial({ rings: 4, perRing: 5, perRingGrowth: 4, innerRadius: 45, ringSpacing: 78, scaleInner: 0.7, scaleOuter: 1.15 }), fold(85, 'up', grad(25))),
      ])),
  },
  {
    id: 'seedpod',
    name: 'Seed pod',
    category: 'Flora',
    blurb: 'Almond pod with rows of small leaves lifting in a wave',
    make: () =>
      one('Seed pod', part('Pod', sheet(squircle(1000, 460, 1.6)), [
        flaps('Seeds', shape('leaf', 20, 52, { taper: 0.6 }), grid({ rows: 5, cols: 14, spacingX: 52, spacingY: 62, stagger: true, angle: 90, cy: -25 }), fold(40, 'up', wave(30, 600, 0))),
      ])),
  },
  {
    id: 'ginkgo',
    name: 'Ginkgo',
    category: 'Flora',
    blurb: 'Fan of flared scales radiating from one corner',
    make: () =>
      one('Ginkgo', part('Ginkgo', sheet(ellipse(900, 600)), [
        flaps('Fans', shape('scale', 44, 54, { taper: 0.6, roundness: 0.9 }), radial({ rings: 4, perRing: 7, perRingGrowth: 3, innerRadius: 20, ringSpacing: 70, cy: -270, startAngle: 30, pointing: 'out', scaleInner: 0.8, scaleOuter: 1.2 }), fold(25, 'up', grad(75))),
      ])),
  },

  // ── Creatures ──
  {
    id: 'creature',
    name: 'Creature',
    category: 'Creatures',
    blurb: 'Organic blob on folded legs, flames rippling across its back',
    make: () =>
      one('Creature', part('Creature', sheet(blob(300, 7, 0.28)), [
        flaps('Legs', shape('tab', 70, 120, { taper: 0.55, roundness: 0.25 }), edge(4, 0.125), fold(90, 'down'), 'edge', false),
        flaps('Flames', shape('flame', 30, 80, { curl: 40 }), grid({ rows: 6, cols: 7, spacingX: 62, spacingY: 76, angle: 75, cy: -30 }), fold(50, 'up', rand(30, 3))),
      ])),
  },
  {
    id: 'scales',
    name: 'Scales',
    category: 'Creatures',
    blurb: 'Staggered fish scales lifting in a wave',
    make: () =>
      one('Scales', part('Scales', sheet(squircle(900, 560)), [
        flaps('Scales', shape('scale', 62, 52, { taper: 0.1, roundness: 0.95 }), grid({ rows: 6, cols: 10, spacingX: 78, spacingY: 76, angle: 90, cy: -20 }), fold(35, 'up', wave(28, 520, 0))),
      ])),
  },
  {
    id: 'dragon',
    name: 'Dragon spine',
    category: 'Creatures',
    blurb: 'Long body, a ridge of spikes, scales down both flanks',
    make: () =>
      one('Dragon spine', part('Dragon', sheet(squircle(1400, 420, 2.2)), [
        flaps('Ridge', shape('spike', 70, 120, { taper: 0.3, curl: -20 }), line(9, -560, -60, 560, -60, 90, 0.6, 1.1), fold(95, 'up', grad(70))),
        flaps('Flank scales', shape('scale', 42, 36, { roundness: 0.95 }), grid({ rows: 2, cols: 22, spacingX: 52, spacingY: 56, angle: -90, cy: 115 }), fold(25, 'up', wave(20, 400, 0))),
      ])),
  },
  {
    id: 'hedgehog',
    name: 'Hedgehog',
    category: 'Creatures',
    blurb: 'Dense random spikes on a low blob with folded feet',
    make: () =>
      one('Hedgehog', part('Hedgehog', sheet(blob(280, 11, 0.18)), [
        flaps('Feet', shape('tab', 50, 70, { taper: 0.8, roundness: 0.4 }), edge(4, 0.06), fold(90, 'down'), 'edge', false),
        flaps('Spines', shape('spike', 16, 52, { curl: 15 }), spiral({ count: 170, spacing: 19, startIndex: 3, pointing: 'in', scaleInner: 0.8, scaleOuter: 1.1 }), fold(55, 'up', rand(25, 9))),
      ])),
  },
  {
    id: 'fish',
    name: 'Koi',
    category: 'Creatures',
    blurb: 'Ellipse body with scale rows and fins folded off the edge',
    make: () =>
      one('Koi', part('Koi', sheet(ellipse(900, 380)), [
        flaps('Fins', shape('flame', 80, 150, { curl: 30 }), edge(5, 0.1), fold(35, 'alternate'), 'edge', false),
        flaps('Scales', shape('scale', 40, 34, { roundness: 0.95 }), grid({ rows: 5, cols: 15, spacingX: 46, spacingY: 46, angle: 180, cx: -20 }), fold(30, 'up', grad(10))),
      ])),
  },
  {
    id: 'wing',
    name: 'Wing',
    category: 'Creatures',
    blurb: 'Rows of curled feathers lengthening toward the trailing edge',
    make: () =>
      one('Wing', part('Wing', sheet(squircle(1200, 520, 1.8)), [
        flaps('Coverts', shape('leaf', 34, 70, { curl: -20 }), grid({ rows: 3, cols: 13, spacingX: 70, spacingY: 70, angle: -100, cy: 100 }), fold(20)),
        flaps('Primaries', shape('leaf', 44, 130, { curl: -25 }), line(11, -420, -60, 420, -60, -95, 0.7, 1.2), fold(25, 'up', grad(55))),
      ])),
  },
  {
    id: 'armadillo',
    name: 'Armadillo',
    category: 'Creatures',
    blurb: 'Banded plates that ripple along the body',
    make: () =>
      one('Armadillo', part('Armadillo', sheet(rect(1000, 520, 200)), [
        flaps('Bands', shape('tab', 54, 44, { taper: 0.9, roundness: 0.3 }), grid({ rows: 7, cols: 14, spacingX: 62, spacingY: 62, stagger: false, angle: 0 }), fold(30, 'up', wave(25, 360, 0))),
      ])),
  },
  {
    id: 'beetle',
    name: 'Beetle',
    category: 'Creatures',
    blurb: 'Split wing cases, six folded legs, spotted shell',
    make: () =>
      one('Beetle', part('Beetle', sheet(ellipse(520, 700)), [
        flaps('Legs', shape('spike', 40, 140, { curl: 30 }), edge(6, 0.04), fold(70, 'down'), 'edge', false),
        holes('Spots', circle(34), radial({ rings: 2, perRing: 6, perRingGrowth: 2, innerRadius: 90, ringSpacing: 110, staggerRings: true })),
        holes('Wing split', slot(420, 8), single(0, 40, 90)),
      ])),
  },
  {
    id: 'starfish',
    name: 'Starfish',
    category: 'Creatures',
    blurb: 'Five arms curling up, studded with tiny spikes',
    make: () =>
      one('Starfish', part('Starfish', sheet(poly(5, 140, 0, 30)), [
        flaps('Arms', shape('spike', 118, 280, { taper: 0.35, roundness: 0.2 }), edge(5, 0.1), fold(30), 'edge', false),
        flaps('Studs', shape('spike', 16, 26), radial({ rings: 2, perRing: 5, perRingGrowth: 5, innerRadius: 40, ringSpacing: 45 }), fold(80)),
      ])),
  },

  // ── Geometric ──
  {
    id: 'crown',
    name: 'Crown',
    category: 'Geometric',
    blurb: 'Edge spikes fold up into a vessel; leaves flick in and out',
    make: () =>
      one('Crown', part('Crown', sheet(poly(14, 260)), [
        flaps('Spikes', shape('spike', 100, 220, { taper: 0.25 }), edge(14, 0.5 / 14), fold(80), 'edge', false),
        flaps('Leaves', shape('flame', 30, 95, { curl: 30 }), radial({ rings: 1, perRing: 14, perRingGrowth: 0, innerRadius: 110, startAngle: 0, scaleInner: 1, scaleOuter: 1 }), fold(55, 'alternate')),
        holes('Centre', ngon(7, 46), single()),
      ])),
  },
  {
    id: 'starburst',
    name: 'Starburst',
    category: 'Geometric',
    blurb: 'Concentric rings of spikes, every other ring reversed',
    make: () =>
      one('Starburst', part('Starburst', sheet(poly(8, 420, 22.5, 10)), [
        flaps('Rays', shape('spike', 40, 90, { taper: 0 }), radial({ rings: 4, perRing: 8, perRingGrowth: 8, innerRadius: 50, ringSpacing: 90, staggerRings: true, scaleInner: 0.8, scaleOuter: 1.1 }), fold(60, 'alternate')),
      ])),
  },
  {
    id: 'sundisk',
    name: 'Sun disk',
    category: 'Geometric',
    blurb: 'Tangential tabs that spin like a turbine',
    make: () =>
      one('Sun disk', part('Sun disk', sheet(ellipse(800)), [
        flaps('Vanes', shape('tab', 50, 80, { taper: 0.5, roundness: 0.2 }), radial({ rings: 3, perRing: 10, perRingGrowth: 6, innerRadius: 110, ringSpacing: 95, pointing: 'tangent', staggerRings: false, scaleInner: 0.8, scaleOuter: 1.1 }), fold(40, 'up', grad(70))),
        holes('Hub', circle(120), single()),
      ])),
  },
  {
    id: 'hive',
    name: 'Hive',
    category: 'Geometric',
    blurb: 'Hexagon plate perforated with hex cells and triangular flaps',
    make: () =>
      one('Hive', part('Hive', sheet(poly(6, 420, 30, 12)), [
        holes('Cells', ngon(6, 18), grid({ rows: 12, cols: 11, spacingX: 70, spacingY: 60, stagger: true, angle: 90 })),
        flaps('Thorns', shape('spike', 18, 22, { taper: 0 }), grid({ rows: 12, cols: 11, spacingX: 70, spacingY: 60, stagger: true, angle: 90, cx: 35, cy: -6 }), fold(70, 'alternate')),
      ])),
  },
  {
    id: 'zipper',
    name: 'Zipper',
    category: 'Geometric',
    blurb: 'Two interlocking rows of teeth folding opposite ways',
    view: 'standing',
    make: () =>
      one('Zipper', part('Zipper', sheet(rect(360, 1200, 30)), [
        flaps('Left teeth', shape('tab', 40, 70, { taper: 0.7, roundness: 0.3 }), line(16, -18, -540, -18, 520, 180), fold(75)),
        flaps('Right teeth', shape('tab', 40, 70, { taper: 0.7, roundness: 0.3 }), line(16, 18, -520, 18, 540, 0), fold(75, 'down')),
      ])),
  },
  {
    id: 'moire',
    name: 'Moiré',
    category: 'Geometric',
    blurb: 'Rings of holes and slots that shift as you walk past',
    make: () =>
      one('Moiré', part('Moiré', sheet(ellipse(800)), [
        holes('Holes', circle(22), radial({ rings: 8, perRing: 12, perRingGrowth: 6, innerRadius: 40, ringSpacing: 38, staggerRings: true })),
        flaps('Louvres', shape('tab', 40, 26, { taper: 1, roundness: 0 }), radial({ rings: 1, perRing: 30, perRingGrowth: 0, innerRadius: 370, pointing: 'in', scaleInner: 1, scaleOuter: 1 }), fold(60)),
      ])),
  },
  {
    id: 'compass',
    name: 'Compass rose',
    category: 'Geometric',
    blurb: 'Long cardinal points, short intercardinals, a star cut at the heart',
    make: () =>
      one('Compass rose', part('Compass', sheet(ellipse(820)), [
        flaps('Cardinals', shape('spike', 90, 300, { taper: 0 }), radial({ rings: 1, perRing: 4, perRingGrowth: 0, innerRadius: 55, scaleInner: 1, scaleOuter: 1 }), fold(25)),
        flaps('Intercardinals', shape('spike', 70, 180, { taper: 0 }), radial({ rings: 1, perRing: 4, perRingGrowth: 0, innerRadius: 60, startAngle: 45, scaleInner: 1, scaleOuter: 1 }), fold(40)),
        flaps('Ticks', shape('tab', 16, 30, { taper: 0.5 }), radial({ rings: 1, perRing: 32, perRingGrowth: 0, innerRadius: 360, scaleInner: 1, scaleOuter: 1 }), fold(90)),
        holes('Star', profile(shape('spike', 30, 40)), radial({ rings: 1, perRing: 8, perRingGrowth: 0, innerRadius: 22, scaleInner: 1, scaleOuter: 1 })),
      ])),
  },
  {
    id: 'mandala',
    name: 'Mandala',
    category: 'Geometric',
    blurb: 'Alternating petals, leaves and holes in strict symmetry',
    make: () =>
      one('Mandala', part('Mandala', sheet(poly(16, 430, 0, 8)), [
        flaps('Petals', shape('petal', 44, 60, { roundness: 0.7 }), radial({ rings: 1, perRing: 8, perRingGrowth: 0, innerRadius: 60, scaleInner: 1, scaleOuter: 1 }), fold(70)),
        holes('Ring of eyes', circle(26), radial({ rings: 1, perRing: 16, perRingGrowth: 0, innerRadius: 165 })),
        flaps('Leaves', shape('leaf', 34, 90), radial({ rings: 1, perRing: 16, perRingGrowth: 0, innerRadius: 200, startAngle: 101.25, scaleInner: 1, scaleOuter: 1 }), fold(45, 'alternate')),
        flaps('Rim teeth', shape('spike', 40, 50, { taper: 0 }), radial({ rings: 1, perRing: 32, perRingGrowth: 0, innerRadius: 340, scaleInner: 1, scaleOuter: 1 }), fold(90)),
      ])),
  },

  // ── Kinetic surfaces ──
  {
    id: 'louvre',
    name: 'Louvre screen',
    category: 'Kinetic surfaces',
    blurb: 'Wide slats all tilted the same way, like a vent',
    view: 'standing',
    make: () =>
      one('Louvre screen', part('Louvre', sheet(rect(900, 1200, 10)), [
        flaps('Slats', shape('tab', 180, 46, { taper: 1, roundness: 0 }), grid({ rows: 16, cols: 4, spacingX: 200, spacingY: 70, stagger: false, angle: 90 }), fold(45)),
      ])),
  },
  {
    id: 'ripple',
    name: 'Ripple',
    category: 'Kinetic surfaces',
    blurb: 'Square tabs lifting in a diagonal travelling wave',
    view: 'standing',
    make: () =>
      one('Ripple', part('Ripple', sheet(rect(1000, 1000, 10)), [
        flaps('Tabs', shape('tab', 52, 52, { taper: 1, roundness: 0 }), grid({ rows: 13, cols: 13, spacingX: 72, spacingY: 72, stagger: false, angle: 90 }), fold(45, 'up', wave(40, 500, 45))),
      ])),
  },
  {
    id: 'checker',
    name: 'Checkerboard',
    category: 'Kinetic surfaces',
    blurb: 'Every other tile folds the other way',
    view: 'standing',
    make: () =>
      one('Checkerboard', part('Checker', sheet(rect(900, 900, 10)), [
        flaps('Tiles', shape('tab', 56, 56, { taper: 1, roundness: 0 }), grid({ rows: 11, cols: 11, spacingX: 75, spacingY: 75, stagger: false, angle: 0 }), fold(60, 'alternate')),
      ])),
  },
  {
    id: 'dune',
    name: 'Dune',
    category: 'Kinetic surfaces',
    blurb: 'Scales rising and falling in long sand-dune swells',
    make: () =>
      one('Dune', part('Dune', sheet(rect(1200, 700, 40)), [
        flaps('Grains', shape('scale', 46, 40, { roundness: 1 }), grid({ rows: 10, cols: 21, spacingX: 54, spacingY: 62, angle: 90 }), fold(40, 'up', wave(38, 700, 20))),
      ])),
  },
  {
    id: 'feather-field',
    name: 'Feather field',
    category: 'Kinetic surfaces',
    blurb: 'Curled leaves combed in one direction, ruffled at random',
    view: 'standing',
    make: () =>
      one('Feather field', part('Feathers', sheet(rect(800, 1100, 30)), [
        flaps('Feathers', shape('leaf', 34, 95, { curl: 25 }), grid({ rows: 11, cols: 9, spacingX: 82, spacingY: 92, angle: 110 }), fold(40, 'up', rand(25, 12))),
      ])),
  },
  {
    id: 'rain',
    name: 'Rain',
    category: 'Kinetic surfaces',
    blurb: 'Teardrop slots and falling spikes, steeper toward the bottom',
    view: 'standing',
    make: () =>
      one('Rain', part('Rain', sheet(rect(700, 1200, 20)), [
        flaps('Drops', shape('spike', 26, 70, { taper: 0.5, roundness: 0.3 }), grid({ rows: 12, cols: 8, spacingX: 80, spacingY: 92, angle: -90 }), fold(80, 'up', grad(10))),
      ])),
  },

  // ── Tubes & vessels ──
  {
    id: 'lantern',
    name: 'Lantern',
    category: 'Tubes & vessels',
    blurb: 'Rolled into a tube, petals flaring out to throw light',
    view: 'standing',
    make: () =>
      one('Lantern', part('Lantern', sheet(rect(940, 520, 0)), [
        flaps('Petals', shape('petal', 46, 70, { roundness: 0.6 }), grid({ rows: 4, cols: 9, spacingX: 98, spacingY: 115, angle: 90 }), fold(65, 'up', grad(30))),
        holes('Glow holes', circle(14), grid({ rows: 4, cols: 9, spacingX: 98, spacingY: 115, cx: 49, cy: 57 })),
      ], tube(360))),
  },
  {
    id: 'totem',
    name: 'Totem',
    category: 'Tubes & vessels',
    blurb: 'Tall rolled column bristling with spikes',
    view: 'standing',
    make: () =>
      one('Totem', part('Totem', sheet(rect(700, 1400, 0)), [
        flaps('Spikes', shape('spike', 44, 90, { curl: 15 }), grid({ rows: 12, cols: 6, spacingX: 110, spacingY: 112, angle: 90 }), fold(60, 'up', rand(20, 2))),
      ], tube(360, 'vertical', true, 6))),
  },
  {
    id: 'vase',
    name: 'Leaf vase',
    category: 'Tubes & vessels',
    blurb: 'Tube with leaves spiralling up its sides',
    view: 'standing',
    make: () =>
      one('Leaf vase', part('Vase', sheet(rect(760, 700, 0)), [
        flaps('Leaves', shape('leaf', 26, 80, { curl: 20 }), grid({ rows: 7, cols: 8, spacingX: 92, spacingY: 92, angle: 70 }), fold(20, 'up', grad(70))),
      ], tube(360))),
  },
  {
    id: 'scale-column',
    name: 'Scaled column',
    category: 'Tubes & vessels',
    blurb: 'Pine-cone tube of overlapping scales',
    view: 'standing',
    make: () =>
      one('Scaled column', part('Column', sheet(rect(800, 1100, 0)), [
        flaps('Scales', shape('scale', 56, 50, { roundness: 1 }), grid({ rows: 15, cols: 11, spacingX: 70, spacingY: 70, angle: -90 }), fold(35)),
      ], tube(360, 'vertical', true, 5))),
  },
  {
    id: 'curved-screen',
    name: 'Curved screen',
    category: 'Tubes & vessels',
    blurb: 'Half-rolled panel with flames licking out',
    view: 'standing',
    make: () =>
      one('Curved screen', part('Screen', sheet(rect(1200, 900, 20)), [
        flaps('Flames', shape('flame', 34, 110, { curl: 40 }), grid({ rows: 6, cols: 12, spacingX: 96, spacingY: 140, angle: 90 }), fold(35, 'up', wave(25, 600, 0))),
      ], tube(180, 'vertical', false))),
  },
  {
    id: 'bowl',
    name: 'Petal bowl',
    category: 'Tubes & vessels',
    blurb: 'Edge petals fold up to make a bowl',
    make: () =>
      one('Petal bowl', part('Bowl', sheet(poly(10, 200, 18, 4)), [
        flaps('Walls', shape('tab', 100, 190, { taper: 0.55, roundness: 0.5 }), edge(10, 0.05), fold(60), 'edge', false),
        holes('Drain', circle(30), single()),
      ])),
  },
  {
    id: 'basket',
    name: 'Basket',
    category: 'Tubes & vessels',
    blurb: 'Square base, four perforated walls folded upright',
    make: () =>
      one('Basket', part('Basket', sheet(rect(360, 360, 0)), [
        flaps('Walls', shape('tab', 340, 260, { taper: 1.1, roundness: 0 }), edge(4, 0.125), fold(85), 'edge', false),
        holes('Weave', slot(70, 14), grid({ rows: 5, cols: 5, spacingX: 70, spacingY: 70, angle: 45 })),
      ])),
  },
  {
    id: 'cone-lamp',
    name: 'Starlight shade',
    category: 'Tubes & vessels',
    blurb: 'Tube shade pierced with stars and tiny spikes',
    view: 'standing',
    make: () =>
      one('Starlight shade', part('Shade', sheet(rect(880, 420, 0), { thickness: 1.2 }), [
        holes('Stars', profile(shape('spike', 14, 18, { taper: 0 })), spiral({ count: 160, spacing: 26, startIndex: 1, pointing: 'out', scaleInner: 1, scaleOuter: 1 })),
        flaps('Sparks', shape('spike', 12, 30), grid({ rows: 4, cols: 12, spacingX: 70, spacingY: 90, angle: 90 }), fold(70)),
      ], tube(360, 'vertical', true, 3))),
  },

  // ── Assemblies ──
  {
    id: 'flower-ring',
    name: 'Giant flower',
    category: 'Assemblies',
    blurb: 'Eight leaf-panel petals tilted out from a centre — one cut file, eight copies',
    make: () =>
      many('Giant flower',
        part('Petal', sheet(ellipse(320, 900)), [
          flaps('Veins', shape('leaf', 22, 70, { curl: 10 }), line(9, 0, -320, 0, 320, 90, 0.8, 1.2), fold(30, 'alternate')),
          holes('Spots', circle(16), line(8, 60, -280, 60, 280, 0)),
        ], { kind: 'flat' }, ring({ count: 8, radius: 120, joinEdges: false, tiltDeg: 55 })),
        part('Heart', sheet(ellipse(300)), [
          flaps('Stamens', shape('spike', 16, 50), spiral({ count: 40, spacing: 20, startIndex: 3, scaleInner: 1, scaleOuter: 1 }), fold(80)),
        ], { kind: 'flat' }, at(0, 160, 0, -90)),
      ),
  },
  {
    id: 'hex-pillar',
    name: 'Hex pillar',
    category: 'Assemblies',
    blurb: 'Six panels welded edge-to-edge into a hexagonal column',
    make: () =>
      many('Hex pillar',
        part('Face', sheet(rect(300, 1400, 0)), [
          flaps('Leaves', shape('leaf', 28, 90, { curl: 20 }), grid({ rows: 12, cols: 2, spacingX: 130, spacingY: 110, angle: 80 }), fold(30, 'up', grad(80))),
        ], { kind: 'flat' }, ring({ count: 6, joinEdges: true })),
      ),
  },
  {
    id: 'screen-wall',
    name: 'Scale wall',
    category: 'Assemblies',
    blurb: 'A 3 × 4 wall of identical tiles butted together',
    make: () =>
      many('Scale wall',
        part('Tile', sheet(rect(600, 600, 0)), [
          flaps('Scales', shape('scale', 56, 48, { roundness: 1 }), grid({ rows: 8, cols: 8, spacingX: 70, spacingY: 70, angle: -90 }), fold(35, 'up', wave(25, 600, 90))),
        ], { kind: 'flat' }, tiles({ rows: 3, cols: 4, joinEdges: true })),
      ),
  },
  {
    id: 'hex-wall',
    name: 'Honeycomb wall',
    category: 'Assemblies',
    blurb: 'Hexagon tiles nested in staggered rows',
    make: () =>
      many('Honeycomb wall',
        part('Hex tile', sheet(poly(6, 300, 30, 0)), [
          flaps('Petals', shape('petal', 40, 60), radial({ rings: 2, perRing: 6, perRingGrowth: 6, innerRadius: 50, ringSpacing: 100 }), fold(55)),
        ], { kind: 'flat' }, tiles({ rows: 4, cols: 4, joinEdges: false, spacingX: 520, spacingY: 450, stagger: true })),
      ),
  },
  {
    id: 'twist-tower',
    name: 'Twist tower',
    category: 'Assemblies',
    blurb: 'Twelve flat layers on spacers, each twisted 12° more',
    make: () =>
      many('Twist tower',
        part('Layer', sheet(poly(5, 300, 0, 20)), [
          flaps('Spikes', shape('spike', 50, 130), edge(5, 0.1), fold(25), 'edge', false),
          holes('Core', ngon(5, 60), single()),
        ], { kind: 'flat' }, stack({ count: 12, spacing: 90, twistDeg: 12 })),
      ),
  },
  {
    id: 'pagoda',
    name: 'Pagoda',
    category: 'Assemblies',
    blurb: 'Stacked tiers shrinking toward the top, eaves folded down',
    make: () =>
      many('Pagoda',
        part('Tier', sheet(rect(800, 800, 30)), [
          flaps('Eaves', shape('tab', 600, 120, { taper: 1.2, roundness: 0.1 }), edge(4, 0.125), fold(30, 'down'), 'edge', false),
          holes('Lanterns', circle(40), grid({ rows: 3, cols: 3, spacingX: 200, spacingY: 200 })),
        ], { kind: 'flat' }, stack({ count: 5, spacing: 220, twistDeg: 0, scaleStep: -0.15 })),
      ),
  },
  {
    id: 'tree',
    name: 'Tree',
    category: 'Assemblies',
    blurb: 'Rolled trunk carrying a ring of leafy branches',
    make: () =>
      many('Tree',
        part('Trunk', sheet(rect(500, 1300, 0)), [
          flaps('Bark', shape('scale', 40, 40, { roundness: 0.8 }), grid({ rows: 18, cols: 6, spacingX: 75, spacingY: 70, angle: -90 }), fold(20, 'up', rand(15, 5))),
        ], tube(360), at(0, 0, 0)),
        part('Branch', sheet(ellipse(360, 1000)), [
          flaps('Leaves', shape('leaf', 30, 80, { curl: 15 }), grid({ rows: 10, cols: 3, spacingX: 95, spacingY: 92, angle: 90 }), fold(45, 'up', rand(25, 8))),
        ], { kind: 'flat' }, ring({ count: 7, radius: 90, joinEdges: false, tiltDeg: 60, height: 1150 })),
      ),
  },
  {
    id: 'starball',
    name: 'Star burst sculpture',
    category: 'Assemblies',
    blurb: 'Two rings of spiked blades, one tilted up and one down',
    make: () =>
      many('Star burst sculpture',
        part('Upper blade', sheet(squircle(240, 900, 1.4)), [
          flaps('Barbs', shape('spike', 30, 70), line(10, 0, -380, 0, 380, 0), fold(70, 'alternate')),
        ], { kind: 'flat' }, ring({ count: 10, radius: 80, joinEdges: false, tiltDeg: 35, height: 500 })),
        part('Lower blade', sheet(squircle(240, 700, 1.4)), [
          flaps('Barbs', shape('spike', 30, 70), line(8, 0, -280, 0, 280, 180), fold(70, 'alternate')),
        ], { kind: 'flat' }, ring({ count: 10, radius: 80, joinEdges: false, tiltDeg: 150, height: 500, spinDeg: 18 })),
      ),
  },
  {
    id: 'fence',
    name: 'Flame fence',
    category: 'Assemblies',
    blurb: 'Five tall panels in a row — a garden screen',
    make: () =>
      many('Flame fence',
        part('Panel', sheet(rect(500, 1500, 60)), [
          flaps('Flames', shape('flame', 36, 120, { curl: 35 }), grid({ rows: 10, cols: 4, spacingX: 110, spacingY: 140, angle: 90 }), fold(40, 'up', grad(80))),
        ], { kind: 'flat' }, tiles({ rows: 1, cols: 5, joinEdges: false, spacingX: 560 })),
      ),
  },
  {
    id: 'tube-cluster',
    name: 'Organ pipes',
    category: 'Assemblies',
    blurb: 'A ring of spiked tubes standing shoulder to shoulder',
    make: () =>
      many('Organ pipes',
        part('Pipe', sheet(rect(500, 1200, 0)), [
          flaps('Spikes', shape('spike', 34, 60), grid({ rows: 12, cols: 4, spacingX: 115, spacingY: 95, angle: 90 }), fold(50, 'up', grad(80))),
        ], tube(360), ring({ count: 7, radius: 230, joinEdges: false })),
      ),
  },
  {
    id: 'cube',
    name: 'Lantern cube',
    category: 'Assemblies',
    blurb: 'Four perforated walls forming an open box',
    make: () =>
      many('Lantern cube',
        part('Wall', sheet(rect(600, 600, 0)), [
          flaps('Light petals', shape('petal', 34, 50, { roundness: 0.7 }), radial({ rings: 4, perRing: 6, perRingGrowth: 6, innerRadius: 40, ringSpacing: 62, scaleInner: 0.7, scaleOuter: 1.2 }), fold(80, 'up', grad(30))),
          holes('Eye', circle(30), single()),
        ], { kind: 'flat' }, ring({ count: 4, joinEdges: true })),
      ),
  },
]

export const PRESET_CATEGORIES: PresetCategory[] = ['Flora', 'Creatures', 'Geometric', 'Kinetic surfaces', 'Tubes & vessels', 'Assemblies']

export function defaultProject(): Project {
  return PRESETS[0].make()
}
