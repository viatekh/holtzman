import { useDeferredValue, useMemo } from 'react'
import { useDesignStore, type ViewMode } from '../store/designStore'
import { buildDesign } from '../lib/geometry/build'
import { cn } from '../lib/utils'
import { CutCanvas } from '../components/canvas/CutCanvas'
import { FoldView } from '../components/canvas3d/FoldView'
import { SheetPanel } from '../components/panels/SheetPanel'
import { GroupsPanel } from '../components/panels/GroupsPanel'
import { GroupEditor } from '../components/panels/GroupEditor'
import { ExportPanel, FabricationPanel, PresetsPanel } from '../components/panels/InfoPanels'
import { SegmentedControl } from '../components/shared/SegmentedControl'

export function DesignerPage() {
  const design = useDesignStore((s) => s.design)
  const viewMode = useDesignStore((s) => s.viewMode)
  const setViewMode = useDesignStore((s) => s.setViewMode)
  const setName = useDesignStore((s) => s.setName)
  const selectedId = useDesignStore((s) => s.selectedGroupId)
  // Deferred so slider drags stay responsive while a heavy rebuild runs.
  const deferred = useDeferredValue(design)
  const result = useMemo(() => buildDesign(deferred), [deferred])
  const stale = deferred !== design

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 border-b border-neutral-800 px-4 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold tracking-[0.2em] text-purple-300">HOLTZMAN</span>
          <span className="hidden text-xs text-neutral-500 sm:inline">fold-out sheet metal</span>
        </div>
        <input
          value={design.name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm text-neutral-200 outline-none"
          aria-label="Design name"
        />
        <div className="w-56">
          <SegmentedControl<ViewMode>
            value={viewMode}
            options={[
              { value: '2d', label: 'Cut' },
              { value: 'split', label: 'Split' },
              { value: '3d', label: 'Folded' },
            ]}
            onChange={setViewMode}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-neutral-800">
          <PresetsPanel />
          <SheetPanel />
          <GroupsPanel />
          {selectedId && <GroupEditor />}
        </aside>

        <main className={cn('flex min-w-0 flex-1 transition-opacity', stale && 'opacity-90')}>
          {viewMode !== '3d' && (
            <div className={cn('min-w-0', viewMode === 'split' ? 'w-1/2 border-r border-neutral-800' : 'flex-1')}>
              <CutCanvas result={result} />
            </div>
          )}
          {viewMode !== '2d' && (
            <div className={cn('min-w-0', viewMode === 'split' ? 'w-1/2' : 'flex-1')}>
              <FoldView result={result} />
            </div>
          )}
        </main>

        <aside className="w-72 shrink-0 overflow-y-auto border-l border-neutral-800">
          <FabricationPanel result={result} />
          <ExportPanel result={result} />
        </aside>
      </div>
    </div>
  )
}
