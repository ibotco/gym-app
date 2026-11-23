import { Trash2, UploadCloud } from 'lucide-react'
import { GOOGLE_FONTS } from '../constants'
import type { useCertificateBuilder } from '../hooks/useCertificateBuilder'

type Builder = ReturnType<typeof useCertificateBuilder>

export function PropertiesPanel({ builder }: { builder: Builder }) {
  const { selected, updateSelected, deleteSelected, elements, setElements, setSelectedId, uid } = builder as any
  const getStyle = (el: any) => {
    const s = el?.style || {}
    return {
      fontFamily: s.fontFamily || 'Poppins',
      fontSize: s.fontSize || 16,
      color: s.color || '#1a202c',
      textAlign: s.textAlign || 'center',
      fontWeight: s.fontWeight || '400',
      fontStyle: s.fontStyle || 'normal',
      backgroundColor: s.backgroundColor || 'transparent',
      borderWidth: s.borderWidth ?? 2,
      borderColor: s.borderColor || '#1e293b',
      borderRadius: s.borderRadius ?? 0,
      lineHeight: s.lineHeight,
    }
  }
  // Non-null whenever the style controls below are rendered (they sit inside
  // a `selected ?` branch).
  const style = selected ? getStyle(selected) : getStyle(null)
  return (
    <div className="rounded-xl border border-line bg-card shadow-sm overflow-hidden sticky top-4">
      <div className="flex items-center justify-between border-b border-line bg-muted/30 px-3 py-2.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-foreground">Properties</p>
        {selected ? <span className="rounded-full bg-lime/15 px-2 py-0.5 text-[9px] font-bold uppercase text-lime-800">{selected.type}</span> : <span className="text-[10px] text-mist">No selection</span>}
      </div>
      <div className="p-3">
        {selected ? (
          <div className={`space-y-3 ${['logo','image','badge'].includes(selected.type) ? 'rounded-xl bg-[#0a0a0a] p-3 -m-3 text-white' : ''}`}>
            <label className="block"><span className={`mb-1 block text-[10px] font-bold uppercase tracking-widest ${['logo','image','badge'].includes(selected.type) ? 'text-white/50' : 'text-mist'}`}>Content</span><textarea value={selected.content} onChange={e => updateSelected({ content: e.target.value })} rows={2} placeholder={['logo','image','badge'].includes(selected.type) ? 'Image URL or alt text' : 'Enter text'} className={`w-full rounded-xl border px-3 py-2 text-xs shadow-sm focus:border-lime focus:ring-1 focus:ring-lime ${['logo','image','badge'].includes(selected.type) ? 'border-[#222] bg-[#181818] text-white placeholder:text-white/30' : 'border-line bg-card text-foreground'}`} /></label>
            <label className="block"><span className={`mb-1 block text-[10px] font-bold uppercase tracking-widest ${['logo','image','badge'].includes(selected.type) ? 'text-white/50' : 'text-mist'}`}>Font Family (Google Fonts)</span><select value={style.fontFamily} onChange={e => updateSelected({ style: { fontFamily: e.target.value } })} className={`w-full rounded-xl border px-3 py-2.5 text-sm shadow-sm focus:border-lime focus:ring-1 focus:ring-lime ${['logo','image','badge'].includes(selected.type) ? 'border-[#222] bg-[#181818] text-white' : 'border-line bg-card text-foreground'}`}>{GOOGLE_FONTS.map((f: string) => <option key={f} value={f}>{f}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-2"><label className="block"><span className={`mb-1 block text-[10px] font-bold uppercase tracking-widest ${['logo','image','badge'].includes(selected.type) ? 'text-white/50' : 'text-mist'}`}>Font Size</span><input type="number" value={style.fontSize} onChange={e => updateSelected({ style: { fontSize: Number(e.target.value) } })} className={`w-full rounded-xl border px-3 py-2 text-sm shadow-sm focus:border-lime focus:ring-1 focus:ring-lime ${['logo','image','badge'].includes(selected.type) ? 'border-[#222] bg-[#181818] text-white' : 'border-line bg-card text-foreground'}`} /></label><label className="block"><span className={`mb-1 block text-[10px] font-bold uppercase tracking-widest ${['logo','image','badge'].includes(selected.type) ? 'text-white/50' : 'text-mist'}`}>Color</span><input type="color" value={style.color} onChange={e => updateSelected({ style: { color: e.target.value } })} className={`h-9 w-full rounded-xl border shadow-sm ${['logo','image','badge'].includes(selected.type) ? 'border-[#222] bg-[#181818]' : 'border-line'}`} /></label></div>
            <div className="grid grid-cols-3 gap-1.5">{(['left','center','right'] as const).map(a => <button key={a} type="button" onClick={() => updateSelected({ style: { textAlign: a } })} className={`flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-medium transition ${style.textAlign === a ? 'border-lime bg-lime text-black shadow-sm' : ['logo','image','badge'].includes(selected.type) ? 'border-[#222] bg-[#181818] text-white/60 hover:border-lime/50 hover:text-white' : 'border-line bg-card text-mist hover:border-lime/50 hover:text-foreground'}`}>{a === 'left' ? '≡ left' : a === 'center' ? '≡ center' : '≡ right'}</button>)}</div>
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => { const isBold = style.fontWeight === '700' || style.fontWeight === 'bold' || style.fontWeight === '800'; updateSelected({ style: { fontWeight: isBold ? '400' : '700' } }) }} className={`rounded-xl border px-2 py-2 text-sm font-bold transition ${style.fontWeight === '700' || style.fontWeight === 'bold' || style.fontWeight === '800' ? 'border-lime bg-lime text-black shadow-sm' : ['logo','image','badge'].includes(selected.type) ? 'border-[#222] bg-[#181818] text-white hover:border-lime/50' : 'border-line bg-card text-foreground hover:border-lime/50'}`}>B</button>
              <button type="button" onClick={() => { const isItalic = style.fontStyle === 'italic'; updateSelected({ style: { fontStyle: isItalic ? 'normal' : 'italic' } })}} className={`rounded-xl border px-2 py-2 text-sm italic transition ${style.fontStyle === 'italic' ? 'border-lime bg-lime text-black shadow-sm' : ['logo','image','badge'].includes(selected.type) ? 'border-[#222] bg-[#181818] text-white hover:border-lime/50' : 'border-line bg-card text-foreground hover:border-lime/50'}`}>I</button>
            </div>
            {['logo','image','badge'].includes(selected.type) && (
              <div className="space-y-2">
                <p className="pt-1 text-[10px] font-bold uppercase tracking-widest text-white/50">Background Image</p>
                <label className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-[#222] bg-[#181818] px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:border-lime hover:bg-[#1f1f1f]">
                  <UploadCloud className="size-4 shrink-0 text-white/70" />
                  <span>Select file</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { const result = String(reader.result || ''); updateSelected({ content: result }) }; reader.readAsDataURL(file); e.target.value = '' }} />
                </label>
                <input placeholder="Or paste image URL" value={selected.content} onChange={e => updateSelected({ content: e.target.value })} className="w-full rounded-xl border border-[#222] bg-[#181818] px-3 py-2 text-xs text-white shadow-sm placeholder:text-white/30 focus:border-lime focus:ring-1 focus:ring-lime" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 pt-1"><button type="button" onClick={() => selected && deleteSelected(selected.id)} className={`flex items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition ${['logo','image','badge'].includes(selected.type) ? 'border-[#222] bg-[#181818] text-white hover:border-rose-500 hover:text-rose-400' : 'border-line bg-card text-foreground hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600'}`}><Trash2 className="size-3.5" /> Delete</button><button type="button" onClick={() => { const copy = { ...selected, id: uid(), x: selected.x+20, y: selected.y+20 }; setElements((prev: any[]) => [...prev, copy]); setSelectedId(copy.id) }} className={`rounded-full border px-3 py-2 text-xs font-medium transition ${['logo','image','badge'].includes(selected.type) ? 'border-[#222] bg-[#181818] text-white hover:border-lime hover:text-white' : 'border-line bg-card text-foreground hover:border-lime/50'}`}>Duplicate</button></div>
          </div>
        ) : <div className="rounded-xl border border-dashed border-line bg-muted/20 p-6 text-center"><div className="mx-auto mb-2 grid size-10 place-items-center rounded-full bg-muted"><span className="text-lg">⚙️</span></div><p className="text-[11px] font-medium leading-snug text-foreground">No element selected</p><p className="mt-1 text-[11px] leading-snug text-mist">Select an element on the canvas to edit its text, font, size, color, and alignment. Drag elements to reposition.</p></div>}
      </div>
    </div>
  )
}
