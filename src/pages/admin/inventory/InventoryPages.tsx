import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Package, Printer, FileText, FileSpreadsheet, Pencil,
  ChevronLeft, ChevronRight, ChevronDown, CirclePlus, Menu, Check, Square, CheckSquare,
  Search,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Select, Modal } from '../../../components/ui'
import { cn } from '../../../lib/utils'
import { exportExcel } from '../../../lib/export'
import {
  SEED_INV_CATEGORIES, SEED_INV_BRANDS, SEED_INV_UNITS, SEED_INV_WARRANTIES,
  categoryLabel,
  type InvCategory, type InvBrand, type InvUnit, type InvWarranty,
} from './invSeed'
import {
  loadVariations, saveVariations, loadCategories, saveCategories,
  loadBrands, saveBrands, loadUnits, saveUnits, loadWarranties, saveWarranties,
  loadPriceGroups, savePriceGroups,
  type InvVariation, type InvPriceGroup,
} from './invStorage'

// ---------------------------------------------------------------------------
// Variations — list-only CRUD with Add/Edit modal (no form card).
// Matches Perfex/AdminLTE screenshot: green-top card, zebra rows, blue-grey
// table header, navy Add/Edit buttons, blue-header modal.
// Light + Dark theme support. Persisted to localStorage.
// ---------------------------------------------------------------------------
type Variation = InvVariation

