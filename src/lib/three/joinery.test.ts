import { describe, expect, it } from 'vitest'
import { buildDesign } from '../geometry/build'
import { bounds } from '../geometry/polygon'
import { PRESETS } from '../presetLibrary'
import { newPart } from '../presets'
import { computeSlots, DEFAULT_JOINERY } from './joinery'
import type { Part } from '../geometry/types'

function plate(name: string, w: number, h: number, array: Part['array']): Part {
  const p = newPart(name)
  return { ...p, groups: [], sheet: { ...p.sheet, outline: { kind: 'rect', width: w, height: h, cornerRadius: 0 } }, array }
}

describe('auto slots', () => {
  it('cuts slots in a plate that crown spikes pass through, and none in the crown', () => {
    const crown = PRESETS.find((p) => p.id === 'crown')!.make().parts[0]
    // Both laid flat (single placements pivot on their bottom edge, so a
    // flat 940 mm crown spans z −940…0 and a 700 mm lid z −700…0 before
    // offsets). The lid sits mid-way up the spikes, centred over the crown.
    crown.array = { kind: 'single', x: 0, y: 0, z: 0, rx: -90, ry: 0, rz: 0 }
    const lid = plate('Lid', 700, 700, { kind: 'single', x: 0, y: 0, z: -120, rx: -90, ry: 0, rz: 0 })
    const parts = [crown, lid]
    const results = new Map(parts.map((p) => [p.id, buildDesign(p)]))
    const slots = computeSlots(parts, results, DEFAULT_JOINERY)
    expect(slots.has(crown.id)).toBe(false)
    const lidSlots = slots.get(lid.id) ?? []
    // 14 edge spikes, plus inner leaves folded up into the lid.
    expect(lidSlots.length).toBeGreaterThanOrEqual(14)
    const slotted = buildDesign({ ...lid, slots: lidSlots })
    expect(slotted.issues.some((i) => i.code === 'slots')).toBe(true)
    expect(slotted.paths.filter((p) => p.layer === 'cut').length).toBeGreaterThan(14)
  })

  it('gives two crossing plates opposite half-depth slots (egg-crate)', () => {
    const a = plate('A', 400, 300, { kind: 'single', x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 })
    const b = plate('B', 400, 300, { kind: 'single', x: 0, y: 0, z: 0, rx: 0, ry: 90, rz: 0 })
    const parts = [a, b]
    const results = new Map(parts.map((p) => [p.id, buildDesign(p)]))
    const slots = computeSlots(parts, results, DEFAULT_JOINERY)
    const sa = bounds(slots.get(a.id)![0])
    const sb = bounds(slots.get(b.id)![0])
    // Each slot runs half the plate height, from opposite edges.
    expect(sa.maxY - sa.minY).toBeGreaterThan(140)
    expect(sa.maxY - sa.minY).toBeLessThan(165)
    expect(sb.maxY - sb.minY).toBeGreaterThan(140)
    expect(Math.sign(sa.minY + sa.maxY)).toBe(-Math.sign(sb.minY + sb.maxY))
    // Width = other plate's thickness + clearance both sides.
    expect(sa.maxX - sa.minX).toBeCloseTo(2 + 2 * DEFAULT_JOINERY.clearance, 0)
  })

  it('does nothing when switched off', () => {
    const a = plate('A', 400, 300, { kind: 'single', x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 })
    const b = plate('B', 400, 300, { kind: 'single', x: 0, y: 0, z: 0, rx: 0, ry: 90, rz: 0 })
    const results = new Map([a, b].map((p) => [p.id, buildDesign(p)]))
    expect(computeSlots([a, b], results, { autoSlots: false, clearance: 1 }).size).toBe(0)
  })
})
