import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Printer, FileText, FileSpreadsheet, Pencil, ChevronLeft, ChevronRight, ChevronDown,
  Menu, Check, Search as SearchIcon, Filter, Package, Hourglass, PlusCircle,
} from 'lucide-react'
import { Select } from '../../components/ui'
import { cn } from '../../lib/utils'
import { exportExcel } from '../../lib/export'
import { useApp } from '../../context/AppContext'
import { branchSettingsFor, DEFAULT_BRANCH_TAXES } from '../../lib/branchSettings'
import {
  SEED_INV_CATEGORIES, SEED_INV_BRANDS, SEED_INV_UNITS,
} from './inventory/invSeed'
import {
  loadCategories, loadBrands, loadUnits,
} from './inventory/invStorage'
import { ProductFormModal, type ProductFormValues } from './inventory/ProductFormModal'

// ---------------------------------------------------------------------------
// Products & Services — main Perfex CRM list page per screenshot.
// Contains: Filters card, All Products / Stock Report tabs, DataTables-style
// toolbar, product table with checkboxes, bulk-action bar, Previous/Next pagination.
// ---------------------------------------------------------------------------
type Product = {
  id: number
  image: string | null
  name: string
  type: 'Single' | 'Variable' | 'Combo' | 'Service'
  location: string
  purchasePrice: number | [number, number]
  sellingPrice: number | [number, number]
  stock: number
  unit: string
  category: string
  brand: string
  tax: string
  sku: string
  notForSelling: boolean
  active: boolean
}

const GHS = 'GH\u20B5'

const fmtMoney = (v: number | [number, number]) => {
  if (Array.isArray(v)) return `${GHS} ${v[0].toFixed(2)} - ${GHS} ${v[1].toFixed(2)}`
  return `${GHS} ${v.toFixed(2)}`
}

const SEED_PRODUCTS: Product[] = [
  {
    id: 1,
    image: null,
    name: 'Cold Water',
    type: 'Single',
    location: 'Igracesoft GH',
    purchasePrice: 90.0,
    sellingPrice: 112.5,
    stock: 116.0,
    unit: 'Pieces',
    category: 'Alkline',
    brand: 'Golden',
    tax: '',
    sku: '0002',
    notForSelling: false,
    active: true,
  },
  {
    id: 2,
    image: null,
    name: 'Voltic Water',
    type: 'Variable',
    location: 'Igracesoft GH',
    purchasePrice: [40.0, 80.0],
    sellingPrice: [50.0, 100.0],
    stock: 463.0,
    unit: 'Pieces',
    category: 'Alkline',
    brand: 'Golden',
    tax: '',
    sku: '0001',
    notForSelling: false,
    active: true,
  },
]