export function InvVariations() {
  const [items, setItemsState] = useState<Variation[]>(() => loadVariations())
  const persist = (next: Variation[]) => { setItemsState(next); saveVariations(next) }
  const [q, setQ] = useState('')
  const [showEntries, setShowEntries] = useState(10)
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<'name' | 'values' | 'id'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [modal, setModal] = useState<{
    open: boolean
    editing: Variation | null
    name: string
    values: { id: number; value: string }[]
    errors: { name?: string; values?: string }
    version: number
  }>({ open: false, editing: null, name: '', values: [{ id: 0, value: '' }], errors: {}, version: 0 })
  const [saving, setSaving] = useState(false)
  const [nextId, setNextId] = useState(() => Math.max(0, ...items.map((x: any) => x.id)) + 1)
  const rowIdRef = useRef<number>(1)
  const [busy, setBusy] = useState<'' | 'print' | 'csv' | 'excel'>('')
  const [done, setDone] = useState<'' | 'print' | 'csv' | 'excel'>('')
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark'),
  )

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark'))
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const openAdd = () => {
    const nid = rowIdRef.current++
    setModal({
      open: true, editing: null, name: '',
      values: [{ id: nid, value: '' }],
      errors: {}, version: Date.now(),
    })
  }
  const openEdit = (v: Variation) => {
    const src = v.values.length ? v.values : ['']
    const values = src.map((val) => ({ id: rowIdRef.current++, value: val }))
    setModal({ open: true, editing: v, name: v.name, values, errors: {}, version: Date.now() })
  }
  const closeModal = () => setModal((m) => ({ ...m, open: false, editing: null }))

  const setVal = (id: number, value: string) =>
    setModal((m) => ({ ...m, values: m.values.map((r) => (r.id === id ? { ...r, value } : r)) }))
  const setName = (name: string) => setModal((m) => ({ ...m, name }))
  const addVal = () => {
    const nid = rowIdRef.current++
    setModal((m) => ({ ...m, values: [...m.values, { id: nid, value: '' }] }))
  }

  const toggleSort = (key: 'name' | 'values' | 'id') => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const save = async () => {
    const errs: { name?: string; values?: string } = {}
    if (!modal.name.trim()) errs.name = 'Variation name is required'
    const values = modal.values.map((r) => r.value.trim()).filter(Boolean)
    if (values.length === 0) errs.values = 'At least one value is required'
    setModal((m) => ({ ...m, errors: errs }))
    if (Object.keys(errs).length) return
    setSaving(true)
    await new Promise((r) => setTimeout(r, 200))
    if (modal.editing) {
      persist(items.map((it) => it.id === modal.editing!.id ? { ...it, name: modal.name.trim(), values } : it))
    } else {
      const id = nextId
      persist([...items, { id, name: modal.name.trim(), values }])
      setNextId(id + 1)
    }
    setSaving(false)
    closeModal()
  }

  const removeItem = (id: number) => {
    if (!window.confirm('Delete this variation?')) return
    persist(items.filter((v) => v.id !== id))
  }

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    let list = items
    if (ql) list = list.filter((it) => it.name.toLowerCase().includes(ql) || it.values.join(', ').toLowerCase().includes(ql))
    list = [...list].sort((a, b) => {
      let av: string | number = '', bv: string | number = ''
      if (sortKey === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase() }
      else if (sortKey === 'values') { av = a.values.join(', ').toLowerCase(); bv = b.values.join(', ').toLowerCase() }
      else { av = a.id; bv = b.id }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [items, q, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / showEntries))
  const paged = filtered.slice((page - 1) * showEntries, page * showEntries)
  const startIdx = filtered.length === 0 ? 0 : (page - 1) * showEntries + 1
  const endIdx = Math.min(page * showEntries, filtered.length)

  const flashDone = (which: 'print' | 'csv' | 'excel') => { setDone(which); window.setTimeout(() => setDone(''), 1500) }
  const handlePrint = () => { setBusy('print'); window.setTimeout(() => { window.print(); setBusy(''); flashDone('print') }, 150) }
  const handlePdf = () => { setBusy('csv'); window.setTimeout(() => { window.print(); setBusy(''); flashDone('csv') }, 150) }
  const handleExcel = async () => {
    setBusy('excel')
    const rows = items.map((it, i) => ({ '#': i + 1, Variations: it.name, Values: it.values.join(', ') }))
    const ok = await exportExcel('variations', rows)
    setBusy(''); if (ok) flashDone('excel')
  }

  const CARD_BG        = isDark ? '#1b1f24' : '#ffffff'
  const CARD_BORDER    = isDark ? '#2d333a' : '#e7e7e2'
  const TEXT           = isDark ? '#e5e7eb' : '#32383e'
  const TEXT_MUTED     = isDark ? '#9aa3ad' : '#555'
  const HEADER_BG      = isDark ? '#1b1f24' : '#ffffff'
  const TBL_HEADER_BG  = isDark ? '#2c3440' : '#bac4d6'
  const TBL_HEADER_TXT = isDark ? '#e5e7eb' : '#32383e'
  const TBL_BORDER     = isDark ? '#363c44' : '#dddfe3'
  const ZEBRA_BG       = isDark ? '#232830' : '#e4e7ed'
  const ZEBRA_BG_HOVER = isDark ? '#2b313b' : '#d8dce4'
  const WHITE_BG       = isDark ? '#14171c' : '#ffffff'
  const WHITE_HOVER    = isDark ? '#1f242b' : '#f0f2f5'
  const INPUT_BG       = isDark ? '#14171c' : '#ffffff'
  const INPUT_BORDER   = isDark ? '#49515c' : '#9aa0a6'
  const INPUT_TEXT     = isDark ? '#e5e7eb' : '#111827'
  const PAGINATION_BG  = isDark ? '#20252c' : '#f6f6f6'
  const PAGINATION_BD  = isDark ? '#363c44' : '#ddd'

  return (
    <div id="inv-variations-wrap">
      <div className="rounded-[3px] shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.5)] overflow-hidden"
        style={{ background: CARD_BG, borderTop: '3px solid #00a65a' }}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b"
          style={{ background: HEADER_BG, borderColor: CARD_BORDER }}>
          <h3 className="flex items-center gap-2 text-[22px] font-normal" style={{ color: TEXT }}>
            <Menu className="size-[22px]" style={{ color: isDark ? '#c8f542' : '#444' }} strokeWidth={1.5} />
            Variations
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={openAdd}
              className="inline-flex items-center gap-1.5 rounded-[3px] bg-[#284a72] px-3 py-[6px] text-sm font-semibold text-white shadow-sm hover:bg-[#1f3a5c] transition-colors">
              <CirclePlus className="size-[18px]" strokeWidth={2} /> Add
            </button>
            <button title="Print / Save as PDF" onClick={handlePrint} disabled={busy !== ''}
              className="relative grid size-9 place-items-center rounded-full text-white bg-[#337ab7] hover:bg-[#286090] border-2 border-[#337ab7] transition disabled:opacity-70 disabled:cursor-wait">
              {done === 'print' ? <Check className="size-[16px]" strokeWidth={3} /> : <Printer className="size-[16px]" />}
              {busy === 'print' && <span className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-white animate-pulse" />}
            </button>
            <button title="Save as PDF" onClick={handlePdf} disabled={busy !== ''}
              className="relative grid size-9 place-items-center rounded-full text-white bg-[#f4a6bc] hover:bg-[#ea8fa9] border-2 border-[#e48aa5] transition disabled:opacity-70 disabled:cursor-wait">
              {done === 'csv' ? <Check className="size-[16px]" strokeWidth={3} /> : <FileText className="size-[16px]" />}
              {busy === 'csv' && <span className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-white animate-pulse" />}
            </button>
            <button title="Export as Excel (.xlsx)" onClick={() => void handleExcel()} disabled={busy !== ''}
              className="relative grid size-9 place-items-center rounded-full text-white bg-[#5cb85c] hover:bg-[#449d44] border-2 border-[#4cae4c] transition disabled:opacity-70 disabled:cursor-wait">
              {done === 'excel' ? <Check className="size-[16px]" strokeWidth={3} /> : <FileSpreadsheet className="size-[16px]" />}
              {busy === 'excel' && <span className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-white animate-pulse" />}
            </button>
          </div>
        </div>

        <div className="px-4 pb-4" style={{ background: CARD_BG }}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm" style={{ color: TEXT_MUTED }}>
            <div className="flex items-center gap-2">
              <span>Show</span>
              <Select value={String(showEntries)} onChange={(e) => { setShowEntries(Number(e.target.value)); setPage(1) }} className="w-20">
                <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
              </Select>
              <span>entries</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Search:</span>
              <input type="text" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }}
                className="w-[200px] h-[32px] px-2 text-sm rounded-[2px] focus:outline-none focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30"
                style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: INPUT_TEXT }} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="w-14 px-3 py-2 text-left font-semibold border cursor-pointer select-none"
                    style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}
                    onClick={() => toggleSort('id')}>
                    <span className="inline-flex items-center gap-1">#
                      {sortKey === 'id' && <ChevronDown className={cn('size-3.5', sortDir === 'asc' && 'rotate-180')} style={{ color: TBL_HEADER_TXT }} />}
                    </span>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold border cursor-pointer select-none"
                    style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}
                    onClick={() => toggleSort('name')}>
                    <span className="inline-flex items-center gap-1">Variations
                      <ChevronDown className={cn('size-4 transition-transform', sortKey !== 'name' && 'opacity-60', sortKey === 'name' && sortDir === 'asc' && 'rotate-180')} style={{ color: TBL_HEADER_TXT }} />
                    </span>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold border cursor-pointer select-none"
                    style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}
                    onClick={() => toggleSort('values')}>
                    <span className="inline-flex items-center gap-1">Values
                      <ChevronDown className={cn('size-4 transition-transform', sortKey !== 'values' && 'opacity-60', sortKey === 'values' && sortDir === 'asc' && 'rotate-180')} style={{ color: TBL_HEADER_TXT }} />
                    </span>
                  </th>
                  <th className="w-44 px-3 py-2 text-right font-semibold border"
                    style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((it, idx) => {
                  const globalIdx = (page - 1) * showEntries + idx + 1
                  const zebra = idx % 2 === 0
                  return (
                    <tr key={it.id} className="transition-colors"
                      style={{ background: zebra ? ZEBRA_BG : WHITE_BG, color: TEXT }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = zebra ? ZEBRA_BG_HOVER : WHITE_HOVER }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = zebra ? ZEBRA_BG : WHITE_BG }}>
                      <td className="px-3 py-2.5 border font-medium" style={{ borderColor: TBL_BORDER }}>{globalIdx}</td>
                      <td className="px-3 py-2.5 border font-medium" style={{ borderColor: TBL_BORDER }}>{it.name}</td>
                      <td className="px-3 py-2.5 border" style={{ borderColor: TBL_BORDER }}>{it.values.join(', ')}</td>
                      <td className="px-3 py-2.5 border" style={{ borderColor: TBL_BORDER }}>
                        <button onClick={() => openEdit(it)}
                          className="inline-flex items-center gap-1 rounded-[3px] bg-[#284a72] px-3 py-1 text-xs font-semibold text-white hover:bg-[#1f3a5c] transition-colors">
                          <Pencil className="size-3.5" strokeWidth={2} /> Edit
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {paged.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-sm border"
                    style={{ color: TEXT_MUTED, borderColor: TBL_BORDER, background: WHITE_BG }}>No entries found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm" style={{ color: TEXT_MUTED }}>
            <span>{filtered.length === 0 ? 'No entries' : `Showing ${startIdx} to ${endIdx} of ${filtered.length} entries`}</span>
            <div className={cn('flex items-center gap-0', totalPages <= 1 && 'opacity-50 pointer-events-none')}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="grid size-8 place-items-center rounded-l border transition hover:brightness-110 disabled:opacity-50"
                style={{ background: PAGINATION_BG, borderColor: PAGINATION_BD, color: '#337ab7' }}>
                <ChevronLeft className="size-4" /></button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button key={n} onClick={() => setPage(n)}
                  className={cn('grid size-8 place-items-center border-t border-b transition', n > 1 && '-ml-px')}
                  style={n === page
                    ? { background: '#284a72', borderColor: '#284a72', color: '#fff', fontWeight: 600, borderLeft: '1px solid #284a72', borderRight: '1px solid #284a72' }
                    : { background: PAGINATION_BG, borderColor: PAGINATION_BD, color: '#337ab7' }}
                  onMouseEnter={(e) => { if (n !== page) (e.currentTarget as HTMLButtonElement).style.background = isDark ? '#2b313b' : '#eaeaea' }}
                  onMouseLeave={(e) => { if (n !== page) (e.currentTarget as HTMLButtonElement).style.background = PAGINATION_BG }}>{n}</button>
              ))}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="grid size-8 place-items-center rounded-r border transition hover:brightness-110 disabled:opacity-50 -ml-px"
                style={{ background: PAGINATION_BG, borderColor: PAGINATION_BD, color: '#337ab7' }}>
                <ChevronRight className="size-4" /></button>
            </div>
          </div>
        </div>
      </div>

      <Modal open={modal.open} onClose={closeModal}
        title={modal.editing ? 'Edit Variation' : 'Add Variation'}
        variant="perfex" size="md" key={modal.version}
        headerClassName="bg-[#337ab7]"
        closeBtnClassName="bg-[#d9230f] hover:bg-[#c1200e] rounded-[4px] size-10"
        footer={<>
          <button type="button" onClick={save} disabled={saving}
            className="rounded-[4px] bg-[#284a72] px-7 py-1.5 text-base font-medium text-white shadow-sm transition hover:bg-[#1f3a5c] disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={closeModal}
            className="rounded-[4px] bg-[#dd4b39] px-7 py-1.5 text-base font-medium text-white shadow-sm transition hover:bg-[#c9302c]">Close</button>
        </>}>
        <div className="space-y-3 py-1">
          <div className="flex items-start gap-3">
            <label className="w-[170px] shrink-0 pt-1.5 text-[15px] font-semibold" style={{ color: isDark ? '#e5e7eb' : '#32383e' }}>
              Variation Name :<span className="text-red-500">*</span></label>
            <div className="flex-1">
              <input type="text" value={modal.name} onChange={(e) => setName(e.target.value)} autoFocus
                className="w-full h-[36px] px-3 text-[14px] rounded-[4px] focus:outline-none focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30"
                style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: INPUT_TEXT }} />
              {modal.errors.name && <p className="mt-1 text-xs italic text-red-500">{modal.errors.name}</p>}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <label className="w-[170px] shrink-0 pt-1.5 text-[15px] font-semibold" style={{ color: isDark ? '#e5e7eb' : '#32383e' }}>
              Add Variation Values :<span className="text-red-500">*</span></label>
            <div className="flex-1 space-y-2">
              {modal.values.map((row, i) => {
                const isFirst = i === 0
                return (
                  <div key={row.id} className="flex items-center gap-2">
                    <input type="text" value={row.value} onChange={(e) => setVal(row.id, e.target.value)}
                      className="flex-1 h-[36px] px-3 text-[14px] rounded-[4px] focus:outline-none focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30"
                      style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: INPUT_TEXT }} />
                    {isFirst && (
                      <button type="button" onClick={addVal} title="Add value"
                        className="grid size-[36px] shrink-0 place-items-center rounded-[4px] bg-[#284a72] text-white shadow-sm transition hover:bg-[#1f3a5c]">
                        <span className="text-[22px] font-light leading-none">+</span>
                      </button>
                    )}
                  </div>
                )
              })}
              {modal.errors.values && <p className="text-xs italic text-red-500">{modal.errors.values}</p>}
            </div>
          </div>
        </div>
      </Modal>

      <div id="inv-variations-print" aria-hidden
        style={{ position: 'fixed', left: '-9999px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }}>
        <style>{`
          @media print {
            html, body { background: #fff !important; color: #000 !important; }
            body * { visibility: hidden !important; }
            #inv-variations-print, #inv-variations-print * { visibility: visible !important; }
            #inv-variations-print { position: absolute !important; left: 0 !important; top: 0 !important;
              width: auto !important; height: auto !important; overflow: visible !important;
              display: block !important; padding: 24px !important; margin: 0 !important; color: #000 !important; background: #fff !important; }
            #inv-variations-print * { color: #000 !important; background: transparent !important; }
            #inv-variations-print table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            #inv-variations-print th, #inv-variations-print td { border: 1px solid #666; padding: 6px 10px; font-size: 12px; text-align: left; }
            #inv-variations-print th { background: #dde3ec !important; color: #000 !important; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            #inv-variations-print tr:nth-child(even) td { background: #f3f5f8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            #inv-variations-print h1 { font-size: 20px; margin: 0 0 4px; color: #000 !important; }
            #inv-variations-print .inv-print-sub { font-size: 12px; color: #333 !important; margin-bottom: 8px; }
          }
        `}</style>
        <h1>Variations</h1>
        <div className="inv-print-sub">Printed {new Date().toLocaleString()} · FitPro Gym App</div>
        <table>
          <thead><tr><th style={{ width: 50 }}>#</th><th>Variations</th><th>Values</th></tr></thead>
          <tbody>{filtered.map((it, i) => (<tr key={it.id}><td>{i + 1}</td><td>{it.name}</td><td>{it.values.join(', ')}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  )
}

export function InventoryPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <Link to="/admin/inventory" className="hover:text-lime">Inventory</Link>
        <span className="text-mist">/</span>
        <span className="font-semibold text-inherit">{title}</span>
      </div>
      <div className="card p-10 text-center">
        <Package className="mx-auto size-10 text-mist" />
        <h3 className="mt-3 text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-mist">{description}</p>
        <div className="mt-4"><Link to="/admin/inventory"><Button variant="outline">← Back to Products &amp; Services</Button></Link></div>
      </div>
    </div>
  )
}

export function UpdatePrice() { return <InventoryPlaceholder title="Update Price" description="Bulk-update selling and cost prices across your product catalogue." /> }
// ---------------------------------------------------------------------------
// Print Labels — Barcode/price-label generator page.
// Matches Perfex screenshot:
//   • "Print Labels" title with cyan info ⓘ
//   • Top card: "Add products to generate Labels" header + search input
//   • 4-column header strip (Products | No. of labels | Packing Date | Selling Price Group)
//   • Second card: "Information to show in Labels" grid of checkbox + Size controls
//   • Barcode setting: dropdown with gear icon
//   • Purple rounded "Preview" button centered at bottom
// ---------------------------------------------------------------------------
export function PrintLabels() {
  const [search, setSearch] = useState('')
  const [showPrice, setShowPrice] = useState<'inc' | 'exc'>('inc')
  const [barcodeSetting, setBarcodeSetting] = useState('20labels')
  const [opts, setOpts] = useState({
    productName:    { on: true,  size: 15 },
    productVariation:{ on: true, size: 17 },
    productPrice:   { on: true,  size: 17 },
    businessName:   { on: true,  size: 20 },
    packingDate:    { on: true,  size: 12 },
  })
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark')); sync()
    const obs = new MutationObserver(sync); obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const CARD_BG     = isDark ? '#1b1f24' : '#ffffff'
  const CARD_BD     = isDark ? '#2d333a' : '#e5e7eb'
  const TEXT        = isDark ? '#e5e7eb' : '#111827'
  const TEXT_MUTED  = isDark ? '#9aa3ad' : '#6b7280'
  const INPUT_BD    = isDark ? '#49515c' : '#d1d5db'
  const INPUT_BG    = isDark ? '#14171c' : '#ffffff'
  const HEADER_TXT  = isDark ? '#818cf8' : '#3730a3'
  const STRIP_BG    = isDark ? '#20252c' : '#f9fafb'
  const STRIP_BD    = isDark ? '#363c44' : '#e5e7eb'

  const toggle = (k: keyof typeof opts) => setOpts((o) => ({ ...o, [k]: { ...o[k], on: !o[k].on } }))
  const setSize = (k: keyof typeof opts, v: number) => setOpts((o) => ({ ...o, [k]: { ...o[k], size: v } }))

  const InfoDot = ({ tip }: { tip: string }) => (
    <span title={tip} className="ml-1 inline-grid size-[20px] place-items-center rounded-full bg-[#5bc0de] text-white text-[12px] font-bold cursor-help align-middle">i</span>
  )

  // Checkbox component used for the label-info toggles.
  const LabelCheck = ({ id, label, sub, size, on, onToggle, onSize }: {
    id: string; label: string; sub?: string; size: number; on: boolean;
    onToggle: () => void; onSize: (v: number) => void;
  }) => (
    <div>
      <label className="flex items-center gap-2 cursor-pointer select-none text-[16px] font-semibold mb-1" style={{ color: TEXT }}>
        <button type="button" role="checkbox" aria-checked={on} onClick={onToggle}
          className="grid size-[20px] place-items-center rounded-sm border-2 transition"
          style={{ background: on ? '#2563eb' : 'transparent', borderColor: on ? '#2563eb' : '#9ca3af', color: '#fff' }}>
          {on && <Check className="size-[14px]" strokeWidth={3.5} />}
        </button>
        <span>{label}{sub && <span className="font-normal text-[#6b7280] dark:text-[#9aa3ad]"> ({sub})</span>}</span>
      </label>
      <div className="flex items-stretch">
        <span className="inline-flex items-center px-2 text-[14px] font-semibold rounded-l"
          style={{ background: STRIP_BG, border: `1px solid ${INPUT_BD}`, borderRight: 'none', color: TEXT }}>Size</span>
        <input type="number" min={6} max={40} value={size}
          onChange={(e) => onSize(Number(e.target.value) || 0)}
          disabled={!on}
          className="h-[34px] w-full px-2 text-sm rounded-r focus:outline-none focus:border-[#337ab7] disabled:opacity-50"
          style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }} />
      </div>
    </div>
  )

  return (
    <div id="inv-print-labels">
      <h2 className="text-[28px] md:text-[32px] font-normal mb-4 flex items-center" style={{ color: TEXT }}>
        Print Labels
        <InfoDot tip="Print barcode / price labels for your products onto standard label sheets." />
      </h2>

      {/* Top card: add products */}
      <div className="rounded-2xl p-6 md:p-8 shadow-sm mb-5" style={{ background: CARD_BG, border: `1px solid ${CARD_BD}` }}>
        <p className="text-[20px] md:text-[22px] font-normal mb-4" style={{ color: TEXT }}>Add products to generate Labels</p>

        <div className="mx-auto max-w-3xl mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-[20px]" style={{ color: TEXT_MUTED }} />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Enter products name to print labels"
              autoFocus
              className="w-full h-[44px] pl-10 pr-3 text-[15px] rounded-[2px] focus:outline-none focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30"
              style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }} />
          </div>
        </div>

        {/* Column headers (empty rows; products would appear here after being added) */}
        <div className="grid grid-cols-4 text-[16px] font-bold" style={{ color: TEXT }}>
          {['Products', 'No. of labels', 'Packing Date', 'Selling Price Group'].map((h) => (
            <div key={h} className="px-3 py-2 border" style={{ background: STRIP_BG, borderColor: STRIP_BD }}>{h}</div>
          ))}
        </div>
      </div>

      {/* Label options card */}
      <div className="rounded-2xl p-6 md:p-8 shadow-sm" style={{ background: CARD_BG, border: `1px solid ${CARD_BD}` }}>
        <p className="text-[22px] font-normal mb-5" style={{ color: HEADER_TXT }}>Information to show in Labels</p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          <LabelCheck id="pl-name" label="Product Name" size={opts.productName.size} on={opts.productName.on}
            onToggle={() => toggle('productName')} onSize={(v) => setSize('productName', v)} />
          <LabelCheck id="pl-var" label="Product Variation" sub="recommended" size={opts.productVariation.size} on={opts.productVariation.on}
            onToggle={() => toggle('productVariation')} onSize={(v) => setSize('productVariation', v)} />
          <LabelCheck id="pl-price" label="Product Price" size={opts.productPrice.size} on={opts.productPrice.on}
            onToggle={() => toggle('productPrice')} onSize={(v) => setSize('productPrice', v)} />

          {/* Show Price: info + dropdown */}
          <div>
            <div className="flex items-center gap-2 mb-1 text-[16px] font-semibold" style={{ color: TEXT }}>
              <span>Show Price:</span>
              <InfoDot tip="Choose whether prices shown on labels include tax or not." />
            </div>
            <div className="flex items-stretch">
              <Select value={showPrice} onChange={(e) => setShowPrice(e.target.value as 'inc' | 'exc')}
                className="h-[34px] text-sm flex-1"
                style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT, borderRadius: 0 }}>
                <option value="inc">Inc. tax</option>
                <option value="exc">Excl. tax</option>
              </Select>
            </div>
          </div>

          <LabelCheck id="pl-biz" label="Business name" size={opts.businessName.size} on={opts.businessName.on}
            onToggle={() => toggle('businessName')} onSize={(v) => setSize('businessName', v)} />
          <LabelCheck id="pl-pack" label="Print packing date" size={opts.packingDate.size} on={opts.packingDate.on}
            onToggle={() => toggle('packingDate')} onSize={(v) => setSize('packingDate', v)} />
          <div />
          <div />
        </div>

        <hr className="my-6" style={{ borderColor: CARD_BD }} />

        {/* Barcode setting row */}
        <div className="mb-6">
          <label className="block text-[16px] font-semibold mb-2" style={{ color: TEXT }}>Barcode setting:</label>
          <div className="flex items-stretch max-w-md">
            <span className="inline-flex items-center justify-center px-3 h-[38px] rounded-l border border-r-0"
              style={{ background: STRIP_BG, borderColor: INPUT_BD, color: TEXT }}>
              <svg className="size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.37.16.67.42.88.74" />
              </svg>
            </span>
            <Select value={barcodeSetting} onChange={(e) => setBarcodeSetting(e.target.value)}
              className="h-[38px] text-[14px] flex-1"
              style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT, borderRadius: 0, borderTopRightRadius: 2, borderBottomRightRadius: 2 }}>
              <option value="20labels">20 Labels per Sheet, Sheet Size: 8.5&quot; x 11&quot;, Label Size: 4&apos;</option>
              <option value="30labels">30 Labels per Sheet, Sheet Size: 8.5&quot; x 11&quot;, Label Size: 2.625&quot; x 1&quot;</option>
              <option value="14labels">14 Labels per Sheet, Sheet Size: A4, Label Size: 99mm x 38mm</option>
              <option value="single">Single Label (continuous roll)</option>
            </Select>
          </div>
        </div>

        <div className="flex justify-center">
          <button onClick={() => alert('Preview coming in a future update.')}
            className="inline-flex items-center justify-center rounded-[4px] px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4400cc] active:scale-[0.98]"
            style={{ background: '#4f00e6' }}>
            Preview
          </button>
        </div>
      </div>
    </div>
  )
}
// ---------------------------------------------------------------------------
// Import Opening Stock — CSV importer page (not a list).
// Matches Perfex screenshot:
//   • Page title "Import Opening Stock"
//   • White rounded card with "File To Import:" (info ⓘ tooltip), native file input,
//     purple Submit button
//   • Green "Download template file" button (downloads a ready-to-fill CSV)
//   • Second white rounded "Instructions" card with help text and a column-definition table
// ---------------------------------------------------------------------------
export function ImportOpeningStock() {
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark')); sync()
    const obs = new MutationObserver(sync); obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const CARD_BG    = isDark ? '#1b1f24' : '#ffffff'
  const TEXT       = isDark ? '#e5e7eb' : '#111827'
  const TEXT_MUTED = isDark ? '#9aa3ad' : '#555'
  const CARD_BD    = isDark ? '#2d333a' : '#e5e7eb'
  const INPUT_BD   = isDark ? '#49515c' : '#d1d5db'

  const downloadTemplate = () => {
    const headers = ['SKU', 'Location', 'Quantity', 'Unit Cost (Before Tax)', 'Lot Number', 'Expiry Date (mm/dd/yyyy)']
    const sample = ['SKU-001', 'Main Store', '10', '5.50', 'LOT-2025-A', '12/31/2026']
    const csv = [headers, sample].map((r) => r.map((c) => {
      const s = String(c ?? '').replace(/"/g, '""')
      return /[",\n]/.test(s) ? `"${s}"` : s
    }).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'opening_stock_template.csv'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMsg(null)
    const f = e.target.files?.[0] ?? null
    setFile(f)
  }

  const onSubmit = async () => {
    if (!file) { setMsg({ kind: 'err', text: 'Please select a CSV file to import.' }); return }
    setSubmitting(true); setMsg(null)
    // Simulate parsing/import. Real backend would POST the file.
    await new Promise((r) => setTimeout(r, 700))
    setMsg({ kind: 'ok', text: `Imported "${file.name}" successfully (demo — no server was called).` })
    setFile(null)
    // Reset the native file input
    const inp = document.getElementById('ios-file') as HTMLInputElement | null
    if (inp) inp.value = ''
    setSubmitting(false)
  }

  const columns: { n: number; name: string; req?: boolean; instr?: string; note?: string }[] = [
    { n: 1, name: 'SKU', req: true },
    { n: 2, name: 'Location', note: 'If blank first business location will be used', instr: 'Name of the business location' },
    { n: 3, name: 'Quantity', req: true },
    { n: 4, name: 'Unit Cost (Before Tax)', req: true },
    { n: 5, name: 'Lot Number' },
    { n: 6, name: 'Expiry Date', instr: 'Stock expiry date in Business date format mm/dd/yyyy, Type: text, Example: 08/26/2026' },
  ]

  const InfoDot = ({ tip }: { tip: string }) => (
    <span title={tip} className="ml-1 inline-grid size-[18px] place-items-center rounded-full bg-[#5bc0de] text-white text-[11px] font-bold cursor-help align-middle">i</span>
  )

  return (
    <div id="inv-import-opening-stock">
      <h2 className="text-[28px] md:text-[32px] font-normal mb-4" style={{ color: TEXT }}>Import Opening Stock</h2>

      {/* Import card */}
      <div className="rounded-2xl p-6 md:p-8 shadow-sm mb-5" style={{ background: CARD_BG, border: `1px solid ${CARD_BD}` }}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center">
            <label className="text-[17px] font-semibold" style={{ color: TEXT }}>File To Import:</label>
            <InfoDot tip="Select a CSV file that follows the template column order below." />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="inline-flex items-center gap-2">
              <input id="ios-file" type="file" accept=".csv,text/csv" onChange={onFile}
                className="text-sm file:mr-2 file:rounded file:border file:border-gray-300 file:bg-gray-100 file:px-3 file:py-1 file:text-sm hover:file:bg-gray-200"
                style={{ color: TEXT_MUTED }} />
              {!file && <span className="text-[17px]" style={{ color: TEXT_MUTED }}>No file selected.</span>}
            </label>
          </div>
          <button onClick={onSubmit} disabled={submitting}
            className="ml-auto inline-flex items-center justify-center rounded-[4px] px-5 py-[7px] text-sm font-semibold text-white shadow-sm transition hover:bg-[#4400cc] disabled:opacity-60"
            style={{ background: '#4f00e6' }}>
            {submitting ? 'Importing...' : 'Submit'}
          </button>
        </div>

        {msg && (
          <div className="mt-4 rounded-md px-3 py-2 text-sm"
            style={{
              background: msg.kind === 'ok' ? (isDark ? '#052e16' : '#ecfdf5') : (isDark ? '#3b0a0a' : '#fef2f2'),
              color: msg.kind === 'ok' ? (isDark ? '#86efac' : '#065f46') : (isDark ? '#fca5a5' : '#991b1b'),
              border: `1px solid ${msg.kind === 'ok' ? '#10b981' : '#ef4444'}`,
            }}>{msg.text}</div>
        )}

        <div className="mt-6">
          <button onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 rounded-[3px] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#059669]"
            style={{ background: '#00a65a' }}>
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download template file
          </button>
        </div>
      </div>

      {/* Instructions card */}
      <div className="rounded-2xl p-6 md:p-8 shadow-sm" style={{ background: CARD_BG, border: `1px solid ${CARD_BD}` }}>
        <h3 className="text-[24px] font-normal mb-4" style={{ color: isDark ? '#818cf8' : '#3730a3' }}>Instructions</h3>

        <p className="text-[17px] font-semibold" style={{ color: TEXT }}>Carefully follow the instructions before importing the file.</p>
        <p className="text-[16px] mb-5" style={{ color: TEXT_MUTED }}>The columns of the CSV file should be in the following order.</p>

        <div className="overflow-x-auto">
          <table className="w-full text-[16px] border-collapse">
            <thead>
              <tr style={{ background: isDark ? '#20252c' : '#fafafa' }}>
                <th className="px-4 py-3 text-left font-bold w-[15%]" style={{ color: TEXT, borderBottom: `2px solid ${CARD_BD}` }}>Column Number</th>
                <th className="px-4 py-3 text-left font-bold w-[30%]" style={{ color: TEXT, borderBottom: `2px solid ${CARD_BD}` }}>Column Name</th>
                <th className="px-4 py-3 text-left font-bold" style={{ color: TEXT, borderBottom: `2px solid ${CARD_BD}` }}>Instruction</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((c, i) => {
                const alt = i % 2 === 0
                return (
                  <tr key={c.n} style={{ background: alt ? (isDark ? '#1f242b' : '#fafafa') : CARD_BG, borderBottom: `1px solid ${CARD_BD}` }}>
                    <td className="px-4 py-3 font-medium" style={{ color: TEXT }}>{c.n}</td>
                    <td className="px-4 py-3" style={{ color: TEXT }}>
                      <span className="font-medium">{c.name}</span>
                      {c.req && <span className="text-[#6b7280] dark:text-[#9aa3ad]"> <em>(Required)</em></span>}
                      {!c.req && c.n !== 2 && c.n !== 5 && c.note == null && <span className="text-[#6b7280] dark:text-[#9aa3ad]"> <em>(Optional)</em></span>}
                      {c.note && <div className="text-[14px] mt-0.5" style={{ color: TEXT_MUTED }}>{c.note}</div>}
                      {c.n === 5 && <span className="text-[#6b7280] dark:text-[#9aa3ad]"> <em>(Optional)</em></span>}
                    </td>
                    <td className="px-4 py-3" style={{ color: TEXT }}>
                      {c.instr && (
                        c.n === 6 ? (
                          <>Stock expiry date in <strong>Business date format</strong><br />
                            <strong>mm/dd/yyyy</strong>, Type: <strong>text</strong>, Example: <strong>08/26/2026</strong></>
                        ) : c.instr
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Import Products — CSV importer page for the full product catalogue.
// Same layout as Import Opening Stock but with a 37-column CSV spec.
// ---------------------------------------------------------------------------
export function ImportProducts() {
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark')); sync()
    const obs = new MutationObserver(sync); obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const CARD_BG    = isDark ? '#1b1f24' : '#ffffff'
  const TEXT       = isDark ? '#e5e7eb' : '#111827'
  const TEXT_MUTED = isDark ? '#9aa3ad' : '#555'
  const CARD_BD    = isDark ? '#2d333a' : '#e5e7eb'

  // 37 columns per the screenshot (0-indexed 0..36 -> Column Number 1..37)
  type ColDef = { n: number; name: string; req?: boolean; note?: string; instr?: React.ReactNode }
  const columns: ColDef[] = [
    { n: 1,  name: 'Product Name',     req: true, instr: 'Name of the product' },
    { n: 2,  name: 'Brand',           req: true, instr: 'Name of the brand' },
    { n: 3,  name: 'Unit',            req: true, note: 'Name of the unit. If not found, the product will be added with the unit name.', instr: 'Name of the unit' },
    { n: 4,  name: 'Category',        req: true, instr: 'Name of the Category' },
    { n: 5,  name: 'Sub Category',    req: true, note: 'Name of the Sub-Category. If not found, the product will be added with the sub category name.', instr: 'Name of the Sub-Category' },
    { n: 6,  name: 'SKU',             req: true, note: 'Product SKU. If blank an SKU will be automatically generated.', instr: '' },
    { n: 7,  name: 'Barcode Type',    req: true, note: 'Supported: C128, C39, EAN-13, EAN-8, UPC-A, UPC-E, ITF-14. Currently supported for product.', instr: 'Barcode Type for the product' },
    { n: 8,  name: 'Manage Stock?',   req: true, instr: <>Enable or disable stock management<br/>1 = Yes<br/>0 = No</> },
    { n: 9,  name: 'Alert quantity',  req: true, instr: 'Alert quantity' },
    { n: 10, name: 'Supplier',        note: 'Product supply party (Only in numbers)', instr: '' },
    { n: 11, name: 'Supply Need (MH)', req: true, instr: 'Lead time for the supply period' },
    { n: 12, name: 'Applicable Tax',  req: true, note: 'Available Options: <em>days, months</em>', instr: <>Name of the Tax Name<br/>If Purchase Price (excluding Tax) is not same as Purchase Price (Including Tax), then you must supply the Tax rate same.</> },
    { n: 13, name: 'Selling Price Tax Type', req: true, note: 'Available Options: <em>inclusive, exclusive</em>', instr: 'Selling Price Tax Type' },
    { n: 14, name: 'Product Type',    req: true, note: 'Available Options: <em>single, variable</em>', instr: '' },
    { n: 15, name: 'Variation Name', note: 'Required if product type is variable', instr: 'Name of the variation (Eg: Size, Color etc.)' },
    { n: 16, name: 'Variation Values', note: 'Required if product type is variable', instr: <>Values for the variation separated with <strong>|</strong><br/>(Ex: Red|Blue|Green)</> },
    { n: 17, name: 'Variation SKUs', note: '', instr: 'SKUs of each variation separated by <strong>|</strong>. If product type is variable' },
    { n: 18, name: 'Purchase Price (including Tax)', note: 'Required if Purchase Price (Including Tax) is not given.', instr: <>Purchase Price (including Tax) (Only in numbers)<br/>For variable products <strong>T</strong> separated values with the same order as variation values<br/>(Ex: 40|45|50)</> },
    { n: 19, name: 'Purchase Price (Excluding Tax)', note: 'Required if Purchase Price including Tax is not given.', instr: <>Purchase Price (Excluding Tax) (Only in numbers)<br/>For variable products <strong>T</strong> separated values with the same order as variation values<br/>(Ex: 40|45|50)</> },
    { n: 20, name: 'Profit Margin %', req: true, instr: 'Profit Margin (Only in numbers)' },
    { n: 21, name: 'Selling Price',  req: true, instr: 'Selling Price (Only in numbers)' },
    { n: 22, name: 'Opening Stock',  req: true, note: 'Opening Stock by adding this entry, Stock will be added by adding this entry.', instr: 'Opening Stock (Only in numbers)' },
    { n: 23, name: 'Opening stock location', req: true, note: '', instr: <>For variable products separate stock quantities with <strong>|</strong><br/>(Ex: 100|50|200)</> },
    { n: 24, name: 'Expiry Date',     note: '', instr: <>Name of the business location<br/>Format: mm-dd-yyyy. Ex: 11-25-2018</> },
    { n: 25, name: 'Enable Product Description, IMEI or Serial Number?', instr: <><strong>Only for Business</strong><br/>1 = Yes<br/>0 = No</> },
    { n: 26, name: 'Weight',         note: 'Optional', instr: '' },
    { n: 27, name: 'Rack',           note: '', instr: <>Rack details separated by <strong>|</strong> for different business locations carefully<br/>(Ex: A-1|B-1|C-2)</> },
    { n: 28, name: 'Row',            note: '', instr: <>Row details separated by <strong>|</strong> for different business locations carefully<br/>(Ex: ACDR-1|ACDR-2|ACDR-3)</> },
    { n: 29, name: 'Position',       note: '', instr: <>Position details separated by <strong>|</strong> for different business locations carefully<br/>(Ex: 25|30|32)</> },
    { n: 30, name: 'Image',          note: '', instr: <>Image name must be uploaded to the server public/uploads/img<br/>(Image must be uploaded)</> },
    { n: 31, name: 'Product Description', req: true, instr: 'Or URL of the image' },
    { n: 32, name: 'Custom Field1',  req: true, instr: '' },
    { n: 33, name: 'Custom Field2',  req: true, instr: '' },
    { n: 34, name: 'Custom Field3',  req: true, instr: '' },
    { n: 35, name: 'Custom Field4',  req: true, instr: '' },
    { n: 36, name: 'Not for selling', note: '', instr: <>1 = Yes<br/>0 = No</> },
    { n: 37, name: 'Product Locations', note: '', instr: 'Comma-separated string of business locations where product will be available' },
  ]

  const downloadTemplate = () => {
    const headers = columns.map((c) => c.name + (c.req ? ' (Required)' : ' (Optional)'))
    // Build an empty sample row
    const sample = columns.map(() => '')
    const csv = [headers, sample].map((r) => r.map((c) => {
      const s = String(c ?? '').replace(/"/g, '""')
      return /[",\n]/.test(s) ? `"${s}"` : s
    }).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'products_import_template.csv'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMsg(null)
    setFile(e.target.files?.[0] ?? null)
  }

  const onSubmit = async () => {
    if (!file) { setMsg({ kind: 'err', text: 'Please select a CSV file to import.' }); return }
    setSubmitting(true); setMsg(null)
    await new Promise((r) => setTimeout(r, 700))
    setMsg({ kind: 'ok', text: `Imported "${file.name}" successfully (demo — no server was called).` })
    setFile(null)
    const inp = document.getElementById('ip-file') as HTMLInputElement | null
    if (inp) inp.value = ''
    setSubmitting(false)
  }

  const InfoDot = ({ tip }: { tip: string }) => (
    <span title={tip} className="ml-1 inline-grid size-[18px] place-items-center rounded-full bg-[#5bc0de] text-white text-[11px] font-bold cursor-help align-middle">i</span>
  )

  return (
    <div id="inv-import-products">
      <h2 className="text-[28px] md:text-[32px] font-normal mb-4" style={{ color: TEXT }}>Import Products</h2>

      <div className="rounded-2xl p-6 md:p-8 shadow-sm mb-5" style={{ background: CARD_BG, border: `1px solid ${CARD_BD}` }}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center">
            <label className="text-[17px] font-semibold" style={{ color: TEXT }}>File To Import:</label>
            <InfoDot tip="Select a CSV file that follows the template column order below." />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="inline-flex items-center gap-2">
              <input id="ip-file" type="file" accept=".csv,text/csv" onChange={onFile}
                className="text-sm file:mr-2 file:rounded file:border file:border-gray-300 file:bg-gray-100 file:px-3 file:py-1 file:text-sm hover:file:bg-gray-200"
                style={{ color: TEXT_MUTED }} />
              {!file && <span className="text-[17px]" style={{ color: TEXT_MUTED }}>No file selected.</span>}
            </label>
          </div>
          <button onClick={onSubmit} disabled={submitting}
            className="ml-auto inline-flex items-center justify-center rounded-[4px] px-5 py-[7px] text-sm font-semibold text-white shadow-sm transition hover:bg-[#4400cc] disabled:opacity-60"
            style={{ background: '#4f00e6' }}>
            {submitting ? 'Importing...' : 'Submit'}
          </button>
        </div>

        {msg && (
          <div className="mt-4 rounded-md px-3 py-2 text-sm"
            style={{
              background: msg.kind === 'ok' ? (isDark ? '#052e16' : '#ecfdf5') : (isDark ? '#3b0a0a' : '#fef2f2'),
              color: msg.kind === 'ok' ? (isDark ? '#86efac' : '#065f46') : (isDark ? '#fca5a5' : '#991b1b'),
              border: `1px solid ${msg.kind === 'ok' ? '#10b981' : '#ef4444'}`,
            }}>{msg.text}</div>
        )}

        <div className="mt-6">
          <button onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 rounded-[3px] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#059669]"
            style={{ background: '#00a65a' }}>
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download template file
          </button>
        </div>
      </div>

      <div className="rounded-2xl p-6 md:p-8 shadow-sm" style={{ background: CARD_BG, border: `1px solid ${CARD_BD}` }}>
        <h3 className="text-[24px] font-normal mb-4" style={{ color: isDark ? '#818cf8' : '#3730a3' }}>Instructions</h3>

        <p className="text-[17px] font-semibold" style={{ color: TEXT }}>Carefully follow the instructions before importing the file.</p>
        <p className="text-[16px] mb-5" style={{ color: TEXT_MUTED }}>The columns of the CSV file should be in the following order.</p>

        <div className="overflow-x-auto">
          <table className="w-full text-[14px] md:text-[15px] border-collapse">
            <thead>
              <tr style={{ background: isDark ? '#20252c' : '#fafafa' }}>
                <th className="px-3 py-2.5 text-left font-bold w-[12%]" style={{ color: TEXT, borderBottom: `2px solid ${CARD_BD}` }}>Column Number</th>
                <th className="px-3 py-2.5 text-left font-bold w-[28%]" style={{ color: TEXT, borderBottom: `2px solid ${CARD_BD}` }}>Column Name</th>
                <th className="px-3 py-2.5 text-left font-bold" style={{ color: TEXT, borderBottom: `2px solid ${CARD_BD}` }}>Instruction</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((c, i) => {
                const alt = i % 2 === 0
                return (
                  <tr key={c.n} style={{ background: alt ? (isDark ? '#1f242b' : '#fafafa') : CARD_BG, borderBottom: `1px solid ${CARD_BD}` }}>
                    <td className="px-3 py-2 font-medium align-top" style={{ color: TEXT }}>{c.n}</td>
                    <td className="px-3 py-2 align-top" style={{ color: TEXT }}>
                      <span className="font-medium">{c.name}</span>
                      {c.req ? <span className="text-[#6b7280] dark:text-[#9aa3ad]"> <em>(Required)</em></span>
                               : (c.note === 'Optional' ? <span className="text-[#6b7280] dark:text-[#9aa3ad]"> <em>(Optional)</em></span> : null)}
                    </td>
                    <td className="px-3 py-2 align-top" style={{ color: TEXT }}>
                      {c.instr}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Price Groups — alternate Perfex "DataTables" layout per screenshot:
//   • Plain rounded white card (no green top border)
//   • Title "All Selling Price Group" + help subtitle
//   • Purple rounded +Add button top-right
//   • Toolbar: outlined buttons Export CSV, Export Excel, Print, Column visibility, Export PDF
//   • Default 25 entries, Search box on right
//   • Columns: Name (sort) | Description (sort) | Action
//   • Action row: purple outlined Edit, red outlined Delete, red outlined Deactivate (power icon, toggles to Activate)
//   • Previous / numbered / Next pagination with blue active page
// ---------------------------------------------------------------------------
type PriceGroup = InvPriceGroup

export function InvPriceGroups() {
  const [items, setItemsState] = useState<PriceGroup[]>(() => loadPriceGroups())
  const persist = (next: PriceGroup[]) => { setItemsState(next); savePriceGroups(next) }
  const [q, setQ] = useState('')
  const [showEntries, setShowEntries] = useState(25)
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<'name' | 'description'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [modal, setModal] = useState<{
    open: boolean; editing: PriceGroup | null; name: string; description: string; errors: Record<string, string>; version: number;
  }>({ open: false, editing: null, name: '', description: '', errors: {}, version: 0 })
  const [saving, setSaving] = useState(false)
  const [nextId, setNextId] = useState(() => Math.max(0, ...items.map((x: any) => x.id)) + 1)
  const [busy, setBusy] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')
  const [done, setDone] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark')); sync()
    const obs = new MutationObserver(sync); obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const openAdd = () => setModal({ open: true, editing: null, name: '', description: '', errors: {}, version: Date.now() })
  const openEdit = (pg: PriceGroup) => setModal({ open: true, editing: pg, name: pg.name, description: pg.description, errors: {}, version: Date.now() })
  const closeModal = () => setModal((m) => ({ ...m, open: false, editing: null }))

  const toggleSort = (key: 'name' | 'description') => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const save = async () => {
    const errs: Record<string, string> = {}
    if (!modal.name.trim()) errs.name = 'Name is required'
    setModal((m) => ({ ...m, errors: errs }))
    if (Object.keys(errs).length) return
    setSaving(true); await new Promise((r) => setTimeout(r, 200))
    if (modal.editing) {
      persist(items.map((it) => it.id === modal.editing!.id ? { ...it, name: modal.name.trim(), description: modal.description.trim() } : it))
    } else {
      const id = nextId
      persist([...items, { id, name: modal.name.trim(), description: modal.description.trim(), active: true }])
      setNextId(id + 1)
    }
    setSaving(false); closeModal()
  }

  const removeItem = (id: number) => {
    if (!window.confirm('Delete this price group?')) return
    persist(items.filter((it) => it.id !== id))
  }
  const toggleActive = (id: number) => {
    persist(items.map((it) => it.id === id ? { ...it, active: !it.active } : it))
  }

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    let list = items
    if (ql) list = list.filter((p) => p.name.toLowerCase().includes(ql) || p.description.toLowerCase().includes(ql))
    list = [...list].sort((a, b) => {
      const av = a[sortKey].toLowerCase(), bv = b[sortKey].toLowerCase()
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [items, q, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / showEntries))
  const paged = filtered.slice((page - 1) * showEntries, page * showEntries)
  const startIdx = filtered.length === 0 ? 0 : (page - 1) * showEntries + 1
  const endIdx = Math.min(page * showEntries, filtered.length)

  const flashDone = (w: 'csv' | 'excel' | 'print' | 'pdf') => { setDone(w); window.setTimeout(() => setDone(''), 1500) }
  const handlePrint = () => { setBusy('print'); window.setTimeout(() => { window.print(); setBusy(''); flashDone('print') }, 150) }
  const handlePdf = () => { setBusy('pdf'); window.setTimeout(() => { window.print(); setBusy(''); flashDone('pdf') }, 150) }
  const handleCsv = () => {
    setBusy('csv')
    const headers = ['#', 'Name', 'Description']
    const rows = items.map((p, i) => [String(i + 1), p.name, p.description])
    const csv = [headers, ...rows].map((r) => r.map((c) => {
      const s = String(c ?? '').replace(/"/g, '""')
      return /[",\n]/.test(s) ? `"${s}"` : s
    }).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'price-groups.csv'; document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    setBusy(''); flashDone('csv')
  }
  const handleExcel = async () => {
    setBusy('excel')
    const rows = items.map((p, i) => ({ '#': i + 1, Name: p.name, Description: p.description }))
    const ok = await exportExcel('price-groups', rows); setBusy(''); if (ok) flashDone('excel')
  }

  // Theme colors
  const CARD_BG        = isDark ? '#1b1f24' : '#ffffff'
  const TEXT           = isDark ? '#e5e7eb' : '#32383e'
  const TEXT_MUTED     = isDark ? '#9aa3ad' : '#6b7280'
  const TEXT_HELP      = isDark ? '#9aa3ad' : '#6b7280'
  const BORDER         = isDark ? '#2d333a' : '#e5e7eb'
  const ROW_ALT        = isDark ? '#1f242b' : '#fafafa'
  const INPUT_BG       = isDark ? '#14171c' : '#ffffff'
  const INPUT_BORDER   = isDark ? '#49515c' : '#d1d5db'
  const INPUT_TEXT     = isDark ? '#e5e7eb' : '#111827'
  const TOOLBAR_BORDER = isDark ? '#3a424d' : '#d1d5db'
  const TOOLBAR_TEXT   = isDark ? '#cbd5e1' : '#374151'
  const TOOLBAR_HOVER  = isDark ? '#263648' : '#eef2ff'
  const PURPLE         = '#4f46e5'
  const PURPLE_DARK    = '#4338ca'
  const PURPLE_BORDER  = '#4f46e5'
  const RED            = '#ef4444'
  const RED_HOVER      = '#dc2626'
  const PAGINATION_BD  = isDark ? '#3a424d' : '#d1d5db'
  const PAGINATION_BG  = isDark ? '#20252c' : '#ffffff'

  return (
    <div id="inv-price-groups-wrap">
      <div className="rounded-xl shadow-sm dark:shadow-[0_1px_3px_rgba(0,0,0,0.5)] p-5 md:p-6" style={{ background: CARD_BG }}>
        {/* Title row */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="text-[28px] md:text-[32px] font-normal leading-tight" style={{ color: TEXT }}>All Selling Price Group</h2>
            <p className="mt-1 text-[15px]" style={{ color: TEXT_HELP }}>
              Set multiple price for products. Name different price and then update price from &quot;Update Price&quot; or List Products -&gt; Actions -&gt; Add or edit Group prices
            </p>
          </div>
          <button onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold text-white shadow-md transition hover:shadow-lg hover:brightness-110"
            style={{ background: `linear-gradient(135deg, #4f46e5, #3b82f6)` }}>
            <span className="text-2xl leading-none font-thin">+</span> Add
          </button>
        </div>

        {/* Toolbar row */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm" style={{ color: TEXT_MUTED }}>
              <span>Show</span>
              <Select value={String(showEntries)} onChange={(e) => { setShowEntries(Number(e.target.value)); setPage(1) }} className="w-20">
                <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
              </Select>
              <span>entries</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 ml-2">
              <button onClick={handleCsv} disabled={busy !== ''} title="Export CSV"
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:opacity-60"
                style={{ borderColor: TOOLBAR_BORDER, color: TOOLBAR_TEXT, background: CARD_BG }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = TOOLBAR_HOVER }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = CARD_BG }}>
                {done === 'csv' ? <Check className="size-4" style={{ color: '#10b981' }} strokeWidth={3} /> : <FileText className="size-4" />}
                Export CSV
              </button>
              <button onClick={() => void handleExcel()} disabled={busy !== ''} title="Export Excel"
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:opacity-60"
                style={{ borderColor: TOOLBAR_BORDER, color: TOOLBAR_TEXT, background: CARD_BG }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = TOOLBAR_HOVER }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = CARD_BG }}>
                {done === 'excel' ? <Check className="size-4" style={{ color: '#10b981' }} strokeWidth={3} /> : <FileSpreadsheet className="size-4" />}
                Export Excel
              </button>
              <button onClick={handlePrint} disabled={busy !== ''} title="Print"
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:opacity-60"
                style={{ borderColor: TOOLBAR_BORDER, color: TOOLBAR_TEXT, background: CARD_BG }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = TOOLBAR_HOVER }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = CARD_BG }}>
                {done === 'print' ? <Check className="size-4" style={{ color: '#10b981' }} strokeWidth={3} /> : <Printer className="size-4" />}
                Print
              </button>
              <button onClick={() => {}} disabled title="Column visibility"
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition opacity-70 cursor-not-allowed"
                style={{ borderColor: TOOLBAR_BORDER, color: TOOLBAR_TEXT, background: CARD_BG }}>
                <span className="inline-grid size-4 place-items-center border rounded-sm text-[10px] font-bold" style={{ borderColor: TOOLBAR_TEXT }}>▥</span>
                Column visibility
              </button>
              <button onClick={handlePdf} disabled={busy !== ''} title="Export PDF"
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:opacity-60"
                style={{ borderColor: TOOLBAR_BORDER, color: TOOLBAR_TEXT, background: CARD_BG }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = TOOLBAR_HOVER }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = CARD_BG }}>
                {done === 'pdf' ? <Check className="size-4" style={{ color: '#10b981' }} strokeWidth={3} /> : <FileText className="size-4" />}
                Export PDF
              </button>
            </div>
          </div>

          <div>
            <input type="text" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="Search ..."
              className="w-[220px] h-[38px] px-3 text-sm rounded-[4px] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
              style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: INPUT_TEXT }} />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                <th onClick={() => toggleSort('name')}
                  className="px-4 py-3 text-left font-bold text-[17px] cursor-pointer select-none w-[30%]" style={{ color: TEXT }}>
                  <span className="inline-flex items-center gap-2">Name
                    <span className={cn('inline-block transition-transform', sortKey === 'name' && sortDir === 'asc' && 'rotate-180')}>
                      <SortStackIcon active={sortKey === 'name'} />
                    </span>
                  </span>
                </th>
                <th onClick={() => toggleSort('description')}
                  className="px-4 py-3 text-left font-bold text-[17px] cursor-pointer select-none" style={{ color: TEXT }}>
                  <span className="inline-flex items-center gap-2">Description
                    <span className={cn('inline-block transition-transform', sortKey === 'description' && sortDir === 'asc' && 'rotate-180')}>
                      <SortUpDownIcon active={sortKey === 'description'} />
                    </span>
                  </span>
                </th>
                <th className="px-4 py-3 text-left font-bold text-[17px] w-[320px]" style={{ color: TEXT }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((pg, idx) => {
                const alt = idx % 2 === 0
                return (
                  <tr key={pg.id} className="transition-colors"
                    style={{ background: alt ? ROW_ALT : CARD_BG, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                    <td className="px-4 py-3 text-[17px] font-medium">{pg.name}</td>
                    <td className="px-4 py-3 text-[17px]">{pg.description || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => openEdit(pg)}
                          className="inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition hover:bg-indigo-50 dark:hover:bg-indigo-950"
                          style={{ borderColor: PURPLE_BORDER, color: PURPLE }}>
                          <Pencil className="size-4" strokeWidth={2.2} /> Edit
                        </button>
                        <button onClick={() => removeItem(pg.id)}
                          className="inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition hover:bg-red-50 dark:hover:bg-red-950"
                          style={{ borderColor: RED, color: RED }}>
                          <TrashIcon className="size-4" /> Delete
                        </button>
                        <button onClick={() => toggleActive(pg.id)}
                          className="inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition hover:bg-red-50 dark:hover:bg-red-950"
                          style={{ borderColor: RED, color: pg.active ? RED : '#10b981', borderStyle: 'solid', borderColor2: undefined } as any}>
                          <PowerIcon className="size-4" on={pg.active} /> {pg.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {paged.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-10 text-center text-sm" style={{ color: TEXT_MUTED }}>No entries found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: entries count + pagination */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[15px]" style={{ color: TEXT_MUTED }}>
          <span>{filtered.length === 0 ? 'No entries' : `Showing ${startIdx} to ${endIdx} of ${filtered.length} entries`}</span>
          <div className="flex items-center gap-0">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="rounded-l-md border px-4 py-1.5 text-base font-medium transition hover:bg-gray-50 dark:hover:bg-[#263648] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor: PAGINATION_BD, background: PAGINATION_BG, color: TEXT }}>Previous</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button key={n} onClick={() => setPage(n)}
                className="border-t border-b px-4 py-1.5 text-base font-semibold transition -ml-px"
                style={n === page
                  ? { background: '#2980b9', borderColor: '#2980b9', color: '#fff' }
                  : { background: PAGINATION_BG, borderColor: PAGINATION_BD, color: TEXT }}
                onMouseEnter={(e) => { if (n !== page) (e.currentTarget as HTMLButtonElement).style.background = isDark ? '#263648' : '#f3f4f6' }}
                onMouseLeave={(e) => { if (n !== page) (e.currentTarget as HTMLButtonElement).style.background = PAGINATION_BG }}>{n}</button>
            ))}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="rounded-r-md border px-4 py-1.5 text-base font-medium transition hover:bg-gray-50 dark:hover:bg-[#263648] disabled:opacity-50 disabled:cursor-not-allowed -ml-px"
              style={{ borderColor: PAGINATION_BD, background: PAGINATION_BG, color: TEXT }}>Next</button>
          </div>
        </div>
      </div>

      {/* Add / Edit Price Group modal - use default style, since this page doesn't use the blue-header modal style */}
      <Modal open={modal.open} onClose={closeModal}
        title={modal.editing ? 'Edit Price Group' : 'Add Price Group'}
        variant="perfex" size="md" key={modal.version}
        headerClassName="bg-[#337ab7]"
        closeBtnClassName="bg-[#d9230f] hover:bg-[#c1200e] rounded-[4px] size-10"
        footer={<>
          <button type="button" onClick={save} disabled={saving}
            className="rounded-[4px] bg-[#4f46e5] px-7 py-1.5 text-base font-medium text-white shadow-sm transition hover:bg-[#4338ca] disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={closeModal}
            className="rounded-[4px] bg-[#dd4b39] px-7 py-1.5 text-base font-medium text-white shadow-sm transition hover:bg-[#c9302c]">Close</button>
        </>}>
        <div className="space-y-4 py-1">
          <div>
            <label className="block text-[15px] font-semibold mb-1.5" style={{ color: isDark ? '#e5e7eb' : '#32383e' }}>
              Name <span className="text-red-500">*</span>
            </label>
            <input type="text" value={modal.name} onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))} autoFocus
              className="w-full h-[38px] px-3 text-[14px] rounded-[4px] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
              style={{ background: INPUT_BG, border: `1px solid ${modal.errors.name ? '#dc2626' : INPUT_BORDER}`, color: INPUT_TEXT }} />
            {modal.errors.name && <p className="mt-1 text-xs italic text-red-500">{modal.errors.name}</p>}
          </div>
          <div>
            <label className="block text-[15px] font-semibold mb-1.5" style={{ color: isDark ? '#e5e7eb' : '#32383e' }}>Description</label>
            <input type="text" value={modal.description} onChange={(e) => setModal((m) => ({ ...m, description: e.target.value }))}
              className="w-full h-[38px] px-3 text-[14px] rounded-[4px] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
              style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: INPUT_TEXT }} />
          </div>
        </div>
      </Modal>

      {/* Print-only block */}
      <div data-inv-pg-print aria-hidden
        style={{ position: 'fixed', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
        <style>{`
          @media print {
            html, body { background: #fff !important; color: #000 !important; }
            body * { visibility: hidden !important; }
            [data-inv-pg-print], [data-inv-pg-print] * { visibility: visible !important; }
            [data-inv-pg-print] { position: absolute !important; left: 0 !important; top: 0 !important;
              width: auto !important; height: auto !important; overflow: visible !important;
              display: block !important; padding: 24px !important; color: #000 !important; background: #fff !important; }
            [data-inv-pg-print] * { color: #000 !important; background: transparent !important; }
            [data-inv-pg-print] table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            [data-inv-pg-print] th, [data-inv-pg-print] td { border: 1px solid #666; padding: 6px 10px; font-size: 12px; text-align: left; }
            [data-inv-pg-print] th { background: #dde3ec !important; color: #000 !important; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            [data-inv-pg-print] h1 { font-size: 20px; margin: 0 0 4px; color: #000 !important; }
            [data-inv-pg-print] .sub { font-size: 12px; color: #333 !important; margin-bottom: 8px; }
          }
        `}</style>
        <h1>All Selling Price Group</h1>
        <div className="sub">Printed {new Date().toLocaleString()} · FitPro Gym App</div>
        <table>
          <thead><tr><th>#</th><th>Name</th><th>Description</th></tr></thead>
          <tbody>{filtered.map((p, i) => (<tr key={p.id}><td>{i + 1}</td><td>{p.name}</td><td>{p.description || '—'}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  )
}

// Inline icons for Price Groups page
function SortStackIcon({ active }: { active?: boolean }) {
  return (
    <svg className="size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      style={{ opacity: active ? 1 : 0.5 }}>
      <path d="M3 6h13" /><path d="M3 12h9" /><path d="M3 18h5" />
      <path d="M19 6v12l-3-3" /><path d="M19 18l3-3" />
    </svg>
  )
}
function SortUpDownIcon({ active }: { active?: boolean }) {
  return (
    <svg className="size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      style={{ opacity: active ? 1 : 0.5 }}>
      <path d="M7 3v18" /><path d="m3 7 4-4 4 4" /><path d="m17 21-4-4 4-4" /><path d="M17 21V3" />
    </svg>
  )
}
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}
function PowerIcon({ className, on }: { className?: string; on: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v10" /><path d="M18.4 6.6a9 9 0 1 1-12.77.04" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Categories (product categories) — CRUD matching Perfex screenshot.
// Persisted to localStorage.
// ---------------------------------------------------------------------------
type Category = InvCategory

const SEED_CATEGORIES: Category[] = SEED_INV_CATEGORIES

export function InvCategories() {
  const [items, setItemsState] = useState<Category[]>(() => loadCategories())
  const persist = (next: Category[]) => { setItemsState(next); saveCategories(next) }
  const [q, setQ] = useState('')
  const [showEntries, setShowEntries] = useState(10)
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<'id' | 'name' | 'code' | 'description' | 'status'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [modal, setModal] = useState<{
    open: boolean; editing: Category | null; name: string; code: string; description: string;
    status: 'Active' | 'Inactive'; asSub: boolean; parentId: number | '';
    errors: Record<string, string>; version: number;
  }>({ open: false, editing: null, name: '', code: '', description: '', status: 'Active', asSub: false, parentId: '', errors: {}, version: 0 })
  const [saving, setSaving] = useState(false)
  const [nextId, setNextId] = useState(() => Math.max(0, ...items.map((x: any) => x.id)) + 1)
  const [busy, setBusy] = useState<'' | 'print' | 'pdf' | 'excel'>('')
  const [done, setDone] = useState<'' | 'print' | 'pdf' | 'excel'>('')
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark')); sync()
    const obs = new MutationObserver(sync); obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const parentOptions = useMemo(() => items.filter((c) => !c.parentId).sort((a, b) => a.name.localeCompare(b.name)), [items])

  const openAdd = () => setModal({ open: true, editing: null, name: '', code: '', description: '', status: 'Active', asSub: false, parentId: '', errors: {}, version: Date.now() })
  const openEdit = (c: Category) => setModal({ open: true, editing: c, name: c.name, code: c.code, description: c.description, status: c.status, asSub: c.parentId != null, parentId: c.parentId ?? '', errors: {}, version: Date.now() })
  const closeModal = () => setModal((m) => ({ ...m, open: false, editing: null }))

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const save = async () => {
    const errs: Record<string, string> = {}
    if (!modal.name.trim()) errs.name = 'Category Name is required'
    if (modal.asSub && modal.parentId === '') errs.parentId = 'Please select a parent category'
    setModal((m) => ({ ...m, errors: errs }))
    if (Object.keys(errs).length) return
    setSaving(true); await new Promise((r) => setTimeout(r, 200))
    const parentId = modal.asSub ? Number(modal.parentId) : null
    const code = modal.code.trim().toUpperCase() || modal.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'CAT'
    if (modal.editing) {
      persist(items.map((it) => it.id === modal.editing!.id ? { ...it, name: modal.name.trim(), code, description: modal.description.trim(), status: modal.status, parentId } : it))
    } else {
      const id = nextId
      persist([...items, { id, name: modal.name.trim(), code, description: modal.description.trim(), status: modal.status, parentId }])
      setNextId(id + 1)
    }
    setSaving(false); closeModal()
  }

  const removeItem = (id: number) => {
    if (!window.confirm('Delete this category?')) return
    persist(items.filter((c) => c.id !== id))
  }

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    let list = items
    if (ql) list = list.filter((c) => c.name.toLowerCase().includes(ql) || c.code.toLowerCase().includes(ql) || c.description.toLowerCase().includes(ql))
    list = [...list].sort((a, b) => {
      let av: string | number = '', bv: string | number = ''
      if (sortKey === 'id') { av = a.id; bv = b.id }
      else if (sortKey === 'status') { av = a.status; bv = b.status }
      else { av = String((a as any)[sortKey] ?? '').toLowerCase(); bv = String((b as any)[sortKey] ?? '').toLowerCase() }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [items, q, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / showEntries))
  const paged = filtered.slice((page - 1) * showEntries, page * showEntries)
  const startIdx = filtered.length === 0 ? 0 : (page - 1) * showEntries + 1
  const endIdx = Math.min(page * showEntries, filtered.length)

  const flashDone = (w: 'print' | 'pdf' | 'excel') => { setDone(w); window.setTimeout(() => setDone(''), 1500) }
  const handlePrint = () => { setBusy('print'); window.setTimeout(() => { window.print(); setBusy(''); flashDone('print') }, 150) }
  const handlePdf = () => { setBusy('pdf'); window.setTimeout(() => { window.print(); setBusy(''); flashDone('pdf') }, 150) }
  const handleExcel = async () => {
    setBusy('excel')
    const rows = items.map((c, i) => ({ '#': i + 1, Category: c.name, Code: c.code, Description: c.description, Status: c.status }))
    const ok = await exportExcel('categories', rows); setBusy(''); if (ok) flashDone('excel')
  }

  const CARD_BG        = isDark ? '#1b1f24' : '#ffffff'
  const CARD_BORDER    = isDark ? '#2d333a' : '#e7e7e2'
  const TEXT           = isDark ? '#e5e7eb' : '#32383e'
  const TEXT_MUTED     = isDark ? '#9aa3ad' : '#555'
  const HEADER_BG      = isDark ? '#1b1f24' : '#ffffff'
  const TBL_HEADER_BG  = isDark ? '#2c3440' : '#bac4d6'
  const TBL_HEADER_TXT = isDark ? '#e5e7eb' : '#32383e'
  const TBL_BORDER     = isDark ? '#363c44' : '#dddfe3'
  const ZEBRA_BG       = isDark ? '#232830' : '#e4e7ed'
  const ZEBRA_BG_HOVER = isDark ? '#2b313b' : '#d8dce4'
  const WHITE_BG       = isDark ? '#14171c' : '#ffffff'
  const WHITE_HOVER    = isDark ? '#1f242b' : '#f0f2f5'
  const INPUT_BG       = isDark ? '#14171c' : '#ffffff'
  const INPUT_BORDER   = isDark ? '#49515c' : '#9aa0a6'
  const INPUT_TEXT     = isDark ? '#e5e7eb' : '#111827'
  const PAGINATION_BG  = isDark ? '#20252c' : '#f6f6f6'
  const PAGINATION_BD  = isDark ? '#363c44' : '#ddd'

  const SortChevron = ({ col }: { col: typeof sortKey }) => (
    <ChevronDown className={cn('ml-1 inline size-4 transition-transform', sortKey === col ? 'opacity-100' : 'opacity-50', sortKey === col && sortDir === 'asc' && 'rotate-180')} style={{ color: TBL_HEADER_TXT }} />
  )

  return (
    <div id="inv-categories-wrap">
      <div className="rounded-[3px] shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.5)] overflow-hidden"
        style={{ background: CARD_BG, borderTop: '3px solid #00a65a' }}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b"
          style={{ background: HEADER_BG, borderColor: CARD_BORDER }}>
          <h3 className="flex items-center gap-2 text-[22px] font-normal" style={{ color: TEXT }}>
            <Menu className="size-[22px]" style={{ color: isDark ? '#c8f542' : '#444' }} strokeWidth={1.5} /> Category
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={openAdd}
              className="inline-flex items-center gap-1.5 rounded-[3px] bg-[#284a72] px-3 py-[6px] text-sm font-semibold text-white shadow-sm hover:bg-[#1f3a5c] transition-colors">
              <CirclePlus className="size-[18px]" strokeWidth={2} /> Add</button>
            <button title="Print" onClick={handlePrint} disabled={busy !== ''}
              className="relative grid size-9 place-items-center rounded-full border-2 border-[#337ab7] bg-[#337ab7] text-white hover:bg-[#286090] transition disabled:opacity-70 disabled:cursor-wait">
              {done === 'print' ? <Check className="size-4" strokeWidth={3} /> : <Printer className="size-4" />}
              {busy === 'print' && <span className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-white animate-pulse" />}
            </button>
            <button title="Save as PDF" onClick={handlePdf} disabled={busy !== ''}
              className="relative grid size-9 place-items-center rounded-full border-2 border-[#e48aa5] bg-[#f4a6bc] text-white hover:bg-[#ea8fa9] transition disabled:opacity-70 disabled:cursor-wait">
              {done === 'pdf' ? <Check className="size-4" strokeWidth={3} /> : <FileText className="size-4" />}
              {busy === 'pdf' && <span className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-white animate-pulse" />}
            </button>
            <button title="Export as Excel (.xlsx)" onClick={() => void handleExcel()} disabled={busy !== ''}
              className="relative grid size-9 place-items-center rounded-full border-2 border-[#4cae4c] bg-[#5cb85c] text-white hover:bg-[#449d44] transition disabled:opacity-70 disabled:cursor-wait">
              {done === 'excel' ? <Check className="size-4" strokeWidth={3} /> : <FileSpreadsheet className="size-4" />}
              {busy === 'excel' && <span className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-white animate-pulse" />}
            </button>
          </div>
        </div>

        <div className="px-4 pb-4" style={{ background: CARD_BG }}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm" style={{ color: TEXT_MUTED }}>
            <div className="flex items-center gap-2">
              <span>Show</span>
              <Select value={String(showEntries)} onChange={(e) => { setShowEntries(Number(e.target.value)); setPage(1) }} className="w-20">
                <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
              </Select><span>entries</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Search:</span>
              <input type="text" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }}
                className="w-[200px] h-[32px] px-2 text-sm rounded-[2px] focus:outline-none focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30"
                style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: INPUT_TEXT }} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  {([
                    { k: 'id' as const,          label: '#',            w: 'w-14' },
                    { k: 'name' as const,        label: 'Category',     w: '' },
                    { k: 'code' as const,        label: 'Code',         w: 'w-28' },
                    { k: 'description' as const, label: 'Description', w: '' },
                    { k: 'status' as const,      label: 'Status',       w: 'w-28' },
                  ]).map((h) => (
                    <th key={h.k} onClick={() => toggleSort(h.k)}
                      className={cn('px-3 py-2 text-left font-semibold border cursor-pointer select-none', h.w)}
                      style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}>
                      <span className="inline-flex items-center gap-1">{h.label}<SortChevron col={h.k} /></span>
                    </th>
                  ))}
                  <th className="w-44 px-3 py-2 text-right font-semibold border"
                    style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((c, idx) => {
                  const globalIdx = (page - 1) * showEntries + idx + 1
                  const zebra = idx % 2 === 0
                  return (
                    <tr key={c.id} className="transition-colors"
                      style={{ background: zebra ? ZEBRA_BG : WHITE_BG, color: TEXT }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = zebra ? ZEBRA_BG_HOVER : WHITE_HOVER }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = zebra ? ZEBRA_BG : WHITE_BG }}>
                      <td className="px-3 py-2.5 border font-medium" style={{ borderColor: TBL_BORDER }}>{globalIdx}</td>
                      <td className="px-3 py-2.5 border font-medium" style={{ borderColor: TBL_BORDER }}>{c.name}</td>
                      <td className="px-3 py-2.5 border" style={{ borderColor: TBL_BORDER }}>{c.code}</td>
                      <td className="px-3 py-2.5 border" style={{ borderColor: TBL_BORDER }}>{c.description || '—'}</td>
                      <td className="px-3 py-2.5 border" style={{ borderColor: TBL_BORDER }}>
                        <span className="inline-block rounded-full border border-emerald-500 px-3 py-0.5 text-xs font-bold text-emerald-600 bg-transparent"
                          style={c.status !== 'Active' ? { borderColor: '#f59e0b', color: '#b45309' } : undefined}>{c.status}</span>
                      </td>
                      <td className="px-3 py-2.5 border" style={{ borderColor: TBL_BORDER }}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => persist(items.map((x) => x.id === c.id ? { ...x, status: x.status === 'Active' ? 'Inactive' : 'Active' } : x))}
                            className={cn('inline-flex items-center gap-1 rounded-[3px] px-3 py-1 text-xs font-semibold transition-colors',
                              c.status === 'Active'
                                ? 'border border-amber-500 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-500/10 bg-transparent'
                                : 'border border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 bg-transparent')}>
                            <PowerIcon className="size-3.5" on={c.status !== 'Active'} /> {c.status === 'Active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button onClick={() => openEdit(c)}
                            className="inline-flex items-center gap-1 rounded-[3px] bg-[#284a72] px-3 py-1 text-xs font-semibold text-white hover:bg-[#1f3a5c] transition-colors">
                            <Pencil className="size-3.5" strokeWidth={2} /> Edit</button>
                          <button onClick={() => removeItem(c.id)}
                            className="inline-flex items-center gap-1 rounded-[3px] border border-red-500 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 bg-transparent transition-colors">
                            <TrashIcon className="size-3.5" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {paged.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-sm border"
                    style={{ color: TEXT_MUTED, borderColor: TBL_BORDER, background: WHITE_BG }}>No entries found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm" style={{ color: TEXT_MUTED }}>
            <span>{filtered.length === 0 ? 'No entries' : `Showing ${startIdx} to ${endIdx} of ${filtered.length} entries`}</span>
            <div className={cn('flex items-center gap-0', totalPages <= 1 && 'opacity-50 pointer-events-none')}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="grid size-8 place-items-center rounded-l border transition hover:brightness-110 disabled:opacity-50"
                style={{ background: PAGINATION_BG, borderColor: PAGINATION_BD, color: '#337ab7' }}>
                <ChevronLeft className="size-4" /></button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button key={n} onClick={() => setPage(n)}
                  className={cn('grid size-8 place-items-center border-t border-b transition', n > 1 && '-ml-px')}
                  style={n === page
                    ? { background: '#284a72', borderColor: '#284a72', color: '#fff', fontWeight: 600, borderLeft: '1px solid #284a72', borderRight: '1px solid #284a72' }
                    : { background: PAGINATION_BG, borderColor: PAGINATION_BD, color: '#337ab7' }}
                  onMouseEnter={(e) => { if (n !== page) (e.currentTarget as HTMLButtonElement).style.background = isDark ? '#2b313b' : '#eaeaea' }}
                  onMouseLeave={(e) => { if (n !== page) (e.currentTarget as HTMLButtonElement).style.background = PAGINATION_BG }}>{n}</button>
              ))}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="grid size-8 place-items-center rounded-r border transition hover:brightness-110 disabled:opacity-50 -ml-px"
                style={{ background: PAGINATION_BG, borderColor: PAGINATION_BD, color: '#337ab7' }}>
                <ChevronRight className="size-4" /></button>
            </div>
          </div>
        </div>
      </div>

      <Modal open={modal.open} onClose={closeModal}
        title={modal.editing ? 'Edit Category' : 'Add Category'}
        variant="perfex" size="lg" key={modal.version}
        headerClassName="bg-[#337ab7]"
        closeBtnClassName="bg-[#d9230f] hover:bg-[#c1200e] rounded-[4px] size-11"
        footer={<>
          <button type="button" onClick={save} disabled={saving}
            className="rounded-[4px] bg-[#284a72] px-8 py-2 text-lg font-medium text-white shadow-sm transition hover:bg-[#1f3a5c] disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={closeModal}
            className="rounded-[4px] bg-[#dd4b39] px-8 py-2 text-lg font-medium text-white shadow-sm transition hover:bg-[#c9302c]">Close</button>
        </>}>
        <div className="space-y-4 py-1">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
            <div>
              <label className="block text-[17px] font-semibold mb-1.5" style={{ color: isDark ? '#e5e7eb' : '#1f2937' }}>
                Category Name <span className="text-red-500">*</span></label>
              <input type="text" value={modal.name} onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))} autoFocus
                className="w-full h-[42px] px-3 text-[15px] rounded-[8px] focus:outline-none focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30"
                style={{ background: INPUT_BG, border: `1px solid ${modal.errors.name ? '#dc2626' : INPUT_BORDER}`, color: INPUT_TEXT, borderRadius: 10 }} />
              {modal.errors.name && <p className="mt-1 text-xs italic text-red-500">{modal.errors.name}</p>}
            </div>
            <div>
              <label className="block text-[17px] font-semibold mb-1.5" style={{ color: isDark ? '#e5e7eb' : '#1f2937' }}>Category Code</label>
              <input type="text" value={modal.code} onChange={(e) => setModal((m) => ({ ...m, code: e.target.value }))} placeholder="e.g. CLT"
                className="w-full h-[42px] px-3 text-[15px] uppercase rounded-[8px] focus:outline-none focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30"
                style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: INPUT_TEXT, borderRadius: 10 }} />
            </div>
          </div>
          <div>
            <label className="block text-[17px] font-semibold mb-1.5" style={{ color: isDark ? '#e5e7eb' : '#1f2937' }}>Short Description</label>
            <input type="text" value={modal.description} onChange={(e) => setModal((m) => ({ ...m, description: e.target.value }))}
              className="w-full h-[42px] px-3 text-[15px] rounded-[8px] focus:outline-none focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30"
              style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: INPUT_TEXT, borderRadius: 10 }} />
          </div>
          <div className="max-w-xs">
            <label className="block text-[17px] font-semibold mb-1.5" style={{ color: isDark ? '#e5e7eb' : '#1f2937' }}>Status <span className="text-red-500">*</span></label>
            <Select value={modal.status} onChange={(e) => setModal((m) => ({ ...m, status: e.target.value as 'Active' | 'Inactive' }))}>
              <option value="Active">ACTIVE</option><option value="Inactive">INACTIVE</option>
            </Select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none pt-1" style={{ color: isDark ? '#e5e7eb' : '#1f2937' }}>
            <button type="button" role="checkbox" aria-checked={modal.asSub}
              onClick={() => setModal((m) => ({ ...m, asSub: !m.asSub, parentId: !m.asSub ? m.parentId : '' }))}
              className="grid size-7 place-items-center rounded-md border-2 transition"
              style={{ background: modal.asSub ? '#337ab7' : 'transparent', borderColor: modal.asSub ? '#337ab7' : (isDark ? '#8fa2b8' : '#9aa0a6'), color: '#fff' }}>
              {modal.asSub && <Check className="size-5" strokeWidth={3} />}
            </button>
            <span className="text-[17px] font-medium">Add as sub category</span>
          </label>
          {modal.asSub && (
            <div className="max-w-md">
              <Select value={String(modal.parentId)}
                onChange={(e) => setModal((m) => ({ ...m, parentId: e.target.value ? Number(e.target.value) : '' }))}>
                <option value="">Please Select...</option>
                {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
              {modal.errors.parentId && <p className="mt-1 text-xs italic text-red-500">{modal.errors.parentId}</p>}
            </div>
          )}
        </div>
      </Modal>

      <div data-inv-cat-print aria-hidden
        style={{ position: 'fixed', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
        <style>{`
          @media print {
            html, body { background: #fff !important; color: #000 !important; }
            body * { visibility: hidden !important; }
            [data-inv-cat-print], [data-inv-cat-print] * { visibility: visible !important; }
            [data-inv-cat-print] { position: absolute !important; left: 0 !important; top: 0 !important;
              width: auto !important; height: auto !important; overflow: visible !important;
              display: block !important; padding: 24px !important; color: #000 !important; background: #fff !important; }
            [data-inv-cat-print] * { color: #000 !important; background: transparent !important; }
            [data-inv-cat-print] table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            [data-inv-cat-print] th, [data-inv-cat-print] td { border: 1px solid #666; padding: 6px 10px; font-size: 12px; text-align: left; }
            [data-inv-cat-print] th { background: #dde3ec !important; color: #000 !important; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            [data-inv-cat-print] tr:nth-child(even) td { background: #f3f5f8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            [data-inv-cat-print] h1 { font-size: 20px; margin: 0 0 4px; color: #000 !important; }
            [data-inv-cat-print] .sub { font-size: 12px; color: #333 !important; margin-bottom: 8px; }
          }
        `}</style>
        <h1>Category List</h1>
        <div className="sub">Printed {new Date().toLocaleString()} · FitPro Gym App</div>
        <table>
          <thead><tr><th>#</th><th>Category</th><th>Code</th><th>Description</th><th>Status</th></tr></thead>
          <tbody>{filtered.map((c, i) => (<tr key={c.id}><td>{i + 1}</td><td>{c.name}</td><td>{c.code}</td><td>{c.description || '—'}</td><td>{c.status}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Units — CRUD matching Perfex screenshot:
//   • Green-top card, 10 entries default, Search
//   • Columns # | Name (sort) | Short Name (sort) | Allow Decimal (sort) | Status (sort) | Action
//   • Allow Decimal shows YES/NO; column header has info ⓘ icon
//   • Green-outlined Active pill + navy Edit button
//   • Blue-header modal: Name* + Short Name (top row), Allow Decimal dropdown ("Please Select...") + Status* (second row),
//     blue-checked checkbox "Add as multiple of other unit" with info ⓘ,
//     when checked reveals "1 [Unit] = [times base unit] [Select base unit]" row.
// ---------------------------------------------------------------------------
type Unit = InvUnit

const SEED_UNITS: Unit[] = SEED_INV_UNITS

export function InvUnits() {
  const [items, setItemsState] = useState<Unit[]>(() => loadUnits())
  const persist = (next: Unit[]) => { setItemsState(next); saveUnits(next) }
  const [q, setQ] = useState('')
  const [showEntries, setShowEntries] = useState(10)
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<'id' | 'name' | 'shortName' | 'allowDecimal' | 'status'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [modal, setModal] = useState<{
    open: boolean; editing: Unit | null;
    name: string; shortName: string; allowDecimal: 'YES' | 'NO' | ''; status: 'Active' | 'Inactive';
    asMultiple: boolean; multiplier: string; baseUnitId: number | '';
    errors: Record<string, string>; version: number;
  }>({ open: false, editing: null, name: '', shortName: '', allowDecimal: '', status: 'Active', asMultiple: false, multiplier: '', baseUnitId: '', errors: {}, version: 0 })
  const [saving, setSaving] = useState(false)
  const [nextId, setNextId] = useState(() => Math.max(0, ...items.map((x: any) => x.id)) + 1)
  const [busy, setBusy] = useState<'' | 'print' | 'pdf' | 'excel'>('')
  const [done, setDone] = useState<'' | 'print' | 'pdf' | 'excel'>('')
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark')); sync()
    const obs = new MutationObserver(sync); obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const openAdd = () => setModal({ open: true, editing: null, name: '', shortName: '', allowDecimal: '', status: 'Active', asMultiple: false, multiplier: '', baseUnitId: '', errors: {}, version: Date.now() })
  const openEdit = (u: Unit) => setModal({ open: true, editing: u, name: u.name, shortName: u.shortName, allowDecimal: u.allowDecimal, status: u.status, asMultiple: u.baseUnitId != null, multiplier: u.multiplier != null ? String(u.multiplier) : '', baseUnitId: u.baseUnitId ?? '', errors: {}, version: Date.now() })
  const closeModal = () => setModal((m) => ({ ...m, open: false, editing: null }))

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const save = async () => {
    const errs: Record<string, string> = {}
    if (!modal.name.trim()) errs.name = 'Unit Name is required'
    if (!modal.allowDecimal) errs.allowDecimal = 'Please select Allow Decimal'
    if (modal.asMultiple) {
      const n = parseFloat(modal.multiplier)
      if (!modal.multiplier.trim() || isNaN(n) || n <= 0) errs.multiplier = 'Enter a valid multiplier'
      if (modal.baseUnitId === '') errs.baseUnitId = 'Please select a base unit'
    }
    setModal((m) => ({ ...m, errors: errs }))
    if (Object.keys(errs).length) return
    setSaving(true); await new Promise((r) => setTimeout(r, 200))
    const baseId = modal.asMultiple && modal.baseUnitId !== '' ? Number(modal.baseUnitId) : null
    const mult = modal.asMultiple ? parseFloat(modal.multiplier) : null
    if (modal.editing) {
      persist(items.map((it) => it.id === modal.editing!.id
        ? { ...it, name: modal.name.trim(), shortName: modal.shortName.trim(), allowDecimal: modal.allowDecimal, status: modal.status, baseUnitId: baseId, multiplier: mult } : it))
    } else {
      const id = nextId
      persist([...items, { id, name: modal.name.trim(), shortName: modal.shortName.trim(), allowDecimal: modal.allowDecimal, status: modal.status, baseUnitId: baseId, multiplier: mult }])
      setNextId(id + 1)
    }
    setSaving(false); closeModal()
  }

  const removeItem = (id: number) => {
    if (!window.confirm('Delete this unit?')) return
    persist(items.filter((u) => u.id !== id))
  }

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    let list = items
    if (ql) list = list.filter((u) =>
      u.name.toLowerCase().includes(ql) ||
      u.shortName.toLowerCase().includes(ql) ||
      (u.allowDecimal || '').toLowerCase().includes(ql))
    list = [...list].sort((a, b) => {
      let av: string | number = '', bv: string | number = ''
      if (sortKey === 'id') { av = a.id; bv = b.id }
      else if (sortKey === 'allowDecimal') { av = a.allowDecimal || ''; bv = b.allowDecimal || '' }
      else if (sortKey === 'status') { av = a.status; bv = b.status }
      else { av = String((a as any)[sortKey] ?? '').toLowerCase(); bv = String((b as any)[sortKey] ?? '').toLowerCase() }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [items, q, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / showEntries))
  const paged = filtered.slice((page - 1) * showEntries, page * showEntries)
  const startIdx = filtered.length === 0 ? 0 : (page - 1) * showEntries + 1
  const endIdx = Math.min(page * showEntries, filtered.length)

  const flashDone = (w: 'print' | 'pdf' | 'excel') => { setDone(w); window.setTimeout(() => setDone(''), 1500) }
  const handlePrint = () => { setBusy('print'); window.setTimeout(() => { window.print(); setBusy(''); flashDone('print') }, 150) }
  const handlePdf = () => { setBusy('pdf'); window.setTimeout(() => { window.print(); setBusy(''); flashDone('pdf') }, 150) }
  const handleExcel = async () => {
    setBusy('excel')
    const rows = items.map((u, i) => ({ '#': i + 1, Name: u.name, 'Short Name': u.shortName, 'Allow Decimal': u.allowDecimal || '', Status: u.status }))
    const ok = await exportExcel('units', rows); setBusy(''); if (ok) flashDone('excel')
  }

  const CARD_BG        = isDark ? '#1b1f24' : '#ffffff'
  const CARD_BORDER    = isDark ? '#2d333a' : '#e7e7e2'
  const TEXT           = isDark ? '#e5e7eb' : '#32383e'
  const TEXT_MUTED     = isDark ? '#9aa3ad' : '#555'
  const HEADER_BG      = isDark ? '#1b1f24' : '#ffffff'
  const TBL_HEADER_BG  = isDark ? '#2c3440' : '#bac4d6'
  const TBL_HEADER_TXT = isDark ? '#e5e7eb' : '#32383e'
  const TBL_BORDER     = isDark ? '#363c44' : '#dddfe3'
  const ZEBRA_BG       = isDark ? '#232830' : '#e4e7ed'
  const ZEBRA_BG_HOVER = isDark ? '#2b313b' : '#d8dce4'
  const WHITE_BG       = isDark ? '#14171c' : '#ffffff'
  const WHITE_HOVER    = isDark ? '#1f242b' : '#f0f2f5'
  const INPUT_BG       = isDark ? '#14171c' : '#ffffff'
  const INPUT_BORDER   = isDark ? '#49515c' : '#9aa0a6'
  const INPUT_TEXT     = isDark ? '#e5e7eb' : '#111827'
  const PAGINATION_BG  = isDark ? '#20252c' : '#f6f6f6'
  const PAGINATION_BD  = isDark ? '#363c44' : '#ddd'

  // For base unit dropdown — exclude the unit being edited (can't be multiple of itself)
  const baseUnitOptions = useMemo(
    () => items.filter((u) => !modal.editing || u.id !== modal.editing.id).sort((a, b) => a.name.localeCompare(b.name)),
    [items, modal.editing]
  )

  const SortChevron = ({ col }: { col: typeof sortKey }) => (
    <ChevronDown className={cn('ml-1 inline size-4 transition-transform', sortKey === col ? 'opacity-100' : 'opacity-50', sortKey === col && sortDir === 'asc' && 'rotate-180')} style={{ color: TBL_HEADER_TXT }} />
  )

  // Info (ⓘ) icon used in column header and checkbox label
  const InfoIcon = ({ title }: { title: string }) => (
    <span title={title} className="inline-grid size-[18px] place-items-center rounded-full bg-[#5bc0de] text-white text-[11px] font-bold cursor-help select-none" style={{ lineHeight: 1 }}>i</span>
  )

  return (
    <div id="inv-units-wrap">
      <div className="rounded-[3px] shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.5)] overflow-hidden"
        style={{ background: CARD_BG, borderTop: '3px solid #00a65a' }}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b"
          style={{ background: HEADER_BG, borderColor: CARD_BORDER }}>
          <h3 className="flex items-center gap-2 text-[22px] font-normal" style={{ color: TEXT }}>
            <Menu className="size-[22px]" style={{ color: isDark ? '#c8f542' : '#444' }} strokeWidth={1.5} /> Units
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={openAdd}
              className="inline-flex items-center gap-1.5 rounded-[3px] bg-[#284a72] px-3 py-[6px] text-sm font-semibold text-white shadow-sm hover:bg-[#1f3a5c] transition-colors">
              <CirclePlus className="size-[18px]" strokeWidth={2} /> Add</button>
            <button title="Print" onClick={handlePrint} disabled={busy !== ''}
              className="relative grid size-9 place-items-center rounded-full border-2 border-[#337ab7] bg-[#337ab7] text-white hover:bg-[#286090] transition disabled:opacity-70 disabled:cursor-wait">
              {done === 'print' ? <Check className="size-4" strokeWidth={3} /> : <Printer className="size-4" />}
              {busy === 'print' && <span className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-white animate-pulse" />}
            </button>
            <button title="Save as PDF" onClick={handlePdf} disabled={busy !== ''}
              className="relative grid size-9 place-items-center rounded-full border-2 border-[#e48aa5] bg-[#f4a6bc] text-white hover:bg-[#ea8fa9] transition disabled:opacity-70 disabled:cursor-wait">
              {done === 'pdf' ? <Check className="size-4" strokeWidth={3} /> : <FileText className="size-4" />}
              {busy === 'pdf' && <span className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-white animate-pulse" />}
            </button>
            <button title="Export as Excel (.xlsx)" onClick={() => void handleExcel()} disabled={busy !== ''}
              className="relative grid size-9 place-items-center rounded-full border-2 border-[#4cae4c] bg-[#5cb85c] text-white hover:bg-[#449d44] transition disabled:opacity-70 disabled:cursor-wait">
              {done === 'excel' ? <Check className="size-4" strokeWidth={3} /> : <FileSpreadsheet className="size-4" />}
              {busy === 'excel' && <span className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-white animate-pulse" />}
            </button>
          </div>
        </div>

        <div className="px-4 pb-4" style={{ background: CARD_BG }}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm" style={{ color: TEXT_MUTED }}>
            <div className="flex items-center gap-2">
              <span>Show</span>
              <Select value={String(showEntries)} onChange={(e) => { setShowEntries(Number(e.target.value)); setPage(1) }} className="w-20">
                <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
              </Select><span>entries</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Search:</span>
              <input type="text" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }}
                className="w-[200px] h-[32px] px-2 text-sm rounded-[2px] focus:outline-none focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30"
                style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: INPUT_TEXT }} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th onClick={() => toggleSort('id')}
                    className="w-14 px-3 py-2 text-left font-semibold border cursor-pointer select-none"
                    style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}>
                    <span className="inline-flex items-center gap-1">#<SortChevron col="id" /></span></th>
                  <th onClick={() => toggleSort('name')}
                    className="px-3 py-2 text-left font-semibold border cursor-pointer select-none"
                    style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}>
                    <span className="inline-flex items-center gap-1">Name<SortChevron col="name" /></span></th>
                  <th onClick={() => toggleSort('shortName')}
                    className="w-32 px-3 py-2 text-left font-semibold border cursor-pointer select-none"
                    style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}>
                    <span className="inline-flex items-center gap-1">Short Name<SortChevron col="shortName" /></span></th>
                  <th onClick={() => toggleSort('allowDecimal')}
                    className="w-36 px-3 py-2 text-left font-semibold border cursor-pointer select-none"
                    style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}>
                    <span className="inline-flex items-center gap-1.5">Allow Decimal<InfoIcon title="Allow decimal quantities for this unit (e.g. 1.5 kg)" /><SortChevron col="allowDecimal" /></span></th>
                  <th onClick={() => toggleSort('status')}
                    className="w-28 px-3 py-2 text-left font-semibold border cursor-pointer select-none"
                    style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}>
                    <span className="inline-flex items-center gap-1">Status<SortChevron col="status" /></span></th>
                  <th className="w-44 px-3 py-2 text-right font-semibold border"
                    style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((u, idx) => {
                  const globalIdx = (page - 1) * showEntries + idx + 1
                  const zebra = idx % 2 === 0
                  return (
                    <tr key={u.id} className="transition-colors"
                      style={{ background: zebra ? ZEBRA_BG : WHITE_BG, color: TEXT }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = zebra ? ZEBRA_BG_HOVER : WHITE_HOVER }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = zebra ? ZEBRA_BG : WHITE_BG }}>
                      <td className="px-3 py-2.5 border font-medium" style={{ borderColor: TBL_BORDER }}>{globalIdx}</td>
                      <td className="px-3 py-2.5 border font-medium" style={{ borderColor: TBL_BORDER }}>{u.name}</td>
                      <td className="px-3 py-2.5 border" style={{ borderColor: TBL_BORDER }}>{u.shortName || '—'}</td>
                      <td className="px-3 py-2.5 border font-semibold" style={{ borderColor: TBL_BORDER }}>{u.allowDecimal || '—'}</td>
                      <td className="px-3 py-2.5 border" style={{ borderColor: TBL_BORDER }}>
                        <span className="inline-block rounded-full border border-emerald-500 px-3 py-0.5 text-xs font-bold text-emerald-600 bg-transparent"
                          style={u.status !== 'Active' ? { borderColor: '#f59e0b', color: '#b45309' } : undefined}>{u.status}</span>
                      </td>
                      <td className="px-3 py-2.5 border text-right" style={{ borderColor: TBL_BORDER }}>
                        <div className="inline-flex items-center gap-1.5">
                          <button onClick={() => persist(items.map((x) => x.id === u.id ? { ...x, status: x.status === 'Active' ? 'Inactive' : 'Active' } : x))}
                            className={cn('inline-flex items-center gap-1 rounded-[3px] px-3 py-1 text-xs font-semibold transition-colors',
                              u.status === 'Active'
                                ? 'border border-amber-500 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-500/10 bg-transparent'
                                : 'border border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 bg-transparent')}>
                            <PowerIcon className="size-3.5" on={u.status !== 'Active'} /> {u.status === 'Active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button onClick={() => openEdit(u)}
                            className="inline-flex items-center gap-1 rounded-[3px] bg-[#284a72] px-3 py-1 text-xs font-semibold text-white hover:bg-[#1f3a5c] transition-colors">
                            <Pencil className="size-3.5" strokeWidth={2} /> Edit</button>
                          <button onClick={() => removeItem(u.id)}
                            className="inline-flex items-center gap-1 rounded-[3px] border border-red-500 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 bg-transparent transition-colors">
                            <TrashIcon className="size-3.5" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {paged.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-sm border"
                    style={{ color: TEXT_MUTED, borderColor: TBL_BORDER, background: WHITE_BG }}>No entries found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm" style={{ color: TEXT_MUTED }}>
            <span>{filtered.length === 0 ? 'No entries' : `Showing ${startIdx} to ${endIdx} of ${filtered.length} entries`}</span>
            <div className={cn('flex items-center gap-0', totalPages <= 1 && 'opacity-50 pointer-events-none')}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="grid size-8 place-items-center rounded-l border transition hover:brightness-110 disabled:opacity-50"
                style={{ background: PAGINATION_BG, borderColor: PAGINATION_BD, color: '#337ab7' }}>
                <ChevronLeft className="size-4" /></button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button key={n} onClick={() => setPage(n)}
                  className={cn('grid size-8 place-items-center border-t border-b transition', n > 1 && '-ml-px')}
                  style={n === page
                    ? { background: '#284a72', borderColor: '#284a72', color: '#fff', fontWeight: 600, borderLeft: '1px solid #284a72', borderRight: '1px solid #284a72' }
                    : { background: PAGINATION_BG, borderColor: PAGINATION_BD, color: '#337ab7' }}
                  onMouseEnter={(e) => { if (n !== page) (e.currentTarget as HTMLButtonElement).style.background = isDark ? '#2b313b' : '#eaeaea' }}
                  onMouseLeave={(e) => { if (n !== page) (e.currentTarget as HTMLButtonElement).style.background = PAGINATION_BG }}>{n}</button>
              ))}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="grid size-8 place-items-center rounded-r border transition hover:brightness-110 disabled:opacity-50 -ml-px"
                style={{ background: PAGINATION_BG, borderColor: PAGINATION_BD, color: '#337ab7' }}>
                <ChevronRight className="size-4" /></button>
            </div>
          </div>
        </div>
      </div>

      <Modal open={modal.open} onClose={closeModal}
        title={modal.editing ? 'Edit Unit' : 'Add Unit'}
        variant="perfex" size="lg" key={modal.version}
        headerClassName="bg-[#337ab7]"
        closeBtnClassName="bg-[#d9230f] hover:bg-[#c1200e] rounded-[4px] size-11"
        footer={<>
          <button type="button" onClick={save} disabled={saving}
            className="rounded-[4px] bg-[#284a72] px-8 py-2 text-lg font-medium text-white shadow-sm transition hover:bg-[#1f3a5c] disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={closeModal}
            className="rounded-[4px] bg-[#dd4b39] px-8 py-2 text-lg font-medium text-white shadow-sm transition hover:bg-[#c9302c]">Close</button>
        </>}>
        <div className="space-y-4 py-1">
          {/* Row 1: Name* + Short Name */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
            <div>
              <label className="block text-[17px] font-semibold mb-1.5" style={{ color: isDark ? '#e5e7eb' : '#1f2937' }}>
                Name <span className="text-red-500">*</span></label>
              <input type="text" value={modal.name} onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))} autoFocus
                className="w-full h-[42px] px-3 text-[15px] rounded-[8px] focus:outline-none focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30"
                style={{ background: INPUT_BG, border: `1px solid ${modal.errors.name ? '#dc2626' : INPUT_BORDER}`, color: INPUT_TEXT, borderRadius: 10 }} />
              {modal.errors.name && <p className="mt-1 text-xs italic text-red-500">{modal.errors.name}</p>}
            </div>
            <div>
              <label className="block text-[17px] font-semibold mb-1.5" style={{ color: isDark ? '#e5e7eb' : '#1f2937' }}>Short Name</label>
              <input type="text" value={modal.shortName} onChange={(e) => setModal((m) => ({ ...m, shortName: e.target.value }))} placeholder="e.g. Pc(s)"
                className="w-full h-[42px] px-3 text-[15px] rounded-[8px] focus:outline-none focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30"
                style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: INPUT_TEXT, borderRadius: 10 }} />
            </div>
          </div>

          {/* Row 2: Allow Decimal + Status* */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-[17px] font-semibold mb-1.5" style={{ color: isDark ? '#e5e7eb' : '#1f2937' }}>Allow Decimal</label>
              <Select value={modal.allowDecimal} onChange={(e) => setModal((m) => ({ ...m, allowDecimal: e.target.value as 'YES' | 'NO' | '' }))}
                className={cn('w-full h-[42px] text-[15px]', modal.errors.allowDecimal && 'border-red-500')}
                style={{ background: INPUT_BG, border: `1px solid ${modal.errors.allowDecimal ? '#dc2626' : INPUT_BORDER}`, color: modal.allowDecimal ? INPUT_TEXT : TEXT_MUTED, borderRadius: 10 }}>
                <option value="">Please Select...</option>
                <option value="YES">YES</option>
                <option value="NO">NO</option>
              </Select>
              {modal.errors.allowDecimal && <p className="mt-1 text-xs italic text-red-500">{modal.errors.allowDecimal}</p>}
            </div>
            <div>
              <label className="block text-[17px] font-semibold mb-1.5" style={{ color: isDark ? '#e5e7eb' : '#1f2937' }}>Status <span className="text-red-500">*</span></label>
              <Select value={modal.status} onChange={(e) => setModal((m) => ({ ...m, status: e.target.value as 'Active' | 'Inactive' }))}>
                <option value="Active">ACTIVE</option><option value="Inactive">INACTIVE</option>
              </Select>
            </div>
          </div>

          {/* Checkbox: Add as multiple of other unit */}
          <label className="flex items-center gap-2 cursor-pointer select-none pt-1" style={{ color: isDark ? '#e5e7eb' : '#1f2937' }}>
            <button type="button" role="checkbox" aria-checked={modal.asMultiple}
              onClick={() => setModal((m) => ({ ...m, asMultiple: !m.asMultiple, multiplier: !m.asMultiple ? m.multiplier : '', baseUnitId: !m.asMultiple ? m.baseUnitId : '' }))}
              className="grid size-7 place-items-center rounded-md border-2 transition"
              style={{ background: modal.asMultiple ? '#337ab7' : 'transparent', borderColor: modal.asMultiple ? '#337ab7' : (isDark ? '#8fa2b8' : '#9aa0a6'), color: '#fff' }}>
              {modal.asMultiple && <Check className="size-5" strokeWidth={3} />}
            </button>
            <span className="text-[17px] font-medium">Add as multiple of other unit</span>
            <InfoIcon title="Define this unit as a multiple of another base unit (e.g. 1 Dozen = 12 Pieces)" />
          </label>

          {/* Multiplier row: 1 [Unit name] = [input] [base unit] */}
          {modal.asMultiple && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <span className="text-[30px] font-bold shrink-0" style={{ color: TEXT }}>1</span>
              <span className="text-[24px] font-semibold min-w-[80px] truncate shrink-0" style={{ color: TEXT }}>
                {modal.name.trim() || (modal.editing ? modal.editing.name : 'Unit')}
              </span>
              <span className="text-[28px] font-light shrink-0" style={{ color: TEXT }}>=</span>
              <input type="number" min="0" step="any" value={modal.multiplier}
                onChange={(e) => setModal((m) => ({ ...m, multiplier: e.target.value }))}
                placeholder="times base unit"
                className="h-[44px] w-[180px] px-3 text-[20px] italic rounded-[8px] focus:outline-none focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30"
                style={{ background: INPUT_BG, border: `1px solid ${modal.errors.multiplier ? '#dc2626' : INPUT_BORDER}`, color: '#d9230f', borderRadius: 10 }} />
              <Select value={String(modal.baseUnitId)}
                onChange={(e) => setModal((m) => ({ ...m, baseUnitId: e.target.value ? Number(e.target.value) : '' }))}
                className="h-[44px] text-[17px] min-w-[200px] flex-1"
                style={{ background: INPUT_BG, border: `1px solid ${modal.errors.baseUnitId ? '#dc2626' : INPUT_BORDER}`, color: modal.baseUnitId === '' ? TEXT_MUTED : INPUT_TEXT, borderRadius: 10 }}>
                <option value="">Select base unit</option>
                {baseUnitOptions.map((bu) => <option key={bu.id} value={bu.id}>{bu.name}{bu.shortName ? ` (${bu.shortName})` : ''}</option>)}
              </Select>
              {(modal.errors.multiplier || modal.errors.baseUnitId) && (
                <p className="w-full text-xs italic text-red-500 -mt-1">
                  {modal.errors.multiplier || modal.errors.baseUnitId}
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>

      <div data-inv-units-print aria-hidden
        style={{ position: 'fixed', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
        <style>{`
          @media print {
            html, body { background: #fff !important; color: #000 !important; }
            body * { visibility: hidden !important; }
            [data-inv-units-print], [data-inv-units-print] * { visibility: visible !important; }
            [data-inv-units-print] { position: absolute !important; left: 0 !important; top: 0 !important;
              width: auto !important; height: auto !important; overflow: visible !important;
              display: block !important; padding: 24px !important; color: #000 !important; background: #fff !important; }
            [data-inv-units-print] * { color: #000 !important; background: transparent !important; }
            [data-inv-units-print] table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            [data-inv-units-print] th, [data-inv-units-print] td { border: 1px solid #666; padding: 6px 10px; font-size: 12px; text-align: left; }
            [data-inv-units-print] th { background: #dde3ec !important; color: #000 !important; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            [data-inv-units-print] tr:nth-child(even) td { background: #f3f5f8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            [data-inv-units-print] h1 { font-size: 20px; margin: 0 0 4px; color: #000 !important; }
            [data-inv-units-print] .sub { font-size: 12px; color: #333 !important; margin-bottom: 8px; }
          }
        `}</style>
        <h1>Units</h1>
        <div className="sub">Printed {new Date().toLocaleString()} · FitPro Gym App</div>
        <table>
          <thead><tr><th>#</th><th>Name</th><th>Short Name</th><th>Allow Decimal</th><th>Status</th></tr></thead>
          <tbody>{filtered.map((u, i) => (<tr key={u.id}><td>{i + 1}</td><td>{u.name}</td><td>{u.shortName || '—'}</td><td>{u.allowDecimal || '—'}</td><td>{u.status}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Brands — CRUD matching Perfex screenshot:
//   • Green-top card, 10 entries default, Search
//   • Columns # | Brands (sort) | Description (sort) | Status (sort) | Action
//   • Green-outlined Active pill + navy Edit button
//   • Blue-header modal: Brand Name*, Short Description, Status* (no code, no sub-category)
// ---------------------------------------------------------------------------
type Brand = InvBrand

const SEED_BRANDS: Brand[] = SEED_INV_BRANDS

export function InvBrands() {
  const [items, setItemsState] = useState<Brand[]>(() => loadBrands())
  const persist = (next: Brand[]) => { setItemsState(next); saveBrands(next) }
  const [q, setQ] = useState('')
  const [showEntries, setShowEntries] = useState(10)
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<'id' | 'name' | 'description' | 'status'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [modal, setModal] = useState<{
    open: boolean; editing: Brand | null; name: string; description: string;
    status: 'Active' | 'Inactive'; errors: Record<string, string>; version: number;
  }>({ open: false, editing: null, name: '', description: '', status: 'Active', errors: {}, version: 0 })
  const [saving, setSaving] = useState(false)
  const [nextId, setNextId] = useState(() => Math.max(0, ...items.map((x: any) => x.id)) + 1)
  const [busy, setBusy] = useState<'' | 'print' | 'pdf' | 'excel'>('')
  const [done, setDone] = useState<'' | 'print' | 'pdf' | 'excel'>('')
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark')); sync()
    const obs = new MutationObserver(sync); obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const openAdd = () => setModal({ open: true, editing: null, name: '', description: '', status: 'Active', errors: {}, version: Date.now() })
  const openEdit = (b: Brand) => setModal({ open: true, editing: b, name: b.name, description: b.description, status: b.status, errors: {}, version: Date.now() })
  const closeModal = () => setModal((m) => ({ ...m, open: false, editing: null }))

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const save = async () => {
    const errs: Record<string, string> = {}
    if (!modal.name.trim()) errs.name = 'Brand Name is required'
    setModal((m) => ({ ...m, errors: errs }))
    if (Object.keys(errs).length) return
    setSaving(true); await new Promise((r) => setTimeout(r, 200))
    if (modal.editing) {
      persist(items.map((it) => it.id === modal.editing!.id ? { ...it, name: modal.name.trim(), description: modal.description.trim(), status: modal.status } : it))
    } else {
      const id = nextId
      persist([...items, { id, name: modal.name.trim(), description: modal.description.trim(), status: modal.status }])
      setNextId(id + 1)
    }
    setSaving(false); closeModal()
  }

  const removeItem = (id: number) => {
    if (!window.confirm('Delete this brand?')) return
    persist(items.filter((b) => b.id !== id))
  }

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    let list = items
    if (ql) list = list.filter((b) => b.name.toLowerCase().includes(ql) || b.description.toLowerCase().includes(ql))
    list = [...list].sort((a, b) => {
      let av: string | number = '', bv: string | number = ''
      if (sortKey === 'id') { av = a.id; bv = b.id }
      else if (sortKey === 'status') { av = a.status; bv = b.status }
      else { av = String((a as any)[sortKey] ?? '').toLowerCase(); bv = String((b as any)[sortKey] ?? '').toLowerCase() }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [items, q, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / showEntries))
  const paged = filtered.slice((page - 1) * showEntries, page * showEntries)
  const startIdx = filtered.length === 0 ? 0 : (page - 1) * showEntries + 1
  const endIdx = Math.min(page * showEntries, filtered.length)

  const flashDone = (w: 'print' | 'pdf' | 'excel') => { setDone(w); window.setTimeout(() => setDone(''), 1500) }
  const handlePrint = () => { setBusy('print'); window.setTimeout(() => { window.print(); setBusy(''); flashDone('print') }, 150) }
  const handlePdf = () => { setBusy('pdf'); window.setTimeout(() => { window.print(); setBusy(''); flashDone('pdf') }, 150) }
  const handleExcel = async () => {
    setBusy('excel')
    const rows = items.map((b, i) => ({ '#': i + 1, Brands: b.name, Description: b.description, Status: b.status }))
    const ok = await exportExcel('brands', rows); setBusy(''); if (ok) flashDone('excel')
  }

  const CARD_BG        = isDark ? '#1b1f24' : '#ffffff'
  const CARD_BORDER    = isDark ? '#2d333a' : '#e7e7e2'
  const TEXT           = isDark ? '#e5e7eb' : '#32383e'
  const TEXT_MUTED     = isDark ? '#9aa3ad' : '#555'
  const HEADER_BG      = isDark ? '#1b1f24' : '#ffffff'
  const TBL_HEADER_BG  = isDark ? '#2c3440' : '#bac4d6'
  const TBL_HEADER_TXT = isDark ? '#e5e7eb' : '#32383e'
  const TBL_BORDER     = isDark ? '#363c44' : '#dddfe3'
  const ZEBRA_BG       = isDark ? '#232830' : '#e4e7ed'
  const ZEBRA_BG_HOVER = isDark ? '#2b313b' : '#d8dce4'
  const WHITE_BG       = isDark ? '#14171c' : '#ffffff'
  const WHITE_HOVER    = isDark ? '#1f242b' : '#f0f2f5'
  const INPUT_BG       = isDark ? '#14171c' : '#ffffff'
  const INPUT_BORDER   = isDark ? '#49515c' : '#9aa0a6'
  const INPUT_TEXT     = isDark ? '#e5e7eb' : '#111827'
  const PAGINATION_BG  = isDark ? '#20252c' : '#f6f6f6'
  const PAGINATION_BD  = isDark ? '#363c44' : '#ddd'

  const SortChevron = ({ col }: { col: typeof sortKey }) => (
    <ChevronDown className={cn('ml-1 inline size-4 transition-transform', sortKey === col ? 'opacity-100' : 'opacity-50', sortKey === col && sortDir === 'asc' && 'rotate-180')} style={{ color: TBL_HEADER_TXT }} />
  )

  return (
    <div id="inv-brands-wrap">
      <div className="rounded-[3px] shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.5)] overflow-hidden"
        style={{ background: CARD_BG, borderTop: '3px solid #00a65a' }}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b"
          style={{ background: HEADER_BG, borderColor: CARD_BORDER }}>
          <h3 className="flex items-center gap-2 text-[22px] font-normal" style={{ color: TEXT }}>
            <Menu className="size-[22px]" style={{ color: isDark ? '#c8f542' : '#444' }} strokeWidth={1.5} /> Brands
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={openAdd}
              className="inline-flex items-center gap-1.5 rounded-[3px] bg-[#284a72] px-3 py-[6px] text-sm font-semibold text-white shadow-sm hover:bg-[#1f3a5c] transition-colors">
              <CirclePlus className="size-[18px]" strokeWidth={2} /> Add</button>
            <button title="Print" onClick={handlePrint} disabled={busy !== ''}
              className="relative grid size-9 place-items-center rounded-full border-2 border-[#337ab7] bg-[#337ab7] text-white hover:bg-[#286090] transition disabled:opacity-70 disabled:cursor-wait">
              {done === 'print' ? <Check className="size-4" strokeWidth={3} /> : <Printer className="size-4" />}
              {busy === 'print' && <span className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-white animate-pulse" />}
            </button>
            <button title="Save as PDF" onClick={handlePdf} disabled={busy !== ''}
              className="relative grid size-9 place-items-center rounded-full border-2 border-[#e48aa5] bg-[#f4a6bc] text-white hover:bg-[#ea8fa9] transition disabled:opacity-70 disabled:cursor-wait">
              {done === 'pdf' ? <Check className="size-4" strokeWidth={3} /> : <FileText className="size-4" />}
              {busy === 'pdf' && <span className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-white animate-pulse" />}
            </button>
            <button title="Export as Excel (.xlsx)" onClick={() => void handleExcel()} disabled={busy !== ''}
              className="relative grid size-9 place-items-center rounded-full border-2 border-[#4cae4c] bg-[#5cb85c] text-white hover:bg-[#449d44] transition disabled:opacity-70 disabled:cursor-wait">
              {done === 'excel' ? <Check className="size-4" strokeWidth={3} /> : <FileSpreadsheet className="size-4" />}
              {busy === 'excel' && <span className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-white animate-pulse" />}
            </button>
          </div>
        </div>

        <div className="px-4 pb-4" style={{ background: CARD_BG }}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm" style={{ color: TEXT_MUTED }}>
            <div className="flex items-center gap-2">
              <span>Show</span>
              <Select value={String(showEntries)} onChange={(e) => { setShowEntries(Number(e.target.value)); setPage(1) }} className="w-20">
                <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
              </Select><span>entries</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Search:</span>
              <input type="text" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }}
                className="w-[200px] h-[32px] px-2 text-sm rounded-[2px] focus:outline-none focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30"
                style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: INPUT_TEXT }} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th onClick={() => toggleSort('id')}
                    className="w-14 px-3 py-2 text-left font-semibold border cursor-pointer select-none"
                    style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}>
                    <span className="inline-flex items-center gap-1">#<SortChevron col="id" /></span></th>
                  <th onClick={() => toggleSort('name')}
                    className="px-3 py-2 text-left font-semibold border cursor-pointer select-none"
                    style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}>
                    <span className="inline-flex items-center gap-1">Brands<SortChevron col="name" /></span></th>
                  <th onClick={() => toggleSort('description')}
                    className="px-3 py-2 text-left font-semibold border cursor-pointer select-none"
                    style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}>
                    <span className="inline-flex items-center gap-1">Description<SortChevron col="description" /></span></th>
                  <th onClick={() => toggleSort('status')}
                    className="w-28 px-3 py-2 text-left font-semibold border cursor-pointer select-none"
                    style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}>
                    <span className="inline-flex items-center gap-1">Status<SortChevron col="status" /></span></th>
                  <th className="w-44 px-3 py-2 text-right font-semibold border"
                    style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((b, idx) => {
                  const globalIdx = (page - 1) * showEntries + idx + 1
                  const zebra = idx % 2 === 0
                  return (
                    <tr key={b.id} className="transition-colors"
                      style={{ background: zebra ? ZEBRA_BG : WHITE_BG, color: TEXT }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = zebra ? ZEBRA_BG_HOVER : WHITE_HOVER }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = zebra ? ZEBRA_BG : WHITE_BG }}>
                      <td className="px-3 py-2.5 border font-medium" style={{ borderColor: TBL_BORDER }}>{globalIdx}</td>
                      <td className="px-3 py-2.5 border font-medium" style={{ borderColor: TBL_BORDER }}>{b.name}</td>
                      <td className="px-3 py-2.5 border" style={{ borderColor: TBL_BORDER }}>{b.description || '—'}</td>
                      <td className="px-3 py-2.5 border" style={{ borderColor: TBL_BORDER }}>
                        <span className="inline-block rounded-full border border-emerald-500 px-3 py-0.5 text-xs font-bold text-emerald-600 bg-transparent"
                          style={b.status !== 'Active' ? { borderColor: '#f59e0b', color: '#b45309' } : undefined}>{b.status}</span>
                      </td>
                      <td className="px-3 py-2.5 border text-right" style={{ borderColor: TBL_BORDER }}>
                        <div className="inline-flex items-center gap-1.5">
                          <button onClick={() => persist(items.map((x) => x.id === b.id ? { ...x, status: x.status === 'Active' ? 'Inactive' : 'Active' } : x))}
                            className={cn('inline-flex items-center gap-1 rounded-[3px] px-3 py-1 text-xs font-semibold transition-colors',
                              b.status === 'Active'
                                ? 'border border-amber-500 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-500/10 bg-transparent'
                                : 'border border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 bg-transparent')}>
                            <PowerIcon className="size-3.5" on={b.status !== 'Active'} /> {b.status === 'Active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button onClick={() => openEdit(b)}
                            className="inline-flex items-center gap-1 rounded-[3px] bg-[#284a72] px-3 py-1 text-xs font-semibold text-white hover:bg-[#1f3a5c] transition-colors">
                            <Pencil className="size-3.5" strokeWidth={2} /> Edit</button>
                          <button onClick={() => removeItem(b.id)}
                            className="inline-flex items-center gap-1 rounded-[3px] border border-red-500 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 bg-transparent transition-colors">
                            <TrashIcon className="size-3.5" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {paged.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-sm border"
                    style={{ color: TEXT_MUTED, borderColor: TBL_BORDER, background: WHITE_BG }}>No entries found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm" style={{ color: TEXT_MUTED }}>
            <span>{filtered.length === 0 ? 'No entries' : `Showing ${startIdx} to ${endIdx} of ${filtered.length} entries`}</span>
            <div className={cn('flex items-center gap-0', totalPages <= 1 && 'opacity-50 pointer-events-none')}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="grid size-8 place-items-center rounded-l border transition hover:brightness-110 disabled:opacity-50"
                style={{ background: PAGINATION_BG, borderColor: PAGINATION_BD, color: '#337ab7' }}>
                <ChevronLeft className="size-4" /></button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button key={n} onClick={() => setPage(n)}
                  className={cn('grid size-8 place-items-center border-t border-b transition', n > 1 && '-ml-px')}
                  style={n === page
                    ? { background: '#284a72', borderColor: '#284a72', color: '#fff', fontWeight: 600, borderLeft: '1px solid #284a72', borderRight: '1px solid #284a72' }
                    : { background: PAGINATION_BG, borderColor: PAGINATION_BD, color: '#337ab7' }}
                  onMouseEnter={(e) => { if (n !== page) (e.currentTarget as HTMLButtonElement).style.background = isDark ? '#2b313b' : '#eaeaea' }}
                  onMouseLeave={(e) => { if (n !== page) (e.currentTarget as HTMLButtonElement).style.background = PAGINATION_BG }}>{n}</button>
              ))}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="grid size-8 place-items-center rounded-r border transition hover:brightness-110 disabled:opacity-50 -ml-px"
                style={{ background: PAGINATION_BG, borderColor: PAGINATION_BD, color: '#337ab7' }}>
                <ChevronRight className="size-4" /></button>
            </div>
          </div>
        </div>
      </div>

      <Modal open={modal.open} onClose={closeModal}
        title={modal.editing ? 'Edit Brand' : 'Add Brand'}
        variant="perfex" size="lg" key={modal.version}
        headerClassName="bg-[#337ab7]"
        closeBtnClassName="bg-[#d9230f] hover:bg-[#c1200e] rounded-[4px] size-11"
        footer={<>
          <button type="button" onClick={save} disabled={saving}
            className="rounded-[4px] bg-[#284a72] px-8 py-2 text-lg font-medium text-white shadow-sm transition hover:bg-[#1f3a5c] disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={closeModal}
            className="rounded-[4px] bg-[#dd4b39] px-8 py-2 text-lg font-medium text-white shadow-sm transition hover:bg-[#c9302c]">Close</button>
        </>}>
        <div className="space-y-4 py-1">
          <div>
            <label className="block text-[17px] font-semibold mb-1.5" style={{ color: isDark ? '#e5e7eb' : '#1f2937' }}>
              Brand Name <span className="text-red-500">*</span></label>
            <input type="text" value={modal.name} onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))} autoFocus
              className="w-full h-[42px] px-3 text-[15px] rounded-[8px] focus:outline-none focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30"
              style={{ background: INPUT_BG, border: `1px solid ${modal.errors.name ? '#dc2626' : INPUT_BORDER}`, color: INPUT_TEXT, borderRadius: 10 }} />
            {modal.errors.name && <p className="mt-1 text-xs italic text-red-500">{modal.errors.name}</p>}
          </div>
          <div>
            <label className="block text-[17px] font-semibold mb-1.5" style={{ color: isDark ? '#e5e7eb' : '#1f2937' }}>Short Description</label>
            <input type="text" value={modal.description} onChange={(e) => setModal((m) => ({ ...m, description: e.target.value }))}
              className="w-full h-[42px] px-3 text-[15px] rounded-[8px] focus:outline-none focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30"
              style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: INPUT_TEXT, borderRadius: 10 }} />
          </div>
          <div className="max-w-xs">
            <label className="block text-[17px] font-semibold mb-1.5" style={{ color: isDark ? '#e5e7eb' : '#1f2937' }}>Status <span className="text-red-500">*</span></label>
            <Select value={modal.status} onChange={(e) => setModal((m) => ({ ...m, status: e.target.value as 'Active' | 'Inactive' }))}>
              <option value="Active">ACTIVE</option><option value="Inactive">INACTIVE</option>
            </Select>
          </div>
        </div>
      </Modal>

      <div data-inv-brands-print aria-hidden
        style={{ position: 'fixed', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
        <style>{`
          @media print {
            html, body { background: #fff !important; color: #000 !important; }
            body * { visibility: hidden !important; }
            [data-inv-brands-print], [data-inv-brands-print] * { visibility: visible !important; }
            [data-inv-brands-print] { position: absolute !important; left: 0 !important; top: 0 !important;
              width: auto !important; height: auto !important; overflow: visible !important;
              display: block !important; padding: 24px !important; color: #000 !important; background: #fff !important; }
            [data-inv-brands-print] * { color: #000 !important; background: transparent !important; }
            [data-inv-brands-print] table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            [data-inv-brands-print] th, [data-inv-brands-print] td { border: 1px solid #666; padding: 6px 10px; font-size: 12px; text-align: left; }
            [data-inv-brands-print] th { background: #dde3ec !important; color: #000 !important; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            [data-inv-brands-print] tr:nth-child(even) td { background: #f3f5f8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            [data-inv-brands-print] h1 { font-size: 20px; margin: 0 0 4px; color: #000 !important; }
            [data-inv-brands-print] .sub { font-size: 12px; color: #333 !important; margin-bottom: 8px; }
          }
        `}</style>
        <h1>Brands</h1>
        <div className="sub">Printed {new Date().toLocaleString()} · FitPro Gym App</div>
        <table>
          <thead><tr><th>#</th><th>Brands</th><th>Description</th><th>Status</th></tr></thead>
          <tbody>{filtered.map((b, i) => (<tr key={b.id}><td>{i + 1}</td><td>{b.name}</td><td>{b.description || '—'}</td><td>{b.status}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Warranties — CRUD matching Perfex screenshot:
//   • Green-top card, 10 entries default, Search
//   • Columns # | Name (sort) | Description (sort) | Duration (sort) | Status (sort) | Action
//   • Duration shown as "<n> <type>" (e.g. "6 months", "16 days", "2 years")
//   • Green-outlined Active pill + navy Edit button
//   • Blue-header modal: Name*, Short Description, Duration + Duration Type ("Please Select..." dropdown: days/months/years), Status*
// ---------------------------------------------------------------------------
type DurationType = 'days' | 'months' | 'years' | ''

type Warranty = {
  id: number
  name: string
  description: string
  duration: number | null
  durationType: DurationType
  status: 'Active' | 'Inactive'
}

const SEED_WARRANTIES: Warranty[] = [
  { id: 1, name: 'Purchase Warrant', description: '', duration: 6,  durationType: 'months', status: 'Active' },
  { id: 2, name: 'Safe Mode',         description: '', duration: 16, durationType: 'days',   status: 'Active' },
  { id: 3, name: 'Strong Mode',       description: '', duration: 2,  durationType: 'years',  status: 'Active' },
]

export function InvWarranties() {
  const [items, setItemsState] = useState<Warranty[]>(() => loadWarranties().map((w) => ({ ...w, durationType: w.durationType as DurationType })))
  const persist = (next: Warranty[]) => { setItemsState(next); saveWarranties(next) }
  const [q, setQ] = useState('')
  const [showEntries, setShowEntries] = useState(10)
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<'id' | 'name' | 'description' | 'duration' | 'status'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [modal, setModal] = useState<{
    open: boolean; editing: Warranty | null;
    name: string; description: string; duration: string; durationType: DurationType;
    status: 'Active' | 'Inactive'; errors: Record<string, string>; version: number;
  }>({ open: false, editing: null, name: '', description: '', duration: '', durationType: '', status: 'Active', errors: {}, version: 0 })
  const [saving, setSaving] = useState(false)
  const [nextId, setNextId] = useState(() => Math.max(0, ...items.map((x: any) => x.id)) + 1)
  const [busy, setBusy] = useState<'' | 'print' | 'pdf' | 'excel'>('')
  const [done, setDone] = useState<'' | 'print' | 'pdf' | 'excel'>('')
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark')); sync()
    const obs = new MutationObserver(sync); obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const openAdd = () => setModal({ open: true, editing: null, name: '', description: '', duration: '', durationType: '', status: 'Active', errors: {}, version: Date.now() })
  const openEdit = (w: Warranty) => setModal({ open: true, editing: w, name: w.name, description: w.description, duration: w.duration != null ? String(w.duration) : '', durationType: w.durationType, status: w.status, errors: {}, version: Date.now() })
  const closeModal = () => setModal((m) => ({ ...m, open: false, editing: null }))

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const durationLabel = (n: number | null, t: DurationType) => {
    if (n == null || !t) return '—'
    // Pluralize: "1 day" / "2 days", etc.
    const plural = n === 1 ? '' : 's'
    return `${n} ${t}${plural}`
  }

  const save = async () => {
    const errs: Record<string, string> = {}
    if (!modal.name.trim()) errs.name = 'Warranty Name is required'
    const durNum = modal.duration.trim() === '' ? null : Number(modal.duration)
    if (modal.duration.trim() !== '' && (isNaN(durNum!) || durNum! <= 0)) errs.duration = 'Enter a valid duration'
    if (modal.duration.trim() !== '' && !modal.durationType) errs.durationType = 'Please select duration type'
    setModal((m) => ({ ...m, errors: errs }))
    if (Object.keys(errs).length) return
    setSaving(true); await new Promise((r) => setTimeout(r, 200))
    if (modal.editing) {
      persist(items.map((it) => it.id === modal.editing!.id
        ? { ...it, name: modal.name.trim(), description: modal.description.trim(), duration: durNum, durationType: modal.durationType, status: modal.status } : it))
    } else {
      const id = nextId
      persist([...items, { id, name: modal.name.trim(), description: modal.description.trim(), duration: durNum, durationType: modal.durationType, status: modal.status }])
      setNextId(id + 1)
    }
    setSaving(false); closeModal()
  }

  const removeItem = (id: number) => {
    if (!window.confirm('Delete this warranty?')) return
    persist(items.filter((w) => w.id !== id))
  }

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    let list = items
    if (ql) list = list.filter((w) =>
      w.name.toLowerCase().includes(ql) ||
      w.description.toLowerCase().includes(ql) ||
      durationLabel(w.duration, w.durationType).toLowerCase().includes(ql))
    list = [...list].sort((a, b) => {
      let av: string | number = '', bv: string | number = ''
      if (sortKey === 'id') { av = a.id; bv = b.id }
      else if (sortKey === 'duration') {
        // Convert all durations to days for comparison
        const toDays = (w: Warranty) => {
          if (w.duration == null || !w.durationType) return 0
          if (w.durationType === 'days') return w.duration
          if (w.durationType === 'months') return w.duration * 30
          return w.duration * 365
        }
        av = toDays(a); bv = toDays(b)
      }
      else if (sortKey === 'status') { av = a.status; bv = b.status }
      else { av = String((a as any)[sortKey] ?? '').toLowerCase(); bv = String((b as any)[sortKey] ?? '').toLowerCase() }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [items, q, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / showEntries))
  const paged = filtered.slice((page - 1) * showEntries, page * showEntries)
  const startIdx = filtered.length === 0 ? 0 : (page - 1) * showEntries + 1
  const endIdx = Math.min(page * showEntries, filtered.length)

  const flashDone = (w: 'print' | 'pdf' | 'excel') => { setDone(w); window.setTimeout(() => setDone(''), 1500) }
  const handlePrint = () => { setBusy('print'); window.setTimeout(() => { window.print(); setBusy(''); flashDone('print') }, 150) }
  const handlePdf = () => { setBusy('pdf'); window.setTimeout(() => { window.print(); setBusy(''); flashDone('pdf') }, 150) }
  const handleExcel = async () => {
    setBusy('excel')
    const rows = items.map((w, i) => ({ '#': i + 1, Name: w.name, Description: w.description, Duration: durationLabel(w.duration, w.durationType), Status: w.status }))
    const ok = await exportExcel('warranties', rows); setBusy(''); if (ok) flashDone('excel')
  }

  const CARD_BG        = isDark ? '#1b1f24' : '#ffffff'
  const CARD_BORDER    = isDark ? '#2d333a' : '#e7e7e2'
  const TEXT           = isDark ? '#e5e7eb' : '#32383e'
  const TEXT_MUTED     = isDark ? '#9aa3ad' : '#555'
  const HEADER_BG      = isDark ? '#1b1f24' : '#ffffff'
  const TBL_HEADER_BG  = isDark ? '#2c3440' : '#bac4d6'
  const TBL_HEADER_TXT = isDark ? '#e5e7eb' : '#32383e'
  const TBL_BORDER     = isDark ? '#363c44' : '#dddfe3'
  const ZEBRA_BG       = isDark ? '#232830' : '#e4e7ed'
  const ZEBRA_BG_HOVER = isDark ? '#2b313b' : '#d8dce4'
  const WHITE_BG       = isDark ? '#14171c' : '#ffffff'
  const WHITE_HOVER    = isDark ? '#1f242b' : '#f0f2f5'
  const INPUT_BG       = isDark ? '#14171c' : '#ffffff'
  const INPUT_BORDER   = isDark ? '#49515c' : '#9aa0a6'
  const INPUT_TEXT     = isDark ? '#e5e7eb' : '#111827'
  const PAGINATION_BG  = isDark ? '#20252c' : '#f6f6f6'
  const PAGINATION_BD  = isDark ? '#363c44' : '#ddd'

  const SortChevron = ({ col }: { col: typeof sortKey }) => (
    <ChevronDown className={cn('ml-1 inline size-4 transition-transform', sortKey === col ? 'opacity-100' : 'opacity-50', sortKey === col && sortDir === 'asc' && 'rotate-180')} style={{ color: TBL_HEADER_TXT }} />
  )

  return (
    <div id="inv-warranties-wrap">
      <div className="rounded-[3px] shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.5)] overflow-hidden"
        style={{ background: CARD_BG, borderTop: '3px solid #00a65a' }}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b"
          style={{ background: HEADER_BG, borderColor: CARD_BORDER }}>
          <h3 className="flex items-center gap-2 text-[22px] font-normal" style={{ color: TEXT }}>
            <Menu className="size-[22px]" style={{ color: isDark ? '#c8f542' : '#444' }} strokeWidth={1.5} /> Warranties
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={openAdd}
              className="inline-flex items-center gap-1.5 rounded-[3px] bg-[#284a72] px-3 py-[6px] text-sm font-semibold text-white shadow-sm hover:bg-[#1f3a5c] transition-colors">
              <CirclePlus className="size-[18px]" strokeWidth={2} /> Add</button>
            <button title="Print" onClick={handlePrint} disabled={busy !== ''}
              className="relative grid size-9 place-items-center rounded-full border-2 border-[#337ab7] bg-[#337ab7] text-white hover:bg-[#286090] transition disabled:opacity-70 disabled:cursor-wait">
              {done === 'print' ? <Check className="size-4" strokeWidth={3} /> : <Printer className="size-4" />}
              {busy === 'print' && <span className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-white animate-pulse" />}
            </button>
            <button title="Save as PDF" onClick={handlePdf} disabled={busy !== ''}
              className="relative grid size-9 place-items-center rounded-full border-2 border-[#e48aa5] bg-[#f4a6bc] text-white hover:bg-[#ea8fa9] transition disabled:opacity-70 disabled:cursor-wait">
              {done === 'pdf' ? <Check className="size-4" strokeWidth={3} /> : <FileText className="size-4" />}
              {busy === 'pdf' && <span className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-white animate-pulse" />}
            </button>
            <button title="Export as Excel (.xlsx)" onClick={() => void handleExcel()} disabled={busy !== ''}
              className="relative grid size-9 place-items-center rounded-full border-2 border-[#4cae4c] bg-[#5cb85c] text-white hover:bg-[#449d44] transition disabled:opacity-70 disabled:cursor-wait">
              {done === 'excel' ? <Check className="size-4" strokeWidth={3} /> : <FileSpreadsheet className="size-4" />}
              {busy === 'excel' && <span className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-white animate-pulse" />}
            </button>
          </div>
        </div>

        <div className="px-4 pb-4" style={{ background: CARD_BG }}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm" style={{ color: TEXT_MUTED }}>
            <div className="flex items-center gap-2">
              <span>Show</span>
              <Select value={String(showEntries)} onChange={(e) => { setShowEntries(Number(e.target.value)); setPage(1) }} className="w-20">
                <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
              </Select><span>entries</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Search:</span>
              <input type="text" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }}
                className="w-[200px] h-[32px] px-2 text-sm rounded-[2px] focus:outline-none focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30"
                style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: INPUT_TEXT }} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th onClick={() => toggleSort('id')}
                    className="w-14 px-3 py-2 text-left font-semibold border cursor-pointer select-none"
                    style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}>
                    <span className="inline-flex items-center gap-1">#<SortChevron col="id" /></span></th>
                  <th onClick={() => toggleSort('name')}
                    className="px-3 py-2 text-left font-semibold border cursor-pointer select-none"
                    style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}>
                    <span className="inline-flex items-center gap-1">Name<SortChevron col="name" /></span></th>
                  <th onClick={() => toggleSort('description')}
                    className="px-3 py-2 text-left font-semibold border cursor-pointer select-none"
                    style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}>
                    <span className="inline-flex items-center gap-1">Description<SortChevron col="description" /></span></th>
                  <th onClick={() => toggleSort('duration')}
                    className="w-36 px-3 py-2 text-left font-semibold border cursor-pointer select-none"
                    style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}>
                    <span className="inline-flex items-center gap-1">Duration<SortChevron col="duration" /></span></th>
                  <th onClick={() => toggleSort('status')}
                    className="w-28 px-3 py-2 text-left font-semibold border cursor-pointer select-none"
                    style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}>
                    <span className="inline-flex items-center gap-1">Status<SortChevron col="status" /></span></th>
                  <th className="w-44 px-3 py-2 text-right font-semibold border"
                    style={{ background: TBL_HEADER_BG, color: TBL_HEADER_TXT, borderColor: isDark ? '#3a424d' : '#c7cedd' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((w, idx) => {
                  const globalIdx = (page - 1) * showEntries + idx + 1
                  const zebra = idx % 2 === 0
                  return (
                    <tr key={w.id} className="transition-colors"
                      style={{ background: zebra ? ZEBRA_BG : WHITE_BG, color: TEXT }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = zebra ? ZEBRA_BG_HOVER : WHITE_HOVER }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = zebra ? ZEBRA_BG : WHITE_BG }}>
                      <td className="px-3 py-2.5 border font-medium" style={{ borderColor: TBL_BORDER }}>{globalIdx}</td>
                      <td className="px-3 py-2.5 border font-medium" style={{ borderColor: TBL_BORDER }}>{w.name}</td>
                      <td className="px-3 py-2.5 border" style={{ borderColor: TBL_BORDER }}>{w.description || '—'}</td>
                      <td className="px-3 py-2.5 border" style={{ borderColor: TBL_BORDER }}>{durationLabel(w.duration, w.durationType)}</td>
                      <td className="px-3 py-2.5 border" style={{ borderColor: TBL_BORDER }}>
                        <span className="inline-block rounded-full border border-emerald-500 px-3 py-0.5 text-xs font-bold text-emerald-600 bg-transparent"
                          style={w.status !== 'Active' ? { borderColor: '#f59e0b', color: '#b45309' } : undefined}>{w.status}</span>
                      </td>
                      <td className="px-3 py-2.5 border text-right" style={{ borderColor: TBL_BORDER }}>
                        <div className="inline-flex items-center gap-1.5">
                          <button onClick={() => persist(items.map((x) => x.id === w.id ? { ...x, status: x.status === 'Active' ? 'Inactive' : 'Active' } : x))}
                            className={cn('inline-flex items-center gap-1 rounded-[3px] px-3 py-1 text-xs font-semibold transition-colors',
                              w.status === 'Active'
                                ? 'border border-amber-500 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-500/10 bg-transparent'
                                : 'border border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 bg-transparent')}>
                            <PowerIcon className="size-3.5" on={w.status !== 'Active'} /> {w.status === 'Active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button onClick={() => openEdit(w)}
                            className="inline-flex items-center gap-1 rounded-[3px] bg-[#284a72] px-3 py-1 text-xs font-semibold text-white hover:bg-[#1f3a5c] transition-colors">
                            <Pencil className="size-3.5" strokeWidth={2} /> Edit</button>
                          <button onClick={() => removeItem(w.id)}
                            className="inline-flex items-center gap-1 rounded-[3px] border border-red-500 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 bg-transparent transition-colors">
                            <TrashIcon className="size-3.5" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {paged.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-sm border"
                    style={{ color: TEXT_MUTED, borderColor: TBL_BORDER, background: WHITE_BG }}>No entries found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm" style={{ color: TEXT_MUTED }}>
            <span>{filtered.length === 0 ? 'No entries' : `Showing ${startIdx} to ${endIdx} of ${filtered.length} entries`}</span>
            <div className={cn('flex items-center gap-0', totalPages <= 1 && 'opacity-50 pointer-events-none')}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="grid size-8 place-items-center rounded-l border transition hover:brightness-110 disabled:opacity-50"
                style={{ background: PAGINATION_BG, borderColor: PAGINATION_BD, color: '#337ab7' }}>
                <ChevronLeft className="size-4" /></button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button key={n} onClick={() => setPage(n)}
                  className={cn('grid size-8 place-items-center border-t border-b transition', n > 1 && '-ml-px')}
                  style={n === page
                    ? { background: '#284a72', borderColor: '#284a72', color: '#fff', fontWeight: 600, borderLeft: '1px solid #284a72', borderRight: '1px solid #284a72' }
                    : { background: PAGINATION_BG, borderColor: PAGINATION_BD, color: '#337ab7' }}
                  onMouseEnter={(e) => { if (n !== page) (e.currentTarget as HTMLButtonElement).style.background = isDark ? '#2b313b' : '#eaeaea' }}
                  onMouseLeave={(e) => { if (n !== page) (e.currentTarget as HTMLButtonElement).style.background = PAGINATION_BG }}>{n}</button>
              ))}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="grid size-8 place-items-center rounded-r border transition hover:brightness-110 disabled:opacity-50 -ml-px"
                style={{ background: PAGINATION_BG, borderColor: PAGINATION_BD, color: '#337ab7' }}>
                <ChevronRight className="size-4" /></button>
            </div>
          </div>
        </div>
      </div>

      <Modal open={modal.open} onClose={closeModal}
        title={modal.editing ? 'Edit Warranty' : 'Add Warranty'}
        variant="perfex" size="lg" key={modal.version}
        headerClassName="bg-[#337ab7]"
        closeBtnClassName="bg-[#d9230f] hover:bg-[#c1200e] rounded-[4px] size-11"
        footer={<>
          <button type="button" onClick={save} disabled={saving}
            className="rounded-[4px] bg-[#284a72] px-8 py-2 text-lg font-medium text-white shadow-sm transition hover:bg-[#1f3a5c] disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={closeModal}
            className="rounded-[4px] bg-[#dd4b39] px-8 py-2 text-lg font-medium text-white shadow-sm transition hover:bg-[#c9302c]">Close</button>
        </>}>
        <div className="space-y-4 py-1">
          {/* Name* */}
          <div>
            <label className="block text-[17px] font-semibold mb-1.5" style={{ color: isDark ? '#e5e7eb' : '#1f2937' }}>
              Name <span className="text-red-500">*</span></label>
            <input type="text" value={modal.name} onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))} autoFocus
              className="w-full h-[42px] px-3 text-[15px] rounded-[8px] focus:outline-none focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30"
              style={{ background: INPUT_BG, border: `1px solid ${modal.errors.name ? '#dc2626' : INPUT_BORDER}`, color: INPUT_TEXT, borderRadius: 10 }} />
            {modal.errors.name && <p className="mt-1 text-xs italic text-red-500">{modal.errors.name}</p>}
          </div>

          {/* Short Description */}
          <div>
            <label className="block text-[17px] font-semibold mb-1.5" style={{ color: isDark ? '#e5e7eb' : '#1f2937' }}>Short Description</label>
            <input type="text" value={modal.description} onChange={(e) => setModal((m) => ({ ...m, description: e.target.value }))}
              className="w-full h-[42px] px-3 text-[15px] rounded-[8px] focus:outline-none focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30"
              style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: INPUT_TEXT, borderRadius: 10 }} />
          </div>

          {/* Duration + Duration Type */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-[17px] font-semibold mb-1.5" style={{ color: isDark ? '#e5e7eb' : '#1f2937' }}>Duration</label>
              <input type="number" min="0" step="1" value={modal.duration} onChange={(e) => setModal((m) => ({ ...m, duration: e.target.value }))}
                placeholder=""
                className="w-full h-[42px] px-3 text-[15px] rounded-[8px] focus:outline-none focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30"
                style={{ background: INPUT_BG, border: `1px solid ${modal.errors.duration ? '#dc2626' : INPUT_BORDER}`, color: INPUT_TEXT, borderRadius: 10 }} />
              {modal.errors.duration && <p className="mt-1 text-xs italic text-red-500">{modal.errors.duration}</p>}
            </div>
            <div>
              <label className="block text-[17px] font-semibold mb-1.5" style={{ color: isDark ? '#e5e7eb' : '#1f2937' }}>Duration Type</label>
              <Select value={modal.durationType} onChange={(e) => setModal((m) => ({ ...m, durationType: e.target.value as DurationType }))}
                className="w-full h-[42px] text-[15px]"
                style={{ background: INPUT_BG, border: `1px solid ${modal.errors.durationType ? '#dc2626' : INPUT_BORDER}`, color: modal.durationType ? INPUT_TEXT : TEXT_MUTED, borderRadius: 10 }}>
                <option value="">Please Select...</option>
                <option value="days">Days</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
              </Select>
              {modal.errors.durationType && <p className="mt-1 text-xs italic text-red-500">{modal.errors.durationType}</p>}
            </div>
          </div>

          {/* Status* */}
          <div className="max-w-xs">
            <label className="block text-[17px] font-semibold mb-1.5" style={{ color: isDark ? '#e5e7eb' : '#1f2937' }}>Status <span className="text-red-500">*</span></label>
            <Select value={modal.status} onChange={(e) => setModal((m) => ({ ...m, status: e.target.value as 'Active' | 'Inactive' }))}>
              <option value="Active">ACTIVE</option><option value="Inactive">INACTIVE</option>
            </Select>
          </div>
        </div>
      </Modal>

      <div data-inv-warranties-print aria-hidden
        style={{ position: 'fixed', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
        <style>{`
          @media print {
            html, body { background: #fff !important; color: #000 !important; }
            body * { visibility: hidden !important; }
            [data-inv-warranties-print], [data-inv-warranties-print] * { visibility: visible !important; }
            [data-inv-warranties-print] { position: absolute !important; left: 0 !important; top: 0 !important;
              width: auto !important; height: auto !important; overflow: visible !important;
              display: block !important; padding: 24px !important; color: #000 !important; background: #fff !important; }
            [data-inv-warranties-print] * { color: #000 !important; background: transparent !important; }
            [data-inv-warranties-print] table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            [data-inv-warranties-print] th, [data-inv-warranties-print] td { border: 1px solid #666; padding: 6px 10px; font-size: 12px; text-align: left; }
            [data-inv-warranties-print] th { background: #dde3ec !important; color: #000 !important; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            [data-inv-warranties-print] tr:nth-child(even) td { background: #f3f5f8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            [data-inv-warranties-print] h1 { font-size: 20px; margin: 0 0 4px; color: #000 !important; }
            [data-inv-warranties-print] .sub { font-size: 12px; color: #333 !important; margin-bottom: 8px; }
          }
        `}</style>
        <h1>Warranties</h1>
        <div className="sub">Printed {new Date().toLocaleString()} · FitPro Gym App</div>
        <table>
          <thead><tr><th>#</th><th>Name</th><th>Description</th><th>Duration</th><th>Status</th></tr></thead>
          <tbody>{filtered.map((w, i) => (<tr key={w.id}><td>{i + 1}</td><td>{w.name}</td><td>{w.description || '—'}</td><td>{durationLabel(w.duration, w.durationType)}</td><td>{w.status}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  )
}
export function InvWarehouses() { return <InventoryPlaceholder title="Warehouses" description="Manage warehouses, shops and storage locations." /> }
export function InvTaxes() { return <InventoryPlaceholder title="Taxes" description="Configure sales and purchase tax rates for products." /> }

export function StockTransfer() { return <InventoryPlaceholder title="Stock Transfer" description="Move stock between warehouses or branches." /> }
export function StockAdjustments() { return <InventoryPlaceholder title="Stock Adjustments" description="Write off, damage, or adjust stock on hand." /> }
export function StockAlerts() { return <InventoryPlaceholder title="Stock Alerts" description="Items at or below their reorder point." /> }

export function InventoryReports() { return <InventoryPlaceholder title="Inventory Reports" description="Stock valuation, movement, slow movers and reorder reports." /> }
