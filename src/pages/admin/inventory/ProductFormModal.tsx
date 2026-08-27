import { useState, useMemo, useRef, useEffect, useCallback, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  Info, Plus, UploadCloud, PackageOpen, Settings2, Tag, Percent,
  Layers, FileText, AlertTriangle, ToggleLeft, Check, ChevronDown, X,
  Trash2, Search,
} from 'lucide-react'
import { Modal, Input, Select } from '../../../components/ui'
import { cn } from '../../../lib/utils'
import type { InvCategory, InvBrand, InvUnit } from './invSeed'
import { categoryLabel } from './invSeed'
import { loadCategories, loadBrands, loadUnits, loadVariations } from './invStorage'
import type { InvVariation } from './invStorage'

// ---------------------------------------------------------------------------
// Add / Edit Product form (Perfex / AdminLTE styling).
// Clean three-column top, carded sections with subtle legends, consistent
// 34px inputs, proper focus rings, styled "Browse…" file pickers, chip-tag
// Business Locations multi-select, and polished coloured footer buttons.
// ---------------------------------------------------------------------------

export type ProductFormValues = {
  name: string
  sku: string
  barcodeType: string
  unitId: number | ''
  brandId: number | ''
  categoryId: number | ''
  locations: string[]
  manageStock: boolean
  alertQuantity: string
  description: string
  imageName: string
  brochureName: string
  enableImei: boolean
  notForSelling: boolean
  weight: string
  prepTime: string
  taxName: string
  sellingPriceTaxType: 'Exclusive' | 'Inclusive'
  productType: 'Single' | 'Variable' | 'Combo' | 'Service'
  purchaseExc: string
  purchaseInc: string
  marginPct: string
  sellingExc: string
  sellingImageName: string
  variationSkuFormat: 'sku-number' | 'sku-variation'
  variationRows: VariationRow[]
  comboItems: ComboItem[]
}

// Minimal product shape used by Combo product search.
export type ComboProductOption = {
  id: number
  name: string
  sku: string
  purchasePrice: number
}

type VariationRow = {
  id: number
  variationId: number | ''
  values: VariationValueRow[]
}
type VariationValueRow = {
  id: number
  valueName: string
  sku: string
  purchaseExc: string
  purchaseInc: string
  marginPct: string
  sellingExc: string
  imageName: string
}
type ComboItem = {
  id: number
  productId: number | ''
  productName: string
  quantity: string
  purchasePrice: string
}

const emptyForm = (defaults?: Partial<ProductFormValues>): ProductFormValues => ({
  name: '',
  sku: '',
  barcodeType: 'C128',
  unitId: '',
  brandId: '',
  categoryId: '',
  locations: [],
  manageStock: false,
  alertQuantity: '',
  description: '',
  imageName: '',
  brochureName: '',
  enableImei: false,
  notForSelling: false,
  weight: '',
  prepTime: '',
  taxName: '',
  sellingPriceTaxType: 'Exclusive',
  productType: 'Single',
  purchaseExc: '',
  purchaseInc: '',
  marginPct: '25.00',
  sellingExc: '',
  sellingImageName: '',
  variationSkuFormat: 'sku-number',
  variationRows: [],
  comboItems: [],
  ...defaults,
})

const BARCODE_TYPES = [
  { v: 'C128',  l: 'Code 128 (C128)' },
  { v: 'C39',   l: 'Code 39 (C39)' },
  { v: 'EAN13', l: 'EAN-13' },
  { v: 'EAN8',  l: 'EAN-8' },
  { v: 'UPCA',  l: 'UPC-A' },
  { v: 'UPCE',  l: 'UPC-E' },
]

const Req = () => <span className="ml-0.5 text-red-500 font-bold">*</span>

// Solid cyan (i) info icon with a Bootstrap-5-style white card tooltip
// rendered via createPortal to document.body so it can never be clipped
// by overflow-hidden ancestors or modal stacking contexts.
function Tip({ text, muted }: { text: React.ReactNode; muted?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const iconRef = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, placed: false })
  const enterTimer = useRef<number | null>(null)
  const leaveTimer = useRef<number | null>(null)

  const clearTimers = () => {
    if (enterTimer.current) { window.clearTimeout(enterTimer.current); enterTimer.current = null }
    if (leaveTimer.current) { window.clearTimeout(leaveTimer.current); leaveTimer.current = null }
  }
  const show = () => { clearTimers(); enterTimer.current = window.setTimeout(() => setOpen(true), 120) }
  const hide = () => { clearTimers(); leaveTimer.current = window.setTimeout(() => setOpen(false), 80) }

  const updatePos = useCallback(() => {
    if (!iconRef.current) return
    const r = iconRef.current.getBoundingClientRect()
    setPos({ top: r.top, left: r.left + r.width / 2, placed: true })
  }, [])

  useLayoutEffect(() => {
    if (!open) { setPos((p) => ({ ...p, placed: false })); return }
    const id = requestAnimationFrame(() => updatePos())
    return () => cancelAnimationFrame(id)
  }, [open, updatePos])

  useEffect(() => {
    if (!open) return
    const onRepos = () => updatePos()
    window.addEventListener('scroll', onRepos, true)
    window.addEventListener('resize', onRepos)
    return () => {
      window.removeEventListener('scroll', onRepos, true)
      window.removeEventListener('resize', onRepos)
    }
  }, [open, updatePos])

  useEffect(() => () => clearTimers(), [])

  return (
    <span
      ref={iconRef}
      className="pf-tip-trigger"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="inline-block size-[15px] -mt-0.5 ml-1 align-middle text-[#17c0eb] cursor-help"
        fill="currentColor"
      >
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm.85 5.15a1.15 1.15 0 1 1-2.3 0 1.15 1.15 0 0 1 2.3 0Zm-1.05 3.1c.55 0 1 .45 1 1v5.4c0 .55-.45 1-1 1s-1-.45-1-1v-5.4c0-.55.45-1 1-1Z" />
      </svg>
      {open && pos.placed && createPortal(
        <div
          role="tooltip"
          className="pf-tip-card bs-tooltip-top"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform: 'translate(-50%, calc(-100% - 8px))',
            zIndex: 2147483647,
          }}
        >
          <div className="tooltip-arrow pf-tip-arrow" />
          <div className="tooltip-inner pf-tip-inner">
            <div>{text}</div>
            {muted && <div className="pf-tip-muted">{muted}</div>}
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
}

const InlineTip = ({ text, muted }: { text: React.ReactNode; muted?: React.ReactNode }) => <Tip text={text} muted={muted} />

