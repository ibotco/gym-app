import { useEffect, useRef, useState } from 'react'
import { Check, Pipette, X } from 'lucide-react'
import { createPortal } from 'react-dom'

const PRESETS = [
  // Certificate classics — warm parchment / gold family
  { hex: '#FFFEF0', label: 'Cream' },
  { hex: '#FFFFFF', label: 'White' },
  { hex: '#FFF8E1', label: 'Warm Cream' },
  { hex: '#FFF3C4', label: 'Pale Gold' },
  { hex: '#FFECB3', label: 'Soft Gold' },
  { hex: '#F3E8D3', label: 'Parchment' },
  // Pastel elegance
  { hex: '#E8F5E9', label: 'Mint' },
  { hex: '#E3F2FD', label: 'Sky' },
  { hex: '#F3E5F5', label: 'Lavender' },
  { hex: '#FCE4EC', label: 'Blush' },
  { hex: '#FFFDE7', label: 'Ivory' },
  { hex: '#FFEBEE', label: 'Rose' },
  // Neutrals
  { hex: '#EFEBE9', label: 'Warm Gray' },
  { hex: '#ECEFF1', label: 'Cool Gray' },
  { hex: '#F5F5F5', label: 'Light Gray' },
  { hex: '#FAFAFA', label: 'Stone' },
  // Vibrant certificate accents
  { hex: '#D4A017', label: 'Gold' },
  { hex: '#1E40AF', label: 'Royal Blue' },
  { hex: '#065F46', label: 'Emerald' },
  { hex: '#7F1D1D', label: 'Burgundy' },
  { hex: '#1E293B', label: 'Navy' },
  { hex: '#78350F', label: 'Amber Brown' },
  { hex: '#365314', label: 'Forest' },
  { hex: '#581C87', label: 'Plum' },
  // Bright modern
  { hex: '#C8F542', label: 'Lime' },
  { hex: '#38BDF8', label: 'Cyan' },
  { hex: '#FB7185', label: 'Coral' },
  { hex: '#A78BFA', label: 'Violet' },
]

function isValidHex(v: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(v)
}

