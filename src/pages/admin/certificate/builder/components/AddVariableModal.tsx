import { X } from 'lucide-react'
import { DB_SOURCE_FIELDS, DB_VARIABLE_SOURCES } from '../constants'
import type { useCertificateBuilder } from '../hooks/useCertificateBuilder'

type Builder = ReturnType<typeof useCertificateBuilder>

export function AddVariableModal({ builder }: { builder: Builder }) {
  const { showAddDbVar, setShowAddDbVar, newVarSource, setNewVarSource, newVarLabel, setNewVarLabel, newVarKey, setNewVarKey, newVarDefault, setNewVarDefault, handleAddDbVar, slugify } = builder as any
  if (!showAddDbVar) return null
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowAddDbVar(false)}>
      <div className="w-full max-w-[480px] rounded-2xl bg-[#0a0a0a] p-6 shadow-2xl border border-white/10" onClick={e => e.stopPropagation()}>
        <div className="mb-1 flex items-start justify-between gap-4">
          <h3 className="text-[20px] font-bold leading-tight text-white">Add Database Variable</h3>
          <button type="button" onClick={() => setShowAddDbVar(false)} className="grid size-8 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white" aria-label="Close"><X className="size-4" /></button>
        </div>
        <p className="mb-5 text-[13px] leading-relaxed text-white/60">Define a variable you can drop onto the certificate. Its key is what you type into an element&apos;s content, for example Parent: <span className="font-mono text-white/80">{"{guardian_name}"}</span>.</p>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-white/80">Source *</span>
            <select value={newVarSource} onChange={e => { setNewVarSource(e.target.value); setNewVarLabel(''); setNewVarKey('') }} className="w-full rounded-xl border border-[#262626] bg-[#181818] px-3 py-2.5 text-sm text-white focus:border-lime focus:ring-1 focus:ring-lime">
              {DB_VARIABLE_SOURCES.map((s: string) => <option key={s} value={s}>{s}</option>)}
            </select>
            <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">Pick where the value comes from – this decides which fields are offered below.</p>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-white/80">Variable Name *</span>
            {newVarSource === 'Custom' ? (
              <input value={newVarLabel} onChange={e => { const v=e.target.value; setNewVarLabel(v); if (!newVarKey || newVarKey === slugify(newVarLabel)) setNewVarKey(slugify(v)) }} placeholder="e.g., GPA" className="w-full rounded-xl border border-[#262626] bg-[#181818] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-lime focus:ring-1 focus:ring-lime" />
            ) : (
              <select value={newVarLabel} onChange={e => { const v=e.target.value; setNewVarLabel(v); setNewVarKey(slugify(v)) }} className={`w-full rounded-xl border bg-[#181818] px-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-lime ${!newVarLabel ? 'border-lime ring-1 ring-lime' : 'border-[#262626] focus:border-lime'}`}>
                <option value="">Select a field...</option>
                {(DB_SOURCE_FIELDS[newVarSource] || []).map((f: string) => <option key={f} value={f}>{f}</option>)}
              </select>
            )}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-white/80">Variable Key *</span>
            <input value={newVarKey ? `{${newVarKey}}` : ''} onChange={e => { let v=e.target.value.replace(/^\{+/, '').replace(/\}+$/, '').trim(); setNewVarKey(slugify(v)) }} placeholder="{guardian_name}" className="w-full rounded-xl border border-[#262626] bg-[#181818] px-3 py-2.5 text-sm font-mono text-white placeholder:text-white/30 focus:border-lime focus:ring-1 focus:ring-lime" />
            <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">Auto-built from the name – edit only if you need a custom key.</p>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-white/80">Placeholder Value</span>
            <input value={newVarDefault} onChange={e => setNewVarDefault(e.target.value)} placeholder="Shown on the canvas until real data is merged" className="w-full rounded-xl border border-[#262626] bg-[#181818] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-lime focus:ring-1 focus:ring-lime" />
          </label>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-white/10 pt-4">
          <button type="button" onClick={() => setShowAddDbVar(false)} className="rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-white hover:bg-white/10">Cancel</button>
          <button type="button" onClick={handleAddDbVar} className="rounded-full bg-[#d6ff2a] px-6 py-2 text-sm font-bold text-black hover:bg-[#c8f000]">Add Variable</button>
        </div>
      </div>
    </div>
  )
}
