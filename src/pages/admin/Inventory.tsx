import { useMemo, useState, useEffect, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  Printer, FileText, FileSpreadsheet, Pencil, Barcode, Eye, Trash2, Database, History,
  CircleDollarSign, Copy, ChevronLeft, ChevronRight, ChevronDown, RotateCcw,
  Menu, Check, Search as SearchIcon, Filter, Package, Hourglass, PlusCircle,
} from 'lucide-react'
import { Modal, Select } from '../../components/ui'
import { cn } from '../../lib/utils'
import { exportExcel } from '../../lib/export'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { visibleBranches } from '../../lib/accessScope'
import { DEFAULT_PRODUCT_IMAGE } from '../../lib/image'
import type { InventoryItem } from '../../types'
import { branchSettingsFor, DEFAULT_BRANCH_TAXES } from '../../lib/branchSettings'
import {
  SEED_INV_CATEGORIES, SEED_INV_BRANDS, SEED_INV_UNITS,
} from './inventory/invSeed'
import {
  loadCategories, loadBrands, loadUnits, loadPriceGroups,
} from './inventory/invStorage'
import { ProductFormModal, type ProductFormValues } from './inventory/ProductFormModal'

// ---------------------------------------------------------------------------
// Products & Services — main Perfex CRM list page per screenshot.
// Contains: Filters card, All Products / Stock Report tabs, DataTables-style
// toolbar, product table with checkboxes, bulk-action bar, Previous/Next pagination.
// ---------------------------------------------------------------------------
type Product = {
  id: number
  sourceInventoryId?: string
  image: string | null
  name: string
  type: 'Single' | 'Variable' | 'Combo' | 'Service'
  location: string
  branchIds?: string[]
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
  variations?: ProductVariation[]
  groupPriceDefaults?: Record<number, number>
}

type ProductVariation = {
  id: string
  label: string
  defaultSellingPrice: number
  groupPriceDefaults?: Record<number, number>
}

type GroupPriceMode = 'Fixed' | 'Percentage'
type GroupPriceCell = { value: string; mode: GroupPriceMode }
type GroupPriceDraft = Record<string, Record<number, GroupPriceCell>>

type StockEvent = {
  id: number
  label: string
  quantity: number
  date: string
}

type ActionModal = 'view' | 'opening-stock' | 'stock-history' | 'group-prices' | null

const GHS = 'GH\u20B5'

/** Condense a joined location list: keep the first two names, summarize the rest. */
const condenseLocations = (loc: string): { shown: string; extra: number } => {
  const names = !loc || loc === 'Company-wide' ? (loc ? ['Company-wide'] : []) : loc.split(',').map((n) => n.trim()).filter(Boolean)
  if (names.length <= 2) return { shown: names.join(', '), extra: 0 }
  return { shown: names.slice(0, 2).join(', '), extra: names.length - 2 }
}

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
    groupPriceDefaults: { 1: 110, 2: 110 },
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
    variations: [
      { id: 'hot', label: 'Water Type - Hot (0001-1) Ibot', defaultSellingPrice: 62.5, groupPriceDefaults: { 1: 45, 2: 60 } },
      { id: 'cold', label: 'Water Type - Cold (0001-2) Ibot', defaultSellingPrice: 100, groupPriceDefaults: { 1: 45, 2: 70 } },
      { id: 'warm', label: 'Water Type - Warm (0001-3) Ibot', defaultSellingPrice: 50, groupPriceDefaults: { 1: 45, 2: 85 } },
    ],
  },
]

const numericProductId = (id: string) => {
  const digits = id.match(/\d+/)?.[0]
  const parsed = digits ? Number(digits) : 0
  return parsed || Math.abs(Array.from(id).reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) | 0, 7))
}

const displayInventoryUnit = (unit: string) => {
  const normalised = unit.trim().toLowerCase()
  if (normalised === 'pcs' || normalised === 'pc' || normalised === 'piece' || normalised === 'pieces') return 'Pieces'
  if (normalised === 'bottle' || normalised === 'bottles') return 'Bottle'
  if (normalised === 'box' || normalised === 'boxes') return 'Box'
  if (normalised === 'pack' || normalised === 'packs') return 'Pack'
  return unit
}

const inventoryToProduct = (item: InventoryItem, branches: { id: string; name: string }[]): Product => {
  const locIds = item.branchIds?.length ? item.branchIds : (item.branchId ? [item.branchId] : [])
  const locNames = locIds.map((id) => branches.find((branch) => branch.id === id)?.name || id)
  return ({
  id: numericProductId(item.id),
  sourceInventoryId: item.id,
  image: item.image || null,
  name: item.name,
  type: item.productType || 'Single',
  location: locNames.join(', ') || 'Company-wide',
  branchIds: locIds,
  purchasePrice: item.costPrice,
  sellingPrice: item.sellPrice,
  stock: item.quantity,
  unit: displayInventoryUnit(item.unit),
  category: item.category,
  brand: item.brand || '',
  tax: item.taxName || '',
  sku: item.sku,
  notForSelling: Boolean(item.notForSelling),
  active: item.active !== false,
  })
}

