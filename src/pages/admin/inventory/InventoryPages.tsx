import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Package, Printer, FileText, FileSpreadsheet, Pencil, Layers, Tags, ShieldCheck, ClipboardList,
  ChevronLeft, ChevronRight, ChevronDown, CirclePlus, Menu, Check, Square, CheckSquare, Columns3,
  Search, Settings2, Download, UploadCloud, CheckCircle2, AlertCircle, Eye, CalendarDays, X, QrCode, Info, Trash2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Select, Modal, DatePicker, Switch } from '../../../components/ui'
import { Barcode } from '../../../components/Barcode'
import { QRCodeSVG } from 'qrcode.react'
import { cn } from '../../../lib/utils'
import { exportExcel } from '../../../lib/export'
import type { InventoryItem, StockAlert, StockAdjustment, StockAdjustmentLine, StockAdjustmentType, StockCount, StockCountLine, StockTransfer, StockTransferLine } from '../../../types'
import { useApp } from '../../../context/AppContext'
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
  const [busy, setBusy] = useState<'' | 'print' | 'pdf' | 'excel'>('')
  const [done, setDone] = useState<'' | 'print' | 'pdf' | 'excel'>('')
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

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
      open: true,
      editing: null,
      name: '',
      values: [{ id: nid, value: '' }],
      errors: {},
      version: Date.now(),
    })
  }

  const openEdit = (variation: Variation) => {
    const sourceValues = variation.values.length ? variation.values : ['']
    const values = sourceValues.map((value) => ({ id: rowIdRef.current++, value }))
    setModal({ open: true, editing: variation, name: variation.name, values, errors: {}, version: Date.now() })
  }

  const closeModal = () => setModal((current) => ({ ...current, open: false, editing: null }))

  const setVal = (id: number, value: string) =>
    setModal((current) => ({ ...current, values: current.values.map((row) => row.id === id ? { ...row, value } : row) }))

  const setName = (name: string) => setModal((current) => ({ ...current, name }))

  const addVal = () => {
    const nid = rowIdRef.current++
    setModal((current) => ({ ...current, values: [...current.values, { id: nid, value: '' }] }))
  }

  const toggleSort = (key: 'name' | 'values' | 'id') => {
    if (sortKey === key) setSortDir((direction) => direction === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const save = async () => {
    const errors: { name?: string; values?: string } = {}
    if (!modal.name.trim()) errors.name = 'Variation name is required'
    const values = modal.values.map((row) => row.value.trim()).filter(Boolean)
    if (values.length === 0) errors.values = 'At least one value is required'
    setModal((current) => ({ ...current, errors }))
    if (Object.keys(errors).length) return

    setSaving(true)
    await new Promise((resolve) => setTimeout(resolve, 200))
    if (modal.editing) {
      persist(items.map((item) => item.id === modal.editing!.id ? { ...item, name: modal.name.trim(), values } : item))
    } else {
      const id = nextId
      persist([...items, { id, name: modal.name.trim(), values }])
      setNextId(id + 1)
    }
    setSaving(false)
    closeModal()
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    let list = items
    if (query) list = list.filter((item) => item.name.toLowerCase().includes(query) || item.values.join(', ').toLowerCase().includes(query))
    list = [...list].sort((a, b) => {
      let aValue: string | number = '', bValue: string | number = ''
      if (sortKey === 'name') { aValue = a.name.toLowerCase(); bValue = b.name.toLowerCase() }
      else if (sortKey === 'values') { aValue = a.values.join(', ').toLowerCase(); bValue = b.values.join(', ').toLowerCase() }
      else { aValue = a.id; bValue = b.id }
      if (aValue < bValue) return sortDir === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [items, q, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / showEntries))
  const paged = filtered.slice((page - 1) * showEntries, page * showEntries)
  const startIdx = filtered.length === 0 ? 0 : (page - 1) * showEntries + 1
  const endIdx = Math.min(page * showEntries, filtered.length)

  const flashDone = (which: 'print' | 'pdf' | 'excel') => {
    setDone(which)
    window.setTimeout(() => setDone(''), 1500)
  }
  const handlePrint = () => {
    setBusy('print')
    window.setTimeout(() => { window.print(); setBusy(''); flashDone('print') }, 150)
  }
  const handlePdf = () => {
    setBusy('pdf')
    window.setTimeout(() => { window.print(); setBusy(''); flashDone('pdf') }, 150)
  }
  const handleExcel = async () => {
    setBusy('excel')
    const rows = items.map((item, index) => ({ '#': index + 1, Variations: item.name, Values: item.values.join(', ') }))
    const ok = await exportExcel('variations', rows)
    setBusy('')
    if (ok) flashDone('excel')
  }

  const CARD_BG = isDark ? '#1b1f24' : '#ffffff'
  const CARD_BORDER = isDark ? '#2d333a' : '#e2e8f0'
  const PANEL_BG = isDark ? '#20252c' : '#f8fafc'
  const PANEL_BORDER = isDark ? '#363c44' : '#e5e7eb'
  const TABLE_HEAD_BG = isDark ? '#2a313b' : '#f1f5f9'
  const TABLE_ROW_ALT = isDark ? '#1f242b' : '#fafafa'
  const TEXT = isDark ? '#e5e7eb' : '#0f172a'
  const TEXT_MUTED = isDark ? '#9aa3ad' : '#64748b'
  const INPUT_BG = isDark ? '#14171c' : '#ffffff'
  const INPUT_BORDER = isDark ? '#49515c' : '#cbd5e1'
  const PURPLE = '#4f00e6'

  const SortChevron = ({ column }: { column: typeof sortKey }) => (
    <ChevronDown
      className={cn('size-4 transition-transform', sortKey !== column && 'opacity-40', sortKey === column && sortDir === 'asc' && 'rotate-180')}
      style={{ color: TEXT_MUTED }}
      aria-hidden
    />
  )

  return (
    <div id="inv-variations-wrap" className="w-full">
      <div
        className="overflow-hidden rounded-2xl shadow-sm"
        style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
      >
        {/* Page heading */}
        <div className="border-b px-5 py-5 md:px-8 md:py-6" style={{ borderColor: CARD_BORDER }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl"
                style={{ background: isDark ? '#33236b' : '#f0eaff', color: PURPLE }}
              >
                <Layers className="size-5" aria-hidden />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[25px] font-semibold leading-tight md:text-[28px]" style={{ color: TEXT }}>
                    Variations
                  </h2>
                  <span
                    className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                    style={{ background: PANEL_BG, borderColor: PANEL_BORDER, color: TEXT_MUTED }}
                  >
                    Product settings
                  </span>
                </div>
                <p className="mt-1 text-sm md:text-[15px]" style={{ color: TEXT_MUTED }}>
                  Create reusable options such as size, colour, or membership level for your products.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openAdd}
              className="btn font-semibold text-white shadow-sm transition hover:brightness-110"
              style={{ background: PURPLE }}
            >
              <CirclePlus className="size-4" aria-hidden />
              Add variation
            </button>
          </div>
        </div>

        <div className="p-5 md:p-8">
          <section
            className="rounded-xl border p-4 md:p-6"
            style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}
          >
            {/* Toolbar */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold" style={{ color: TEXT }}>Variation catalogue</h3>
                  <span className="rounded-full border px-2.5 py-1 text-xs font-medium" style={{ borderColor: PANEL_BORDER, color: TEXT_MUTED }}>
                    {items.length} {items.length === 1 ? 'variation' : 'variations'}
                  </span>
                </div>
                <p className="mt-1 text-sm" style={{ color: TEXT_MUTED }}>
                  Manage the values available when creating or editing a product.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={busy !== ''}
                  className="btn font-semibold disabled:cursor-wait disabled:opacity-60"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  {done === 'print' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <Printer className="size-4" aria-hidden />}
                  Print
                </button>
                <button
                  type="button"
                  onClick={handlePdf}
                  disabled={busy !== ''}
                  className="btn font-semibold disabled:cursor-wait disabled:opacity-60"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  {done === 'pdf' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <FileText className="size-4" aria-hidden />}
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => void handleExcel()}
                  disabled={busy !== ''}
                  className="btn font-semibold disabled:cursor-wait disabled:opacity-60"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  {done === 'excel' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <FileSpreadsheet className="size-4" aria-hidden />}
                  Excel
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: PANEL_BORDER }}>
              <div className="flex items-center gap-2 text-sm" style={{ color: TEXT_MUTED }}>
                <span>Show</span>
                <Select value={String(showEntries)} onChange={(e) => { setShowEntries(Number(e.target.value)); setPage(1) }} className="w-20">
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </Select>
                <span>entries</span>
              </div>
              <label className="flex w-full items-center gap-2 text-sm sm:w-auto" style={{ color: TEXT_MUTED }}>
                <span className="shrink-0">Search</span>
                <span className="relative w-full sm:w-[240px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
                  <input
                    type="search"
                    value={q}
                    onChange={(e) => { setQ(e.target.value); setPage(1) }}
                    placeholder="Search variations"
                    aria-label="Search variations"
                    className="h-[38px] w-full rounded-lg pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }}
                  />
                </span>
              </label>
            </div>

            {/* Variation table */}
            <div className="mt-4 overflow-x-auto rounded-lg border" style={{ borderColor: PANEL_BORDER }}>
              <table className="w-full min-w-[700px] border-collapse text-sm">
                <thead>
                  <tr style={{ background: TABLE_HEAD_BG }}>
                    <th className="w-20 px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('id')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        # <SortChevron column="id" />
                      </button>
                    </th>
                    <th className="w-[30%] px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        Variation <SortChevron column="name" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('values')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        Values <SortChevron column="values" />
                      </button>
                    </th>
                    <th className="w-28 whitespace-nowrap px-4 py-3 text-right font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((variation, index) => {
                    const zebra = index % 2 === 0
                    return (
                      <tr
                        key={variation.id}
                        className="transition-colors"
                        style={{ background: zebra ? TABLE_ROW_ALT : CARD_BG, color: TEXT }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = isDark ? '#2b313b' : '#f1f5f9' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = zebra ? TABLE_ROW_ALT : CARD_BG }}
                      >
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          <span className="grid size-7 place-items-center rounded-full text-xs font-bold text-white" style={{ background: PURPLE }}>
                            {(page - 1) * showEntries + index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, color: TEXT }}>
                          <p className="font-semibold">{variation.name}</p>
                        </td>
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          <div className="flex flex-wrap gap-2">
                            {variation.values.map((value) => (
                              <span key={`${variation.id}-${value}`} className="rounded-full border px-2.5 py-1 text-xs font-medium" style={{ borderColor: isDark ? '#4b5563' : '#cbd5e1', background: isDark ? '#29313a' : '#ffffff', color: TEXT }}>
                                {value}
                              </span>
                            ))}
                            {!variation.values.length && <span className="text-sm" style={{ color: TEXT_MUTED }}>No values added</span>}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          <CatalogueActionButton
                            label="Edit"
                            onClick={() => openEdit(variation)}
                            style={{ background: 'transparent', border: `1px solid ${PURPLE}`, color: PURPLE }}
                          >
                            <Pencil className="size-4" aria-hidden />
                          </CatalogueActionButton>
                        </td>
                      </tr>
                    )
                  })}
                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center" style={{ color: TEXT_MUTED, background: CARD_BG }}>
                        <Layers className="mx-auto size-8 opacity-50" aria-hidden />
                        <p className="mt-3 font-semibold" style={{ color: TEXT }}>No variations found</p>
                        <p className="mt-1 text-sm">Try a different search or add a new variation.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm" style={{ color: TEXT_MUTED }}>
              <span>{filtered.length === 0 ? 'No entries' : `Showing ${startIdx} to ${endIdx} of ${filtered.length} entries`}</span>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="btn rounded-r-none font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
                  <button
                    type="button"
                    key={number}
                    onClick={() => setPage(number)}
                    className={cn('btn rounded-none font-semibold -ml-px', number === page && 'text-white')}
                    style={number === page
                      ? { background: PURPLE, border: `1px solid ${PURPLE}`, color: '#ffffff' }
                      : { background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                  >
                    {number}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                  className="btn rounded-l-none font-semibold -ml-px disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  Next
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={modal.open}
        onClose={closeModal}
        title={modal.editing ? 'Edit Variation' : 'Add Variation'}
        variant="perfex"
        size="md"
        key={modal.version}
        headerClassName="bg-[#4f00e6]"
        closeBtnClassName="bg-[#d9230f] hover:bg-[#c1200e] rounded-[4px] size-10"
        footer={(
          <>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn font-semibold text-white disabled:cursor-wait disabled:opacity-60"
              style={{ background: PURPLE }}
            >
              {saving ? 'Saving…' : 'Save variation'}
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="btn font-semibold"
              style={{ background: 'transparent', border: '1px solid #cbd5e1', color: isDark ? '#cbd5e1' : '#475569' }}
            >
              Cancel
            </button>
          </>
        )}
      >
        <div className="space-y-5 py-1">
          <div>
            <label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>
              Variation name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={modal.name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="e.g. Size or Colour"
              className="h-[42px] w-full rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              style={{ background: INPUT_BG, border: `1px solid ${modal.errors.name ? '#dc2626' : INPUT_BORDER}`, color: TEXT }}
            />
            {modal.errors.name && <p className="mt-1 text-xs italic text-red-500">{modal.errors.name}</p>}
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-sm font-semibold" style={{ color: TEXT }}>
                Variation values <span className="text-red-500">*</span>
              </label>
              <span className="text-xs" style={{ color: TEXT_MUTED }}>Add one value per row</span>
            </div>
            <div className="mt-2 space-y-2">
              {modal.values.map((row, index) => (
                <div key={row.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={row.value}
                    onChange={(e) => setVal(row.id, e.target.value)}
                    placeholder={index === 0 ? 'e.g. Small' : 'Add another value'}
                    className="h-[42px] min-w-0 flex-1 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }}
                  />
                  {index === 0 && (
                    <button
                      type="button"
                      onClick={addVal}
                      title="Add another value"
                      className="btn shrink-0 font-semibold text-white"
                      style={{ background: '#284a72' }}
                    >
                      <CirclePlus className="size-4" aria-hidden />
                      Add value
                    </button>
                  )}
                </div>
              ))}
            </div>
            {modal.errors.values && <p className="mt-1 text-xs italic text-red-500">{modal.errors.values}</p>}
          </div>
        </div>
      </Modal>

      <div id="inv-variations-print" aria-hidden style={{ position: 'fixed', left: '-9999px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }}>
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
          <tbody>{filtered.map((item, index) => (<tr key={item.id}><td>{index + 1}</td><td>{item.name}</td><td>{item.values.join(', ')}</td></tr>))}</tbody>
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

export function UpdatePrice() {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark'))
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const CARD_BG = isDark ? '#1b1f24' : '#ffffff'
  const CARD_BORDER = isDark ? '#2d333a' : '#e2e8f0'
  const PANEL_BG = isDark ? '#20252c' : '#f8fafc'
  const PANEL_BORDER = isDark ? '#363c44' : '#e5e7eb'
  const TEXT = isDark ? '#e5e7eb' : '#0f172a'
  const TEXT_MUTED = isDark ? '#9aa3ad' : '#64748b'
  const PURPLE = '#4f00e6'

  const priceRows = [
    {
      'Product Name': 'Cold Water',
      SKU: '0002',
      'Purchase Price (Excl. Tax)': 90,
      'Purchase Price (Incl. Tax)': 90,
      'Selling Price': 112.5,
      'Selling Price Group': 'Best Selling Price',
      Tax: '',
    },
    {
      'Product Name': 'Voltic Water',
      SKU: '0001',
      'Purchase Price (Excl. Tax)': 40,
      'Purchase Price (Incl. Tax)': 40,
      'Selling Price': 50,
      'Selling Price Group': 'Best Selling Price',
      Tax: '',
    },
  ]

  const handleExport = async () => {
    setExporting(true)
    setMessage(null)
    const ok = await exportExcel('product-prices', priceRows)
    setExporting(false)
    setMessage(ok
      ? { kind: 'success', text: 'Product price file is ready to download.' }
      : { kind: 'error', text: 'The product price file could not be downloaded.' })
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(null)
    setFile(e.target.files?.[0] ?? null)
  }

  const handleImport = async () => {
    if (!file) {
      setMessage({ kind: 'error', text: 'Please choose a CSV or Excel file before importing.' })
      return
    }
    if (!/\.(csv|xlsx?)$/i.test(file.name)) {
      setMessage({ kind: 'error', text: 'Please choose a CSV or Excel file.' })
      return
    }

    setImporting(true)
    setMessage(null)
    // Demo-only import flow; the production endpoint can replace this delay.
    await new Promise((resolve) => setTimeout(resolve, 700))
    setImporting(false)
    setMessage({ kind: 'success', text: `“${file.name}” imported successfully. (Demo — no server was called.)` })
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const clearFile = () => {
    setFile(null)
    setMessage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const instructions = [
    'Export product prices by clicking the button above.',
    'Make changes to product prices, including tax and selling price groups.',
    'Do not change any product name, SKU, or headers.',
    'After making changes, import the file.',
  ]

  return (
    <div id="inv-update-price" className="w-full">
      <div
        className="overflow-hidden rounded-2xl shadow-sm"
        style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
      >
        {/* Page heading */}
        <div className="border-b px-5 py-5 md:px-8 md:py-6" style={{ borderColor: CARD_BORDER }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl"
                style={{ background: isDark ? '#33236b' : '#f0eaff', color: PURPLE }}
              >
                <FileSpreadsheet className="size-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-[25px] font-semibold leading-tight md:text-[28px]" style={{ color: TEXT }}>
                  Import Export Product Price
                </h2>
                <p className="mt-1 text-sm md:text-[15px]" style={{ color: TEXT_MUTED }}>
                  Export your current prices, update the spreadsheet, and import the revised file.
                </p>
              </div>
            </div>
            <span
              className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
              style={{ background: PANEL_BG, borderColor: PANEL_BORDER, color: TEXT_MUTED }}
            >
              Inventory pricing
            </span>
          </div>
        </div>

        <div className="p-5 md:p-8">
          {/* Export / import actions */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section
              className="flex h-full flex-col rounded-xl border p-5 md:p-6"
              style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="grid size-10 shrink-0 place-items-center rounded-lg"
                  style={{ background: isDark ? '#153b32' : '#dcfce7', color: '#15803d' }}
                >
                  <Download className="size-5" aria-hidden />
                </div>
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: TEXT }}>Export product prices</h3>
                  <p className="mt-1 text-sm leading-6" style={{ color: TEXT_MUTED }}>
                    Download an editable Excel file containing your current product prices and price groups.
                  </p>
                </div>
              </div>
              <div className="mt-auto pt-6">
                <button
                  type="button"
                  onClick={() => void handleExport()}
                  disabled={exporting || importing}
                  className="btn font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
                  style={{ background: PURPLE }}
                >
                  <Download className="size-4" aria-hidden />
                  {exporting ? 'Preparing export…' : 'Export product prices'}
                </button>
                <p className="mt-3 text-xs" style={{ color: TEXT_MUTED }}>
                  The downloaded file can be opened in Excel or Google Sheets.
                </p>
              </div>
            </section>

            <section
              className="flex h-full flex-col rounded-xl border p-5 md:p-6"
              style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="grid size-10 shrink-0 place-items-center rounded-lg"
                  style={{ background: isDark ? '#1d3554' : '#dbeafe', color: '#2563eb' }}
                >
                  <UploadCloud className="size-5" aria-hidden />
                </div>
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: TEXT }}>Import updated prices</h3>
                  <p className="mt-1 text-sm leading-6" style={{ color: TEXT_MUTED }}>
                    Choose the completed price file and submit it to update your catalogue.
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <label htmlFor="update-price-file" className="block text-sm font-semibold" style={{ color: TEXT }}>
                  File To Import:
                </label>
                <label
                  htmlFor="update-price-file"
                  className="mt-2 flex min-h-[46px] cursor-pointer items-center gap-3 rounded-lg border bg-white px-3 py-2 transition hover:border-blue-400 dark:bg-[#14171c]"
                  style={{ borderColor: file ? '#60a5fa' : PANEL_BORDER }}
                >
                  <span
                    className="btn shrink-0 font-semibold text-white"
                    style={{ background: '#2563eb' }}
                  >
                    Browse…
                  </span>
                  <span className="min-w-0 truncate text-sm" style={{ color: file ? TEXT : TEXT_MUTED }}>
                    {file ? file.name : 'No file selected'}
                  </span>
                  <input
                    ref={fileInputRef}
                    id="update-price-file"
                    type="file"
                    accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleFile}
                    className="sr-only"
                  />
                </label>
                <p className="mt-2 text-xs" style={{ color: TEXT_MUTED }}>
                  Accepted formats: CSV, XLS, and XLSX.
                </p>
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={importing || exporting}
                  className="btn font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
                  style={{ background: PURPLE }}
                >
                  <UploadCloud className="size-4" aria-hidden />
                  {importing ? 'Importing…' : 'Submit'}
                </button>
                {file && (
                  <button
                    type="button"
                    onClick={clearFile}
                    className="text-sm font-semibold hover:underline"
                    style={{ color: TEXT_MUTED }}
                  >
                    Clear file
                  </button>
                )}
              </div>
            </section>
          </div>

          {/* Inline action feedback */}
          {message && (
            <div
              role="status"
              className="mt-5 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm"
              style={{
                background: message.kind === 'success' ? (isDark ? '#052e16' : '#f0fdf4') : (isDark ? '#3b0a0a' : '#fef2f2'),
                borderColor: message.kind === 'success' ? '#86efac' : '#fca5a5',
                color: message.kind === 'success' ? (isDark ? '#86efac' : '#166534') : (isDark ? '#fca5a5' : '#b91c1c'),
              }}
            >
              {message.kind === 'success'
                ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                : <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}
              <span>{message.text}</span>
            </div>
          )}

          {/* Instructions */}
          <section
            className="mt-6 rounded-xl border p-5 md:p-6"
            style={{ background: isDark ? '#191e24' : '#ffffff', borderColor: PANEL_BORDER }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold" style={{ color: TEXT }}>Instructions</h3>
                <p className="mt-1 text-sm" style={{ color: TEXT_MUTED }}>
                  Keep the spreadsheet structure intact so prices map to the correct products.
                </p>
              </div>
              <span className="rounded-md border px-2.5 py-1 text-xs font-medium" style={{ borderColor: PANEL_BORDER, color: TEXT_MUTED }}>
                Safe import checklist
              </span>
            </div>

            <ol className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              {instructions.map((instruction, index) => (
                <li key={instruction} className="flex items-start gap-3 rounded-lg px-3 py-3" style={{ background: PANEL_BG }}>
                  <span
                    className="grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                    style={{ background: PURPLE }}
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm leading-6" style={{ color: TEXT }}>{instruction}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  )
}
// ---------------------------------------------------------------------------
// Print Labels — Barcode/price-label generator page.
// Matches Perfex screenshot:
//   • "Print Labels" title with cyan info ⓘ
//   • Top card: "Add products to generate Labels" header + search input
//   • 4-column header strip (Products | No. of labels | Packing Date | Selling Price Group)
//   • Second card: "Information to show in Labels" grid of checkbox + Size controls
//   • Print label type: Barcode Print Label or QR Code
//   • Barcode setting or QR Code label-printing settings, depending on type
//   • Purple rounded "Preview" button centered at bottom
type PrintLabelProduct = {
  id: string
  name: string
  sku: string
  sellingPrice: number
  groupPrices?: Record<string, number>
  variation?: string
}
type PrintLabelRow = { product: PrintLabelProduct; labels: number; packingDate: string; sellingPriceGroup: string }
type PrintLabelType = 'barcode' | 'qr'
type PrintSheetSetting = '20labels' | '30labels' | '14labels' | 'single'
type QrValueMode = 'sku' | 'name' | 'name-sku'
type QrErrorCorrection = 'L' | 'M' | 'Q' | 'H'

const PRINT_LABEL_BUSINESS_NAME = 'Igracesoft GH'

const PRINT_LABEL_PRODUCTS: PrintLabelProduct[] = [
  { id: 'cold-water', name: 'Cold Water', sku: '0002', sellingPrice: 112.5, groupPrices: { 'Wholesale Price': 110 } },
  { id: 'voltic-water', name: 'Voltic Water', sku: '0001', sellingPrice: 100, groupPrices: { 'Wholesale Price': 85, 'Best Selling Price': 100 } },
  { id: 'whey-protein', name: 'Whey Protein (2.27kg)', sku: 'SUP-WHEY-2.2', sellingPrice: 780, groupPrices: { 'Wholesale Price': 740 } },
  { id: 'creatine', name: 'Creatine Monohydrate (300g)', sku: 'SUP-CRE-300', sellingPrice: 260, groupPrices: { 'Wholesale Price': 245 } },
  { id: 'electrolyte-drink', name: 'Electrolyte Drink 500ml', sku: 'BEV-ELY-500', sellingPrice: 12, groupPrices: { 'Wholesale Price': 10 } },
  { id: 'still-water', name: 'Still Water 750ml', sku: 'BEV-WTR-750', sellingPrice: 5, groupPrices: { 'Wholesale Price': 4.5 } },
  { id: 'protein-bar', name: 'Protein Bar (Chocolate)', sku: 'SNK-BAR-CHO', sellingPrice: 22, groupPrices: { 'Wholesale Price': 20 } },
]

type PrintLabelOptions = {
  productName: { on: boolean; size: number }
  productVariation: { on: boolean; size: number }
  defaultPrice: { on: boolean; size: number }
  businessName: { on: boolean; size: number }
  packingDate: { on: boolean; size: number }
}

const formatPrintLabelDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? `${match[2]}/${match[3]}/${match[1]}` : value
}

function PrintLabelPreview({
  rows,
  opts,
  labelType,
  sheetSetting,
  qrValueMode,
  qrErrorCorrection,
  qrSize,
}: {
  rows: PrintLabelRow[]
  opts: PrintLabelOptions
  labelType: PrintLabelType
  sheetSetting: PrintSheetSetting
  qrValueMode: QrValueMode
  qrErrorCorrection: QrErrorCorrection
  qrSize: number
}) {
  const copies = rows.flatMap((row) => Array.from({ length: Math.max(1, Math.floor(Number(row.labels) || 1)) }, (_, copy) => ({ row, copy })))
  const layout = sheetSetting === '30labels'
    ? { columns: 3, rowHeight: 72 }
    : sheetSetting === '14labels'
      ? { columns: 2, rowHeight: 105 }
      : sheetSetting === 'single'
        ? { columns: 1, rowHeight: 125 }
        : { columns: 2, rowHeight: 80 }
  const qrPixelSize = Math.min(48, Math.max(24, Math.floor(Number(qrSize) || 34)))

  return (
    <div className="overflow-auto rounded-lg border bg-slate-100 p-3 md:p-5" style={{ borderColor: '#d1d5db' }}>
      <div
        id="print-label-sheet"
        style={{
          width: '707px',
          minHeight: '842px',
          boxSizing: 'border-box',
          margin: '0 auto',
          padding: '48px 31px 0 33px',
          display: 'grid',
          gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
          gridAutoRows: `${layout.rowHeight}px`,
          columnGap: '15px',
          alignContent: 'start',
          background: '#fff',
          border: '2px solid #666',
          color: '#000',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        {copies.map(({ row, copy }) => {
          const price = row.product.groupPrices?.[row.sellingPriceGroup] ?? row.product.sellingPrice
          const date = formatPrintLabelDate(row.packingDate)
          const showDetails = opts.defaultPrice.on || (opts.packingDate.on && date)
          const qrValue = qrValueMode === 'name'
            ? row.product.name
            : qrValueMode === 'name-sku'
              ? `${row.product.name} | ${row.product.sku}`
              : row.product.sku
          return (
            <div
              key={`${row.product.id}-${copy}`}
              style={{
                height: `${layout.rowHeight}px`,
                minWidth: 0,
                boxSizing: 'border-box',
                overflow: 'hidden',
                border: '1px dotted #d7d7d7',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                padding: '0 5px 2px',
                textAlign: 'center',
              }}
            >
              {opts.businessName.on && (
                <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: `${Math.max(10, opts.businessName.size * 0.7)}px`, fontWeight: 700, lineHeight: '15px', whiteSpace: 'nowrap' }}>
                  {PRINT_LABEL_BUSINESS_NAME}
                </div>
              )}
              {opts.productName.on && (
                <div style={{ fontSize: `${Math.max(9, opts.productName.size * 0.7)}px`, lineHeight: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                  {row.product.name}
                </div>
              )}
              {opts.productVariation.on && row.product.variation && (
                <div style={{ fontSize: `${Math.max(8, opts.productVariation.size * 0.6)}px`, lineHeight: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                  {row.product.variation}
                </div>
              )}
              {showDetails && (
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '2px', marginTop: '10px', whiteSpace: 'nowrap', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: `${Math.max(9, opts.defaultPrice.size * 0.7)}px`, lineHeight: '14px' }}>
                  {opts.defaultPrice.on && <span>Price: <strong>₵ {price.toFixed(2)}</strong></span>}
                  {opts.defaultPrice.on && opts.packingDate.on && date && <span style={{ fontSize: `${Math.max(8, opts.packingDate.size * 0.7)}px`, fontWeight: 700 }}>Packing Date: <span style={{ fontWeight: 400 }}>{date}</span></span>}
                  {!opts.defaultPrice.on && opts.packingDate.on && date && <span style={{ fontSize: `${Math.max(8, opts.packingDate.size * 0.7)}px`, fontWeight: 700 }}>Packing Date: <span style={{ fontWeight: 400 }}>{date}</span></span>}
                </div>
              )}
              {labelType === 'qr' ? (
                <div style={{ width: `${qrPixelSize}px`, height: `${qrPixelSize}px`, marginTop: '1px', flexShrink: 0, background: '#fff' }}>
                  <QRCodeSVG
                    value={qrValue}
                    size={qrPixelSize}
                    level={qrErrorCorrection}
                    marginSize={1}
                    aria-label={`QR code for ${row.product.name}`}
                  />
                </div>
              ) : (
                <div style={{ width: '42px', height: '18px', marginTop: '1px', flexShrink: 0 }}>
                  <Barcode value={row.product.sku} height={18} moduleWidth={1.25} quietZone={1} ariaLabel={`Barcode for ${row.product.name}`} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
export function PrintLabels() {
  const [search, setSearch] = useState('')
  const [labelRows, setLabelRows] = useState<PrintLabelRow[]>([])
  const [showPrice, setShowPrice] = useState<'inc' | 'exc'>('inc')
  const [labelType, setLabelType] = useState<PrintLabelType>('barcode')
  const [barcodeSetting, setBarcodeSetting] = useState<PrintSheetSetting>('20labels')
  const [qrLabelSetting, setQrLabelSetting] = useState<PrintSheetSetting>('20labels')
  const [qrValueMode, setQrValueMode] = useState<QrValueMode>('sku')
  const [qrErrorCorrection, setQrErrorCorrection] = useState<QrErrorCorrection>('M')
  const [qrSize, setQrSize] = useState(34)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [opts, setOpts] = useState<PrintLabelOptions>({
    productName:     { on: true, size: 15 },
    productVariation:{ on: true, size: 17 },
    defaultPrice:    { on: true, size: 17 },
    businessName:    { on: true, size: 20 },
    packingDate:     { on: true, size: 12 },
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
  const matchingProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return []
    return PRINT_LABEL_PRODUCTS.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(query)).slice(0, 6)
  }, [search])
  const addProduct = (product: PrintLabelProduct) => {
    setLabelRows((current) => current.some((row) => row.product.id === product.id)
      ? current
      : [...current, { product, labels: 1, packingDate: '', sellingPriceGroup: 'None' }])
    setSearch('')
    setPreviewError('')
  }
  const addFirstMatchingProduct = () => {
    const query = search.trim().toLowerCase()
    if (!query) return
    const product = matchingProducts[0] || PRINT_LABEL_PRODUCTS.find((item) => item.name.toLowerCase() === query || item.sku.toLowerCase() === query)
    if (product) addProduct(product)
  }
  const updateLabelRow = (id: string, patch: Partial<Omit<PrintLabelRow, 'product'>>) => {
    setLabelRows((current) => current.map((row) => row.product.id === id ? { ...row, ...patch } : row))
  }
  const printGeneratedLabels = () => {
    const sheet = document.getElementById('print-label-sheet')
    if (!sheet) return
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1100')
    if (!printWindow) {
      window.print()
      return
    }
    printWindow.document.open()
    printWindow.document.write(`<!doctype html><html><head><title>Print labels</title><style>@page{size:letter;margin:0}html,body{margin:0;padding:0;background:#fff}body{display:flex;justify-content:center;align-items:flex-start}#print-label-sheet{margin:0!important;box-shadow:none}</style></head><body>${sheet.outerHTML}</body></html>`)
    printWindow.document.close()
    printWindow.focus()
    printWindow.setTimeout(() => printWindow.print(), 250)
  }

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

        <div className="relative mx-auto mb-4 max-w-3xl">
          <div className="flex">
            <span className="grid h-[44px] w-12 shrink-0 place-items-center border border-r-0" style={{ background: STRIP_BG, borderColor: INPUT_BD, color: TEXT_MUTED }}>
              <Search className="size-5" aria-hidden />
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFirstMatchingProduct() } }}
              placeholder="Enter product name to print labels"
              autoFocus
              autoComplete="off"
              aria-label="Add products to print labels"
              className="h-[44px] min-w-0 flex-1 rounded-r-[2px] px-3 text-[15px] focus:outline-none focus:ring-1 focus:ring-[#337ab7]/30"
              style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }}
            />
          </div>
          {search.trim() && (
            <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border shadow-xl" style={{ background: CARD_BG, borderColor: CARD_BD }}>
              {matchingProducts.length > 0 ? matchingProducts.map((product) => (
                <button key={product.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => addProduct(product)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800" style={{ color: TEXT }}>
                  <span className="font-semibold">{product.name}</span>
                  <span className="text-xs" style={{ color: TEXT_MUTED }}>{product.sku}</span>
                </button>
              )) : <p className="px-3 py-3 text-sm" style={{ color: TEXT_MUTED }}>No matching products found</p>}
            </div>
          )}
        </div>

        <div className="overflow-x-auto border" style={{ borderColor: STRIP_BD }}>
          <table className="w-full min-w-[860px] border-collapse text-[16px]" style={{ color: TEXT }}>
            <thead>
              <tr style={{ background: STRIP_BG }}>
                {['Products', 'No. of labels', 'Packing Date', 'Selling Price Group'].map((heading) => <th key={heading} className="border px-3 py-2 text-left font-bold" style={{ borderColor: STRIP_BD }}>{heading}</th>)}
              </tr>
            </thead>
            <tbody>
              {labelRows.map((row) => (
                <tr key={row.product.id} style={{ background: STRIP_BG }}>
                  <td className="border px-3 py-3 align-middle font-medium" style={{ borderColor: STRIP_BD, color: TEXT }}>{row.product.name}</td>
                  <td className="border px-3 py-3 align-middle" style={{ borderColor: STRIP_BD }}>
                    <input type="number" min={1} value={row.labels} onChange={(e) => updateLabelRow(row.product.id, { labels: Math.max(1, Number(e.target.value) || 1) })} className="h-[42px] w-full rounded-[2px] px-3 text-[15px] focus:outline-none focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }} aria-label={`Number of labels for ${row.product.name}`} />
                  </td>
                  <td className="border px-3 py-3 align-middle" style={{ borderColor: STRIP_BD }}>
                    <input type="date" value={row.packingDate} onChange={(e) => updateLabelRow(row.product.id, { packingDate: e.target.value })} className="h-[42px] w-full rounded-[2px] px-3 text-[15px] focus:outline-none focus:border-[#337ab7] focus:ring-1 focus:ring-[#337ab7]/30" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }} aria-label={`Packing date for ${row.product.name}`} />
                  </td>
                  <td className="border px-3 py-3 align-middle" style={{ borderColor: STRIP_BD }}>
                    <Select value={row.sellingPriceGroup} onChange={(e) => updateLabelRow(row.product.id, { sellingPriceGroup: e.target.value })} className="w-full" aria-label={`Selling price group for ${row.product.name}`}>
                      <option value="None">None</option>
                      <option value="Wholesale Price">Wholesale Price</option>
                      <option value="Best Selling Price">Best Selling Price</option>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Label options card */}
      <div className="rounded-2xl p-6 shadow-sm md:p-8" style={{ background: CARD_BG, border: `1px solid ${CARD_BD}` }}>
        <div className="mb-6 flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-start sm:justify-between" style={{ borderColor: CARD_BD }}>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[22px] font-semibold" style={{ color: HEADER_TXT }}>Information to show in Labels</p>
              <InfoDot tip="Choose the product details that should appear on every printed label." />
            </div>
            <p className="mt-1 max-w-2xl text-sm" style={{ color: TEXT_MUTED }}>
              Choose the content shown on each Barcode Print Label or QR Code label, then adjust its display size where available.
            </p>
          </div>
          <span className="self-start rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: HEADER_TXT, borderColor: isDark ? '#4f5d78' : '#c7d2fe', background: isDark ? '#293244' : '#eef2ff' }}>
            Label content
          </span>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="h-full rounded-xl border p-4" style={{ background: STRIP_BG, borderColor: STRIP_BD }}>
            <LabelCheck id="pl-name" label="Product Name" size={opts.productName.size} on={opts.productName.on}
              onToggle={() => toggle('productName')} onSize={(v) => setSize('productName', v)} />
          </div>
          <div className="h-full rounded-xl border p-4" style={{ background: STRIP_BG, borderColor: STRIP_BD }}>
            <LabelCheck id="pl-var" label="Product Variation" sub="recommended" size={opts.productVariation.size} on={opts.productVariation.on}
              onToggle={() => toggle('productVariation')} onSize={(v) => setSize('productVariation', v)} />
          </div>

          {/* Product default-price visibility toggle */}
          <div className="h-full rounded-xl border p-4" style={{ background: STRIP_BG, borderColor: STRIP_BD }}>
            <div className="mb-1 flex items-center gap-2 text-[16px] font-semibold" style={{ color: TEXT }}>
              <span>Show product default price</span>
              <InfoDot tip="Turn this on or off to show or hide the Price: ₵ amount line on printed labels." />
            </div>
            <div className="flex min-h-[38px] items-center justify-between gap-3 rounded-md border px-3 py-1.5" style={{ background: INPUT_BG, borderColor: INPUT_BD }}>
              <span className="text-sm" style={{ color: TEXT_MUTED }}>{opts.defaultPrice.on ? 'Shown on labels' : 'Hidden from labels'}</span>
              <Switch
                checked={opts.defaultPrice.on}
                onChange={(on) => setOpts((current) => ({ ...current, defaultPrice: { ...current.defaultPrice, on } }))}
                aria-label="Show product default price on print labels"
              />
            </div>
            <div className="mt-1.5 flex items-stretch">
              <span className="inline-flex items-center rounded-l px-2 text-[14px] font-semibold" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, borderRight: 'none', color: TEXT }}>Size</span>
              <input type="number" min={6} max={40} value={opts.defaultPrice.size}
                onChange={(e) => setSize('defaultPrice', Number(e.target.value) || 0)}
                disabled={!opts.defaultPrice.on}
                className="h-[34px] w-full rounded-r px-2 text-sm focus:outline-none focus:border-[#337ab7] disabled:opacity-50"
                style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }}
                aria-label="Product default price text size"
              />
            </div>
          </div>

          {/* Show Price: info + dropdown */}
          <div className="h-full rounded-xl border p-4" style={{ background: STRIP_BG, borderColor: STRIP_BD }}>
            <div className="mb-1 flex items-center gap-2 text-[16px] font-semibold" style={{ color: TEXT }}>
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
            <p className="mt-2 text-xs" style={{ color: TEXT_MUTED }}>Applies when the default price is shown.</p>
          </div>

          <div className="h-full rounded-xl border p-4" style={{ background: STRIP_BG, borderColor: STRIP_BD }}>
            <LabelCheck id="pl-biz" label="Business name" size={opts.businessName.size} on={opts.businessName.on}
              onToggle={() => toggle('businessName')} onSize={(v) => setSize('businessName', v)} />
          </div>
          <div className="h-full rounded-xl border p-4" style={{ background: STRIP_BG, borderColor: STRIP_BD }}>
            <LabelCheck id="pl-pack" label="Print packing date" size={opts.packingDate.size} on={opts.packingDate.on}
              onToggle={() => toggle('packingDate')} onSize={(v) => setSize('packingDate', v)} />
          </div>
        </div>

        <hr className="my-7" style={{ borderColor: CARD_BD }} />

        {/* Output type */}
        <div className="mb-6 rounded-xl border p-4 md:p-5" style={{ background: isDark ? '#20252c' : '#f8fafc', borderColor: CARD_BD }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <label htmlFor="print-label-type" className="flex items-center gap-2 text-[16px] font-semibold" style={{ color: TEXT }}>
                <span>Print label type</span>
                <InfoDot tip="Choose whether the generated labels should contain a barcode or a QR Code." />
              </label>
              <p className="mt-1 text-[13px]" style={{ color: TEXT_MUTED }}>
                Select the code format you want to print on each product label.
              </p>
            </div>
            <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: HEADER_TXT, borderColor: isDark ? '#4f5d78' : '#c7d2fe', background: isDark ? '#293244' : '#eef2ff' }}>
              Output format
            </span>
          </div>
          <Select
            id="print-label-type"
            value={labelType}
            onChange={(e) => setLabelType(e.target.value as PrintLabelType)}
            aria-label="Print label type"
            className="mt-4 w-full"
          >
            <option value="barcode">Barcode Print Label</option>
            <option value="qr">QR Code</option>
          </Select>
        </div>

        {labelType === 'qr' ? (
          /* QR Code-specific settings */
          <div className="mb-6 rounded-xl border p-4 md:p-5" style={{ background: isDark ? '#20252c' : '#f8fafc', borderColor: CARD_BD }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <label htmlFor="qr-label-setting-select" className="flex items-center gap-2 text-[16px] font-semibold" style={{ color: TEXT }}>
                  <QrCode className="size-[19px]" aria-hidden />
                  <span>QR Code label printing</span>
                  <InfoDot tip="Configure what each QR Code contains and the label sheet used for QR Code printing." />
                </label>
                <p className="mt-1 text-[13px]" style={{ color: TEXT_MUTED }}>
                  Choose the QR Code content, print quality, size, and sheet layout.
                </p>
              </div>
              <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: HEADER_TXT, borderColor: isDark ? '#4f5d78' : '#c7d2fe', background: isDark ? '#293244' : '#eef2ff' }}>
                QR Code
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="qr-value-mode" className="mb-1 block text-[13px] font-semibold" style={{ color: TEXT }}>QR Code content</label>
                <Select id="qr-value-mode" value={qrValueMode} onChange={(e) => setQrValueMode(e.target.value as QrValueMode)} aria-label="QR Code content" className="w-full">
                  <option value="sku">Product SKU</option>
                  <option value="name">Product name</option>
                  <option value="name-sku">Product name and SKU</option>
                </Select>
              </div>
              <div>
                <label htmlFor="qr-error-correction" className="mb-1 block text-[13px] font-semibold" style={{ color: TEXT }}>Error correction</label>
                <Select id="qr-error-correction" value={qrErrorCorrection} onChange={(e) => setQrErrorCorrection(e.target.value as QrErrorCorrection)} aria-label="QR Code error correction" className="w-full">
                  <option value="L">Low (7%)</option>
                  <option value="M">Medium (15%)</option>
                  <option value="Q">Quartile (25%)</option>
                  <option value="H">High (30%)</option>
                </Select>
              </div>
              <div>
                <label htmlFor="qr-code-size" className="mb-1 block text-[13px] font-semibold" style={{ color: TEXT }}>QR Code size</label>
                <div className="flex items-stretch">
                  <input id="qr-code-size" type="number" min={24} max={96} value={qrSize} onChange={(e) => setQrSize(Math.min(96, Math.max(24, Number(e.target.value) || 34)))} aria-label="QR Code size" className="h-[38px] min-w-0 flex-1 rounded-l-[3px] px-3 text-sm focus:outline-none focus:border-[#337ab7]" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }} />
                  <span className="inline-flex items-center rounded-r-[3px] border border-l-0 px-3 text-xs font-semibold" style={{ background: STRIP_BG, borderColor: INPUT_BD, color: TEXT_MUTED }}>px</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-stretch">
              <span className="inline-flex items-center gap-2 rounded-l-[3px] border border-r-0 px-3 text-sm font-semibold" style={{ background: STRIP_BG, borderColor: INPUT_BD, color: TEXT }}>
                <Settings2 className="size-4" aria-hidden />
                QR label setting
              </span>
              <Select id="qr-label-setting-select" value={qrLabelSetting} onChange={(e) => setQrLabelSetting(e.target.value as PrintSheetSetting)} aria-label="QR Code label sheet setting" className="min-w-0 flex-1">
                <option value="20labels">20 QR Labels per Sheet, Sheet Size: 8.5&quot; x 11&quot;, Label Size: 4&quot;</option>
                <option value="30labels">30 QR Labels per Sheet, Sheet Size: 8.5&quot; x 11&quot;, Label Size: 2.625&quot; x 1&quot;</option>
                <option value="14labels">14 QR Labels per Sheet, Sheet Size: A4, Label Size: 99mm x 38mm</option>
                <option value="single">Single QR Label (continuous roll)</option>
              </Select>
            </div>
          </div>
        ) : (
          /* Barcode-specific settings */
          <div className="mb-6 rounded-xl border p-4 md:p-5" style={{ background: isDark ? '#20252c' : '#f8fafc', borderColor: CARD_BD }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <label htmlFor="barcode-setting-select" className="flex items-center gap-2 text-[16px] font-semibold" style={{ color: TEXT }}>
                  <span>Barcode print label setting</span>
                  <InfoDot tip="Choose the barcode label sheet or continuous-roll format that matches your printer paper." />
                </label>
                <p className="mt-1 text-[13px]" style={{ color: TEXT_MUTED }}>
                  Select the barcode label layout used by your printer.
                </p>
              </div>
              <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: HEADER_TXT, borderColor: isDark ? '#4f5d78' : '#c7d2fe', background: isDark ? '#293244' : '#eef2ff' }}>
                Barcode
              </span>
            </div>

            <div
              className="barcode-setting-input-group mt-4"
              style={{
                '--barcode-bg': INPUT_BG,
                '--barcode-border': INPUT_BD,
                '--barcode-text': TEXT,
              } as React.CSSProperties}
            >
              <span className="barcode-setting-icon" aria-hidden="true">
                <Settings2 className="size-[19px]" strokeWidth={2} />
              </span>
              <Select
                id="barcode-setting-select"
                value={barcodeSetting}
                onChange={(e) => setBarcodeSetting(e.target.value as PrintSheetSetting)}
                aria-label="Barcode print label setting"
                className="barcode-setting-select"
              >
                <option value="20labels">20 Labels per Sheet, Sheet Size: 8.5&quot; x 11&quot;, Label Size: 4&apos;</option>
                <option value="30labels">30 Labels per Sheet, Sheet Size: 8.5&quot; x 11&quot;, Label Size: 2.625&quot; x 1&quot;</option>
                <option value="14labels">14 Labels per Sheet, Sheet Size: A4, Label Size: 99mm x 38mm</option>
                <option value="single">Single Label (continuous roll)</option>
              </Select>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center justify-center gap-2">
          {previewError && <p className="text-sm font-medium text-red-600" role="alert">{previewError}</p>}
          <button
            type="button"
            onClick={() => {
              if (!labelRows.length) {
                setPreviewError('Add at least one product before previewing labels.')
                return
              }
              setPreviewError('')
              setPreviewOpen(true)
            }}
            className="inline-flex items-center justify-center rounded-[4px] px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4400cc] active:scale-[0.98]"
            style={{ background: '#4f00e6' }}
          >
            Preview
          </button>
        </div>
      </div>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Print labels preview" xl>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold" style={{ color: TEXT }}>Generated labels · {labelType === 'qr' ? 'QR Code' : 'Barcode Print Label'}</p>
            <p className="text-xs" style={{ color: TEXT_MUTED }}>
              {labelRows.reduce((total, row) => total + Math.max(1, Math.floor(Number(row.labels) || 1)), 0)} label copies from the selected quantities.
            </p>
          </div>
          <button
            type="button"
            onClick={printGeneratedLabels}
            className="btn inline-flex items-center gap-2"
            title="Print generated labels"
          >
            <Printer className="size-4" aria-hidden />
            Print labels
          </button>
        </div>
        <PrintLabelPreview
          rows={labelRows}
          opts={opts}
          labelType={labelType}
          sheetSetting={labelType === 'qr' ? qrLabelSetting : barcodeSetting}
          qrValueMode={qrValueMode}
          qrErrorCorrection={qrErrorCorrection}
          qrSize={qrSize}
        />
      </Modal>
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark'))
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const CARD_BG = isDark ? '#1b1f24' : '#ffffff'
  const CARD_BORDER = isDark ? '#2d333a' : '#e2e8f0'
  const PANEL_BG = isDark ? '#20252c' : '#f8fafc'
  const PANEL_BORDER = isDark ? '#363c44' : '#e5e7eb'
  const TABLE_HEAD_BG = isDark ? '#2a313b' : '#f1f5f9'
  const TABLE_ROW_ALT = isDark ? '#1f242b' : '#fafafa'
  const TEXT = isDark ? '#e5e7eb' : '#0f172a'
  const TEXT_MUTED = isDark ? '#9aa3ad' : '#64748b'
  const PURPLE = '#4f00e6'
  const GREEN = '#00a65a'

  const columns: { n: number; name: string; req?: boolean; instr?: string; note?: string }[] = [
    { n: 1, name: 'SKU', req: true, instr: 'The product SKU used to identify the product.' },
    { n: 2, name: 'Location', note: 'If blank, the first business location will be used.', instr: 'Name of the business location.' },
    { n: 3, name: 'Quantity', req: true, instr: 'Opening quantity to add to stock.' },
    { n: 4, name: 'Unit Cost (Before Tax)', req: true, instr: 'Unit cost before tax (numbers only).' },
    { n: 5, name: 'Lot Number', instr: 'Optional lot or batch reference.' },
    { n: 6, name: 'Expiry Date', instr: 'Stock expiry date in business date format mm/dd/yyyy. Example: 08/26/2026.' },
  ]

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
    a.href = url
    a.download = 'opening_stock_template.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMsg(null)
    const nextFile = e.target.files?.[0] ?? null
    if (nextFile && !nextFile.name.toLowerCase().endsWith('.csv')) {
      setFile(null)
      setMsg({ kind: 'err', text: 'Please select a CSV file that follows the opening stock template.' })
      e.target.value = ''
      return
    }
    setFile(nextFile)
  }

  const clearFile = () => {
    setFile(null)
    setMsg(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const onSubmit = async () => {
    if (!file) {
      setMsg({ kind: 'err', text: 'Please select a CSV file to import.' })
      return
    }
    setSubmitting(true)
    setMsg(null)
    // Demo-only import flow; the production endpoint can replace this delay.
    await new Promise((resolve) => setTimeout(resolve, 700))
    const importedName = file.name
    setSubmitting(false)
    setMsg({ kind: 'ok', text: `“${importedName}” imported successfully. (Demo — no server was called.)` })
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const InfoDot = ({ tip }: { tip: string }) => (
    <span title={tip} className="ml-1 inline-grid size-[18px] place-items-center rounded-full bg-[#5bc0de] text-white text-[11px] font-bold cursor-help align-middle">i</span>
  )

  return (
    <div id="inv-import-opening-stock" className="w-full">
      <div
        className="overflow-hidden rounded-2xl shadow-sm"
        style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
      >
        {/* Page heading */}
        <div className="border-b px-5 py-5 md:px-8 md:py-6" style={{ borderColor: CARD_BORDER }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl"
                style={{ background: isDark ? '#33236b' : '#f0eaff', color: PURPLE }}
              >
                <FileSpreadsheet className="size-5" aria-hidden />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[25px] font-semibold leading-tight md:text-[28px]" style={{ color: TEXT }}>
                    Import Opening Stock
                  </h2>
                  <span
                    className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                    style={{ background: PANEL_BG, borderColor: PANEL_BORDER, color: TEXT_MUTED }}
                  >
                    CSV import
                  </span>
                </div>
                <p className="mt-1 text-sm md:text-[15px]" style={{ color: TEXT_MUTED }}>
                  Add starting quantities to your inventory using a simple, guided spreadsheet upload.
                </p>
              </div>
            </div>
            <div className="text-right text-xs" style={{ color: TEXT_MUTED }}>
              <p className="font-semibold" style={{ color: TEXT }}>6-column template</p>
              <p className="mt-0.5">Required fields are marked below</p>
            </div>
          </div>
        </div>

        <div className="p-5 md:p-8">
          {/* Import and template actions */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
            <section
              className="flex h-full flex-col rounded-xl border p-5 md:p-6"
              style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="grid size-10 shrink-0 place-items-center rounded-lg"
                  style={{ background: isDark ? '#1d3554' : '#dbeafe', color: '#2563eb' }}
                >
                  <UploadCloud className="size-5" aria-hidden />
                </div>
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: TEXT }}>Upload opening stock</h3>
                  <p className="mt-1 text-sm leading-6" style={{ color: TEXT_MUTED }}>
                    Select the completed CSV file, then submit it for import.
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <label htmlFor="ios-file" className="flex items-center text-sm font-semibold" style={{ color: TEXT }}>
                  File To Import:
                  <InfoDot tip="Select a CSV file that follows the template column order shown below." />
                </label>
                <label
                  htmlFor="ios-file"
                  className="mt-2 flex min-h-[46px] cursor-pointer items-center gap-3 rounded-lg border bg-white px-3 py-2 transition hover:border-blue-400 dark:bg-[#14171c]"
                  style={{ borderColor: file ? '#60a5fa' : PANEL_BORDER }}
                >
                  <span className="btn shrink-0 font-semibold text-white" style={{ background: '#2563eb' }}>
                    Browse files
                  </span>
                  <span className="min-w-0 truncate text-sm" style={{ color: file ? TEXT : TEXT_MUTED }}>
                    {file ? file.name : 'No file selected'}
                  </span>
                  <input
                    ref={fileInputRef}
                    id="ios-file"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={onFile}
                    className="sr-only"
                  />
                </label>
                <p className="mt-2 text-xs" style={{ color: TEXT_MUTED }}>
                  CSV files only · Keep the template headers and column order unchanged.
                </p>
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => void onSubmit()}
                  disabled={submitting}
                  className="btn font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
                  style={{ background: PURPLE }}
                >
                  <UploadCloud className="size-4" aria-hidden />
                  {submitting ? 'Importing…' : 'Submit'}
                </button>
                {file && (
                  <button
                    type="button"
                    onClick={clearFile}
                    className="btn"
                    style={{ background: 'transparent', border: `1px solid ${PANEL_BORDER}`, color: TEXT_MUTED }}
                  >
                    Clear file
                  </button>
                )}
              </div>

              {msg && (
                <div
                  role="status"
                  className="mt-5 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm"
                  style={{
                    background: msg.kind === 'ok' ? (isDark ? '#052e16' : '#f0fdf4') : (isDark ? '#3b0a0a' : '#fef2f2'),
                    borderColor: msg.kind === 'ok' ? '#86efac' : '#fca5a5',
                    color: msg.kind === 'ok' ? (isDark ? '#86efac' : '#166534') : (isDark ? '#fca5a5' : '#b91c1c'),
                  }}
                >
                  {msg.kind === 'ok'
                    ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                    : <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}
                  <span>{msg.text}</span>
                </div>
              )}
            </section>

            <section
              className="flex h-full flex-col rounded-xl border p-5 md:p-6"
              style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="grid size-10 shrink-0 place-items-center rounded-lg"
                  style={{ background: isDark ? '#153b32' : '#dcfce7', color: '#15803d' }}
                >
                  <Download className="size-5" aria-hidden />
                </div>
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: TEXT }}>Download template</h3>
                  <p className="mt-1 text-sm leading-6" style={{ color: TEXT_MUTED }}>
                    Start with the prepared CSV structure to avoid missing or misplaced fields.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg border px-3 py-3" style={{ background: isDark ? '#191e24' : '#ffffff', borderColor: PANEL_BORDER }}>
                  <p className="text-xl font-semibold" style={{ color: TEXT }}>6</p>
                  <p className="mt-1 text-xs" style={{ color: TEXT_MUTED }}>columns in order</p>
                </div>
                <div className="rounded-lg border px-3 py-3" style={{ background: isDark ? '#191e24' : '#ffffff', borderColor: PANEL_BORDER }}>
                  <p className="text-xl font-semibold" style={{ color: TEXT }}>1</p>
                  <p className="mt-1 text-xs" style={{ color: TEXT_MUTED }}>sample row included</p>
                </div>
              </div>

              <div className="mt-auto pt-6">
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="btn font-semibold text-white shadow-sm transition hover:brightness-110"
                  style={{ background: GREEN }}
                >
                  <Download className="size-4" aria-hidden />
                  Download template file
                </button>
                <p className="mt-3 text-xs leading-5" style={{ color: TEXT_MUTED }}>
                  Fill in the template, save it as CSV, and return to the upload panel when ready.
                </p>
              </div>
            </section>
          </div>

          {/* Instructions */}
          <section
            className="mt-6 rounded-xl border p-5 md:p-6"
            style={{ background: CARD_BG, borderColor: PANEL_BORDER }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold" style={{ color: TEXT }}>Instructions</h3>
                <p className="mt-1 text-sm" style={{ color: TEXT_MUTED }}>
                  Carefully follow the instructions before importing the file.
                </p>
              </div>
              <span
                className="rounded-md border px-2.5 py-1 text-xs font-medium"
                style={{ borderColor: PANEL_BORDER, color: TEXT_MUTED }}
              >
                Keep columns in order
              </span>
            </div>

            <div
              className="mt-5 flex items-start gap-3 rounded-lg border px-4 py-3"
              style={{ background: isDark ? '#1d2940' : '#eff6ff', borderColor: isDark ? '#334a70' : '#bfdbfe', color: isDark ? '#bfdbfe' : '#1e40af' }}
            >
              <FileSpreadsheet className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="text-sm leading-6">
                Use the template above whenever possible. Product <strong>SKU</strong>, <strong>Quantity</strong>, and <strong>Unit Cost (Before Tax)</strong> are required for a valid opening stock entry.
              </p>
            </div>

            <div className="mt-5 overflow-x-auto rounded-lg border" style={{ borderColor: PANEL_BORDER }}>
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr style={{ background: TABLE_HEAD_BG }}>
                    <th className="w-24 px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>Column</th>
                    <th className="w-[30%] px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>Column name</th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>Guidance</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((column, index) => (
                    <tr key={column.n} style={{ background: index % 2 === 0 ? TABLE_ROW_ALT : CARD_BG }}>
                      <td className="px-4 py-3 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                        <span className="grid size-7 place-items-center rounded-full text-xs font-bold text-white" style={{ background: PURPLE }}>
                          {column.n}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, color: TEXT }}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{column.name}</span>
                          <span
                            className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                            style={column.req
                              ? { borderColor: isDark ? '#86efac' : '#86efac', color: isDark ? '#86efac' : '#166534', background: isDark ? '#123522' : '#f0fdf4' }
                              : { borderColor: PANEL_BORDER, color: TEXT_MUTED, background: PANEL_BG }}
                          >
                            {column.req ? 'Required' : 'Optional'}
                          </span>
                        </div>
                        {column.note && <p className="mt-1 text-xs leading-5" style={{ color: TEXT_MUTED }}>{column.note}</p>}
                      </td>
                      <td className="px-4 py-3 align-top leading-6" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, color: TEXT_MUTED }}>
                        {column.instr || 'No additional guidance.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark'))
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const CARD_BG = isDark ? '#1b1f24' : '#ffffff'
  const CARD_BORDER = isDark ? '#2d333a' : '#e2e8f0'
  const PANEL_BG = isDark ? '#20252c' : '#f8fafc'
  const PANEL_BORDER = isDark ? '#363c44' : '#e5e7eb'
  const TABLE_HEAD_BG = isDark ? '#2a313b' : '#f1f5f9'
  const TABLE_ROW_ALT = isDark ? '#1f242b' : '#fafafa'
  const TEXT = isDark ? '#e5e7eb' : '#0f172a'
  const TEXT_MUTED = isDark ? '#9aa3ad' : '#64748b'
  const PURPLE = '#4f00e6'
  const GREEN = '#00a65a'

  // 37 columns per the product import specification (Column Number 1..37).
  type ColDef = { n: number; name: string; req?: boolean; note?: string; instr?: React.ReactNode }
  const columns: ColDef[] = [
    { n: 1,  name: 'Product Name',     req: true, instr: 'Name of the product' },
    { n: 2,  name: 'Brand',           req: true, instr: 'Name of the brand' },
    { n: 3,  name: 'Unit',            req: true, note: 'Name of the unit. If not found, the product will be added with the unit name.', instr: 'Name of the unit' },
    { n: 4,  name: 'Category',        req: true, instr: 'Name of the Category' },
    { n: 5,  name: 'Sub Category',    req: true, note: 'Name of the Sub-Category. If not found, the product will be added with the sub category name.', instr: 'Name of the Sub-Category' },
    { n: 6,  name: 'SKU',             req: true, note: 'Product SKU. If blank an SKU will be automatically generated.', instr: '' },
    { n: 7,  name: 'Barcode Type',    req: true, note: 'Supported: C128, C39, EAN-13, EAN-8, UPC-A, UPC-E, ITF-14. Currently supported for product.', instr: 'Barcode Type for the product' },
    { n: 8,  name: 'Manage Stock?',   req: true, instr: <>Enable or disable stock management<br />1 = Yes<br />0 = No</> },
    { n: 9,  name: 'Alert quantity',  req: true, instr: 'Alert quantity' },
    { n: 10, name: 'Supplier',        note: 'Product supply party (Only in numbers)', instr: '' },
    { n: 11, name: 'Supply Need (MH)', req: true, instr: 'Lead time for the supply period' },
    { n: 12, name: 'Applicable Tax',  req: true, note: 'Available Options: days, months', instr: <>Name of the Tax Name<br />If Purchase Price (excluding Tax) is not same as Purchase Price (Including Tax), then you must supply the Tax rate same.</> },
    { n: 13, name: 'Selling Price Tax Type', req: true, note: 'Available Options: inclusive, exclusive', instr: 'Selling Price Tax Type' },
    { n: 14, name: 'Product Type',    req: true, note: 'Available Options: single, variable', instr: '' },
    { n: 15, name: 'Variation Name', note: 'Required if product type is variable', instr: 'Name of the variation (Eg: Size, Color etc.)' },
    { n: 16, name: 'Variation Values', note: 'Required if product type is variable', instr: <>Values for the variation separated with <strong>|</strong><br />(Ex: Red|Blue|Green)</> },
    { n: 17, name: 'Variation SKUs', note: '', instr: <>SKUs of each variation separated by <strong>|</strong>. If product type is variable</> },
    { n: 18, name: 'Purchase Price (including Tax)', note: 'Required if Purchase Price (Including Tax) is not given.', instr: <>Purchase Price (including Tax) (Only in numbers)<br />For variable products <strong>|</strong> separated values with the same order as variation values<br />(Ex: 40|45|50)</> },
    { n: 19, name: 'Purchase Price (Excluding Tax)', note: 'Required if Purchase Price including Tax is not given.', instr: <>Purchase Price (Excluding Tax) (Only in numbers)<br />For variable products <strong>|</strong> separated values with the same order as variation values<br />(Ex: 40|45|50)</> },
    { n: 20, name: 'Profit Margin %', req: true, instr: 'Profit Margin (Only in numbers)' },
    { n: 21, name: 'Selling Price',  req: true, instr: 'Selling Price (Only in numbers)' },
    { n: 22, name: 'Opening Stock',  req: true, note: 'Opening Stock by adding this entry, Stock will be added by adding this entry.', instr: 'Opening Stock (Only in numbers)' },
    { n: 23, name: 'Opening stock location', req: true, instr: <>For variable products separate stock quantities with <strong>|</strong><br />(Ex: 100|50|200)</> },
    { n: 24, name: 'Expiry Date',     instr: <>Name of the business location<br />Format: mm-dd-yyyy. Ex: 11-25-2018</> },
    { n: 25, name: 'Enable Product Description, IMEI or Serial Number?', instr: <><strong>Only for Business</strong><br />1 = Yes<br />0 = No</> },
    { n: 26, name: 'Weight',         note: 'Optional', instr: '' },
    { n: 27, name: 'Rack',           instr: <>Rack details separated by <strong>|</strong> for different business locations carefully<br />(Ex: A-1|B-1|C-2)</> },
    { n: 28, name: 'Row',            instr: <>Row details separated by <strong>|</strong> for different business locations carefully<br />(Ex: ACDR-1|ACDR-2|ACDR-3)</> },
    { n: 29, name: 'Position',       instr: <>Position details separated by <strong>|</strong> for different business locations carefully<br />(Ex: 25|30|32)</> },
    { n: 30, name: 'Image',          instr: <>Image name must be uploaded to the server public/uploads/img<br />(Image must be uploaded)</> },
    { n: 31, name: 'Product Description', req: true, instr: 'Or URL of the image' },
    { n: 32, name: 'Custom Field1',  req: true, instr: '' },
    { n: 33, name: 'Custom Field2',  req: true, instr: '' },
    { n: 34, name: 'Custom Field3',  req: true, instr: '' },
    { n: 35, name: 'Custom Field4',  req: true, instr: '' },
    { n: 36, name: 'Not for selling', instr: <>1 = Yes<br />0 = No</> },
    { n: 37, name: 'Product Locations', instr: 'Comma-separated string of business locations where product will be available' },
  ]

  const cleanNote = (note?: string) => note?.replaceAll('<em>', '').replaceAll('</em>', '')

  const downloadTemplate = () => {
    const headers = columns.map((column) => column.name + (column.req ? ' (Required)' : ' (Optional)'))
    const sample = columns.map(() => '')
    const csv = [headers, sample].map((row) => row.map((cell) => {
      const value = String(cell ?? '').replace(/"/g, '""')
      return /[",\n]/.test(value) ? `"${value}"` : value
    }).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'products_import_template.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMsg(null)
    const nextFile = e.target.files?.[0] ?? null
    if (nextFile && !nextFile.name.toLowerCase().endsWith('.csv')) {
      setFile(null)
      setMsg({ kind: 'err', text: 'Please select a CSV file that follows the product import template.' })
      e.target.value = ''
      return
    }
    setFile(nextFile)
  }

  const clearFile = () => {
    setFile(null)
    setMsg(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const onSubmit = async () => {
    if (!file) {
      setMsg({ kind: 'err', text: 'Please select a CSV file to import.' })
      return
    }
    setSubmitting(true)
    setMsg(null)
    // Demo-only import flow; the production endpoint can replace this delay.
    await new Promise((resolve) => setTimeout(resolve, 700))
    const importedName = file.name
    setSubmitting(false)
    setMsg({ kind: 'ok', text: `“${importedName}” imported successfully. (Demo — no server was called.)` })
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const InfoDot = ({ tip }: { tip: string }) => (
    <span title={tip} className="ml-1 inline-grid size-[18px] place-items-center rounded-full bg-[#5bc0de] text-white text-[11px] font-bold cursor-help align-middle">i</span>
  )

  return (
    <div id="inv-import-products" className="w-full">
      <div
        className="overflow-hidden rounded-2xl shadow-sm"
        style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
      >
        {/* Page heading */}
        <div className="border-b px-5 py-5 md:px-8 md:py-6" style={{ borderColor: CARD_BORDER }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl"
                style={{ background: isDark ? '#33236b' : '#f0eaff', color: PURPLE }}
              >
                <FileSpreadsheet className="size-5" aria-hidden />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[25px] font-semibold leading-tight md:text-[28px]" style={{ color: TEXT }}>
                    Import Products
                  </h2>
                  <span
                    className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                    style={{ background: PANEL_BG, borderColor: PANEL_BORDER, color: TEXT_MUTED }}
                  >
                    CSV import
                  </span>
                </div>
                <p className="mt-1 text-sm md:text-[15px]" style={{ color: TEXT_MUTED }}>
                  Add products, pricing, stock, tax, and location details from one structured catalogue file.
                </p>
              </div>
            </div>
            <div className="text-right text-xs" style={{ color: TEXT_MUTED }}>
              <p className="font-semibold" style={{ color: TEXT }}>37-column template</p>
              <p className="mt-0.5">Required fields are marked below</p>
            </div>
          </div>
        </div>

        <div className="p-5 md:p-8">
          {/* Import and template actions */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
            <section
              className="flex h-full flex-col rounded-xl border p-5 md:p-6"
              style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="grid size-10 shrink-0 place-items-center rounded-lg"
                  style={{ background: isDark ? '#1d3554' : '#dbeafe', color: '#2563eb' }}
                >
                  <UploadCloud className="size-5" aria-hidden />
                </div>
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: TEXT }}>Upload product catalogue</h3>
                  <p className="mt-1 text-sm leading-6" style={{ color: TEXT_MUTED }}>
                    Select a completed CSV file with the columns in the order shown below.
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <label htmlFor="ip-file" className="flex items-center text-sm font-semibold" style={{ color: TEXT }}>
                  File To Import:
                  <InfoDot tip="Select a CSV file that follows the 37-column product import template." />
                </label>
                <label
                  htmlFor="ip-file"
                  className="mt-2 flex min-h-[46px] cursor-pointer items-center gap-3 rounded-lg border bg-white px-3 py-2 transition hover:border-blue-400 dark:bg-[#14171c]"
                  style={{ borderColor: file ? '#60a5fa' : PANEL_BORDER }}
                >
                  <span className="btn shrink-0 font-semibold text-white" style={{ background: '#2563eb' }}>
                    Browse files
                  </span>
                  <span className="min-w-0 truncate text-sm" style={{ color: file ? TEXT : TEXT_MUTED }}>
                    {file ? file.name : 'No file selected'}
                  </span>
                  <input
                    ref={fileInputRef}
                    id="ip-file"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={onFile}
                    className="sr-only"
                  />
                </label>
                <p className="mt-2 text-xs" style={{ color: TEXT_MUTED }}>
                  CSV files only · Keep the template headers and column order unchanged.
                </p>
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => void onSubmit()}
                  disabled={submitting}
                  className="btn font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
                  style={{ background: PURPLE }}
                >
                  <UploadCloud className="size-4" aria-hidden />
                  {submitting ? 'Importing…' : 'Submit'}
                </button>
                {file && (
                  <button
                    type="button"
                    onClick={clearFile}
                    className="btn"
                    style={{ background: 'transparent', border: `1px solid ${PANEL_BORDER}`, color: TEXT_MUTED }}
                  >
                    Clear file
                  </button>
                )}
              </div>

              {msg && (
                <div
                  role="status"
                  className="mt-5 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm"
                  style={{
                    background: msg.kind === 'ok' ? (isDark ? '#052e16' : '#f0fdf4') : (isDark ? '#3b0a0a' : '#fef2f2'),
                    borderColor: msg.kind === 'ok' ? '#86efac' : '#fca5a5',
                    color: msg.kind === 'ok' ? (isDark ? '#86efac' : '#166534') : (isDark ? '#fca5a5' : '#b91c1c'),
                  }}
                >
                  {msg.kind === 'ok'
                    ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                    : <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}
                  <span>{msg.text}</span>
                </div>
              )}
            </section>

            <section
              className="flex h-full flex-col rounded-xl border p-5 md:p-6"
              style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="grid size-10 shrink-0 place-items-center rounded-lg"
                  style={{ background: isDark ? '#153b32' : '#dcfce7', color: '#15803d' }}
                >
                  <Download className="size-5" aria-hidden />
                </div>
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: TEXT }}>Download template</h3>
                  <p className="mt-1 text-sm leading-6" style={{ color: TEXT_MUTED }}>
                    Start with the complete catalogue template and fill in only the values you need.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg border px-3 py-3" style={{ background: isDark ? '#191e24' : '#ffffff', borderColor: PANEL_BORDER }}>
                  <p className="text-xl font-semibold" style={{ color: TEXT }}>37</p>
                  <p className="mt-1 text-xs" style={{ color: TEXT_MUTED }}>columns in order</p>
                </div>
                <div className="rounded-lg border px-3 py-3" style={{ background: isDark ? '#191e24' : '#ffffff', borderColor: PANEL_BORDER }}>
                  <p className="text-xl font-semibold" style={{ color: TEXT }}>CSV</p>
                  <p className="mt-1 text-xs" style={{ color: TEXT_MUTED }}>ready-to-fill format</p>
                </div>
              </div>

              <div className="mt-5 rounded-lg border px-3 py-3" style={{ background: isDark ? '#1d2940' : '#eff6ff', borderColor: isDark ? '#334a70' : '#bfdbfe', color: isDark ? '#bfdbfe' : '#1e40af' }}>
                <p className="text-sm leading-6">
                  Required fields are identified in the instructions table. Keep every header and column position unchanged.
                </p>
              </div>

              <div className="mt-auto pt-6">
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="btn font-semibold text-white shadow-sm transition hover:brightness-110"
                  style={{ background: GREEN }}
                >
                  <Download className="size-4" aria-hidden />
                  Download template file
                </button>
                <p className="mt-3 text-xs leading-5" style={{ color: TEXT_MUTED }}>
                  Complete the spreadsheet, save it as CSV, and return to the upload panel when ready.
                </p>
              </div>
            </section>
          </div>

          {/* Instructions */}
          <section
            className="mt-6 rounded-xl border p-5 md:p-6"
            style={{ background: CARD_BG, borderColor: PANEL_BORDER }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold" style={{ color: TEXT }}>Instructions</h3>
                <p className="mt-1 text-sm" style={{ color: TEXT_MUTED }}>
                  Carefully follow the instructions before importing the file.
                </p>
              </div>
              <span
                className="rounded-md border px-2.5 py-1 text-xs font-medium"
                style={{ borderColor: PANEL_BORDER, color: TEXT_MUTED }}
              >
                37 columns · keep order
              </span>
            </div>

            <div
              className="mt-5 flex items-start gap-3 rounded-lg border px-4 py-3"
              style={{ background: isDark ? '#1d2940' : '#eff6ff', borderColor: isDark ? '#334a70' : '#bfdbfe', color: isDark ? '#bfdbfe' : '#1e40af' }}
            >
              <FileSpreadsheet className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="text-sm leading-6">
                This file covers product identity, pricing, tax, variations, opening stock, locations, images, and custom fields. Required fields are tagged below; optional fields may be left blank.
              </p>
            </div>

            <div className="mt-5 overflow-x-auto rounded-lg border" style={{ borderColor: PANEL_BORDER }}>
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead>
                  <tr style={{ background: TABLE_HEAD_BG }}>
                    <th className="w-24 px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>Column</th>
                    <th className="w-[30%] px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>Column name</th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>Guidance</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((column, index) => (
                    <tr key={column.n} style={{ background: index % 2 === 0 ? TABLE_ROW_ALT : CARD_BG }}>
                      <td className="px-4 py-3 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                        <span className="grid size-7 place-items-center rounded-full text-xs font-bold text-white" style={{ background: PURPLE }}>
                          {column.n}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, color: TEXT }}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{column.name}</span>
                          <span
                            className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                            style={column.req
                              ? { borderColor: '#86efac', color: isDark ? '#86efac' : '#166534', background: isDark ? '#123522' : '#f0fdf4' }
                              : { borderColor: PANEL_BORDER, color: TEXT_MUTED, background: PANEL_BG }}
                          >
                            {column.req ? 'Required' : 'Optional'}
                          </span>
                        </div>
                        {column.note && <p className="mt-1 text-xs leading-5" style={{ color: TEXT_MUTED }}>{cleanNote(column.note)}</p>}
                      </td>
                      <td className="px-4 py-3 align-top leading-6" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, color: TEXT_MUTED }}>
                        {column.instr || 'No additional guidance.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
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
    open: boolean
    editing: PriceGroup | null
    name: string
    description: string
    errors: Record<string, string>
    version: number
  }>({ open: false, editing: null, name: '', description: '', errors: {}, version: 0 })
  const [saving, setSaving] = useState(false)
  const [nextId, setNextId] = useState(() => Math.max(0, ...items.map((item: any) => item.id)) + 1)
  const [busy, setBusy] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')
  const [done, setDone] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark'))
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const openAdd = () => setModal({ open: true, editing: null, name: '', description: '', errors: {}, version: Date.now() })
  const openEdit = (group: PriceGroup) => setModal({ open: true, editing: group, name: group.name, description: group.description, errors: {}, version: Date.now() })
  const closeModal = () => setModal((current) => ({ ...current, open: false, editing: null }))

  const toggleSort = (key: 'name' | 'description') => {
    if (sortKey === key) setSortDir((direction) => direction === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const save = async () => {
    const errors: Record<string, string> = {}
    if (!modal.name.trim()) errors.name = 'Name is required'
    setModal((current) => ({ ...current, errors }))
    if (Object.keys(errors).length) return

    setSaving(true)
    await new Promise((resolve) => setTimeout(resolve, 200))
    if (modal.editing) {
      persist(items.map((item) => item.id === modal.editing!.id ? { ...item, name: modal.name.trim(), description: modal.description.trim() } : item))
    } else {
      const id = nextId
      persist([...items, { id, name: modal.name.trim(), description: modal.description.trim(), active: true }])
      setNextId(id + 1)
    }
    setSaving(false)
    closeModal()
  }

  const removeItem = (id: number) => {
    if (!window.confirm('Delete this price group?')) return
    persist(items.filter((item) => item.id !== id))
  }

  const toggleActive = (id: number) => {
    persist(items.map((item) => item.id === id ? { ...item, active: !item.active } : item))
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    let list = items
    if (query) list = list.filter((item) => item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query))
    list = [...list].sort((a, b) => {
      const aValue = a[sortKey].toLowerCase()
      const bValue = b[sortKey].toLowerCase()
      if (aValue < bValue) return sortDir === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [items, q, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / showEntries))
  const paged = filtered.slice((page - 1) * showEntries, page * showEntries)
  const startIdx = filtered.length === 0 ? 0 : (page - 1) * showEntries + 1
  const endIdx = Math.min(page * showEntries, filtered.length)
  const activeCount = items.filter((item) => item.active).length

  const flashDone = (which: 'csv' | 'excel' | 'print' | 'pdf') => {
    setDone(which)
    window.setTimeout(() => setDone(''), 1500)
  }
  const handlePrint = () => {
    setBusy('print')
    window.setTimeout(() => { window.print(); setBusy(''); flashDone('print') }, 150)
  }
  const handlePdf = () => {
    setBusy('pdf')
    window.setTimeout(() => { window.print(); setBusy(''); flashDone('pdf') }, 150)
  }
  const handleCsv = () => {
    setBusy('csv')
    const headers = ['#', 'Name', 'Description', 'Status']
    const rows = items.map((item, index) => [String(index + 1), item.name, item.description, item.active ? 'Active' : 'Inactive'])
    const csv = [headers, ...rows].map((row) => row.map((cell) => {
      const value = String(cell ?? '').replace(/"/g, '""')
      return /[",\n]/.test(value) ? `"${value}"` : value
    }).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'price-groups.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setBusy('')
    flashDone('csv')
  }
  const handleExcel = async () => {
    setBusy('excel')
    const rows = items.map((item, index) => ({ '#': index + 1, Name: item.name, Description: item.description, Status: item.active ? 'Active' : 'Inactive' }))
    const ok = await exportExcel('price-groups', rows)
    setBusy('')
    if (ok) flashDone('excel')
  }

  const CARD_BG = isDark ? '#1b1f24' : '#ffffff'
  const CARD_BORDER = isDark ? '#2d333a' : '#e2e8f0'
  const PANEL_BG = isDark ? '#20252c' : '#f8fafc'
  const PANEL_BORDER = isDark ? '#363c44' : '#e5e7eb'
  const TABLE_HEAD_BG = isDark ? '#2a313b' : '#f1f5f9'
  const TABLE_ROW_ALT = isDark ? '#1f242b' : '#fafafa'
  const TEXT = isDark ? '#e5e7eb' : '#0f172a'
  const TEXT_MUTED = isDark ? '#9aa3ad' : '#64748b'
  const INPUT_BG = isDark ? '#14171c' : '#ffffff'
  const INPUT_BORDER = isDark ? '#49515c' : '#cbd5e1'
  const PURPLE = '#4f00e6'
  const RED = '#dc2626'

  const SortChevron = ({ column }: { column: typeof sortKey }) => (
    <ChevronDown
      className={cn('size-4 transition-transform', sortKey !== column && 'opacity-40', sortKey === column && sortDir === 'asc' && 'rotate-180')}
      style={{ color: TEXT_MUTED }}
      aria-hidden
    />
  )

  return (
    <div id="inv-price-groups-wrap" className="w-full">
      <div
        className="overflow-hidden rounded-2xl shadow-sm"
        style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
      >
        {/* Page heading */}
        <div className="border-b px-5 py-5 md:px-8 md:py-6" style={{ borderColor: CARD_BORDER }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl"
                style={{ background: isDark ? '#33236b' : '#f0eaff', color: PURPLE }}
              >
                <Tags className="size-5" aria-hidden />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[25px] font-semibold leading-tight md:text-[28px]" style={{ color: TEXT }}>
                    All Selling Price Group
                  </h2>
                  <span
                    className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                    style={{ background: PANEL_BG, borderColor: PANEL_BORDER, color: TEXT_MUTED }}
                  >
                    Product settings
                  </span>
                </div>
                <p className="mt-1 max-w-3xl text-sm md:text-[15px]" style={{ color: TEXT_MUTED }}>
                  Create multiple price lists for your products and manage them from Update Price or the product actions menu.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openAdd}
              className="btn font-semibold text-white shadow-sm transition hover:brightness-110"
              style={{ background: PURPLE }}
            >
              <CirclePlus className="size-4" aria-hidden />
              Add price group
            </button>
          </div>
        </div>

        <div className="p-5 md:p-8">
          <section
            className="rounded-xl border p-4 md:p-6"
            style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold" style={{ color: TEXT }}>Price group catalogue</h3>
                  <span className="rounded-full border px-2.5 py-1 text-xs font-medium" style={{ borderColor: PANEL_BORDER, color: TEXT_MUTED }}>
                    {items.length} {items.length === 1 ? 'group' : 'groups'}
                  </span>
                  <span className="rounded-full border px-2.5 py-1 text-xs font-medium" style={{ borderColor: isDark ? '#276749' : '#bbf7d0', background: isDark ? '#123522' : '#f0fdf4', color: isDark ? '#86efac' : '#166534' }}>
                    {activeCount} active
                  </span>
                </div>
                <p className="mt-1 text-sm" style={{ color: TEXT_MUTED }}>
                  Use price groups to keep standard, wholesale, and other selling prices organised.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCsv}
                  disabled={busy !== ''}
                  className="btn font-semibold disabled:cursor-wait disabled:opacity-60"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  {done === 'csv' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <FileText className="size-4" aria-hidden />}
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => void handleExcel()}
                  disabled={busy !== ''}
                  className="btn font-semibold disabled:cursor-wait disabled:opacity-60"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  {done === 'excel' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <FileSpreadsheet className="size-4" aria-hidden />}
                  Excel
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={busy !== ''}
                  className="btn font-semibold disabled:cursor-wait disabled:opacity-60"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  {done === 'print' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <Printer className="size-4" aria-hidden />}
                  Print
                </button>
                <button
                  type="button"
                  onClick={handlePdf}
                  disabled={busy !== ''}
                  className="btn font-semibold disabled:cursor-wait disabled:opacity-60"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  {done === 'pdf' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <FileText className="size-4" aria-hidden />}
                  PDF
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: PANEL_BORDER }}>
              <div className="flex items-center gap-2 text-sm" style={{ color: TEXT_MUTED }}>
                <span>Show</span>
                <Select value={String(showEntries)} onChange={(e) => { setShowEntries(Number(e.target.value)); setPage(1) }} className="w-20">
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </Select>
                <span>entries</span>
              </div>
              <label className="flex w-full items-center gap-2 text-sm sm:w-auto" style={{ color: TEXT_MUTED }}>
                <span className="shrink-0">Search</span>
                <span className="relative w-full sm:w-[240px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
                  <input
                    type="search"
                    value={q}
                    onChange={(e) => { setQ(e.target.value); setPage(1) }}
                    placeholder="Search price groups"
                    aria-label="Search price groups"
                    className="h-[38px] w-full rounded-lg pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }}
                  />
                </span>
              </label>
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border" style={{ borderColor: PANEL_BORDER }}>
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr style={{ background: TABLE_HEAD_BG }}>
                    <th className="w-[30%] px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        Name <SortChevron column="name" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('description')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        Description <SortChevron column="description" />
                      </button>
                    </th>
                    <th className="w-28 px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>Status</th>
                    <th className="w-[220px] whitespace-nowrap px-4 py-3 text-right font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((group, index) => {
                    const zebra = index % 2 === 0
                    return (
                      <tr
                        key={group.id}
                        className="transition-colors"
                        style={{ background: zebra ? TABLE_ROW_ALT : CARD_BG, color: TEXT }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = isDark ? '#2b313b' : '#f1f5f9' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = zebra ? TABLE_ROW_ALT : CARD_BG }}
                      >
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          <p className="font-semibold">{group.name}</p>
                        </td>
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, color: group.description ? TEXT : TEXT_MUTED }}>
                          {group.description || 'No description added'}
                        </td>
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          <span
                            className="inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold"
                            style={group.active
                              ? { borderColor: isDark ? '#276749' : '#bbf7d0', background: isDark ? '#123522' : '#f0fdf4', color: isDark ? '#86efac' : '#166534' }
                              : { borderColor: isDark ? '#7f1d1d' : '#fecaca', background: isDark ? '#3b0a0a' : '#fef2f2', color: isDark ? '#fca5a5' : '#b91c1c' }}
                          >
                            {group.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 align-top text-right" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          <div className="flex flex-nowrap justify-end gap-2">
                            <CatalogueActionButton
                              label="Edit"
                              onClick={() => openEdit(group)}
                              style={{ background: 'transparent', border: `1px solid ${PURPLE}`, color: PURPLE }}
                            >
                              <Pencil className="size-4" aria-hidden />
                            </CatalogueActionButton>
                            <CatalogueActionButton
                              label="Delete"
                              onClick={() => removeItem(group.id)}
                              style={{ background: 'transparent', border: `1px solid ${RED}`, color: RED }}
                            >
                              <TrashIcon className="size-4" aria-hidden />
                            </CatalogueActionButton>
                            <CatalogueActionButton
                              label={group.active ? 'Deactivate' : 'Activate'}
                              onClick={() => toggleActive(group.id)}
                              style={{ background: 'transparent', border: `1px solid ${group.active ? RED : '#059669'}`, color: group.active ? RED : '#059669' }}
                            >
                              <PowerIcon className="size-4" on={group.active} aria-hidden />
                            </CatalogueActionButton>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center" style={{ color: TEXT_MUTED, background: CARD_BG }}>
                        <Tags className="mx-auto size-8 opacity-50" aria-hidden />
                        <p className="mt-3 font-semibold" style={{ color: TEXT }}>No price groups found</p>
                        <p className="mt-1 text-sm">Try a different search or add a new price group.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm" style={{ color: TEXT_MUTED }}>
              <span>{filtered.length === 0 ? 'No entries' : `Showing ${startIdx} to ${endIdx} of ${filtered.length} entries`}</span>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="btn rounded-r-none font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
                  <button
                    type="button"
                    key={number}
                    onClick={() => setPage(number)}
                    className={cn('btn rounded-none font-semibold -ml-px', number === page && 'text-white')}
                    style={number === page
                      ? { background: PURPLE, border: `1px solid ${PURPLE}`, color: '#ffffff' }
                      : { background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                  >
                    {number}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                  className="btn rounded-l-none font-semibold -ml-px disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  Next
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={modal.open}
        onClose={closeModal}
        title={modal.editing ? 'Edit Price Group' : 'Add Price Group'}
        variant="perfex"
        size="md"
        key={modal.version}
        headerClassName="bg-[#4f00e6]"
        closeBtnClassName="bg-[#d9230f] hover:bg-[#c1200e] rounded-[4px] size-10"
        footer={(
          <>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn font-semibold text-white disabled:cursor-wait disabled:opacity-60"
              style={{ background: PURPLE }}
            >
              {saving ? 'Saving…' : 'Save group'}
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="btn font-semibold"
              style={{ background: 'transparent', border: '1px solid #cbd5e1', color: isDark ? '#cbd5e1' : '#475569' }}
            >
              Cancel
            </button>
          </>
        )}
      >
        <div className="space-y-5 py-1">
          <div>
            <label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={modal.name}
              onChange={(e) => setModal((current) => ({ ...current, name: e.target.value }))}
              autoFocus
              placeholder="e.g. Wholesale Price"
              className="h-[42px] w-full rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              style={{ background: INPUT_BG, border: `1px solid ${modal.errors.name ? '#dc2626' : INPUT_BORDER}`, color: TEXT }}
            />
            {modal.errors.name && <p className="mt-1 text-xs italic text-red-500">{modal.errors.name}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>Description</label>
            <textarea
              value={modal.description}
              onChange={(e) => setModal((current) => ({ ...current, description: e.target.value }))}
              placeholder="Describe when this price group should be used"
              rows={4}
              className="w-full resize-y rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }}
            />
          </div>
        </div>
      </Modal>

      {/* Print-only block */}
      <div data-inv-pg-print aria-hidden style={{ position: 'fixed', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
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
          <thead><tr><th>#</th><th>Name</th><th>Description</th><th>Status</th></tr></thead>
          <tbody>{filtered.map((group, index) => (<tr key={group.id}><td>{index + 1}</td><td>{group.name}</td><td>{group.description || '—'}</td><td>{group.active ? 'Active' : 'Inactive'}</td></tr>))}</tbody>
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
function InvToolbarIconButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="btn disabled:cursor-not-allowed disabled:opacity-60"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        data-bs-toggle="tooltip"
        data-bs-placement="top"
        data-bs-title={label}
      >
        {children}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-[100] mb-2 -translate-x-1/2 whitespace-nowrap rounded-[0.375rem] bg-[#212529] px-2 py-1.5 text-sm font-normal leading-5 text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {label}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent border-t-[#212529]" aria-hidden="true" />
      </span>
    </span>
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

// Icon-only unit actions use Bootstrap tooltip data attributes plus a small
// portal tooltip so the label remains visible even inside the table scroller.
function CatalogueActionButton({
  label,
  onClick,
  style,
  children,
  disabled,
}: {
  label: string
  onClick: () => void
  style: React.CSSProperties
  children: React.ReactNode
  disabled?: boolean
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [tooltip, setTooltip] = useState<{ top: number; left: number; above: boolean } | null>(null)

  const showTooltip = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const above = rect.top > 48
    setTooltip({ top: above ? rect.top : rect.bottom, left: rect.left + rect.width / 2, above })
  }

  useEffect(() => {
    if (!tooltip) return
    const hideOnMove = () => setTooltip(null)
    window.addEventListener('scroll', hideOnMove, true)
    window.addEventListener('resize', hideOnMove)
    return () => {
      window.removeEventListener('scroll', hideOnMove, true)
      window.removeEventListener('resize', hideOnMove)
    }
  }, [tooltip])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={showTooltip}
        onMouseLeave={() => setTooltip(null)}
        onFocus={showTooltip}
        onBlur={() => setTooltip(null)}
        aria-label={label}
        data-bs-toggle="tooltip"
        data-bs-placement="top"
        data-bs-title={label}
        className={cn('unit-action-icon btn shrink-0', disabled && 'cursor-not-allowed opacity-40')}
        style={style}
      >
        {children}
      </button>
      {tooltip && typeof document !== 'undefined' && createPortal(
        <div
          role="tooltip"
          className="unit-action-tooltip"
          style={{
            position: 'fixed',
            top: tooltip.top,
            left: tooltip.left,
            transform: tooltip.above ? 'translate(-50%, calc(-100% - 8px))' : 'translate(-50%, 8px)',
            zIndex: 2147483647,
          }}
        >
          {label}
          <span
            aria-hidden="true"
            style={tooltip.above
              ? { position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #212529' }
              : { position: 'absolute', top: -5, left: '50%', transform: 'translateX(-50%)', borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '5px solid #212529' }}
          />
        </div>,
        document.body,
      )}
    </>
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
  const [sortKey, setSortKey] = useState<'id' | 'name' | 'code' | 'parent' | 'description' | 'status'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [modal, setModal] = useState<{
    open: boolean; editing: Category | null; name: string; code: string; description: string;
    status: 'Active' | 'Inactive'; asSub: boolean; parentId: number | '';
    errors: Record<string, string>; version: number;
  }>({ open: false, editing: null, name: '', code: '', description: '', status: 'Active', asSub: false, parentId: '', errors: {}, version: 0 })
  const [saving, setSaving] = useState(false)
  const [nextId, setNextId] = useState(() => Math.max(0, ...items.map((item: any) => item.id)) + 1)
  const [busy, setBusy] = useState<'' | 'print' | 'pdf' | 'excel'>('')
  const [done, setDone] = useState<'' | 'print' | 'pdf' | 'excel'>('')
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark'))
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const parentNames = useMemo(
    () => new Map(items.map((category) => [category.id, category.name])),
    [items],
  )
  const parentName = (category: Category) => category.parentId == null
    ? ''
    : parentNames.get(category.parentId) || 'Unassigned parent'
  const parentOptions = useMemo(
    () => items
      .filter((category) => !category.parentId && (!modal.editing || category.id !== modal.editing.id))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [items, modal.editing],
  )

  const openAdd = () => setModal({ open: true, editing: null, name: '', code: '', description: '', status: 'Active', asSub: false, parentId: '', errors: {}, version: Date.now() })
  const openEdit = (category: Category) => setModal({ open: true, editing: category, name: category.name, code: category.code, description: category.description, status: category.status, asSub: category.parentId != null, parentId: category.parentId ?? '', errors: {}, version: Date.now() })
  const closeModal = () => setModal((current) => ({ ...current, open: false, editing: null }))

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((direction) => direction === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const save = async () => {
    const errors: Record<string, string> = {}
    if (!modal.name.trim()) errors.name = 'Category name is required'
    if (modal.asSub && modal.parentId === '') errors.parentId = 'Please select a parent category'
    setModal((current) => ({ ...current, errors }))
    if (Object.keys(errors).length) return

    setSaving(true)
    await new Promise((resolve) => setTimeout(resolve, 200))
    const parentId = modal.asSub ? Number(modal.parentId) : null
    const code = modal.code.trim().toUpperCase() || modal.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'CAT'
    if (modal.editing) {
      persist(items.map((item) => item.id === modal.editing!.id
        ? { ...item, name: modal.name.trim(), code, description: modal.description.trim(), status: modal.status, parentId }
        : item))
    } else {
      const id = nextId
      persist([...items, { id, name: modal.name.trim(), code, description: modal.description.trim(), status: modal.status, parentId }])
      setNextId(id + 1)
    }
    setSaving(false)
    closeModal()
  }

  const removeItem = (id: number) => {
    if (!window.confirm('Delete this category?')) return
    persist(items.filter((category) => category.id !== id))
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    let list = items
    if (query) {
      list = list.filter((category) => {
        const haystack = [category.name, category.code, category.description || '', parentName(category)].join(' ').toLowerCase()
        return haystack.includes(query)
      })
    }
    list = [...list].sort((a, b) => {
      let aValue: string | number = ''
      let bValue: string | number = ''
      if (sortKey === 'id') { aValue = a.id; bValue = b.id }
      else if (sortKey === 'parent') { aValue = parentName(a).toLowerCase(); bValue = parentName(b).toLowerCase() }
      else if (sortKey === 'status') { aValue = a.status; bValue = b.status }
      else { aValue = String((a as any)[sortKey] ?? '').toLowerCase(); bValue = String((b as any)[sortKey] ?? '').toLowerCase() }
      if (aValue < bValue) return sortDir === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [items, q, sortKey, sortDir, parentNames])

  const totalPages = Math.max(1, Math.ceil(filtered.length / showEntries))
  const paged = filtered.slice((page - 1) * showEntries, page * showEntries)
  const startIdx = filtered.length === 0 ? 0 : (page - 1) * showEntries + 1
  const endIdx = Math.min(page * showEntries, filtered.length)
  const activeCount = items.filter((item) => item.status === 'Active').length
  const parentCount = items.filter((item) => item.parentId == null).length
  const childCount = items.length - parentCount

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const flashDone = (which: 'print' | 'pdf' | 'excel') => {
    setDone(which)
    window.setTimeout(() => setDone(''), 1500)
  }
  const handlePrint = () => {
    setBusy('print')
    window.setTimeout(() => { window.print(); setBusy(''); flashDone('print') }, 150)
  }
  const handlePdf = () => {
    setBusy('pdf')
    window.setTimeout(() => { window.print(); setBusy(''); flashDone('pdf') }, 150)
  }
  const handleExcel = async () => {
    setBusy('excel')
    const rows = items.map((category, index) => ({
      '#': index + 1,
      Category: category.name,
      Code: category.code,
      'Parent Category': parentName(category) || 'Top-level category',
      Description: category.description,
      Status: category.status,
    }))
    const ok = await exportExcel('categories', rows)
    setBusy('')
    if (ok) flashDone('excel')
  }

  const CARD_BG = isDark ? '#1b1f24' : '#ffffff'
  const CARD_BORDER = isDark ? '#2d333a' : '#e2e8f0'
  const PANEL_BG = isDark ? '#20252c' : '#f8fafc'
  const PANEL_BORDER = isDark ? '#363c44' : '#e5e7eb'
  const TABLE_HEAD_BG = isDark ? '#2a313b' : '#f1f5f9'
  const TABLE_ROW_ALT = isDark ? '#1f242b' : '#fafafa'
  const TEXT = isDark ? '#e5e7eb' : '#0f172a'
  const TEXT_MUTED = isDark ? '#9aa3ad' : '#64748b'
  const INPUT_BG = isDark ? '#14171c' : '#ffffff'
  const INPUT_BORDER = isDark ? '#49515c' : '#cbd5e1'
  const TEAL = '#0f766e'
  const RED = '#dc2626'

  const SortChevron = ({ column }: { column: typeof sortKey }) => (
    <ChevronDown
      className={cn('size-4 transition-transform', sortKey !== column && 'opacity-40', sortKey === column && sortDir === 'asc' && 'rotate-180')}
      style={{ color: TEXT_MUTED }}
      aria-hidden
    />
  )

  return (
    <div id="inv-categories-wrap" className="w-full">
      <div
        className="overflow-hidden rounded-2xl shadow-sm"
        style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
      >
        <div className="border-b px-5 py-5 md:px-8 md:py-6" style={{ borderColor: CARD_BORDER }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl"
                style={{ background: isDark ? '#123a3a' : '#ccfbf1', color: isDark ? '#5eead4' : TEAL }}
              >
                <Layers className="size-5" aria-hidden />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[25px] font-semibold leading-tight md:text-[28px]" style={{ color: TEXT }}>
                    Categories
                  </h2>
                  <span
                    className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                    style={{ background: PANEL_BG, borderColor: PANEL_BORDER, color: TEXT_MUTED }}
                  >
                    Product settings
                  </span>
                </div>
                <p className="mt-1 text-sm md:text-[15px]" style={{ color: TEXT_MUTED }}>
                  Organise top-level and nested product categories so your catalogue stays easy to browse.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openAdd}
              className="btn font-semibold text-white shadow-sm transition hover:brightness-110"
              style={{ background: TEAL }}
            >
              <CirclePlus className="size-4" aria-hidden />
              Add category
            </button>
          </div>
        </div>

        <div className="p-5 md:p-8">
          <section
            className="rounded-xl border p-4 md:p-6"
            style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold" style={{ color: TEXT }}>Category catalogue</h3>
                  <span className="rounded-full border px-2.5 py-1 text-xs font-medium" style={{ borderColor: PANEL_BORDER, color: TEXT_MUTED }}>
                    {items.length} {items.length === 1 ? 'category' : 'categories'}
                  </span>
                  <span className="rounded-full border px-2.5 py-1 text-xs font-medium" style={{ borderColor: isDark ? '#276749' : '#bbf7d0', background: isDark ? '#123522' : '#f0fdf4', color: isDark ? '#86efac' : '#166534' }}>
                    {activeCount} active
                  </span>
                </div>
                <p className="mt-1 text-sm" style={{ color: TEXT_MUTED }}>
                  {parentCount} top-level {parentCount === 1 ? 'category' : 'categories'} · {childCount} {childCount === 1 ? 'subcategory' : 'subcategories'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleExcel()}
                  disabled={busy !== ''}
                  className="btn font-semibold disabled:cursor-wait disabled:opacity-60"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  {done === 'excel' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <FileSpreadsheet className="size-4" aria-hidden />}
                  Excel
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={busy !== ''}
                  className="btn font-semibold disabled:cursor-wait disabled:opacity-60"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  {done === 'print' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <Printer className="size-4" aria-hidden />}
                  Print
                </button>
                <button
                  type="button"
                  onClick={handlePdf}
                  disabled={busy !== ''}
                  className="btn font-semibold disabled:cursor-wait disabled:opacity-60"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  {done === 'pdf' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <FileText className="size-4" aria-hidden />}
                  PDF
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: PANEL_BORDER }}>
              <div className="flex items-center gap-2 text-sm" style={{ color: TEXT_MUTED }}>
                <span>Show</span>
                <Select value={String(showEntries)} onChange={(e) => { setShowEntries(Number(e.target.value)); setPage(1) }} className="w-20">
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </Select>
                <span>entries</span>
              </div>
              <label className="flex w-full items-center gap-2 text-sm sm:w-auto" style={{ color: TEXT_MUTED }}>
                <span className="shrink-0">Search</span>
                <span className="relative w-full sm:w-[260px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
                  <input
                    type="search"
                    value={q}
                    onChange={(e) => { setQ(e.target.value); setPage(1) }}
                    placeholder="Search categories"
                    aria-label="Search categories"
                    className="h-[38px] w-full rounded-lg pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                    style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }}
                  />
                </span>
              </label>
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border" style={{ borderColor: PANEL_BORDER }}>
              <table className="w-full min-w-[1180px] border-collapse text-sm">
                <thead>
                  <tr style={{ background: TABLE_HEAD_BG }}>
                    <th className="w-20 px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('id')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        # <SortChevron column="id" />
                      </button>
                    </th>
                    <th className="w-[24%] px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        Category <SortChevron column="name" />
                      </button>
                    </th>
                    <th className="w-28 px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('code')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        Code <SortChevron column="code" />
                      </button>
                    </th>
                    <th className="w-[19%] px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('parent')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        Parent <SortChevron column="parent" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('description')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        Description <SortChevron column="description" />
                      </button>
                    </th>
                    <th className="w-28 px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('status')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        Status <SortChevron column="status" />
                      </button>
                    </th>
                    <th className="w-[220px] whitespace-nowrap px-4 py-3 text-right font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((category, index) => {
                    const zebra = index % 2 === 0
                    const parent = parentName(category)
                    return (
                      <tr
                        key={category.id}
                        className="transition-colors"
                        style={{ background: zebra ? TABLE_ROW_ALT : CARD_BG, color: TEXT }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = isDark ? '#2b313b' : '#f1f5f9' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = zebra ? TABLE_ROW_ALT : CARD_BG }}
                      >
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          <span className="grid size-7 place-items-center rounded-full text-xs font-bold text-white" style={{ background: TEAL }}>
                            {(page - 1) * showEntries + index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, color: TEXT }}>
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg" style={{ background: category.parentId != null ? (isDark ? '#2b3e48' : '#e0f2fe') : (isDark ? '#123a3a' : '#ccfbf1'), color: category.parentId != null ? (isDark ? '#7dd3fc' : '#0369a1') : (isDark ? '#5eead4' : TEAL) }}>
                              <Layers className="size-3.5" aria-hidden />
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold">{category.name}</p>
                              <p className="mt-1 text-xs" style={{ color: TEXT_MUTED }}>
                                {category.parentId != null ? 'Subcategory' : 'Top-level category'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, color: TEXT }}>
                          <span className="rounded-md border px-2 py-1 font-mono text-xs font-semibold" style={{ borderColor: PANEL_BORDER, color: TEXT_MUTED }}>{category.code || '—'}</span>
                        </td>
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, color: parent ? TEXT : TEXT_MUTED }}>
                          {parent || 'Top-level category'}
                        </td>
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, color: category.description ? TEXT : TEXT_MUTED }}>
                          {category.description || 'No description added'}
                        </td>
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          <span
                            className="inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold"
                            style={category.status === 'Active'
                              ? { borderColor: isDark ? '#276749' : '#bbf7d0', background: isDark ? '#123522' : '#f0fdf4', color: isDark ? '#86efac' : '#166534' }
                              : { borderColor: isDark ? '#7f1d1d' : '#fecaca', background: isDark ? '#3b0a0a' : '#fef2f2', color: isDark ? '#fca5a5' : '#b91c1c' }}
                          >
                            {category.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 align-top text-right" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          <div className="flex flex-nowrap justify-end gap-2">
                            <CatalogueActionButton
                              label="Edit"
                              onClick={() => openEdit(category)}
                              style={{ background: 'transparent', border: `1px solid ${TEAL}`, color: TEAL }}
                            >
                              <Pencil className="size-4" aria-hidden />
                            </CatalogueActionButton>
                            <CatalogueActionButton
                              label="Delete"
                              onClick={() => removeItem(category.id)}
                              style={{ background: 'transparent', border: `1px solid ${RED}`, color: RED }}
                            >
                              <TrashIcon className="size-4" aria-hidden />
                            </CatalogueActionButton>
                            <CatalogueActionButton
                              label={category.status === 'Active' ? 'Deactivate' : 'Activate'}
                              onClick={() => persist(items.map((item) => item.id === category.id ? { ...item, status: item.status === 'Active' ? 'Inactive' : 'Active' } : item))}
                              style={{ background: 'transparent', border: `1px solid ${category.status === 'Active' ? '#b45309' : '#059669'}`, color: category.status === 'Active' ? '#b45309' : '#059669' }}
                            >
                              <PowerIcon className="size-4" on={category.status !== 'Active'} aria-hidden />
                            </CatalogueActionButton>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center" style={{ color: TEXT_MUTED, background: CARD_BG }}>
                        <Layers className="mx-auto size-8 opacity-50" aria-hidden />
                        <p className="mt-3 font-semibold" style={{ color: TEXT }}>No categories found</p>
                        <p className="mt-1 text-sm">Try a different search or add a new category.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm" style={{ color: TEXT_MUTED }}>
              <span>{filtered.length === 0 ? 'No entries' : `Showing ${startIdx} to ${endIdx} of ${filtered.length} entries`}</span>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="btn rounded-r-none font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
                  <button
                    type="button"
                    key={number}
                    onClick={() => setPage(number)}
                    className={cn('btn rounded-none font-semibold -ml-px', number === page && 'text-white')}
                    style={number === page
                      ? { background: TEAL, border: `1px solid ${TEAL}`, color: '#ffffff' }
                      : { background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                  >
                    {number}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                  className="btn rounded-l-none font-semibold -ml-px disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  Next
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={modal.open}
        onClose={closeModal}
        title={modal.editing ? 'Edit Category' : 'Add Category'}
        variant="perfex"
        size="lg"
        key={modal.version}
        headerClassName="bg-[#0f766e]"
        closeBtnClassName="bg-[#dc2626] hover:bg-[#b91c1c] rounded-md size-10"
        footer={(
          <>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn font-semibold text-white disabled:cursor-wait disabled:opacity-60"
              style={{ background: TEAL }}
            >
              {saving ? 'Saving…' : 'Save category'}
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="btn font-semibold"
              style={{ background: 'transparent', border: '1px solid #cbd5e1', color: isDark ? '#cbd5e1' : '#475569' }}
            >
              Cancel
            </button>
          </>
        )}
      >
        <div className="space-y-5 py-1">
          <div>
            <label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>
              Category name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={modal.name}
              onChange={(e) => setModal((current) => ({ ...current, name: e.target.value, errors: { ...current.errors, name: '' } }))}
              autoFocus
              placeholder="e.g. Clothing"
              aria-invalid={!!modal.errors.name}
              className="h-[42px] w-full rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              style={{ background: INPUT_BG, border: `1px solid ${modal.errors.name ? '#dc2626' : INPUT_BORDER}`, color: TEXT }}
            />
            {modal.errors.name && <p className="mt-1 text-xs italic text-red-500">{modal.errors.name}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>Category code</label>
              <input
                type="text"
                value={modal.code}
                onChange={(e) => setModal((current) => ({ ...current, code: e.target.value }))}
                placeholder="e.g. CLT"
                className="h-[42px] w-full rounded-lg px-3 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>Status</label>
              <Select
                value={modal.status}
                onChange={(e) => setModal((current) => ({ ...current, status: e.target.value as 'Active' | 'Inactive' }))}
                className="h-[42px] w-full text-sm"
                style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>Description</label>
            <textarea
              value={modal.description}
              onChange={(e) => setModal((current) => ({ ...current, description: e.target.value }))}
              placeholder="Add a short description for this category"
              rows={4}
              className="w-full resize-y rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }}
            />
          </div>

          <div className="rounded-lg border p-3" style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}>
            <label className="flex cursor-pointer select-none items-start gap-3" style={{ color: TEXT }}>
              <button
                type="button"
                role="checkbox"
                aria-checked={modal.asSub}
                onClick={() => setModal((current) => ({ ...current, asSub: !current.asSub, parentId: !current.asSub ? current.parentId : '', errors: { ...current.errors, parentId: '' } }))}
                className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 transition"
                style={{ background: modal.asSub ? TEAL : 'transparent', borderColor: modal.asSub ? TEAL : (isDark ? '#8fa2b8' : '#9aa0a6'), color: '#fff' }}
              >
                {modal.asSub && <Check className="size-4" strokeWidth={3} />}
              </button>
              <span>
                <span className="block text-sm font-semibold">Add as subcategory</span>
                <span className="mt-0.5 block text-xs" style={{ color: TEXT_MUTED }}>Place this category beneath an existing top-level category.</span>
              </span>
            </label>
            {modal.asSub && (
              <div className="mt-3 pl-9">
                <label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>Parent category <span className="text-red-500">*</span></label>
                <Select
                  value={String(modal.parentId)}
                  onChange={(e) => setModal((current) => ({ ...current, parentId: e.target.value ? Number(e.target.value) : '', errors: { ...current.errors, parentId: '' } }))}
                  className="h-[42px] w-full text-sm"
                  aria-invalid={!!modal.errors.parentId}
                  style={{ background: INPUT_BG, border: `1px solid ${modal.errors.parentId ? '#dc2626' : INPUT_BORDER}`, color: modal.parentId === '' ? TEXT_MUTED : TEXT }}
                >
                  <option value="">Please select a parent category</option>
                  {parentOptions.map((parent) => <option key={parent.id} value={parent.id}>{parent.name}</option>)}
                </Select>
                {modal.errors.parentId && <p className="mt-1 text-xs italic text-red-500">{modal.errors.parentId}</p>}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <div data-inv-cat-print aria-hidden style={{ position: 'fixed', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
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
        <h1>Categories</h1>
        <div className="sub">Printed {new Date().toLocaleString()} · FitPro Gym App</div>
        <table>
          <thead><tr><th>#</th><th>Category</th><th>Code</th><th>Parent Category</th><th>Description</th><th>Status</th></tr></thead>
          <tbody>{filtered.map((category, index) => (<tr key={category.id}><td>{index + 1}</td><td>{category.name}</td><td>{category.code || '—'}</td><td>{parentName(category) || 'Top-level category'}</td><td>{category.description || '—'}</td><td>{category.status}</td></tr>))}</tbody>
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
  const [sortKey, setSortKey] = useState<'id' | 'name' | 'shortName' | 'allowDecimal' | 'conversion' | 'status'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [modal, setModal] = useState<{
    open: boolean; editing: Unit | null;
    name: string; shortName: string; allowDecimal: 'YES' | 'NO' | ''; status: 'Active' | 'Inactive';
    asMultiple: boolean; multiplier: string; baseUnitId: number | '';
    errors: Record<string, string>; version: number;
  }>({ open: false, editing: null, name: '', shortName: '', allowDecimal: '', status: 'Active', asMultiple: false, multiplier: '', baseUnitId: '', errors: {}, version: 0 })
  const [saving, setSaving] = useState(false)
  const [nextId, setNextId] = useState(() => Math.max(0, ...items.map((item: any) => item.id)) + 1)
  const [busy, setBusy] = useState<'' | 'print' | 'pdf' | 'excel'>('')
  const [done, setDone] = useState<'' | 'print' | 'pdf' | 'excel'>('')
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark'))
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const baseUnitsById = useMemo(
    () => new Map(items.map((unit) => [unit.id, unit])),
    [items],
  )
  const baseUnitFor = (unit: Unit) => unit.baseUnitId == null ? undefined : baseUnitsById.get(unit.baseUnitId)
  const conversionLabel = (unit: Unit) => {
    const base = baseUnitFor(unit)
    if (!base || unit.multiplier == null) return 'Standalone base unit'
    return `1 ${unit.shortName || unit.name} = ${unit.multiplier} ${base.shortName || base.name}`
  }

  const openAdd = () => setModal({ open: true, editing: null, name: '', shortName: '', allowDecimal: '', status: 'Active', asMultiple: false, multiplier: '', baseUnitId: '', errors: {}, version: Date.now() })
  const openEdit = (unit: Unit) => setModal({ open: true, editing: unit, name: unit.name, shortName: unit.shortName, allowDecimal: unit.allowDecimal, status: unit.status, asMultiple: unit.baseUnitId != null, multiplier: unit.multiplier != null ? String(unit.multiplier) : '', baseUnitId: unit.baseUnitId ?? '', errors: {}, version: Date.now() })
  const closeModal = () => setModal((current) => ({ ...current, open: false, editing: null }))

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((direction) => direction === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const save = async () => {
    const errors: Record<string, string> = {}
    if (!modal.name.trim()) errors.name = 'Unit name is required'
    if (!modal.allowDecimal) errors.allowDecimal = 'Please select whether decimals are allowed'
    if (modal.asMultiple) {
      const multiplier = parseFloat(modal.multiplier)
      if (!modal.multiplier.trim() || isNaN(multiplier) || multiplier <= 0) errors.multiplier = 'Enter a valid multiplier'
      if (modal.baseUnitId === '') errors.baseUnitId = 'Please select a base unit'
    }
    setModal((current) => ({ ...current, errors }))
    if (Object.keys(errors).length) return

    setSaving(true)
    await new Promise((resolve) => setTimeout(resolve, 200))
    const baseUnitId = modal.asMultiple && modal.baseUnitId !== '' ? Number(modal.baseUnitId) : null
    const multiplier = modal.asMultiple ? parseFloat(modal.multiplier) : null
    if (modal.editing) {
      persist(items.map((item) => item.id === modal.editing!.id
        ? { ...item, name: modal.name.trim(), shortName: modal.shortName.trim(), allowDecimal: modal.allowDecimal, status: modal.status, baseUnitId, multiplier }
        : item))
    } else {
      const id = nextId
      persist([...items, { id, name: modal.name.trim(), shortName: modal.shortName.trim(), allowDecimal: modal.allowDecimal, status: modal.status, baseUnitId, multiplier }])
      setNextId(id + 1)
    }
    setSaving(false)
    closeModal()
  }

  const removeItem = (id: number) => {
    if (!window.confirm('Delete this unit?')) return
    persist(items.filter((unit) => unit.id !== id))
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    let list = items
    if (query) {
      list = list.filter((unit) => {
        const base = baseUnitFor(unit)
        const haystack = [unit.name, unit.shortName, unit.allowDecimal || '', conversionLabel(unit), base?.name || '', base?.shortName || '']
          .join(' ')
          .toLowerCase()
        return haystack.includes(query)
      })
    }
    list = [...list].sort((a, b) => {
      let aValue: string | number = ''
      let bValue: string | number = ''
      if (sortKey === 'id') { aValue = a.id; bValue = b.id }
      else if (sortKey === 'allowDecimal') { aValue = a.allowDecimal || ''; bValue = b.allowDecimal || '' }
      else if (sortKey === 'conversion') { aValue = conversionLabel(a).toLowerCase(); bValue = conversionLabel(b).toLowerCase() }
      else if (sortKey === 'status') { aValue = a.status; bValue = b.status }
      else { aValue = String((a as any)[sortKey] ?? '').toLowerCase(); bValue = String((b as any)[sortKey] ?? '').toLowerCase() }
      if (aValue < bValue) return sortDir === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [items, q, sortKey, sortDir, baseUnitsById])

  const totalPages = Math.max(1, Math.ceil(filtered.length / showEntries))
  const paged = filtered.slice((page - 1) * showEntries, page * showEntries)
  const startIdx = filtered.length === 0 ? 0 : (page - 1) * showEntries + 1
  const endIdx = Math.min(page * showEntries, filtered.length)
  const activeCount = items.filter((item) => item.status === 'Active').length
  const decimalCount = items.filter((item) => item.allowDecimal === 'YES').length
  const conversionCount = items.filter((item) => item.baseUnitId != null && item.multiplier != null).length

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const flashDone = (which: 'print' | 'pdf' | 'excel') => {
    setDone(which)
    window.setTimeout(() => setDone(''), 1500)
  }
  const handlePrint = () => {
    setBusy('print')
    window.setTimeout(() => { window.print(); setBusy(''); flashDone('print') }, 150)
  }
  const handlePdf = () => {
    setBusy('pdf')
    window.setTimeout(() => { window.print(); setBusy(''); flashDone('pdf') }, 150)
  }
  const handleExcel = async () => {
    setBusy('excel')
    const rows = items.map((unit, index) => ({
      '#': index + 1,
      Name: unit.name,
      'Short Name': unit.shortName,
      'Allow Decimal': unit.allowDecimal || '',
      Conversion: conversionLabel(unit),
      Status: unit.status,
    }))
    const ok = await exportExcel('units', rows)
    setBusy('')
    if (ok) flashDone('excel')
  }

  const CARD_BG = isDark ? '#1b1f24' : '#ffffff'
  const CARD_BORDER = isDark ? '#2d333a' : '#e2e8f0'
  const PANEL_BG = isDark ? '#20252c' : '#f8fafc'
  const PANEL_BORDER = isDark ? '#363c44' : '#e5e7eb'
  const TABLE_HEAD_BG = isDark ? '#2a313b' : '#f1f5f9'
  const TABLE_ROW_ALT = isDark ? '#1f242b' : '#fafafa'
  const TEXT = isDark ? '#e5e7eb' : '#0f172a'
  const TEXT_MUTED = isDark ? '#9aa3ad' : '#64748b'
  const INPUT_BG = isDark ? '#14171c' : '#ffffff'
  const INPUT_BORDER = isDark ? '#49515c' : '#cbd5e1'
  const BLUE = '#2563eb'
  const RED = '#dc2626'

  const SortChevron = ({ column }: { column: typeof sortKey }) => (
    <ChevronDown
      className={cn('size-4 transition-transform', sortKey !== column && 'opacity-40', sortKey === column && sortDir === 'asc' && 'rotate-180')}
      style={{ color: TEXT_MUTED }}
      aria-hidden
    />
  )

  const InfoIcon = ({ title }: { title: string }) => (
    <span title={title} className="inline-grid size-[18px] place-items-center rounded-full bg-sky-500 text-white text-[11px] font-bold cursor-help select-none" style={{ lineHeight: 1 }}>i</span>
  )

  const baseUnitOptions = useMemo(
    () => items.filter((unit) => !modal.editing || unit.id !== modal.editing.id).sort((a, b) => a.name.localeCompare(b.name)),
    [items, modal.editing],
  )

  return (
    <div id="inv-units-wrap" className="w-full">
      <div
        className="overflow-hidden rounded-2xl shadow-sm"
        style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
      >
        <div className="border-b px-5 py-5 md:px-8 md:py-6" style={{ borderColor: CARD_BORDER }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl"
                style={{ background: isDark ? '#172554' : '#dbeafe', color: isDark ? '#93c5fd' : BLUE }}
              >
                <Package className="size-5" aria-hidden />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[25px] font-semibold leading-tight md:text-[28px]" style={{ color: TEXT }}>
                    Units
                  </h2>
                  <span
                    className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                    style={{ background: PANEL_BG, borderColor: PANEL_BORDER, color: TEXT_MUTED }}
                  >
                    Product settings
                  </span>
                </div>
                <p className="mt-1 text-sm md:text-[15px]" style={{ color: TEXT_MUTED }}>
                  Define how products are measured, displayed, and converted across your catalogue.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openAdd}
              className="btn font-semibold text-white shadow-sm transition hover:brightness-110"
              style={{ background: BLUE }}
            >
              <CirclePlus className="size-4" aria-hidden />
              Add unit
            </button>
          </div>
        </div>

        <div className="p-5 md:p-8">
          <section
            className="rounded-xl border p-4 md:p-6"
            style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold" style={{ color: TEXT }}>Unit catalogue</h3>
                  <span className="rounded-full border px-2.5 py-1 text-xs font-medium" style={{ borderColor: PANEL_BORDER, color: TEXT_MUTED }}>
                    {items.length} {items.length === 1 ? 'unit' : 'units'}
                  </span>
                  <span className="rounded-full border px-2.5 py-1 text-xs font-medium" style={{ borderColor: isDark ? '#276749' : '#bbf7d0', background: isDark ? '#123522' : '#f0fdf4', color: isDark ? '#86efac' : '#166534' }}>
                    {activeCount} active
                  </span>
                </div>
                <p className="mt-1 text-sm" style={{ color: TEXT_MUTED }}>
                  {decimalCount} allow decimal quantities · {conversionCount} {conversionCount === 1 ? 'conversion' : 'conversions'} configured
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleExcel()}
                  disabled={busy !== ''}
                  className="btn font-semibold disabled:cursor-wait disabled:opacity-60"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  {done === 'excel' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <FileSpreadsheet className="size-4" aria-hidden />}
                  Excel
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={busy !== ''}
                  className="btn font-semibold disabled:cursor-wait disabled:opacity-60"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  {done === 'print' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <Printer className="size-4" aria-hidden />}
                  Print
                </button>
                <button
                  type="button"
                  onClick={handlePdf}
                  disabled={busy !== ''}
                  className="btn font-semibold disabled:cursor-wait disabled:opacity-60"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  {done === 'pdf' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <FileText className="size-4" aria-hidden />}
                  PDF
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: PANEL_BORDER }}>
              <div className="flex items-center gap-2 text-sm" style={{ color: TEXT_MUTED }}>
                <span>Show</span>
                <Select value={String(showEntries)} onChange={(e) => { setShowEntries(Number(e.target.value)); setPage(1) }} className="w-20">
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </Select>
                <span>entries</span>
              </div>
              <label className="flex w-full items-center gap-2 text-sm sm:w-auto" style={{ color: TEXT_MUTED }}>
                <span className="shrink-0">Search</span>
                <span className="relative w-full sm:w-[260px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
                  <input
                    type="search"
                    value={q}
                    onChange={(e) => { setQ(e.target.value); setPage(1) }}
                    placeholder="Search units"
                    aria-label="Search units"
                    className="h-[38px] w-full rounded-lg pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }}
                  />
                </span>
              </label>
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border" style={{ borderColor: PANEL_BORDER }}>
              <table className="w-full min-w-[1160px] border-collapse text-sm">
                <thead>
                  <tr style={{ background: TABLE_HEAD_BG }}>
                    <th className="w-20 px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('id')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        # <SortChevron column="id" />
                      </button>
                    </th>
                    <th className="w-[25%] px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        Unit <SortChevron column="name" />
                      </button>
                    </th>
                    <th className="w-32 px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('shortName')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        Short name <SortChevron column="shortName" />
                      </button>
                    </th>
                    <th className="w-40 px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('allowDecimal')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        Decimal quantities <InfoIcon title="Allow decimal quantities for this unit, such as 1.5 kg." /><SortChevron column="allowDecimal" />
                      </button>
                    </th>
                    <th className="w-[25%] px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('conversion')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        Conversion <SortChevron column="conversion" />
                      </button>
                    </th>
                    <th className="w-28 px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('status')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        Status <SortChevron column="status" />
                      </button>
                    </th>
                    <th className="w-[220px] whitespace-nowrap px-4 py-3 text-right font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((unit, index) => {
                    const zebra = index % 2 === 0
                    const base = baseUnitFor(unit)
                    const allowsDecimal = unit.allowDecimal === 'YES'
                    return (
                      <tr
                        key={unit.id}
                        className="transition-colors"
                        style={{ background: zebra ? TABLE_ROW_ALT : CARD_BG, color: TEXT }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = isDark ? '#2b313b' : '#f1f5f9' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = zebra ? TABLE_ROW_ALT : CARD_BG }}
                      >
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          <span className="grid size-7 place-items-center rounded-full text-xs font-bold text-white" style={{ background: BLUE }}>
                            {(page - 1) * showEntries + index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, color: TEXT }}>
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg" style={{ background: isDark ? '#172554' : '#dbeafe', color: isDark ? '#93c5fd' : BLUE }}>
                              <Package className="size-3.5" aria-hidden />
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold">{unit.name}</p>
                              <p className="mt-1 text-xs" style={{ color: TEXT_MUTED }}>
                                {allowsDecimal ? 'Decimal quantities allowed' : 'Whole quantities only'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          <span className="rounded-md border px-2 py-1 font-mono text-xs font-semibold" style={{ borderColor: PANEL_BORDER, color: unit.shortName ? TEXT : TEXT_MUTED }}>{unit.shortName || '—'}</span>
                        </td>
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          <span
                            className="inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold"
                            style={allowsDecimal
                              ? { borderColor: isDark ? '#276749' : '#bbf7d0', background: isDark ? '#123522' : '#f0fdf4', color: isDark ? '#86efac' : '#166534' }
                              : { borderColor: isDark ? '#4b5563' : '#cbd5e1', background: isDark ? '#252b33' : '#f8fafc', color: TEXT_MUTED }}
                          >
                            {unit.allowDecimal || 'Not set'}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          {base && unit.multiplier != null ? (
                            <>
                              <p className="font-medium" style={{ color: TEXT }}>{conversionLabel(unit)}</p>
                              <p className="mt-1 text-xs" style={{ color: TEXT_MUTED }}>Based on {base.name}</p>
                            </>
                          ) : (
                            <span className="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium" style={{ borderColor: PANEL_BORDER, color: TEXT_MUTED }}>
                              Standalone base unit
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          <span
                            className="inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold"
                            style={unit.status === 'Active'
                              ? { borderColor: isDark ? '#276749' : '#bbf7d0', background: isDark ? '#123522' : '#f0fdf4', color: isDark ? '#86efac' : '#166534' }
                              : { borderColor: isDark ? '#7f1d1d' : '#fecaca', background: isDark ? '#3b0a0a' : '#fef2f2', color: isDark ? '#fca5a5' : '#b91c1c' }}
                          >
                            {unit.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 align-top text-right" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          <div className="flex flex-nowrap justify-end gap-2">
                            <CatalogueActionButton
                              label="Edit"
                              onClick={() => openEdit(unit)}
                              style={{ background: 'transparent', border: `1px solid ${BLUE}`, color: BLUE }}
                            >
                              <Pencil className="size-4" aria-hidden />
                            </CatalogueActionButton>
                            <CatalogueActionButton
                              label="Delete"
                              onClick={() => removeItem(unit.id)}
                              style={{ background: 'transparent', border: `1px solid ${RED}`, color: RED }}
                            >
                              <TrashIcon className="size-4" aria-hidden />
                            </CatalogueActionButton>
                            <CatalogueActionButton
                              label={unit.status === 'Active' ? 'Deactivate' : 'Activate'}
                              onClick={() => persist(items.map((item) => item.id === unit.id ? { ...item, status: item.status === 'Active' ? 'Inactive' : 'Active' } : item))}
                              style={{ background: 'transparent', border: `1px solid ${unit.status === 'Active' ? '#b45309' : '#059669'}`, color: unit.status === 'Active' ? '#b45309' : '#059669' }}
                            >
                              <PowerIcon className="size-4" on={unit.status !== 'Active'} aria-hidden />
                            </CatalogueActionButton>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center" style={{ color: TEXT_MUTED, background: CARD_BG }}>
                        <Package className="mx-auto size-8 opacity-50" aria-hidden />
                        <p className="mt-3 font-semibold" style={{ color: TEXT }}>No units found</p>
                        <p className="mt-1 text-sm">Try a different search or add a new unit.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm" style={{ color: TEXT_MUTED }}>
              <span>{filtered.length === 0 ? 'No entries' : `Showing ${startIdx} to ${endIdx} of ${filtered.length} entries`}</span>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="btn rounded-r-none font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
                  <button
                    type="button"
                    key={number}
                    onClick={() => setPage(number)}
                    className={cn('btn rounded-none font-semibold -ml-px', number === page && 'text-white')}
                    style={number === page
                      ? { background: BLUE, border: `1px solid ${BLUE}`, color: '#ffffff' }
                      : { background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                  >
                    {number}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                  className="btn rounded-l-none font-semibold -ml-px disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  Next
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={modal.open}
        onClose={closeModal}
        title={modal.editing ? 'Edit Unit' : 'Add Unit'}
        variant="perfex"
        size="lg"
        key={modal.version}
        headerClassName="bg-[#2563eb]"
        closeBtnClassName="bg-[#dc2626] hover:bg-[#b91c1c] rounded-md size-10"
        footer={(
          <>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn font-semibold text-white disabled:cursor-wait disabled:opacity-60"
              style={{ background: BLUE }}
            >
              {saving ? 'Saving…' : 'Save unit'}
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="btn font-semibold"
              style={{ background: 'transparent', border: '1px solid #cbd5e1', color: isDark ? '#cbd5e1' : '#475569' }}
            >
              Cancel
            </button>
          </>
        )}
      >
        <div className="space-y-5 py-1">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
            <div>
              <label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>
                Unit name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={modal.name}
                onChange={(e) => setModal((current) => ({ ...current, name: e.target.value, errors: { ...current.errors, name: '' } }))}
                autoFocus
                placeholder="e.g. Pieces"
                aria-invalid={!!modal.errors.name}
                className="h-[42px] w-full rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                style={{ background: INPUT_BG, border: `1px solid ${modal.errors.name ? '#dc2626' : INPUT_BORDER}`, color: TEXT }}
              />
              {modal.errors.name && <p className="mt-1 text-xs italic text-red-500">{modal.errors.name}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>Short name</label>
              <input
                type="text"
                value={modal.shortName}
                onChange={(e) => setModal((current) => ({ ...current, shortName: e.target.value }))}
                placeholder="e.g. Pc(s)"
                className="h-[42px] w-full rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold" style={{ color: TEXT }}>
                Decimal quantities <InfoIcon title="Choose YES when products can be sold in fractional quantities, such as 1.5 kg." />
              </label>
              <Select
                value={modal.allowDecimal}
                onChange={(e) => setModal((current) => ({ ...current, allowDecimal: e.target.value as 'YES' | 'NO' | '', errors: { ...current.errors, allowDecimal: '' } }))}
                className={cn('h-[42px] w-full text-sm', modal.errors.allowDecimal && 'border-red-500')}
                aria-invalid={!!modal.errors.allowDecimal}
              >
                <option value="">Please select...</option>
                <option value="YES">YES — decimals allowed</option>
                <option value="NO">NO — whole quantities only</option>
              </Select>
              {modal.errors.allowDecimal && <p className="mt-1 text-xs italic text-red-500">{modal.errors.allowDecimal}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>Status</label>
              <Select
                value={modal.status}
                onChange={(e) => setModal((current) => ({ ...current, status: e.target.value as 'Active' | 'Inactive' }))}
                className="h-[42px] w-full text-sm"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border p-4" style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}>
            <div className="flex items-start gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ background: isDark ? '#172554' : '#dbeafe', color: isDark ? '#93c5fd' : BLUE }}>
                <Package className="size-4" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: TEXT }}>Unit conversion</p>
                <p className="mt-0.5 text-xs" style={{ color: TEXT_MUTED }}>Optionally define this unit as a multiple of another base unit.</p>
              </div>
            </div>
            <label className="mt-4 flex cursor-pointer select-none items-start gap-3" style={{ color: TEXT }}>
              <button
                type="button"
                role="checkbox"
                aria-checked={modal.asMultiple}
                onClick={() => setModal((current) => ({ ...current, asMultiple: !current.asMultiple, multiplier: !current.asMultiple ? current.multiplier : '', baseUnitId: !current.asMultiple ? current.baseUnitId : '', errors: { ...current.errors, multiplier: '', baseUnitId: '' } }))}
                className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 transition"
                style={{ background: modal.asMultiple ? BLUE : 'transparent', borderColor: modal.asMultiple ? BLUE : (isDark ? '#8fa2b8' : '#9aa0a6'), color: '#fff' }}
              >
                {modal.asMultiple && <Check className="size-4" strokeWidth={3} />}
              </button>
              <span>
                <span className="block text-sm font-semibold">Add as a multiple of another unit</span>
                <span className="mt-0.5 block text-xs" style={{ color: TEXT_MUTED }}>For example, 1 dozen can equal 12 pieces.</span>
              </span>
            </label>
            {modal.asMultiple && (
              <div className="mt-4 pl-9">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold" style={{ color: TEXT }}>1</span>
                  <span className="max-w-[160px] truncate text-sm font-semibold" style={{ color: TEXT }}>
                    {modal.shortName.trim() || modal.name.trim() || (modal.editing ? modal.editing.shortName || modal.editing.name : 'Unit')}
                  </span>
                  <span className="text-lg" style={{ color: TEXT_MUTED }}>=</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={modal.multiplier}
                    onChange={(e) => setModal((current) => ({ ...current, multiplier: e.target.value, errors: { ...current.errors, multiplier: '' } }))}
                    placeholder="e.g. 12"
                    aria-invalid={!!modal.errors.multiplier}
                    className="h-[42px] w-[150px] rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    style={{ background: INPUT_BG, border: `1px solid ${modal.errors.multiplier ? '#dc2626' : INPUT_BORDER}`, color: TEXT }}
                  />
                  <Select
                    value={String(modal.baseUnitId)}
                    onChange={(e) => setModal((current) => ({ ...current, baseUnitId: e.target.value ? Number(e.target.value) : '', errors: { ...current.errors, baseUnitId: '' } }))}
                    className="h-[42px] min-w-[210px] flex-1 text-sm"
                    aria-invalid={!!modal.errors.baseUnitId}
                  >
                    <option value="">Select base unit</option>
                    {baseUnitOptions.map((baseUnit) => <option key={baseUnit.id} value={baseUnit.id}>{baseUnit.name}{baseUnit.shortName ? ` (${baseUnit.shortName})` : ''}</option>)}
                  </Select>
                </div>
                {(modal.errors.multiplier || modal.errors.baseUnitId) && (
                  <p className="mt-1 text-xs italic text-red-500">{modal.errors.multiplier || modal.errors.baseUnitId}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <div data-inv-units-print aria-hidden style={{ position: 'fixed', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
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
          <thead><tr><th>#</th><th>Name</th><th>Short Name</th><th>Allow Decimal</th><th>Conversion</th><th>Status</th></tr></thead>
          <tbody>{filtered.map((unit, index) => (<tr key={unit.id}><td>{index + 1}</td><td>{unit.name}</td><td>{unit.shortName || '—'}</td><td>{unit.allowDecimal || '—'}</td><td>{conversionLabel(unit)}</td><td>{unit.status}</td></tr>))}</tbody>
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
    open: boolean
    editing: Brand | null
    name: string
    description: string
    status: 'Active' | 'Inactive'
    errors: Record<string, string>
    version: number
  }>({ open: false, editing: null, name: '', description: '', status: 'Active', errors: {}, version: 0 })
  const [saving, setSaving] = useState(false)
  const [nextId, setNextId] = useState(() => Math.max(0, ...items.map((item: any) => item.id)) + 1)
  const [busy, setBusy] = useState<'' | 'print' | 'pdf' | 'excel'>('')
  const [done, setDone] = useState<'' | 'print' | 'pdf' | 'excel'>('')
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark'))
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const openAdd = () => setModal({ open: true, editing: null, name: '', description: '', status: 'Active', errors: {}, version: Date.now() })
  const openEdit = (brand: Brand) => setModal({ open: true, editing: brand, name: brand.name, description: brand.description, status: brand.status, errors: {}, version: Date.now() })
  const closeModal = () => setModal((current) => ({ ...current, open: false, editing: null }))

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((direction) => direction === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const save = async () => {
    const errors: Record<string, string> = {}
    if (!modal.name.trim()) errors.name = 'Brand Name is required'
    setModal((current) => ({ ...current, errors }))
    if (Object.keys(errors).length) return

    setSaving(true)
    await new Promise((resolve) => setTimeout(resolve, 200))
    if (modal.editing) {
      persist(items.map((item) => item.id === modal.editing!.id
        ? { ...item, name: modal.name.trim(), description: modal.description.trim(), status: modal.status } : item))
    } else {
      const id = nextId
      persist([...items, { id, name: modal.name.trim(), description: modal.description.trim(), status: modal.status }])
      setNextId(id + 1)
    }
    setSaving(false)
    closeModal()
  }

  const removeItem = (id: number) => {
    if (!window.confirm('Delete this brand?')) return
    persist(items.filter((item) => item.id !== id))
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    let list = items
    if (query) list = list.filter((item) => item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query))
    list = [...list].sort((a, b) => {
      let aValue: string | number = '', bValue: string | number = ''
      if (sortKey === 'id') { aValue = a.id; bValue = b.id }
      else if (sortKey === 'status') { aValue = a.status; bValue = b.status }
      else { aValue = String(a[sortKey] ?? '').toLowerCase(); bValue = String(b[sortKey] ?? '').toLowerCase() }
      if (aValue < bValue) return sortDir === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [items, q, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / showEntries))
  const paged = filtered.slice((page - 1) * showEntries, page * showEntries)
  const startIdx = filtered.length === 0 ? 0 : (page - 1) * showEntries + 1
  const endIdx = Math.min(page * showEntries, filtered.length)
  const activeCount = items.filter((item) => item.status === 'Active').length

  const flashDone = (which: 'print' | 'pdf' | 'excel') => {
    setDone(which)
    window.setTimeout(() => setDone(''), 1500)
  }
  const handlePrint = () => {
    setBusy('print')
    window.setTimeout(() => { window.print(); setBusy(''); flashDone('print') }, 150)
  }
  const handlePdf = () => {
    setBusy('pdf')
    window.setTimeout(() => { window.print(); setBusy(''); flashDone('pdf') }, 150)
  }
  const handleExcel = async () => {
    setBusy('excel')
    const rows = items.map((brand, index) => ({ '#': index + 1, Brands: brand.name, Description: brand.description, Status: brand.status }))
    const ok = await exportExcel('brands', rows)
    setBusy('')
    if (ok) flashDone('excel')
  }

  const CARD_BG = isDark ? '#1b1f24' : '#ffffff'
  const CARD_BORDER = isDark ? '#2d333a' : '#e2e8f0'
  const PANEL_BG = isDark ? '#20252c' : '#f8fafc'
  const PANEL_BORDER = isDark ? '#363c44' : '#e5e7eb'
  const TABLE_HEAD_BG = isDark ? '#2a313b' : '#f1f5f9'
  const TABLE_ROW_ALT = isDark ? '#1f242b' : '#fafafa'
  const TEXT = isDark ? '#e5e7eb' : '#0f172a'
  const TEXT_MUTED = isDark ? '#9aa3ad' : '#64748b'
  const INPUT_BG = isDark ? '#14171c' : '#ffffff'
  const INPUT_BORDER = isDark ? '#49515c' : '#cbd5e1'
  const PURPLE = '#4f00e6'
  const RED = '#dc2626'

  const SortChevron = ({ column }: { column: typeof sortKey }) => (
    <ChevronDown
      className={cn('size-4 transition-transform', sortKey !== column && 'opacity-40', sortKey === column && sortDir === 'asc' && 'rotate-180')}
      style={{ color: TEXT_MUTED }}
      aria-hidden
    />
  )

  return (
    <div id="inv-brands-wrap" className="w-full">
      <div
        className="overflow-hidden rounded-2xl shadow-sm"
        style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
      >
        {/* Page heading */}
        <div className="border-b px-5 py-5 md:px-8 md:py-6" style={{ borderColor: CARD_BORDER }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl"
                style={{ background: isDark ? '#33236b' : '#f0eaff', color: PURPLE }}
              >
                <Tags className="size-5" aria-hidden />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[25px] font-semibold leading-tight md:text-[28px]" style={{ color: TEXT }}>
                    Brands
                  </h2>
                  <span
                    className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                    style={{ background: PANEL_BG, borderColor: PANEL_BORDER, color: TEXT_MUTED }}
                  >
                    Product settings
                  </span>
                </div>
                <p className="mt-1 text-sm md:text-[15px]" style={{ color: TEXT_MUTED }}>
                  Keep product brands organised so your catalogue is easier to search and manage.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openAdd}
              className="btn font-semibold text-white shadow-sm transition hover:brightness-110"
              style={{ background: PURPLE }}
            >
              <CirclePlus className="size-4" aria-hidden />
              Add brand
            </button>
          </div>
        </div>

        <div className="p-5 md:p-8">
          <section
            className="rounded-xl border p-4 md:p-6"
            style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold" style={{ color: TEXT }}>Brand catalogue</h3>
                  <span className="rounded-full border px-2.5 py-1 text-xs font-medium" style={{ borderColor: PANEL_BORDER, color: TEXT_MUTED }}>
                    {items.length} {items.length === 1 ? 'brand' : 'brands'}
                  </span>
                  <span className="rounded-full border px-2.5 py-1 text-xs font-medium" style={{ borderColor: isDark ? '#276749' : '#bbf7d0', background: isDark ? '#123522' : '#f0fdf4', color: isDark ? '#86efac' : '#166534' }}>
                    {activeCount} active
                  </span>
                </div>
                <p className="mt-1 text-sm" style={{ color: TEXT_MUTED }}>
                  Update brand names, descriptions, and availability from one place.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleExcel()}
                  disabled={busy !== ''}
                  className="btn font-semibold disabled:cursor-wait disabled:opacity-60"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  {done === 'excel' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <FileSpreadsheet className="size-4" aria-hidden />}
                  Excel
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={busy !== ''}
                  className="btn font-semibold disabled:cursor-wait disabled:opacity-60"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  {done === 'print' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <Printer className="size-4" aria-hidden />}
                  Print
                </button>
                <button
                  type="button"
                  onClick={handlePdf}
                  disabled={busy !== ''}
                  className="btn font-semibold disabled:cursor-wait disabled:opacity-60"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  {done === 'pdf' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <FileText className="size-4" aria-hidden />}
                  PDF
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: PANEL_BORDER }}>
              <div className="flex items-center gap-2 text-sm" style={{ color: TEXT_MUTED }}>
                <span>Show</span>
                <Select value={String(showEntries)} onChange={(e) => { setShowEntries(Number(e.target.value)); setPage(1) }} className="w-20">
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </Select>
                <span>entries</span>
              </div>
              <label className="flex w-full items-center gap-2 text-sm sm:w-auto" style={{ color: TEXT_MUTED }}>
                <span className="shrink-0">Search</span>
                <span className="relative w-full sm:w-[240px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
                  <input
                    type="search"
                    value={q}
                    onChange={(e) => { setQ(e.target.value); setPage(1) }}
                    placeholder="Search brands"
                    aria-label="Search brands"
                    className="h-[38px] w-full rounded-lg pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }}
                  />
                </span>
              </label>
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border" style={{ borderColor: PANEL_BORDER }}>
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr style={{ background: TABLE_HEAD_BG }}>
                    <th className="w-20 px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('id')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        # <SortChevron column="id" />
                      </button>
                    </th>
                    <th className="w-[28%] px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        Brand <SortChevron column="name" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('description')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        Description <SortChevron column="description" />
                      </button>
                    </th>
                    <th className="w-28 px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('status')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        Status <SortChevron column="status" />
                      </button>
                    </th>
                    <th className="w-[220px] whitespace-nowrap px-4 py-3 text-right font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((brand, index) => {
                    const zebra = index % 2 === 0
                    return (
                      <tr
                        key={brand.id}
                        className="transition-colors"
                        style={{ background: zebra ? TABLE_ROW_ALT : CARD_BG, color: TEXT }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = isDark ? '#2b313b' : '#f1f5f9' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = zebra ? TABLE_ROW_ALT : CARD_BG }}
                      >
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          <span className="grid size-7 place-items-center rounded-full text-xs font-bold text-white" style={{ background: PURPLE }}>
                            {(page - 1) * showEntries + index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, color: TEXT }}>
                          <p className="font-semibold">{brand.name}</p>
                        </td>
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, color: brand.description ? TEXT : TEXT_MUTED }}>
                          {brand.description || 'No description added'}
                        </td>
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          <span
                            className="inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold"
                            style={brand.status === 'Active'
                              ? { borderColor: isDark ? '#276749' : '#bbf7d0', background: isDark ? '#123522' : '#f0fdf4', color: isDark ? '#86efac' : '#166534' }
                              : { borderColor: isDark ? '#7f1d1d' : '#fecaca', background: isDark ? '#3b0a0a' : '#fef2f2', color: isDark ? '#fca5a5' : '#b91c1c' }}
                          >
                            {brand.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 align-top text-right" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          <div className="flex flex-nowrap justify-end gap-2">
                            <CatalogueActionButton
                              label="Edit"
                              onClick={() => openEdit(brand)}
                              style={{ background: 'transparent', border: `1px solid ${PURPLE}`, color: PURPLE }}
                            >
                              <Pencil className="size-4" aria-hidden />
                            </CatalogueActionButton>
                            <CatalogueActionButton
                              label="Delete"
                              onClick={() => removeItem(brand.id)}
                              style={{ background: 'transparent', border: `1px solid ${RED}`, color: RED }}
                            >
                              <TrashIcon className="size-4" aria-hidden />
                            </CatalogueActionButton>
                            <CatalogueActionButton
                              label={brand.status === 'Active' ? 'Deactivate' : 'Activate'}
                              onClick={() => persist(items.map((item) => item.id === brand.id ? { ...item, status: item.status === 'Active' ? 'Inactive' : 'Active' } : item))}
                              style={{ background: 'transparent', border: `1px solid ${brand.status === 'Active' ? '#b45309' : '#059669'}`, color: brand.status === 'Active' ? '#b45309' : '#059669' }}
                            >
                              <PowerIcon className="size-4" on={brand.status !== 'Active'} aria-hidden />
                            </CatalogueActionButton>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center" style={{ color: TEXT_MUTED, background: CARD_BG }}>
                        <Tags className="mx-auto size-8 opacity-50" aria-hidden />
                        <p className="mt-3 font-semibold" style={{ color: TEXT }}>No brands found</p>
                        <p className="mt-1 text-sm">Try a different search or add a new brand.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm" style={{ color: TEXT_MUTED }}>
              <span>{filtered.length === 0 ? 'No entries' : `Showing ${startIdx} to ${endIdx} of ${filtered.length} entries`}</span>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="btn rounded-r-none font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
                  <button
                    type="button"
                    key={number}
                    onClick={() => setPage(number)}
                    className={cn('btn rounded-none font-semibold -ml-px', number === page && 'text-white')}
                    style={number === page
                      ? { background: PURPLE, border: `1px solid ${PURPLE}`, color: '#ffffff' }
                      : { background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                  >
                    {number}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                  className="btn rounded-l-none font-semibold -ml-px disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  Next
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={modal.open}
        onClose={closeModal}
        title={modal.editing ? 'Edit Brand' : 'Add Brand'}
        variant="perfex"
        size="md"
        key={modal.version}
        headerClassName="bg-[#4f00e6]"
        closeBtnClassName="bg-[#d9230f] hover:bg-[#c1200e] rounded-[4px] size-10"
        footer={(
          <>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn font-semibold text-white disabled:cursor-wait disabled:opacity-60"
              style={{ background: PURPLE }}
            >
              {saving ? 'Saving…' : 'Save brand'}
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="btn font-semibold"
              style={{ background: 'transparent', border: '1px solid #cbd5e1', color: isDark ? '#cbd5e1' : '#475569' }}
            >
              Cancel
            </button>
          </>
        )}
      >
        <div className="space-y-5 py-1">
          <div>
            <label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>
              Brand name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={modal.name}
              onChange={(e) => setModal((current) => ({ ...current, name: e.target.value }))}
              autoFocus
              placeholder="e.g. Golden"
              className="h-[42px] w-full rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              style={{ background: INPUT_BG, border: `1px solid ${modal.errors.name ? '#dc2626' : INPUT_BORDER}`, color: TEXT }}
            />
            {modal.errors.name && <p className="mt-1 text-xs italic text-red-500">{modal.errors.name}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>Description</label>
            <textarea
              value={modal.description}
              onChange={(e) => setModal((current) => ({ ...current, description: e.target.value }))}
              placeholder="Add a short description for this brand"
              rows={4}
              className="w-full resize-y rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }}
            />
          </div>
          <div className="max-w-xs">
            <label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>Status</label>
            <Select
              value={modal.status}
              onChange={(e) => setModal((current) => ({ ...current, status: e.target.value as 'Active' | 'Inactive' }))}
              className="h-[42px] w-full text-sm"
              style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </Select>
          </div>
        </div>
      </Modal>

      <div data-inv-brands-print aria-hidden style={{ position: 'fixed', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
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
            [data-inv-brands-print] h1 { font-size: 20px; margin: 0 0 4px; color: #000 !important; }
            [data-inv-brands-print] .sub { font-size: 12px; color: #333 !important; margin-bottom: 8px; }
          }
        `}</style>
        <h1>Brands</h1>
        <div className="sub">Printed {new Date().toLocaleString()} · FitPro Gym App</div>
        <table>
          <thead><tr><th>#</th><th>Brands</th><th>Description</th><th>Status</th></tr></thead>
          <tbody>{filtered.map((brand, index) => (<tr key={brand.id}><td>{index + 1}</td><td>{brand.name}</td><td>{brand.description || '—'}</td><td>{brand.status}</td></tr>))}</tbody>
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
  const [nextId, setNextId] = useState(() => Math.max(0, ...items.map((item: any) => item.id)) + 1)
  const [busy, setBusy] = useState<'' | 'print' | 'pdf' | 'excel'>('')
  const [done, setDone] = useState<'' | 'print' | 'pdf' | 'excel'>('')
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark'))
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const openAdd = () => setModal({ open: true, editing: null, name: '', description: '', duration: '', durationType: '', status: 'Active', errors: {}, version: Date.now() })
  const openEdit = (warranty: Warranty) => setModal({ open: true, editing: warranty, name: warranty.name, description: warranty.description, duration: warranty.duration != null ? String(warranty.duration) : '', durationType: warranty.durationType, status: warranty.status, errors: {}, version: Date.now() })
  const closeModal = () => setModal((current) => ({ ...current, open: false, editing: null }))

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((direction) => direction === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const durationLabel = (duration: number | null, durationType: DurationType) => {
    if (duration == null || !durationType) return 'No duration set'
    return `${duration} ${durationType}${duration === 1 ? '' : 's'}`
  }

  const save = async () => {
    const errors: Record<string, string> = {}
    if (!modal.name.trim()) errors.name = 'Warranty name is required'
    const duration = modal.duration.trim() === '' ? null : Number(modal.duration)
    if (modal.duration.trim() !== '' && (isNaN(duration!) || duration! <= 0)) errors.duration = 'Enter a valid duration'
    if (modal.duration.trim() !== '' && !modal.durationType) errors.durationType = 'Please select a duration type'
    setModal((current) => ({ ...current, errors }))
    if (Object.keys(errors).length) return

    setSaving(true)
    await new Promise((resolve) => setTimeout(resolve, 200))
    if (modal.editing) {
      persist(items.map((item) => item.id === modal.editing!.id
        ? { ...item, name: modal.name.trim(), description: modal.description.trim(), duration, durationType: modal.durationType, status: modal.status }
        : item))
    } else {
      const id = nextId
      persist([...items, { id, name: modal.name.trim(), description: modal.description.trim(), duration, durationType: modal.durationType, status: modal.status }])
      setNextId(id + 1)
    }
    setSaving(false)
    closeModal()
  }

  const removeItem = (id: number) => {
    if (!window.confirm('Delete this warranty?')) return
    persist(items.filter((warranty) => warranty.id !== id))
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    let list = items
    if (query) {
      list = list.filter((warranty) => [
        warranty.name,
        warranty.description || '',
        warranty.durationType || '',
        durationLabel(warranty.duration, warranty.durationType),
      ].join(' ').toLowerCase().includes(query))
    }
    list = [...list].sort((a, b) => {
      let aValue: string | number = ''
      let bValue: string | number = ''
      if (sortKey === 'id') { aValue = a.id; bValue = b.id }
      else if (sortKey === 'duration') {
        const toDays = (warranty: Warranty) => {
          if (warranty.duration == null || !warranty.durationType) return 0
          if (warranty.durationType === 'days') return warranty.duration
          if (warranty.durationType === 'months') return warranty.duration * 30
          return warranty.duration * 365
        }
        aValue = toDays(a)
        bValue = toDays(b)
      } else if (sortKey === 'status') { aValue = a.status; bValue = b.status }
      else { aValue = String((a as any)[sortKey] ?? '').toLowerCase(); bValue = String((b as any)[sortKey] ?? '').toLowerCase() }
      if (aValue < bValue) return sortDir === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [items, q, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / showEntries))
  const paged = filtered.slice((page - 1) * showEntries, page * showEntries)
  const startIdx = filtered.length === 0 ? 0 : (page - 1) * showEntries + 1
  const endIdx = Math.min(page * showEntries, filtered.length)
  const activeCount = items.filter((item) => item.status === 'Active').length
  const configuredCount = items.filter((item) => item.duration != null && !!item.durationType).length
  const noTermCount = items.length - configuredCount

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const flashDone = (which: 'print' | 'pdf' | 'excel') => {
    setDone(which)
    window.setTimeout(() => setDone(''), 1500)
  }
  const handlePrint = () => {
    setBusy('print')
    window.setTimeout(() => { window.print(); setBusy(''); flashDone('print') }, 150)
  }
  const handlePdf = () => {
    setBusy('pdf')
    window.setTimeout(() => { window.print(); setBusy(''); flashDone('pdf') }, 150)
  }
  const handleExcel = async () => {
    setBusy('excel')
    const rows = items.map((warranty, index) => ({
      '#': index + 1,
      Name: warranty.name,
      Description: warranty.description,
      Duration: durationLabel(warranty.duration, warranty.durationType),
      Status: warranty.status,
    }))
    const ok = await exportExcel('warranties', rows)
    setBusy('')
    if (ok) flashDone('excel')
  }

  const CARD_BG = isDark ? '#1b1f24' : '#ffffff'
  const CARD_BORDER = isDark ? '#2d333a' : '#e2e8f0'
  const PANEL_BG = isDark ? '#20252c' : '#f8fafc'
  const PANEL_BORDER = isDark ? '#363c44' : '#e5e7eb'
  const TABLE_HEAD_BG = isDark ? '#2a313b' : '#f1f5f9'
  const TABLE_ROW_ALT = isDark ? '#1f242b' : '#fafafa'
  const TEXT = isDark ? '#e5e7eb' : '#0f172a'
  const TEXT_MUTED = isDark ? '#9aa3ad' : '#64748b'
  const INPUT_BG = isDark ? '#14171c' : '#ffffff'
  const INPUT_BORDER = isDark ? '#49515c' : '#cbd5e1'
  const ORANGE = '#c2410c'
  const RED = '#dc2626'

  const SortChevron = ({ column }: { column: typeof sortKey }) => (
    <ChevronDown
      className={cn('size-4 transition-transform', sortKey !== column && 'opacity-40', sortKey === column && sortDir === 'asc' && 'rotate-180')}
      style={{ color: TEXT_MUTED }}
      aria-hidden
    />
  )

  return (
    <div id="inv-warranties-wrap" className="w-full">
      <div
        className="overflow-hidden rounded-2xl shadow-sm"
        style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
      >
        <div className="border-b px-5 py-5 md:px-8 md:py-6" style={{ borderColor: CARD_BORDER }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl"
                style={{ background: isDark ? '#431407' : '#ffedd5', color: isDark ? '#fdba74' : ORANGE }}
              >
                <ShieldCheck className="size-5" aria-hidden />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[25px] font-semibold leading-tight md:text-[28px]" style={{ color: TEXT }}>
                    Warranties
                  </h2>
                  <span
                    className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                    style={{ background: PANEL_BG, borderColor: PANEL_BORDER, color: TEXT_MUTED }}
                  >
                    Product settings
                  </span>
                </div>
                <p className="mt-1 text-sm md:text-[15px]" style={{ color: TEXT_MUTED }}>
                  Keep product warranty terms clear, consistent, and easy to maintain.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openAdd}
              className="btn font-semibold text-white shadow-sm transition hover:brightness-110"
              style={{ background: ORANGE }}
            >
              <CirclePlus className="size-4" aria-hidden />
              Add warranty
            </button>
          </div>
        </div>

        <div className="p-5 md:p-8">
          <section
            className="rounded-xl border p-4 md:p-6"
            style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold" style={{ color: TEXT }}>Warranty catalogue</h3>
                  <span className="rounded-full border px-2.5 py-1 text-xs font-medium" style={{ borderColor: PANEL_BORDER, color: TEXT_MUTED }}>
                    {items.length} {items.length === 1 ? 'warranty' : 'warranties'}
                  </span>
                  <span className="rounded-full border px-2.5 py-1 text-xs font-medium" style={{ borderColor: isDark ? '#276749' : '#bbf7d0', background: isDark ? '#123522' : '#f0fdf4', color: isDark ? '#86efac' : '#166534' }}>
                    {activeCount} active
                  </span>
                </div>
                <p className="mt-1 text-sm" style={{ color: TEXT_MUTED }}>
                  {configuredCount} {configuredCount === 1 ? 'warranty has' : 'warranties have'} a defined coverage term · {noTermCount} without a term
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleExcel()}
                  disabled={busy !== ''}
                  className="btn font-semibold disabled:cursor-wait disabled:opacity-60"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  {done === 'excel' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <FileSpreadsheet className="size-4" aria-hidden />}
                  Excel
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={busy !== ''}
                  className="btn font-semibold disabled:cursor-wait disabled:opacity-60"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  {done === 'print' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <Printer className="size-4" aria-hidden />}
                  Print
                </button>
                <button
                  type="button"
                  onClick={handlePdf}
                  disabled={busy !== ''}
                  className="btn font-semibold disabled:cursor-wait disabled:opacity-60"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  {done === 'pdf' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <FileText className="size-4" aria-hidden />}
                  PDF
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: PANEL_BORDER }}>
              <div className="flex items-center gap-2 text-sm" style={{ color: TEXT_MUTED }}>
                <span>Show</span>
                <Select value={String(showEntries)} onChange={(e) => { setShowEntries(Number(e.target.value)); setPage(1) }} className="w-20">
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </Select>
                <span>entries</span>
              </div>
              <label className="flex w-full items-center gap-2 text-sm sm:w-auto" style={{ color: TEXT_MUTED }}>
                <span className="shrink-0">Search</span>
                <span className="relative w-full sm:w-[260px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
                  <input
                    type="search"
                    value={q}
                    onChange={(e) => { setQ(e.target.value); setPage(1) }}
                    placeholder="Search warranties"
                    aria-label="Search warranties"
                    className="h-[38px] w-full rounded-lg pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                    style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }}
                  />
                </span>
              </label>
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border" style={{ borderColor: PANEL_BORDER }}>
              <table className="w-full min-w-[1080px] border-collapse text-sm">
                <thead>
                  <tr style={{ background: TABLE_HEAD_BG }}>
                    <th className="w-20 px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('id')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        # <SortChevron column="id" />
                      </button>
                    </th>
                    <th className="w-[25%] px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        Warranty <SortChevron column="name" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('description')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        Description <SortChevron column="description" />
                      </button>
                    </th>
                    <th className="w-[22%] px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('duration')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        Coverage <SortChevron column="duration" />
                      </button>
                    </th>
                    <th className="w-28 px-4 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort('status')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>
                        Status <SortChevron column="status" />
                      </button>
                    </th>
                    <th className="w-[220px] whitespace-nowrap px-4 py-3 text-right font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}` }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((warranty, index) => {
                    const zebra = index % 2 === 0
                    const hasDuration = warranty.duration != null && !!warranty.durationType
                    return (
                      <tr
                        key={warranty.id}
                        className="transition-colors"
                        style={{ background: zebra ? TABLE_ROW_ALT : CARD_BG, color: TEXT }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = isDark ? '#2b313b' : '#f1f5f9' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = zebra ? TABLE_ROW_ALT : CARD_BG }}
                      >
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          <span className="grid size-7 place-items-center rounded-full text-xs font-bold text-white" style={{ background: ORANGE }}>
                            {(page - 1) * showEntries + index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, color: TEXT }}>
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg" style={{ background: isDark ? '#431407' : '#ffedd5', color: isDark ? '#fdba74' : ORANGE }}>
                              <ShieldCheck className="size-3.5" aria-hidden />
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold">{warranty.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, color: warranty.description ? TEXT : TEXT_MUTED }}>
                          {warranty.description || 'No description added'}
                        </td>
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          {hasDuration ? (
                            <>
                              <span className="inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: isDark ? '#7c2d12' : '#fed7aa', background: isDark ? '#431407' : '#fff7ed', color: isDark ? '#fdba74' : '#c2410c' }}>
                                {durationLabel(warranty.duration, warranty.durationType)}
                              </span>
                              <p className="mt-1 text-xs" style={{ color: TEXT_MUTED }}>Coverage term configured</p>
                            </>
                          ) : (
                            <span className="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium" style={{ borderColor: PANEL_BORDER, color: TEXT_MUTED }}>No term set</span>
                          )}
                        </td>
                        <td className="px-4 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          <span
                            className="inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold"
                            style={warranty.status === 'Active'
                              ? { borderColor: isDark ? '#276749' : '#bbf7d0', background: isDark ? '#123522' : '#f0fdf4', color: isDark ? '#86efac' : '#166534' }
                              : { borderColor: isDark ? '#7f1d1d' : '#fecaca', background: isDark ? '#3b0a0a' : '#fef2f2', color: isDark ? '#fca5a5' : '#b91c1c' }}
                          >
                            {warranty.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 align-top text-right" style={{ borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          <div className="flex flex-nowrap justify-end gap-2">
                            <CatalogueActionButton
                              label="Edit"
                              onClick={() => openEdit(warranty)}
                              style={{ background: 'transparent', border: `1px solid ${ORANGE}`, color: ORANGE }}
                            >
                              <Pencil className="size-4" aria-hidden />
                            </CatalogueActionButton>
                            <CatalogueActionButton
                              label="Delete"
                              onClick={() => removeItem(warranty.id)}
                              style={{ background: 'transparent', border: `1px solid ${RED}`, color: RED }}
                            >
                              <TrashIcon className="size-4" aria-hidden />
                            </CatalogueActionButton>
                            <CatalogueActionButton
                              label={warranty.status === 'Active' ? 'Deactivate' : 'Activate'}
                              onClick={() => persist(items.map((item) => item.id === warranty.id ? { ...item, status: item.status === 'Active' ? 'Inactive' : 'Active' } : item))}
                              style={{ background: 'transparent', border: `1px solid ${warranty.status === 'Active' ? '#b45309' : '#059669'}`, color: warranty.status === 'Active' ? '#b45309' : '#059669' }}
                            >
                              <PowerIcon className="size-4" on={warranty.status !== 'Active'} aria-hidden />
                            </CatalogueActionButton>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center" style={{ color: TEXT_MUTED, background: CARD_BG }}>
                        <ShieldCheck className="mx-auto size-8 opacity-50" aria-hidden />
                        <p className="mt-3 font-semibold" style={{ color: TEXT }}>No warranties found</p>
                        <p className="mt-1 text-sm">Try a different search or add a new warranty.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm" style={{ color: TEXT_MUTED }}>
              <span>{filtered.length === 0 ? 'No entries' : `Showing ${startIdx} to ${endIdx} of ${filtered.length} entries`}</span>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="btn rounded-r-none font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
                  <button
                    type="button"
                    key={number}
                    onClick={() => setPage(number)}
                    className={cn('btn rounded-none font-semibold -ml-px', number === page && 'text-white')}
                    style={number === page
                      ? { background: ORANGE, border: `1px solid ${ORANGE}`, color: '#ffffff' }
                      : { background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                  >
                    {number}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                  className="btn rounded-l-none font-semibold -ml-px disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}
                >
                  Next
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={modal.open}
        onClose={closeModal}
        title={modal.editing ? 'Edit Warranty' : 'Add Warranty'}
        variant="perfex"
        size="lg"
        key={modal.version}
        headerClassName="bg-[#c2410c]"
        closeBtnClassName="bg-[#dc2626] hover:bg-[#b91c1c] rounded-md size-10"
        footer={(
          <>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn font-semibold text-white disabled:cursor-wait disabled:opacity-60"
              style={{ background: ORANGE }}
            >
              {saving ? 'Saving…' : 'Save warranty'}
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="btn font-semibold"
              style={{ background: 'transparent', border: '1px solid #cbd5e1', color: isDark ? '#cbd5e1' : '#475569' }}
            >
              Cancel
            </button>
          </>
        )}
      >
        <div className="space-y-5 py-1">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
            <div>
              <label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>
                Warranty name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={modal.name}
                onChange={(e) => setModal((current) => ({ ...current, name: e.target.value, errors: { ...current.errors, name: '' } }))}
                autoFocus
                placeholder="e.g. Standard purchase warranty"
                aria-invalid={!!modal.errors.name}
                className="h-[42px] w-full rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                style={{ background: INPUT_BG, border: `1px solid ${modal.errors.name ? '#dc2626' : INPUT_BORDER}`, color: TEXT }}
              />
              {modal.errors.name && <p className="mt-1 text-xs italic text-red-500">{modal.errors.name}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>Status</label>
              <Select
                value={modal.status}
                onChange={(e) => setModal((current) => ({ ...current, status: e.target.value as 'Active' | 'Inactive' }))}
                className="h-[42px] w-full text-sm"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>Description</label>
            <textarea
              value={modal.description}
              onChange={(e) => setModal((current) => ({ ...current, description: e.target.value }))}
              placeholder="Add a short description for this warranty"
              rows={4}
              className="w-full resize-y rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }}
            />
          </div>

          <div className="rounded-xl border p-4" style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}>
            <div className="flex items-start gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ background: isDark ? '#431407' : '#ffedd5', color: isDark ? '#fdba74' : ORANGE }}>
                <ShieldCheck className="size-4" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: TEXT }}>Coverage term</p>
                <p className="mt-0.5 text-xs" style={{ color: TEXT_MUTED }}>Optionally set how long this warranty remains valid.</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>Duration</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={modal.duration}
                  onChange={(e) => setModal((current) => ({ ...current, duration: e.target.value, errors: { ...current.errors, duration: '' } }))}
                  placeholder="e.g. 12"
                  aria-invalid={!!modal.errors.duration}
                  className="h-[42px] w-full rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  style={{ background: INPUT_BG, border: `1px solid ${modal.errors.duration ? '#dc2626' : INPUT_BORDER}`, color: TEXT }}
                />
                {modal.errors.duration && <p className="mt-1 text-xs italic text-red-500">{modal.errors.duration}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>Duration type</label>
                <Select
                  value={modal.durationType}
                  onChange={(e) => setModal((current) => ({ ...current, durationType: e.target.value as DurationType, errors: { ...current.errors, durationType: '' } }))}
                  className={cn('h-[42px] w-full text-sm', modal.errors.durationType && 'border-red-500')}
                  aria-invalid={!!modal.errors.durationType}
                >
                  <option value="">Please select...</option>
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </Select>
                {modal.errors.durationType && <p className="mt-1 text-xs italic text-red-500">{modal.errors.durationType}</p>}
              </div>
            </div>
            <p className="mt-3 text-xs" style={{ color: TEXT_MUTED }}>Leave both fields blank if this warranty does not use a fixed coverage term.</p>
          </div>
        </div>
      </Modal>

      <div data-inv-warranties-print aria-hidden style={{ position: 'fixed', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
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
          <tbody>{filtered.map((warranty, index) => (<tr key={warranty.id}><td>{index + 1}</td><td>{warranty.name}</td><td>{warranty.description || '—'}</td><td>{durationLabel(warranty.duration, warranty.durationType)}</td><td>{warranty.status}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  )
}
export function InvWarehouses() { return <InventoryPlaceholder title="Warehouses" description="Manage warehouses, shops and storage locations." /> }
export function InvTaxes() { return <InventoryPlaceholder title="Taxes" description="Configure sales and purchase tax rates for products." /> }

type TransferStatus = 'Pending' | 'In-Transit' | 'Completed' | 'Cancelled'

type StockTransferRow = {
  id: number
  sourceId?: string
  companyId?: string
  fromBranchId?: string
  toBranchId?: string
  date: string
  referenceNo: string
  from: string
  to: string
  status: TransferStatus
  shippingCharges: number
  totalAmount: number
  notes: string
  lines?: StockTransferLine[]
}

type TransferLine = { itemId: string; name: string; quantity: string; unitPrice: string }

type TransferForm = {
  date: string
  referenceNo: string
  from: string
  to: string
  status: TransferStatus | ''
  shippingCharges: string
  notes: string
  lines: TransferLine[]
  errors: Record<string, string>
}

type TransferColumnKey = 'date' | 'referenceNo' | 'from' | 'to' | 'status' | 'shippingCharges' | 'totalAmount' | 'notes'
type TransferSortKey = TransferColumnKey

const SEED_STOCK_TRANSFERS: StockTransferRow[] = [
  {
    id: 1,
    sourceId: 'st_1',
    companyId: 'co_fitpro',
    fromBranchId: 'br_airport',
    toBranchId: 'br_osu',
    date: '2026-08-27',
    referenceNo: 'ST2026/0001',
    from: 'Airport City Flagship',
    to: 'Osu Oxford',
    status: 'Pending',
    shippingCharges: 20,
    totalAmount: 920,
    notes: '',
  },
]

const STOCK_TRANSFER_COLUMNS: { key: TransferColumnKey; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'referenceNo', label: 'Reference No' },
  { key: 'from', label: 'Location (From)' },
  { key: 'to', label: 'Location (To)' },
  { key: 'status', label: 'Status' },
  { key: 'shippingCharges', label: 'Shipping Charges' },
  { key: 'totalAmount', label: 'Total Amount' },
  { key: 'notes', label: 'Additional Notes' },
]

const transferLocations = (items: StockTransferRow[]) => Array.from(new Set([
  'Igracesoft GH',
  'Mankessim Branch',
  ...items.flatMap((item) => [item.from, item.to]),
].filter(Boolean))).sort()

const transferDateValue = (value: string) => value.split('T')[0]

const transferDateParts = (value: string) => {
  const iso = transferDateValue(value)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return { date: value, time: '' }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(date.getTime())) return { date: value, time: '' }
  const locale = typeof navigator !== 'undefined' ? (navigator.languages?.[0] || navigator.language || 'en-GB') : 'en-GB'
  const dateText = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
  return { date: dateText, time: '' }
}

const transferDateTime = (value: string) => {
  const parts = transferDateParts(value)
  return [parts.date, parts.time].filter(Boolean).join(' ')
}

const transferMoney = (value: number) => `₵ ${value.toFixed(2)}`

type TransferPeriodPreset = 'today' | 'last7' | 'thisMonth' | 'custom'

const transferInputDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const transferDisplayDate = (value: string) => transferDateParts(value).date

const transferPeriodRange = (preset: TransferPeriodPreset) => {
  const today = new Date()
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const start = new Date(end)
  if (preset === 'last7') start.setDate(start.getDate() - 6)
  if (preset === 'thisMonth') start.setDate(1)
  return { start: transferInputDate(start), end: transferInputDate(end) }
}

const emptyTransferForm = (nextId: number): TransferForm => ({
  date: transferInputDate(new Date()),
  referenceNo: `ST2026/${String(nextId).padStart(4, '0')}`,
  from: '',
  to: '',
  status: '',
  shippingCharges: '0',
  notes: '',
  lines: [],
  errors: {},
})

const transferToRow = (item: StockTransfer): StockTransferRow => ({
  id: Number(item.id.match(/\d+/)?.[0] || 0) || Math.abs(Array.from(item.id).reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) | 0, 7)),
  sourceId: item.id,
  companyId: item.companyId,
  fromBranchId: item.fromBranchId,
  toBranchId: item.toBranchId,
  date: item.date,
  referenceNo: item.referenceNo,
  from: item.from,
  to: item.to,
  status: item.status,
  shippingCharges: item.shippingCharges,
  totalAmount: item.totalAmount,
  notes: item.notes,
  lines: item.lines,
})

export function StockTransfer() {
  const { branches, activeBranchId, activeCompanyId, stockTransfers, upsertStockTransfer, deleteStockTransfer, inventory } = useApp()
  const contextItems = useMemo(() => stockTransfers.map(transferToRow), [stockTransfers])
  const [items, setItems] = useState<StockTransferRow[]>(() => contextItems.length ? contextItems : SEED_STOCK_TRANSFERS)
  const [nextId, setNextId] = useState(() => Math.max(1, ...contextItems.map((item) => item.id)) + 1)
  const [q, setQ] = useState('')
  const [periodPreset, setPeriodPreset] = useState<TransferPeriodPreset>('thisMonth')
  const [periodStart, setPeriodStart] = useState(() => transferPeriodRange('thisMonth').start)
  const [periodEnd, setPeriodEnd] = useState(() => transferPeriodRange('thisMonth').end)
  const [showEntries, setShowEntries] = useState(25)
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<TransferSortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Record<TransferColumnKey, boolean>>({
    date: true, referenceNo: true, from: true, to: true, status: true,
    shippingCharges: true, totalAmount: true, notes: true,
  })
  const [form, setForm] = useState<TransferForm>(() => emptyTransferForm(2))
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<StockTransferRow | null>(null)
  const [viewing, setViewing] = useState<StockTransferRow | null>(null)
  const [statusTarget, setStatusTarget] = useState<StockTransferRow | null>(null)
  const [statusDraft, setStatusDraft] = useState<TransferStatus | ''>('')
  const [statusError, setStatusError] = useState('')
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')
  const [done, setDone] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')
  const [printTarget, setPrintTarget] = useState<StockTransferRow | null>(null)
  const [transferProductQuery, setTransferProductQuery] = useState('')
  const [transferProductOpen, setTransferProductOpen] = useState(false)

  useEffect(() => {
    setItems(contextItems)
    setPage(1)
  }, [contextItems])

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!columnsOpen) return
    const close = () => setColumnsOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [columnsOpen])

  const locations = useMemo(() => branches.filter((branch) => branch.status !== 'inactive' && (!activeCompanyId || branch.companyId === activeCompanyId)).map((branch) => branch.name).sort(), [activeCompanyId, branches])

  const transferProductMatches = useMemo(() => {
    const tokens = transferProductQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!tokens.length) return []
    return inventory
      .filter((item) => tokens.every((token) => `${item.name} ${item.sku}`.toLowerCase().includes(token)))
      .slice(0, 7)
  }, [inventory, transferProductQuery])

  const transferLinesSubtotal = useMemo(
    () => form.lines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.unitPrice) || 0), 0),
    [form.lines],
  )
  const transferShippingNumber = Math.max(0, Number(form.shippingCharges) || 0)
  const transferTotal = transferLinesSubtotal + transferShippingNumber

  const addTransferLine = (item: InventoryItem) => {
    setForm((current) => {
      if (current.lines.some((line) => line.itemId === item.id)) return current
      return {
        ...current,
        lines: [...current.lines, { itemId: item.id, name: item.name, quantity: '1', unitPrice: String(item.sellPrice) }],
        errors: { ...current.errors, lines: '' },
      }
    })
    setTransferProductQuery('')
    setTransferProductOpen(false)
  }
  const updateTransferLine = (itemId: string, patch: Partial<TransferLine>) => {
    setForm((current) => ({ ...current, lines: current.lines.map((line) => (line.itemId === itemId ? { ...line, ...patch } : line)) }))
  }
  const removeTransferLine = (itemId: string) => {
    setForm((current) => ({ ...current, lines: current.lines.filter((line) => line.itemId !== itemId) }))
  }

  const toggleSort = (key: TransferSortKey) => {
    if (sortKey === key) setSortDir((direction) => direction === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    let list = items
    if (query) {
      list = list.filter((item) => [
        item.referenceNo, item.from, item.to, item.status, item.notes,
      ].some((value) => value.toLowerCase().includes(query)))
    }
    return [...list].sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      if (sortKey === 'date') { av = a.date; bv = b.date }
      else if (sortKey === 'referenceNo') { av = a.referenceNo; bv = b.referenceNo }
      else if (sortKey === 'from') { av = a.from; bv = b.from }
      else if (sortKey === 'to') { av = a.to; bv = b.to }
      else if (sortKey === 'status') { av = a.status; bv = b.status }
      else if (sortKey === 'shippingCharges') { av = a.shippingCharges; bv = b.shippingCharges }
      else if (sortKey === 'totalAmount') { av = a.totalAmount; bv = b.totalAmount }
      else { av = a.notes; bv = b.notes }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [items, q, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / showEntries))
  const paged = filtered.slice((page - 1) * showEntries, page * showEntries)
  const startIdx = filtered.length === 0 ? 0 : (page - 1) * showEntries + 1
  const endIdx = Math.min(page * showEntries, filtered.length)
  const visibleCount = Object.values(visibleColumns).filter(Boolean).length + 1

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const CARD_BG = isDark ? '#1b1f24' : '#ffffff'
  const CARD_BORDER = isDark ? '#2d333a' : '#e0e7ef'
  const PANEL_BG = isDark ? '#20252c' : '#f8fafc'
  const PANEL_BORDER = isDark ? '#363c44' : '#e5e7eb'
  const TABLE_HEAD_BG = isDark ? '#2a313b' : '#fbfbfb'
  const TABLE_ROW_ALT = isDark ? '#1f242b' : '#fafafa'
  const TEXT = isDark ? '#e5e7eb' : '#0f172a'
  const TEXT_MUTED = isDark ? '#9aa3ad' : '#64748b'
  const INPUT_BG = isDark ? '#14171c' : '#ffffff'
  const INPUT_BORDER = isDark ? '#49515c' : '#cbd5e1'
  const BLUE = '#2563eb'
  const RED = '#ff3b4f'
  const CYAN = '#06c9c9'
  const PURPLE = '#4f00e6'
  const periodInvalid = !periodStart || !periodEnd || periodStart > periodEnd
  const periodItems = useMemo(() => {
    if (periodInvalid) return []
    const start = new Date(`${periodStart}T00:00:00`).getTime()
    const end = new Date(`${periodEnd}T23:59:59.999`).getTime()
    return items.filter((item) => {
      const timestamp = new Date(item.date).getTime()
      return Number.isFinite(timestamp) && timestamp >= start && timestamp <= end
    })
  }, [items, periodEnd, periodInvalid, periodStart])
  const periodLabel = periodInvalid ? 'Choose a valid date range' : `${transferDisplayDate(periodStart)} – ${transferDisplayDate(periodEnd)}`
  const pendingCount = periodItems.filter((item) => item.status === 'Pending').length
  const completedCount = periodItems.filter((item) => item.status === 'Completed').length
  const totalTransferAmount = periodItems.reduce((sum, item) => sum + item.totalAmount, 0)
  const transferStats = [
    { label: 'Total transfers', value: String(periodItems.length), hint: periodLabel, color: '#2563eb', icon: <Package className="size-4" aria-hidden /> },
    { label: 'Pending', value: String(pendingCount), hint: periodLabel, color: '#e11d48', icon: <AlertCircle className="size-4" aria-hidden /> },
    { label: 'Completed', value: String(completedCount), hint: periodLabel, color: '#059669', icon: <CheckCircle2 className="size-4" aria-hidden /> },
    { label: 'Transfer value', value: transferMoney(totalTransferAmount), hint: periodLabel, color: '#7c3aed', icon: <FileText className="size-4" aria-hidden /> },
  ]

  const flashDone = (which: 'csv' | 'excel' | 'print' | 'pdf') => {
    setDone(which)
    window.setTimeout(() => setDone(''), 1500)
  }
  const handlePrint = (row?: StockTransferRow) => {
    setBusy(row ? '' : 'print')
    setPrintTarget(row || null)
    window.setTimeout(() => {
      window.print()
      setPrintTarget(null)
      setBusy('')
      flashDone(row ? 'print' : 'print')
    }, 150)
  }
  const handlePdf = () => {
    setBusy('pdf')
    setPrintTarget(null)
    window.setTimeout(() => { window.print(); setBusy(''); flashDone('pdf') }, 150)
  }
  const handleCsv = () => {
    setBusy('csv')
    const headers = ['#', ...STOCK_TRANSFER_COLUMNS.map((column) => column.label)]
    const rows = filtered.map((item, index) => [
      String(index + 1), transferDateTime(item.date), item.referenceNo, item.from, item.to,
      item.status, String(item.shippingCharges), String(item.totalAmount), item.notes || '',
    ])
    const csv = [headers, ...rows].map((row) => row.map((cell) => {
      const value = String(cell ?? '').replace(/"/g, '""')
      return /[",\n]/.test(value) ? `"${value}"` : value
    }).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'stock-transfers.csv'; document.body.appendChild(anchor); anchor.click(); anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setBusy(''); flashDone('csv')
  }
  const handleExcel = async () => {
    setBusy('excel')
    const rows = filtered.map((item, index) => ({
      '#': index + 1, Date: transferDateTime(item.date), 'Reference No': item.referenceNo,
      'Location (From)': item.from, 'Location (To)': item.to, Status: item.status,
      'Shipping Charges': item.shippingCharges, 'Total Amount': item.totalAmount, 'Additional Notes': item.notes || '',
    }))
    const ok = await exportExcel('stock-transfers', rows)
    setBusy('')
    if (ok) flashDone('excel')
  }

  const openAdd = () => {
    setEditing(null)
    setForm(emptyTransferForm(nextId))
    setFormOpen(true)
  }
  const openEdit = (item: StockTransferRow) => {
    if (item.status === 'Completed') return
    setEditing(item)
    setForm({
      date: transferDateValue(item.date),
      referenceNo: item.referenceNo,
      from: item.from,
      to: item.to,
      status: item.status,
      shippingCharges: String(item.shippingCharges),
      notes: item.notes,
      lines: (item.lines || []).map((line) => ({
        itemId: line.itemId,
        name: line.name,
        quantity: String(line.quantity),
        unitPrice: String(line.unitPrice),
      })),
      errors: {},
    })
    setFormOpen(true)
  }
  const closeForm = () => { setFormOpen(false); setEditing(null); setForm((current) => ({ ...current, errors: {} })) }
  const setFormValue = <K extends keyof TransferForm>(key: K, value: TransferForm[K]) => setForm((current) => ({ ...current, [key]: value, errors: { ...current.errors, [key]: '' } }))

  const saveTransfer = async () => {
    if (editing?.status === 'Completed') return
    const errors: Record<string, string> = {}
    if (!form.date) errors.date = 'Date is required.'
    if (!form.from) errors.from = 'Select the source location.'
    if (!form.to) errors.to = 'Select the destination location.'
    if (form.from && form.to && form.from === form.to) errors.to = 'Source and destination must be different.'
    if (!form.status) errors.status = 'Select a status.'
    if (!form.lines.length) errors.lines = 'Add at least one product to transfer.'
    const shipping = Number(form.shippingCharges) || 0
    if (shipping < 0) errors.shippingCharges = 'Enter a valid amount.'
    for (const [index, line] of form.lines.entries()) {
      const qty = Number(line.quantity)
      const price = Number(line.unitPrice)
      if (!Number.isFinite(qty) || qty <= 0) errors[`lineQty${index}`] = 'Enter a quantity.'
      if (!Number.isFinite(price) || price < 0) errors[`linePrice${index}`] = 'Enter a unit price.'
    }
    if (Object.keys(errors).length) { setForm((current) => ({ ...current, errors })); return }

    setSaving(true)
    await new Promise((resolve) => window.setTimeout(resolve, 180))
    const fromBranch = branches.find((branch) => branch.name === form.from)
    const toBranch = branches.find((branch) => branch.name === form.to)
    const lines: StockTransferLine[] = form.lines.map((line) => ({
      itemId: line.itemId,
      name: line.name,
      quantity: Math.max(0, Number(line.quantity)),
      unitPrice: Math.max(0, Number(line.unitPrice)),
    }))
    const total = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0) + shipping
    const next: StockTransfer = {
      id: editing?.sourceId || `st_${nextId}`,
      companyId: activeCompanyId,
      fromBranchId: fromBranch?.id,
      toBranchId: toBranch?.id,
      date: form.date,
      referenceNo: form.referenceNo.trim(),
      from: form.from,
      to: form.to,
      status: form.status as TransferStatus,
      shippingCharges: Math.round(shipping * 100) / 100,
      totalAmount: Math.round(total * 100) / 100,
      notes: form.notes.trim(),
      lines,
      createdAt: editing?.date || new Date().toISOString(),
    }
    upsertStockTransfer(next)
    if (!editing) setNextId((id) => id + 1)
    setSaving(false)
    closeForm()
  }
  const removeTransfer = (item: StockTransferRow) => {
    if (item.status === 'Completed') return
    if (!window.confirm(`Delete stock transfer ${item.referenceNo}?`)) return
    if (item.sourceId) deleteStockTransfer(item.sourceId)
    else setItems((current) => current.filter((row) => row.id !== item.id))
  }

  const openStatusUpdate = (item: StockTransferRow) => {
    if (item.status === 'Completed') return
    setStatusTarget(item)
    setStatusDraft(item.status)
    setStatusError('')
  }

  const saveStatusUpdate = () => {
    if (!statusTarget) return
    if (statusTarget.status === 'Completed') return
    if (!statusDraft) { setStatusError('Select a status.'); return }
    const next: StockTransfer = {
      id: statusTarget.sourceId || `st_${statusTarget.id}`,
      companyId: statusTarget.companyId,
      fromBranchId: statusTarget.fromBranchId,
      toBranchId: statusTarget.toBranchId,
      date: statusTarget.date,
      referenceNo: statusTarget.referenceNo,
      from: statusTarget.from,
      to: statusTarget.to,
      status: statusDraft,
      shippingCharges: statusTarget.shippingCharges,
      totalAmount: statusTarget.totalAmount,
      notes: statusTarget.notes,
      lines: statusTarget.lines,
      createdAt: statusTarget.date,
    }
    upsertStockTransfer(next)
    setStatusTarget(null)
  }

  const statusStyle = (status: TransferStatus) => status === 'Pending'
    ? { background: '#ff3b64', borderColor: '#ff3b64', color: '#ffffff' }
    : status === 'In-Transit'
      ? { background: isDark ? '#172554' : '#eff6ff', borderColor: isDark ? '#1d4ed8' : '#bfdbfe', color: isDark ? '#bfdbfe' : '#1d4ed8' }
      : status === 'Completed'
        ? { background: isDark ? '#123522' : '#f0fdf4', borderColor: isDark ? '#276749' : '#bbf7d0', color: isDark ? '#86efac' : '#166534' }
        : { background: isDark ? '#3b0a0a' : '#fef2f2', borderColor: isDark ? '#7f1d1d' : '#fecaca', color: isDark ? '#fca5a5' : '#b91c1c' }

  const labelButton = (label: string, icon: React.ReactNode, onClick: () => void, color: string) => (
    <CatalogueActionButton label={label} onClick={onClick} style={{ background: 'transparent', border: `1px solid ${color}`, color }}>
      {icon}
    </CatalogueActionButton>
  )

  const changePeriod = (preset: TransferPeriodPreset) => {
    setPeriodPreset(preset)
    if (preset !== 'custom') {
      const range = transferPeriodRange(preset)
      setPeriodStart(range.start)
      setPeriodEnd(range.end)
    }
  }
  const changePeriodStart = (value: string) => { setPeriodPreset('custom'); setPeriodStart(value) }
  const changePeriodEnd = (value: string) => { setPeriodPreset('custom'); setPeriodEnd(value) }

  return (
    <div id="inv-stock-transfers" className="w-full" style={{ color: TEXT }}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: BLUE }}>Inventory logistics</p>
          <h1 className="mt-1 text-3xl font-bold leading-tight md:text-[32px]" style={{ color: isDark ? '#f8fafc' : '#000000' }}>Stock Transfers</h1>
          <p className="mt-1 text-sm md:text-[15px]" style={{ color: TEXT_MUTED }}>Move stock between locations and keep every transfer easy to review.</p>
        </div>
        <div className="w-full rounded-xl border p-3 shadow-sm sm:w-auto sm:min-w-[430px]" style={{ background: CARD_BG, borderColor: CARD_BORDER }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-lg" style={{ background: isDark ? '#172554' : '#dbeafe', color: isDark ? '#93c5fd' : BLUE }}>
                <CalendarDays className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: TEXT_MUTED }}>Dashboard period</p>
                <p className="mt-0.5 text-sm font-semibold" style={{ color: periodInvalid ? '#dc2626' : TEXT }}>{periodLabel}</p>
              </div>
            </div>
            <Select value={periodPreset} onChange={(event) => changePeriod(event.target.value as TransferPeriodPreset)} className="h-[38px] w-full text-sm sm:w-[150px]" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }} aria-label="Dashboard period preset">
              <option value="today">Today</option>
              <option value="last7">Last 7 days</option>
              <option value="thisMonth">This month</option>
              <option value="custom">Custom range</option>
            </Select>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold" style={{ color: TEXT_MUTED }}>
              From
              <DatePicker value={periodStart} onChange={changePeriodStart} max={periodEnd || undefined} className="mt-1 w-full" aria-label="Dashboard period start date" />
            </label>
            <label className="text-xs font-semibold" style={{ color: TEXT_MUTED }}>
              To
              <DatePicker value={periodEnd} onChange={changePeriodEnd} min={periodStart || undefined} className="mt-1 w-full" aria-label="Dashboard period end date" />
            </label>
          </div>
          {periodInvalid && <p className="mt-2 text-xs font-medium text-red-600">The end date must be on or after the start date.</p>}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {transferStats.map((stat) => (
          <div key={stat.label} className="rounded-xl border p-4 shadow-sm" style={{ background: CARD_BG, borderColor: CARD_BORDER }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: TEXT_MUTED }}>{stat.label}</p>
                <p className="mt-2 text-2xl font-semibold" style={{ color: TEXT }}>{stat.value}</p>
                <p className="mt-1 text-xs" style={{ color: TEXT_MUTED }}>{stat.hint}</p>
              </div>
              <span className="grid size-9 place-items-center rounded-lg" style={{ background: isDark ? '#29313a' : '#f1f5f9', color: stat.color }}>{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl shadow-sm" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
        <div className="p-5 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5" style={{ borderColor: CARD_BORDER }}>
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ background: isDark ? '#172554' : '#dbeafe', color: isDark ? '#93c5fd' : BLUE }}>
                <Package className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-xl font-semibold md:text-[24px]" style={{ color: isDark ? '#bfdbfe' : '#16325c' }}>All Stock Transfers</h2>
                <p className="mt-1 text-sm" style={{ color: TEXT_MUTED }}>Review stock movements between your business locations.</p>
              </div>
            </div>
            <button type="button" onClick={openAdd} className="btn rounded-full font-semibold text-white shadow-sm transition hover:brightness-110" style={{ background: 'linear-gradient(135deg, #4f38e8, #347ff0)' }}>
              <CirclePlus className="size-5" aria-hidden />
              Add transfer
            </button>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: TEXT }}>
              <span>Show</span>
              <Select value={String(showEntries)} onChange={(event) => { setShowEntries(Number(event.target.value)); setPage(1) }} className="w-24" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }}>
                <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
              </Select>
              <span>entries</span>
              <div className="ml-2 flex flex-wrap items-center gap-2">
                <InvToolbarIconButton label="Export CSV" onClick={handleCsv} disabled={busy !== ''}>
                  {done === 'csv' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <Download className="size-4" aria-hidden />}
                </InvToolbarIconButton>
                <InvToolbarIconButton label="Export Excel" onClick={() => void handleExcel()} disabled={busy !== ''}>
                  {done === 'excel' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <FileSpreadsheet className="size-4" aria-hidden />}
                </InvToolbarIconButton>
                <InvToolbarIconButton label="Print" onClick={() => handlePrint()} disabled={busy !== ''}>
                  {done === 'print' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <Printer className="size-4" aria-hidden />}
                </InvToolbarIconButton>
                <div className="relative">
                  <InvToolbarIconButton label="Column Visibility" onClick={(event) => { event.stopPropagation(); setColumnsOpen((open) => !open) }}>
                    <Columns3 className="size-4" aria-hidden />
                  </InvToolbarIconButton>
                  {columnsOpen && (
                    <div className="absolute left-0 top-full z-40 mt-2 w-56 rounded-lg border p-3 shadow-xl" style={{ background: CARD_BG, borderColor: CARD_BORDER }} onClick={(event) => event.stopPropagation()}>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>Show columns</p>
                      {STOCK_TRANSFER_COLUMNS.map((column) => (
                        <label key={column.key} className="flex cursor-pointer items-center gap-2 py-1.5 text-sm" style={{ color: TEXT }}>
                          <input type="checkbox" checked={visibleColumns[column.key]} onChange={(event) => setVisibleColumns((current) => ({ ...current, [column.key]: event.target.checked }))} className="size-4 accent-blue-600" />
                          {column.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <InvToolbarIconButton label="Export PDF" onClick={handlePdf} disabled={busy !== ''}>
                  {done === 'pdf' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <FileText className="size-4" aria-hidden />}
                </InvToolbarIconButton>
              </div>
            </div>
            <label className="flex w-full items-center gap-2 text-sm sm:w-auto" style={{ color: TEXT }}>
              <span className="shrink-0">Search</span>
              <span className="relative w-full sm:w-[200px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
                <input type="search" value={q} onChange={(event) => { setQ(event.target.value); setPage(1) }} placeholder="Search ..." aria-label="Search stock transfers" className="h-[38px] w-full pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }} />
              </span>
            </label>
          </div>

          <div className="mt-8 overflow-hidden rounded-xl border" style={{ borderColor: PANEL_BORDER, background: CARD_BG }}>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-sm">
              <thead>
                <tr style={{ background: TABLE_HEAD_BG }}>
                  {visibleColumns.date && <th className="w-[110px] border-r px-3 py-3 text-left font-bold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}><button type="button" onClick={() => toggleSort('date')} className="inline-flex items-center gap-2 text-left font-bold">Date <SortUpDownIcon active={sortKey === 'date'} /></button></th>}
                  {visibleColumns.referenceNo && <th className="w-[130px] border-r px-3 py-3 text-left font-bold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}><button type="button" onClick={() => toggleSort('referenceNo')} className="inline-flex items-center gap-2 text-left font-bold">Reference No <SortUpDownIcon active={sortKey === 'referenceNo'} /></button></th>}
                  {visibleColumns.from && <th className="w-[135px] border-r px-3 py-3 text-left font-bold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}><button type="button" onClick={() => toggleSort('from')} className="inline-flex items-center gap-2 text-left font-bold">Location (From) <SortUpDownIcon active={sortKey === 'from'} /></button></th>}
                  {visibleColumns.to && <th className="w-[135px] border-r px-3 py-3 text-left font-bold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}><button type="button" onClick={() => toggleSort('to')} className="inline-flex items-center gap-2 text-left font-bold">Location (To) <SortUpDownIcon active={sortKey === 'to'} /></button></th>}
                  {visibleColumns.status && <th className="w-[100px] border-r px-3 py-3 text-left font-bold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}><button type="button" onClick={() => toggleSort('status')} className="inline-flex items-center gap-2 text-left font-bold">Status <SortUpDownIcon active={sortKey === 'status'} /></button></th>}
                  {visibleColumns.shippingCharges && <th className="w-[125px] border-r px-3 py-3 text-left font-bold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}><button type="button" onClick={() => toggleSort('shippingCharges')} className="inline-flex items-center gap-2 text-left font-bold">Shipping Charges <SortUpDownIcon active={sortKey === 'shippingCharges'} /></button></th>}
                  {visibleColumns.totalAmount && <th className="w-[120px] border-r px-3 py-3 text-left font-bold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}><button type="button" onClick={() => toggleSort('totalAmount')} className="inline-flex items-center gap-2 text-left font-bold">Total Amount <SortUpDownIcon active={sortKey === 'totalAmount'} /></button></th>}
                  {visibleColumns.notes && <th className="w-[150px] border-r px-3 py-3 text-left font-bold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}><button type="button" onClick={() => toggleSort('notes')} className="inline-flex items-center gap-2 text-left font-bold">Additional Notes <SortUpDownIcon active={sortKey === 'notes'} /></button></th>}
                  <th className="w-[220px] px-3 py-3 text-left font-bold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((item, index) => {
                  const zebra = index % 2 === 0
                  return (
                    <tr
                      key={item.id}
                      className="transition-colors"
                      style={{ background: zebra ? TABLE_ROW_ALT : CARD_BG, color: TEXT }}
                      onMouseEnter={(event) => { event.currentTarget.style.background = isDark ? '#2b313b' : '#f1f5f9' }}
                      onMouseLeave={(event) => { event.currentTarget.style.background = zebra ? TABLE_ROW_ALT : CARD_BG }}
                    >
                      {visibleColumns.date && <td className="border-r px-3 py-3.5 align-middle whitespace-nowrap" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}>{transferDateTime(item.date)}</td>}
                      {visibleColumns.referenceNo && <td className="border-r px-3 py-3.5 align-middle" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}><span className="inline-flex rounded-md border px-2 py-0.5 font-mono text-xs" style={{ borderColor: INPUT_BORDER, background: isDark ? '#22272e' : '#f8fafc', color: TEXT_MUTED }}>{item.referenceNo}</span></td>}
                      {visibleColumns.from && <td className="border-r px-3 py-3.5 align-middle" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}>{item.from}</td>}
                      {visibleColumns.to && <td className="border-r px-3 py-3.5 align-middle" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}>{item.to}</td>}
                      {visibleColumns.status && <td className="border-r px-3 py-3.5 align-middle" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}>
                        <button
                          type="button"
                          onClick={() => openStatusUpdate(item)}
                          title={item.status === 'Completed' ? 'Completed transfers are locked and cannot be changed' : 'Update status'}
                          aria-label={item.status === 'Completed' ? `Status for ${item.referenceNo} is Completed — locked, cannot be changed` : `Update status for ${item.referenceNo} (currently ${item.status})`}
                          disabled={item.status === 'Completed'}
                          className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition', item.status === 'Completed' ? 'cursor-default' : 'cursor-pointer hover:brightness-95')}
                          style={{ ...statusStyle(item.status), boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}
                        >
                          <span className="size-1.5 rounded-full" style={{ background: 'currentColor' }} aria-hidden />
                          {item.status}
                        </button>
                      </td>}
                      {visibleColumns.shippingCharges && <td className="border-r px-3 py-3.5 align-middle whitespace-nowrap" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}>{transferMoney(item.shippingCharges)}</td>}
                      {visibleColumns.totalAmount && <td className="border-r px-3 py-3.5 align-middle whitespace-nowrap" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}>{transferMoney(item.totalAmount)}</td>}
                      {visibleColumns.notes && <td className="border-r px-3 py-3.5 align-middle" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}`, color: item.notes ? TEXT : TEXT_MUTED }}>{item.notes || '—'}</td>}
                      <td className="whitespace-nowrap px-3 py-3.5 align-middle" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}>
                        <div className="flex flex-nowrap gap-2">
                          {labelButton('View', <Eye className="size-4" aria-hidden />, () => setViewing(item), CYAN)}
                          {labelButton('Print', <Printer className="size-4" aria-hidden />, () => handlePrint(item), '#0ea5e9')}
                          <CatalogueActionButton label={item.status === 'Completed' ? 'Delete — completed transfers are locked' : 'Delete'} onClick={() => removeTransfer(item)} disabled={item.status === 'Completed'} style={{ background: 'transparent', border: `1px solid ${RED}`, color: RED }}><TrashIcon className="size-4" aria-hidden /></CatalogueActionButton>
                          <CatalogueActionButton label={item.status === 'Completed' ? 'Edit — completed transfers are locked' : 'Edit'} onClick={() => openEdit(item)} disabled={item.status === 'Completed'} style={{ background: 'transparent', border: `1px solid ${PURPLE}`, color: PURPLE }}><Pencil className="size-4" aria-hidden /></CatalogueActionButton>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {paged.length === 0 && <tr><td colSpan={visibleCount} className="px-4 py-12 text-center" style={{ color: TEXT_MUTED, background: CARD_BG }}><Package className="mx-auto size-8 opacity-50" aria-hidden /><p className="mt-3 font-semibold" style={{ color: TEXT }}>No stock transfers found</p><p className="mt-1 text-sm">Try a different search or add a stock transfer.</p></td></tr>}
              </tbody>
            </table>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm" style={{ color: TEXT }}>
            <span>Showing {startIdx} to {endIdx} of {filtered.length} entries</span>
            <div className="flex items-center">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="btn rounded-r-none disabled:cursor-not-allowed disabled:opacity-50" style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}>Previous</button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <button type="button" key={number} onClick={() => setPage(number)} className="btn rounded-none -ml-px" style={number === page ? { background: '#337ab7', border: '1px solid #337ab7', color: '#ffffff' } : { background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}>{number}</button>)}
              <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="btn rounded-l-none -ml-px disabled:cursor-not-allowed disabled:opacity-50" style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}>Next</button>
            </div>
          </div>
        </div>
      </section>

      <div data-stock-transfer-print aria-hidden style={{ position: 'fixed', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
        <style>{`@media print { html, body { background: #fff !important; color: #000 !important; } body * { visibility: hidden !important; } [data-stock-transfer-print], [data-stock-transfer-print] * { visibility: visible !important; } [data-stock-transfer-print] { position: absolute !important; left: 0 !important; top: 0 !important; width: auto !important; height: auto !important; overflow: visible !important; display: block !important; padding: 24px !important; color: #000 !important; background: #fff !important; } [data-stock-transfer-print] table { width: 100%; border-collapse: collapse; margin-top: 12px; } [data-stock-transfer-print] th, [data-stock-transfer-print] td { border: 1px solid #666; padding: 6px 8px; font-size: 11px; text-align: left; } [data-stock-transfer-print] h1 { font-size: 20px; margin: 0 0 4px; } }`}</style>
        <h1>Stock Transfers</h1>
        <div>Printed {new Date().toLocaleString()} · FitPro Gym App</div>
        <table><thead><tr>{STOCK_TRANSFER_COLUMNS.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{(printTarget ? [printTarget] : filtered).map((item) => <tr key={item.id}><td>{transferDateTime(item.date)}</td><td>{item.referenceNo}</td><td>{item.from}</td><td>{item.to}</td><td>{item.status}</td><td>{transferMoney(item.shippingCharges)}</td><td>{transferMoney(item.totalAmount)}</td><td>{item.notes || '—'}</td></tr>)}</tbody></table>
      </div>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `Stock Transfer ${viewing.referenceNo}` : 'Stock Transfer'}
        variant="perfex"
        size="lg"
        footer={<button type="button" onClick={() => setViewing(null)} className="btn font-semibold" style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}>Close</button>}
      >
        {viewing && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{
          [
            ['Date', transferDateTime(viewing.date)],
            ['Reference No', viewing.referenceNo],
            ['Location (From)', viewing.from],
            ['Location (To)', viewing.to],
            ['Status', viewing.status],
            ['Shipping Charges', transferMoney(viewing.shippingCharges)],
            ['Total Amount', transferMoney(viewing.totalAmount)],
            ['Additional Notes', viewing.notes || 'No notes added'],
          ].map(([label, value]) => <div key={label} className="rounded-lg border p-4" style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}><p className="text-xs font-semibold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>{label}</p><p className="mt-1 font-semibold" style={{ color: TEXT }}>{value}</p></div>)
        }</div>}
      </Modal>

      {/* Update Status quick dialog */}
      <Modal
        open={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        title="Update Status"
        variant="perfex"
        size="sm"
        footer={(
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => void saveStatusUpdate()} className="btn min-w-[110px] rounded-xl px-7 py-2.5 text-sm font-bold text-white shadow-lg transition hover:brightness-110" style={{ background: PURPLE, borderColor: PURPLE }}>Update</button>
            <button type="button" onClick={() => setStatusTarget(null)} className="btn min-w-[100px] rounded-xl px-7 py-2.5 text-sm font-bold text-white transition hover:brightness-110" style={{ background: isDark ? '#2a313b' : '#2f3542', borderColor: isDark ? '#2a313b' : '#2f3542' }}>Close</button>
          </div>
        )}
      >
        {statusTarget && (
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-bold" style={{ color: TEXT }}>
              Status:<span className="text-red-500">*</span>
              <span title="Pending, In-Transit, Completed, or Cancelled." aria-label="Status info">
                <Info className="size-3.5" style={{ color: '#38bdf8' }} />
              </span>
            </label>
            <Select
              value={statusDraft}
              onChange={(event) => { setStatusDraft(event.target.value as TransferStatus | ''); setStatusError('') }}
              className="h-11 w-full text-sm"
              aria-label="Updated transfer status"
              aria-invalid={!!statusError}
            >
              <option value="">Please Select</option>
              <option value="Pending">Pending</option>
              <option value="In-Transit">In-Transit</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </Select>
            {statusError && <p className="mt-1.5 text-xs text-red-500">{statusError}</p>}
            <p className="mt-3 text-xs" style={{ color: TEXT_MUTED }}>
              Updates <span className="font-semibold" style={{ color: TEXT }}>{statusTarget.referenceNo}</span> ({statusTarget.from} → {statusTarget.to}) without reopening the full transfer form.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Edit Stock Transfer' : 'Add Stock Transfer'}
        variant="perfex"
        size="xl"
      >
        {/* Card 1 — details */}
        <div className="mb-4 rounded-xl border p-4" style={{ background: CARD_BG, borderColor: CARD_BORDER }}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-bold" style={{ color: TEXT }}>Date:<span className="text-red-500">*</span></label>
              <div className="relative">
                <DatePicker value={form.date} onChange={(value) => setFormValue('date', value)} className="w-full" aria-label="Stock transfer date" />
              </div>
              {form.errors.date && <p className="mt-1 text-xs text-red-500">{form.errors.date}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold" style={{ color: TEXT }}>Reference No:</label>
              <input value={form.referenceNo} onChange={(event) => setFormValue('referenceNo', event.target.value)} className="h-11 w-full rounded-lg px-3 text-sm" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }} />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-bold" style={{ color: TEXT }}>
                Status:<span className="text-red-500">*</span>
                <span title="Status of this transfer. Pending transfers can still be edited; Completed moves the stock." aria-label="Status info">
                  <Info className="size-3.5" style={{ color: '#38bdf8' }} />
                </span>
              </label>
              <Select value={form.status} onChange={(event) => setFormValue('status', event.target.value as TransferStatus)} className="h-11 w-full text-sm" aria-label="Stock transfer status" aria-invalid={!!form.errors.status}>
                <option value="">Please Select</option>
                <option value="Pending">Pending</option>
                <option value="In-Transit">In-Transit</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </Select>
              {form.errors.status && <p className="mt-1 text-xs text-red-500">{form.errors.status}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold" style={{ color: TEXT }}>Location (From):<span className="text-red-500">*</span></label>
              <Select value={form.from} onChange={(event) => setFormValue('from', event.target.value)} className="h-11 w-full text-sm" aria-label="Stock transfer source location" aria-invalid={!!form.errors.from}>
                <option value="">Please Select</option>
                {locations.map((location) => <option key={location} value={location}>{location}</option>)}
              </Select>
              {form.errors.from && <p className="mt-1 text-xs text-red-500">{form.errors.from}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold" style={{ color: TEXT }}>Location (To):<span className="text-red-500">*</span></label>
              <Select value={form.to} onChange={(event) => setFormValue('to', event.target.value)} className="h-11 w-full text-sm" aria-label="Stock transfer destination location" aria-invalid={!!form.errors.to}>
                <option value="">Please Select</option>
                {locations.map((location) => <option key={location} value={location}>{location}</option>)}
              </Select>
              {form.errors.to && <p className="mt-1 text-xs text-red-500">{form.errors.to}</p>}
            </div>
          </div>
        </div>

        {/* Card 2 — products */}
        <div className="mb-4 rounded-xl border p-4" style={{ background: CARD_BG, borderColor: CARD_BORDER }}>
          <div className="relative mx-auto mb-4 max-w-2xl">
            <div className="flex items-stretch overflow-hidden rounded-lg border" style={{ borderColor: INPUT_BORDER, background: INPUT_BG }}>
              <span className="grid w-11 place-items-center" style={{ color: TEXT_MUTED }}><Search className="size-4" /></span>
              <input
                value={transferProductQuery}
                onChange={(event) => { setTransferProductQuery(event.target.value); setTransferProductOpen(true) }}
                onFocus={() => setTransferProductOpen(true)}
                onBlur={() => window.setTimeout(() => setTransferProductOpen(false), 150)}
                  placeholder="Search products for stock transfer"
                  aria-label="Search products for stock transfer"
                className="h-11 w-full px-2 text-sm focus:outline-none"
                style={{ background: 'transparent', color: TEXT }}
              />
            </div>
            {transferProductOpen && transferProductMatches.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border shadow-2xl" style={{ background: CARD_BG, borderColor: CARD_BORDER }}>
                {transferProductMatches.map((item) => (
                  <button key={item.id} type="button" onMouseDown={(event) => { event.preventDefault(); addTransferLine(item) }} className="flex w-full items-center justify-between gap-3 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-lime/10" style={{ borderColor: PANEL_BORDER }}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold" style={{ color: TEXT }}>{item.name}</span>
                      <span className="text-xs" style={{ color: TEXT_MUTED }}>{item.sku} · {item.quantity} {item.unit} in stock</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold" style={{ color: TEXT }}>{transferMoney(item.sellPrice)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr style={{ color: TEXT }}>
                  <th className="w-[38%] px-3 py-2.5 text-left font-bold">Product</th>
                  <th className="px-3 py-2.5 text-center font-bold">Quantity</th>
                  <th className="px-3 py-2.5 text-center font-bold">Unit Price</th>
                  <th className="px-3 py-2.5 text-right font-bold">Subtotal</th>
                  <th className="w-12 px-3 py-2.5 text-center font-bold"><Trash2 className="mx-auto size-4" aria-label="Remove product" /></th>
                </tr>
              </thead>
              <tbody>
                {form.lines.map((line, index) => {
                  const qty = Math.max(0, Number(line.quantity) || 0)
                  const price = Math.max(0, Number(line.unitPrice) || 0)
                  return (
                    <tr key={line.itemId} style={{ borderTop: `1px solid ${PANEL_BORDER}` }}>
                      <td className="px-3 py-2.5 font-semibold" style={{ color: TEXT }}>{line.name}</td>
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="number" min="0" step="1"
                          value={line.quantity}
                          onChange={(event) => updateTransferLine(line.itemId, { quantity: event.target.value })}
                          aria-label={`Quantity for ${line.name}`}
                          className="h-10 w-24 rounded-lg px-2 text-center text-sm"
                          style={{ background: INPUT_BG, border: `1px solid ${form.errors[`lineQty${index}`] ? RED : INPUT_BORDER}`, color: TEXT }}
                        />
                        {form.errors[`lineQty${index}`] && <p className="mt-1 text-xs text-red-500">{form.errors[`lineQty${index}`]}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="number" min="0" step="0.01"
                          value={line.unitPrice}
                          onChange={(event) => updateTransferLine(line.itemId, { unitPrice: event.target.value })}
                          aria-label={`Unit price for ${line.name}`}
                          className="h-10 w-28 rounded-lg px-2 text-center text-sm"
                          style={{ background: INPUT_BG, border: `1px solid ${form.errors[`linePrice${index}`] ? RED : INPUT_BORDER}`, color: TEXT }}
                        />
                        {form.errors[`linePrice${index}`] && <p className="mt-1 text-xs text-red-500">{form.errors[`linePrice${index}`]}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums" style={{ color: TEXT }}>{transferMoney(qty * price)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button type="button" onClick={() => removeTransferLine(line.itemId)} aria-label={`Remove ${line.name}`} className="grid size-8 place-items-center rounded-lg text-mist transition hover:bg-rose-500/10" style={{ color: RED }}>
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {!form.lines.length && (
                  <tr style={{ borderTop: `1px solid ${PANEL_BORDER}` }}>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm" style={{ color: TEXT_MUTED }}>
                      {form.errors.lines ? <span className="text-red-500">{form.errors.lines}</span> : 'Search a product above to add it to this transfer.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-right text-sm font-bold" style={{ color: TEXT }}>Total: <span className="tabular-nums">{transferMoney(transferLinesSubtotal)}</span></p>
        </div>

        {/* Card 3 — shipping, notes, total, save */}
        <div className="rounded-xl border p-4" style={{ background: CARD_BG, borderColor: CARD_BORDER }}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-bold" style={{ color: TEXT }}>Shipping Charges:</label>
              <input type="number" min="0" step="0.01" aria-label="Shipping charges" value={form.shippingCharges} onChange={(event) => setFormValue('shippingCharges', event.target.value)} className="h-11 w-full rounded-lg px-3 text-sm" style={{ background: INPUT_BG, border: `1px solid ${form.errors.shippingCharges ? RED : INPUT_BORDER}`, color: TEXT }} />
              {form.errors.shippingCharges && <p className="mt-1 text-xs text-red-500">{form.errors.shippingCharges}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold" style={{ color: TEXT }}>Additional Notes</label>
              <textarea value={form.notes} onChange={(event) => setFormValue('notes', event.target.value)} rows={3} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }} />
            </div>
          </div>
          <p className="mt-3 text-right text-sm font-bold" style={{ color: TEXT }}>Total Amount: <span className="tabular-nums" style={{ color: TEXT }}>{transferMoney(transferTotal)}</span></p>
          <div className="mt-4 flex justify-center">
            <button type="button" onClick={() => void saveTransfer()} disabled={saving} className="btn min-w-[130px] rounded-xl px-8 py-3 text-base font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60" style={{ background: PURPLE, borderColor: PURPLE }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
type StockAdjustmentRow = {
  id: number
  sourceId?: string
  companyId?: string
  branchId?: string
  date: string
  referenceNo: string
  location: string
  adjustmentType: 'Normal' | 'Abnormal'
  totalAmount: number
  totalAmountRecovered: number
  reason: string
  addedBy: string
  lines?: StockAdjustmentLine[]
}

type AdjustmentFormLine = { itemId: string; name: string; quantity: string; unitPrice: string }

type AdjustmentForm = {
  date: string
  referenceNo: string
  location: string
  adjustmentType: StockAdjustmentType | ''
  totalAmountRecovered: string
  reason: string
  addedBy: string
  lines: AdjustmentFormLine[]
  errors: Record<string, string>
}

type AdjustmentColumnKey = 'date' | 'referenceNo' | 'location' | 'adjustmentType' | 'totalAmount' | 'totalAmountRecovered' | 'reason' | 'addedBy'
type AdjustmentSortKey = AdjustmentColumnKey

const SEED_STOCK_ADJUSTMENTS: StockAdjustmentRow[] = [
  {
    id: 1,
    sourceId: 'sad_1',
    companyId: 'co_fitpro',
    branchId: 'br_airport',
    date: '2026-08-27T19:52',
    referenceNo: '92993',
    location: 'Airport City Flagship',
    adjustmentType: 'Normal',
    totalAmount: 900,
    totalAmountRecovered: 0,
    reason: 'Replace Lost',
    addedBy: 'Rev. Isaac Botchwey',
  },
]

const STOCK_ADJUSTMENT_COLUMNS: { key: AdjustmentColumnKey; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'referenceNo', label: 'Reference No' },
  { key: 'location', label: 'Location' },
  { key: 'adjustmentType', label: 'Adjustment type' },
  { key: 'totalAmount', label: 'Total Amount' },
  { key: 'totalAmountRecovered', label: 'Total amount recovered' },
  { key: 'reason', label: 'Reason' },
  { key: 'addedBy', label: 'Added By' },
]

const adjustmentDateParts = (value: string) => {
  const iso = value.split('T')[0]
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return { date: value, time: '' }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(date.getTime())) return { date: value, time: '' }
  const dateText = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`
  const timeText = value.includes('T') ? value.split('T')[1]?.slice(0, 5) || '' : ''
  return { date: dateText, time: timeText }
}

const adjustmentDateLabel = (value: string) => {
  const parts = adjustmentDateParts(value)
  return [parts.date, parts.time].filter(Boolean).join(' ')
}
const adjustmentMoney = (value: number) => `₵ ${value.toFixed(2)}`

const emptyAdjustmentForm = (nextId: number): AdjustmentForm => ({
  date: transferInputDate(new Date()),
  referenceNo: String(92992 + nextId),
  location: '',
  adjustmentType: '',
  totalAmountRecovered: '0',
  reason: '',
  addedBy: 'Rev. Isaac Botchwey',
  lines: [],
  errors: {},
})

const adjustmentToRow = (item: StockAdjustment): StockAdjustmentRow => ({
  id: Number(item.id.match(/\d+/)?.[0] || 0) || Math.abs(Array.from(item.id).reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) | 0, 7)),
  sourceId: item.id,
  companyId: item.companyId,
  branchId: item.branchId,
  date: item.date,
  referenceNo: item.referenceNo,
  location: item.location,
  adjustmentType: item.adjustmentType,
  totalAmount: item.totalAmount,
  totalAmountRecovered: item.totalAmountRecovered,
  reason: item.reason,
  addedBy: item.addedBy,
  lines: item.lines,
})

export function StockAdjustments() {
  const { branches, activeBranchId, activeCompanyId, inventory, stockAdjustments, upsertStockAdjustment, deleteStockAdjustment } = useApp()
  const contextItems = useMemo(() => stockAdjustments.map(adjustmentToRow), [stockAdjustments])
  const [items, setItems] = useState<StockAdjustmentRow[]>(() => contextItems.length ? contextItems : SEED_STOCK_ADJUSTMENTS)
  const [nextId, setNextId] = useState(() => Math.max(1, ...contextItems.map((item) => item.id)) + 1)
  const [q, setQ] = useState('')
  const [periodPreset, setPeriodPreset] = useState<TransferPeriodPreset>('thisMonth')
  const [periodStart, setPeriodStart] = useState(() => transferPeriodRange('thisMonth').start)
  const [periodEnd, setPeriodEnd] = useState(() => transferPeriodRange('thisMonth').end)
  const [showEntries, setShowEntries] = useState(25)
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<AdjustmentSortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Record<AdjustmentColumnKey, boolean>>({
    date: true, referenceNo: true, location: true, adjustmentType: true,
    totalAmount: true, totalAmountRecovered: true, reason: true, addedBy: true,
  })
  const [form, setForm] = useState<AdjustmentForm>(() => emptyAdjustmentForm(2))
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<StockAdjustmentRow | null>(null)
  const [adjustProductQuery, setAdjustProductQuery] = useState('')
  const [adjustProductOpen, setAdjustProductOpen] = useState(false)
  const [viewing, setViewing] = useState<StockAdjustmentRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')
  const [done, setDone] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')

  useEffect(() => {
    setItems(contextItems)
    setPage(1)
  }, [contextItems])

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!columnsOpen) return
    const close = () => setColumnsOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [columnsOpen])

  const locations = useMemo(() => branches.filter((branch) => branch.status !== 'inactive' && (!activeCompanyId || branch.companyId === activeCompanyId)).map((branch) => branch.name).sort(), [activeCompanyId, branches])
  const periodInvalid = !periodStart || !periodEnd || periodStart > periodEnd
  const periodItems = useMemo(() => {
    if (periodInvalid) return []
    const start = new Date(`${periodStart}T00:00:00`).getTime()
    const end = new Date(`${periodEnd}T23:59:59.999`).getTime()
    return items.filter((item) => {
      const timestamp = new Date(item.date).getTime()
      return Number.isFinite(timestamp) && timestamp >= start && timestamp <= end
    })
  }, [items, periodEnd, periodInvalid, periodStart])
  const periodLabel = periodInvalid ? 'Choose a valid date range' : `${transferDisplayDate(periodStart)} – ${transferDisplayDate(periodEnd)}`
  const totalAdjustmentAmount = periodItems.reduce((sum, item) => sum + item.totalAmount, 0)
  const totalRecoveredAmount = periodItems.reduce((sum, item) => sum + item.totalAmountRecovered, 0)
  const netAdjustmentAmount = totalAdjustmentAmount - totalRecoveredAmount
  const adjustmentStats = [
    { label: 'Total adjustments', value: String(periodItems.length), hint: periodLabel, color: '#2563eb', icon: <Package className="size-4" aria-hidden /> },
    { label: 'Total amount', value: adjustmentMoney(totalAdjustmentAmount), hint: periodLabel, color: '#7c3aed', icon: <FileText className="size-4" aria-hidden /> },
    { label: 'Recovered amount', value: adjustmentMoney(totalRecoveredAmount), hint: periodLabel, color: '#059669', icon: <CheckCircle2 className="size-4" aria-hidden /> },
    { label: 'Net adjustment', value: adjustmentMoney(netAdjustmentAmount), hint: periodLabel, color: '#e11d48', icon: <AlertCircle className="size-4" aria-hidden /> },
  ]
  const toggleSort = (key: AdjustmentSortKey) => {
    if (sortKey === key) setSortDir((direction) => direction === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    let list = items
    if (query) {
      list = list.filter((item) => [
        item.date, item.referenceNo, item.location, item.adjustmentType,
        String(item.totalAmount), String(item.totalAmountRecovered), item.reason, item.addedBy,
      ].some((value) => value.toLowerCase().includes(query)))
    }
    return [...list].sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      if (sortKey === 'date') { av = a.date; bv = b.date }
      else if (sortKey === 'referenceNo') { av = a.referenceNo; bv = b.referenceNo }
      else if (sortKey === 'location') { av = a.location; bv = b.location }
      else if (sortKey === 'adjustmentType') { av = a.adjustmentType; bv = b.adjustmentType }
      else if (sortKey === 'totalAmount') { av = a.totalAmount; bv = b.totalAmount }
      else if (sortKey === 'totalAmountRecovered') { av = a.totalAmountRecovered; bv = b.totalAmountRecovered }
      else if (sortKey === 'reason') { av = a.reason; bv = b.reason }
      else { av = a.addedBy; bv = b.addedBy }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [items, q, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / showEntries))
  const paged = filtered.slice((page - 1) * showEntries, page * showEntries)
  const startIdx = filtered.length === 0 ? 0 : (page - 1) * showEntries + 1
  const endIdx = Math.min(page * showEntries, filtered.length)
  const visibleCount = Object.values(visibleColumns).filter(Boolean).length + 1

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const CARD_BG = isDark ? '#1b1f24' : '#ffffff'
  const CARD_BORDER = isDark ? '#2d333a' : '#e0e7ef'
  const PANEL_BG = isDark ? '#20252c' : '#f8fafc'
  const PANEL_BORDER = isDark ? '#363c44' : '#e5e7eb'
  const TABLE_HEAD_BG = isDark ? '#2a313b' : '#fbfbfb'
  const TABLE_ROW_ALT = isDark ? '#1f242b' : '#fafafa'
  const TEXT = isDark ? '#e5e7eb' : '#0f172a'
  const TEXT_MUTED = isDark ? '#9aa3ad' : '#64748b'
  const INPUT_BG = isDark ? '#14171c' : '#ffffff'
  const INPUT_BORDER = isDark ? '#49515c' : '#cbd5e1'
  const BLUE = '#2563eb'
  const PURPLE = '#4f00e6'
  const RED = '#ff3b4f'

  const flashDone = (which: 'csv' | 'excel' | 'print' | 'pdf') => {
    setDone(which)
    window.setTimeout(() => setDone(''), 1500)
  }
  const handlePrint = () => {
    setBusy('print')
    window.setTimeout(() => { window.print(); setBusy(''); flashDone('print') }, 150)
  }
  const handlePdf = () => {
    setBusy('pdf')
    window.setTimeout(() => { window.print(); setBusy(''); flashDone('pdf') }, 150)
  }
  const handleCsv = () => {
    setBusy('csv')
    const headers = ['#', ...STOCK_ADJUSTMENT_COLUMNS.map((column) => column.label)]
    const rows = filtered.map((item, index) => [
      String(index + 1), adjustmentDateLabel(item.date), item.referenceNo, item.location,
      item.adjustmentType, String(item.totalAmount), String(item.totalAmountRecovered), item.reason, item.addedBy,
    ])
    const csv = [headers, ...rows].map((row) => row.map((cell) => {
      const value = String(cell ?? '').replace(/"/g, '""')
      return /[",\n]/.test(value) ? `"${value}"` : value
    }).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'stock-adjustments.csv'; document.body.appendChild(anchor); anchor.click(); anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setBusy(''); flashDone('csv')
  }
  const handleExcel = async () => {
    setBusy('excel')
    const rows = filtered.map((item, index) => ({
      '#': index + 1, Date: adjustmentDateLabel(item.date), 'Reference No': item.referenceNo,
      Location: item.location, 'Adjustment type': item.adjustmentType, 'Total Amount': item.totalAmount,
      'Total amount recovered': item.totalAmountRecovered, Reason: item.reason, 'Added By': item.addedBy,
    }))
    const ok = await exportExcel('stock-adjustments', rows)
    setBusy('')
    if (ok) flashDone('excel')
  }

  const adjustProductMatches = useMemo(() => {
    const tokens = adjustProductQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!tokens.length) return []
    return inventory
      .filter((item) => tokens.every((token) => `${item.name} ${item.sku}`.toLowerCase().includes(token)))
      .slice(0, 7)
  }, [inventory, adjustProductQuery])

  const adjustLinesSubtotal = useMemo(
    () => form.lines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.unitPrice) || 0), 0),
    [form.lines],
  )

  const addAdjustLine = (item: InventoryItem) => {
    setForm((current) => {
      if (current.lines.some((line) => line.itemId === item.id)) return current
      return {
        ...current,
        lines: [...current.lines, { itemId: item.id, name: item.name, quantity: '1', unitPrice: String(item.sellPrice) }],
        errors: { ...current.errors, lines: '' },
      }
    })
    setAdjustProductQuery('')
    setAdjustProductOpen(false)
  }
  const updateAdjustLine = (itemId: string, patch: Partial<AdjustmentFormLine>) =>
    setForm((current) => ({ ...current, lines: current.lines.map((line) => (line.itemId === itemId ? { ...line, ...patch } : line)) }))
  const removeAdjustLine = (itemId: string) =>
    setForm((current) => ({ ...current, lines: current.lines.filter((line) => line.itemId !== itemId) }))

  const openAdd = () => {
    setEditing(null)
    setForm(emptyAdjustmentForm(nextId))
    setAdjustProductQuery('')
    setFormOpen(true)
  }
  const openEdit = (item: StockAdjustmentRow) => {
    setEditing(item)
    setForm({
      date: transferDateValue(item.date),
      referenceNo: item.referenceNo,
      location: item.location,
      adjustmentType: item.adjustmentType,
      totalAmountRecovered: String(item.totalAmountRecovered),
      reason: item.reason,
      addedBy: item.addedBy && item.addedBy !== '—' ? item.addedBy : '',
      lines: (item.lines || []).map((line) => ({ itemId: line.itemId, name: line.name, quantity: String(line.quantity), unitPrice: String(line.unitPrice) })),
      errors: {},
    })
    setAdjustProductQuery('')
    setFormOpen(true)
  }
  const closeForm = () => { setFormOpen(false); setEditing(null); setForm((current) => ({ ...current, errors: {} })) }
  const setFormValue = <K extends keyof AdjustmentForm>(key: K, value: AdjustmentForm[K]) => setForm((current) => ({ ...current, [key]: value, errors: { ...current.errors, [key]: '' } }))

  const saveAdjustment = async () => {
    const errors: Record<string, string> = {}
    if (!form.date) errors.date = 'Date is required.'
    if (!form.location) errors.location = 'Select a location.'
    if (!form.adjustmentType) errors.adjustmentType = 'Select an adjustment type.'
    const recovered = Number(form.totalAmountRecovered)
    if (!Number.isFinite(recovered) || recovered < 0) errors.totalAmountRecovered = 'Enter a valid amount.'
    for (const [index, line] of form.lines.entries()) {
      const qty = Number(line.quantity)
      const price = Number(line.unitPrice)
      if (!Number.isFinite(qty) || qty <= 0) errors[`lineQty${index}`] = 'Enter a quantity.'
      if (!Number.isFinite(price) || price < 0) errors[`linePrice${index}`] = 'Enter a unit price.'
    }
    const lines: StockAdjustmentLine[] = form.lines.map((line) => ({
      itemId: line.itemId,
      name: line.name,
      quantity: Math.max(0, Number(line.quantity) || 0),
      unitPrice: Math.max(0, Number(line.unitPrice) || 0),
    }))
    const totalAmount = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
    if (Number.isFinite(recovered) && recovered > totalAmount) errors.totalAmountRecovered = 'Cannot be greater than total amount.'
    if (Object.keys(errors).length) { setForm((current) => ({ ...current, errors })); return }

    setSaving(true)
    await new Promise((resolve) => window.setTimeout(resolve, 180))
    const branch = branches.find((candidate) => candidate.name === form.location)
    const next: StockAdjustment = {
      id: editing?.sourceId || `sad_${nextId}`,
      companyId: activeCompanyId,
      branchId: branch?.id || activeBranchId,
      date: form.date,
      referenceNo: form.referenceNo.trim() || `SA${nextId}`,
      location: form.location,
      adjustmentType: form.adjustmentType as StockAdjustmentType,
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalAmountRecovered: Math.round(recovered * 100) / 100,
      reason: form.reason.trim(),
      addedBy: form.addedBy.trim() || '—',
      lines,
      createdAt: editing?.date || new Date().toISOString(),
    }
    upsertStockAdjustment(next)
    if (!editing) setNextId((id) => id + 1)
    setSaving(false)
    closeForm()
  }
  const removeAdjustment = (item: StockAdjustmentRow) => {
    if (!window.confirm(`Delete stock adjustment ${item.referenceNo}?`)) return
    if (item.sourceId) deleteStockAdjustment(item.sourceId)
    else setItems((current) => current.filter((row) => row.id !== item.id))
  }

  const changePeriod = (preset: TransferPeriodPreset) => {
    setPeriodPreset(preset)
    if (preset !== 'custom') {
      const range = transferPeriodRange(preset)
      setPeriodStart(range.start)
      setPeriodEnd(range.end)
    }
  }
  const changePeriodStart = (value: string) => { setPeriodPreset('custom'); setPeriodStart(value) }
  const changePeriodEnd = (value: string) => { setPeriodPreset('custom'); setPeriodEnd(value) }

  const adjustmentCell = (item: StockAdjustmentRow, key: AdjustmentColumnKey) => {
    if (key === 'date') {
      const parts = adjustmentDateParts(item.date)
      return <><span className="block">{parts.date}</span>{parts.time && <span className="block">{parts.time}</span>}</>
    }
    if (key === 'referenceNo') return <span className="inline-flex rounded-md border px-2 py-0.5 font-mono text-xs" style={{ borderColor: INPUT_BORDER, background: isDark ? '#22272e' : '#f8fafc', color: TEXT_MUTED }}>{item.referenceNo}</span>
    if (key === 'location') return item.location
    if (key === 'adjustmentType') return <span className="inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold" style={{ borderColor: INPUT_BORDER, background: isDark ? '#22272e' : '#f8fafc', color: TEXT }}>{item.adjustmentType}</span>
    if (key === 'totalAmount') return adjustmentMoney(item.totalAmount)
    if (key === 'totalAmountRecovered') return adjustmentMoney(item.totalAmountRecovered)
    if (key === 'reason') return item.reason || '—'
    return item.addedBy || '—'
  }

  return (
    <div id="inv-stock-adjustments" className="w-full" style={{ color: TEXT }}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: BLUE }}>Inventory control</p>
          <h1 className="mt-1 text-3xl font-bold leading-tight md:text-[32px]" style={{ color: isDark ? '#f8fafc' : '#000000' }}>Stock Adjustments</h1>
          <p className="mt-1 text-sm md:text-[15px]" style={{ color: TEXT_MUTED }}>Review stock corrections, recoveries, and the reasons behind every adjustment.</p>
        </div>
        <div className="w-full rounded-xl border p-3 shadow-sm sm:w-auto sm:min-w-[430px]" style={{ background: CARD_BG, borderColor: CARD_BORDER }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-lg" style={{ background: isDark ? '#172554' : '#dbeafe', color: isDark ? '#93c5fd' : BLUE }}>
                <CalendarDays className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: TEXT_MUTED }}>Dashboard period</p>
                <p className="mt-0.5 text-sm font-semibold" style={{ color: periodInvalid ? '#dc2626' : TEXT }}>{periodLabel}</p>
              </div>
            </div>
            <Select value={periodPreset} onChange={(event) => changePeriod(event.target.value as TransferPeriodPreset)} className="h-[38px] w-full text-sm sm:w-[150px]" aria-label="Dashboard period preset">
              <option value="today">Today</option>
              <option value="last7">Last 7 days</option>
              <option value="thisMonth">This month</option>
              <option value="custom">Custom range</option>
            </Select>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold" style={{ color: TEXT_MUTED }}>
              From
              <DatePicker value={periodStart} onChange={changePeriodStart} max={periodEnd || undefined} className="mt-1 w-full" aria-label="Dashboard period start date" />
            </label>
            <label className="text-xs font-semibold" style={{ color: TEXT_MUTED }}>
              To
              <DatePicker value={periodEnd} onChange={changePeriodEnd} min={periodStart || undefined} className="mt-1 w-full" aria-label="Dashboard period end date" />
            </label>
          </div>
          {periodInvalid && <p className="mt-2 text-xs font-medium text-red-600">The end date must be on or after the start date.</p>}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {adjustmentStats.map((stat) => (
          <div key={stat.label} className="rounded-xl border p-4 shadow-sm" style={{ background: CARD_BG, borderColor: CARD_BORDER }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: TEXT_MUTED }}>{stat.label}</p>
                <p className="mt-2 text-2xl font-semibold" style={{ color: TEXT }}>{stat.value}</p>
                <p className="mt-1 text-xs" style={{ color: TEXT_MUTED }}>{stat.hint}</p>
              </div>
              <span className="grid size-9 place-items-center rounded-lg" style={{ background: isDark ? '#29313a' : '#f1f5f9', color: stat.color }}>{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl shadow-sm" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
        <div className="p-5 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5" style={{ borderColor: CARD_BORDER }}>
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ background: isDark ? '#172554' : '#dbeafe', color: isDark ? '#93c5fd' : BLUE }}>
                <Package className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-xl font-semibold md:text-[24px]" style={{ color: isDark ? '#bfdbfe' : '#16325c' }}>All stock adjustments</h2>
                <p className="mt-1 text-sm" style={{ color: TEXT_MUTED }}>Review stock corrections across your business locations.</p>
              </div>
            </div>
            <button type="button" onClick={openAdd} className="btn rounded-full font-semibold text-white shadow-sm transition hover:brightness-110" style={{ background: 'linear-gradient(135deg, #4f38e8, #347ff0)' }}>
              <CirclePlus className="size-5" aria-hidden />
              Add adjustment
            </button>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: TEXT }}>
              <span>Show</span>
              <Select value={String(showEntries)} onChange={(event) => { setShowEntries(Number(event.target.value)); setPage(1) }} className="w-24" aria-label="Entries per page">
                <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
              </Select>
              <span>entries</span>
              <div className="ml-2 flex flex-wrap items-center gap-2">
                <InvToolbarIconButton label="Export CSV" onClick={handleCsv} disabled={busy !== ''}>
                  {done === 'csv' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <Download className="size-4" aria-hidden />}
                </InvToolbarIconButton>
                <InvToolbarIconButton label="Export Excel" onClick={() => void handleExcel()} disabled={busy !== ''}>
                  {done === 'excel' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <FileSpreadsheet className="size-4" aria-hidden />}
                </InvToolbarIconButton>
                <InvToolbarIconButton label="Print" onClick={handlePrint} disabled={busy !== ''}>
                  {done === 'print' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <Printer className="size-4" aria-hidden />}
                </InvToolbarIconButton>
                <div className="relative">
                  <InvToolbarIconButton label="Column Visibility" onClick={(event) => { event.stopPropagation(); setColumnsOpen((open) => !open) }}>
                    <Columns3 className="size-4" aria-hidden />
                  </InvToolbarIconButton>
                  {columnsOpen && (
                    <div className="absolute left-0 top-full z-40 mt-2 w-64 rounded-lg border p-3 shadow-xl" style={{ background: CARD_BG, borderColor: CARD_BORDER }} onClick={(event) => event.stopPropagation()}>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>Show columns</p>
                      {STOCK_ADJUSTMENT_COLUMNS.map((column) => (
                        <label key={column.key} className="flex cursor-pointer items-center gap-2 py-1.5 text-sm" style={{ color: TEXT }}>
                          <input type="checkbox" checked={visibleColumns[column.key]} onChange={(event) => setVisibleColumns((current) => ({ ...current, [column.key]: event.target.checked }))} className="size-4 accent-blue-600" />
                          {column.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <InvToolbarIconButton label="Export PDF" onClick={handlePdf} disabled={busy !== ''}>
                  {done === 'pdf' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <FileText className="size-4" aria-hidden />}
                </InvToolbarIconButton>
              </div>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <label htmlFor="stock-adjustments-search" className="shrink-0 text-sm font-semibold" style={{ color: TEXT }}>Search</label>
              <div className="search-field w-full sm:w-[250px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
                <input id="stock-adjustments-search" type="search" value={q} onChange={(event) => { setQ(event.target.value); setPage(1) }} placeholder="Search adjustments..." aria-label="Search stock adjustments" autoComplete="off" className="w-full" style={{ color: TEXT }} />
                {q && <button type="button" onClick={() => { setQ(''); setPage(1) }} aria-label="Clear stock adjustment search" className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md" style={{ color: TEXT_MUTED }}><X className="size-4" aria-hidden /></button>}
              </div>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-xl border" style={{ borderColor: PANEL_BORDER, background: CARD_BG }}>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[1420px] border-collapse text-sm">
              <thead>
                <tr style={{ background: TABLE_HEAD_BG }}>
                  <th className="w-[190px] border-r px-3 py-3 text-left font-bold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}>Action</th>
                  {STOCK_ADJUSTMENT_COLUMNS.map((column) => visibleColumns[column.key] && (
                    <th key={column.key} className="border-r px-3 py-3 text-left font-bold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort(column.key)} className="inline-flex items-center gap-2 text-left font-bold">
                        {column.label}
                        <SortUpDownIcon active={sortKey === column.key} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((item, index) => {
                  const zebra = index % 2 === 0
                  return (
                    <tr key={item.id} className="transition-colors" style={{ background: zebra ? TABLE_ROW_ALT : CARD_BG, color: TEXT }} onMouseEnter={(event) => { event.currentTarget.style.background = isDark ? '#2b313b' : '#f1f5f9' }} onMouseLeave={(event) => { event.currentTarget.style.background = zebra ? TABLE_ROW_ALT : CARD_BG }}>
                      <td className="border-r px-3 py-3.5 align-middle" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}>
                        <div className="flex flex-wrap items-center gap-2">
                          <CatalogueActionButton label="View" onClick={() => setViewing(item)} style={{ background: 'transparent', border: `1px solid ${PURPLE}`, color: PURPLE }}>
                            <Eye className="size-4" aria-hidden />
                          </CatalogueActionButton>
                          <CatalogueActionButton label="Edit" onClick={() => openEdit(item)} style={{ background: 'transparent', border: `1px solid ${BLUE}`, color: BLUE }}>
                            <Pencil className="size-4" aria-hidden />
                          </CatalogueActionButton>
                          <CatalogueActionButton label="Delete" onClick={() => removeAdjustment(item)} style={{ background: 'transparent', border: `1px solid ${RED}`, color: RED }}>
                            <TrashIcon className="size-4" aria-hidden />
                          </CatalogueActionButton>
                        </div>
                      </td>
                      {STOCK_ADJUSTMENT_COLUMNS.map((column) => visibleColumns[column.key] && <td key={column.key} className="border-r px-3 py-3.5 align-middle" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}>{adjustmentCell(item, column.key)}</td>)}
                    </tr>
                  )
                })}
                {paged.length === 0 && <tr><td colSpan={visibleCount} className="px-4 py-12 text-center" style={{ color: TEXT_MUTED, background: CARD_BG }}><Package className="mx-auto size-8 opacity-50" aria-hidden /><p className="mt-3 font-semibold" style={{ color: TEXT }}>No stock adjustments found</p><p className="mt-1 text-sm">Try a different search or add a stock adjustment.</p></td></tr>}
              </tbody>
            </table>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm" style={{ color: TEXT }}>
            <span>{filtered.length === 0 ? 'No entries' : `Showing ${startIdx} to ${endIdx} of ${filtered.length} entries`}</span>
            <div className="flex items-center">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="btn rounded-r-none font-semibold disabled:cursor-not-allowed disabled:opacity-50" style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}><ChevronLeft className="size-4" aria-hidden /> Previous</button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <button type="button" key={number} onClick={() => setPage(number)} className={cn('btn rounded-none font-semibold -ml-px', number === page && 'text-white')} style={number === page ? { background: '#337ab7', border: '1px solid #337ab7', color: '#ffffff' } : { background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}>{number}</button>)}
              <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="btn rounded-l-none font-semibold -ml-px disabled:cursor-not-allowed disabled:opacity-50" style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}>Next <ChevronRight className="size-4" aria-hidden /></button>
            </div>
          </div>
        </div>
      </section>

      <div data-stock-adjustments-print aria-hidden style={{ position: 'fixed', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
        <style>{`@media print { html, body { background: #fff !important; color: #000 !important; } body * { visibility: hidden !important; } [data-stock-adjustments-print], [data-stock-adjustments-print] * { visibility: visible !important; } [data-stock-adjustments-print] { position: absolute !important; left: 0 !important; top: 0 !important; width: auto !important; height: auto !important; overflow: visible !important; display: block !important; padding: 24px !important; color: #000 !important; background: #fff !important; } [data-stock-adjustments-print] table { width: 100%; border-collapse: collapse; margin-top: 12px; } [data-stock-adjustments-print] th, [data-stock-adjustments-print] td { border: 1px solid #666; padding: 6px 8px; font-size: 11px; text-align: left; } [data-stock-adjustments-print] h1 { font-size: 20px; margin: 0 0 4px; } }`}</style>
        <h1>Stock Adjustments</h1>
        <div>Printed {new Date().toLocaleString()} · FitPro Gym App</div>
        <table><thead><tr><th>#</th>{STOCK_ADJUSTMENT_COLUMNS.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{filtered.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td>{adjustmentDateLabel(item.date)}</td><td>{item.referenceNo}</td><td>{item.location}</td><td>{item.adjustmentType}</td><td>{adjustmentMoney(item.totalAmount)}</td><td>{adjustmentMoney(item.totalAmountRecovered)}</td><td>{item.reason || '—'}</td><td>{item.addedBy || '—'}</td></tr>)}</tbody></table>
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `Stock Adjustment ${viewing.referenceNo}` : 'Stock Adjustment'} variant="perfex" size="lg" footer={<button type="button" onClick={() => setViewing(null)} className="btn font-semibold" style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}>Close</button>}>
        {viewing && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[
          ['Date', adjustmentDateLabel(viewing.date)], ['Reference No', viewing.referenceNo], ['Location', viewing.location], ['Adjustment type', viewing.adjustmentType],
          ['Total Amount', adjustmentMoney(viewing.totalAmount)], ['Total amount recovered', adjustmentMoney(viewing.totalAmountRecovered)], ['Reason', viewing.reason || 'No reason added'], ['Added By', viewing.addedBy || '—'],
        ].map(([label, value]) => <div key={label} className="rounded-lg border p-4" style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}><p className="text-xs font-semibold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>{label}</p><p className="mt-1 font-semibold" style={{ color: TEXT }}>{value}</p></div>)}</div>}
      </Modal>

      <Modal open={formOpen} onClose={closeForm} title={editing ? 'Edit Stock Adjustment' : 'Add Stock Adjustment'} variant="perfex" size="xl">
        <div className="text-sm" style={{ color: TEXT }}>
          {/* Card 1 — details */}
          <div className="mb-4 rounded-xl border p-4" style={{ background: CARD_BG, borderColor: CARD_BORDER }}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-sm font-bold" style={{ color: TEXT }}>Business Location:<span className="text-red-500">*</span></label>
                <Select value={form.location} onChange={(event) => setFormValue('location', event.target.value)} className="h-11 w-full text-sm" aria-label="Stock adjustment business location" aria-invalid={!!form.errors.location}>
                  <option value="">Please Select</option>
                  {locations.map((location) => <option key={location} value={location}>{location}</option>)}
                </Select>
                {form.errors.location && <p className="mt-1 text-xs text-red-500">{form.errors.location}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold" style={{ color: TEXT }}>Reference No:</label>
                <input value={form.referenceNo} onChange={(event) => setFormValue('referenceNo', event.target.value)} aria-label="Stock adjustment reference number" className="h-11 w-full rounded-lg px-3 text-sm" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold" style={{ color: TEXT }}>Date:<span className="text-red-500">*</span></label>
                <DatePicker value={form.date} onChange={(value) => setFormValue('date', value)} className="w-full" aria-label="Stock adjustment date" />
                {form.errors.date && <p className="mt-1 text-xs text-red-500">{form.errors.date}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold" style={{ color: TEXT }}>
                  Adjustment type:<span className="text-red-500">*</span>
                  <span title="Normal records expected corrections (e.g. found stock). Abnormal records damage, loss or theft." aria-label="Adjustment type info">
                    <Info className="ml-1 inline size-3.5 align-[-2px]" style={{ color: '#38bdf8' }} />
                  </span>
                </label>
                <Select value={form.adjustmentType} onChange={(event) => setFormValue('adjustmentType', event.target.value as StockAdjustmentType)} className="h-11 w-full text-sm" aria-label="Stock adjustment type" aria-invalid={!!form.errors.adjustmentType}>
                  <option value="">Please Select</option>
                  <option value="Normal">Normal</option>
                  <option value="Abnormal">Abnormal</option>
                </Select>
                {form.errors.adjustmentType && <p className="mt-1 text-xs text-red-500">{form.errors.adjustmentType}</p>}
              </div>
            </div>
          </div>


          {/* Card 2 — products */}
          <div className="mb-4 rounded-xl border p-4" style={{ background: CARD_BG, borderColor: CARD_BORDER }}>
            <div className="relative mx-auto mb-4 max-w-2xl">
              <div className="flex items-stretch overflow-hidden rounded-lg border" style={{ borderColor: INPUT_BORDER, background: INPUT_BG }}>
                <span className="grid w-11 place-items-center" style={{ color: TEXT_MUTED }}><Search className="size-4" /></span>
                <input
                  value={adjustProductQuery}
                  onChange={(event) => { setAdjustProductQuery(event.target.value); setAdjustProductOpen(true) }}
                  onFocus={() => setAdjustProductOpen(true)}
                  onBlur={() => window.setTimeout(() => setAdjustProductOpen(false), 150)}
                  placeholder="Search products for stock adjustment"
                  aria-label="Search products for stock adjustment"
                  className="h-11 w-full px-2 text-sm focus:outline-none"
                  style={{ background: 'transparent', color: TEXT }}
                />
              </div>
              {adjustProductOpen && adjustProductMatches.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border shadow-2xl" style={{ background: CARD_BG, borderColor: CARD_BORDER }}>
                  {adjustProductMatches.map((item) => (
                    <button key={item.id} type="button" onMouseDown={(event) => { event.preventDefault(); addAdjustLine(item) }} className="flex w-full items-center justify-between gap-3 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-lime/10" style={{ borderColor: PANEL_BORDER }}>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold" style={{ color: TEXT }}>{item.name}</span>
                        <span className="text-xs" style={{ color: TEXT_MUTED }}>{item.sku} · {item.quantity} {item.unit} in stock</span>
                      </span>
                      <span className="shrink-0 text-sm font-bold" style={{ color: TEXT }}>{adjustmentMoney(item.sellPrice)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr style={{ color: TEXT }}>
                    <th className="w-[38%] px-3 py-2.5 text-left font-bold">Product</th>
                    <th className="px-3 py-2.5 text-center font-bold">Quantity</th>
                    <th className="px-3 py-2.5 text-center font-bold">Unit Price</th>
                    <th className="px-3 py-2.5 text-right font-bold">Subtotal</th>
                    <th className="w-12 px-3 py-2.5 text-center font-bold"><Trash2 className="mx-auto size-4" aria-label="Remove product" /></th>
                  </tr>
                </thead>
                <tbody>
                  {form.lines.map((line, index) => {
                    const qty = Math.max(0, Number(line.quantity) || 0)
                    const price = Math.max(0, Number(line.unitPrice) || 0)
                    return (
                      <tr key={line.itemId} style={{ borderTop: `1px solid ${PANEL_BORDER}` }}>
                        <td className="px-3 py-2.5 font-semibold" style={{ color: TEXT }}>{line.name}</td>
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="number" min="0" step="1"
                            value={line.quantity}
                            onChange={(event) => updateAdjustLine(line.itemId, { quantity: event.target.value })}
                            aria-label={`Quantity for ${line.name}`}
                            className="h-10 w-24 rounded-lg px-2 text-center text-sm"
                            style={{ background: INPUT_BG, border: `1px solid ${form.errors[`lineQty${index}`] ? RED : INPUT_BORDER}`, color: TEXT }}
                          />
                          {form.errors[`lineQty${index}`] && <p className="mt-1 text-xs text-red-500">{form.errors[`lineQty${index}`]}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="number" min="0" step="0.01"
                            value={line.unitPrice}
                            onChange={(event) => updateAdjustLine(line.itemId, { unitPrice: event.target.value })}
                            aria-label={`Unit price for ${line.name}`}
                            className="h-10 w-28 rounded-lg px-2 text-center text-sm"
                            style={{ background: INPUT_BG, border: `1px solid ${form.errors[`linePrice${index}`] ? RED : INPUT_BORDER}`, color: TEXT }}
                          />
                          {form.errors[`linePrice${index}`] && <p className="mt-1 text-xs text-red-500">{form.errors[`linePrice${index}`]}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums" style={{ color: TEXT }}>{adjustmentMoney(qty * price)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <button type="button" onClick={() => removeAdjustLine(line.itemId)} aria-label={`Remove ${line.name}`} className="grid size-8 place-items-center rounded-lg text-mist transition hover:bg-rose-500/10" style={{ color: RED }}>
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {!form.lines.length && (
                    <tr style={{ borderTop: `1px solid ${PANEL_BORDER}` }}>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm" style={{ color: TEXT_MUTED }}>
                        {form.errors.lines ? <span className="text-red-500">{form.errors.lines}</span> : 'Search a product above to add it to this adjustment.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-right text-sm font-bold" style={{ color: TEXT }}>Total Amount: <span className="tabular-nums">{adjustmentMoney(adjustLinesSubtotal)}</span></p>
          </div>


          {/* Card 3 — recovered, reason, save */}
          <div className="rounded-xl border p-4" style={{ background: CARD_BG, borderColor: CARD_BORDER }}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-bold" style={{ color: TEXT }}>
                  Total amount recovered:
                  <span title="Amount recovered for the adjusted items, e.g. insurance or scrap value. Cannot exceed the total amount." aria-label="Total amount recovered info">
                    <Info className="ml-1 inline size-3.5 align-[-2px]" style={{ color: '#38bdf8' }} />
                  </span>
                </label>
                <input type="number" min="0" step="0.01" aria-label="Total amount recovered" value={form.totalAmountRecovered} onChange={(event) => setFormValue('totalAmountRecovered', event.target.value)} className="h-11 w-full rounded-lg px-3 text-sm" style={{ background: INPUT_BG, border: `1px solid ${form.errors.totalAmountRecovered ? RED : INPUT_BORDER}`, color: TEXT }} />
                {form.errors.totalAmountRecovered && <p className="mt-1 text-xs text-red-500">{form.errors.totalAmountRecovered}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold" style={{ color: TEXT }}>Reason:</label>
                <textarea value={form.reason} onChange={(event) => setFormValue('reason', event.target.value)} rows={3} placeholder="Reason" aria-label="Stock adjustment reason" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }} />
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <button type="button" onClick={() => void saveAdjustment()} disabled={saving} className="btn min-w-[130px] rounded-xl px-8 py-3 text-base font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60" style={{ background: PURPLE, borderColor: PURPLE }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
type StockCountRow = {
  id: number
  sourceId?: string
  companyId?: string
  branchId?: string
  date: string
  referenceNo: string
  location: string
  lines: StockCountLine[]
  varianceValue: number
  notes: string
  addedBy: string
}

type CountFormLine = { itemId: string; name: string; systemQty: string; countedQty: string; unitPrice: string }

type CountForm = {
  date: string
  referenceNo: string
  location: string
  notes: string
  addedBy: string
  lines: CountFormLine[]
  errors: Record<string, string>
}

type CountColumnKey = 'date' | 'referenceNo' | 'location' | 'products' | 'variances' | 'varianceValue' | 'notes' | 'addedBy'
type CountSortKey = CountColumnKey

const SEED_STOCK_COUNTS: StockCountRow[] = [
  {
    id: 1,
    sourceId: 'sco_1',
    companyId: 'co_fitpro',
    branchId: 'br_airport',
    date: '2026-08-26T18:20',
    referenceNo: 'SC2026/0001',
    location: 'Airport City Flagship',
    lines: [{ itemId: 'inv_1', name: 'Whey Protein (2.27kg)', systemQty: 14, countedQty: 13, unitPrice: 780 }],
    varianceValue: -780,
    notes: 'Monthly stocktake — one tub unaccounted for',
    addedBy: 'Rev. Isaac Botchwey',
  },
]

const STOCK_COUNT_COLUMNS: { key: CountColumnKey; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'referenceNo', label: 'Reference No' },
  { key: 'location', label: 'Location' },
  { key: 'products', label: 'Products' },
  { key: 'variances', label: 'Variances' },
  { key: 'varianceValue', label: 'Variance Value' },
  { key: 'notes', label: 'Notes' },
  { key: 'addedBy', label: 'Added By' },
]

const countToRow = (item: StockCount): StockCountRow => ({
  id: Number(item.id.match(/\d+/)?.[0] || 0) || Math.abs(Array.from(item.id).reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) | 0, 7)),
  sourceId: item.id,
  companyId: item.companyId,
  branchId: item.branchId,
  date: item.date,
  referenceNo: item.referenceNo,
  location: item.location,
  lines: item.lines || [],
  varianceValue: item.varianceValue,
  notes: item.notes,
  addedBy: item.addedBy,
})

const emptyCountForm = (nextId: number): CountForm => ({
  date: transferInputDate(new Date()),
  referenceNo: `SC2026/${String(nextId).padStart(4, '0')}`,
  location: '',
  notes: '',
  addedBy: 'Rev. Isaac Botchwey',
  lines: [],
  errors: {},
})

const countVarianceMoney = (value: number) => {
  const rounded = Math.round(value * 100) / 100
  if (rounded > 0) return `+₵ ${rounded.toFixed(2)}`
  if (rounded < 0) return `-₵ ${Math.abs(rounded).toFixed(2)}`
  return '₵ 0.00'
}

export function StockCounts() {
  const { branches, activeBranchId, activeCompanyId, inventory, stockCounts, upsertStockCount, deleteStockCount } = useApp()
  const contextItems = useMemo(() => stockCounts.map(countToRow), [stockCounts])
  const [items, setItems] = useState<StockCountRow[]>(() => contextItems.length ? contextItems : SEED_STOCK_COUNTS)
  const [nextId, setNextId] = useState(() => Math.max(1, ...contextItems.map((item) => item.id)) + 1)
  const [q, setQ] = useState('')
  const [periodPreset, setPeriodPreset] = useState<TransferPeriodPreset>('thisMonth')
  const [periodStart, setPeriodStart] = useState(() => transferPeriodRange('thisMonth').start)
  const [periodEnd, setPeriodEnd] = useState(() => transferPeriodRange('thisMonth').end)
  const [showEntries, setShowEntries] = useState(25)
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<CountSortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Record<CountColumnKey, boolean>>({
    date: true, referenceNo: true, location: true, products: true,
    variances: true, varianceValue: true, notes: true, addedBy: true,
  })
  const [form, setForm] = useState<CountForm>(() => emptyCountForm(2))
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<StockCountRow | null>(null)
  const [countProductQuery, setCountProductQuery] = useState('')
  const [countProductOpen, setCountProductOpen] = useState(false)
  const [viewing, setViewing] = useState<StockCountRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<'' | 'csv' | 'excel' | 'print'>('')
  const [done, setDone] = useState<'' | 'csv' | 'excel' | 'print'>('')

  useEffect(() => {
    setItems(contextItems)
    setPage(1)
  }, [contextItems])

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!columnsOpen) return
    const close = () => setColumnsOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [columnsOpen])

  const locations = useMemo(() => branches.filter((branch) => branch.status !== 'inactive' && (!activeCompanyId || branch.companyId === activeCompanyId)).map((branch) => branch.name).sort(), [activeCompanyId, branches])

  const periodInvalid = !periodStart || !periodEnd || new Date(periodStart) > new Date(periodEnd)

  const periodItems = useMemo(() => {
    if (periodInvalid) return []
    const start = new Date(`${periodStart}T00:00:00`).getTime()
    const end = new Date(`${periodEnd}T23:59:59.999`).getTime()
    return items.filter((item) => {
      const timestamp = new Date(item.date).getTime()
      return Number.isFinite(timestamp) && timestamp >= start && timestamp <= end
    })
  }, [items, periodEnd, periodInvalid, periodStart])

  const periodLabel = periodInvalid ? 'Choose a valid date range' : `${transferDisplayDate(periodStart)} – ${transferDisplayDate(periodEnd)}`
  const productsCounted = periodItems.reduce((sum, item) => sum + item.lines.length, 0)
  const varianceCount = periodItems.reduce((sum, item) => sum + item.lines.filter((line) => line.countedQty !== line.systemQty).length, 0)
  const varianceTotal = periodItems.reduce((sum, item) => sum + item.varianceValue, 0)
  const countStats = [
    { label: 'Total counts', value: String(periodItems.length), hint: periodLabel, color: '#2563eb', icon: <ClipboardList className="size-4" aria-hidden /> },
    { label: 'Products counted', value: String(productsCounted), hint: periodLabel, color: '#7c3aed', icon: <Package className="size-4" aria-hidden /> },
    { label: 'Variances found', value: String(varianceCount), hint: periodLabel, color: '#059669', icon: <CheckCircle2 className="size-4" aria-hidden /> },
    { label: 'Variance value', value: countVarianceMoney(varianceTotal), hint: periodLabel, color: '#e11d48', icon: <AlertCircle className="size-4" aria-hidden /> },
  ]

  const toggleSort = (key: CountSortKey) => {
    if (sortKey === key) setSortDir((direction) => direction === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    let list = items
    if (query) {
      list = list.filter((item) => [
        item.date, item.referenceNo, item.location, item.notes, item.addedBy,
        ...item.lines.map((line) => line.name),
      ].some((value) => value.toLowerCase().includes(query)))
    }
    return [...list].sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      if (sortKey === 'date') { av = a.date; bv = b.date }
      else if (sortKey === 'referenceNo') { av = a.referenceNo; bv = b.referenceNo }
      else if (sortKey === 'location') { av = a.location; bv = b.location }
      else if (sortKey === 'products') { av = a.lines.length; bv = b.lines.length }
      else if (sortKey === 'variances') { av = a.lines.filter((line) => line.countedQty !== line.systemQty).length; bv = b.lines.filter((line) => line.countedQty !== line.systemQty).length }
      else if (sortKey === 'varianceValue') { av = a.varianceValue; bv = b.varianceValue }
      else if (sortKey === 'notes') { av = a.notes; bv = b.notes }
      else { av = a.addedBy; bv = b.addedBy }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [items, q, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / showEntries))
  const paged = filtered.slice((page - 1) * showEntries, page * showEntries)
  const startIdx = filtered.length === 0 ? 0 : (page - 1) * showEntries + 1
  const endIdx = Math.min(page * showEntries, filtered.length)
  const visibleCount = Object.values(visibleColumns).filter(Boolean).length + 1

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const CARD_BG = isDark ? '#1b1f24' : '#ffffff'
  const CARD_BORDER = isDark ? '#2d333a' : '#e0e7ef'
  const PANEL_BG = isDark ? '#20252c' : '#f8fafc'
  const PANEL_BORDER = isDark ? '#363c44' : '#e5e7eb'
  const TABLE_HEAD_BG = isDark ? '#2a313b' : '#fbfbfb'
  const TABLE_ROW_ALT = isDark ? '#1f242b' : '#fafafa'
  const TEXT = isDark ? '#e5e7eb' : '#0f172a'
  const TEXT_MUTED = isDark ? '#9aa3ad' : '#64748b'
  const INPUT_BG = isDark ? '#14171c' : '#ffffff'
  const INPUT_BORDER = isDark ? '#49515c' : '#cbd5e1'
  const BLUE = '#2563eb'
  const PURPLE = '#4f00e6'
  const RED = '#ff3b4f'

  const flashDone = (which: 'csv' | 'excel' | 'print') => {
    setDone(which)
    window.setTimeout(() => setDone(''), 1500)
  }
  const handlePrint = () => {
    setBusy('print')
    window.setTimeout(() => { window.print(); setBusy(''); flashDone('print') }, 150)
  }
  const handleCsv = () => {
    setBusy('csv')
    const headers = ['#', ...STOCK_COUNT_COLUMNS.map((column) => column.label)]
    const rows = filtered.map((item, index) => [
      String(index + 1), adjustmentDateLabel(item.date), item.referenceNo, item.location,
      String(item.lines.length), String(item.lines.filter((line) => line.countedQty !== line.systemQty).length),
      item.varianceValue.toFixed(2), item.notes, item.addedBy,
    ])
    const csv = [headers, ...rows].map((row) => row.map((cell) => {
      const value = String(cell ?? '').replace(/"/g, '""')
      return/[",\n]/.test(value) ? `"${value}"` : value
    }).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'stock-counts.csv'; document.body.appendChild(anchor); anchor.click(); anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setBusy(''); flashDone('csv')
  }
  const handleExcel = async () => {
    setBusy('excel')
    const rows = filtered.map((item, index) => ({
      '#': index + 1, Date: adjustmentDateLabel(item.date), 'Reference No': item.referenceNo,
      Location: item.location, Products: item.lines.length,
      Variances: item.lines.filter((line) => line.countedQty !== line.systemQty).length,
      'Variance Value': item.varianceValue, Notes: item.notes, 'Added By': item.addedBy,
    }))
    const ok = await exportExcel('stock-counts', rows)
    setBusy('')
    if (ok) flashDone('excel')
  }

  const countProductMatches = useMemo(() => {
    const tokens = countProductQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!tokens.length) return []
    return inventory
      .filter((item) => tokens.every((token) => `${item.name} ${item.sku}`.toLowerCase().includes(token)))
      .slice(0, 7)
  }, [inventory, countProductQuery])

  const countVarianceValue = useMemo(
    () => form.lines.reduce((sum, line) => sum + ((Number(line.countedQty) || 0) - (Number(line.systemQty) || 0)) * (Number(line.unitPrice) || 0), 0),
    [form.lines],
  )

  const addCountLine = (item: InventoryItem) => {
    setForm((current) => {
      if (current.lines.some((line) => line.itemId === item.id)) return current
      return {
        ...current,
        lines: [...current.lines, { itemId: item.id, name: item.name, systemQty: String(item.quantity), countedQty: '1', unitPrice: String(item.sellPrice) }],
        errors: { ...current.errors, lines: '' },
      }
    })
    setCountProductQuery('')
    setCountProductOpen(false)
  }
  const updateCountLine = (itemId: string, patch: Partial<CountFormLine>) =>
    setForm((current) => ({ ...current, lines: current.lines.map((line) => (line.itemId === itemId ? { ...line, ...patch } : line)) }))
  const removeCountLine = (itemId: string) =>
    setForm((current) => ({ ...current, lines: current.lines.filter((line) => line.itemId !== itemId) }))

  const openAdd = () => {
    setEditing(null)
    setForm(emptyCountForm(nextId))
    setCountProductQuery('')
    setFormOpen(true)
  }
  const openEdit = (item: StockCountRow) => {
    setEditing(item)
    setForm({
      date: transferDateValue(item.date),
      referenceNo: item.referenceNo,
      location: item.location,
      notes: item.notes,
      addedBy: item.addedBy && item.addedBy !== '—' ? item.addedBy : '',
      lines: item.lines.map((line) => ({ itemId: line.itemId, name: line.name, systemQty: String(line.systemQty), countedQty: String(line.countedQty), unitPrice: String(line.unitPrice) })),
      errors: {},
    })
    setCountProductQuery('')
    setFormOpen(true)
  }
  const closeForm = () => { setFormOpen(false); setEditing(null); setForm((current) => ({ ...current, errors: {} })) }
  const setFormValue = <K extends keyof CountForm>(key: K, value: CountForm[K]) => setForm((current) => ({ ...current, [key]: value, errors: { ...current.errors, [key]: '' } }))

  const saveCount = async () => {
    const errors: Record<string, string> = {}
    if (!form.date) errors.date = 'Date is required.'
    if (!form.location) errors.location = 'Select a location.'
    if (!form.lines.length) errors.lines = 'Add at least one product to count.'
    for (const [index, line] of form.lines.entries()) {
      const counted = Number(line.countedQty)
      const price = Number(line.unitPrice)
      if (!Number.isFinite(counted) || counted < 0) errors[`lineCount${index}`] = 'Enter a counted quantity.'
      if (!Number.isFinite(price) || price < 0) errors[`linePrice${index}`] = 'Enter a unit price.'
    }
    const lines: StockCountLine[] = form.lines.map((line) => ({
      itemId: line.itemId,
      name: line.name,
      systemQty: Math.max(0, Number(line.systemQty) || 0),
      countedQty: Math.max(0, Number(line.countedQty) || 0),
      unitPrice: Math.max(0, Number(line.unitPrice) || 0),
    }))
    const varianceValue = lines.reduce((sum, line) => sum + (line.countedQty - line.systemQty) * line.unitPrice, 0)
    if (Object.keys(errors).length) { setForm((current) => ({ ...current, errors })); return }

    setSaving(true)
    await new Promise((resolve) => window.setTimeout(resolve, 180))
    const branch = branches.find((candidate) => candidate.name === form.location)
    const next: StockCount = {
      id: editing?.sourceId || `sco_${nextId}`,
      companyId: activeCompanyId,
      branchId: branch?.id || activeBranchId,
      date: form.date,
      referenceNo: form.referenceNo.trim() || `SC2026/${String(nextId).padStart(4, '0')}`,
      location: form.location,
      lines,
      varianceValue: Math.round(varianceValue * 100) / 100,
      notes: form.notes.trim(),
      addedBy: form.addedBy.trim() || '—',
      createdAt: editing?.date || new Date().toISOString(),
    }
    upsertStockCount(next)
    if (!editing) setNextId((id) => id + 1)
    setSaving(false)
    closeForm()
  }
  const removeCount = (item: StockCountRow) => {
    if (!window.confirm(`Delete stock count ${item.referenceNo}?`)) return
    if (item.sourceId) deleteStockCount(item.sourceId)
    else setItems((current) => current.filter((row) => row.id !== item.id))
  }

  const changePeriod = (preset: TransferPeriodPreset) => {
    setPeriodPreset(preset)
    if (preset !== 'custom') {
      const range = transferPeriodRange(preset)
      setPeriodStart(range.start)
      setPeriodEnd(range.end)
    }
  }
  const changePeriodStart = (value: string) => { setPeriodPreset('custom'); setPeriodStart(value) }
  const changePeriodEnd = (value: string) => { setPeriodPreset('custom'); setPeriodEnd(value) }

  const countCell = (item: StockCountRow, key: CountColumnKey) => {
    if (key === 'date') {
      const parts = adjustmentDateParts(item.date)
      return <><span className="block">{parts.date}</span>{parts.time && <span className="block">{parts.time}</span>}</>
    }
    if (key === 'referenceNo') return <span className="inline-flex rounded-md border px-2 py-0.5 font-mono text-xs" style={{ borderColor: INPUT_BORDER, background: isDark ? '#22272e' : '#f8fafc', color: TEXT_MUTED }}>{item.referenceNo}</span>
    if (key === 'location') return item.location
    if (key === 'products') return String(item.lines.length)
    if (key === 'variances') return String(item.lines.filter((line) => line.countedQty !== line.systemQty).length)
    if (key === 'varianceValue') return countVarianceMoney(item.varianceValue)
    if (key === 'notes') return item.notes || '—'
    return item.addedBy || '—'
  }

  return (
    <div id="inv-stock-counts" className="w-full" style={{ color: TEXT }}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: BLUE }}>Inventory control</p>
          <h1 className="mt-1 text-3xl font-bold leading-tight md:text-[32px]" style={{ color: isDark ? '#f8fafc' : '#000000' }}>Stock Count</h1>
          <p className="mt-1 text-sm md:text-[15px]" style={{ color: TEXT_MUTED }}>Run stocktakes, record counted quantities, and review variances per location.</p>
        </div>
        <div className="w-full rounded-xl border p-3 shadow-sm sm:w-auto sm:min-w-[430px]" style={{ background: CARD_BG, borderColor: CARD_BORDER }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-lg" style={{ background: isDark ? '#172554' : '#dbeafe', color: isDark ? '#93c5fd' : BLUE }}>
                <CalendarDays className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: TEXT_MUTED }}>Dashboard period</p>
                <p className="mt-0.5 text-sm font-semibold" style={{ color: periodInvalid ? '#dc2626' : TEXT }}>{periodLabel}</p>
              </div>
            </div>
            <Select value={periodPreset} onChange={(event) => changePeriod(event.target.value as TransferPeriodPreset)} className="h-[38px] w-full text-sm sm:w-[150px]" aria-label="Dashboard period preset">
              <option value="today">Today</option>
              <option value="last7">Last 7 days</option>
              <option value="thisMonth">This month</option>
              <option value="custom">Custom range</option>
            </Select>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold" style={{ color: TEXT_MUTED }}>
              From
              <DatePicker value={periodStart} onChange={changePeriodStart} max={periodEnd || undefined} className="mt-1 w-full" aria-label="Dashboard period start date" />
            </label>
            <label className="text-xs font-semibold" style={{ color: TEXT_MUTED }}>
              To
              <DatePicker value={periodEnd} onChange={changePeriodEnd} min={periodStart || undefined} className="mt-1 w-full" aria-label="Dashboard period end date" />
            </label>
          </div>
          {periodInvalid && <p className="mt-2 text-xs font-medium text-red-600">The end date must be on or after the start date.</p>}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {countStats.map((stat) => (
          <div key={stat.label} className="rounded-xl border p-4 shadow-sm" style={{ background: CARD_BG, borderColor: CARD_BORDER }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: TEXT_MUTED }}>{stat.label}</p>
                <p className="mt-2 text-2xl font-semibold" style={{ color: TEXT }}>{stat.value}</p>
                <p className="mt-1 text-xs" style={{ color: TEXT_MUTED }}>{stat.hint}</p>
              </div>
              <span className="grid size-9 place-items-center rounded-lg" style={{ background: isDark ? '#29313a' : '#f1f5f9', color: stat.color }}>{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl shadow-sm" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
        <div className="p-5 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5" style={{ borderColor: CARD_BORDER }}>
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ background: isDark ? '#172554' : '#dbeafe', color: isDark ? '#93c5fd' : BLUE }}>
                <ClipboardList className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-xl font-semibold md:text-[24px]" style={{ color: isDark ? '#bfdbfe' : '#16325c' }}>All stock counts</h2>
                <p className="mt-1 text-sm" style={{ color: TEXT_MUTED }}>Review stocktakes and variances across your business locations.</p>
              </div>
            </div>
            <button type="button" onClick={openAdd} className="btn rounded-full font-semibold text-white shadow-sm transition hover:brightness-110" style={{ background: 'linear-gradient(135deg, #4f38e8, #347ff0)' }}>
              <CirclePlus className="size-5" aria-hidden />
              Add count
            </button>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: TEXT }}>
              <span>Show</span>
              <Select value={String(showEntries)} onChange={(event) => { setShowEntries(Number(event.target.value)); setPage(1) }} className="w-24" aria-label="Entries per page">
                <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
              </Select>
              <span>entries</span>
              <div className="ml-2 flex flex-wrap items-center gap-2">
                <InvToolbarIconButton label="Export CSV" onClick={handleCsv} disabled={busy !== ''}>
                  {done === 'csv' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <Download className="size-4" aria-hidden />}
                </InvToolbarIconButton>
                <InvToolbarIconButton label="Export Excel" onClick={() => void handleExcel()} disabled={busy !== ''}>
                  {done === 'excel' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <FileSpreadsheet className="size-4" aria-hidden />}
                </InvToolbarIconButton>
                <InvToolbarIconButton label="Print" onClick={handlePrint} disabled={busy !== ''}>
                  {done === 'print' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <Printer className="size-4" aria-hidden />}
                </InvToolbarIconButton>
                <div className="relative">
                  <InvToolbarIconButton label="Column Visibility" onClick={(event) => { event.stopPropagation(); setColumnsOpen((open) => !open) }}>
                    <Columns3 className="size-4" aria-hidden />
                  </InvToolbarIconButton>
                  {columnsOpen && (
                    <div className="absolute left-0 top-full z-40 mt-2 w-64 rounded-lg border p-3 shadow-xl" style={{ background: CARD_BG, borderColor: CARD_BORDER }} onClick={(event) => event.stopPropagation()}>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>Show columns</p>
                      {STOCK_COUNT_COLUMNS.map((column) => (
                        <label key={column.key} className="flex cursor-pointer items-center gap-2 py-1.5 text-sm" style={{ color: TEXT }}>
                          <input type="checkbox" checked={visibleColumns[column.key]} onChange={(event) => setVisibleColumns((current) => ({ ...current, [column.key]: event.target.checked }))} className="size-4 accent-blue-600" />
                          {column.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <label htmlFor="stock-counts-search" className="shrink-0 text-sm font-semibold" style={{ color: TEXT }}>Search</label>
              <div className="search-field w-full sm:w-[250px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
                <input id="stock-counts-search" type="search" value={q} onChange={(event) => { setQ(event.target.value); setPage(1) }} placeholder="Search counts..." aria-label="Search stock counts" autoComplete="off" className="w-full" style={{ color: TEXT }} />
                {q && <button type="button" onClick={() => { setQ(''); setPage(1) }} aria-label="Clear stock count search" className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md" style={{ color: TEXT_MUTED }}><X className="size-4" aria-hidden /></button>}
              </div>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-xl border" style={{ borderColor: PANEL_BORDER, background: CARD_BG }}>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[1420px] border-collapse text-sm">
              <thead>
                <tr style={{ background: TABLE_HEAD_BG }}>
                  <th className="w-[190px] border-r px-3 py-3 text-left font-bold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}>Action</th>
                  {STOCK_COUNT_COLUMNS.map((column) => visibleColumns[column.key] && (
                    <th key={column.key} className="border-r px-3 py-3 text-left font-bold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort(column.key)} className="inline-flex items-center gap-2 text-left font-bold">
                        {column.label}
                        <SortUpDownIcon active={sortKey === column.key} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((item, index) => {
                  const zebra = index % 2 === 0
                  return (
                    <tr key={item.id} className="transition-colors" style={{ background: zebra ? TABLE_ROW_ALT : CARD_BG, color: TEXT }} onMouseEnter={(event) => { event.currentTarget.style.background = isDark ? '#2b313b' : '#f1f5f9' }} onMouseLeave={(event) => { event.currentTarget.style.background = zebra ? TABLE_ROW_ALT : CARD_BG }}>
                      <td className="border-r px-3 py-3.5 align-middle" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}>
                        <div className="flex flex-wrap items-center gap-2">
                          <CatalogueActionButton label="View" onClick={() => setViewing(item)} style={{ background: 'transparent', border: `1px solid ${PURPLE}`, color: PURPLE }}>
                            <Eye className="size-4" aria-hidden />
                          </CatalogueActionButton>
                          <CatalogueActionButton label="Edit" onClick={() => openEdit(item)} style={{ background: 'transparent', border: `1px solid ${BLUE}`, color: BLUE }}>
                            <Pencil className="size-4" aria-hidden />
                          </CatalogueActionButton>
                          <CatalogueActionButton label="Delete" onClick={() => removeCount(item)} style={{ background: 'transparent', border: `1px solid ${RED}`, color: RED }}>
                            <TrashIcon className="size-4" aria-hidden />
                          </CatalogueActionButton>
                        </div>
                      </td>
                      {STOCK_COUNT_COLUMNS.map((column) => visibleColumns[column.key] && <td key={column.key} className="border-r px-3 py-3.5 align-middle" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}>{countCell(item, column.key)}</td>)}
                    </tr>
                  )
                })}
                {paged.length === 0 && <tr><td colSpan={visibleCount} className="px-4 py-12 text-center" style={{ color: TEXT_MUTED, background: CARD_BG }}><ClipboardList className="mx-auto size-8 opacity-50" aria-hidden /><p className="mt-3 font-semibold" style={{ color: TEXT }}>No stock counts found</p><p className="mt-1 text-sm">Try a different search or add a stock count.</p></td></tr>}
              </tbody>
            </table>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm" style={{ color: TEXT }}>
            <span>{filtered.length === 0 ? 'No entries' : `Showing ${startIdx} to ${endIdx} of ${filtered.length} entries`}</span>
            <div className="flex items-center">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="btn rounded-r-none font-semibold disabled:cursor-not-allowed disabled:opacity-50" style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}><ChevronLeft className="size-4" aria-hidden /> Previous</button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <button type="button" key={number} onClick={() => setPage(number)} className={cn('btn rounded-none font-semibold -ml-px', number === page && 'text-white')} style={number === page ? { background: '#337ab7', border: '1px solid #337ab7', color: '#ffffff' } : { background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}>{number}</button>)}
              <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="btn rounded-l-none font-semibold -ml-px disabled:cursor-not-allowed disabled:opacity-50" style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}>Next <ChevronRight className="size-4" aria-hidden /></button>
            </div>
          </div>
        </div>
      </section>

      <div data-stock-counts-print aria-hidden style={{ position: 'fixed', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
        <style>{`@media print { html, body { background: #fff !important; color: #000 !important; } body * { visibility: hidden !important; } [data-stock-counts-print], [data-stock-counts-print] * { visibility: visible !important; } [data-stock-counts-print] { position: absolute !important; left: 0 !important; top: 0 !important; width: auto !important; height: auto !important; overflow: visible !important; display: block !important; padding: 24px !important; color: #000 !important; background: #fff !important; } [data-stock-counts-print] table { width: 100%; border-collapse: collapse; margin-top: 12px; } [data-stock-counts-print] th, [data-stock-counts-print] td { border: 1px solid #666; padding: 6px 8px; font-size: 11px; text-align: left; } [data-stock-counts-print] h1 { font-size: 20px; margin: 0 0 4px; } }`}</style>
        <h1>Stock Counts</h1>
        <div>Printed {new Date().toLocaleString()} · FitPro Gym App</div>
        <table><thead><tr><th>#</th>{STOCK_COUNT_COLUMNS.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{filtered.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td>{adjustmentDateLabel(item.date)}</td><td>{item.referenceNo}</td><td>{item.location}</td><td>{item.lines.length}</td><td>{item.lines.filter((line) => line.countedQty !== line.systemQty).length}</td><td>{countVarianceMoney(item.varianceValue)}</td><td>{item.notes || '—'}</td><td>{item.addedBy || '—'}</td></tr>)}</tbody></table>
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `Stock Count ${viewing.referenceNo}` : 'Stock Count'} variant="perfex" size="lg" footer={<button type="button" onClick={() => setViewing(null)} className="btn font-semibold" style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}>Close</button>}>
        {viewing && (
          <div className="text-sm" style={{ color: TEXT }}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[
              ['Date', adjustmentDateLabel(viewing.date)], ['Reference No', viewing.referenceNo], ['Location', viewing.location],
              ['Products counted', String(viewing.lines.length)], ['Variances', String(viewing.lines.filter((line) => line.countedQty !== line.systemQty).length)],
              ['Variance value', countVarianceMoney(viewing.varianceValue)], ['Notes', viewing.notes || 'No notes added'], ['Added By', viewing.addedBy || '—'],
            ].map(([label, value]) => <div key={label} className="rounded-lg border p-4" style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}><p className="text-xs font-semibold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>{label}</p><p className="mt-1 font-semibold" style={{ color: TEXT }}>{value}</p></div>)}</div>
            {viewing.lines.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-lg border" style={{ borderColor: PANEL_BORDER }}>
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr style={{ background: TABLE_HEAD_BG, color: TEXT }}>
                      <th className="px-3 py-2.5 text-left font-bold">Product</th>
                      <th className="px-3 py-2.5 text-center font-bold">System Qty</th>
                      <th className="px-3 py-2.5 text-center font-bold">Counted Qty</th>
                      <th className="px-3 py-2.5 text-center font-bold">Difference</th>
                      <th className="px-3 py-2.5 text-right font-bold">Unit Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewing.lines.map((line) => {
                      const diff = line.countedQty - line.systemQty
                      return (
                        <tr key={line.itemId} style={{ borderTop: `1px solid ${PANEL_BORDER}` }}>
                          <td className="px-3 py-2.5 font-semibold" style={{ color: TEXT }}>{line.name}</td>
                          <td className="px-3 py-2.5 text-center tabular-nums">{line.systemQty}</td>
                          <td className="px-3 py-2.5 text-center tabular-nums">{line.countedQty}</td>
                          <td className="px-3 py-2.5 text-center font-semibold tabular-nums" style={{ color: diff === 0 ? TEXT_MUTED : diff > 0 ? '#059669' : RED }}>{diff > 0 ? `+${diff}` : diff}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{adjustmentMoney(line.unitPrice)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={formOpen} onClose={closeForm} title={editing ? 'Edit Stock Count' : 'Add Stock Count'} variant="perfex" size="xl">
        <div className="text-sm" style={{ color: TEXT }}>
          {/* Card 1 — details */}
          <div className="mb-4 rounded-xl border p-4" style={{ background: CARD_BG, borderColor: CARD_BORDER }}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-bold" style={{ color: TEXT }}>Business Location:<span className="text-red-500">*</span></label>
                <Select value={form.location} onChange={(event) => setFormValue('location', event.target.value)} className="h-11 w-full text-sm" aria-label="Stock count business location" aria-invalid={!!form.errors.location}>
                  <option value="">Please Select</option>
                  {locations.map((location) => <option key={location} value={location}>{location}</option>)}
                </Select>
                {form.errors.location && <p className="mt-1 text-xs text-red-500">{form.errors.location}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold" style={{ color: TEXT }}>Reference No:</label>
                <input value={form.referenceNo} onChange={(event) => setFormValue('referenceNo', event.target.value)} aria-label="Stock count reference number" className="h-11 w-full rounded-lg px-3 text-sm" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold" style={{ color: TEXT }}>Date:<span className="text-red-500">*</span></label>
                <DatePicker value={form.date} onChange={(value) => setFormValue('date', value)} className="w-full" aria-label="Stock count date" />
                {form.errors.date && <p className="mt-1 text-xs text-red-500">{form.errors.date}</p>}
              </div>
            </div>
          </div>

          {/* Card 2 — products */}
          <div className="mb-4 rounded-xl border p-4" style={{ background: CARD_BG, borderColor: CARD_BORDER }}>
            <div className="relative mx-auto mb-4 max-w-2xl">
              <div className="flex items-stretch overflow-hidden rounded-lg border" style={{ borderColor: INPUT_BORDER, background: INPUT_BG }}>
                <span className="grid w-11 place-items-center" style={{ color: TEXT_MUTED }}><Search className="size-4" /></span>
                <input
                  value={countProductQuery}
                  onChange={(event) => { setCountProductQuery(event.target.value); setCountProductOpen(true) }}
                  onFocus={() => setCountProductOpen(true)}
                  onBlur={() => window.setTimeout(() => setCountProductOpen(false), 150)}
                  placeholder="Search products for stock count"
                  aria-label="Search products for stock count"
                  className="h-11 w-full px-2 text-sm focus:outline-none"
                  style={{ background: 'transparent', color: TEXT }}
                />
              </div>
              {countProductOpen && countProductMatches.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border shadow-2xl" style={{ background: CARD_BG, borderColor: CARD_BORDER }}>
                  {countProductMatches.map((item) => (
                    <button key={item.id} type="button" onMouseDown={(event) => { event.preventDefault(); addCountLine(item) }} className="flex w-full items-center justify-between gap-3 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-lime/10" style={{ borderColor: PANEL_BORDER }}>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold" style={{ color: TEXT }}>{item.name}</span>
                        <span className="text-xs" style={{ color: TEXT_MUTED }}>{item.sku} · {item.quantity} {item.unit} in stock</span>
                      </span>
                      <span className="shrink-0 text-sm font-bold" style={{ color: TEXT }}>{adjustmentMoney(item.sellPrice)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr style={{ color: TEXT }}>
                    <th className="w-[30%] px-3 py-2.5 text-left font-bold">Product</th>
                    <th className="px-3 py-2.5 text-center font-bold">System Qty</th>
                    <th className="px-3 py-2.5 text-center font-bold">Counted Qty</th>
                    <th className="px-3 py-2.5 text-center font-bold">Difference</th>
                    <th className="px-3 py-2.5 text-center font-bold">Unit Price</th>
                    <th className="w-12 px-3 py-2.5 text-center font-bold"><Trash2 className="mx-auto size-4" aria-label="Remove product" /></th>
                  </tr>
                </thead>
                <tbody>
                  {form.lines.map((line, index) => {
                    const system = Math.max(0, Number(line.systemQty) || 0)
                    const counted = Math.max(0, Number(line.countedQty) || 0)
                    const diff = counted - system
                    return (
                      <tr key={line.itemId} style={{ borderTop: `1px solid ${PANEL_BORDER}` }}>
                        <td className="px-3 py-2.5 font-semibold" style={{ color: TEXT }}>{line.name}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums" style={{ color: TEXT }}>{system}</td>
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="number" min="0" step="1"
                            value={line.countedQty}
                            onChange={(event) => updateCountLine(line.itemId, { countedQty: event.target.value })}
                            aria-label={`Counted quantity for ${line.name}`}
                            className="h-10 w-24 rounded-lg px-2 text-center text-sm"
                            style={{ background: INPUT_BG, border: `1px solid ${form.errors[`lineCount${index}`] ? RED : INPUT_BORDER}`, color: TEXT }}
                          />
                          {form.errors[`lineCount${index}`] && <p className="mt-1 text-xs text-red-500">{form.errors[`lineCount${index}`]}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold tabular-nums" style={{ color: diff === 0 ? TEXT_MUTED : diff > 0 ? '#059669' : RED }}>{diff > 0 ? `+${diff}` : diff}</td>
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="number" min="0" step="0.01"
                            value={line.unitPrice}
                            onChange={(event) => updateCountLine(line.itemId, { unitPrice: event.target.value })}
                            aria-label={`Unit price for ${line.name}`}
                            className="h-10 w-28 rounded-lg px-2 text-center text-sm"
                            style={{ background: INPUT_BG, border: `1px solid ${form.errors[`linePrice${index}`] ? RED : INPUT_BORDER}`, color: TEXT }}
                          />
                          {form.errors[`linePrice${index}`] && <p className="mt-1 text-xs text-red-500">{form.errors[`linePrice${index}`]}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button type="button" onClick={() => removeCountLine(line.itemId)} aria-label={`Remove ${line.name}`} className="grid size-8 place-items-center rounded-lg text-mist transition hover:bg-rose-500/10" style={{ color: RED }}>
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {!form.lines.length && (
                    <tr style={{ borderTop: `1px solid ${PANEL_BORDER}` }}>
                      <td colSpan={6} className="px-3 py-6 text-center text-sm" style={{ color: TEXT_MUTED }}>
                        {form.errors.lines ? <span className="text-red-500">{form.errors.lines}</span> : 'Search a product above to add it to this count.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-right text-sm font-bold" style={{ color: TEXT }}>Variance value: <span className="tabular-nums">{countVarianceMoney(countVarianceValue)}</span></p>
          </div>

          {/* Card 3 — notes, save */}
          <div className="rounded-xl border p-4" style={{ background: CARD_BG, borderColor: CARD_BORDER }}>
            <div>
              <label className="mb-1.5 block text-sm font-bold" style={{ color: TEXT }}>Notes</label>
              <textarea value={form.notes} onChange={(event) => setFormValue('notes', event.target.value)} rows={3} placeholder="Notes" aria-label="Stock count notes" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT }} />
            </div>
            <div className="mt-4 flex justify-center">
              <button type="button" onClick={() => void saveCount()} disabled={saving} className="btn min-w-[130px] rounded-xl px-8 py-3 text-base font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60" style={{ background: PURPLE, borderColor: PURPLE }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

type StockAlertStatus = 'Out of stock' | 'Low stock' | 'Monitoring' | 'Paused'

type StockAlertRow = {
  id: string
  productId: string
  productName: string
  sku: string
  location: string
  currentStock: number
  alertQuantity: number
  unit: string
  status: StockAlertStatus
  notes: string
}

type StockAlertForm = {
  productId: string
  location: string
  alertQuantity: string
  status: 'Active' | 'Paused'
  notes: string
  errors: Record<string, string>
}

type StockAlertColumnKey = 'product' | 'sku' | 'location' | 'currentStock' | 'alertQuantity' | 'unit' | 'status'
type StockAlertSortKey = StockAlertColumnKey

const stockAlertStatus = (quantity: number, threshold: number, active: boolean): StockAlertStatus => {
  if (!active) return 'Paused'
  if (quantity <= 0) return 'Out of stock'
  if (quantity <= threshold) return 'Low stock'
  return 'Monitoring'
}

const stockAlertToRow = (item: StockAlert, branches: { id: string; name: string }[]): StockAlertRow => ({
  id: item.id,
  productId: item.itemId,
  productName: item.productName,
  sku: item.sku,
  location: branches.find((branch) => branch.id === item.branchId)?.name || item.location || item.branchId || 'Company-wide',
  currentStock: item.currentStock,
  alertQuantity: item.alertQuantity,
  unit: item.unit,
  status: item.status,
  notes: '',
})

const emptyStockAlertForm = (inventory: InventoryItem[], productId = inventory[0]?.id || ''): StockAlertForm => {
  const product = inventory.find((item) => item.id === productId)
  return {
    productId,
    location: 'Igracesoft GH',
    alertQuantity: product ? String(product.reorderPoint) : '',
    status: 'Active',
    notes: '',
    errors: {},
  }
}

const STOCK_ALERT_COLUMNS: { key: StockAlertColumnKey; label: string }[] = [
  { key: 'product', label: 'Product' },
  { key: 'sku', label: 'SKU' },
  { key: 'location', label: 'Location' },
  { key: 'currentStock', label: 'Current Stock' },
  { key: 'alertQuantity', label: 'Alert Quantity' },
  { key: 'unit', label: 'Unit' },
  { key: 'status', label: 'Status' },
]

export function StockAlerts() {
  const { inventory, branches, activeBranchId, activeCompanyId, stockAlerts, upsertStockAlert, deleteStockAlert } = useApp()
  const contextItems = useMemo(() => stockAlerts.map((item) => stockAlertToRow(item, branches)), [branches, stockAlerts])
  const [items, setItems] = useState<StockAlertRow[]>(() => contextItems)
  const [nextId, setNextId] = useState(() => Math.max(0, ...contextItems.map((item) => Number(item.id.match(/\d+/)?.[0] || 0))) + 1)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | StockAlertStatus>('all')
  const [showEntries, setShowEntries] = useState(25)
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<StockAlertSortKey>('status')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Record<StockAlertColumnKey, boolean>>({
    product: true, sku: true, location: true, currentStock: true,
    alertQuantity: true, unit: true, status: true,
  })
  const [form, setForm] = useState<StockAlertForm>(() => emptyStockAlertForm(inventory))
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<StockAlertRow | null>(null)
  const [viewing, setViewing] = useState<StockAlertRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')
  const [done, setDone] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')

  useEffect(() => {
    setItems(contextItems)
    setPage(1)
  }, [contextItems])

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!columnsOpen) return
    const close = () => setColumnsOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [columnsOpen])

  const locations = useMemo(() => branches.filter((branch) => branch.status !== 'inactive' && (!activeCompanyId || branch.companyId === activeCompanyId)).map((branch) => branch.name).sort(), [activeCompanyId, branches])
  const selectedProduct = inventory.find((item) => item.id === form.productId)
  const activeAlerts = items.filter((item) => item.status !== 'Paused')
  const outOfStockCount = activeAlerts.filter((item) => item.status === 'Out of stock').length
  const lowStockCount = activeAlerts.filter((item) => item.status === 'Low stock').length
  const monitoringCount = activeAlerts.filter((item) => item.status === 'Monitoring').length
  const alertStats = [
    { label: 'Active alerts', value: String(activeAlerts.length), hint: 'current stock warnings', color: '#2563eb', icon: <AlertCircle className="size-4" aria-hidden /> },
    { label: 'Out of stock', value: String(outOfStockCount), hint: 'requires immediate action', color: '#e11d48', icon: <Package className="size-4" aria-hidden /> },
    { label: 'Low stock', value: String(lowStockCount), hint: 'below alert quantity', color: '#d97706', icon: <AlertCircle className="size-4" aria-hidden /> },
    { label: 'Monitoring', value: String(monitoringCount), hint: 'thresholds configured', color: '#059669', icon: <CheckCircle2 className="size-4" aria-hidden /> },
  ]

  const toggleSort = (key: StockAlertSortKey) => {
    if (sortKey === key) setSortDir((direction) => direction === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    let list = items
    if (query) {
      list = list.filter((item) => [item.productName, item.sku, item.location, item.unit, item.status, item.notes]
        .some((value) => value.toLowerCase().includes(query)))
    }
    if (statusFilter !== 'all') list = list.filter((item) => item.status === statusFilter)
    return [...list].sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      if (sortKey === 'product') { av = a.productName; bv = b.productName }
      else if (sortKey === 'sku') { av = a.sku; bv = b.sku }
      else if (sortKey === 'location') { av = a.location; bv = b.location }
      else if (sortKey === 'currentStock') { av = a.currentStock; bv = b.currentStock }
      else if (sortKey === 'alertQuantity') { av = a.alertQuantity; bv = b.alertQuantity }
      else if (sortKey === 'unit') { av = a.unit; bv = b.unit }
      else { av = a.status; bv = b.status }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [items, q, sortKey, sortDir, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / showEntries))
  const paged = filtered.slice((page - 1) * showEntries, page * showEntries)
  const startIdx = filtered.length === 0 ? 0 : (page - 1) * showEntries + 1
  const endIdx = Math.min(page * showEntries, filtered.length)
  const visibleCount = Object.values(visibleColumns).filter(Boolean).length + 1

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const CARD_BG = isDark ? '#1b1f24' : '#ffffff'
  const CARD_BORDER = isDark ? '#2d333a' : '#e0e7ef'
  const PANEL_BG = isDark ? '#20252c' : '#f8fafc'
  const PANEL_BORDER = isDark ? '#363c44' : '#e5e7eb'
  const TABLE_HEAD_BG = isDark ? '#2a313b' : '#fbfbfb'
  const TABLE_ROW_ALT = isDark ? '#1f242b' : '#fafafa'
  const TEXT = isDark ? '#e5e7eb' : '#0f172a'
  const TEXT_MUTED = isDark ? '#9aa3ad' : '#64748b'
  const INPUT_BG = isDark ? '#14171c' : '#ffffff'
  const INPUT_BORDER = isDark ? '#49515c' : '#cbd5e1'
  const BLUE = '#2563eb'
  const PURPLE = '#4f00e6'
  const RED = '#ff3b4f'

  const statusStyle = (status: StockAlertStatus) => status === 'Out of stock'
    ? { background: isDark ? '#3b0a0a' : '#fef2f2', borderColor: isDark ? '#7f1d1d' : '#fecaca', color: isDark ? '#fca5a5' : '#b91c1c' }
    : status === 'Low stock'
      ? { background: isDark ? '#422006' : '#fffbeb', borderColor: isDark ? '#92400e' : '#fde68a', color: isDark ? '#fcd34d' : '#b45309' }
      : status === 'Monitoring'
        ? { background: isDark ? '#123522' : '#f0fdf4', borderColor: isDark ? '#276749' : '#bbf7d0', color: isDark ? '#86efac' : '#166534' }
        : { background: isDark ? '#2d333a' : '#f1f5f9', borderColor: isDark ? '#4b5563' : '#cbd5e1', color: TEXT_MUTED }

  const flashDone = (which: 'csv' | 'excel' | 'print' | 'pdf') => {
    setDone(which)
    window.setTimeout(() => setDone(''), 1500)
  }
  const handlePrint = () => {
    setBusy('print')
    window.setTimeout(() => { window.print(); setBusy(''); flashDone('print') }, 150)
  }
  const handlePdf = () => {
    setBusy('pdf')
    window.setTimeout(() => { window.print(); setBusy(''); flashDone('pdf') }, 150)
  }
  const handleCsv = () => {
    setBusy('csv')
    const headers = ['#', 'Product', 'SKU', 'Location', 'Current Stock', 'Alert Quantity', 'Unit', 'Status']
    const rows = filtered.map((item, index) => [String(index + 1), item.productName, item.sku, item.location, String(item.currentStock), String(item.alertQuantity), item.unit, item.status])
    const csv = [headers, ...rows].map((row) => row.map((cell) => {
      const value = String(cell ?? '').replace(/"/g, '""')
      return /[",\n]/.test(value) ? `"${value}"` : value
    }).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'stock-alerts.csv'; document.body.appendChild(anchor); anchor.click(); anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setBusy(''); flashDone('csv')
  }
  const handleExcel = async () => {
    setBusy('excel')
    const rows = filtered.map((item, index) => ({
      '#': index + 1, Product: item.productName, SKU: item.sku, Location: item.location,
      'Current Stock': item.currentStock, 'Alert Quantity': item.alertQuantity, Unit: item.unit, Status: item.status,
    }))
    const ok = await exportExcel('stock-alerts', rows)
    setBusy('')
    if (ok) flashDone('excel')
  }

  const openAdd = () => {
    const activeName = branches.find((branch) => branch.id === activeBranchId)?.name || locations[0] || ''
    setEditing(null)
    setForm({ ...emptyStockAlertForm(inventory), location: activeName })
    setFormOpen(true)
  }
  const openEdit = (item: StockAlertRow) => {
    setEditing(item)
    setForm({ productId: item.productId, location: item.location, alertQuantity: String(item.alertQuantity), status: item.status === 'Paused' ? 'Paused' : 'Active', notes: item.notes, errors: {} })
    setFormOpen(true)
  }
  const closeForm = () => { setFormOpen(false); setEditing(null); setForm((current) => ({ ...current, errors: {} })) }
  const setFormValue = <K extends keyof StockAlertForm>(key: K, value: StockAlertForm[K]) => setForm((current) => ({ ...current, [key]: value, errors: { ...current.errors, [key]: '' } }))
  const changeProduct = (productId: string) => {
    const product = inventory.find((item) => item.id === productId)
    setForm((current) => ({ ...current, productId, alertQuantity: String(product?.reorderPoint ?? ''), errors: { ...current.errors, productId: '' } }))
  }

  const saveAlert = async () => {
    const errors: Record<string, string> = {}
    if (!form.productId) errors.productId = 'Select a product.'
    if (!form.location) errors.location = 'Select a location.'
    const threshold = Number(form.alertQuantity)
    if (!Number.isFinite(threshold) || threshold < 0) errors.alertQuantity = 'Enter a valid threshold.'
    if (Object.keys(errors).length) { setForm((current) => ({ ...current, errors })); return }
    const product = inventory.find((item) => item.id === form.productId)
    if (!product) { setForm((current) => ({ ...current, errors: { productId: 'Select a valid product.' } })); return }

    setSaving(true)
    await new Promise((resolve) => window.setTimeout(resolve, 180))
    const branch = branches.find((candidate) => candidate.name === form.location)
    const next: StockAlert = {
      id: editing?.id || `alert_${nextId}`,
      companyId: activeCompanyId,
      branchId: branch?.id || activeBranchId,
      itemId: product.id,
      productName: product.name,
      sku: product.sku,
      location: form.location,
      currentStock: product.quantity,
      alertQuantity: Math.round(threshold * 100) / 100,
      unit: product.unit,
      status: stockAlertStatus(product.quantity, threshold, form.status === 'Active'),
      active: form.status === 'Active',
      createdAt: editing ? new Date().toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    upsertStockAlert(next)
    if (!editing) setNextId((id) => id + 1)
    setSaving(false)
    closeForm()
  }
  const removeAlert = (item: StockAlertRow) => {
    if (!window.confirm(`Delete stock alert for ${item.productName}?`)) return
    deleteStockAlert(item.id)
  }

  return (
    <div id="inv-stock-alerts" className="w-full" style={{ color: TEXT }}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: BLUE }}>Inventory control</p>
          <h1 className="mt-1 text-3xl font-bold leading-tight md:text-[32px]" style={{ color: isDark ? '#f8fafc' : '#000000' }}>Stock Alerts</h1>
          <p className="mt-1 text-sm md:text-[15px]" style={{ color: TEXT_MUTED }}>Monitor products that need replenishment before they interrupt daily operations.</p>
        </div>
        <span className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ background: CARD_BG, borderColor: CARD_BORDER, color: TEXT_MUTED }}>
          {activeAlerts.length} active {activeAlerts.length === 1 ? 'alert' : 'alerts'}
        </span>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {alertStats.map((stat) => (
          <div key={stat.label} className="rounded-xl border p-4 shadow-sm" style={{ background: CARD_BG, borderColor: CARD_BORDER }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: TEXT_MUTED }}>{stat.label}</p>
                <p className="mt-2 text-2xl font-semibold" style={{ color: TEXT }}>{stat.value}</p>
                <p className="mt-1 text-xs" style={{ color: TEXT_MUTED }}>{stat.hint}</p>
              </div>
              <span className="grid size-9 place-items-center rounded-lg" style={{ background: isDark ? '#29313a' : '#f1f5f9', color: stat.color }}>{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl shadow-sm" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
        <div className="p-5 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5" style={{ borderColor: CARD_BORDER }}>
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ background: isDark ? '#3b2513' : '#ffedd5', color: isDark ? '#fdba74' : '#ea580c' }}>
                <AlertCircle className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-xl font-semibold md:text-[24px]" style={{ color: isDark ? '#bfdbfe' : '#16325c' }}>All stock alerts</h2>
                <p className="mt-1 text-sm" style={{ color: TEXT_MUTED }}>Keep replenishment thresholds clear across your business locations.</p>
              </div>
            </div>
            <button type="button" onClick={openAdd} className="btn rounded-full font-semibold text-white shadow-sm transition hover:brightness-110" style={{ background: 'linear-gradient(135deg, #4f38e8, #347ff0)' }}>
              <CirclePlus className="size-5" aria-hidden />
              Add alert
            </button>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: TEXT }}>
              <span>Show</span>
              <Select value={String(showEntries)} onChange={(event) => { setShowEntries(Number(event.target.value)); setPage(1) }} className="w-24" aria-label="Entries per page">
                <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
              </Select>
              <span>entries</span>
              <Select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as 'all' | StockAlertStatus); setPage(1) }} className="ml-2 w-40" aria-label="Filter stock alerts by status">
                <option value="all">All statuses</option><option value="Out of stock">Out of stock</option><option value="Low stock">Low stock</option><option value="Monitoring">Monitoring</option><option value="Paused">Paused</option>
              </Select>
              <div className="ml-2 flex flex-wrap items-center gap-2">
                <InvToolbarIconButton label="Export CSV" onClick={handleCsv} disabled={busy !== ''}>
                  {done === 'csv' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <Download className="size-4" aria-hidden />}
                </InvToolbarIconButton>
                <InvToolbarIconButton label="Export Excel" onClick={() => void handleExcel()} disabled={busy !== ''}>
                  {done === 'excel' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <FileSpreadsheet className="size-4" aria-hidden />}
                </InvToolbarIconButton>
                <InvToolbarIconButton label="Print" onClick={handlePrint} disabled={busy !== ''}>
                  {done === 'print' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <Printer className="size-4" aria-hidden />}
                </InvToolbarIconButton>
                <div className="relative">
                  <InvToolbarIconButton label="Column Visibility" onClick={(event) => { event.stopPropagation(); setColumnsOpen((open) => !open) }}>
                    <Columns3 className="size-4" aria-hidden />
                  </InvToolbarIconButton>
                  {columnsOpen && (
                    <div className="absolute left-0 top-full z-40 mt-2 w-64 rounded-lg border p-3 shadow-xl" style={{ background: CARD_BG, borderColor: CARD_BORDER }} onClick={(event) => event.stopPropagation()}>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>Show columns</p>
                      {(['product', 'sku', 'location', 'currentStock', 'alertQuantity', 'unit', 'status'] as StockAlertColumnKey[]).map((key) => {
                        const label = STOCK_ALERT_COLUMNS.find((column) => column.key === key)?.label || key
                        return <label key={key} className="flex cursor-pointer items-center gap-2 py-1.5 text-sm" style={{ color: TEXT }}><input type="checkbox" checked={visibleColumns[key]} onChange={(event) => setVisibleColumns((current) => ({ ...current, [key]: event.target.checked }))} className="size-4 accent-blue-600" />{label}</label>
                      })}
                    </div>
                  )}
                </div>
                <InvToolbarIconButton label="Export PDF" onClick={handlePdf} disabled={busy !== ''}>
                  {done === 'pdf' ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : <FileText className="size-4" aria-hidden />}
                </InvToolbarIconButton>
              </div>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <label htmlFor="stock-alerts-search" className="shrink-0 text-sm font-semibold" style={{ color: TEXT }}>Search</label>
              <div className="search-field w-full sm:w-[250px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
                <input id="stock-alerts-search" type="search" value={q} onChange={(event) => { setQ(event.target.value); setPage(1) }} placeholder="Search alerts..." aria-label="Search stock alerts" autoComplete="off" className="w-full" style={{ color: TEXT }} />
                {q && <button type="button" onClick={() => { setQ(''); setPage(1) }} aria-label="Clear stock alert search" className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md" style={{ color: TEXT_MUTED }}><X className="size-4" aria-hidden /></button>}
              </div>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-xl border" style={{ borderColor: PANEL_BORDER, background: CARD_BG }}>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-sm">
              <thead>
                <tr style={{ background: TABLE_HEAD_BG }}>
                  <th className="w-[150px] border-r px-3 py-3 text-left font-bold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}>Action</th>
                  {STOCK_ALERT_COLUMNS.map((column) => visibleColumns[column.key] && (
                    <th key={column.key} className="border-r px-3 py-3 text-left font-bold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}>
                      <button type="button" onClick={() => toggleSort(column.key)} className="inline-flex items-center gap-2 text-left font-bold">{column.label}<SortUpDownIcon active={sortKey === column.key} /></button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((item, index) => {
                  const zebra = index % 2 === 0
                  const ratio = Math.max(0, Math.min(100, Math.round((item.currentStock / Math.max(1, item.alertQuantity)) * 100)))
                  const barColor = item.currentStock <= 0 ? '#ef4444' : item.currentStock <= item.alertQuantity ? '#f59e0b' : '#10b981'
                  const chipStyle = { borderColor: INPUT_BORDER, background: isDark ? '#22272e' : '#f8fafc', color: TEXT_MUTED }
                  return (
                    <tr key={item.id} className="transition-colors" style={{ background: zebra ? TABLE_ROW_ALT : CARD_BG, color: TEXT }} onMouseEnter={(event) => { event.currentTarget.style.background = isDark ? '#2b313b' : '#f1f5f9' }} onMouseLeave={(event) => { event.currentTarget.style.background = zebra ? TABLE_ROW_ALT : CARD_BG }}>
                      <td className="border-r px-3 py-3.5 align-middle" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}>
                        <div className="flex flex-nowrap items-center gap-2">
                          <CatalogueActionButton label="View" onClick={() => setViewing(item)} style={{ background: 'transparent', border: `1px solid ${PURPLE}`, color: PURPLE }}><Eye className="size-4" aria-hidden /></CatalogueActionButton>
                          <CatalogueActionButton label="Edit" onClick={() => openEdit(item)} style={{ background: 'transparent', border: `1px solid ${BLUE}`, color: BLUE }}><Pencil className="size-4" aria-hidden /></CatalogueActionButton>
                          <CatalogueActionButton label="Delete" onClick={() => removeAlert(item)} style={{ background: 'transparent', border: `1px solid ${RED}`, color: RED }}><TrashIcon className="size-4" aria-hidden /></CatalogueActionButton>
                        </div>
                      </td>
                      {visibleColumns.product && <td className="border-r px-3 py-3.5 align-middle font-semibold" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}>{item.productName}</td>}
                      {visibleColumns.sku && <td className="border-r px-3 py-3.5 align-middle" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}><span className="inline-flex rounded-md border px-2 py-0.5 font-mono text-xs" style={chipStyle}>{item.sku}</span></td>}
                      {visibleColumns.location && <td className="border-r px-3 py-3.5 align-middle" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}>{item.location}</td>}
                      {visibleColumns.currentStock && (
                        <td className="border-r px-3 py-3.5 align-middle" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}>
                          <span className="font-semibold tabular-nums" style={{ color: barColor }}>{item.currentStock}</span>
                          <span className="ml-1.5 text-xs" style={{ color: TEXT_MUTED }}>{item.unit}</span>
                          <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full" style={{ background: isDark ? '#2d333a' : '#e2e8f0' }} role="img" aria-label={`Stock level ${item.currentStock} of ${item.alertQuantity} alert quantity`}>
                            <div className="h-full rounded-full" style={{ width: `${ratio}%`, background: barColor }} />
                          </div>
                        </td>
                      )}
                      {visibleColumns.alertQuantity && <td className="border-r px-3 py-3.5 align-middle font-semibold tabular-nums" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}`, color: TEXT_MUTED }}>{item.alertQuantity}</td>}
                      {visibleColumns.unit && <td className="border-r px-3 py-3.5 align-middle" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}><span className="inline-flex rounded-md border px-2 py-0.5 text-xs" style={chipStyle}>{item.unit}</span></td>}
                      {visibleColumns.status && <td className="border-r px-3 py-3.5 align-middle" style={{ borderBottom: `1px solid ${PANEL_BORDER}`, borderRight: `1px solid ${PANEL_BORDER}` }}><span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold" style={statusStyle(item.status)}><span className="size-1.5 rounded-full" style={{ background: 'currentColor' }} aria-hidden />{item.status}</span></td>}
                    </tr>
                  )
                })}
                {paged.length === 0 && <tr><td colSpan={visibleCount} className="px-4 py-12 text-center" style={{ color: TEXT_MUTED, background: CARD_BG }}><AlertCircle className="mx-auto size-8 opacity-50" aria-hidden /><p className="mt-3 font-semibold" style={{ color: TEXT }}>No stock alerts found</p><p className="mt-1 text-sm">Try a different filter or configure a new stock alert.</p></td></tr>}
              </tbody>
            </table>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm" style={{ color: TEXT }}>
            <span>{filtered.length === 0 ? 'No entries' : `Showing ${startIdx} to ${endIdx} of ${filtered.length} entries`}</span>
            <div className="flex items-center">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="btn rounded-r-none font-semibold disabled:cursor-not-allowed disabled:opacity-50" style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}><ChevronLeft className="size-4" aria-hidden /> Previous</button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <button type="button" key={number} onClick={() => setPage(number)} className={cn('btn rounded-none font-semibold -ml-px', number === page && 'text-white')} style={number === page ? { background: BLUE, border: `1px solid ${BLUE}`, color: '#ffffff' } : { background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}>{number}</button>)}
              <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="btn rounded-l-none font-semibold -ml-px disabled:cursor-not-allowed disabled:opacity-50" style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}>Next <ChevronRight className="size-4" aria-hidden /></button>
            </div>
          </div>
        </div>
      </section>

      <div data-stock-alerts-print aria-hidden style={{ position: 'fixed', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
        <style>{`@media print { html, body { background: #fff !important; color: #000 !important; } body * { visibility: hidden !important; } [data-stock-alerts-print], [data-stock-alerts-print] * { visibility: visible !important; } [data-stock-alerts-print] { position: absolute !important; left: 0 !important; top: 0 !important; width: auto !important; height: auto !important; overflow: visible !important; display: block !important; padding: 24px !important; color: #000 !important; background: #fff !important; } [data-stock-alerts-print] table { width: 100%; border-collapse: collapse; margin-top: 12px; } [data-stock-alerts-print] th, [data-stock-alerts-print] td { border: 1px solid #666; padding: 6px 8px; font-size: 11px; text-align: left; } [data-stock-alerts-print] h1 { font-size: 20px; margin: 0 0 4px; } }`}</style>
        <h1>Stock Alerts</h1>
        <div>Printed {new Date().toLocaleString()} · FitPro Gym App</div>
        <table><thead><tr><th>#</th>{STOCK_ALERT_COLUMNS.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{filtered.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td>{item.productName}</td><td>{item.sku}</td><td>{item.location}</td><td>{item.currentStock}</td><td>{item.alertQuantity}</td><td>{item.unit}</td><td>{item.status}</td></tr>)}</tbody></table>
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `Stock Alert · ${viewing.productName}` : 'Stock Alert'} variant="perfex" size="lg" footer={<button type="button" onClick={() => setViewing(null)} className="btn font-semibold" style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}>Close</button>}>
        {viewing && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[
          ['Product', viewing.productName], ['SKU', viewing.sku], ['Location', viewing.location], ['Unit', viewing.unit], ['Current Stock', String(viewing.currentStock)], ['Alert Quantity', String(viewing.alertQuantity)], ['Status', viewing.status], ['Notes', viewing.notes || 'No notes added'],
        ].map(([label, value]) => <div key={label} className="rounded-lg border p-4" style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}><p className="text-xs font-semibold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>{label}</p><p className="mt-1 font-semibold" style={{ color: TEXT }}>{value}</p></div>)}</div>}
      </Modal>

      <Modal open={formOpen} onClose={closeForm} title={editing ? 'Edit Stock Alert' : 'Add Stock Alert'} variant="perfex" size="lg" footer={(
        <>
          <button type="button" onClick={closeForm} className="btn font-semibold" style={{ background: CARD_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_MUTED }}>Cancel</button>
          <button type="button" onClick={() => void saveAlert()} disabled={saving} className="btn font-semibold text-white disabled:opacity-60" style={{ background: BLUE, border: `1px solid ${BLUE}` }}>{saving ? 'Saving…' : 'Save alert'}</button>
        </>
      )}>
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border p-4" style={{ background: isDark ? '#3b2513' : '#fff7ed', borderColor: isDark ? '#9a3412' : '#fed7aa' }}>
            <span className="grid size-10 shrink-0 place-items-center rounded-lg" style={{ background: isDark ? '#7c2d12' : '#ffedd5', color: isDark ? '#fdba74' : '#ea580c' }}><AlertCircle className="size-5" aria-hidden /></span>
            <div><p className="font-semibold" style={{ color: isDark ? '#fed7aa' : '#7c2d12' }}>Configure a replenishment alert</p><p className="mt-1 text-sm" style={{ color: isDark ? '#fdba74' : '#9a3412' }}>Choose a product and threshold to know when stock needs attention.</p></div>
          </div>

          <section className="rounded-xl border p-4 sm:p-5" style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}>
            <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ background: isDark ? '#172554' : '#dbeafe', color: isDark ? '#93c5fd' : BLUE }}><Package className="size-4" aria-hidden /></span><div><h4 className="text-sm font-bold" style={{ color: TEXT }}>Alert setup</h4><p className="mt-0.5 text-xs" style={{ color: TEXT_MUTED }}>Set the item, location, and notification state.</p></div></div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>Product <span className="text-red-500">*</span></label><Select value={form.productId} onChange={(event) => changeProduct(event.target.value)} placeholder="Select product" className="w-full" aria-label="Stock alert product" aria-invalid={!!form.errors.productId}>{inventory.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</Select>{form.errors.productId && <p className="mt-1 text-xs text-red-500">{form.errors.productId}</p>}</div>
              <div><label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>Location <span className="text-red-500">*</span></label><Select value={form.location} onChange={(event) => setFormValue('location', event.target.value)} placeholder="Select location" className="w-full" aria-label="Stock alert location" aria-invalid={!!form.errors.location}>{locations.map((location) => <option key={location} value={location}>{location}</option>)}</Select>{form.errors.location && <p className="mt-1 text-xs text-red-500">{form.errors.location}</p>}</div>
              <div><label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>Alert status</label><Select value={form.status} onChange={(event) => setFormValue('status', event.target.value as 'Active' | 'Paused')} className="w-full" aria-label="Stock alert status"><option value="Active">Active</option><option value="Paused">Paused</option></Select></div>
            </div>
          </section>

          <section className="rounded-xl border p-4 sm:p-5" style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}>
            <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ background: isDark ? '#123522' : '#dcfce7', color: isDark ? '#86efac' : '#059669' }}><CheckCircle2 className="size-4" aria-hidden /></span><div><h4 className="text-sm font-bold" style={{ color: TEXT }}>Threshold details</h4><p className="mt-0.5 text-xs" style={{ color: TEXT_MUTED }}>Compare the current balance with the point that should trigger a warning.</p></div></div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>Current stock</label><div className="field flex w-full items-center justify-between" style={{ background: isDark ? '#20252c' : '#eef2f7', borderColor: PANEL_BORDER, color: TEXT }}><span className="font-semibold">{selectedProduct?.quantity ?? '—'}</span><span className="text-xs" style={{ color: TEXT_MUTED }}>{selectedProduct?.unit || 'units'}</span></div></div>
              <div><label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>Alert when stock is at or below <span className="text-red-500">*</span></label><input type="number" min="0" step="0.01" value={form.alertQuantity} onChange={(event) => setFormValue('alertQuantity', event.target.value)} placeholder="e.g. 10" className="field w-full" style={{ background: INPUT_BG, borderColor: form.errors.alertQuantity ? RED : INPUT_BORDER, color: TEXT }} />{form.errors.alertQuantity && <p className="mt-1 text-xs text-red-500">{form.errors.alertQuantity}</p>}</div>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs" style={{ background: isDark ? '#172554' : '#eff6ff', borderColor: isDark ? '#1d4ed8' : '#bfdbfe', color: isDark ? '#bfdbfe' : '#1d4ed8' }}><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /><span>The alert becomes Low stock or Out of stock automatically from the current quantity.</span></div>
          </section>

          <section className="rounded-xl border p-4 sm:p-5" style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}>
            <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ background: isDark ? '#2d1f63' : '#ede9fe', color: isDark ? '#c4b5fd' : PURPLE }}><FileText className="size-4" aria-hidden /></span><div><h4 className="text-sm font-bold" style={{ color: TEXT }}>Notes</h4><p className="mt-0.5 text-xs" style={{ color: TEXT_MUTED }}>Add optional context for the person managing replenishment.</p></div></div>
            <textarea value={form.notes} onChange={(event) => setFormValue('notes', event.target.value)} rows={3} placeholder="e.g. Prioritise this item for the next supplier order" className="field mt-4 w-full resize-y px-3 py-2" style={{ background: INPUT_BG, borderColor: INPUT_BORDER, color: TEXT }} />
          </section>
        </div>
      </Modal>
    </div>
  )
}

export function InventoryReports() { return <InventoryPlaceholder title="Inventory Reports" description="Stock valuation, movement, slow movers and reorder reports." /> }
