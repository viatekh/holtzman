import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { defaultArray, defaultForm, newCutoutGroup, newFlapGroup, newPart } from '../lib/presets'
import { defaultProject, PRESETS } from '../lib/presetLibrary'
import { generateId } from '../lib/utils'
import type { AssemblyArray, Design, FeatureGroup, FormConfig, Part, Project, SheetConfig } from '../lib/geometry/types'

export type ViewMode = 'split' | '2d' | '3d' | 'assembly' | 'nest'
export type Orientation = 'flat' | 'standing'

interface DesignState {
  project: Project
  activePartId: string
  selectedGroupId: string | null
  viewMode: ViewMode
  /** 0 = flat cut sheet, 1 = fully folded (and rolled). */
  foldProgress: number
  orientation: Orientation

  setName: (name: string) => void
  // Active-part edits
  updatePart: (patch: Partial<Omit<Part, 'id'>>) => void
  updateSheet: (patch: Partial<SheetConfig>) => void
  setForm: (form: FormConfig) => void
  setArray: (array: AssemblyArray) => void
  updateGroup: (id: string, patch: Partial<FeatureGroup>) => void
  addGroup: (type: FeatureGroup['type']) => void
  removeGroup: (id: string) => void
  duplicateGroup: (id: string) => void
  moveGroup: (id: string, delta: number) => void
  selectGroup: (id: string | null) => void
  // Parts
  addPart: () => void
  duplicatePart: (id: string) => void
  removePart: (id: string) => void
  selectPart: (id: string) => void
  // Whole project
  loadProject: (project: Project) => void
  loadPreset: (presetId: string) => void
  setViewMode: (mode: ViewMode) => void
  setFoldProgress: (v: number) => void
  setOrientation: (o: Orientation) => void
}

/** Accepts a v2 project or a v1 single-sheet design file. */
export function toProject(data: unknown): Project {
  const d = data as Partial<Project> & Partial<Design>
  if (d?.version === 2 && Array.isArray(d.parts) && d.parts.length > 0) return d as Project
  if (d?.version === 1 && d.sheet && Array.isArray(d.groups)) {
    return { version: 2, name: d.name ?? 'Sculpture', parts: [{ id: generateId(), name: d.name ?? 'Part', sheet: d.sheet, groups: d.groups, form: defaultForm(), array: defaultArray() }] }
  }
  throw new Error('Not a Holtzman project file')
}

const initial = defaultProject()