// Match the Add Brand / Add Category / Add Unit modals: 42px height, 15px text,
// 8px radius, grey border — the same look the custom <Select> renders for the
// Status field in those modals.
const baseInputCls =
  'w-full h-[42px] px-3 text-[15px] rounded-[8px] bg-white dark:bg-[#14171c] ' +
  'text-[#16325c] dark:text-slate-100 ' +
  'transition focus:outline-none focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30 ' +
  'placeholder:text-[#9aa0a6] disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800'

const inputCls = baseInputCls + ' border border-[#9aa0a6] dark:border-[#49515c]'

function SectionCard({
  icon: Icon, title, subtitle, children,
}: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string; children: React.ReactNode }) {
  // In the Perfex screenshot these are simple horizontal section headers,
  // not separate bordered cards. Render a thin dark-blue divider with a
  // small icon + bold label, matching AdminLTE's fieldset look.
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-1.5 mb-3">
        <Icon className="size-4 text-[#337ab7]" />
        <h3 className="text-[14px] font-bold text-[#16325c] dark:text-slate-100 tracking-wide uppercase">{title}</h3>
        {subtitle && <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal normal-case">— {subtitle}</span>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function FieldLabel({ children, required, hint, hintText, hintMuted, className }: { children: React.ReactNode; required?: boolean; hint?: boolean; hintText?: React.ReactNode; hintMuted?: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block text-[15px] font-semibold mb-1.5 text-[#16325c] dark:text-slate-200', className)}>
      {children}{required && <Req />}{hint && <Tip text={hintText || ''} muted={hintMuted} />}
    </label>
  )
}

