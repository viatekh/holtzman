import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export function Section({ title, headerRight, defaultOpen = true, children }: { title: string; headerRight?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="flex flex-col gap-3 border-b border-neutral-800 px-4 py-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-sm font-medium text-neutral-200 hover:text-white" aria-expanded={open}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {title}
        </button>
        {headerRight}
      </div>
      {open && <div className="flex flex-col gap-3">{children}</div>}
    </section>
  )
}
