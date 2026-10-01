import type { BuildResult, CutLayer } from '../geometry/types'
import { normalizedPaths } from './svg'

const LAYER_COLOR: Record<CutLayer, number> = { cut: 5, bend: 30 }
const LAYER_NAME: Record<CutLayer, string> = { cut: 'CUT', bend: 'BEND' }

function num(n: number): string {
  return (Math.round(n * 10000) / 10000).toString()
}

/** Minimal AutoCAD R12 ASCII DXF (POLYLINE/LINE entities only) — the most
 * widely accepted dialect across plasma CAM packages (SheetCam, Fusion,
 * Mach/FireControl importers). Units: millimetres. */
export function serializeDxf(result: BuildResult, opts: { includeBend: boolean }): string {
  const out: string[] = []
  const g = (code: number, value: string | number) => out.push(String(code), String(value))
  const layers: CutLayer[] = opts.includeBend ? ['cut', 'bend'] : ['cut']

  g(0, 'SECTION')
  g(2, 'HEADER')
  g(9, '$ACADVER')
  g(1, 'AC1009')
  g(0, 'ENDSEC')

  g(0, 'SECTION')
  g(2, 'TABLES')
  g(0, 'TABLE')
  g(2, 'LAYER')
  g(70, layers.length)
  for (const l of layers) {
    g(0, 'LAYER')
    g(2, LAYER_NAME[l])
    g(70, 0)
    g(62, LAYER_COLOR[l])
    g(6, 'CONTINUOUS')
  }
  g(0, 'ENDTAB')
  g(0, 'ENDSEC')

  g(0, 'SECTION')
  g(2, 'ENTITIES')
  for (const p of normalizedPaths(result)) {
    if (!layers.includes(p.layer)) continue
    const layer = LAYER_NAME[p.layer]
    if (p.points.length === 2 && !p.closed) {
      g(0, 'LINE')
      g(8, layer)
      g(10, num(p.points[0].x))
      g(20, num(p.points[0].y))
      g(30, 0)
      g(11, num(p.points[1].x))
      g(21, num(p.points[1].y))
      g(31, 0)
      continue
    }
    g(0, 'POLYLINE')
    g(8, layer)
    g(66, 1)
    g(10, 0)
    g(20, 0)
    g(30, 0)
    g(70, p.closed ? 1 : 0)
    for (const v of p.points) {
      g(0, 'VERTEX')
      g(8, layer)
      g(10, num(v.x))
      g(20, num(v.y))
      g(30, 0)
    }
    g(0, 'SEQEND')
    g(8, layer)
  }
  g(0, 'ENDSEC')
  g(0, 'EOF')
  return out.join('\n') + '\n'
}
