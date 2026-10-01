import { CircleAlert, Download, FileJson, Info, TriangleAlert, Upload } from 'lucide-react'
import { useState } from 'react'
import { useActivePart, useDesignStore, toProject } from '../../store/designStore'
import { nestedPaths, type NestResult } from '../../lib/nest'
import { cn, downloadBlob, downloadJSON, loadJSONFile } from '../../lib/utils'
import { serializeSvg, serializeSvgPaths } from '../../lib/export/svg'
import { serializeDxf, serializeDxfPaths } from '../../lib/export/dxf'
import type { BuildResult } from '../../lib/geometry/types'
import { Section } from '../shared/Section'
import { Checkbox } from '../shared/Checkbox'

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

export function ExportPanel({ result, nest, results }: { result: BuildResult; nest: NestResult; results: Map<string, BuildResult> }) {
  const project = useDesignStore((s) => s.project)
  const part = useActivePart()
  const loadProject = useDesignStore((s) => s.loadProject)
  const [includeBend, setIncludeBend] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (label: string, text: string) => {
    navigator.clipboard.writeText(text).then(
      () => setCopied(`${label} copied — paste into a text editor and save as .${label.toLowerCase()}`),
      () => setCopied('Clipboard blocked here — use the download buttons instead'),
    )
  }
  const hasErrors = result.issues.some((i) => i.severity === 'error')
  const base = slug(project.parts.length > 1 ? `${project.name}-${part.name}` : project.name)
  const nestName = `${slug(project.name)}-nested`
  const nestLayers = includeBend ? (['cut', 'bend', 'sheet'] as const) : (['cut', 'sheet'] as const)
  const nestDxf = () => serializeDxfPaths(nestedPaths(nest, results, includeBend), [...nestLayers])
  const nestSvg = () => {
    const n = Math.max(1, nest.beds.length)
    return serializeSvgPaths(nestedPaths(nest, results, includeBend), n * nest.bed.width + (n - 1) * 100, nest.bed.height, [...nestLayers], project.name)
  }
  const multi = nest.totalCopies > 1

  const btn = 'flex items-center justify-center gap-1.5 rounded-md border border-neutral-700 px-2 py-1.5 text-sm text-neutral-200 hover:border-purple-500'

  return (
    <Section title="Export">
      {hasErrors && <p className="text-xs text-red-300">Fix the errors above before cutting — exports still work for review.</p>}
      <Checkbox label="Include bend-line layer" checked={includeBend} onChange={setIncludeBend} />
      <p className="text-xs font-medium text-neutral-400">This part{project.parts.length > 1 ? ` (${part.name})` : ''}</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={btn} onClick={() => downloadBlob(new Blob([serializeDxf(result, { includeBend })], { type: 'application/dxf' }), `${base}.dxf`)}>
          <Download size={14} /> DXF
        </button>
        <button type="button" className={btn} onClick={() => downloadBlob(new Blob([serializeSvg(result, { includeBend, name: part.name })], { type: 'image/svg+xml' }), `${base}.svg`)}>
          <Download size={14} /> SVG
        </button>
        <button type="button" className={btn} onClick={() => copy('DXF', serializeDxf(result, { includeBend }))}>
          Copy DXF
        </button>
        <button type="button" className={btn} onClick={() => copy('SVG', serializeSvg(result, { includeBend, name: part.name }))}>
          Copy SVG
        </button>
      </div>
      {multi && (
        <>
          <p className="text-xs font-medium text-neutral-400">
            Everything, nested — {nest.totalCopies} pieces on {nest.beds.length} bed{nest.beds.length === 1 ? '' : 's'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={btn} onClick={() => downloadBlob(new Blob([nestDxf()], { type: 'application/dxf' }), `${nestName}.dxf`)}>
              <Download size={14} /> DXF
            </button>
            <button type="button" className={btn} onClick={() => downloadBlob(new Blob([nestSvg()], { type: 'image/svg+xml' }), `${nestName}.svg`)}>
              <Download size={14} /> SVG
            </button>
            <button type="button" className={btn} onClick={() => copy('DXF', nestDxf())}>
              Copy DXF
            </button>
            <button type="button" className={btn} onClick={() => copy('SVG', nestSvg())}>
              Copy SVG
            </button>
          </div>
        </>
      )}
      <p className="text-xs font-medium text-neutral-400">Project</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={btn} onClick={() => downloadJSON(project, `${slug(project.name)}.holtzman.json`)}>
          <FileJson size={14} /> Save project
        </button>
        <button
          type="button"
          className={btn}
          onClick={async () => {
            try {
              loadProject(toProject(await loadJSONFile()))
              setLoadError(null)
            } catch (e) {
              setLoadError(e instanceof Error ? e.message : 'Could not load file')
            }
          }}
        >
          <Upload size={14} /> Open project
        </button>
      </div>
      {copied && <p className="text-xs text-neutral-400">{copied}</p>}
      {loadError && <p className="text-xs text-red-300">{loadError}</p>}
      <p className="text-xs leading-relaxed text-neutral-500">
        Paths are kerf centrelines in mm — let your CAM apply kerf compensation. Layer CUT is everything the torch cuts; BEND marks fold lines only.
      </p>
    </Section>
  )
}
