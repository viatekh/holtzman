import { describe, expect, it } from 'vitest'
import { buildDesign, perforationSegments } from './build'
import { buildFoldPanels } from './fold'
import { buildFlapLocal } from './shapes'
import { DESIGN_PRESETS, defaultFlapShape } from '../presets'
import { serializeDxf } from '../export/dxf'
import { serializeSvg } from '../export/svg'
import { distance, signedArea } from './polygon'

describe('flap profiles', () => {
  for (const kind of ['tab', 'spike', 'leaf', 'petal', 'scale', 'flame'] as const) {
    it(`${kind}: hinge is the straight base from (+w/2,0) to (−w/2,0)`, () => {
      const s = defaultFlapShape(kind)
      const pts = buildFlapLocal(s)
      expect(pts[0].x).toBeCloseTo(s.width / 2)
      expect(pts[0].y).toBeCloseTo(0)
      expect(pts[pts.length - 1].x).toBeCloseTo(-s.width / 2)
      expect(signedArea(pts)).toBeGreaterThan(0)
    })
  }
})

describe('perforation', () => {
  it('leaves bridges at both ends', () => {
    const segs = perforationSegments({ x: 0, y: 0 }, { x: 100, y: 0 }, { style: 'perforated', reliefHoles: false, reliefDiameter: 0, slotLength: 10, bridgeLength: 5 })
    expect(segs.length).toBe(6)
    expect(segs[0][0].x).toBeGreaterThanOrEqual(5)
    expect(segs[segs.length - 1][1].x).toBeLessThanOrEqual(95)
  })
})

describe('presets', () => {
  for (const preset of DESIGN_PRESETS) {
    it(`${preset.name} builds cleanly`, () => {
      const r = buildDesign(preset.make())
      expect(r.flaps.length).toBeGreaterThan(0)
      expect(r.issues.filter((i) => i.severity === 'error')).toEqual([])
      expect(r.stats.weightKg).toBeGreaterThan(0)
      const panels = buildFoldPanels(r)
      expect(panels[0].shapes.length).toBeGreaterThan(0)
      expect(panels[0].shapes[0].holes.length).toBeGreaterThan(0)
      expect(serializeDxf(r, { includeBend: true })).toContain('EOF')
      expect(serializeSvg(r, { includeBend: true, name: 'x' })).toContain('<svg')
    })
  }

  it('edge flaps extend the outline and keep hinges on the sheet', () => {
    const r = buildDesign(DESIGN_PRESETS.find((p) => p.id === 'crown')!.make())
    const edge = r.flaps.filter((f) => f.attach === 'edge')
    expect(edge.length).toBe(14)
    expect(r.stats.widthMm).toBeGreaterThan(520 + 300)
    for (const f of edge) expect(distance(f.hingeA, f.hingeB)).toBeGreaterThan(50)
  })

  it('flags overlapping flaps when auto-prune is off', () => {
    const d = DESIGN_PRESETS[0].make()
    const g = d.groups[0]
    if (g.type !== 'flap' || g.placement.kind !== 'radial') throw new Error()
    g.autoPrune = false
    g.placement.perRing = 30
    const r = buildDesign(d)
    expect(r.issues.some((i) => i.code === 'overlap')).toBe(true)
    expect(r.invalidIds.size).toBeGreaterThan(0)
  })
})
