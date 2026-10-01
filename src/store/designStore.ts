import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { defaultDesign, DESIGN_PRESETS, newCutoutGroup, newFlapGroup } from '../lib/presets'
import { generateId } from '../lib/utils'
import type { Design, FeatureGroup, SheetConfig } from '../lib/geometry/types'

export type ViewMode = 'split' | '2d' | '3d'
export type Orientation = 'flat' | 'standing'

interface DesignState {
  design: Design
  selectedGroupId: string | null
  viewMode: ViewMode
  /** 0 = flat cut sheet, 1 = fully folded. */
  foldProgress: number
  orientation: Orientation

  setName: (name: string) => void
  updateSheet: (patch: Partial<SheetConfig>) => void
  updateGroup: (id: string, patch: Partial<FeatureGroup>) => void
  addGroup: (type: FeatureGroup['type']) => void
  removeGroup: (id: string) => void
  duplicateGroup: (id: string) => void
  moveGroup: (id: string, delta: number) => void
  selectGroup: (id: string | null) => void
  loadDesign: (design: Design) => void
  loadPreset: (presetId: string) => void
  setViewMode: (mode: ViewMode) => void
  setFoldProgress: (v: number) => void
  setOrientation: (o: Orientation) => void
}

export const useDesignStore = create<DesignState>()(
  persist(
    (set) => ({
      design: defaultDesign(),
      selectedGroupId: null,
      viewMode: 'split',
      foldProgress: 1,
      orientation: 'flat',

      setName: (name) => set((s) => ({ design: { ...s.design, name } })),
      updateSheet: (patch) => set((s) => ({ design: { ...s.design, sheet: { ...s.design.sheet, ...patch } } })),
      updateGroup: (id, patch) =>
        set((s) => ({
          design: {
            ...s.design,
            groups: s.design.groups.map((g) => (g.id === id ? ({ ...g, ...patch } as FeatureGroup) : g)),
          },
        })),
      addGroup: (type) =>
        set((s) => {
          const n = s.design.groups.filter((g) => g.type === type).length + 1
          const group = type === 'flap' ? newFlapGroup(`Flaps ${n}`) : newCutoutGroup(`Cutouts ${n}`)
          return { design: { ...s.design, groups: [...s.design.groups, group] }, selectedGroupId: group.id }
        }),
      removeGroup: (id) =>
        set((s) => ({
          design: { ...s.design, groups: s.design.groups.filter((g) => g.id !== id) },
          selectedGroupId: s.selectedGroupId === id ? null : s.selectedGroupId,
        })),
      duplicateGroup: (id) =>
        set((s) => {
          const i = s.design.groups.findIndex((g) => g.id === id)
          if (i < 0) return s
          const copy = { ...structuredClone(s.design.groups[i]), id: generateId(), name: `${s.design.groups[i].name} copy` }
          const groups = [...s.design.groups]
          groups.splice(i + 1, 0, copy)
          return { design: { ...s.design, groups }, selectedGroupId: copy.id }
        }),
      moveGroup: (id, delta) =>
        set((s) => {
          const groups = [...s.design.groups]
          const i = groups.findIndex((g) => g.id === id)
          const j = i + delta
          if (i < 0 || j < 0 || j >= groups.length) return s
          ;[groups[i], groups[j]] = [groups[j], groups[i]]
          return { design: { ...s.design, groups } }
        }),
      selectGroup: (id) => set({ selectedGroupId: id }),
      loadDesign: (design) => set({ design, selectedGroupId: null }),
      loadPreset: (presetId) =>
        set((s) => {
          const preset = DESIGN_PRESETS.find((p) => p.id === presetId)
          if (!preset) return s
          // Keep the shop setup (bed, material, kerf, hinge) — only the
          // artwork changes when switching presets.
          const d = preset.make()
          const { bed, material, thickness, kerf, minBridge, hinge } = s.design.sheet
          return { design: { ...d, sheet: { ...d.sheet, bed, material, thickness, kerf, minBridge, hinge } }, selectedGroupId: null }
        }),
      setViewMode: (viewMode) => set({ viewMode }),
      setFoldProgress: (foldProgress) => set({ foldProgress }),
      setOrientation: (orientation) => set({ orientation }),
    }),
    {
      name: 'holtzman-design',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ design: s.design, viewMode: s.viewMode, orientation: s.orientation }),
    },
  ),
)
