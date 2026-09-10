import React from 'react'
import { Search, ArrowDownWideNarrow } from 'lucide-react'

export type SortKey = 'size' | 'name' | 'modified'

const SORT_LABELS: Record<SortKey, string> = {
  size: 'Largest first',
  name: 'Name (A–Z)',
  modified: 'Newest first',
}

interface Props {
  query: string
  onQuery: (q: string) => void
  sort: SortKey
  onSort: (s: SortKey) => void
  placeholder?: string
  /** Sort options this list actually supports. */
  sortKeys?: SortKey[]
}

export default function ListToolbar({
  query, onQuery, sort, onSort, placeholder = 'Filter by name or path…',
  sortKeys = ['size', 'name', 'modified'],
}: Props) {
  return (
    <div className="flex items-center gap-2 mb-3 shrink-0">
      <div className="flex items-center gap-2 flex-1 min-w-0 px-2.5 h-[30px] rounded-mac-sm bg-white/[0.05] border border-white/[0.08] focus-within:border-white/[0.18]">
        <Search size={13} className="text-white/35 shrink-0" />
        <input
          value={query}
          onChange={e => onQuery(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent outline-none text-[12.5px] text-white placeholder:text-white/30"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery('')}
            className="text-[11px] text-white/35 hover:text-white/70 shrink-0"
          >
            Clear
          </button>
        )}
      </div>

      <label className="flex items-center gap-1.5 px-2.5 h-[30px] rounded-mac-sm bg-white/[0.05] border border-white/[0.08] shrink-0">
        <ArrowDownWideNarrow size={13} className="text-white/35" />
        <select
          value={sort}
          onChange={e => onSort(e.target.value as SortKey)}
          className="bg-transparent outline-none text-[12.5px] text-white/75 cursor-pointer pr-1"
        >
          {sortKeys.map(k => (
            <option key={k} value={k} className="bg-mac-panel text-white">{SORT_LABELS[k]}</option>
          ))}
        </select>
      </label>
    </div>
  )
}