export function ColorPicker({ value, onChange, label = 'Color' }: { value: string; onChange: (hex: string) => void; label?: string }) {
  const [open, setOpen] = useState(false)
  const [draftHex, setDraftHex] = useState(value || '#FFFEF0')
  const [pos, setPos] = useState({ top: 0, left: 0, width: 280 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const nativeRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraftHex(value || '#FFFEF0') }, [value, open])

  useEffect(() => {
    if (!open) return
    const place = () => {
      const el = btnRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const w = Math.min(320, window.innerWidth - 16)
      const left = Math.min(window.innerWidth - w - 8, Math.max(8, r.left - 8))
      const top = r.bottom + 8
      const flipUp = top + 360 > window.innerHeight && r.top > 360
      setPos({ top: flipUp ? Math.max(8, r.top - 368) : top, left, width: w })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const applyHex = (hex: string) => {
    const h = hex.startsWith('#') ? hex : `#${hex}`
    if (isValidHex(h)) {
      setDraftHex(h.toUpperCase())
      onChange(h.toUpperCase())
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={`${label} ${value}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="group flex w-full items-center gap-2.5 rounded-xl border border-line bg-white px-2.5 py-2 text-left shadow-sm transition hover:border-lime/50 hover:shadow-md dark:bg-zinc-900 dark:hover:border-lime/30"
      >
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg border border-black/10 shadow-inner dark:border-white/10"
          style={{ backgroundColor: value || '#FFFEF0' }}
          aria-hidden
        >
          <span className="size-[10px] rounded-full bg-white/70 opacity-0 group-hover:opacity-100 transition" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold leading-none tracking-wide">{value?.toUpperCase() || '#FFFEF0'}</span>
          <span className="block text-[10px] font-medium uppercase tracking-widest text-mist">{label}</span>
        </span>
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-zinc-900 text-white transition group-hover:bg-black dark:bg-white dark:text-zinc-900">
          <Pipette className="size-3.5" />
        </span>
      </button>

      {open && createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label="Choose color"
          className="fixed z-[100] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_24px_48px_-12px_rgba(0,0,0,0.28),0_12px_24px_-8px_rgba(0,0,0,0.12)] ring-1 ring-black/5 dark:border-white/10 dark:bg-zinc-900"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          {/* Header preview — large swatch with hex */}
          <div className="relative flex items-center gap-3 px-4 py-4" style={{ backgroundColor: draftHex }}>
            <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-black/10" aria-hidden />
            <div className="relative grid size-12 shrink-0 place-items-center rounded-xl bg-white shadow-lg ring-1 ring-black/10 dark:bg-zinc-900">
              <div className="size-8 rounded-lg border border-black/5 shadow-inner" style={{ backgroundColor: draftHex }} />
            </div>
            <div className="relative min-w-0 flex-1">
              <p className="text-sm font-black tracking-tight text-zinc-900 drop-shadow-sm" style={{ color: draftHex === '#FFFFFF' || draftHex === '#FFFEF0' || draftHex === '#FFF8E1' ? '#1a1a1a' : draftHex === '#1E293B' || draftHex === '#065F46' || draftHex === '#7F1D1D' ? '#fff' : undefined }}>{draftHex.toUpperCase()}</p>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-700/80 dark:text-white/80" style={{ color: draftHex === '#FFFFFF' || draftHex === '#FFFEF0' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.9)' }}>Background • Tap a swatch</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="relative grid size-7 place-items-center rounded-full bg-black/10 text-zinc-900 backdrop-blur hover:bg-black/15 dark:bg-white/15 dark:text-white">
              <X className="size-3.5" />
            </button>
          </div>

          {/* Presets grid */}
          <div className="p-3">
            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-mist">Curated — certificate tones</p>
            <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-8">
              {PRESETS.map(p => {
                const active = p.hex.toUpperCase() === (value || '').toUpperCase()
                return (
                  <button
                    key={p.hex}
                    type="button"
                    title={`${p.label} ${p.hex}`}
                    aria-label={`Choose ${p.label} ${p.hex}`}
                    onClick={() => { setDraftHex(p.hex); onChange(p.hex) }}
                    className={`group relative grid aspect-square place-items-center rounded-xl border-2 transition hover:scale-[1.06] hover:shadow-md active:scale-[0.98] ${active ? 'border-lime-500 shadow-md ring-2 ring-lime-200 dark:ring-lime-900' : 'border-zinc-200 hover:border-zinc-300 dark:border-white/10 dark:hover:border-white/20'}`}
                    style={{ backgroundColor: p.hex }}
                  >
                    {active && <Check className="size-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" strokeWidth={3} />}
                    <span className="pointer-events-none absolute -bottom-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-white shadow group-hover:block dark:bg-white dark:text-zinc-900">{p.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Custom controls */}
            <div className="mt-3 grid gap-2 rounded-xl border border-line bg-zinc-50 p-3 dark:bg-white/[0.04]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-mist">Custom</p>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-mist">#</span>
                  <input
                    value={draftHex.replace('#','')}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9a-fA-F]/g,'').slice(0,6)
                      const next = `#${raw}`
                      setDraftHex(next.length===7 ? next.toUpperCase() : next)
                      if (next.length===7 && isValidHex(next.toUpperCase())) onChange(next.toUpperCase())
                    }}
                    placeholder="FFFEF0"
                    maxLength={6}
                    spellCheck={false}
                    className="w-full rounded-lg border border-line bg-white py-2 pl-7 pr-2 font-mono text-sm font-semibold uppercase tracking-wide placeholder:text-mist/40 focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20 dark:bg-zinc-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => nativeRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold shadow-sm hover:border-lime/50 hover:bg-lime/5 dark:bg-zinc-800 dark:hover:bg-white/5"
                >
                  <span className="size-4 rounded-full border border-black/10" style={{ backgroundColor: draftHex }} />
                  Pick
                </button>
                <input ref={nativeRef} type="color" value={isValidHex(value) ? value : '#FFFEF0'} onChange={e => applyHex(e.target.value)} className="sr-only" tabIndex={-1} aria-hidden />
              </div>
              <div className="flex gap-2">
                <div className="h-8 flex-1 rounded-lg border border-black/10 shadow-inner" style={{ background: `linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)` }} aria-hidden />
                <div className="h-8 flex-1 rounded-lg border border-black/10 shadow-inner" style={{ background: `linear-gradient(90deg, #fff, ${draftHex})` }} aria-hidden />
              </div>
              <p className="text-[11px] text-mist">Tip: paste a hex or use <span className="font-semibold text-zinc-900 dark:text-white">Pick</span> for the native eyedropper.</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-line bg-zinc-50 px-3 py-2.5 dark:bg-white/[0.03]">
            <span className="text-[11px] font-medium text-mist">{value?.toUpperCase()}</span>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-black dark:bg-white dark:text-zinc-900">Done</button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
