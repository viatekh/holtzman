import { Copy, Trash2 } from 'lucide-react'
import { useActivePart, useDesignStore } from '../../store/designStore'
import { defaultArray, defaultForm } from '../../lib/presets'
import { instanceCount } from '../../lib/three/partGeometry'
import { DEFAULT_JOINERY } from '../../lib/three/joinery'
import { cn } from '../../lib/utils'
import type { AssemblyArray, FormConfig } from '../../lib/geometry/types'
import { Section } from '../shared/Section'
import { NumberField } from '../shared/NumberField'
import { Select } from '../shared/Select'
import { SegmentedControl } from '../shared/SegmentedControl'
import { Checkbox } from '../shared/Checkbox'

export function PartsPanel() {
  const parts = useDesignStore((s) => s.project.parts)
  const activeId = useDesignStore((s) => s.activePartId)
  const { selectPart, addPart, duplicatePart, removePart, updatePart } = useDesignStore.getState()
  return (
    <Section
      title="Parts"
      headerRight={
        <button type="button" onClick={addPart} className="rounded-md border border-neutral-700 px-2 py-0.5 text-xs text-neutral-300 hover:border-purple-500">
          + Part
        </button>
      }
    >
      <ul className="flex flex-col gap-1">
        {parts.map((p) => (
          <li
            key={p.id}
            onClick={() => selectPart(p.id)}
            className={cn('flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm', p.id === activeId ? 'border-purple-500 bg-purple-500/10' : 'border-neutral-800 hover:border-neutral-600')}
          >
            <input
              value={p.name}
              onFocus={() => selectPart(p.id)}
              onChange={(e) => p.id === activeId && updatePart({ name: e.target.value })}
              className="min-w-0 flex-1 cursor-pointer bg-transparent outline-none focus:cursor-text"
            />
            <span className="text-xs text-neutral-500 tabular-nums">×{instanceCount(p.array)}</span>
            <div className="flex items-center gap-0.5 text-neutral-500" onClick={(e) => e.stopPropagation()}>
              <button type="button" title="Duplicate part" onClick={() => duplicatePart(p.id)} className="hover:text-neutral-200">
                <Copy size={13} />
              </button>
              <button type="button" title="Delete part" disabled={parts.length <= 1} onClick={() => removePart(p.id)} className="hover:text-red-400 disabled:opacity-30">
                <Trash2 size={13} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <JoineryFields />
      <p className="text-xs leading-relaxed text-neutral-500">Each part is one cut file. Copies come from its assembly array; the Nest view packs them all onto beds.</p>
    </Section>
  )
}

function JoineryFields() {
  const joinery = useDesignStore((s) => s.project.joinery ?? DEFAULT_JOINERY)
  const setJoinery = useDesignStore((s) => s.setJoinery)
  return (
    <>
      <Checkbox label="Cut slots where parts pass through each other" checked={joinery.autoSlots} onChange={(autoSlots) => setJoinery({ ...joinery, autoSlots })} />
      {joinery.autoSlots && (
        <NumberField label="Slot clearance" suffix=" mm" value={joinery.clearance} min={0} max={5} step={0.1} onChange={(clearance) => setJoinery({ ...joinery, clearance })} />
      )}
    </>
  )
}

export function FormPanel() {
  const form = useActivePart().form
  const setForm = useDesignStore((s) => s.setForm)
  const roll = form.kind === 'roll' ? form : null
  const set = (patch: Partial<Extract<FormConfig, { kind: 'roll' }>>) => roll && setForm({ ...roll, ...patch })
  return (
    <Section title="Roll into a tube" defaultOpen={form.kind === 'roll'}>
      <SegmentedControl
        value={form.kind}
        options={[
          { value: 'flat', label: 'Stays flat' },
          { value: 'roll', label: 'Rolled' },
        ]}
        onChange={(kind) => setForm(defaultForm(kind))}
      />
      {roll && (
        <>
          <SegmentedControl
            label="Tube axis runs"
            value={roll.axis}
            options={[
              { value: 'vertical', label: 'Up the sheet' },
              { value: 'horizontal', label: 'Across' },
            ]}
            onChange={(axis) => set({ axis })}
          />
          <NumberField label="Wrap" suffix="°" value={roll.wrapDeg} min={10} max={360} onChange={(wrapDeg) => set({ wrapDeg })} />
          <Checkbox label="Seam overlap tabs (full tubes)" checked={roll.seamTabs} onChange={(seamTabs) => set({ seamTabs })} />
          {roll.seamTabs && (
            <>
              <NumberField label="Seam tabs" value={roll.seamTabCount} min={1} max={20} onChange={(seamTabCount) => set({ seamTabCount })} />
              <NumberField label="Tab length" suffix=" mm" value={roll.seamTabLength} min={8} max={100} onChange={(seamTabLength) => set({ seamTabLength })} />
            </>
          )}
          <p className="text-xs leading-relaxed text-neutral-500">
            360° closes a tube; less gives a curved panel. Flaps folded “up” stand out of the tube. Seam tabs tuck under the opposite edge for welding or rivets.
          </p>
        </>
      )}
    </Section>
  )
}

export function AssemblyPanel() {
  const array = useActivePart().array
  const setArray = useDesignStore((s) => s.setArray)
  const kindSelect = (
    <Select
      label="Copies arranged as"
      value={array.kind}
      options={[
        { value: 'single', label: 'Single piece' },
        { value: 'ring', label: 'Ring / column (around an axis)' },
        { value: 'grid', label: 'Tiled wall' },
        { value: 'stack', label: 'Stacked layers' },
      ]}
      onChange={(kind) => setArray(defaultArray(kind))}
    />
  )
  const body = (() => {
    switch (array.kind) {
      case 'single': {
        const a = array
        const set = (patch: Partial<typeof a>) => setArray({ ...a, ...patch } as AssemblyArray)
        return (
          <>
            <div className="grid grid-cols-3 gap-2">
              <NumberField label="X" slider={false} value={a.x} min={-5000} max={5000} onChange={(x) => set({ x })} />
              <NumberField label="Y (up)" slider={false} value={a.y} min={-5000} max={5000} onChange={(y) => set({ y })} />
              <NumberField label="Z" slider={false} value={a.z} min={-5000} max={5000} onChange={(z) => set({ z })} />
            </div>
            <NumberField label="Tilt (X)" suffix="°" value={a.rx} min={-180} max={180} onChange={(rx) => set({ rx })} />
            <NumberField label="Turn (Y)" suffix="°" value={a.ry} min={-180} max={180} onChange={(ry) => set({ ry })} />
            <NumberField label="Spin (Z)" suffix="°" value={a.rz} min={-180} max={180} onChange={(rz) => set({ rz })} />
          </>
        )
      }
      case 'ring': {
        const a = array
        const set = (patch: Partial<typeof a>) => setArray({ ...a, ...patch })
        return (
          <>
            <NumberField label="Copies" value={a.count} min={2} max={36} onChange={(count) => set({ count })} />
            <Checkbox label="Join edges (solve radius so panels meet)" checked={a.joinEdges} onChange={(joinEdges) => set({ joinEdges })} />
            {!a.joinEdges && <NumberField label="Radius" suffix=" mm" value={a.radius} min={0} max={3000} onChange={(radius) => set({ radius })} />}
            <NumberField label="Lean out" suffix="°" value={a.tiltDeg} min={-180} max={180} onChange={(tiltDeg) => set({ tiltDeg })} />
            <NumberField label="Spin each copy" suffix="°" value={a.spinDeg} min={-180} max={180} onChange={(spinDeg) => set({ spinDeg })} />
            <NumberField label="Height off ground" suffix=" mm" value={a.height} min={0} max={4000} onChange={(height) => set({ height })} />
            <Checkbox label="Mirror every other copy" checked={a.alternateMirror} onChange={(alternateMirror) => set({ alternateMirror })} />
          </>
        )
      }
      case 'grid': {
        const a = array
        const set = (patch: Partial<typeof a>) => setArray({ ...a, ...patch })
        return (
          <>
            <NumberField label="Rows" value={a.rows} min={1} max={20} onChange={(rows) => set({ rows })} />
            <NumberField label="Columns" value={a.cols} min={1} max={20} onChange={(cols) => set({ cols })} />
            <Checkbox label="Butt edges together" checked={a.joinEdges} onChange={(joinEdges) => set({ joinEdges })} />
            {!a.joinEdges && (
              <>
                <NumberField label="Spacing X" suffix=" mm" value={a.spacingX} min={10} max={4000} onChange={(spacingX) => set({ spacingX })} />
                <NumberField label="Spacing Y" suffix=" mm" value={a.spacingY} min={10} max={4000} onChange={(spacingY) => set({ spacingY })} />
              </>
            )}
            <Checkbox label="Stagger rows (brick / honeycomb)" checked={a.stagger} onChange={(stagger) => set({ stagger })} />
            <Checkbox label="Flip every other tile" checked={a.alternateFlip} onChange={(alternateFlip) => set({ alternateFlip })} />
          </>
        )
      }
      case 'stack': {
        const a = array
        const set = (patch: Partial<typeof a>) => setArray({ ...a, ...patch })
        return (
          <>
            <NumberField label="Layers" value={a.count} min={1} max={40} onChange={(count) => set({ count })} />
            <NumberField label="Spacer height" suffix=" mm" value={a.spacing} min={5} max={1000} onChange={(spacing) => set({ spacing })} />
            <NumberField label="Twist per layer" suffix="°" value={a.twistDeg} min={-90} max={90} onChange={(twistDeg) => set({ twistDeg })} />
            <NumberField label="Scale per layer" value={a.scaleStep} min={-0.2} max={0.2} step={0.01} onChange={(scaleStep) => set({ scaleStep })} />
            {a.scaleStep !== 0 && <p className="text-xs text-amber-200/80">Scaled layers are each a different cut — the nest exports every size.</p>}
          </>
        )
      }
    }
  })()
  return (
    <Section title="Assembly" defaultOpen={array.kind !== 'single'}>
      {kindSelect}
      {body}
    </Section>
  )
}
