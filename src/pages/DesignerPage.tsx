import { useMemo, useState } from 'react'
import { LayoutGrid } from 'lucide-react'
import { useActivePart, useDesignStore, type ViewMode } from '../store/designStore'
import { useProjectBuilds } from '../hooks/useBuilds'
import { nestParts } from '../lib/nest'
import { cn } from '../lib/utils'
import { CutCanvas } from '../components/canvas/CutCanvas'
import { NestView } from '../components/canvas/NestView'
import { FoldView } from '../components/canvas3d/FoldView'
import { AssemblyView } from '../components/canvas3d/AssemblyView'
import { SheetPanel } from '../components/panels/SheetPanel'
import { GroupsPanel } from '../components/panels/GroupsPanel'
import { GroupEditor } from '../components/panels/GroupEditor'
import { ExportPanel, FabricationPanel } from '../components/panels/InfoPanels'
import { AssemblyPanel, FormPanel, PartsPanel } from '../components/panels/PartPanels'
import { PresetGallery } from '../components/panels/PresetGallery'
import { SegmentedControl } from '../components/shared/SegmentedControl'

export function DesignerPage() {
  const project = useDesignStore((s) => s.project)
  const part = useActivePart()
  const viewMode = useDesignStore((s) => s.viewMode)
  const setViewMode = useDesignStore((s) => s.setViewMode)
  const setName = useDesignStore((s) => s.setName)
  const selectedId = useDesignStore((s) => s.selectedGroupId)
  const [galleryOpen, setGalleryOpen] = useState(false)

  const { results, placement, stale } = useProjectBuilds(project)
  const result = results.get(part.id) ?? results.values().next().value!
  const nest = useMemo(() => {
    const sheet = project.parts[0].sheet
    return nestParts(project.parts, results, sheet.bed, Math.max(10, sheet.minBridge * 2))
  }, [project.parts, results])

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-800 px-4 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold tracking-[0.2em] text-purple-300">HOLTZMAN</span>
          <span className="hidden text-xs text-neutral-500 lg:inline">fold-out sheet metal</span>
        </div>
        <button
          type="button"
          onClick={() => setGalleryOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-neutral-700 px-2.5 py-1 text-sm text-neutral-200 hover:border-purple-500"
        >
          <LayoutGrid size={14} /> Presets
        </button>
        <input value={project.name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-neutral-200 outline-none" aria-label="Project name" />
        <div className="w-full max-w-md sm:w-auto sm:min-w-96">
          <SegmentedControl<ViewMode>
            value={viewMode}
            options={[
              { value: '2d', label: 'Cut' },
              { value: 'split', label: 'Split' },
              { value: '3d', label: 'Folded' },
              { value: 'assembly', label: 'Assembly' },
              { value: 'nest', label: 'Nest' },
            ]}
            onChange={setViewMode}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-neutral-800">
          <PartsPanel />
          <SheetPanel />
          <FormPanel key={`form-${part.id}`} />
          <GroupsPanel />
          {selectedId && <GroupEditor />}
          <AssemblyPanel key={`asm-${part.id}`} />
        </aside>

        <main className={cn('flex min-w-0 flex-1 transition-opacity', stale && 'opacity-90')}>
          {viewMode === 'assembly' && <AssemblyView results={results} placement={placement} />}
          {viewMode === 'nest' && <NestView nest={nest} results={results} partOrder={project.parts.map((p) => p.id)} />}
          {(viewMode === '2d' || viewMode === 'split') && (
            <div className={cn('min-w-0', viewMode === 'split' ? 'w-1/2 border-r border-neutral-800' : 'flex-1')}>
              <CutCanvas result={result} />
            </div>
          )}
          {(viewMode === '3d' || viewMode === 'split') && (
            <div className={cn('min-w-0', viewMode === 'split' ? 'w-1/2' : 'flex-1')}>
              <FoldView result={result} />
            </div>
          )}
        </main>

        <aside className="w-72 shrink-0 overflow-y-auto border-l border-neutral-800">
          <FabricationPanel result={result} />
          <ExportPanel result={result} nest={nest} results={results} />
        </aside>
      </div>

      {galleryOpen && <PresetGallery onClose={() => setGalleryOpen(false)} />}
    </div>
  )
}
