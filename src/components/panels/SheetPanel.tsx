import { useActivePart, useDesignStore } from '../../store/designStore'
import { BED_PRESETS } from '../../lib/presets'
import type { MaterialKind, OutlineShape } from '../../lib/geometry/types'
import { NumberField } from '../shared/NumberField'
import { Select } from '../shared/Select'
import { SegmentedControl } from '../shared/SegmentedControl'
import { Checkbox } from '../shared/Checkbox'
import { Section } from '../shared/Section'

const OUTLINE_DEFAULTS: Record<OutlineShape['kind'], OutlineShape> = {
  rect: { kind: 'rect', width: 600, height: 600, cornerRadius: 20 },
  ellipse: { kind: 'ellipse', width: 700, height: 700 },
  polygon: { kind: 'polygon', sides: 6, radius: 320, rotation: 0, cornerRadius: 10 },
  superellipse: { kind: 'superellipse', width: 700, height: 500, exponent: 4 },
  blob: { kind: 'blob', radius: 300, complexity: 5, irregularity: 0.25, seed: 1 },
}

const MATERIALS: { value: MaterialKind; label: string }[] = [
  { value: 'corten', label: 'Corten (weathering steel)' },
  { value: 'mild-steel', label: 'Mild steel' },
  { value: 'stainless', label: 'Stainless steel' },
  { value: 'aluminium', label: 'Aluminium' },
  { value: 'brass', label: 'Brass' },
  { value: 'copper', label: 'Copper' },
]

function OutlineFields({ shape, onChange }: { shape: OutlineShape; onChange: (s: OutlineShape) => void }) {
  switch (shape.kind) {
    case 'rect':
      return (
        <>
          <NumberField label="Width" suffix=" mm" value={shape.width} min={50} max={3000} onChange={(width) => onChange({ ...shape, width })} />
          <NumberField label="Height" suffix=" mm" value={shape.height} min={50} max={3000} onChange={(height) => onChange({ ...shape, height })} />
          <NumberField label="Corner radius" suffix=" mm" value={shape.cornerRadius} min={0} max={300} onChange={(cornerRadius) => onChange({ ...shape, cornerRadius })} />
        </>
      )
    case 'ellipse':
      return (
        <>
          <NumberField label="Width" suffix=" mm" value={shape.width} min={50} max={3000} onChange={(width) => onChange({ ...shape, width })} />
          <NumberField label="Height" suffix=" mm" value={shape.height} min={50} max={3000} onChange={(height) => onChange({ ...shape, height })} />
        </>
      )
    case 'polygon':
      return (
        <>
          <NumberField label="Sides" value={shape.sides} min={3} max={24} onChange={(sides) => onChange({ ...shape, sides })} />
          <NumberField label="Radius" suffix=" mm" value={shape.radius} min={30} max={1500} onChange={(radius) => onChange({ ...shape, radius })} />
          <NumberField label="Rotation" suffix="°" value={shape.rotation} min={-180} max={180} onChange={(rotation) => onChange({ ...shape, rotation })} />
          <NumberField label="Corner radius" suffix=" mm" value={shape.cornerRadius} min={0} max={150} onChange={(cornerRadius) => onChange({ ...shape, cornerRadius })} />
        </>
      )
    case 'superellipse':
      return (
        <>
          <NumberField label="Width" suffix=" mm" value={shape.width} min={50} max={3000} onChange={(width) => onChange({ ...shape, width })} />
          <NumberField label="Height" suffix=" mm" value={shape.height} min={50} max={3000} onChange={(height) => onChange({ ...shape, height })} />
          <NumberField label="Squareness" value={shape.exponent} min={0.6} max={10} step={0.1} onChange={(exponent) => onChange({ ...shape, exponent })} />
        </>
      )
    case 'blob':
      return (
        <>
          <NumberField label="Radius" suffix=" mm" value={shape.radius} min={50} max={1500} onChange={(radius) => onChange({ ...shape, radius })} />
          <NumberField label="Complexity" value={shape.complexity} min={2} max={10} onChange={(complexity) => onChange({ ...shape, complexity })} />
          <NumberField label="Irregularity" value={shape.irregularity} min={0} max={0.6} step={0.01} onChange={(irregularity) => onChange({ ...shape, irregularity })} />
          <NumberField label="Seed" value={shape.seed} min={0} max={999} slider={false} onChange={(seed) => onChange({ ...shape, seed })} />
        </>
      )
  }
}