export function ProductsList() {
  const navigate = useNavigate()
  const { branches, branchSettings, activeBranchId, activeCompanyId, inventory, upsertInventoryItem, deleteInventoryItem } = useApp()
  const { user } = useAuth()
  const branchOptions = useMemo(() => visibleBranches(user, branches, activeCompanyId).filter((branch) => branch.status !== 'inactive'), [activeCompanyId, branches, user])
  const contextProducts = useMemo(() => inventory.map((item) => inventoryToProduct(item, branches)), [inventory, branches])
  const [items, setItems] = useState<Product[]>(() => contextProducts)
  const [productModal, setProductModal] = useState<{ open: boolean; editing: Product | null }>({ open: false, editing: null })
  const [nextProductId, setNextProductId] = useState(() => Math.max(0, ...contextProducts.map((p) => p.id), ...SEED_PRODUCTS.map((p) => p.id)) + 1)

  // The catalogue is derived from the shared inventory store. Replacing the
  // view whenever the selected branch changes keeps Products and Services in
  // lockstep with POS, purchasing, and the rest of the application.
  useEffect(() => {
    setItems(contextProducts)
    setSelected(new Set())
    setPage(1)
  }, [contextProducts])

  // Live option lists sourced from the Product Settings tables (loaded fresh when
  // the modal opens so any edits made via "+" quick-add buttons are reflected).
  const invCats = useMemo(() => {
    const settings = loadCategories()
    const known = new Set(settings.map((category) => category.name))
    const extras = Array.from(new Set(inventory.map((item) => item.category))).filter((name) => name && !known.has(name))
    return [
      ...settings,
      ...extras.map((name, index) => ({ id: -(index + 1), name, code: name.slice(0, 3).toUpperCase(), description: 'Shared inventory category', status: 'Active' as const, parentId: null })),
    ]
  }, [inventory, productModal.open])
  const invBrands = useMemo(() => {
    const settings = loadBrands()
    const known = new Set(settings.map((brand) => brand.name))
    const extras = Array.from(new Set(inventory.map((item) => item.brand || ''))).filter((name) => name && !known.has(name))
    return [
      ...settings,
      ...extras.map((name, index) => ({ id: -(index + 1), name, description: 'Shared inventory brand', status: 'Active' as const })),
    ]
  }, [inventory, productModal.open])
  const invUnits = useMemo(() => {
    const settings = loadUnits()
    const known = new Set(settings.map((unit) => unit.name))
    const extras = Array.from(new Set(inventory.map((item) => displayInventoryUnit(item.unit)))).filter((name) => name && !known.has(name))
    return [
      ...settings,
      ...extras.map((name, index) => ({ id: -(index + 1), name, shortName: name.slice(0, 3), allowDecimal: 'YES' as const, status: 'Active' as const, baseUnitId: null, multiplier: null })),
    ]
  }, [inventory, productModal.open])

  const openAddProduct = () => setProductModal({ open: true, editing: null })
  const openEditProduct = (p: Product) => setProductModal({ open: true, editing: p })

  const closeActionModal = () => {
    setActionModal(null)
    setActionProduct(null)
    setStockError('')
    setGroupPriceError('')
  }

  const openProductView = (product: Product) => {
    setActionProduct(product)
    setActionModal('view')
  }

  const openOpeningStock = (product: Product) => {
    setActionProduct(product)
    setStockValue(String(product.stock))
    setStockError('')
    setActionModal('opening-stock')
  }

  const groupPriceRowsFor = (product: Product): ProductVariation[] => {
    if (product.variations?.length) return product.variations
    const basePrice = Array.isArray(product.sellingPrice) ? product.sellingPrice[0] : product.sellingPrice
    return [{
      id: 'default',
      label: '',
      defaultSellingPrice: basePrice,
      groupPriceDefaults: product.groupPriceDefaults,
    }]
  }

  const historyFor = (product: Product): StockEvent[] => {
    const saved = stockHistory[product.id]
    if (saved?.length) return saved
    return [{
      id: product.id,
      label: 'Opening balance',
      quantity: product.stock,
      date: 'Current catalogue balance',
    }]
  }

  const openStockHistory = (product: Product) => {
    setActionProduct(product)
    setActionModal('stock-history')
  }

  const openGroupPrices = (product: Product) => {
    const groups = loadPriceGroups()
      .filter((group) => group.active)
      .sort((a, b) => {
        const priority = (name: string) => name.toLowerCase().includes('wholesale') ? 0 : name.toLowerCase().includes('best') ? 1 : 2
        return priority(a.name) - priority(b.name)
      })
    const rows = groupPriceRowsFor(product)
    const saved = groupPrices[product.id] || {}
    const basePrice = Array.isArray(product.sellingPrice) ? product.sellingPrice[0] : product.sellingPrice
    const draft = Object.fromEntries(rows.map((row) => [
      row.id,
      Object.fromEntries(groups.map((group) => [
        group.id,
        saved[row.id]?.[group.id] || {
          value: String(row.groupPriceDefaults?.[group.id] ?? product.groupPriceDefaults?.[group.id] ?? basePrice),
          mode: 'Fixed' as GroupPriceMode,
        },
      ])),
    ])) as GroupPriceDraft
    setPriceGroups(groups)
    setGroupPriceDraft(draft)
    setGroupPriceError('')
    setActionProduct(product)
    setActionModal('group-prices')
  }

  const saveOpeningStock = () => {
    if (!actionProduct) return
    const nextStock = Number(stockValue)
    if (stockValue.trim() === '' || !Number.isFinite(nextStock) || nextStock < 0) {
      setStockError('Enter a valid stock quantity of zero or more.')
      return
    }
    const roundedStock = Math.round(nextStock * 100) / 100
    const productId = actionProduct.id
    const source = actionProduct.sourceInventoryId ? inventory.find((item) => item.id === actionProduct.sourceInventoryId) : undefined
    if (source) {
      upsertInventoryItem({
        ...source,
        quantity: roundedStock,
        updatedAt: new Date().toISOString().slice(0, 10),
      })
    } else {
      setItems((list) => list.map((product) => product.id === productId ? { ...product, stock: roundedStock } : product))
    }
    setStockHistory((history) => ({
      ...history,
      [productId]: [
        ...(history[productId] || historyFor(actionProduct)),
        { id: Date.now(), label: 'Opening stock updated', quantity: roundedStock, date: new Date().toLocaleString() },
      ],
    }))
    closeActionModal()
  }

  const updateGroupPriceCell = (rowId: string, groupId: number, changes: Partial<GroupPriceCell>) => {
    setGroupPriceDraft((draft) => ({
      ...draft,
      [rowId]: {
        ...(draft[rowId] || {}),
        [groupId]: { ...(draft[rowId]?.[groupId] || { value: '', mode: 'Fixed' }), ...changes },
      },
    }))
    setGroupPriceError('')
  }

  const commitGroupPrices = () => {
    if (!actionProduct) return false
    const rows = groupPriceRowsFor(actionProduct)
    const hasInvalidPrice = rows.some((row) => priceGroups.some((group) => {
      const value = groupPriceDraft[row.id]?.[group.id]?.value?.trim() || ''
      return value === '' || !Number.isFinite(Number(value)) || Number(value) < 0
    }))
    if (hasInvalidPrice) {
      setGroupPriceError('Enter a valid non-negative price for every active price group.')
      return false
    }
    setGroupPrices((prices) => ({ ...prices, [actionProduct.id]: { ...groupPriceDraft } }))
    return true
  }

  const saveGroupPrices = () => {
    if (!commitGroupPrices()) return
    closeActionModal()
  }

  const saveGroupPricesAndOpeningStock = () => {
    const product = actionProduct
    if (!product || !commitGroupPrices()) return
    closeActionModal()
    openOpeningStock(product)
  }

  const saveGroupPricesAndAnother = () => {
    if (!commitGroupPrices()) return
    closeActionModal()
  }

  const reactivateProduct = (product: Product) => {
    const source = product.sourceInventoryId ? inventory.find((item) => item.id === product.sourceInventoryId) : undefined
    if (source) upsertInventoryItem({ ...source, active: true, updatedAt: new Date().toISOString().slice(0, 10) })
    else setItems((list) => list.map((item) => (item.id === product.id ? { ...item, active: true } : item)))
  }

  const deleteProduct = (product: Product) => {
    if (!window.confirm(`Delete “${product.name}” from the catalogue?`)) return
    if (product.sourceInventoryId) deleteInventoryItem(product.sourceInventoryId)
    else setItems((list) => list.filter((item) => item.id !== product.id))
    setSelected((current) => {
      const next = new Set(current)
      next.delete(product.id)
      return next
    })
  }

  // ---- Bulk actions (selection bar under the product table) ----

  const runBulkDelete = () => {
    const targets = items.filter((product) => selected.has(product.id))
    if (!targets.length) return
    if (!window.confirm(`Delete ${targets.length} selected product${targets.length === 1 ? '' : 's'} from the catalogue?`)) return
    targets.forEach((product) => { if (product.sourceInventoryId) deleteInventoryItem(product.sourceInventoryId) })
    // Store-backed rows disappear via the context re-sync; drop local-only ones here.
    setItems((list) => list.filter((item) => item.sourceInventoryId || !selected.has(item.id)))
    clearSel()
  }

  // Patch every selected product. Store-backed products are written through
  // upsertInventoryItem (the catalogue view re-syncs from context); local-only
  // seed rows are patched in the view list directly.
  const runBulkPatch = (itemPatch: Partial<InventoryItem> | ((product: Product) => Partial<InventoryItem>), productPatch?: (product: Product) => Partial<Product>) => {
    const targets = items.filter((product) => selected.has(product.id))
    if (!targets.length) return
    for (const product of targets) {
      const source = product.sourceInventoryId ? inventory.find((item) => item.id === product.sourceInventoryId) : undefined
      if (source) upsertInventoryItem({ ...source, ...(typeof itemPatch === 'function' ? itemPatch(product) : itemPatch), updatedAt: new Date().toISOString().slice(0, 10) })
    }
    const ids = new Set(targets.map((product) => product.id))
    setItems((list) => list.map((item) => (ids.has(item.id) && !item.sourceInventoryId && productPatch ? { ...item, ...productPatch(item) } : item)))
    clearSel()
  }

  // Adds the chosen branches to each product's existing locations (union).
  const runBulkAddToLocation = () => {
    if (!bulkLocations.length) return
    const nameOf = (id: string) => branchOptions.find((b) => b.id === id)?.name || id
    const merge = (product: Product) => {
      const ids = [...new Set([...(product.branchIds || []), ...bulkLocations])]
      return { ids, names: ids.map(nameOf).join(', ') }
    }
    runBulkPatch(
      (product) => {
        const { ids } = merge(product)
        return { branchIds: ids, branchId: ids[0] }
      },
      (product) => {
        const { ids, names } = merge(product)
        return { branchIds: ids, location: names }
      },
    )
    setBulkLocationOpen(false)
    setBulkLocations([])
    setBulkLocQuery('')
  }

  // '' = explicit "no branch" — the org stamper keeps it company-wide instead
  // of re-assigning the active branch.
  const runBulkRemoveLocation = () => runBulkPatch({ branchId: '', branchIds: [] }, () => ({ location: 'Company-wide', branchIds: [] }))

  const runBulkDeactivate = () => runBulkPatch({ active: false }, () => ({ active: false }))

  const runBulkReactivate = () => runBulkPatch({ active: true }, () => ({ active: true }))

  const duplicateProduct = (product: Product) => {
    const id = nextProductId
    const source = product.sourceInventoryId ? inventory.find((item) => item.id === product.sourceInventoryId) : undefined
    const sourceId = `inv_${id}`
    if (source) {
      upsertInventoryItem({
        ...source,
        id: sourceId,
        name: `${product.name} (Copy)`,
        sku: product.sku ? `${product.sku}-COPY` : String(id).padStart(4, '0'),
        quantity: 0,
        branchId: activeBranchId || source.branchId,
        createdAt: new Date().toISOString().slice(0, 10),
        updatedAt: new Date().toISOString().slice(0, 10),
      })
    } else {
      setItems((list) => [...list, { ...product, id, sourceInventoryId: sourceId, name: `${product.name} (Copy)`, sku: product.sku ? `${product.sku}-COPY` : String(id).padStart(4, '0'), stock: 0 }])
    }
    setNextProductId(id + 1)
  }

  const handleProductAction = (action: string, product: Product) => {
    setOpenActions(null)
    switch (action) {
      case 'Labels':
        navigate('/admin/inventory/print-labels', { state: { productId: product.id, productName: product.name } })
        break
      case 'View':
        openProductView(product)
        break
      case 'Edit':
        openEditProduct(product)
        break
      case 'Reactivate':
        reactivateProduct(product)
        break
      case 'Delete':
        deleteProduct(product)
        break
      case 'Add or edit opening stock':
        openOpeningStock(product)
        break
      case 'Product stock history':
        openStockHistory(product)
        break
      case 'Add or edit Group Prices':
        openGroupPrices(product)
        break
      case 'Duplicate Product':
        duplicateProduct(product)
        break
    }
  }

  const toggleActionMenu = (event: MouseEvent<HTMLButtonElement>, productId: number) => {
    event.stopPropagation()
    if (openActions === productId) {
      setOpenActions(null)
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const menuWidth = 285
    const menuHeight = 310
    const menuGap = 4
    const gutter = 12
    const left = Math.min(
      Math.max(gutter, rect.left),
      Math.max(gutter, window.innerWidth - menuWidth - gutter),
    )
    // Keep the menu anchored just under the button (or just above it when
    // there is not enough room below), rather than leaving a large visual gap.
    const top = window.innerHeight - rect.bottom < menuHeight && rect.top > menuHeight
      ? Math.max(gutter, rect.top - menuHeight - menuGap)
      : rect.bottom + menuGap
    setActionMenuPosition({ top, left })
    setOpenActions(productId)
  }

  const handleSaveProduct = (v: ProductFormValues) => {
    // Always read fresh from the settings tables at save time, in case the
    // user added a new unit/brand/category via quick-add while the modal was
    // open. The canonical record is written to AppContext so POS, purchasing,
    // stock management, dashboards, and this list all see the same product.
    const freshCats = loadCategories()
    const freshBrands = loadBrands()
    const freshUnits = loadUnits()
    const editing = productModal.editing
    const source = editing?.sourceInventoryId ? inventory.find((item) => item.id === editing.sourceInventoryId) : undefined
    const cat = freshCats.find((c) => c.id === v.categoryId)?.name || invCats.find((c) => c.id === v.categoryId)?.name || source?.category || 'Other'
    const brand = freshBrands.find((b) => b.id === v.brandId)?.name || invBrands.find((b) => b.id === v.brandId)?.name || source?.brand || ''
    const unit = freshUnits.find((u) => u.id === v.unitId)?.name || invUnits.find((u) => u.id === v.unitId)?.name || source?.unit || 'pcs'
    const locId = v.locations[0] || source?.branchId || activeBranchId || branches.find((b) => b.status !== 'inactive')?.id || undefined
    const now = new Date().toISOString().slice(0, 10)
    const costPrice = Number(v.purchaseExc)
    const sellPrice = Number(v.sellingExc)

    if (source) {
      upsertInventoryItem({
        ...source,
        name: v.name.trim(),
        sku: v.sku.trim() || source.sku,
        productType: v.productType,
        unit,
        category: cat,
        brand,
        taxName: v.taxName,
        notForSelling: v.notForSelling,
        active: v.active,
        branchId: locId,
        branchIds: v.locations.length ? v.locations : (locId ? [locId] : []),
        costPrice: Number.isFinite(costPrice) ? costPrice : source.costPrice,
        sellPrice: Number.isFinite(sellPrice) ? sellPrice : source.sellPrice,
        reorderPoint: Number(v.alertQuantity) || source.reorderPoint,
        image: v.imageData || undefined,
        updatedAt: now,
      })
      return
    }

    const id = nextProductId
    upsertInventoryItem({
      id: `inv_${id}`,
      name: v.name.trim(),
      productType: v.productType,
      image: v.imageData || undefined,
      sku: v.sku.trim() || String(id).padStart(4, '0'),
      category: cat,
      quantity: 0,
      reorderPoint: Number(v.alertQuantity) || 0,
      unit,
      costPrice: Number.isFinite(costPrice) ? costPrice : 0,
      sellPrice: Number.isFinite(sellPrice) ? sellPrice : 0,
      brand,
      taxName: v.taxName,
      notForSelling: v.notForSelling,
      active: v.active,
      branchId: locId,
      branchIds: v.locations.length ? v.locations : (locId ? [locId] : []),
      createdAt: now,
      updatedAt: now,
    })
    setNextProductId(id + 1)
  }
  const [q, setQ] = useState('')
  const [showEntries, setShowEntries] = useState(25)
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState<'all' | 'stock'>('all')
  const [sortKey, setSortKey] = useState<'name' | 'sku' | 'category' | 'brand' | 'stock' | 'tax' | 'type' | 'purchase' | 'selling' | 'status'>('name')
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

  // Actions dropdown state. The menu is rendered through a portal so the
  // table's horizontal-scroll wrapper cannot clip it above or below the row.
  const [openActions, setOpenActions] = useState<number | null>(null)
  const [actionMenuPosition, setActionMenuPosition] = useState({ top: 0, left: 0 })
  const [actionModal, setActionModal] = useState<ActionModal>(null)
  const [actionProduct, setActionProduct] = useState<Product | null>(null)
  const [stockValue, setStockValue] = useState('')
  const [stockError, setStockError] = useState('')
  const [stockHistory, setStockHistory] = useState<Record<number, StockEvent[]>>({})
  const [priceGroups, setPriceGroups] = useState<ReturnType<typeof loadPriceGroups>>([])
  const [groupPrices, setGroupPrices] = useState<Record<number, GroupPriceDraft>>({})
  const [groupPriceDraft, setGroupPriceDraft] = useState<GroupPriceDraft>({})
  const [groupPriceError, setGroupPriceError] = useState('')
  // Bulk 'Add to location' picker state (selection bar under the table).
  const [bulkLocationOpen, setBulkLocationOpen] = useState(false)
  const [bulkLocations, setBulkLocations] = useState<string[]>([])
  const [bulkLocQuery, setBulkLocQuery] = useState('')

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
  const filteredBulkBranches = branchOptions.filter((b) => {
    const ql = bulkLocQuery.trim().toLowerCase()
    return !ql || b.name.toLowerCase().includes(ql) || (b.city || '').toLowerCase().includes(ql)
  })

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
    if (fLoc !== 'all')  list = list.filter((p) => { const fid = branches.find((b) => b.name === fLoc)?.id; return fid ? (p.branchIds || []).includes(fid) : p.location === fLoc })
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
          case 'status':   return x.active ? 0 : 1
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
    const headers = ['#', 'Product', 'Type', 'Category', 'Brand', 'SKU', 'Unit Purchase Price', 'Selling Price', 'Current stock', 'Unit', 'Location', 'Tax', 'Status']
    const rows = filtered.map((p, i) => [
      String(i + 1), p.name, p.type, p.category, p.brand, p.sku,
      Array.isArray(p.purchasePrice) ? `${p.purchasePrice[0]} - ${p.purchasePrice[1]}` : String(p.purchasePrice),
      Array.isArray(p.sellingPrice)  ? `${p.sellingPrice[0]} - ${p.sellingPrice[1]}`   : String(p.sellingPrice),
      String(p.stock), p.unit, p.location, p.tax || '', p.active ? 'Active' : 'Inactive',
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
      'Current stock': p.stock, Unit: p.unit, Location: p.location, Tax: p.tax || '', Status: p.active ? 'Active' : 'Inactive',
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

  // A fixed portal stays above the table; close it if the viewport moves so it
  // never becomes detached from the Actions button that opened it.
  useEffect(() => {
    if (openActions === null) return
    const closeOnViewportChange = () => setOpenActions(null)
    window.addEventListener('resize', closeOnViewportChange)
    window.addEventListener('scroll', closeOnViewportChange, true)
    return () => {
      window.removeEventListener('resize', closeOnViewportChange)
      window.removeEventListener('scroll', closeOnViewportChange, true)
    }
  }, [openActions])

  // Theme colours and layout tokens
  const CARD_BG = isDark ? '#1b1f24' : '#ffffff'
  const CARD_BD = isDark ? '#2d333a' : '#e2e8f0'
  const PANEL_BG = isDark ? '#20252c' : '#f8fafc'
  const PANEL_BD = isDark ? '#363c44' : '#e5e7eb'
  const TABLE_HEAD_BG = isDark ? '#2a313b' : '#f1f5f9'
  const ROW_ALT = isDark ? '#1f242b' : '#fafafa'
  const TEXT = isDark ? '#e5e7eb' : '#0f172a'
  const TEXT_MUTED = isDark ? '#9aa3ad' : '#64748b'
  const INPUT_BG = isDark ? '#14171c' : '#ffffff'
  const INPUT_BD = isDark ? '#49515c' : '#cbd5e1'
  const INDIGO = '#4f46e5'
  const RED = '#dc2626'

  const activeFilterCount = [fType, fCat, fUnit, fTax, fBrand, fLoc].filter((value) => value !== 'all').length + (fNotSelling ? 1 : 0)
  const clearFilters = () => {
    setFType('all')
    setFCat('all')
    setFUnit('all')
    setFTax('all')
    setFBrand('all')
    setFLoc('all')
    setFNotSelling(false)
    setPage(1)
  }
  const productCount = items.length
  const stockedCount = items.filter((product) => product.stock > 0).length
  const serviceCount = items.filter((product) => product.type === 'Service').length
  const notSellingCount = items.filter((product) => product.notForSelling).length

  const TYPE_STYLES: Record<Product['type'], { background: string; borderColor: string; color: string }> = {
    Single: isDark ? { background: '#172554', borderColor: '#1d4ed8', color: '#bfdbfe' } : { background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' },
    Variable: isDark ? { background: '#312e81', borderColor: '#4338ca', color: '#c7d2fe' } : { background: '#eef2ff', borderColor: '#c7d2fe', color: '#4338ca' },
    Combo: isDark ? { background: '#3f2a14', borderColor: '#a16207', color: '#fde68a' } : { background: '#fffbeb', borderColor: '#fde68a', color: '#a16207' },
    Service: isDark ? { background: '#123522', borderColor: '#276749', color: '#86efac' } : { background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' },
  }

  const SortIcon = ({ col, dir = 'updown' }: { col: typeof sortKey; dir?: 'updown' | 'down' }) => (
    <span className="ml-1 inline-flex items-center" style={{ color: sortKey === col ? TEXT : TEXT_MUTED }} aria-hidden>
      {dir === 'down'
        ? <ChevronDown className={cn('size-4 transition-transform', sortKey !== col && 'opacity-50', sortKey === col && sortDir === 'asc' && 'rotate-180')} />
        : <span className="inline-grid leading-[0] opacity-70"><span className="text-[8px]">▲</span><span className="-mt-1 text-[8px]">▼</span></span>}
    </span>
  )

  const ToolbarBtn = ({ label, icon, onClick, busyKey, doneKey, iconOnly = false }:
    { label: string; icon: React.ReactNode; onClick: () => void; busyKey: typeof busy; doneKey: typeof done; iconOnly?: boolean }) => {
    const button = (
      <button
        type="button"
        onClick={onClick}
        disabled={busy !== ''}
        aria-label={iconOnly ? label : undefined}
        data-bs-toggle={iconOnly ? 'tooltip' : undefined}
        data-bs-placement={iconOnly ? 'top' : undefined}
        data-bs-title={iconOnly ? label : undefined}
        className="btn font-semibold disabled:cursor-wait disabled:opacity-60"
        style={{ background: CARD_BG, border: `1px solid ${INPUT_BD}`, color: TEXT_MUTED }}
      >
        {done === doneKey ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : icon}
        {!iconOnly && label}
      </button>
    )
    if (!iconOnly) return button
    return (
      <span className="group relative inline-flex">
        {button}
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

  const FilterSelect = ({ value, onChange, children }: { value: string; onChange: (next: string) => void; children: React.ReactNode }) => (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full"
      style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: value === 'all' ? TEXT_MUTED : TEXT }}
    >
      {children}
    </Select>
  )

  const allPageSelected = paged.length > 0 && paged.every((product) => selected.has(product.id))
  const actionMenuProduct = openActions === null ? null : items.find((product) => product.id === openActions) || null
  const groupPriceRows = actionProduct ? groupPriceRowsFor(actionProduct) : []

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  return (
    <>
      <div id="inv-products-list" className="w-full">
        <div
          className="overflow-hidden rounded-2xl shadow-sm"
          style={{ background: CARD_BG, border: `1px solid ${CARD_BD}` }}
        >
          <div className="border-b px-5 py-5 md:px-8 md:py-6" style={{ borderColor: CARD_BD }}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl"
                  style={{ background: isDark ? '#312e81' : '#eef2ff', color: isDark ? '#c7d2fe' : INDIGO }}
                >
                  <Package className="size-5" aria-hidden />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-[25px] font-semibold leading-tight md:text-[28px]" style={{ color: TEXT }}>
                      Products and Services
                    </h1>
                    <span
                      className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                      style={{ background: PANEL_BG, borderColor: PANEL_BD, color: TEXT_MUTED }}
                    >
                      Inventory catalogue
                    </span>
                  </div>
                  <p className="mt-1 text-sm md:text-[15px]" style={{ color: TEXT_MUTED }}>
                    Review products, services, pricing, and stock details from one organised workspace.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={openAddProduct}
                className="btn font-semibold text-white shadow-sm transition hover:brightness-110"
                style={{ background: INDIGO }}
              >
                <PlusCircle className="size-4" aria-hidden />
                Add product
              </button>
            </div>
          </div>

          <div className="p-5 md:p-8">
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'All products', value: productCount, hint: 'in your catalogue', color: INDIGO, icon: <Package className="size-4" aria-hidden /> },
                { label: 'In stock', value: stockedCount, hint: 'with stock on hand', color: '#059669', icon: <Check className="size-4" aria-hidden /> },
                { label: 'Services', value: serviceCount, hint: 'non-stock offerings', color: '#c2410c', icon: <Hourglass className="size-4" aria-hidden /> },
                { label: 'Not for selling', value: notSellingCount, hint: 'catalogue-only items', color: '#b45309', icon: <Filter className="size-4" aria-hidden /> },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border p-4" style={{ background: PANEL_BG, borderColor: PANEL_BD }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: TEXT_MUTED }}>{stat.label}</p>
                      <p className="mt-2 text-2xl font-semibold" style={{ color: TEXT }}>{stat.value}</p>
                      <p className="mt-1 text-xs" style={{ color: TEXT_MUTED }}>{stat.hint}</p>
                    </div>
                    <span className="grid size-9 place-items-center rounded-lg" style={{ background: isDark ? '#2b313b' : '#ffffff', color: stat.color }}>
                      {stat.icon}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <section className="rounded-xl border" style={{ background: PANEL_BG, borderColor: PANEL_BD }}>
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-3 border-b px-4 py-4 text-left transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                style={{ borderColor: filtersOpen ? PANEL_BD : 'transparent' }}
              >
                <span className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg" style={{ background: isDark ? '#172554' : '#dbeafe', color: isDark ? '#93c5fd' : '#2563eb' }}>
                    <Filter className="size-4" aria-hidden />
                  </span>
                  <span>
                    <span className="flex flex-wrap items-center gap-2 text-base font-semibold" style={{ color: TEXT }}>
                      Filters
                      {activeFilterCount > 0 && <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: INDIGO }}>{activeFilterCount} active</span>}
                    </span>
                    <span className="mt-0.5 block text-xs" style={{ color: TEXT_MUTED }}>Narrow the catalogue by type, category, brand, unit, tax, or location.</span>
                  </span>
                </span>
                <ChevronDown className={cn('size-5 shrink-0 transition-transform', !filtersOpen && '-rotate-90')} style={{ color: TEXT_MUTED }} aria-hidden />
              </button>
              {filtersOpen && (
                <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold" style={{ color: TEXT }}>Product type</label>
                    <FilterSelect value={fType} onChange={setFType}>
                      <option value="all">All product types</option>
                      <option value="Single">Single</option>
                      <option value="Variable">Variable</option>
                      <option value="Combo">Combo</option>
                      <option value="Service">Service</option>
                    </FilterSelect>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label className="block text-sm font-semibold" style={{ color: TEXT }}>Category</label>
                      <button type="button" title="Manage categories" onClick={() => navigate('/admin/inventory/settings/categories')} className="text-xs font-semibold hover:underline" style={{ color: INDIGO }}>
                        Add / manage
                      </button>
                    </div>
                    <FilterSelect value={fCat} onChange={setFCat}>
                      <option value="all">All categories</option>
                      {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </FilterSelect>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label className="block text-sm font-semibold" style={{ color: TEXT }}>Brand</label>
                      <button type="button" title="Manage brands" onClick={() => navigate('/admin/inventory/settings/brands')} className="text-xs font-semibold hover:underline" style={{ color: INDIGO }}>
                        Add / manage
                      </button>
                    </div>
                    <FilterSelect value={fBrand} onChange={setFBrand}>
                      <option value="all">All brands</option>
                      {brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                    </FilterSelect>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label className="block text-sm font-semibold" style={{ color: TEXT }}>Unit</label>
                      <button type="button" title="Manage units" onClick={() => navigate('/admin/inventory/settings/units')} className="text-xs font-semibold hover:underline" style={{ color: INDIGO }}>
                        Add / manage
                      </button>
                    </div>
                    <FilterSelect value={fUnit} onChange={setFUnit}>
                      <option value="all">All units</option>
                      {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                    </FilterSelect>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label className="block text-sm font-semibold" style={{ color: TEXT }}>Tax</label>
                      <button type="button" title="Manage tax rates" onClick={() => navigate('/admin/settings/branch')} className="text-xs font-semibold hover:underline" style={{ color: INDIGO }}>
                        Add / manage
                      </button>
                    </div>
                    <FilterSelect value={fTax} onChange={setFTax}>
                      <option value="all">All tax rates</option>
                      {taxes.map((tax) => <option key={tax} value={tax}>{tax}</option>)}
                    </FilterSelect>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label className="block text-sm font-semibold" style={{ color: TEXT }}>Business location</label>
                      <button type="button" title="Manage branches / locations" onClick={() => navigate('/admin/settings/branch')} className="text-xs font-semibold hover:underline" style={{ color: INDIGO }}>
                        Add / manage
                      </button>
                    </div>
                    <FilterSelect value={fLoc} onChange={setFLoc}>
                      <option value="all">All locations</option>
                      {locations.map((location) => <option key={location} value={location}>{location}</option>)}
                    </FilterSelect>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 xl:col-span-3">
                    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm font-semibold" style={{ color: TEXT }}>
                      <input type="checkbox" checked={fNotSelling} onChange={(e) => { setFNotSelling(e.target.checked); setPage(1) }} className="size-4 accent-indigo-600" />
                      Not for selling only
                    </label>
                    {activeFilterCount > 0 && (
                      <button type="button" onClick={clearFilters} className="btn font-semibold" style={{ background: 'transparent', border: `1px solid ${INPUT_BD}`, color: TEXT_MUTED }}>
                        Clear filters
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b" style={{ borderColor: CARD_BD }}>
              <div className="flex flex-wrap items-center gap-2 pb-3">
                <button
                  type="button"
                  onClick={() => setTab('all')}
                  className={cn('btn font-semibold', tab !== 'all' && 'opacity-70')}
                  style={tab === 'all' ? { background: INDIGO, border: `1px solid ${INDIGO}`, color: '#ffffff' } : { background: CARD_BG, border: `1px solid ${INPUT_BD}`, color: TEXT_MUTED }}
                >
                  <Package className="size-4" aria-hidden />
                  All products
                  <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: tab === 'all' ? 'rgb(255 255 255 / 0.18)' : PANEL_BG }}>{items.length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('stock')}
                  className={cn('btn font-semibold', tab !== 'stock' && 'opacity-70')}
                  style={tab === 'stock' ? { background: INDIGO, border: `1px solid ${INDIGO}`, color: '#ffffff' } : { background: CARD_BG, border: `1px solid ${INPUT_BD}`, color: TEXT_MUTED }}
                >
                  <Hourglass className="size-4" aria-hidden />
                  Stock report
                </button>
              </div>
              <span className="pb-3 text-sm" style={{ color: TEXT_MUTED }}>
                {tab === 'all' ? `${filtered.length} matching ${filtered.length === 1 ? 'product' : 'products'}` : 'Inventory snapshot'}
              </span>
            </div>

            <section className="mt-4 rounded-xl border p-4 md:p-5" style={{ background: PANEL_BG, borderColor: PANEL_BD }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
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
                  <div className="flex flex-wrap items-center gap-2">
                    <ToolbarBtn label="Export CSV" icon={<FileText className="size-4" aria-hidden />} onClick={handleCsv} busyKey="csv" doneKey="csv" iconOnly />
                    <ToolbarBtn label="Export Excel" icon={<FileSpreadsheet className="size-4" aria-hidden />} onClick={() => void handleExcel()} busyKey="excel" doneKey="excel" iconOnly />
                    <ToolbarBtn label="Print" icon={<Printer className="size-4" aria-hidden />} onClick={handlePrint} busyKey="print" doneKey="print" iconOnly />
                    <ToolbarBtn label="Export PDF" icon={<FileText className="size-4" aria-hidden />} onClick={handlePdf} busyKey="pdf" doneKey="pdf" iconOnly />
                  </div>
                </div>
                <div className="w-full sm:w-auto">
                  <span className="relative block w-full sm:w-[280px]">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
                    <input
                      type="search"
                      value={q}
                      onChange={(e) => { setQ(e.target.value); setPage(1) }}
                      placeholder="Search products"
                      aria-label="Search products and services"
                      className="h-[38px] w-full rounded-lg pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }}
                    />
                  </span>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-lg border" style={{ borderColor: PANEL_BD }}>
                <table className="w-full min-w-[1500px] border-collapse text-sm">
                  <thead>
                    <tr style={{ background: TABLE_HEAD_BG }}>
                      <th className="w-12 px-3 py-3 text-left" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>
                        <input type="checkbox" checked={allPageSelected} onChange={toggleAll} aria-label="Select all visible products" className="size-4 accent-indigo-600" />
                      </th>
                      <th className="w-24 px-3 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>Image</th>
                      <th className="w-32 px-3 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>Action</th>
                      <th className="min-w-[250px] px-3 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>
                        <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>Product <SortIcon col="name" dir="down" /></button>
                      </th>
                      <th className="min-w-[170px] px-3 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>Business location</th>
                      <th className="min-w-[170px] px-3 py-3 text-left font-semibold whitespace-nowrap" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>
                        <button type="button" onClick={() => toggleSort('purchase')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>Purchase price <SortIcon col="purchase" dir="down" /></button>
                      </th>
                      <th className="min-w-[150px] px-3 py-3 text-left font-semibold whitespace-nowrap" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>
                        <button type="button" onClick={() => toggleSort('selling')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>Selling price <SortIcon col="selling" dir="down" /></button>
                      </th>
                      <th className="min-w-[150px] px-3 py-3 text-left font-semibold whitespace-nowrap" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>
                        <button type="button" onClick={() => toggleSort('stock')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>Current stock <SortIcon col="stock" dir="down" /></button>
                      </th>
                      <th className="min-w-[135px] px-3 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>
                        <button type="button" onClick={() => toggleSort('type')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>Product type <SortIcon col="type" dir="down" /></button>
                      </th>
                      <th className="min-w-[150px] px-3 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>
                        <button type="button" onClick={() => toggleSort('category')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>Category <SortIcon col="category" dir="down" /></button>
                      </th>
                      <th className="min-w-[130px] px-3 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>
                        <button type="button" onClick={() => toggleSort('brand')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>Brand <SortIcon col="brand" dir="down" /></button>
                      </th>
                      <th className="min-w-[110px] px-3 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>
                        <button type="button" onClick={() => toggleSort('tax')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>Tax <SortIcon col="tax" dir="down" /></button>
                      </th>
                      <th className="min-w-[110px] px-3 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>
                        <button type="button" onClick={() => toggleSort('sku')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>SKU <SortIcon col="sku" dir="down" /></button>
                      </th>
                      <th className="min-w-[110px] px-3 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>
                        <button type="button" onClick={() => toggleSort('status')} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: TEXT }}>Status <SortIcon col="status" dir="down" /></button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tab === 'all' && paged.map((product, index) => {
                      const zebra = index % 2 === 0
                      const typeStyle = TYPE_STYLES[product.type]
                      return (
                        <tr
                          key={product.id}
                          className="transition-colors"
                          style={{ background: zebra ? ROW_ALT : CARD_BG, color: TEXT }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = isDark ? '#2b313b' : '#f1f5f9' }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = zebra ? ROW_ALT : CARD_BG }}
                        >
                          <td className="px-3 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                            <input type="checkbox" checked={selected.has(product.id)} onChange={() => toggleOne(product.id)} aria-label={`Select ${product.name}`} className="mt-1 size-4 accent-indigo-600" />
                          </td>
                          <td className="px-3 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                            <div className="grid size-14 place-items-center overflow-hidden rounded-xl" style={{ background: isDark ? '#2b313b' : '#eef2f7', color: TEXT_MUTED }}>
                              <img src={product.image || DEFAULT_PRODUCT_IMAGE} alt="" className="size-full object-cover" onError={(event) => { event.currentTarget.src = DEFAULT_PRODUCT_IMAGE }} />
                            </div>
                          </td>
                          <td className="relative px-3 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                            <button
                              type="button"
                              onClick={(event) => toggleActionMenu(event, product.id)}
                              className="btn whitespace-nowrap font-semibold"
                              style={{ background: CARD_BG, border: `1px solid ${isDark ? '#38bdf8' : '#7dd3fc'}`, color: isDark ? '#7dd3fc' : '#0369a1' }}
                            >
                              Actions <ChevronDown className="size-4" aria-hidden />
                            </button>

                          </td>
                          <td className="px-3 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                            <p className="font-semibold" style={{ color: TEXT }}>{product.name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="rounded-full border px-2 py-0.5 text-xs font-semibold" style={{ background: typeStyle.background, borderColor: typeStyle.borderColor, color: typeStyle.color }}>{product.type}</span>
                              <span className="rounded-full border px-2 py-0.5 text-xs font-semibold" style={product.active
                                ? { background: 'rgba(5, 150, 105, 0.12)', borderColor: 'rgba(5, 150, 105, 0.45)', color: '#059669' }
                                : { background: 'rgba(217, 119, 6, 0.12)', borderColor: 'rgba(217, 119, 6, 0.45)', color: '#d97706' }}>{product.active ? 'Active' : 'Inactive'}</span>
                            </div>
                          </td>
                          <td className="px-3 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}`, color: TEXT }}>
                            {(() => {
                              const loc = condenseLocations(product.location || '')
                              return (
                                <span className="font-medium" title={product.location || undefined}>
                                  {loc.shown || 'No location assigned'}
                                  {loc.extra > 0 && (
                                    <span className="ml-1.5 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[11px] font-semibold" style={{ borderColor: PANEL_BD, color: TEXT_MUTED }}>+{loc.extra} more</span>
                                  )}
                                </span>
                              )
                            })()}
                          </td>
                          <td className="px-3 py-4 align-top whitespace-nowrap" style={{ borderBottom: `1px solid ${PANEL_BD}`, color: TEXT }}>
                            {fmtMoney(product.purchasePrice)}
                          </td>
                          <td className="px-3 py-4 align-top whitespace-nowrap" style={{ borderBottom: `1px solid ${PANEL_BD}`, color: TEXT }}>
                            <span className="font-semibold">{fmtMoney(product.sellingPrice)}</span>
                          </td>
                          <td className="px-3 py-4 align-top whitespace-nowrap" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                            <span className="font-semibold" style={{ color: product.stock > 0 ? '#059669' : TEXT }}>{product.stock.toFixed(product.stock % 1 ? 2 : 0)}</span>
                            <span className="ml-1 text-xs" style={{ color: TEXT_MUTED }}>{product.unit}</span>
                          </td>
                          <td className="px-3 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                            <span className="rounded-full border px-2.5 py-1 text-xs font-semibold" style={{ background: typeStyle.background, borderColor: typeStyle.borderColor, color: typeStyle.color }}>{product.type}</span>
                          </td>
                          <td className="px-3 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}`, color: TEXT }}>{product.category || '—'}</td>
                          <td className="px-3 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}`, color: TEXT }}>{product.brand || '—'}</td>
                          <td className="px-3 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}`, color: product.tax ? TEXT : TEXT_MUTED }}>{product.tax || 'No tax'}</td>
                          <td className="px-3 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                            <span className="rounded-md border px-2 py-1 font-mono text-xs font-semibold" style={{ borderColor: PANEL_BD, color: TEXT_MUTED }}>{product.sku || '—'}</span>
                          </td>
                          <td className="px-3 py-4 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                            <span className="rounded-full border px-2.5 py-1 text-xs font-semibold" style={product.active
                              ? { background: 'rgba(5, 150, 105, 0.12)', borderColor: 'rgba(5, 150, 105, 0.45)', color: '#059669' }
                              : { background: 'rgba(217, 119, 6, 0.12)', borderColor: 'rgba(217, 119, 6, 0.45)', color: '#d97706' }}>{product.active ? 'Active' : 'Inactive'}</span>
                          </td>
                        </tr>
                      )
                    })}
                    {tab === 'all' && paged.length === 0 && (
                      <tr>
                        <td colSpan={14} className="px-4 py-12 text-center" style={{ color: TEXT_MUTED, background: CARD_BG }}>
                          <Package className="mx-auto size-8 opacity-50" aria-hidden />
                          <p className="mt-3 font-semibold" style={{ color: TEXT }}>No products found</p>
                          <p className="mt-1 text-sm">Try a different search or adjust your filters.</p>
                        </td>
                      </tr>
                    )}
                    {tab === 'stock' && (
                      <tr>
                        <td colSpan={14} className="px-4 py-12 text-center" style={{ color: TEXT_MUTED, background: CARD_BG }}>
                          <Hourglass className="mx-auto size-8 opacity-50" aria-hidden />
                          <p className="mt-3 font-semibold" style={{ color: TEXT }}>Stock report is coming soon</p>
                          <p className="mt-1 text-sm">Switch back to All products to manage the catalogue.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {selected.size > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border p-3" style={{ background: CARD_BG, borderColor: PANEL_BD }}>
                  <span className="mr-1 text-sm font-semibold" style={{ color: TEXT }}>{selected.size} selected</span>
                  <button type="button" onClick={runBulkDelete} className="btn font-semibold" style={{ background: 'transparent', border: `1px solid ${RED}`, color: RED }}>Delete selected</button>
                  <button type="button" onClick={() => { setBulkLocations([]); setBulkLocQuery(''); setBulkLocationOpen(true) }} className="btn font-semibold" style={{ background: 'transparent', border: '1px solid #0d9488', color: '#0d9488' }}>Add to location</button>
                  <button type="button" onClick={runBulkRemoveLocation} className="btn font-semibold" style={{ background: 'transparent', border: `1px solid ${isDark ? '#64748b' : '#64748b'}`, color: TEXT_MUTED }}>Remove from location</button>
                  <button type="button" onClick={runBulkDeactivate} className="btn font-semibold" style={{ background: 'transparent', border: '1px solid #d97706', color: '#d97706' }}>Deactivate selected</button>
                  <button type="button" onClick={runBulkReactivate} className="btn font-semibold" style={{ background: 'transparent', border: '1px solid #059669', color: '#059669' }}>Reactivate selected</button>
                  <button type="button" onClick={clearSel} className="btn font-semibold" style={{ background: 'transparent', border: `1px solid ${INPUT_BD}`, color: TEXT_MUTED }}>Clear</button>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm" style={{ color: TEXT_MUTED }}>
                <span>{filtered.length === 0 ? 'No entries' : `Showing ${startIdx} to ${endIdx} of ${filtered.length} entries`}</span>
                <div className="flex items-center">
                  <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="btn rounded-r-none font-semibold disabled:cursor-not-allowed disabled:opacity-50" style={{ background: CARD_BG, border: `1px solid ${INPUT_BD}`, color: TEXT_MUTED }}>
                    <ChevronLeft className="size-4" aria-hidden /> Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
                    <button type="button" key={number} onClick={() => setPage(number)} className={cn('btn rounded-none font-semibold -ml-px', number === page && 'text-white')} style={number === page ? { background: INDIGO, border: `1px solid ${INDIGO}`, color: '#ffffff' } : { background: CARD_BG, border: `1px solid ${INPUT_BD}`, color: TEXT_MUTED }}>
                      {number}
                    </button>
                  ))}
                  <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="btn rounded-l-none font-semibold -ml-px disabled:cursor-not-allowed disabled:opacity-50" style={{ background: CARD_BG, border: `1px solid ${INPUT_BD}`, color: TEXT_MUTED }}>
                    Next <ChevronRight className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div data-inv-products-print aria-hidden style={{ position: 'fixed', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
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
              {filtered.map((product, index) => (
                <tr key={product.id}>
                  <td>{index + 1}</td><td>{product.name}</td><td>{product.type}</td><td>{product.category}</td><td>{product.brand}</td><td>{product.sku}</td>
                  <td>{fmtMoney(product.purchasePrice)}</td><td>{fmtMoney(product.sellingPrice)}</td><td>{product.stock}</td><td>{product.unit}</td><td>{product.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {actionMenuProduct && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[10050] w-[285px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-lg border py-2 shadow-2xl"
          style={{
            top: actionMenuPosition.top,
            left: actionMenuPosition.left,
            maxHeight: 'calc(100vh - 24px)',
            background: CARD_BG,
            borderColor: CARD_BD,
            color: TEXT,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {[
            { label: 'Labels', Icon: Barcode },
            { label: 'View', Icon: Eye },
            { label: 'Edit', Icon: Pencil },
            ...(actionMenuProduct && !actionMenuProduct.active ? [{ label: 'Reactivate', Icon: RotateCcw }] : []),
            { label: 'Delete', Icon: Trash2 },
          ].map(({ label, Icon }) => (
            <button
              type="button"
              key={label}
              className="flex w-full items-center gap-3 px-4 py-1.5 text-left text-sm transition hover:bg-sky-50 dark:hover:bg-sky-950"
              style={{ color: TEXT_MUTED }}
              onClick={() => handleProductAction(label, actionMenuProduct)}
            >
              <Icon className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
              <span>{label}</span>
            </button>
          ))}
          <div className="my-2 border-t" style={{ borderColor: CARD_BD }} />
          {[
            { label: 'Add or edit opening stock', Icon: Database },
            { label: 'Product stock history', Icon: History },
            { label: 'Add or edit Group Prices', Icon: CircleDollarSign },
            { label: 'Duplicate Product', Icon: Copy },
          ].map(({ label, Icon }) => (
            <button
              type="button"
              key={label}
              className="flex w-full items-center gap-3 px-4 py-1.5 text-left text-sm transition hover:bg-sky-50 dark:hover:bg-sky-950"
              style={{ color: TEXT_MUTED }}
              onClick={() => handleProductAction(label, actionMenuProduct)}
            >
              <Icon className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
              <span>{label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}

      <Modal
        open={actionModal !== null && actionModal !== 'group-prices'}
        onClose={closeActionModal}
        title={actionModal === 'view' ? 'View Product' : actionModal === 'opening-stock' ? 'Add or edit opening stock' : actionModal === 'stock-history' ? 'Product stock history' : 'Add or edit Group Prices'}
        size="lg"
        variant="perfex"
        footer={actionModal === 'opening-stock' ? (
          <>
            <button type="button" onClick={closeActionModal} className="btn font-semibold" style={{ background: CARD_BG, border: `1px solid ${INPUT_BD}`, color: TEXT_MUTED }}>Cancel</button>
            <button type="button" onClick={saveOpeningStock} className="btn font-semibold text-white" style={{ background: INDIGO, border: `1px solid ${INDIGO}` }}>Save opening stock</button>
          </>
        ) : actionModal === 'group-prices' ? (
          <>
            <button type="button" onClick={closeActionModal} className="btn font-semibold" style={{ background: CARD_BG, border: `1px solid ${INPUT_BD}`, color: TEXT_MUTED }}>Cancel</button>
            <button type="button" onClick={saveGroupPrices} className="btn font-semibold text-white" style={{ background: INDIGO, border: `1px solid ${INDIGO}` }}>Save group prices</button>
          </>
        ) : (
          <button type="button" onClick={closeActionModal} className="btn font-semibold" style={{ background: CARD_BG, border: `1px solid ${INPUT_BD}`, color: TEXT_MUTED }}>Close</button>
        )}
      >
        {actionProduct && actionModal === 'view' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-4 rounded-xl border p-4" style={{ background: PANEL_BG, borderColor: PANEL_BD }}>
              <div className="grid size-14 shrink-0 place-items-center rounded-xl" style={{ background: isDark ? '#2b313b' : '#eef2f7', color: TEXT_MUTED }}>
                <img src={actionProduct.image || DEFAULT_PRODUCT_IMAGE} alt="" className="size-full rounded-xl object-cover" onError={(event) => { event.currentTarget.src = DEFAULT_PRODUCT_IMAGE }} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold" style={{ color: TEXT }}>{actionProduct.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm" style={{ color: TEXT_MUTED }}>
                  <span className="rounded-full border px-2.5 py-1 text-xs font-semibold" style={{ background: TYPE_STYLES[actionProduct.type].background, borderColor: TYPE_STYLES[actionProduct.type].borderColor, color: TYPE_STYLES[actionProduct.type].color }}>{actionProduct.type}</span>
                  <span>SKU {actionProduct.sku || '—'}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { label: 'Business location', value: (() => { const l = condenseLocations(actionProduct.location || ''); return l.extra ? `${l.shown} (+${l.extra} more)` : (l.shown || '—') })(), full: actionProduct.location },
                { label: 'Status', value: actionProduct.active ? 'Active' : 'Inactive' },
                { label: 'Category', value: actionProduct.category || '—' },
                { label: 'Brand', value: actionProduct.brand || '—' },
                { label: 'Unit', value: actionProduct.unit || '—' },
                { label: 'Purchase price', value: fmtMoney(actionProduct.purchasePrice) },
                { label: 'Selling price', value: fmtMoney(actionProduct.sellingPrice) },
                { label: 'Current stock', value: `${actionProduct.stock.toFixed(actionProduct.stock % 1 ? 2 : 0)} ${actionProduct.unit || ''}`.trim() },
                { label: 'Tax', value: actionProduct.tax || 'No tax' },
              ].map((detail) => (
                <div key={detail.label} className="rounded-lg border p-3" style={{ background: CARD_BG, borderColor: PANEL_BD }}>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: TEXT_MUTED }}>{detail.label}</p>
                  <p className="mt-1 text-sm font-semibold" style={{ color: TEXT }} title={('full' in detail && detail.full) || undefined}>{detail.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {actionProduct && actionModal === 'opening-stock' && (
          <div className="space-y-5">
            <div className="rounded-xl border p-4" style={{ background: PANEL_BG, borderColor: PANEL_BD }}>
              <p className="text-base font-semibold" style={{ color: TEXT }}>{actionProduct.name}</p>
              <p className="mt-1 text-sm" style={{ color: TEXT_MUTED }}>Set the opening balance for this product. The current catalogue stock will be updated when you save.</p>
            </div>
            <div>
              <label htmlFor="opening-stock-quantity" className="mb-2 block text-sm font-semibold" style={{ color: TEXT }}>Opening stock quantity</label>
              <input
                id="opening-stock-quantity"
                type="number"
                min="0"
                step="0.01"
                value={stockValue}
                onChange={(event) => { setStockValue(event.target.value); setStockError('') }}
                className="h-11 w-full rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                style={{ background: INPUT_BG, border: `1px solid ${stockError ? RED : INPUT_BD}`, color: TEXT }}
              />
              {stockError && <p className="mt-2 text-sm font-medium" style={{ color: RED }}>{stockError}</p>}
              <p className="mt-2 text-xs" style={{ color: TEXT_MUTED }}>Current quantity: {actionProduct.stock} {actionProduct.unit || 'units'}</p>
            </div>
          </div>
        )}

        {actionProduct && actionModal === 'stock-history' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border p-4" style={{ background: PANEL_BG, borderColor: PANEL_BD }}>
              <div>
                <p className="text-base font-semibold" style={{ color: TEXT }}>{actionProduct.name}</p>
                <p className="mt-1 text-sm" style={{ color: TEXT_MUTED }}>Recorded opening-balance changes for this product.</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: TEXT_MUTED }}>Current stock</p>
                <p className="mt-1 text-xl font-semibold" style={{ color: actionProduct.stock > 0 ? '#059669' : TEXT }}>{actionProduct.stock} {actionProduct.unit || 'units'}</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border" style={{ borderColor: PANEL_BD }}>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr style={{ background: TABLE_HEAD_BG }}>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: TEXT }}>Event</th>
                    <th className="px-4 py-3 text-right font-semibold" style={{ color: TEXT }}>Quantity</th>
                    <th className="px-4 py-3 text-right font-semibold" style={{ color: TEXT }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {[...historyFor(actionProduct)].reverse().map((event) => (
                    <tr key={event.id} style={{ borderTop: `1px solid ${PANEL_BD}` }}>
                      <td className="px-4 py-3" style={{ color: TEXT }}>{event.label}</td>
                      <td className="px-4 py-3 text-right font-semibold" style={{ color: TEXT }}>{event.quantity} {actionProduct.unit || ''}</td>
                      <td className="px-4 py-3 text-right text-xs" style={{ color: TEXT_MUTED }}>{event.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </Modal>

      {actionProduct && actionModal === 'group-prices' && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[10010] overflow-y-auto"
          style={{ background: isDark ? '#11161c' : '#edf2f7' }}
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeActionModal() }}
        >
          <div className="min-h-full px-3 py-3 md:px-4 md:py-4">
            <div className="mx-auto w-full max-w-[1500px]">
              <div className="flex items-center justify-between gap-3">
                <h1 className="text-3xl font-bold leading-tight md:text-[32px]" style={{ color: isDark ? '#f8fafc' : '#000000' }}>
                  Add or edit Group Prices
                </h1>
                <button
                  type="button"
                  onClick={closeActionModal}
                  className="btn font-semibold"
                  style={{ background: isDark ? '#1b1f24' : '#ffffff', border: `1px solid ${isDark ? '#49515c' : '#cbd5e1'}`, color: isDark ? '#e5e7eb' : '#475569' }}
                >
                  Close
                </button>
              </div>

              <section className="mt-5 rounded-md p-5 shadow-sm md:p-7" style={{ background: isDark ? '#1b1f24' : '#ffffff' }}>
                <h2 className="text-xl font-normal md:text-[24px]" style={{ color: isDark ? '#bfdbfe' : '#16325c' }}>
                  Product: {actionProduct.name} ({actionProduct.sku || '—'})
                </h2>

                <div className="mt-8 overflow-x-auto">
                  <table className="w-full min-w-[980px] border-collapse text-sm" style={{ color: isDark ? '#e5e7eb' : '#111827' }}>
                    <thead>
                      <tr>
                        {actionProduct.type === 'Variable' && (
                          <th className="w-[30%] border px-3 py-2.5 text-center font-bold" style={{ background: '#5cb85c', borderColor: '#ffffff', color: '#ffffff' }}>
                            Variation iGrace
                          </th>
                        )}
                        <th className="border px-3 py-2.5 text-center font-bold" style={{ background: '#5cb85c', borderColor: '#ffffff', color: '#ffffff' }}>
                          Default Selling Price (Inc. Tax)
                        </th>
                        {priceGroups.map((group) => (
                          <th key={group.id} className="min-w-[230px] border px-3 py-2.5 text-center font-bold" style={{ background: '#5cb85c', borderColor: '#ffffff', color: '#ffffff' }}>
                            <span className="inline-flex items-center justify-center gap-2">
                              {group.name}
                              <span title={`Price group: ${group.name}`} className="grid size-5 place-items-center rounded-full bg-cyan-400 text-xs font-bold text-white">i</span>
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groupPriceRows.map((row, rowIndex) => (
                        <tr key={row.id} style={{ background: isDark ? (rowIndex % 2 ? '#1b1f24' : '#20252c') : (rowIndex % 2 ? '#ffffff' : '#fafafa') }}>
                          {actionProduct.type === 'Variable' && (
                            <td className="border px-3 py-3 text-center align-top" style={{ borderColor: isDark ? '#2d333a' : '#f0f0f0' }}>
                              {row.label || `${actionProduct.name} variation`}
                            </td>
                          )}
                          <td className="border px-3 py-3 text-center align-top" style={{ borderColor: isDark ? '#2d333a' : '#f0f0f0' }}>
                            ₵ {row.defaultSellingPrice.toFixed(2)}
                          </td>
                          {priceGroups.map((group) => {
                            const cell = groupPriceDraft[row.id]?.[group.id] || { value: '', mode: 'Fixed' as GroupPriceMode }
                            return (
                              <td key={group.id} className="border p-2 align-top" style={{ borderColor: isDark ? '#2d333a' : '#f0f0f0' }}>
                                <div className="overflow-hidden border" style={{ borderColor: isDark ? '#49515c' : '#cbd5e1' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={cell.value}
                                    aria-label={`${group.name} price for ${row.label || actionProduct.name}`}
                                    onChange={(event) => updateGroupPriceCell(row.id, group.id, { value: event.target.value })}
                                    className="h-10 w-full border-0 border-b px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    style={{ background: isDark ? '#14171c' : '#ffffff', borderColor: isDark ? '#49515c' : '#cbd5e1', color: isDark ? '#e5e7eb' : '#334155' }}
                                  />
                                  <select
                                    value={cell.mode}
                                    aria-label={`${group.name} pricing mode for ${row.label || actionProduct.name}`}
                                    onChange={(event) => updateGroupPriceCell(row.id, group.id, { mode: event.target.value as GroupPriceMode })}
                                    className="h-10 w-full border-0 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    style={{ background: isDark ? '#14171c' : '#ffffff', color: isDark ? '#e5e7eb' : '#334155' }}
                                  >
                                    <option value="Fixed">Fixed</option>
                                    <option value="Percentage">Percentage</option>
                                  </select>
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {priceGroups.length === 0 && (
                  <div className="mt-5 rounded-md border border-dashed p-4 text-center" style={{ borderColor: isDark ? '#49515c' : '#cbd5e1', color: isDark ? '#cbd5e1' : '#64748b' }}>
                    No active price groups are available. Add one from Product Settings before saving group prices.
                    <button type="button" onClick={() => { closeActionModal(); navigate('/admin/inventory/settings/price-groups') }} className="btn ml-2 font-semibold" style={{ background: isDark ? '#1b1f24' : '#ffffff', border: `1px solid ${isDark ? '#64748b' : '#94a3b8'}`, color: INDIGO }}>Manage price groups</button>
                  </div>
                )}
                {groupPriceError && <p className="mt-4 text-sm font-medium" style={{ color: RED }}>{groupPriceError}</p>}
              </section>

              <div className="flex flex-wrap items-center justify-center gap-1.5 py-8">
                <button type="button" onClick={saveGroupPricesAndOpeningStock} className="btn font-semibold text-white" style={{ background: '#625bb4', border: '1px solid #625bb4' }}>
                  Save &amp; Add Opening Stock
                </button>
                <button type="button" onClick={saveGroupPricesAndAnother} className="btn font-semibold text-white" style={{ background: '#df1761', border: '1px solid #df1761' }}>
                  Save And Add Another
                </button>
                <button type="button" onClick={saveGroupPrices} className="btn font-semibold text-white" style={{ background: '#4f00f5', border: '1px solid #4f00f5' }}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Bulk: add selected products to a location */}
      <Modal
        open={bulkLocationOpen}
        onClose={() => setBulkLocationOpen(false)}
        title={`Add ${selected.size} product${selected.size === 1 ? '' : 's'} to locations`}
        size="sm"
        variant="perfex"
        footer={
          <>
            <button type="button" onClick={() => { setBulkLocationOpen(false); setBulkLocQuery('') }} className="btn font-semibold" style={{ background: CARD_BG, border: `1px solid ${INPUT_BD}`, color: TEXT_MUTED }}>Cancel</button>
            <button type="button" onClick={runBulkAddToLocation} disabled={!bulkLocations.length} className="btn font-semibold text-white disabled:opacity-50" style={{ background: INDIGO, border: `1px solid ${INDIGO}` }}>Add to locations</button>
          </>
        }
      >
        <p className="text-sm" style={{ color: TEXT_MUTED }}>Pick one or more locations. Chosen locations are added to each product's existing locations.</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="relative block flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
            <input
              type="search"
              value={bulkLocQuery}
              onChange={(e) => setBulkLocQuery(e.target.value)}
              placeholder={`Search ${branchOptions.length} locations…`}
              aria-label="Search locations"
              className="h-[36px] w-full rounded-lg pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }}
            />
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs" style={{ color: TEXT_MUTED }}>
          <span>{bulkLocations.length} of {branchOptions.length} selected</span>
          <span className="flex gap-2">
            <button type="button" onClick={() => setBulkLocations([...new Set([...bulkLocations, ...filteredBulkBranches.map((b) => b.id)])])} className="font-semibold hover:underline" style={{ color: INDIGO }}>Select all</button>
            <button type="button" onClick={() => setBulkLocations([])} className="font-semibold hover:underline">Clear</button>
          </span>
        </div>
        <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {filteredBulkBranches.length === 0 && (
            <p className="py-6 text-center text-sm" style={{ color: TEXT_MUTED }}>No locations match “{bulkLocQuery}”.</p>
          )}
          {filteredBulkBranches.map((branch) => {
            const on = bulkLocations.includes(branch.id)
            return (
              <label key={branch.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition" style={{ borderColor: on ? INDIGO : INPUT_BD, background: on ? 'rgba(79, 0, 245, 0.06)' : INPUT_BG, color: TEXT }}>
                <input type="checkbox" checked={on} onChange={() => setBulkLocations((cur) => (cur.includes(branch.id) ? cur.filter((id) => id !== branch.id) : [...cur, branch.id]))} className="size-4 accent-indigo-600" />
                <span className="min-w-0 flex-1 truncate">{branch.name}</span>
                {branch.city && <span className="shrink-0 text-xs" style={{ color: TEXT_MUTED }}>{branch.city}</span>}
              </label>
            )
          })}
        </div>
      </Modal>

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
        active: ed.active,
        productType: ed.type,
        purchaseExc: typeof ed.purchasePrice === 'number' ? String(ed.purchasePrice) : '',
        sellingExc: typeof ed.sellingPrice === 'number' ? String(ed.sellingPrice) : '',
        locations: (ed.branchIds || []).filter((id) => branchOptions.some((b) => b.id === id)),
        imageName: ed.image ? (ed.image.startsWith('data:') ? 'Current image' : ed.image.split('/').pop() || 'Current image') : '',
        imageData: ed.image || '',
      } : undefined}
      categories={invCats}
      brands={invBrands}
      units={invUnits}
      taxes={taxes}
      branches={branchOptions}
      products={items.map((p) => ({ id: p.id, name: p.name, sku: p.sku, purchasePrice: Array.isArray(p.purchasePrice) ? p.purchasePrice[0] : (p.purchasePrice ?? 0) }))}
    />)})()}
    </>
  )
}
export { ProductsList as Inventory }
export default ProductsList