export const useDesignStore = create<DesignState>()(
  persist(
    (set) => {
      const mapActive = (fn: (p: Part) => Part) =>
        set((s) => ({ project: { ...s.project, parts: s.project.parts.map((p) => (p.id === s.activePartId ? fn(p) : p)) } }))

      return {
        project: initial,
        activePartId: initial.parts[0].id,
        selectedGroupId: null,
        viewMode: 'split',
        foldProgress: 1,
        orientation: 'flat',

        setName: (name) => set((s) => ({ project: { ...s.project, name } })),
        updatePart: (patch) => mapActive((p) => ({ ...p, ...patch })),
        updateSheet: (patch) => mapActive((p) => ({ ...p, sheet: { ...p.sheet, ...patch } })),
        setForm: (form) => mapActive((p) => ({ ...p, form })),
        setArray: (array) => mapActive((p) => ({ ...p, array })),
        updateGroup: (id, patch) => mapActive((p) => ({ ...p, groups: p.groups.map((g) => (g.id === id ? ({ ...g, ...patch } as FeatureGroup) : g)) })),
        addGroup: (type) => {
          const id = generateId()
          mapActive((p) => {
            const n = p.groups.filter((g) => g.type === type).length + 1
            const group = type === 'flap' ? newFlapGroup(`Flaps ${n}`) : newCutoutGroup(`Cutouts ${n}`)
            return { ...p, groups: [...p.groups, { ...group, id }] }
          })
          set({ selectedGroupId: id })
        },
        removeGroup: (id) => {
          mapActive((p) => ({ ...p, groups: p.groups.filter((g) => g.id !== id) }))
          set((s) => ({ selectedGroupId: s.selectedGroupId === id ? null : s.selectedGroupId }))
        },
        duplicateGroup: (id) => {
          const newId = generateId()
          mapActive((p) => {
            const i = p.groups.findIndex((g) => g.id === id)
            if (i < 0) return p
            const groups = [...p.groups]
            groups.splice(i + 1, 0, { ...structuredClone(p.groups[i]), id: newId, name: `${p.groups[i].name} copy` })
            return { ...p, groups }
          })
          set({ selectedGroupId: newId })
        },
        moveGroup: (id, delta) =>
          mapActive((p) => {
            const groups = [...p.groups]
            const i = groups.findIndex((g) => g.id === id)
            const j = i + delta
            if (i < 0 || j < 0 || j >= groups.length) return p
            ;[groups[i], groups[j]] = [groups[j], groups[i]]
            return { ...p, groups }
          }),
        selectGroup: (id) => set({ selectedGroupId: id }),

        addPart: () =>
          set((s) => {
            const active = s.project.parts.find((p) => p.id === s.activePartId)
            const part = newPart(`Part ${s.project.parts.length + 1}`)
            // New parts inherit the shop setup of the current one.
            if (active) part.sheet = { ...part.sheet, material: active.sheet.material, thickness: active.sheet.thickness, kerf: active.sheet.kerf, bed: active.sheet.bed, hinge: active.sheet.hinge }
            return { project: { ...s.project, parts: [...s.project.parts, part] }, activePartId: part.id, selectedGroupId: null }
          }),
        duplicatePart: (id) =>
          set((s) => {
            const i = s.project.parts.findIndex((p) => p.id === id)
            if (i < 0) return s
            const copy: Part = { ...structuredClone(s.project.parts[i]), id: generateId(), name: `${s.project.parts[i].name} copy` }
            const parts = [...s.project.parts]
            parts.splice(i + 1, 0, copy)
            return { project: { ...s.project, parts }, activePartId: copy.id, selectedGroupId: null }
          }),
        removePart: (id) =>
          set((s) => {
            if (s.project.parts.length <= 1) return s
            const parts = s.project.parts.filter((p) => p.id !== id)
            return { project: { ...s.project, parts }, activePartId: s.activePartId === id ? parts[0].id : s.activePartId, selectedGroupId: null }
          }),
        selectPart: (id) => set({ activePartId: id, selectedGroupId: null }),

        loadProject: (project) => set({ project, activePartId: project.parts[0].id, selectedGroupId: null, foldProgress: 1 }),
        loadPreset: (presetId) =>
          set((s) => {
            const preset = PRESETS.find((p) => p.id === presetId)
            if (!preset) return s
            // Keep the shop setup (bed, material, kerf, hinge style) — only
            // the artwork changes when switching presets.
            const shop = s.project.parts.find((p) => p.id === s.activePartId)?.sheet
            const project = preset.make()
            if (shop) {
              project.parts = project.parts.map((p) => ({
                ...p,
                sheet: { ...p.sheet, bed: shop.bed, material: shop.material, kerf: shop.kerf, minBridge: shop.minBridge, hinge: { ...shop.hinge } },
              }))
            }
            const multi = project.parts.length > 1 || project.parts[0].array.kind !== 'single'
            return {
              project,
              activePartId: project.parts[0].id,
              selectedGroupId: null,
              foldProgress: 1,
              orientation: preset.view ?? 'flat',
              viewMode: multi ? 'assembly' : s.viewMode === 'assembly' || s.viewMode === 'nest' ? 'split' : s.viewMode,
            }
          }),
        setViewMode: (viewMode) => set({ viewMode }),
        setFoldProgress: (foldProgress) => set({ foldProgress }),
        setOrientation: (orientation) => set({ orientation }),
      }
    },
    {
      name: 'holtzman-design',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ project: s.project, activePartId: s.activePartId, viewMode: s.viewMode, orientation: s.orientation }),
      migrate: (persisted, version) => {
        const p = persisted as { design?: Design; project?: Project; viewMode?: ViewMode; orientation?: Orientation }
        if (version < 2 && p.design) {
          const project = toProject(p.design)
          return { project, activePartId: project.parts[0].id, viewMode: p.viewMode ?? 'split', orientation: p.orientation ?? 'flat' }
        }
        return p
      },
    },
  ),
)

export function useActivePart(): Part {
  return useDesignStore((s) => s.project.parts.find((p) => p.id === s.activePartId) ?? s.project.parts[0])
}