// Small blue circular "+" quick-add button used next to selects (Unit, Brand).
// Circle vertically centered alongside the 42px select.
function QuickAddBtn({ className, onClick }: { className?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      title="Add new"
      onClick={onClick}
      style={{ backgroundColor: '#337ab7', borderColor: '#2e6da4' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#286090')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#337ab7')}
      onMouseDown={(e) => (e.currentTarget.style.backgroundColor = '#204d74')}
      onMouseUp={(e) => (e.currentTarget.style.backgroundColor = '#286090')}
      onBlur={(e) => (e.currentTarget.style.backgroundColor = '#337ab7')}
      className={cn(
        'inline-flex size-[28px] shrink-0 self-center items-center justify-center rounded-full ' +
        'text-white border shadow-sm transition hover:shadow',
        className,
      )}>
      <Plus className="size-4" strokeWidth={3} />
    </button>
  )
}

// Select + small blue "+" quick-add side-by-side (Perfex style).
// The select takes all remaining width; the circle sits ~6px to its right.
function SelectWithAdd({
  id, error, children, onAdd,
}: {
  id?: string
  error?: boolean
  children: React.ReactNode
  onAdd?: () => void
}) {
  return (
    <div id={id} className="flex items-stretch gap-[6px]">
      <div className={cn('flex-1 min-w-0', error && '[&_.nice-select-control]:!border-red-500 [&_.nice-select-control.is-open]:!shadow-[0_0_0_1px_#ef4444]')}>
        {children}
      </div>
      <QuickAddBtn onClick={onAdd} />
    </div>
  )
}

function FilePicker({
  buttonColor = '#286090', accept, fileName, hint, label, onChange,
}: {
  buttonColor?: string; accept?: string; fileName: string; hint?: React.ReactNode; label?: string
  onChange: (name: string, file: File | null) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <div className="flex items-stretch overflow-hidden rounded-[8px] border border-[#9aa0a6] dark:border-[#49515c] bg-white dark:bg-[#14171c] h-[42px]">
        <div className="flex-1 flex items-center gap-2 px-3 text-[13px] text-slate-500 dark:text-slate-400 min-w-0">
          {fileName
            ? (<><FileText className="size-3.5 text-emerald-500 shrink-0" /><span className="truncate">{fileName}</span></>)
            : (<><UploadCloud className="size-3.5 shrink-0" /><span className="italic text-[#7b8794]">No file selected</span></>)}
        </div>
        <button type="button" onClick={() => ref.current?.click()}
          className="h-full px-3 text-[12px] font-semibold text-white transition"
          style={{ background: buttonColor }}
          onMouseEnter={(e) => { if (buttonColor === '#286090') e.currentTarget.style.background = '#204d74'; else if (buttonColor === '#00a65a') e.currentTarget.style.background = '#008d4c'; }}
          onMouseLeave={(e) => (e.currentTarget.style.background = buttonColor)}>
          Browse…
        </button>
        <input ref={ref} type="file" accept={accept} className="hidden"
          onChange={(e) => onChange(e.target.files?.[0]?.name || '', e.target.files?.[0] || null)} />
      </div>
      {hint && <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  )
}

// Compact file picker for variation image cells (browse button + filename, 38px tall).
function VariationImagePicker({ fileName, onChange }: { fileName: string; onChange: (n: string, f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <div className="flex items-stretch overflow-hidden rounded-[4px] border border-[#9aa0a6] dark:border-[#49515c] bg-white dark:bg-[#14171c] h-[38px]">
        <button type="button" onClick={() => ref.current?.click()}
          className="h-full px-3 text-[12px] font-semibold text-white transition hover:brightness-110"
          style={{ background: '#428bca', borderRadius: '3px 0 0 3px' }}>
          Browse...
        </button>
        <div className="flex-1 flex items-center gap-2 px-2 text-[12px] text-slate-600 dark:text-slate-300 min-w-0 border-l border-[#9aa0a6] dark:border-[#49515c]">
          {fileName
            ? (<><FileText className="size-3.5 text-emerald-500 shrink-0" /><span className="truncate">{fileName}</span></>)
            : (<span className="text-slate-500 dark:text-slate-400">No files selected.</span>)}
        </div>
        <input ref={ref} type="file" accept="image/*" className="hidden"
          onChange={(e) => onChange(e.target.files?.[0]?.name || '', e.target.files?.[0] || null)} />
      </div>
    </div>
  )
}

// Small blue tag used to show selected items inside the MultiSelect.
function SelectedTag({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[3px] bg-[#337ab7] px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm max-w-full">
      <span className="truncate">{children}</span>
      <button type="button" onClick={onRemove} className="ml-0.5 -mr-0.5 grid size-3.5 place-items-center rounded-sm text-white/80 hover:bg-white/20 hover:text-white" aria-label="Remove">
        <X className="size-2.5" strokeWidth={3} />
      </button>
    </span>
  )
}

// MultiSelect: a tag-style dropdown multi-select that mirrors the single
// Select look (42px, 8px radius, #9aa0a6 border, Perfex-blue focus) but
// allows multiple selection. Selected options are shown as blue pills with
// an ×; the dropdown contains checkboxes + option labels, plus a search box
// when there are many options. Options render on top of the modal because
// the menu uses z-index 2147483647 (same fix as the single Select).
type MultiOption = { value: string; label: string }
function MultiSelect({
  options, value, onChange, placeholder = 'Select...', error,
}: {
  options: MultiOption[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  error?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 280 })

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const selectedSet = useMemo(() => new Set(value), [value])
  const filtered = useMemo(() => {
    const t = query.trim().toLowerCase()
    if (!t) return options
    return options.filter((o) => o.label.toLowerCase().includes(t))
  }, [options, query])

  const toggle = (val: string) => {
    if (selectedSet.has(val)) onChange(value.filter((x) => x !== val))
    else onChange([...value, val])
  }
  const remove = (val: string) => onChange(value.filter((x) => x !== val))
  const clearAll = () => { onChange([]); setQuery('') }

  const openMenu = () => { setOpen(true); setQuery('') }
  const closeMenu = () => setOpen(false)

  useEffect(() => {
    if (open) {
      const frame = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(frame)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const el = boxRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const gap = 2
      const want = Math.min(320, Math.max(filtered.length + 1, 2) * 36 + 44)
      const below = window.innerHeight - r.bottom - 8
      const above = r.top - 8
      const openUp = below < 160 && above > below
      const maxHeight = Math.max(140, openUp ? above : below)
      const height = Math.min(want, maxHeight)
      setPos({
        top: openUp ? r.top - height - gap : r.bottom + gap,
        left: r.left,
        width: r.width,
        maxHeight: height,
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, filtered.length])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (boxRef.current?.contains(t) || menuRef.current?.contains(t)) return
      closeMenu()
    }
    document.addEventListener('mousedown', onDown)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMenu() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={boxRef} className="relative w-full">
      <button
        type="button"
        onClick={() => (open ? closeMenu() : openMenu())}
        className={cn(
          'flex w-full min-h-[42px] items-center gap-1.5 flex-wrap rounded-[8px] border bg-white dark:bg-[#14171c] px-2.5 py-1.5 text-left transition focus:outline-none',
          error
            ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/20'
            : 'border-[#9aa0a6] dark:border-[#49515c] hover:border-[#337ab7] focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30',
          open && !error && 'border-[#337ab7] ring-1 ring-[#337ab7]/30',
        )}>
        {value.length === 0 && (
          <span className="px-0.5 text-[15px] text-[#9aa0a6] font-normal">{placeholder}</span>
        )}
        {value.map((v) => {
          const opt = options.find((o) => o.value === v)
          if (!opt) return null
          return <SelectedTag key={v} onRemove={() => remove(v)}>{opt.label}</SelectedTag>
        })}
        {value.length > 0 && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); clearAll() }}
            className="ml-auto mr-1 grid size-5 place-items-center rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            title="Clear all"
          >
            <X className="size-3.5" strokeWidth={2.5} />
          </span>
        )}
        <ChevronDown className={cn('ml-auto size-4 text-slate-500 dark:text-slate-400 transition', open && 'rotate-180')} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
          className="fixed z-[2147483647] overflow-hidden rounded-[8px] border border-slate-300 dark:border-zinc-600 bg-white dark:bg-[#1b1f24] shadow-xl"
        >
          {options.length > 5 && (
            <div className="border-b border-slate-200 dark:border-zinc-700 p-1.5">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full h-[30px] px-2 rounded border border-slate-300 dark:border-zinc-600 bg-white dark:bg-[#14171c] text-[13px] text-[#16325c] dark:text-slate-100 focus:outline-none focus:border-[#337ab7]"
              />
            </div>
          )}
          <div className="overflow-y-auto py-1" style={{ maxHeight: options.length > 5 ? pos.maxHeight - 50 : pos.maxHeight }}>
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-[13px] text-slate-400 italic">No matches</div>
            )}
            {filtered.map((o) => {
              const on = selectedSet.has(o.value)
              return (
                <button
                  type="button"
                  key={o.value}
                  onMouseDown={(e) => { e.preventDefault(); toggle(o.value) }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] transition',
                    on ? 'bg-[#337ab7]/10 text-[#16325c] dark:text-slate-100 font-semibold' : 'text-[#16325c] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
                  )}>
                  <span className={cn(
                    'grid size-[16px] shrink-0 place-items-center rounded-[3px] border transition',
                    on ? 'border-[#337ab7] bg-[#337ab7] text-white' : 'border-slate-400 dark:border-zinc-500 bg-white dark:bg-[#14171c]'
                  )}>
                    {on && <Check className="size-3" strokeWidth={3.5} />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              )
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode }) {
  return (
    <label className="inline-flex items-start gap-2 cursor-pointer select-none">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-[20px] w-9 shrink-0 items-center rounded-full transition-colors mt-0.5',
          checked ? 'bg-[#337ab7]' : 'bg-slate-300 dark:bg-slate-600')}>
        <span className={cn(
          'inline-block size-4 rounded-full bg-white shadow transform transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        )} />
      </button>
      <span className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">{label}</span>
    </label>
  )
}

function RichTextArea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="rounded-[3px] border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
      {/* Menubar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2.5 py-1 text-[11px] text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        {['My Favorites', 'File', 'Edit', 'View', 'Insert', 'Format', 'Tools', 'Table', 'Help'].map((m) => (
          <button key={m} type="button" className="hover:text-slate-900 dark:hover:text-white">{m}</button>
        ))}
      </div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
        {[['↶','Undo'],['↷','Redo']].map(([c,t]) => (
          <button key={t} type="button" title={t} className="size-7 grid place-items-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-[13px] text-slate-700 dark:text-slate-200">{c}</button>
        ))}
        <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-600" />
        <select className="h-7 text-[12px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-1">
          <option>Paragraph</option><option>Heading 1</option><option>Heading 2</option>
        </select>
        <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-600" />
        {[['<b>B</b>','Bold'],['<i>I</i>','Italic'],['<u>U</u>','Underline']].map(([c,t]) => (
          <button key={t} type="button" title={t} className="size-7 grid place-items-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-[12px] font-bold text-slate-700 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: c }} />
        ))}
        <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-600" />
        {['≡','≡≡','☰','☰≡','⋯'].map((c,i) => (
          <button key={i} type="button" className="size-7 grid place-items-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-[13px] text-slate-700 dark:text-slate-200">{c}</button>
        ))}
        <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-600" />
        <button type="button" title="Link" className="size-7 grid place-items-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-[13px] text-slate-700 dark:text-slate-200">🔗</button>
        <button type="button" title="Image" className="size-7 grid place-items-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-[13px] text-slate-700 dark:text-slate-200">🖼</button>
        <button type="button" title="Source" className="size-7 grid place-items-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-[13px] text-slate-700 dark:text-slate-200">⌨</button>
        <select className="h-7 text-[12px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-1 ml-1">
          <option>A</option><option>Arial</option><option>Verdana</option>
        </select>
      </div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full min-h-[110px] p-3 text-[13px] bg-transparent focus:outline-none resize-y text-slate-800 dark:text-slate-100"
        placeholder="" />
      <div className="px-3 py-1 text-right text-[10px] text-slate-400 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
        {value.trim().split(/\s+/).filter(Boolean).length} WORDS POWERED BY TINY
      </div>
    </div>
  )
}

export function ProductFormModal({
  open, onClose, onSave, initial,
  categories, brands, units, taxes, branches,
  products = [],
}: {
  open: boolean
  onClose: () => void
  onSave: (v: ProductFormValues) => void
  initial?: Partial<ProductFormValues>
  categories: InvCategory[]
  brands: InvBrand[]
  units: InvUnit[]
  taxes: string[]
  branches: { id: string; name: string; code?: string }[]
  products?: ComboProductOption[]
}) {
  const navigate = useNavigate()
  const [v, setV] = useState<ProductFormValues>(() => emptyForm(initial))
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Local live copies of the settings tables, reloaded from localStorage each
  // time the modal opens so Unit / Brand / Category reflect any recent edits
  // made in the settings pages.
  const [liveCats, setLiveCats] = useState<InvCategory[]>(categories)
  const [liveBrands, setLiveBrands] = useState<InvBrand[]>(brands)
  const [liveUnits, setLiveUnits] = useState<InvUnit[]>(units)
  const [liveVariations, setLiveVariations] = useState<InvVariation[]>([])
  const [nextVarRowId, setNextVarRowId] = useState(1)
  const [nextValRowId, setNextValRowId] = useState(1)
  const [nextComboId, setNextComboId] = useState(1)
  const [comboQuery, setComboQuery] = useState('')
  const [comboSearchOpen, setComboSearchOpen] = useState(false)
  const comboSearchRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setLiveCats(categories) }, [categories])
  useEffect(() => { setLiveBrands(brands) }, [brands])
  useEffect(() => { setLiveUnits(units) }, [units])

  useEffect(() => {
    if (open) {
      setV(emptyForm(initial)); setErrors({})
      setLiveCats(loadCategories())
      setLiveBrands(loadBrands())
      setLiveUnits(loadUnits())
      setLiveVariations(loadVariations())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // While the modal is open, listen for localStorage changes (e.g. the user
  // adds/deactivates a unit/brand/category in another tab or via a quick-add
  // flow) so the dropdown options stay in sync with the settings tables.
  const refreshFromStorage = useCallback(() => {
    setLiveCats(loadCategories())
    setLiveBrands(loadBrands())
    setLiveUnits(loadUnits())
    setLiveVariations(loadVariations())
  }, [])
  useEffect(() => {
    if (!open) return
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return refreshFromStorage()
      if (e.key === 'fitpro_inv_categories' ||
          e.key === 'fitpro_inv_brands' ||
          e.key === 'fitpro_inv_units' ||
          e.key === 'fitpro_inv_variations') refreshFromStorage()
    }
    window.addEventListener('storage', onStorage)
    // Also listen to a custom event dispatched by our own settings CRUDs
    // (same-tab sync — `storage` event does not fire in the same tab).
    const onInv = () => refreshFromStorage()
    window.addEventListener('fitpro-inv-settings-changed', onInv)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('fitpro-inv-settings-changed', onInv)
    }
  }, [open, refreshFromStorage])

  const set = <K extends keyof ProductFormValues>(k: K, val: ProductFormValues[K]) =>
    setV((s) => ({ ...s, [k]: val }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!v.name.trim()) e.name = 'Name is required'
    if (v.unitId === '') e.unitId = 'Unit is required'
    if (v.categoryId === '') e.categoryId = 'Category is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const save = (then: 'close' | 'another') => { if (validate()) { onSave(v); if (then === 'another') setV(emptyForm()); else onClose() } }

  const activeCats   = useMemo(() => liveCats.filter((c) => c.status === 'Active'), [liveCats])
  const activeBrands = useMemo(() => liveBrands.filter((b) => b.status === 'Active'), [liveBrands])
  const activeUnits  = useMemo(() => liveUnits.filter((u) => u.status === 'Active'), [liveUnits])

  // ---- Variation helpers (only used when productType === 'Variable') ----
  const addVariationRow = () => {
    const rid = nextVarRowId
    setNextVarRowId((n) => n + 1)
    const vid = nextValRowId
    setNextValRowId((n) => n + 1)
    const newRow: VariationRow = {
      id: rid,
      variationId: '',
      values: [{ id: vid, valueName: '', sku: '', purchaseExc: v.purchaseExc, purchaseInc: v.purchaseInc, marginPct: v.marginPct, sellingExc: v.sellingExc, imageName: '' }],
    }
    setV((s) => ({ ...s, variationRows: [...s.variationRows, newRow] }))
  }
  const removeVariationRow = (rid: number) =>
    setV((s) => ({ ...s, variationRows: s.variationRows.filter((r) => r.id !== rid) }))
  const setVariationId = (rid: number, variationId: number | '') => {
    const variation = liveVariations.find((vv) => vv.id === variationId)
    setV((s) => ({
      ...s,
      variationRows: s.variationRows.map((r) =>
        r.id === rid
          ? {
              ...r,
              variationId,
              values: variation
                ? variation.values.map((valName, i) => ({
                    id: nextValRowId + i,
                    valueName: valName,
                    sku: '',
                    purchaseExc: v.purchaseExc,
                    purchaseInc: v.purchaseInc,
                    marginPct: v.marginPct,
                    sellingExc: v.sellingExc,
                    imageName: '',
                  }))
                : [],
            }
          : r,
      ),
    }))
    if (variation) setNextValRowId((n) => n + variation.values.length)
  }
  const addVariationValue = (rid: number) => {
    const vid = nextValRowId
    setNextValRowId((n) => n + 1)
    setV((s) => ({
      ...s,
      variationRows: s.variationRows.map((r) =>
        r.id === rid
          ? { ...r, values: [...r.values, { id: vid, valueName: '', sku: '', purchaseExc: v.purchaseExc, purchaseInc: v.purchaseInc, marginPct: v.marginPct, sellingExc: v.sellingExc, imageName: '' }] }
          : r,
      ),
    }))
  }
  const removeVariationValue = (rid: number, vid: number) =>
    setV((s) => ({
      ...s,
      variationRows: s.variationRows.map((r) =>
        r.id === rid ? { ...r, values: r.values.filter((vv) => vv.id !== vid) } : r,
      ),
    }))
  const setVarField = <K extends keyof VariationValueRow>(rid: number, vid: number, k: K, val: VariationValueRow[K]) =>
    setV((s) => ({
      ...s,
      variationRows: s.variationRows.map((r) =>
        r.id === rid
          ? { ...r, values: r.values.map((vv) => (vv.id === vid ? { ...vv, [k]: val } : vv)) }
          : r,
      ),
    }))

  // ---- Combo product helpers ----
  const allProducts = products ?? []
  const comboMatches = useMemo(() => {
    const q = comboQuery.trim().toLowerCase()
    if (!q) return allProducts.slice(0, 8)
    return allProducts
      .filter((p) => {
        if (p.id === Number(initial && 'name' in initial ? 0 : 0)) return false
        if (v.comboItems.some((ci) => ci.productId === p.id)) return false
        return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      })
      .slice(0, 10)
  }, [comboQuery, allProducts, v.comboItems])

  const addComboItem = (p: ComboProductOption) => {
    const cid = nextComboId
    setNextComboId((n) => n + 1)
    setV((s) => ({
      ...s,
      comboItems: [
        ...s.comboItems,
        { id: cid, productId: p.id, productName: p.name, quantity: '1', purchasePrice: String(p.purchasePrice || 0) },
      ],
    }))
    setComboQuery('')
    setComboSearchOpen(false)
  }
  const removeComboItem = (cid: number) =>
    setV((s) => ({ ...s, comboItems: s.comboItems.filter((ci) => ci.id !== cid) }))
  const setComboField = <K extends keyof ComboItem>(cid: number, k: K, val: ComboItem[K]) =>
    setV((s) => ({
      ...s,
      comboItems: s.comboItems.map((ci) => (ci.id === cid ? { ...ci, [k]: val } : ci)),
    }))

  const comboNetTotal = useMemo(
    () => v.comboItems.reduce((sum, ci) => sum + (Number(ci.quantity) || 0) * (Number(ci.purchasePrice) || 0), 0),
    [v.comboItems],
  )

  useEffect(() => {
    if (!comboSearchOpen) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (comboSearchRef.current?.contains(t)) return
      setComboSearchOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setComboSearchOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [comboSearchOpen])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.name ? 'Edit Product' : 'Add New Product'}
      size="xl"
      variant="perfex"
      headerClassName="bg-gradient-to-r from-[#284a72] to-[#337ab7]"
      closeBtnClassName="bg-[#d9230f] hover:bg-[#c1200e]"
      footer={
        <div className="flex flex-wrap justify-end gap-2 w-full">
          <button type="button" onClick={() => save('close')}
            className="inline-flex items-center gap-2 rounded-[6px] px-6 py-3 text-[18px] font-semibold text-white bg-amber-500 hover:bg-amber-600 active:bg-amber-700 shadow-sm transition">
            <Tag className="size-5" /> Save &amp; Add Selling-Price-Group Prices
          </button>
          <button type="button" onClick={() => save('close')}
            className="inline-flex items-center gap-2 rounded-[6px] px-6 py-3 text-[18px] font-semibold text-white bg-violet-600 hover:bg-violet-700 active:bg-violet-800 shadow-sm transition">
            <Layers className="size-5" /> Save &amp; Add Opening Stock
          </button>
          <button type="button" onClick={() => save('another')}
            className="inline-flex items-center gap-2 rounded-[6px] px-6 py-3 text-[18px] font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-sm transition">
            Save And Add Another
          </button>
          <button type="button" onClick={() => save('close')}
            className="inline-flex items-center gap-2 rounded-[6px] px-8 py-3 text-[18px] font-semibold text-white bg-[#284a72] hover:bg-[#1f3a5c] active:bg-[#172c47] shadow-sm transition">
            Save
          </button>
        </div>
      }
    >
      <div className="product-form-modal space-y-4">
        {/* Core info */}
        <SectionCard icon={PackageOpen} title="Product information" subtitle="basic details, units, and locations">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
            <div>
              <FieldLabel required>Product Name</FieldLabel>
              <Input value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="Product Name"
                className={cn(inputCls, errors.name && 'border-red-500 focus:border-red-500 focus:ring-red-500/20')} />
              {errors.name && <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1"><AlertTriangle className="size-3" />{errors.name}</p>}
            </div>
            <div>
              <FieldLabel hint
                hintText="Unique product id or Stock Keeping Unit">
                SKU
              </FieldLabel>
              <Input value={v.sku} onChange={(e) => set('sku', e.target.value)} placeholder="Auto-generated if blank" className={inputCls} />
            </div>
            <div>
              <FieldLabel required>Barcode Type</FieldLabel>
              <Select value={v.barcodeType} onChange={(e) => set('barcodeType', e.target.value)}>
                {BARCODE_TYPES.map((b) => <option key={b.v} value={b.v}>{b.l}</option>)}
              </Select>
            </div>

            <div>
              <FieldLabel required>Unit</FieldLabel>
              <SelectWithAdd error={!!errors.unitId} onAdd={() => navigate('/admin/inventory/settings/units')}>
                <Select value={String(v.unitId)} onChange={(e) => set('unitId', e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Please Select</option>
                  {activeUnits.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.shortName})</option>)}
                </Select>
              </SelectWithAdd>
              {errors.unitId && <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1"><AlertTriangle className="size-3" />{errors.unitId}</p>}
            </div>
            <div>
              <FieldLabel>Brand</FieldLabel>
              <SelectWithAdd onAdd={() => navigate('/admin/inventory/settings/brands')}>
                <Select value={String(v.brandId)} onChange={(e) => set('brandId', e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Please Select</option>
                  {activeBrands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </SelectWithAdd>
            </div>
            <div>
              <FieldLabel required>Category</FieldLabel>
              <Select
                value={String(v.categoryId)}
                onChange={(e) => set('categoryId', e.target.value ? Number(e.target.value) : '')}
                className={errors.categoryId ? '!border-red-500 [&_.nice-select-control]:!border-red-500' : ''}
              >
                <option value="">Please Select</option>
                {activeCats.map((c) => <option key={c.id} value={c.id}>{categoryLabel(c, liveCats)}</option>)}
              </Select>
            </div>

            <div className="md:col-span-3">
              <FieldLabel hint
                hintText="Locations where product will be available.">
                Business Locations
              </FieldLabel>
              <MultiSelect
                value={v.locations}
                onChange={(next) => set('locations', next)}
                placeholder={branches.length === 0 ? 'No locations configured' : 'Select locations...'}
                options={branches.map((b) => ({ value: b.id, label: b.code ? `${b.name} (${b.code})` : b.name }))}
              />
            </div>
          </div>
        </SectionCard>

        {/* Stock + description + images */}
        <SectionCard icon={Settings2} title="Stock, description & media">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-4 items-start">
            <div className="md:col-span-2 space-y-3">
              <div className="grid grid-cols-1 gap-3 items-start">
                <div>
                  <Toggle checked={v.manageStock} onChange={(val) => set('manageStock', val)}
                    label={<span>Manage Stock?<InlineTip
                      text={<>Enable or disable stock management<br />for a product.</>}
                      muted={<>Stock Management should be disable mostly<br />for services. Example: Hair-Cutting,<br />Repairing, etc.</>}
                    /></span>} />
                  <p className="mt-1 ml-9 text-[11px] text-slate-500 dark:text-slate-400">
                    Enable stock management at product level
                  </p>
                </div>
                {v.manageStock && (
                  <div>
                    <FieldLabel hint hintText="Get notified when stock for this product drops below this quantity.">Alert quantity</FieldLabel>
                    <Input value={v.alertQuantity} onChange={(e) => set('alertQuantity', e.target.value)}
                      placeholder="Low-stock threshold" className={inputCls} />
                  </div>
                )}
              </div>

              <div>
                <FieldLabel>Product Description</FieldLabel>
                <RichTextArea value={v.description} onChange={(val) => set('description', val)} />
              </div>

              <FilePicker
                label="Product brochure"
                fileName={v.brochureName}
                accept=".pdf,.csv,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(n) => set('brochureName', n)}
                hint={<span>Max 5MB. Allowed: pdf, csv, xls, xlsx, doc, docx, jpg, jpeg, png.</span>}
              />
            </div>

            <div>
              <FilePicker
                label="Product image"
                fileName={v.imageName}
                accept="image/*"
                buttonColor="#00a65a"
                onChange={(n) => set('imageName', n)}
                hint={<span>Max 5MB. Aspect ratio 1:1 recommended.</span>}
              />
            </div>
          </div>
        </SectionCard>

        {/* Flags + extra */}
        <SectionCard icon={ToggleLeft} title="Additional settings">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-3">
              <Toggle checked={v.enableImei} onChange={(val) => set('enableImei', val)}
                label={<span>Enable Product description, IMEI or Serial Number<InlineTip text="Enable this to add IMEI/Serial numbers or additional description per unit sold." /></span>} />
              <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3">
                <FieldLabel className="shrink-0 mb-0 whitespace-nowrap">Weight:</FieldLabel>
                <Input value={v.weight} onChange={(e) => set('weight', e.target.value)} placeholder="e.g. 0.5 kg" className={inputCls} />
                <FieldLabel className="shrink-0 mb-0 whitespace-nowrap">
                  Service staff timer / Preparation time (minutes):
                </FieldLabel>
                <Input
                  type="number" min={0}
                  value={v.prepTime}
                  onChange={(e) => set('prepTime', e.target.value)}
                  placeholder="Minutes"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex items-start">
              <Toggle checked={v.notForSelling} onChange={(val) => set('notForSelling', val)}
                label={<span>Not for selling<InlineTip text="Mark a product as not for selling if it is used as an ingredient/part only and will not be sold directly." /></span>} />
            </div>
          </div>
        </SectionCard>

        {/* Tax & pricing */}
        <SectionCard icon={Percent} title="Pricing & tax">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
            <div>
              <FieldLabel>Applicable Tax</FieldLabel>
              <Select value={v.taxName} onChange={(e) => set('taxName', e.target.value)}>
                <option value="">None</option>
                {taxes.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel required>Selling Price Tax Type</FieldLabel>
              <Select value={v.sellingPriceTaxType} onChange={(e) => set('sellingPriceTaxType', e.target.value as 'Exclusive' | 'Inclusive')}>
                <option value="Exclusive">Exclusive</option>
                <option value="Inclusive">Inclusive</option>
              </Select>
            </div>
            <div>
              <FieldLabel required hint hintText="Single: standard product. Variable: product with variations (e.g. sizes/colours). Combo: bundle of other products. Service: non-physical service.">Product Type</FieldLabel>
              <Select value={v.productType} onChange={(e) => set('productType', e.target.value as ProductFormValues['productType'])}>
                <option value="Single">Single</option>
                <option value="Variable">Variable</option>
                <option value="Combo">Combo</option>
                <option value="Service">Service</option>
              </Select>
            </div>
          </div>

          {/* Pricing area: Single/Combo/Service show Default Price grid; Variable shows variation builder. */}
          {v.productType === 'Variable' ? (
            <div className="mt-4 space-y-4">
              {/* Variation SKU Format */}
              <div>
                <FieldLabel hint hintText="Choose how SKUs are generated for each variation — numbered suffix (ABC-1, ABC-2) or by-variation suffix (ABCS, ABCM).">Variation SKU Format</FieldLabel>
                <div className="flex flex-wrap items-center gap-x-10 gap-y-2 mt-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="sku-fmt" className="accent-[#337ab7] size-[18px]"
                      checked={v.variationSkuFormat === 'sku-number'}
                      onChange={() => set('variationSkuFormat', 'sku-number')} />
                    <span className="text-[15px] font-semibold text-[#16325c] dark:text-slate-100">
                      SKU-Number <span className="text-[13px] font-normal text-slate-500 dark:text-slate-400">(Example -&gt; ABC-1, ABC-2)</span>
                    </span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="sku-fmt" className="accent-[#337ab7] size-[18px]"
                      checked={v.variationSkuFormat === 'sku-variation'}
                      onChange={() => set('variationSkuFormat', 'sku-variation')} />
                    <span className="text-[15px] font-semibold text-[#16325c] dark:text-slate-100">
                      SKUVariation <span className="text-[13px] font-normal text-slate-500 dark:text-slate-400">(Example -&gt; ABCS, ABCM)</span>
                    </span>
                  </label>
                </div>
              </div>

              {/* Add Variation */}
              <div className="flex items-center gap-3">
                <h4 className="text-[26px] font-normal text-[#16325c] dark:text-slate-100">
                  Add Variation:<Req />
                </h4>
                <button type="button" onClick={addVariationRow}
                  className="grid size-[46px] place-items-center rounded-[8px] text-white transition hover:brightness-110 active:scale-95 shadow-md"
                  style={{ backgroundColor: '#4f00e6' }}
                  title="Add variation">
                  <Plus className="size-7" strokeWidth={2.5} />
                </button>
              </div>

              {/* Variations table */}
              {v.variationRows.length > 0 && (
                <div className="overflow-x-auto rounded-[4px] border border-slate-200 dark:border-slate-700">
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr>
                        <th className="w-12 bg-[#62b7f6] dark:bg-[#62b7f6]"></th>
                        <th className="bg-[#62b7f6] text-white px-3 py-2 text-left font-bold min-w-[200px] border-r border-white/30">Variation</th>
                        <th className="bg-[#3988bf] text-white px-3 py-2 text-left font-bold" colSpan={8}>Variation Values</th>
                      </tr>
                      <tr>
                        <th className="bg-[#62b7f6]"></th>
                        <th className="bg-[#62b7f6] border-r border-white/30"></th>
                        {([
                          { l: 'SKU', tip: 'Unique Stock Keeping Unit for this variation value.' },
                          { l: 'Value' },
                          { l: 'Default Purchase Price' },
                          { l: '' },
                          { l: 'x Margin(%)', tip: 'Profit margin % for this variation value.' },
                          { l: 'Default Selling Price' },
                          { l: 'Variation Images' },
                          { l: '' },
                        ] as { l: string; tip?: string }[]).map((h, i) => (
                          <th key={i} className={cn(
                            'bg-[#3988bf] text-white px-2 py-2 text-center font-semibold whitespace-nowrap',
                            i < 7 && 'border-r border-white/20',
                          )}>
                            <span className="inline-flex items-center">
                              {h.l}
                              {h.tip && <InlineTip text={h.tip} />}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {v.variationRows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-200 dark:border-slate-700 align-top">
                          <td className="bg-white dark:bg-[#14171c] p-2 text-center">
                            <button type="button" onClick={() => removeVariationRow(row.id)}
                              className="inline-grid size-[38px] place-items-center rounded-[8px] border-2 border-[#d9534f] text-[#d9534f] hover:bg-[#d9534f] hover:text-white transition"
                              title="Remove variation">
                              <Trash2 className="size-5" />
                            </button>
                          </td>
                          <td className="bg-white dark:bg-[#14171c] p-2 border-r border-slate-200 dark:border-slate-700">
                            <Select value={String(row.variationId)} onChange={(e) => setVariationId(row.id, e.target.value ? Number(e.target.value) : '')}>
                              <option value="">Please Select</option>
                              {liveVariations.map((vv) => <option key={vv.id} value={vv.id}>{vv.name}</option>)}
                            </Select>
                          </td>
                          {row.values.length === 0 ? (
                            <td colSpan={8} className="bg-white dark:bg-[#14171c] p-2">
                              <button type="button" onClick={() => addVariationValue(row.id)}
                                className="inline-grid size-[38px] place-items-center rounded-[8px] border-2 border-[#5cb85c] text-[#5cb85c] hover:bg-[#5cb85c] hover:text-white transition"
                                title="Add value">
                                <Plus className="size-5" strokeWidth={2.5} />
                              </button>
                            </td>
                          ) : (
                            <td colSpan={8} className="p-0">
                              <table className="w-full border-collapse">
                                <tbody>
                                  {row.values.map((val) => (
                                    <tr key={val.id} className="border-t border-slate-200 dark:border-slate-700 first:border-t-0">
                                      <td className="bg-white dark:bg-[#14171c] p-1.5 w-[120px]">
                                        <Input value={val.sku} onChange={(e) => setVarField(row.id, val.id, 'sku', e.target.value)}
                                          placeholder="SKU"
                                          className={cn(inputCls, 'h-[38px] text-[13px]')} />
                                      </td>
                                      <td className="bg-white dark:bg-[#14171c] p-1.5 w-[120px]">
                                        <Input value={val.valueName} onChange={(e) => setVarField(row.id, val.id, 'valueName', e.target.value)}
                                          placeholder="Value"
                                          className={cn(inputCls, 'h-[38px] text-[13px]')} />
                                      </td>
                                      <td className="bg-white dark:bg-[#14171c] p-1.5 w-[110px]">
                                        <Input value={val.purchaseExc} onChange={(e) => setVarField(row.id, val.id, 'purchaseExc', e.target.value)}
                                          placeholder="Exc. tax"
                                          className={cn(inputCls, 'h-[38px] text-[13px] text-right font-mono')} />
                                      </td>
                                      <td className="bg-white dark:bg-[#14171c] p-1.5 w-[110px]">
                                        <div className="relative">
                                          <Input value={val.purchaseInc} onChange={(e) => setVarField(row.id, val.id, 'purchaseInc', e.target.value)}
                                            placeholder="Inc. tax"
                                            className={cn(inputCls, 'h-[38px] text-[13px] text-right font-mono pr-8')} />
                                          <Check className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                                        </div>
                                      </td>
                                      <td className="bg-white dark:bg-[#14171c] p-1.5 w-[90px]">
                                        <div className="relative">
                                          <Input value={val.marginPct} onChange={(e) => setVarField(row.id, val.id, 'marginPct', e.target.value)}
                                            placeholder="25"
                                            className={cn(inputCls, 'h-[38px] text-[13px] text-right font-mono pr-8')} />
                                          <Check className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                                        </div>
                                      </td>
                                      <td className="bg-white dark:bg-[#14171c] p-1.5 w-[110px]">
                                        <Input value={val.sellingExc} onChange={(e) => setVarField(row.id, val.id, 'sellingExc', e.target.value)}
                                          placeholder="Exc. tax"
                                          className={cn(inputCls, 'h-[38px] text-[13px] text-right font-mono')} />
                                      </td>
                                      <td className="bg-white dark:bg-[#14171c] p-1.5 w-[220px]">
                                        <VariationImagePicker
                                          fileName={val.imageName}
                                          onChange={(n) => setVarField(row.id, val.id, 'imageName', n)}
                                        />
                                      </td>
                                      <td className="bg-white dark:bg-[#14171c] p-1.5 text-center w-12">
                                        <button type="button" onClick={() => removeVariationValue(row.id, val.id)}
                                          className="inline-grid size-[38px] place-items-center rounded-[8px] border-2 border-[#d9534f] text-[#d9534f] hover:bg-[#d9534f] hover:text-white transition"
                                          title="Remove value">
                                          <Trash2 className="size-5" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : v.productType === 'Combo' ? (
          /* Combo product builder */
          <div className="mt-4 space-y-4">
            {/* Product search */}
            <div className="mx-auto max-w-3xl" ref={comboSearchRef}>
              <div className="flex items-stretch rounded border border-slate-300 dark:border-zinc-600 overflow-hidden bg-white dark:bg-[#14171c] h-[46px] shadow-sm">
                <span className="grid w-[56px] shrink-0 place-items-center text-slate-500 border-r border-slate-300 dark:border-zinc-600">
                  <Search className="size-5" />
                </span>
                <input
                  type="text"
                  value={comboQuery}
                  onFocus={() => setComboSearchOpen(true)}
                  onChange={(e) => { setComboQuery(e.target.value); setComboSearchOpen(true) }}
                  placeholder="Enter Product name / SKU / Scan bar code"
                  className="flex-1 px-4 text-[16px] bg-transparent text-[#16325c] dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              {comboSearchOpen && comboMatches.length > 0 && (
                <div className="relative z-50">
                  <div className="absolute left-[56px] right-0 mt-1 max-h-64 overflow-y-auto rounded border border-slate-300 dark:border-zinc-600 bg-white dark:bg-[#1b1f24] shadow-xl">
                    {comboMatches.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onMouseDown={(e) => { e.preventDefault(); addComboItem(p) }}
                        className="block w-full px-4 py-2 text-left text-[14px] text-[#16325c] dark:text-slate-100 hover:bg-[#337ab7] hover:text-white transition"
                      >
                        <span className="font-semibold">{p.name}</span>
                        {p.sku && <span className="ml-2 text-[12px] opacity-70">({p.sku})</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Combo items table */}
            <div className="overflow-x-auto rounded-[3px] border border-slate-200 dark:border-slate-700">
              <table className="w-full border-collapse text-[14px]">
                <thead>
                  <tr>
                    {['Product Name', 'Quantity', 'Purchase Price (Excluding Tax)', 'Total Amount (Exc. Tax)', ''].map((h, i) => (
                      <th key={i} className={cn(
                        'px-3 py-3 text-white text-center font-bold',
                        i === 0 ? 'text-left' : '',
                        i < 4 ? 'border-r border-white/20' : '',
                      )} style={{ background: '#5cb85c' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {v.comboItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-[13px] italic text-slate-400 bg-white dark:bg-[#14171c]">
                        Search for products above to add them to this combo.
                      </td>
                    </tr>
                  )}
                  {v.comboItems.map((ci) => {
                    const total = (Number(ci.quantity) || 0) * (Number(ci.purchasePrice) || 0)
                    return (
                      <tr key={ci.id} className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-[#14171c]">
                        <td className="px-3 py-2 text-[#16325c] dark:text-slate-100 font-medium">{ci.productName}</td>
                        <td className="px-3 py-2 w-[130px]">
                          <Input type="number" min={0} step="any" value={ci.quantity}
                            onChange={(e) => setComboField(ci.id, 'quantity', e.target.value)}
                            className={cn(inputCls, 'h-[38px] text-center font-mono')} />
                        </td>
                        <td className="px-3 py-2 w-[180px]">
                          <Input type="number" min={0} step="any" value={ci.purchasePrice}
                            onChange={(e) => setComboField(ci.id, 'purchasePrice', e.target.value)}
                            className={cn(inputCls, 'h-[38px] text-right font-mono')} />
                        </td>
                        <td className="px-3 py-2 w-[180px] text-right font-mono text-[#16325c] dark:text-slate-100">
                          GH&#x20B5; {total.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 w-14 text-center">
                          <button type="button" onClick={() => removeComboItem(ci.id)}
                            className="inline-grid size-[38px] place-items-center rounded text-[#d9534f] hover:bg-[#d9534f] hover:text-white transition"
                            title="Remove">
                            <Trash2 className="size-5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Net total */}
            <div className="flex items-center justify-end gap-3 border-t-2 border-slate-300 dark:border-zinc-600 pt-3">
              <span className="text-[22px] font-bold text-[#16325c] dark:text-slate-100">Net Total Amount :</span>
              <span className="text-[22px] font-semibold text-[#16325c] dark:text-slate-100">GH&#x20B5; {comboNetTotal.toFixed(2)}</span>
            </div>

            {/* Margin + selling price */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end justify-items-end mt-6">
              <div className="w-full max-w-[380px]">
                <FieldLabel>x Margin(%):</FieldLabel>
                <Input value={v.marginPct} onChange={(e) => set('marginPct', e.target.value)} placeholder="25.00"
                  className={cn(inputCls, 'text-right font-mono')} />
              </div>
              <div className="w-full max-w-[380px]">
                <FieldLabel>Default Selling Price:</FieldLabel>
                <Input value={v.sellingExc} onChange={(e) => set('sellingExc', e.target.value)} placeholder="0.00"
                  className={cn(inputCls, 'text-right font-mono')} />
              </div>
            </div>
          </div>
          ) : (
          /* Default price grid for Single / Service */
          <div className="mt-4 rounded-[3px] border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 text-white text-[12px] font-semibold" style={{ background: '#00a65a' }}>
              <div className="col-span-5 px-3 py-2 border-r border-emerald-400/60">Default Purchase Price</div>
              <div className="col-span-2 px-3 py-2 border-r border-emerald-400/60 flex items-center gap-1">
                <Percent className="size-3" /> x Margin(%)<InlineTip text="Default profit margin percentage used to calculate the selling price from purchase price." />
              </div>
              <div className="col-span-3 px-3 py-2 border-r border-emerald-400/60">Default Selling Price</div>
              <div className="col-span-2 px-3 py-2">Product image</div>
            </div>
            <div className="grid grid-cols-12 text-[11.5px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40">
              <div className="col-span-2 px-3 py-1 border-r border-b border-slate-200 dark:border-slate-700">Exc. tax:<Req /></div>
              <div className="col-span-3 px-3 py-1 border-r border-b border-slate-200 dark:border-slate-700">Inc. tax:<Req /></div>
              <div className="col-span-2 px-3 py-1 border-r border-b border-slate-200 dark:border-slate-700"></div>
              <div className="col-span-3 px-3 py-1 border-r border-b border-slate-200 dark:border-slate-700">Exc. Tax</div>
              <div className="col-span-2 px-3 py-1 border-b border-slate-200 dark:border-slate-700"></div>
            </div>
            <div className="grid grid-cols-12 p-2 gap-0 bg-white dark:bg-slate-900">
              <div className="col-span-2 pr-1.5">
                <Input value={v.purchaseExc} onChange={(e) => set('purchaseExc', e.target.value)} placeholder="0.00"
                  className={cn(inputCls, 'h-[42px] text-right font-mono')} />
              </div>
              <div className="col-span-3 pr-1.5">
                <Input value={v.purchaseInc} onChange={(e) => set('purchaseInc', e.target.value)} placeholder="0.00"
                  className={cn(inputCls, 'h-[42px] text-right font-mono')} />
              </div>
              <div className="col-span-2 pr-1.5">
                <Input value={v.marginPct} onChange={(e) => set('marginPct', e.target.value)} placeholder="25.00"
                  className={cn(inputCls, 'h-[42px] text-right font-mono')} />
              </div>
              <div className="col-span-3 pr-1.5">
                <Input value={v.sellingExc} onChange={(e) => set('sellingExc', e.target.value)} placeholder="0.00"
                  className={cn(inputCls, 'h-[42px] text-right font-mono')} />
              </div>
              <div className="col-span-2">
                <FilePicker
                  fileName={v.sellingImageName}
                  accept="image/*"
                  buttonColor="#00a65a"
                  onChange={(n) => set('sellingImageName', n)}
                  hint={<span>Max 5MB · 1:1</span>}
                />
              </div>
            </div>
          </div>
          )}
        </SectionCard>
      </div>
    </Modal>
  )
}
