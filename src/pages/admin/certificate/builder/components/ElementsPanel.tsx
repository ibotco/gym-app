import { ChevronDown, Plus, X } from 'lucide-react'
import { CERT_GROUPS, CERT_GROUP_ICONS, CERT_PALETTE } from '../constants'
import type { useCertificateBuilder } from '../hooks/useCertificateBuilder'

type Builder = ReturnType<typeof useCertificateBuilder>

export function ElementsPanel({ builder }: { builder: Builder }) {
  const {
    elementSearch, setElementSearch,
    expandedGroups, setExpandedGroups,
    customDbVars, hiddenBaseDbLabels, handleRemoveDbVar, handleRemoveBaseDbItem,
    addElement, setShowAddDbVar, clickTimerRef,
  } = builder as any

  const filtered = CERT_PALETTE.filter(item => item.label.toLowerCase().includes(elementSearch.toLowerCase()))
  const filteredCustom = (customDbVars as any[]).filter((v: any) =>
    v.label.toLowerCase().includes(elementSearch.toLowerCase()) ||
    v.key.toLowerCase().includes(elementSearch.toLowerCase())
  )

  if (filtered.length === 0 && filteredCustom.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-card p-3 shadow-sm">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-mist">Elements</p>
        <p className="mb-2 text-[11px] text-mist">Drag to certificate or click to add</p>
        <div className="mb-3">
          <input value={elementSearch} onChange={e => setElementSearch(e.target.value)} placeholder="Search elements..." className="w-full rounded-lg border border-line bg-card px-3 py-1.5 text-xs shadow-sm focus:border-lime focus:ring-1 focus:ring-lime" />
        </div>
        <div className="rounded-xl border border-dashed border-line bg-muted/20 px-3 py-6 text-center text-[11px] text-mist">No elements found</div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-line bg-card p-3 shadow-sm">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-mist">Elements</p>
      <p className="mb-2 text-[11px] text-mist">Drag to certificate or click to add</p>
      <div className="mb-3">
        <input value={elementSearch} onChange={e => setElementSearch(e.target.value)} placeholder="Search elements..." className="w-full rounded-lg border border-line bg-card px-3 py-1.5 text-xs shadow-sm focus:border-lime focus:ring-1 focus:ring-lime" />
      </div>
      <div className="flex flex-col gap-2">
        {CERT_GROUPS.map(group => {
          const isDatabase = group.key === 'database'
          const baseItems = isDatabase
            ? filtered.filter(item => item.group === group.key && !(hiddenBaseDbLabels as string[]).includes(item.label))
            : filtered.filter(item => item.group === group.key)
          const customItems = isDatabase ? filteredCustom : []
          const totalCount = baseItems.length + customItems.length
          if (totalCount === 0) return null
          const Icon = (CERT_GROUP_ICONS as any)[group.key]
          const isExpanded = (expandedGroups as any)[group.key] ?? true
          return (
            <div key={group.key} className="overflow-hidden rounded-xl border border-line bg-card shadow-sm">
              <button type="button" onClick={() => setExpandedGroups((prev: any) => ({ ...prev, [group.key]: !isExpanded }))} className="flex w-full items-center justify-between bg-muted/30 px-3 py-2.5 transition hover:bg-muted/50">
                <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-foreground">
                  {Icon ? <Icon className="size-3.5 text-mist" /> : null}
                  {group.label}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-mist">{totalCount}</span>
                  <ChevronDown className={`size-3 text-mist transition ${isExpanded ? 'rotate-180' : ''}`} />
                </span>
              </button>
              {isExpanded && (
                <div className="space-y-1.5 bg-card p-2">
                  {baseItems.map((item: any) => (
                    <button
                      key={item.type + item.label}
                      draggable
                      onDragStart={e => {
                        e.dataTransfer.setData('text/plain', JSON.stringify({ type: item.type, content: item.defaultContent, group: item.group }))
                        e.dataTransfer.effectAllowed = 'copy'
                      }}
                      onClick={(e: any) => {
                        if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
                        clickTimerRef.current = setTimeout(() => addElement(item.type, item.defaultContent, item.group), 220)
                      }}
                      onDoubleClick={(e) => {
                        e.preventDefault(); e.stopPropagation()
                        if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null }
                        if (isDatabase && confirm(`Remove "${item.label}" from Database Source?\nThis will hide it from the Elements card.`)) handleRemoveBaseDbItem(item.label)
                      }}
                      title={isDatabase ? "Single-click to add to canvas • Double-click to remove from list (with confirmation)" : "Click to add • Drag to canvas"}
                      className="flex w-full cursor-grab items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-left text-sm shadow-sm transition hover:border-lime hover:bg-lime/5 active:cursor-grabbing dark:bg-white/[0.04] dark:border-white/10"
                    >
                      <span className="text-[12px] leading-none opacity-40">⋮⋮</span>
                      <span className="flex-1">{item.label}</span>
                    </button>
                  ))}
                  {isDatabase && customItems.map((v: any) => (
                    <div key={v.id} className="flex items-center gap-1">
                      <button
                        draggable
                        onDragStart={e => {
                          e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'text', content: v.defaultContent, group: 'database', source: v.source }))
                          e.dataTransfer.effectAllowed = 'copy'
                        }}
                        onClick={(e: any) => {
                          if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
                          clickTimerRef.current = setTimeout(() => addElement('text', v.defaultContent, 'database', v.source), 220)
                        }}
                        onDoubleClick={(e) => {
                          e.preventDefault(); e.stopPropagation()
                          if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null }
                          if (confirm(`Remove custom variable "${v.label}"?\nThis will hide it from the Elements card.`)) handleRemoveDbVar(v.id)
                        }}
                        title="Single-click to add to canvas • Double-click to remove from list (with confirmation) • Drag to place"
                        className="flex flex-1 cursor-grab items-center gap-2 rounded-lg border border-lime/30 bg-lime/5 px-3 py-2.5 text-left text-sm shadow-sm transition hover:border-lime hover:bg-lime/10 active:cursor-grabbing"
                      >
                        <span className="text-[12px] leading-none opacity-40">⋮⋮</span>
                        <span className="flex flex-1 flex-col leading-tight">
                          <span className="font-medium">{v.label}</span>
                          <span className="text-[10px] text-mist">{"{{"}{v.key}{"}}"}</span>
                        </span>
                        <span className="rounded-full bg-lime px-1.5 py-0.5 text-[8px] font-bold uppercase text-black">var</span>
                      </button>
                      <button type="button" onClick={() => handleRemoveDbVar(v.id)} className="grid size-7 place-items-center rounded-lg border border-line bg-card text-mist hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600" title="Remove variable"><X className="size-3" /></button>
                    </div>
                  ))}
                  {isDatabase && (
                    <button type="button" onClick={() => setShowAddDbVar(true)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-lime/40 bg-lime/10 px-3 py-2.5 text-xs font-bold text-lime-800 hover:bg-lime/20 dark:text-lime-200 transition">
                      <Plus className="size-3.5" /> Add Variable
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
