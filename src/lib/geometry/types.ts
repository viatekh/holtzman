export interface Point {
  x: number
  y: number
}

/** Implicitly closed (no repeated last point). Units are always mm. */
export type Polygon = Point[]

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

// ─── Sheet ──────────────────────────────────────────────────────────────────

export type OutlineShape =
  | { kind: 'rect'; width: number; height: number; cornerRadius: number }
  | { kind: 'ellipse'; width: number; height: number }
  | { kind: 'polygon'; sides: number; radius: number; rotation: number; cornerRadius: number }
  | { kind: 'superellipse'; width: number; height: number; exponent: number }
  /** Seeded organic outline — a circle perturbed by low-order harmonics. */
  | { kind: 'blob'; radius: number; complexity: number; irregularity: number; seed: number }

export type MaterialKind = 'mild-steel' | 'corten' | 'stainless' | 'aluminium' | 'brass' | 'copper'

/** How a fold line is prepared in the flat cut so it can be bent by hand or
 * on a brake. 'solid' leaves the hinge uncut (bend line exported on a
 * separate reference layer only); 'perforated' stitches it with short slots
 * so thicker plate folds along a predictable line with less force. */
export type HingeStyle = 'solid' | 'perforated'

export interface HingeConfig {
  style: HingeStyle
  /** Drill-style relief holes at each hinge end, so the cut doesn't tear
   * into the sheet when the flap is bent. */
  reliefHoles: boolean
  reliefDiameter: number
  /** Perforation: cut length, then bridge (uncut) length, repeating. */
  slotLength: number
  bridgeLength: number
}

export interface BedSize {
  width: number
  height: number
}

export interface SheetConfig {
  outline: OutlineShape
  material: MaterialKind
  thickness: number
  /** Plasma kerf width (mm) — informs minimum-bridge checks; CAM software
   * does the actual kerf compensation, so exported paths are centrelines. */
  kerf: number
  /** Minimum solid metal left between any two cuts, and between a cut and
   * the sheet edge. Anything thinner burns away or warps under the torch. */
  minBridge: number
  bed: BedSize
  hinge: HingeConfig
}

// ─── Features ───────────────────────────────────────────────────────────────

/** Flap shapes are all defined in a local frame with the hinge running along
 * the x axis, centred on the origin, and the flap extending toward +y. */
export type FlapShapeKind = 'tab' | 'spike' | 'leaf' | 'petal' | 'scale' | 'flame'

export interface FlapShape {
  kind: FlapShapeKind
  /** Hinge length — the width of the flap where it stays attached. */
  width: number
  /** Hinge to tip. */
  length: number
  /** Width multiplier at the tip (tab) or bulge amount (leaf/petal). */
  taper: number
  /** 0..1 — fraction of the length rounded off at the tip. */
  roundness: number
  /** Degrees of total spine bend from hinge to tip (sideways curl). */
  curl: number
}

/** Drop-out shapes: a hole that falls away entirely. Flap-style kinds reuse
 * the flap profile (centred on its own midpoint rather than its hinge). */
export type CutoutShape =
  | { kind: 'circle'; diameter: number }
  | { kind: 'slot'; length: number; width: number }
  | { kind: 'polygon'; sides: number; radius: number }
  | { kind: 'profile'; profile: FlapShape }

export type FoldDirection = 'up' | 'down' | 'alternate'

/** How fold angles vary across a group of flaps. */
export type FoldVariation =
  | { kind: 'constant' }
  /** Interpolates from `angle` at the group's inner/first flaps to `endAngle`
   * at its outer/last ones. */
  | { kind: 'gradient'; endAngle: number }
  /** A travelling wave across the sheet: angle ± amplitude·sin(2π·d/λ). */
  | { kind: 'wave'; amplitude: number; wavelength: number; direction: number }
  | { kind: 'random'; spread: number; seed: number }

export interface FoldConfig {
  angle: number
  direction: FoldDirection
  variation: FoldVariation
}

/** 'inset' flaps are cut out of the sheet's interior (leaving a window when
 * folded). 'edge' flaps hang off the outline and fold to make legs, fins or
 * crowns — their hinge sits on the sheet edge. */