export function SheetPanel() {
  const sheet = useActivePart().sheet
  const updateSheet = useDesignStore((s) => s.updateSheet)
  const bedKey = BED_PRESETS.find((b) => b.width === sheet.bed.width && b.height === sheet.bed.height)?.label ?? 'custom'

  return (
    <>
      <Section title="Sheet">
        <Select
          label="Outline"
          value={sheet.outline.kind}
          options={[
            { value: 'rect', label: 'Rectangle' },
            { value: 'ellipse', label: 'Ellipse / circle' },
            { value: 'polygon', label: 'Polygon' },
            { value: 'superellipse', label: 'Squircle' },
            { value: 'blob', label: 'Organic blob' },
          ]}
          onChange={(kind) => updateSheet({ outline: { ...OUTLINE_DEFAULTS[kind] } })}
        />
        <OutlineFields shape={sheet.outline} onChange={(outline) => updateSheet({ outline })} />
      </Section>

      <Section title="Material & machine" defaultOpen={false}>
        <Select label="Material" value={sheet.material} options={MATERIALS} onChange={(material) => updateSheet({ material })} />
        <NumberField label="Thickness" suffix=" mm" value={sheet.thickness} min={0.5} max={12} step={0.1} onChange={(thickness) => updateSheet({ thickness })} />
        <NumberField label="Kerf" suffix=" mm" value={sheet.kerf} min={0.1} max={4} step={0.1} onChange={(kerf) => updateSheet({ kerf })} />
        <NumberField label="Min bridge / edge distance" suffix=" mm" value={sheet.minBridge} min={1} max={30} step={0.5} onChange={(minBridge) => updateSheet({ minBridge })} />
        <Select
          label="Cutting bed"
          value={bedKey}
          options={[...BED_PRESETS.map((b) => ({ value: b.label, label: b.label })), { value: 'custom', label: 'Custom…' }]}
          onChange={(label) => {
            const b = BED_PRESETS.find((p) => p.label === label)
            if (b) updateSheet({ bed: { width: b.width, height: b.height } })
          }}
        />
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Bed W" suffix=" mm" slider={false} value={sheet.bed.width} min={100} max={6000} onChange={(width) => updateSheet({ bed: { ...sheet.bed, width } })} />
          <NumberField label="Bed H" suffix=" mm" slider={false} value={sheet.bed.height} min={100} max={12000} onChange={(height) => updateSheet({ bed: { ...sheet.bed, height } })} />
        </div>
      </Section>

      <Section title="Hinges" defaultOpen={false}>
        <SegmentedControl
          value={sheet.hinge.style}
          options={[
            { value: 'solid', label: 'Solid' },
            { value: 'perforated', label: 'Perforated' },
          ]}
          onChange={(style) => updateSheet({ hinge: { ...sheet.hinge, style } })}
        />
        {sheet.hinge.style === 'perforated' && (
          <>
            <NumberField label="Slot length" suffix=" mm" value={sheet.hinge.slotLength} min={2} max={60} step={0.5} onChange={(slotLength) => updateSheet({ hinge: { ...sheet.hinge, slotLength } })} />
            <NumberField label="Bridge length" suffix=" mm" value={sheet.hinge.bridgeLength} min={1} max={40} step={0.5} onChange={(bridgeLength) => updateSheet({ hinge: { ...sheet.hinge, bridgeLength } })} />
          </>
        )}
        <Checkbox label="Relief holes at hinge ends" checked={sheet.hinge.reliefHoles} onChange={(reliefHoles) => updateSheet({ hinge: { ...sheet.hinge, reliefHoles } })} />
        {sheet.hinge.reliefHoles && (
          <NumberField label="Relief diameter" suffix=" mm" value={sheet.hinge.reliefDiameter} min={1} max={20} step={0.5} onChange={(reliefDiameter) => updateSheet({ hinge: { ...sheet.hinge, reliefDiameter } })} />
        )}
        <p className="text-xs leading-relaxed text-neutral-500">
          Bend lines export on a separate reference layer. Perforated hinges are cut as short slots with solid bridges between them, so thicker plate folds by hand along a clean line.
        </p>
      </Section>
    </>
  )
}
