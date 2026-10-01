import { useMemo } from 'react'
import { useActivePart, useDesignStore } from '../../store/designStore'
import { defaultFlapShape } from '../../lib/presets'
import { buildFlapLocal } from '../../lib/geometry/shapes'
import { bounds } from '../../lib/geometry/polygon'
import { cn } from '../../lib/utils'
import type { CutoutGroup, CutoutShape, FlapGroup, FlapShape, FlapShapeKind, FoldVariation } from '../../lib/geometry/types'
import { NumberField } from '../shared/NumberField'
import { Select } from '../shared/Select'
import { SegmentedControl } from '../shared/SegmentedControl'
import { Checkbox } from '../shared/Checkbox'
import { Section } from '../shared/Section'
import { PlacementFields } from './PlacementFields'

const FLAP_KINDS: { value: FlapShapeKind; label: string }[] = [
  { value: 'petal', label: 'Petal' },
  { value: 'leaf', label: 'Leaf' },
  { value: 'spike', label: 'Spike' },
  { value: 'flame', label: 'Flame' },
  { value: 'scale', label: 'Scale' },
  { value: 'tab', label: 'Tab' },
]

const TAPER_LABEL: Record<FlapShapeKind, string> = {
  tab: 'Tip width',
  spike: 'Belly',
  leaf: 'Belly',
  petal: 'Bulge',
  scale: 'Flare',
  flame: 'Belly',
}

function FlapThumb({ shape, active }: { shape: FlapShape; active: boolean }) {
  const d = useMemo(() => {
    const pts = buildFlapLocal(shape)
    const b = bounds(pts)
    const s = 26 / Math.max(b.maxX - b.minX, b.maxY - b.minY)
    const cx = (b.minX + b.maxX) / 2
    return pts.map((p, i) => `${i ? 'L' : 'M'}${(16 + (p.x - cx) * s).toFixed(1)} ${(29 - (p.y - b.minY) * s).toFixed(1)}`).join(' ') + 'Z'
  }, [shape])
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8">
      <path d={d} className={active ? 'fill-purple-400/30 stroke-purple-300' : 'fill-neutral-700/40 stroke-neutral-400'} strokeWidth={1.2} />
      <line x1={4} x2={28} y1={29} y2={29} className="stroke-orange-400" strokeDasharray="2 2" strokeWidth={1} />
    </svg>
  )
}

function FlapShapeFields({ shape, onChange }: { shape: FlapShape; onChange: (s: FlapShape) => void }) {
  return (
    <>
      <div className="grid grid-cols-6 gap-1">
        {FLAP_KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            title={k.label}
            onClick={() => onChange({ ...defaultFlapShape(k.value), width: shape.width, length: shape.length })}
            className={cn('flex flex-col items-center rounded-md border p-0.5 text-[10px]', shape.kind === k.value ? 'border-purple-500 text-purple-200' : 'border-neutral-800 text-neutral-500 hover:border-neutral-600')}
          >
            <FlapThumb shape={{ ...defaultFlapShape(k.value) }} active={shape.kind === k.value} />
            {k.label}
          </button>
        ))}
      </div>
      <NumberField label="Hinge width" suffix=" mm" value={shape.width} min={4} max={600} onChange={(width) => onChange({ ...shape, width })} />
      <NumberField label="Length" suffix=" mm" value={shape.length} min={4} max={900} onChange={(length) => onChange({ ...shape, length })} />
      <NumberField label={TAPER_LABEL[shape.kind]} value={shape.taper} min={shape.kind === 'tab' ? 0 : -0.5} max={shape.kind === 'tab' ? 2 : 1.5} step={0.01} onChange={(taper) => onChange({ ...shape, taper })} />
      <NumberField label="Tip roundness" value={shape.roundness} min={0} max={1} step={0.01} onChange={(roundness) => onChange({ ...shape, roundness })} />
      <NumberField label="Curl" suffix="°" value={shape.curl} min={-120} max={120} onChange={(curl) => onChange({ ...shape, curl })} />
    </>
  )
}

function variationDefault(kind: FoldVariation['kind'], angle: number): FoldVariation {
  switch (kind) {
    case 'constant':
      return { kind }
    case 'gradient':
      return { kind, endAngle: Math.min(180, angle + 45) }
    case 'wave':
      return { kind, amplitude: 25, wavelength: 400, direction: 0 }
    case 'random':
      return { kind, spread: 20, seed: 1 }
  }
}

