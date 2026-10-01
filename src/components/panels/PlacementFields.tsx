import { defaultPlacement } from '../../lib/presets'
import type { Placement } from '../../lib/geometry/types'
import { NumberField } from '../shared/NumberField'
import { Select } from '../shared/Select'
import { SegmentedControl } from '../shared/SegmentedControl'
import { Checkbox } from '../shared/Checkbox'

const POINTING = [
  { value: 'out' as const, label: 'Out' },
  { value: 'in' as const, label: 'In' },
  { value: 'tangent' as const, label: 'Tangent' },
]

export function PlacementFields({ placement, onChange }: { placement: Placement; onChange: (p: Placement) => void }) {
  const kindSelect = (
    <Select
      label="Arrangement"
      value={placement.kind}
      options={[
        { value: 'single', label: 'Single' },
        { value: 'radial', label: 'Radial rings' },
        { value: 'grid', label: 'Grid' },
        { value: 'spiral', label: 'Phyllotaxis spiral' },
        { value: 'edge', label: 'Around the edge' },
      ]}
      onChange={(kind) => onChange(defaultPlacement(kind))}
    />
  )

  switch (placement.kind) {
    case 'single': {
      const p = placement
      return (
        <>
          {kindSelect}
          <NumberField label="X" suffix=" mm" value={p.x} min={-1500} max={1500} onChange={(x) => onChange({ ...p, x })} />
          <NumberField label="Y" suffix=" mm" value={p.y} min={-1500} max={1500} onChange={(y) => onChange({ ...p, y })} />
          <NumberField label="Direction" suffix="°" value={p.angle} min={-180} max={180} onChange={(angle) => onChange({ ...p, angle })} />
          <p className="text-xs text-neutral-500">Tip: drag it on the cut layout.</p>
        </>
      )
    }
    case 'radial': {
      const p = placement
      return (
        <>
          {kindSelect}
          <NumberField label="Rings" value={p.rings} min={1} max={12} onChange={(rings) => onChange({ ...p, rings })} />
          <NumberField label="Per ring" value={p.perRing} min={1} max={64} onChange={(perRing) => onChange({ ...p, perRing })} />
          <NumberField label="Extra per ring" value={p.perRingGrowth} min={0} max={24} onChange={(perRingGrowth) => onChange({ ...p, perRingGrowth })} />
          <NumberField label="Inner radius" suffix=" mm" value={p.innerRadius} min={0} max={1200} onChange={(innerRadius) => onChange({ ...p, innerRadius })} />
          <NumberField label="Ring spacing" suffix=" mm" value={p.ringSpacing} min={0} max={600} onChange={(ringSpacing) => onChange({ ...p, ringSpacing })} />
          <NumberField label="Start angle" suffix="°" value={p.startAngle} min={-180} max={180} onChange={(startAngle) => onChange({ ...p, startAngle })} />
          <SegmentedControl label="Pointing" value={p.pointing} options={POINTING} onChange={(pointing) => onChange({ ...p, pointing })} />
          <Checkbox label="Stagger alternate rings" checked={p.staggerRings} onChange={(staggerRings) => onChange({ ...p, staggerRings })} />
          <NumberField label="Scale — inner ring" value={p.scaleInner} min={0.2} max={3} step={0.05} onChange={(scaleInner) => onChange({ ...p, scaleInner })} />
          <NumberField label="Scale — outer ring" value={p.scaleOuter} min={0.2} max={3} step={0.05} onChange={(scaleOuter) => onChange({ ...p, scaleOuter })} />
          <CentreFields p={p} onChange={(c) => onChange({ ...p, ...c })} />
        </>
      )
    }
    case 'grid': {
      const p = placement
      return (
        <>
          {kindSelect}
          <NumberField label="Rows" value={p.rows} min={1} max={40} onChange={(rows) => onChange({ ...p, rows })} />
          <NumberField label="Columns" value={p.cols} min={1} max={40} onChange={(cols) => onChange({ ...p, cols })} />
          <NumberField label="Spacing X" suffix=" mm" value={p.spacingX} min={5} max={500} onChange={(spacingX) => onChange({ ...p, spacingX })} />
          <NumberField label="Spacing Y" suffix=" mm" value={p.spacingY} min={5} max={500} onChange={(spacingY) => onChange({ ...p, spacingY })} />
          <NumberField label="Direction" suffix="°" value={p.angle} min={-180} max={180} onChange={(angle) => onChange({ ...p, angle })} />
          <Checkbox label="Stagger alternate rows" checked={p.stagger} onChange={(stagger) => onChange({ ...p, stagger })} />
          <CentreFields p={p} onChange={(c) => onChange({ ...p, ...c })} />
        </>
      )
    }
    case 'spiral': {
      const p = placement
      return (
        <>
          {kindSelect}
          <NumberField label="Count" value={p.count} min={1} max={400} onChange={(count) => onChange({ ...p, count })} />
          <NumberField label="Spacing" suffix=" mm" value={p.spacing} min={2} max={150} onChange={(spacing) => onChange({ ...p, spacing })} />
          <NumberField label="Skip centre" value={p.startIndex} min={0} max={200} onChange={(startIndex) => onChange({ ...p, startIndex })} />
          <NumberField label="Divergence" suffix="°" value={p.divergence} min={90} max={180} step={0.01} onChange={(divergence) => onChange({ ...p, divergence })} />
          <SegmentedControl label="Pointing" value={p.pointing} options={POINTING} onChange={(pointing) => onChange({ ...p, pointing })} />
          <NumberField label="Scale — centre" value={p.scaleInner} min={0.1} max={3} step={0.05} onChange={(scaleInner) => onChange({ ...p, scaleInner })} />
          <NumberField label="Scale — rim" value={p.scaleOuter} min={0.1} max={3} step={0.05} onChange={(scaleOuter) => onChange({ ...p, scaleOuter })} />
          <CentreFields p={p} onChange={(c) => onChange({ ...p, ...c })} />
        </>
      )
    }
    case 'edge': {
      const p = placement
      return (
        <>
          {kindSelect}
          <NumberField label="Count" value={p.count} min={1} max={80} onChange={(count) => onChange({ ...p, count })} />
          <NumberField label="Phase" value={p.phase} min={0} max={1} step={0.005} onChange={(phase) => onChange({ ...p, phase })} />
          <SegmentedControl
            label="Pointing"
            value={p.pointing}
            options={[
              { value: 'out', label: 'Out' },
              { value: 'in', label: 'In' },
            ]}
            onChange={(pointing) => onChange({ ...p, pointing })}
          />
        </>
      )
    }
  }
}

function CentreFields({ p, onChange }: { p: { cx: number; cy: number }; onChange: (c: { cx: number; cy: number }) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <NumberField label="Centre X" slider={false} value={p.cx} min={-1500} max={1500} onChange={(cx) => onChange({ cx, cy: p.cy })} />
      <NumberField label="Centre Y" slider={false} value={p.cy} min={-1500} max={1500} onChange={(cy) => onChange({ cx: p.cx, cy })} />
    </div>
  )
}
