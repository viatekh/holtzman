import { ArrowDown, ArrowUp, Copy, CircleDashed, Eye, EyeOff, Leaf, Trash2 } from 'lucide-react'
import { useActivePart, useDesignStore } from '../../store/designStore'
import { cn } from '../../lib/utils'
import { Section } from '../shared/Section'

export function GroupsPanel() {
  const groups = useActivePart().groups
  const selectedId = useDesignStore((s) => s.selectedGroupId)
  const { selectGroup, updateGroup, removeGroup, duplicateGroup, moveGroup, addGroup } = useDesignStore.getState()

  return (
    <Section
      title="Features"
      headerRight={
        <div className="flex gap-1">
          <button type="button" onClick={() => addGroup('flap')} className="rounded-md border border-neutral-700 px-2 py-0.5 text-xs text-neutral-300 hover:border-purple-500">
            + Flaps
          </button>
          <button type="button" onClick={() => addGroup('cutout')} className="rounded-md border border-neutral-700 px-2 py-0.5 text-xs text-neutral-300 hover:border-purple-500">
            + Cutouts
          </button>
        </div>
      }
    >
      {groups.length === 0 && <p className="text-xs text-neutral-500">No features yet — add folding flaps or drop-out cutouts.</p>}
      <ul className="flex flex-col gap-1">
        {groups.map((g, i) => {
          const selected = g.id === selectedId
          const Icon = g.type === 'flap' ? Leaf : CircleDashed
          return (
            <li
              key={g.id}
              onClick={() => selectGroup(g.id)}
              className={cn(
                'group flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm',
                selected ? 'border-purple-500 bg-purple-500/10' : 'border-neutral-800 hover:border-neutral-600',
                !g.visible && 'opacity-50',
              )}
            >
              <Icon size={14} className={g.type === 'flap' ? 'text-orange-300' : 'text-sky-300'} />
              <input
                value={g.name}
                onFocus={() => selectGroup(g.id)}
                onChange={(e) => updateGroup(g.id, { name: e.target.value })}
                className="min-w-0 flex-1 cursor-pointer bg-transparent outline-none focus:cursor-text"
              />
              <div className="flex items-center gap-0.5 text-neutral-500" onClick={(e) => e.stopPropagation()}>
                <button type="button" title="Move up" disabled={i === 0} onClick={() => moveGroup(g.id, -1)} className="hover:text-neutral-200 disabled:opacity-30">
                  <ArrowUp size={13} />
                </button>
                <button type="button" title="Move down" disabled={i === groups.length - 1} onClick={() => moveGroup(g.id, 1)} className="hover:text-neutral-200 disabled:opacity-30">
                  <ArrowDown size={13} />
                </button>
                <button type="button" title="Duplicate" onClick={() => duplicateGroup(g.id)} className="hover:text-neutral-200">
                  <Copy size={13} />
                </button>
                <button type="button" title={g.visible ? 'Hide' : 'Show'} onClick={() => updateGroup(g.id, { visible: !g.visible })} className="hover:text-neutral-200">
                  {g.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
                <button type="button" title="Delete" onClick={() => removeGroup(g.id)} className="hover:text-red-400">
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="text-xs leading-relaxed text-neutral-500">Groups higher in the list win when features collide — later ones are dropped or flagged.</p>
    </Section>
  )
}
