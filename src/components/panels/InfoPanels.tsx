import { CircleAlert, Download, FileJson, Info, TriangleAlert, Upload } from 'lucide-react'
import { useState } from 'react'
import { useDesignStore } from '../../store/designStore'
import { DESIGN_PRESETS } from '../../lib/presets'
import { cn, downloadBlob, downloadJSON, loadJSONFile } from '../../lib/utils'
import { serializeSvg } from '../../lib/export/svg'
import { serializeDxf } from '../../lib/export/dxf'
import type { BuildResult, Design } from '../../lib/geometry/types'
import { Section } from '../shared/Section'
import { Checkbox } from '../shared/Checkbox'

export function PresetsPanel() {
  const loadPreset = useDesignStore((s) => s.loadPreset)
  return (
    <Section title="Start from" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-1.5">
        {DESIGN_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            title={p.blurb}
            onClick={() => loadPreset(p.id)}
            className="rounded-md border border-neutral-800 px-2 py-1.5 text-left text-sm text-neutral-300 hover:border-purple-500"
          >
            <div>{p.name}</div>
            <div className="text-[11px] leading-snug text-neutral-500">{p.blurb}</div>
          </button>
        ))}
      </div>
    </Section>
  )
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-neutral-400">{label}</span>
      <span className={cn('tabular-nums', bad ? 'text-red-400' : 'text-neutral-200')}>{value}</span>
    </div>
  )
}

export function FabricationPanel({ result }: { result: BuildResult }) {
  const { stats, issues } = result
  const fits = stats.fitsBed || stats.fitsBedRotated
  return (
    <Section title="Fabrication">
      <div className="flex flex-col gap-1">
        <Stat label="Part size" value={`${Math.round(stats.widthMm)} × ${Math.round(stats.heightMm)} mm`} bad={!fits} />
        <Stat label="Flaps / cutouts" value={`${stats.flaps} / ${stats.cutouts}`} />
        <Stat label="Cut length" value={`${(stats.cutLengthMm / 1000).toFixed(2)} m`} />
        <Stat label="Pierces" value={String(stats.pierces)} />
        <Stat label="Weight" value={`${stats.weightKg.toFixed(2)} kg`} />
      </div>
      {issues.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {issues.map((i) => {
            const Icon = i.severity === 'error' ? CircleAlert : i.severity === 'warning' ? TriangleAlert : Info
            return (
              <li
                key={i.code}
                className={cn(
                  'flex gap-2 rounded-md px-2 py-1.5 text-xs leading-snug',
                  i.severity === 'error' && 'bg-red-500/10 text-red-300',
                  i.severity === 'warning' && 'bg-amber-500/10 text-amber-200',
                  i.severity === 'info' && 'bg-neutral-800 text-neutral-400',
                )}
              >
                <Icon size={14} className="mt-px shrink-0" />
                {i.message}
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

function slug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sculpture'
}

export function ExportPanel({ result }: { result: BuildResult }) {
  const design = useDesignStore((s) => s.design)
  const loadDesign = useDesignStore((s) => s.loadDesign)
  const [includeBend, setIncludeBend] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const hasErrors = result.issues.some((i) => i.severity === 'error')
  const base = slug(design.name)

  const btn = 'flex items-center justify-center gap-1.5 rounded-md border border-neutral-700 px-2 py-1.5 text-sm text-neutral-200 hover:border-purple-500'

  return (
    <Section title="Export">
      {hasErrors && <p className="text-xs text-red-300">Fix the errors above before cutting — exports still work for review.</p>}
      <Checkbox label="Include bend-line layer" checked={includeBend} onChange={setIncludeBend} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={btn} onClick={() => downloadBlob(new Blob([serializeDxf(result, { includeBend })], { type: 'application/dxf' }), `${base}.dxf`)}>
          <Download size={14} /> DXF
        </button>
        <button type="button" className={btn} onClick={() => downloadBlob(new Blob([serializeSvg(result, { includeBend, name: design.name })], { type: 'image/svg+xml' }), `${base}.svg`)}>
          <Download size={14} /> SVG
        </button>
        <button type="button" className={btn} onClick={() => downloadJSON(design, `${base}.holtzman.json`)}>
          <FileJson size={14} /> Save project
        </button>
        <button
          type="button"
          className={btn}
          onClick={async () => {
            try {
              const data = (await loadJSONFile()) as Design
              if (data?.version !== 1 || !data.sheet || !Array.isArray(data.groups)) throw new Error('Not a Holtzman project file')
              loadDesign(data)
              setLoadError(null)
            } catch (e) {
              setLoadError(e instanceof Error ? e.message : 'Could not load file')
            }
          }}
        >
          <Upload size={14} /> Open project
        </button>
      </div>
      {loadError && <p className="text-xs text-red-300">{loadError}</p>}
      <p className="text-xs leading-relaxed text-neutral-500">
        Paths are kerf centrelines in mm — let your CAM apply kerf compensation. Layer CUT is everything the torch cuts; BEND marks fold lines only.
      </p>
    </Section>
  )
}