export function ProductsList() {
  const navigate = useNavigate()
  const { branches, branchSettings, activeBranchId } = useApp()
  const [items, setItems] = useState<Product[]>(SEED_PRODUCTS)
  const [productModal, setProductModal] = useState<{ open: boolean; editing: Product | null }>({ open: false, editing: null })
  const [nextProductId, setNextProductId] = useState(() => Math.max(0, ...SEED_PRODUCTS.map((p) => p.id)) + 1)

  // Live option lists sourced from the Product Settings tables (loaded fresh when
  // the modal opens so any edits made via "+" quick-add buttons are reflected).
  const invCats = useMemo(() => loadCategories(), [productModal.open])
  const invBrands = useMemo(() => loadBrands(), [productModal.open])
  const invUnits = useMemo(() => loadUnits(), [productModal.open])

  const openAddProduct = () => setProductModal({ open: true, editing: null })
  const openEditProduct = (p: Product) => setProductModal({ open: true, editing: p })

  const handleSaveProduct = (v: ProductFormValues) => {
    // Always read fresh from the settings tables at save time, in case the
    // user added a new unit/brand/category via quick-add while the modal was
    // open (the invCats/Brands/Units useMemo only refreshes on modal open).
    const freshCats = loadCategories()
    const freshBrands = loadBrands()
    const freshUnits = loadUnits()
    const cat = freshCats.find((c) => c.id === v.categoryId)?.name || ''
    const brand = freshBrands.find((b) => b.id === v.brandId)?.name || ''
    const unit = freshUnits.find((u) => u.id === v.unitId)?.name || ''
    const locId = v.locations[0] || branches.find((b) => b.status !== 'inactive')?.id || ''
    const loc = branches.find((b) => b.id === locId)?.name || ''
    if (productModal.editing) {
      setItems((list) => list.map((p) => p.id === productModal.editing!.id ? {
        ...p,
        name: v.name.trim(),
        sku: v.sku.trim(),
        unit, category: cat, brand, tax: v.taxName,
        location: loc,
        notForSelling: v.notForSelling,
        purchasePrice: Number(v.purchaseExc) || p.purchasePrice,
        sellingPrice: Number(v.sellingExc) || p.sellingPrice,
      } : p))
    } else {
      const id = nextProductId
      setItems((list) => [...list, {
        id,
        image: null,
        name: v.name.trim(),
        type: v.productType,
        location: loc,
        purchasePrice: Number(v.purchaseExc) || 0,
        sellingPrice: Number(v.sellingExc) || 0,
        stock: v.manageStock ? 0 : 0,
        unit, category: cat, brand, tax: v.taxName,
        sku: v.sku.trim() || String(id).padStart(4, '0'),
        notForSelling: v.notForSelling,
        active: true,
      }])
      setNextProductId(id + 1)
    }
  }
  const [q, setQ] = useState('')
  const [showEntries, setShowEntries] = useState(25)
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState<'all' | 'stock'>('all')
  const [sortKey, setSortKey] = useState<'name' | 'sku' | 'category' | 'brand' | 'stock' | 'tax' | 'type' | 'purchase' | 'selling'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Filters
  const [fType, setFType]       = useState('all')
  const [fCat, setFCat]         = useState('all')
  const [fUnit, setFUnit]       = useState('all')
  const [fTax, setFTax]         = useState('all')
  const [fBrand, setFBrand]     = useState('all')
  const [fLoc, setFLoc]         = useState('all')
  const [fNotSelling, setFNotSelling] = useState(false)

  // Actions dropdown state
  const [openActions, setOpenActions] = useState<number | null>(null)

  const [busy, setBusy] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')
  const [done, setDone] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')

  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark')); sync()
    const obs = new MutationObserver(sync); obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  // Filter option lists sourced from the Product Settings tables (shared seeds),
  // plus any extra values present on existing products (for safety / future data).
  const catFromSettings = useMemo(() => {
    // Include all active categories — sub-categories are shown as "Parent - Child".
    return SEED_INV_CATEGORIES
      .filter((c) => c.status === 'Active')
      .map((c) => {
        if (!c.parentId) return c.name
        const parent = SEED_INV_CATEGORIES.find((p) => p.id === c.parentId)
        const leaf = parent ? c.name.replace(new RegExp(`^${parent.name}\\s*-\\s*`), '') : c.name
        return parent ? `${parent.name} - ${leaf}` : c.name
      })
      .sort()
  }, [])
  // Filter options come strictly from the active settings tables — inactive
  // items / ad-hoc product values are not offered as filter choices.
  const categories = catFromSettings

  const brandFromSettings = useMemo(
    () => SEED_INV_BRANDS.filter((b) => b.status === 'Active').map((b) => b.name).sort(),
    [])
  const brands = brandFromSettings

  const unitFromSettings = useMemo(
    () => SEED_INV_UNITS.filter((u) => u.status === 'Active').map((u) => u.name).sort(),
    [])
  const units = unitFromSettings

  // Tax rates come from the active branch's tax rates table (Branch Settings),
  // with the DEFAULT_BRANCH_TAXES as the fallback when none are configured.
  const taxFromSettings = useMemo(() => {
    const bs = branchSettingsFor(branchSettings, activeBranchId)
    const list = bs?.taxRates && bs.taxRates.length ? bs.taxRates : DEFAULT_BRANCH_TAXES
    return list
      .filter((t) => t.status === 'active')
      .map((t) => t.name)
      .sort()
  }, [branchSettings, activeBranchId])
  const taxes = taxFromSettings

  // Business locations: only active branches appear in the filter.
  const branchLocations = useMemo(
    () => branches.filter((b) => b.status !== 'inactive').map((b) => b.name).sort(),
    [branches])
  const locations = branchLocations

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    let list = items
    if (fType !== 'all') list = list.filter((p) => p.type === fType)
    if (fCat !== 'all')  list = list.filter((p) => p.category === fCat)
    if (fUnit !== 'all') list = list.filter((p) => p.unit === fUnit)
    if (fTax !== 'all')  list = list.filter((p) => p.tax === fTax)
    if (fBrand !== 'all') list = list.filter((p) => p.brand === fBrand)
    if (fLoc !== 'all')  list = list.filter((p) => p.location === fLoc)
    if (fNotSelling)     list = list.filter((p) => p.notForSelling)
    if (ql) list = list.filter((p) =>
      p.name.toLowerCase().includes(ql) ||
      p.sku.toLowerCase().includes(ql) ||
      p.category.toLowerCase().includes(ql) ||
      p.brand.toLowerCase().includes(ql))
    list = [...list].sort((a, b) => {
      const v = (x: Product): string | number => {
        switch (sortKey) {
          case 'name':     return x.name.toLowerCase()
          case 'sku':      return x.sku.toLowerCase()
          case 'category': return x.category.toLowerCase()
          case 'brand':    return x.brand.toLowerCase()
          case 'tax':      return (x.tax || '').toLowerCase()
          case 'type':     return x.type
          case 'stock':    return x.stock
          case 'purchase': return Array.isArray(x.purchasePrice) ? x.purchasePrice[0] : x.purchasePrice
          case 'selling':  return Array.isArray(x.sellingPrice) ? x.sellingPrice[0] : x.sellingPrice
          default: return ''
        }
      }
      const av = v(a), bv = v(b)
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [items, q, sortKey, sortDir, fType, fCat, fUnit, fTax, fBrand, fLoc, fNotSelling])

  const totalPages = Math.max(1, Math.ceil(filtered.length / showEntries))
  const paged = filtered.slice((page - 1) * showEntries, page * showEntries)
  const startIdx = filtered.length === 0 ? 0 : (page - 1) * showEntries + 1
  const endIdx = Math.min(page * showEntries, filtered.length)

  const flashDone = (w: typeof busy) => { setDone(w as any); window.setTimeout(() => setDone(''), 1500) }
  const handlePrint = () => { setBusy('print'); window.setTimeout(() => { window.print(); setBusy(''); flashDone('print') }, 150) }
  const handlePdf   = () => { setBusy('pdf');   window.setTimeout(() => { window.print(); setBusy(''); flashDone('pdf') }, 150) }
  const handleCsv   = () => {
    setBusy('csv')
    const headers = ['#', 'Product', 'Type', 'Category', 'Brand', 'SKU', 'Unit Purchase Price', 'Selling Price', 'Current stock', 'Unit', 'Location', 'Tax']
    const rows = filtered.map((p, i) => [
      String(i + 1), p.name, p.type, p.category, p.brand, p.sku,
      Array.isArray(p.purchasePrice) ? `${p.purchasePrice[0]} - ${p.purchasePrice[1]}` : String(p.purchasePrice),
      Array.isArray(p.sellingPrice)  ? `${p.sellingPrice[0]} - ${p.sellingPrice[1]}`   : String(p.sellingPrice),
      String(p.stock), p.unit, p.location, p.tax || '',
    ])
    const csv = [headers, ...rows].map((r) => r.map((c) => {
      const s = String(c ?? '').replace(/"/g, '""'); return /[",\n]/.test(s) ? `"${s}"` : s
    }).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'products.csv'; document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    setBusy(''); flashDone('csv')
  }
  const handleExcel = async () => {
    setBusy('excel')
    const rows = items.map((p, i) => ({
      '#': i + 1, Product: p.name, Type: p.type, Category: p.category, Brand: p.brand, SKU: p.sku,
      'Unit Purchase Price': Array.isArray(p.purchasePrice) ? `${p.purchasePrice[0]}-${p.purchasePrice[1]}` : p.purchasePrice,
      'Selling Price': Array.isArray(p.sellingPrice) ? `${p.sellingPrice[0]}-${p.sellingPrice[1]}` : p.sellingPrice,
      'Current stock': p.stock, Unit: p.unit, Location: p.location, Tax: p.tax || '',
    }))
    const ok = await exportExcel('products', rows); setBusy(''); if (ok) flashDone('excel')
  }

  const toggleOne = (id: number) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const toggleAll = () => {
    const pageIds = paged.map((p) => p.id)
    const allOn = pageIds.every((id) => selected.has(id))
    setSelected((s) => { const n = new Set(s); if (allOn) pageIds.forEach((id) => n.delete(id)); else pageIds.forEach((id) => n.add(id)); return n })
  }
  const clearSel = () => setSelected(new Set())

  // Close actions dropdown when clicking outside
  useEffect(() => {
    const h = () => setOpenActions(null)
    if (openActions !== null) window.addEventListener('click', h)
    return () => window.removeEventListener('click', h)
  }, [openActions])

  // Theme colours
  const CARD_BG        = isDark ? '#1b1f24' : '#ffffff'
  const CARD_BD        = isDark ? '#2d333a' : '#e5e7eb'
  const TEXT           = isDark ? '#e5e7eb' : '#111827'
  const TEXT_MUTED     = isDark ? '#9aa3ad' : '#6b7280'
  const INPUT_BG       = isDark ? '#14171c' : '#ffffff'
  const INPUT_BD       = isDark ? '#49515c' : '#d1d5db'
  const INPUT_TEXT     = isDark ? '#e5e7eb' : '#111827'
  const TBL_HEADER_BG  = isDark ? '#20252c' : '#ffffff'
  const TBL_HEADER_TXT = isDark ? '#cbd5e1' : '#374151'
  const ROW_ALT        = isDark ? '#1f242b' : '#fafafa'
  const TOOLBAR_BD     = isDark ? '#3a424d' : '#d1d5db'
  const TOOLBAR_HOVER  = isDark ? '#263648' : '#eef2ff'
  const PAG_BD         = isDark ? '#3a424d' : '#d1d5db'
  const FILTER_BLUE    = '#86b7e3'
  const FILTER_BLUE_TXT= '#4b6f94'

  const SortIcon = ({ col, dir = 'updown' }: { col: typeof sortKey; dir?: 'updown' | 'down' }) => (
    <span className="inline-flex ml-1 text-[13px]" style={{ color: sortKey === col ? '#4b5563' : '#9ca3af' }}>
      {dir === 'down'
        ? <ChevronDown className={cn('size-3.5 inline', sortKey === col && sortDir === 'asc' && 'rotate-180')} />
        : <span className="inline-grid leading-[0] -mt-0.5"><span className="text-[8px]">▲</span><span className="text-[8px] -mt-1">▼</span></span>}
    </span>
  )

  const ToolbarBtn = ({ label, icon, onClick, disabled, busyKey, doneKey }:
    { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; busyKey: typeof busy; doneKey: typeof done }) => (
    <button onClick={onClick} disabled={disabled || busy !== ''}
      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:opacity-60"
      style={{ borderColor: TOOLBAR_BD, color: isDark ? '#cbd5e1' : '#374151', background: CARD_BG }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = TOOLBAR_HOVER }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = CARD_BG }}>
      {done === doneKey ? <Check className="size-4" style={{ color: '#10b981' }} strokeWidth={3} /> : icon}
      {label}
    </button>
  )

  const FilterSelect = ({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) => (
    <Select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full h-[36px] text-[14px]"
      style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: value === 'all' ? TEXT_MUTED : INPUT_TEXT, borderRadius: 4 }}>
      {children}
    </Select>
  )

  const allPageSelected = paged.length > 0 && paged.every((p) => selected.has(p.id))

  return (
    <>
    <div id="inv-products-list">
      {/* Breadcrumb */}
      <div className="mb-1 flex items-center gap-1 text-xs text-mist" style={{ color: TEXT_MUTED }}>
        <span className="hover:underline cursor-pointer">Inventory</span>
        <span>/</span>
        <span className="font-semibold" style={{ color: TEXT }}>Products and Services</span>
      </div>

      {/* ===== Filters card ===== */}
      <div className="rounded-2xl shadow-sm mb-5 overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${CARD_BD}` }}>
        <button onClick={() => setFiltersOpen((o) => !o)}
          className="w-full px-5 py-3 flex items-center justify-between gap-2 text-lg font-medium text-left transition"
          style={{ color: FILTER_BLUE_TXT, borderBottom: filtersOpen ? `2px solid ${FILTER_BLUE}` : 'none', background: 'transparent' }}>
          <span className="flex items-center gap-2">
            <Filter className="size-5" style={{ color: FILTER_BLUE }} />
            <span>Filters</span>
          </span>
          <ChevronDown className={cn('size-5 transition-transform', !filtersOpen && '-rotate-90')} style={{ color: FILTER_BLUE_TXT }} />
        </button>
        {filtersOpen && (
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-x-6 gap-y-4">
          <div>
            <label className="block text-[14px] font-semibold mb-1.5" style={{ color: TEXT }}>Product Type:</label>
            <FilterSelect value={fType} onChange={setFType}>
              <option value="all">All</option>
              <option value="Single">Single</option>
              <option value="Variable">Variable</option>
              <option value="Combo">Combo</option>
              <option value="Service">Service</option>
            </FilterSelect>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[14px] font-semibold" style={{ color: TEXT }}>Category:</label>
              <button type="button" title="Manage categories" onClick={() => navigate('/admin/inventory/settings/categories')}
                className="inline-flex items-center gap-1 text-[12px] font-semibold hover:underline"
                style={{ color: FILTER_BLUE_TXT }}
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}>
                <PlusCircle className="size-3.5" /> Add / Manage
              </button>
            </div>
            <FilterSelect value={fCat} onChange={setFCat}>
              <option value="all">All</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </FilterSelect>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[14px] font-semibold" style={{ color: TEXT }}>Brand:</label>
              <button type="button" title="Manage brands" onClick={() => navigate('/admin/inventory/settings/brands')}
                className="inline-flex items-center gap-1 text-[12px] font-semibold hover:underline"
                style={{ color: FILTER_BLUE_TXT }}
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}>
                <PlusCircle className="size-3.5" /> Add / Manage
              </button>
            </div>
            <FilterSelect value={fBrand} onChange={setFBrand}>
              <option value="all">All</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </FilterSelect>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[14px] font-semibold" style={{ color: TEXT }}>Unit:</label>
              <button type="button" title="Manage units" onClick={() => navigate('/admin/inventory/settings/units')}
                className="inline-flex items-center gap-1 text-[12px] font-semibold hover:underline"
                style={{ color: FILTER_BLUE_TXT }}
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}>
                <PlusCircle className="size-3.5" /> Add / Manage
              </button>
            </div>
            <FilterSelect value={fUnit} onChange={setFUnit}>
              <option value="all">All</option>
              {units.map((u) => <option key={u} value={u}>{u}</option>)}
            </FilterSelect>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[14px] font-semibold" style={{ color: TEXT }}>Tax:</label>
              <button type="button" title="Manage tax rates" onClick={() => navigate('/admin/settings/branch')}
                className="inline-flex items-center gap-1 text-[12px] font-semibold hover:underline"
                style={{ color: FILTER_BLUE_TXT }}
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}>
                <PlusCircle className="size-3.5" /> Add / Manage
              </button>
            </div>
            <FilterSelect value={fTax} onChange={setFTax}>
              <option value="all">All</option>
              {taxes.map((t) => <option key={t} value={t}>{t}</option>)}
            </FilterSelect>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[14px] font-semibold" style={{ color: TEXT }}>Business Location:</label>
              <button type="button" title="Manage branches / locations" onClick={() => navigate('/admin/settings/branch')}
                className="inline-flex items-center gap-1 text-[12px] font-semibold hover:underline"
                style={{ color: FILTER_BLUE_TXT }}
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}>
                <PlusCircle className="size-3.5" /> Add / Manage
              </button>
            </div>
            <FilterSelect value={fLoc} onChange={setFLoc}>
              <option value="all">All</option>
              {locations.map((l) => <option key={l} value={l}>{l}</option>)}
            </FilterSelect>
          </div>
          <div className="sm:col-span-2 md:col-span-3 flex items-center pt-1">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none text-[14px] font-semibold" style={{ color: TEXT }}>
              <input type="checkbox" checked={fNotSelling} onChange={(e) => setFNotSelling(e.target.checked)}
                className="size-[18px] accent-sky-500" />
              Not for selling
            </label>
          </div>
        </div>
        )}
      </div>

      {/* ===== Tab strip ===== */}
      <div className="flex items-end gap-6 border-b mb-0" style={{ borderColor: CARD_BD }}>
        <button onClick={() => setTab('all')}
          className="relative px-1 pb-2 text-[18px] font-semibold flex items-center gap-2 transition"
          style={{ color: tab === 'all' ? TEXT : TEXT_MUTED }}>
          <Package className="size-5" /> All Products
          {tab === 'all' && <span className="absolute left-0 right-0 -bottom-[2px] h-[3px] rounded-t" style={{ background: '#2980b9' }} />}
        </button>
        <button onClick={() => setTab('stock')}
          className="relative px-1 pb-2 text-[18px] font-semibold flex items-center gap-2 transition"
          style={{ color: tab === 'stock' ? TEXT : TEXT_MUTED }}>
          <Hourglass className="size-5" /> Stock Report
          {tab === 'stock' && <span className="absolute left-0 right-0 -bottom-[2px] h-[3px] rounded-t" style={{ background: '#2980b9' }} />}
        </button>
      </div>

      {/* ===== Table card ===== */}
      <div className="rounded-b-2xl shadow-sm p-5" style={{ background: CARD_BG, border: `1px solid ${CARD_BD}`, borderTop: 'none' }}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm" style={{ color: TEXT_MUTED }}>
              <span>Show</span>
              <Select value={String(showEntries)} onChange={(e) => { setShowEntries(Number(e.target.value)); setPage(1) }} className="w-20 h-[32px] text-sm">
                <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
              </Select>
              <span>entries</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 ml-2">
              <ToolbarBtn label="Export CSV" icon={<FileText className="size-4" />} onClick={handleCsv} busyKey="csv" doneKey="csv" />
              <ToolbarBtn label="Export Excel" icon={<FileSpreadsheet className="size-4" />} onClick={() => void handleExcel()} busyKey="excel" doneKey="excel" />
              <ToolbarBtn label="Print" icon={<Printer className="size-4" />} onClick={handlePrint} busyKey="print" doneKey="print" />
              <button onClick={() => {}} title="Column visibility"
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium opacity-80"
                style={{ borderColor: TOOLBAR_BD, color: isDark ? '#cbd5e1' : '#374151', background: CARD_BG }}>
                <span className="inline-grid size-4 place-items-center border rounded-sm text-[10px] font-bold" style={{ borderColor: isDark ? '#cbd5e1' : '#374151' }}>▥</span>
                Column visibility
              </button>
              <ToolbarBtn label="Export PDF" icon={<FileText className="size-4" />} onClick={handlePdf} busyKey="pdf" doneKey="pdf" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={openAddProduct} className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#3b82f6)' }}>
              <span className="text-xl leading-none font-thin">+</span> Add
            </button>
            <button className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#3b82f6)' }}>
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download Excel
            </button>
            <input type="text" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="Search ..."
              className="w-[220px] h-[38px] px-3 text-sm rounded-[2px] focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30"
              style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: INPUT_TEXT }} />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: TBL_HEADER_BG, borderBottom: `2px solid ${CARD_BD}` }}>
                <th className="w-10 px-3 py-3 text-left" style={{ borderBottom: `2px solid ${CARD_BD}` }}>
                  <input type="checkbox" checked={allPageSelected} onChange={toggleAll} className="size-[18px] accent-sky-500" />
                </th>
                <th className="px-3 py-3 text-left font-semibold w-[110px]" style={{ color: TBL_HEADER_TXT }}>Product image</th>
                <th className="px-3 py-3 text-left font-semibold w-[120px]" style={{ color: TBL_HEADER_TXT }}>Action</th>
                <th onClick={() => toggleSort('name')} className="px-3 py-3 text-left font-semibold cursor-pointer select-none" style={{ color: TBL_HEADER_TXT }}>
                  Product<SortIcon col="name" dir="down" />
                </th>
                <th className="px-3 py-3 text-left font-semibold" style={{ color: TBL_HEADER_TXT }}>
                  <span className="inline-flex items-center gap-1">Business Location
                    <span title="Business location" className="inline-grid size-[16px] place-items-center rounded-full bg-[#5bc0de] text-white text-[10px] font-bold cursor-help">i</span>
                    <SortIcon col="type" />
                  </span>
                </th>
                <th onClick={() => toggleSort('purchase')} className="px-3 py-3 text-left font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: TBL_HEADER_TXT }}>
                  Unit Purchase Price<SortIcon col="purchase" />
                </th>
                <th onClick={() => toggleSort('selling')} className="px-3 py-3 text-left font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: TBL_HEADER_TXT }}>
                  Selling Price<SortIcon col="selling" />
                </th>
                <th onClick={() => toggleSort('stock')} className="px-3 py-3 text-left font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: TBL_HEADER_TXT }}>
                  Current stock<SortIcon col="stock" />
                </th>
                <th onClick={() => toggleSort('type')} className="px-3 py-3 text-left font-semibold cursor-pointer select-none" style={{ color: TBL_HEADER_TXT }}>
                  Product Type<SortIcon col="type" />
                </th>
                <th onClick={() => toggleSort('category')} className="px-3 py-3 text-left font-semibold cursor-pointer select-none" style={{ color: TBL_HEADER_TXT }}>
                  Category<SortIcon col="category" />
                </th>
                <th onClick={() => toggleSort('brand')} className="px-3 py-3 text-left font-semibold cursor-pointer select-none" style={{ color: TBL_HEADER_TXT }}>
                  Brand<SortIcon col="brand" />
                </th>
                <th onClick={() => toggleSort('tax')} className="px-3 py-3 text-left font-semibold cursor-pointer select-none" style={{ color: TBL_HEADER_TXT }}>
                  Tax<SortIcon col="tax" />
                </th>
                <th onClick={() => toggleSort('sku')} className="px-3 py-3 text-left font-semibold cursor-pointer select-none" style={{ color: TBL_HEADER_TXT }}>
                  SKU<SortIcon col="sku" />
                </th>
              </tr>
            </thead>
            <tbody>
              {tab === 'all' && paged.map((p, idx) => {
                const alt = idx % 2 === 0
                return (
                  <tr key={p.id} style={{ background: alt ? ROW_ALT : CARD_BG, color: TEXT, borderBottom: `1px solid ${CARD_BD}` }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = isDark ? '#263648' : '#eef2ff' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = alt ? ROW_ALT : CARD_BG }}>
                    <td className="px-3 py-3 align-top">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} className="size-[18px] accent-sky-500" />
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="size-[48px] rounded grid place-items-center" style={{ background: isDark ? '#2a3039' : '#eef0f3', color: TEXT_MUTED }}>
                        <svg className="size-6 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="m21 17-5-5-9 9" /></svg>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top relative">
                      <button onClick={(e) => { e.stopPropagation(); setOpenActions(openActions === p.id ? null : p.id) }}
                        className="inline-flex items-center gap-1 rounded-full border-2 px-3 py-1 text-sm font-semibold transition"
                        style={{ borderColor: '#33c0f0', color: '#0288c9' }}>
                        Actions <ChevronDown className="size-3.5" />
                      </button>
                      {openActions === p.id && (
                        <div className="absolute z-50 mt-1 min-w-[170px] rounded-md shadow-lg border py-1 text-sm"
                          style={{ background: CARD_BG, borderColor: CARD_BD, color: TEXT }}
                          onClick={(e) => e.stopPropagation()}>
                          {(['View details', 'Edit', 'Add/Edit group prices', 'Labels', 'Delete'] as const).map((act) => (
                            <button key={act} className="block w-full text-left px-3 py-1.5 hover:bg-sky-50 dark:hover:bg-sky-950"
                              onClick={() => {
                                setOpenActions(null)
                                if (act === 'Edit') openEditProduct(p)
                              }}>{act}</button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top font-medium">{p.name}</td>
                    <td className="px-3 py-3 align-top">{p.location}</td>
                    <td className="px-3 py-3 align-top whitespace-nowrap">{fmtMoney(p.purchasePrice)}</td>
                    <td className="px-3 py-3 align-top whitespace-nowrap">{fmtMoney(p.sellingPrice)}</td>
                    <td className="px-3 py-3 align-top whitespace-nowrap">{p.stock.toFixed(p.stock % 1 ? 2 : 0)} {p.unit}</td>
                    <td className="px-3 py-3 align-top">{p.type}</td>
                    <td className="px-3 py-3 align-top">{p.category}</td>
                    <td className="px-3 py-3 align-top">{p.brand}</td>
                    <td className="px-3 py-3 align-top">{p.tax || '—'}</td>
                    <td className="px-3 py-3 align-top font-mono text-sm">{p.sku}</td>
                  </tr>
                )
              })}
              {tab === 'all' && paged.length === 0 && (
                <tr><td colSpan={13} className="px-3 py-10 text-center text-sm" style={{ color: TEXT_MUTED }}>No products found.</td></tr>
              )}
              {tab === 'stock' && (
                <tr><td colSpan={13} className="px-3 py-10 text-center text-sm" style={{ color: TEXT_MUTED }}>Stock Report view coming soon.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition hover:bg-red-50 dark:hover:bg-red-950"
              style={{ borderColor: '#ef4444', color: '#ef4444' }}>Delete Selected</button>
            <button className="inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition hover:bg-teal-50 dark:hover:bg-teal-950"
              style={{ borderColor: '#14b8a6', color: '#0d9488' }}>Add to location</button>
            <button className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#444] px-4 py-1.5 text-sm font-semibold transition hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ color: TEXT, borderColor: isDark ? '#555' : '#444' }}>Remove from location</button>
            <button className="inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition hover:bg-amber-50 dark:hover:bg-amber-950"
              style={{ borderColor: '#f59e0b', color: '#d97706' }}>Deactivate Selected</button>
            <span title="Bulk actions apply to all selected rows."
              className="inline-grid size-[18px] place-items-center rounded-full bg-[#5bc0de] text-white text-[11px] font-bold cursor-help ml-1">i</span>
          </div>
        )}

        {/* Bottom pagination */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[15px]" style={{ color: TEXT_MUTED }}>
          <span>{filtered.length === 0 ? 'No entries' : `Showing ${startIdx} to ${endIdx} of ${filtered.length} entries`}</span>
          <div className="flex items-center gap-0">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="rounded-l-md border px-4 py-1.5 text-base font-medium transition hover:bg-gray-50 dark:hover:bg-[#263648] disabled:opacity-50"
              style={{ borderColor: PAG_BD, background: CARD_BG, color: TEXT }}>Previous</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button key={n} onClick={() => setPage(n)}
                className="border-t border-b px-4 py-1.5 text-base font-semibold transition -ml-px"
                style={n === page
                  ? { background: '#2980b9', borderColor: '#2980b9', color: '#fff' }
                  : { background: CARD_BG, borderColor: PAG_BD, color: TEXT }}
                onMouseEnter={(e) => { if (n !== page) (e.currentTarget as HTMLButtonElement).style.background = isDark ? '#263648' : '#f3f4f6' }}
                onMouseLeave={(e) => { if (n !== page) (e.currentTarget as HTMLButtonElement).style.background = CARD_BG }}>{n}</button>
            ))}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="rounded-r-md border px-4 py-1.5 text-base font-medium transition hover:bg-gray-50 dark:hover:bg-[#263648] disabled:opacity-50 -ml-px"
              style={{ borderColor: PAG_BD, background: CARD_BG, color: TEXT }}>Next</button>
          </div>
        </div>
      </div>

      {/* Print-only block */}
      <div data-inv-products-print aria-hidden
        style={{ position: 'fixed', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
        <style>{`
          @media print {
            html, body { background: #fff !important; color: #000 !important; }
            body * { visibility: hidden !important; }
            [data-inv-products-print], [data-inv-products-print] * { visibility: visible !important; }
            [data-inv-products-print] { position: absolute !important; left: 0 !important; top: 0 !important; width: auto !important; height: auto !important; overflow: visible !important; display: block !important; padding: 24px !important; color: #000 !important; background: #fff !important; }
            [data-inv-products-print] * { color: #000 !important; background: transparent !important; }
            [data-inv-products-print] table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            [data-inv-products-print] th, [data-inv-products-print] td { border: 1px solid #666; padding: 6px 8px; font-size: 11px; text-align: left; }
            [data-inv-products-print] th { background: #dde3ec !important; color: #000 !important; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            [data-inv-products-print] h1 { font-size: 20px; margin: 0 0 4px; color: #000 !important; }
            [data-inv-products-print] .sub { font-size: 12px; color: #333 !important; margin-bottom: 8px; }
          }
        `}</style>
        <h1>Products and Services</h1>
        <div className="sub">Printed {new Date().toLocaleString()} · FitPro Gym App</div>
        <table>
          <thead>
            <tr><th>#</th><th>Product</th><th>Type</th><th>Category</th><th>Brand</th><th>SKU</th><th>Purchase</th><th>Selling</th><th>Stock</th><th>Unit</th><th>Location</th></tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id}>
                <td>{i + 1}</td><td>{p.name}</td><td>{p.type}</td><td>{p.category}</td><td>{p.brand}</td><td>{p.sku}</td>
                <td>{fmtMoney(p.purchasePrice)}</td><td>{fmtMoney(p.sellingPrice)}</td><td>{p.stock}</td><td>{p.unit}</td><td>{p.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {(() => {
      const ed = productModal.editing
      return (
    <ProductFormModal
      open={productModal.open}
      onClose={() => setProductModal({ open: false, editing: null })}
      onSave={handleSaveProduct}
      initial={ed ? {
        name: ed.name,
        sku: ed.sku,
        unitId: invUnits.find((u) => u.name === ed.unit)?.id ?? '',
        brandId: invBrands.find((b) => b.name === ed.brand)?.id ?? '',
        categoryId: invCats.find((c) => c.name === ed.category)?.id ?? '',
        taxName: ed.tax,
        notForSelling: ed.notForSelling,
        productType: ed.type,
        purchaseExc: typeof ed.purchasePrice === 'number' ? String(ed.purchasePrice) : '',
        sellingExc: typeof ed.sellingPrice === 'number' ? String(ed.sellingPrice) : '',
        locations: branches.filter((b) => b.name === ed.location).map((b) => b.id),
      } : undefined}
      categories={invCats}
      brands={invBrands}
      units={invUnits}
      taxes={taxes}
      branches={branches.filter((b) => b.status !== 'inactive')}
      products={items.map((p) => ({ id: p.id, name: p.name, sku: p.sku, purchasePrice: Array.isArray(p.purchasePrice) ? p.purchasePrice[0] : (p.purchasePrice ?? 0) }))}
    />)})()}
    </>
  )
}
export { ProductsList as Inventory }
export default ProductsList