export type FlapAttach = 'inset' | 'edge'

export type Placement =
  | { kind: 'single'; x: number; y: number; angle: number }
  /** Concentric rings around the sheet centre (+ offset). */
  | {
      kind: 'radial'
      rings: number
      perRing: number
      /** Extra flaps added per successive ring. */
      perRingGrowth: number
      innerRadius: number
      ringSpacing: number
      startAngle: number
      staggerRings: boolean
      pointing: 'out' | 'in' | 'tangent'
      /** Scale multiplier on the innermost / outermost ring. */
      scaleInner: number
      scaleOuter: number
      cx: number
      cy: number
    }
  | {
      kind: 'grid'
      rows: number
      cols: number
      spacingX: number
      spacingY: number
      stagger: boolean
      /** Direction (deg) every flap points. */
      angle: number
      cx: number
      cy: number
    }
  /** Golden-angle (sunflower) spiral. */
  | {
      kind: 'spiral'
      count: number
      spacing: number
      startIndex: number
      divergence: number
      pointing: 'out' | 'in' | 'tangent'
      scaleInner: number
      scaleOuter: number
      cx: number
      cy: number
    }
  /** Evenly around the sheet outline. */
  | { kind: 'edge'; count: number; phase: number; pointing: 'out' | 'in' }

export interface FlapGroup {
  id: string
  name: string
  type: 'flap'
  visible: boolean
  attach: FlapAttach
  shape: FlapShape
  placement: Placement
  fold: FoldConfig
  /** Drop generated flaps that break the sheet edge or overlap earlier
   * flaps, instead of just flagging them. */
  autoPrune: boolean
}

export interface CutoutGroup {
  id: string
  name: string
  type: 'cutout'
  visible: boolean
  shape: CutoutShape
  placement: Placement
  /** Extra rotation (deg) on top of the placement's own orientation. */
  rotation: number
  autoPrune: boolean
}

export type FeatureGroup = FlapGroup | CutoutGroup

export interface Design {
  version: 1
  name: string
  sheet: SheetConfig
  groups: FeatureGroup[]
}

// ─── Derived geometry ───────────────────────────────────────────────────────

/** One placed flap, fully resolved in sheet coordinates. */
export interface ResolvedFlap {
  id: string
  groupId: string
  index: number
  attach: FlapAttach
  /** Closed outline, hinge edge included (from hingeB back to hingeA). */
  polygon: Polygon
  /** Open cut path: hingeA → around the tip → hingeB. */
  cutPath: Point[]
  hingeA: Point
  hingeB: Point
  /** Signed fold angle in degrees; positive folds toward +z (up). */
  fold: number
  /** Unit vector along the flap's spine at the hinge (pointing to the tip). */
  spine: Point
}

export interface ResolvedCutout {
  id: string
  groupId: string
  index: number
  polygon: Polygon
}

export type IssueSeverity = 'error' | 'warning' | 'info'

export interface Issue {
  severity: IssueSeverity
  code: string
  message: string
  featureIds?: string[]
}

export type CutLayer = 'cut' | 'bend'

export interface CutPath {
  layer: CutLayer
  points: Point[]
  closed: boolean
}

export interface FabricationStats {
  widthMm: number
  heightMm: number
  fitsBed: boolean
  fitsBedRotated: boolean
  cutLengthMm: number
  pierces: number
  flaps: number
  cutouts: number
  /** Plate weight after cutting (kg). */
  weightKg: number
  /** Area of the sheet blank (outline) in mm². */
  outlineAreaMm2: number
  /** Area of metal that drops away (cutouts). */
  dropAreaMm2: number
}

export interface BuildResult {
  baseOutline: Polygon
  /** Final cut outline: base ∪ edge flaps − edge-hinge reliefs. */
  outline: Polygon[]
  flaps: ResolvedFlap[]
  cutouts: ResolvedCutout[]
  reliefs: Polygon[]
  paths: CutPath[]
  bounds: Bounds
  stats: FabricationStats
  issues: Issue[]
  /** Feature ids that failed validation (rendered red). */
  invalidIds: Set<string>
}