function FoldFields({ group, update }: { group: FlapGroup; update: (p: Partial<FlapGroup>) => void }) {
  const fold = group.fold
  const v = fold.variation
  const setFold = (patch: Partial<FlapGroup['fold']>) => update({ fold: { ...fold, ...patch } })
  return (
    <>
      <NumberField label={v.kind === 'gradient' ? 'Fold angle — first' : 'Fold angle'} suffix="°" value={fold.angle} min={0} max={180} onChange={(angle) => setFold({ angle })} />
      <SegmentedControl
        label="Direction"
        value={fold.direction}
        options={[
          { value: 'up', label: 'Up' },
          { value: 'down', label: 'Down' },
          { value: 'alternate', label: 'Alternate' },
        ]}
        onChange={(direction) => setFold({ direction })}
      />
      <Select
        label="Variation"
        value={v.kind}
        options={[
          { value: 'constant', label: 'Same for every flap' },
          { value: 'gradient', label: 'Gradient (inner → outer)' },
          { value: 'wave', label: 'Wave across the sheet' },
          { value: 'random', label: 'Random' },
        ]}
        onChange={(kind) => setFold({ variation: variationDefault(kind, fold.angle) })}
      />
      {v.kind === 'gradient' && <NumberField label="Fold angle — last" suffix="°" value={v.endAngle} min={0} max={180} onChange={(endAngle) => setFold({ variation: { ...v, endAngle } })} />}
      {v.kind === 'wave' && (
        <>
          <NumberField label="Amplitude" suffix="°" value={v.amplitude} min={0} max={90} onChange={(amplitude) => setFold({ variation: { ...v, amplitude } })} />
          <NumberField label="Wavelength" suffix=" mm" value={v.wavelength} min={20} max={3000} onChange={(wavelength) => setFold({ variation: { ...v, wavelength } })} />
          <NumberField label="Wave direction" suffix="°" value={v.direction} min={-180} max={180} onChange={(direction) => setFold({ variation: { ...v, direction } })} />
        </>
      )}
      {v.kind === 'random' && (
        <>
          <NumberField label="Spread" suffix="°" value={v.spread} min={0} max={90} onChange={(spread) => setFold({ variation: { ...v, spread } })} />
          <NumberField label="Seed" value={v.seed} min={0} max={999} slider={false} onChange={(seed) => setFold({ variation: { ...v, seed } })} />
        </>
      )}
    </>
  )
}

function FlapGroupEditor({ group }: { group: FlapGroup }) {
  const updateGroup = useDesignStore((s) => s.updateGroup)
  const update = (patch: Partial<FlapGroup>) => updateGroup(group.id, patch)
  return (
    <>
      <Section title="Flap shape">
        <SegmentedControl
          label="Attached"
          value={group.attach}
          options={[
            { value: 'inset', label: 'Inside sheet' },
            { value: 'edge', label: 'On the edge' },
          ]}
          onChange={(attach) => update({ attach })}
        />
        <FlapShapeFields shape={group.shape} onChange={(shape) => update({ shape })} />
      </Section>
      <Section title="Arrangement">
        <PlacementFields placement={group.placement} onChange={(placement) => update({ placement })} />
        <Checkbox label="Drop flaps that don’t fit" checked={group.autoPrune} onChange={(autoPrune) => update({ autoPrune })} />
      </Section>
      <Section title="Fold">
        <FoldFields group={group} update={update} />
      </Section>
    </>
  )
}

const CUTOUT_DEFAULTS: Record<CutoutShape['kind'], CutoutShape> = {
  circle: { kind: 'circle', diameter: 40 },
  slot: { kind: 'slot', length: 60, width: 12 },
  polygon: { kind: 'polygon', sides: 6, radius: 25 },
  profile: { kind: 'profile', profile: defaultFlapShape('leaf') },
}

function CutoutGroupEditor({ group }: { group: CutoutGroup }) {
  const updateGroup = useDesignStore((s) => s.updateGroup)
  const update = (patch: Partial<CutoutGroup>) => updateGroup(group.id, patch)
  const shape = group.shape
  return (
    <>
      <Section title="Cutout shape">
        <Select
          label="Shape"
          value={shape.kind}
          options={[
            { value: 'circle', label: 'Circle' },
            { value: 'slot', label: 'Slot' },
            { value: 'polygon', label: 'Polygon' },
            { value: 'profile', label: 'Leaf / petal / spike…' },
          ]}
          onChange={(kind) => update({ shape: structuredClone(CUTOUT_DEFAULTS[kind]) })}
        />
        {shape.kind === 'circle' && <NumberField label="Diameter" suffix=" mm" value={shape.diameter} min={1} max={1000} onChange={(diameter) => update({ shape: { ...shape, diameter } })} />}
        {shape.kind === 'slot' && (
          <>
            <NumberField label="Length" suffix=" mm" value={shape.length} min={2} max={1000} onChange={(length) => update({ shape: { ...shape, length } })} />
            <NumberField label="Width" suffix=" mm" value={shape.width} min={1} max={300} onChange={(width) => update({ shape: { ...shape, width } })} />
          </>
        )}
        {shape.kind === 'polygon' && (
          <>
            <NumberField label="Sides" value={shape.sides} min={3} max={16} onChange={(sides) => update({ shape: { ...shape, sides } })} />
            <NumberField label="Radius" suffix=" mm" value={shape.radius} min={1} max={600} onChange={(radius) => update({ shape: { ...shape, radius } })} />
          </>
        )}
        {shape.kind === 'profile' && <FlapShapeFields shape={shape.profile} onChange={(profile) => update({ shape: { ...shape, profile } })} />}
        <NumberField label="Extra rotation" suffix="°" value={group.rotation} min={-180} max={180} onChange={(rotation) => update({ rotation })} />
      </Section>
      <Section title="Arrangement">
        <PlacementFields placement={group.placement} onChange={(placement) => update({ placement })} />
        <Checkbox label="Drop cutouts that don’t fit" checked={group.autoPrune} onChange={(autoPrune) => update({ autoPrune })} />
      </Section>
    </>
  )
}

export function GroupEditor() {
  const part = useActivePart()
  const selectedId = useDesignStore((s) => s.selectedGroupId)
  const group = part.groups.find((g) => g.id === selectedId)
  if (!group) return null
  return group.type === 'flap' ? <FlapGroupEditor group={group} /> : <CutoutGroupEditor group={group} />
}
