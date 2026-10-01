import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildDesign } from '../geometry/build'
import { arrayMatrices, posedGeometry, preparePart } from './partGeometry'
import { nestParts } from '../nest'
import { PRESETS } from '../presetLibrary'
import type { Part } from '../geometry/types'

const plainSheet = (wrapDeg: number): Part => {
  const p = PRESETS.find((x) => x.id === 'lantern')!.make().parts[0]
  return { ...p, groups: [], form: { kind: 'roll', axis: 'vertical', wrapDeg, seamTabs: false, seamTabCount: 4, seamTabLength: 25 } }
}

describe('rolling', () => {
  it('a 360° roll closes the sheet into a tube of the right diameter', () => {
    const part = plainSheet(360)
    const g = posedGeometry(preparePart(buildDesign(part), 2, part.form), 1)
    const size = g.boundingBox!.getSize(new THREE.Vector3())
    const expected = 940 / Math.PI
    expect(size.x).toBeGreaterThan(expected * 0.97)
    expect(size.x).toBeLessThan(expected * 1.03)
    expect(size.z).toBeGreaterThan(expected * 0.97)
  })

  it('progress 0 leaves the sheet flat', () => {
    const part = plainSheet(360)
    const g = posedGeometry(preparePart(buildDesign(part), 2, part.form), 0)
    const size = g.boundingBox!.getSize(new THREE.Vector3())
    expect(size.x).toBeCloseTo(940, 0)
    expect(size.z).toBeCloseTo(2, 3)
  })
})

describe('assembly arrays', () => {
  it('a joined ring of N panels spaces them so edges meet', () => {
    const box = new THREE.Box3(new THREE.Vector3(-150, 0, -1), new THREE.Vector3(150, 1000, 1))
    const ms = arrayMatrices({ kind: 'ring', count: 6, radius: 0, joinEdges: true, tiltDeg: 0, spinDeg: 0, height: 0, alternateMirror: false }, box)
    expect(ms.length).toBe(6)
    // Right edge of panel 0 meets left edge of panel 1.
    const a = new THREE.Vector3(150, 0, 0).applyMatrix4(ms[0])
    const b = new THREE.Vector3(-150, 0, 0).applyMatrix4(ms[1])
    expect(a.distanceTo(b)).toBeLessThan(0.01)
  })
})

describe('nesting', () => {
  it('packs every copy and opens extra beds as needed', () => {
    const project = PRESETS.find((p) => p.id === 'screen-wall')!.make()
    const results = new Map(project.parts.map((p) => [p.id, buildDesign(p)]))
    const nest = nestParts(project.parts, results, { width: 1250, height: 2500 }, 10)
    expect(nest.totalCopies).toBe(12)
    expect(nest.beds.reduce((s, b) => s + b.items.length, 0)).toBe(12)
    expect(nest.beds.length).toBe(2)
    for (const bed of nest.beds)
      for (const it of bed.items) {
        expect(it.x + it.width).toBeLessThanOrEqual(1250)
        expect(it.y + it.height).toBeLessThanOrEqual(2500)
      }
  })
})
