import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowDownToLine,
  ChevronDown,
  Columns3,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Plus,
  Printer,
  Receipt,
  Trash2,
} from 'lucide-react'
import { Modal, Field, Select, Empty, SearchField } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { exportCsv, exportExcel } from '../../lib/export'
import { useDismissOnOutside } from '../../lib/useDismissOnOutside'
import { formatGhsExact } from '../../lib/utils'
import { canAccessOrgRecord, visibleBranches } from '../../lib/accessScope'
import { SaleEditorPage } from './SaleEditorPage'
import type { Sale, PaymentMethod } from '../../types'

type SalesColumnKey =
  | 'action'
  | 'date'
  | 'invoice'
  | 'customer'
  | 'contact'
  | 'location'
  | 'paymentStatus'
  | 'paymentMethod'
  | 'totalAmount'
  | 'totalPaid'
  | 'sellDue'
  | 'sellReturnDue'
  | 'shippingStatus'
  | 'totalItems'
  | 'serviceType'
  | 'customField1'
  | 'addedBy'
  | 'sellNote'

const SALES_COLUMNS: { key: SalesColumnKey; label: string }[] = [
  { key: 'action', label: 'Action' },
  { key: 'date', label: 'Date' },
  { key: 'invoice', label: 'Invoice No.' },
  { key: 'customer', label: 'Customer name' },
  { key: 'contact', label: 'Contact Number' },
  { key: 'location', label: 'Location' },
  { key: 'paymentStatus', label: 'Payment Status' },
  { key: 'paymentMethod', label: 'Payment Method' },
  { key: 'totalAmount', label: 'Total amount' },
  { key: 'totalPaid', label: 'Total paid' },
  { key: 'sellDue', label: 'Sell Due' },
  { key: 'sellReturnDue', label: 'Sell Return Due' },
  { key: 'shippingStatus', label: 'Shipping Status' },
  { key: 'totalItems', label: 'Total Items' },
  { key: 'serviceType', label: 'Types of service' },
  { key: 'customField1', label: 'Custom Field 1' },
  { key: 'addedBy', label: 'Added By' },
  { key: 'sellNote', label: 'Sell note' },
]

const DEFAULT_COLUMN_VISIBILITY: Record<SalesColumnKey, boolean> = {
  action: true,
  date: true,
  invoice: true,
  customer: true,
  contact: true,
  location: true,
  paymentStatus: true,
  paymentMethod: true,
  totalAmount: true,
  totalPaid: true,
  sellDue: true,
  sellReturnDue: true,
  shippingStatus: true,
  totalItems: true,
  serviceType: true,
  customField1: true,
  addedBy: true,
  sellNote: true,
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  momo: 'Mobile Money',
  stripe: 'Stripe',
  paypal: 'PayPal',
  paystack: 'Paystack',
  payaza: 'Payaza',
  flutterwave: 'Flutterwave',
  hubtel: 'Hubtel',
}

const salePaidAmount = (sale: Sale) => sale.status === 'refunded' ? 0 : sale.details?.payment ? Math.min(sale.total, Math.max(0, sale.details.payment.amount)) : (sale.status === 'completed' ? sale.total : 0)
const saleStatusLabel = (sale: Sale) => sale.status === 'refunded' ? 'Refunded' : salePaidAmount(sale) >= sale.total ? 'Paid' : 'Pending'
const saleStatusValue = (sale: Sale) => sale.status === 'refunded' ? 'refunded' : salePaidAmount(sale) >= sale.total ? 'paid' : 'pending'
const saleShippingStatus = (sale: Sale) => {
  const value = sale.details?.shippingStatus
  if (value) return value.charAt(0).toUpperCase() + value.slice(1)
  return sale.status === 'completed' ? 'Shipped' : 'Pending'
}
const saleServiceType = (sale: Sale) => sale.details?.serviceType || ''
const saleNote = (sale: Sale) => sale.details?.sellNote || ''
const saleIsSubscribed = (sale: Sale) => Boolean(sale.details?.subscribed)

function saleDateTime(sale: Sale) {
  const source = sale.createdAt || `${sale.date}T00:00:00`
  const date = new Date(source)
  if (Number.isNaN(date.getTime())) return sale.date
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function totalSaleItems(sale: Sale) {
  return sale.lines.reduce((sum, line) => sum + (line.quantity || 0), 0)
}

function SalesToolbarIconButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string
  onClick: () => void
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="btn"
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

function dateInputValue(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function Sales() {
  const app = useApp()
  const { inventory, members, users, branches, sales, activeCompanyId, activeBranchId, refundSale, deleteSale } = app
  const { hasRole, user } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'company_admin', 'branch_admin', 'staff')
  const accessibleBranches = useMemo(
    () => user?.role === 'super_admin' ? branches : visibleBranches(user, branches, activeCompanyId),
    [activeCompanyId, branches, user],
  )
  const accessibleSales = useMemo(() => sales.filter((sale) => {
    const creator = users.find((account) => account.id === sale.userId)
    const member = members.find((candidate) => candidate.id === sale.memberId)
    const memberUser = member ? users.find((account) => account.id === member.userId) : undefined
    return canAccessOrgRecord(user, {
      companyId: sale.companyId || creator?.companyId || memberUser?.companyId,
      branchId: sale.branchId || creator?.branchId || member?.branchId || memberUser?.branchId,
    }, branches)
  }), [branches, members, sales, user, users])

  const [saleEditor, setSaleEditor] = useState<{ mode: 'add' | 'edit'; sale?: Sale } | null>(null)
  const [viewingSale, setViewingSale] = useState<Sale | null>(null)
  const [openActionId, setOpenActionId] = useState<string | null>(null)
  const [columnMenuOpen, setColumnMenuOpen] = useState(false)
  const columnMenuRef = useRef<HTMLDivElement | null>(null)

  const [columnVisibility, setColumnVisibility] = useState<Record<SalesColumnKey, boolean>>(DEFAULT_COLUMN_VISIBILITY)

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [businessLocation, setBusinessLocation] = useState('all')
  const [customerFilter, setCustomerFilter] = useState('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all')
  const [userFilter, setUserFilter] = useState('all')
  const [shippingStatusFilter, setShippingStatusFilter] = useState('all')
  const [subscriptionOnly, setSubscriptionOnly] = useState(false)
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all')
  const [search, setSearch] = useState('')

  const currentYear = new Date().getFullYear()
  const [dateFrom, setDateFrom] = useState(() => dateInputValue(currentYear, 1, 1))
  const [dateTo, setDateTo] = useState(() => dateInputValue(currentYear, 12, 31))
  const [entries, setEntries] = useState(25)
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState<'' | 'csv' | 'excel'>('')

  const memberName = (id?: string) => {
    const member = members.find((item) => item.id === id)
    return member ? users.find((account) => account.id === member.userId)?.name || id : undefined
  }
  const itemName = (id: string) => inventory.find((item) => item.id === id)?.name || id
  const userName = (id: string) => users.find((account) => account.id === id)?.name || id
  const locationName = (sale: Sale) => sale.details?.businessLocation || branches.find((branch) => branch.id === sale.branchId)?.name || 'Unknown location'
  const customerName = (sale: Sale) => sale.memberId ? (memberName(sale.memberId) || sale.memberId) : sale.customerName || 'Walk-in customer'
  const contactNumber = (sale: Sale) => {
    if (!sale.memberId) return ''
    const member = members.find((item) => item.id === sale.memberId)
    return member ? users.find((account) => account.id === member.userId)?.phone || '' : ''
  }

  const locationOptions = useMemo(
    () => Array.from(new Set(accessibleBranches
      .filter((branch) => !activeBranchId || branch.id === activeBranchId)
      .map((branch) => branch.name.trim())
      .filter(Boolean))),
    [accessibleBranches, activeBranchId],
  )

  const customerOptions = useMemo(() => {
    const options = members
      .map((member) => ({ id: `member:${member.id}`, name: memberName(member.id) || member.id }))
      .filter((option, index, list) => list.findIndex((candidate) => candidate.id === option.id) === index)
    return options
  }, [members, users])

  const userOptions = useMemo(() => {
    const ids = new Set(accessibleSales.map((sale) => sale.userId))
    return users.filter((account) => ids.has(account.id))
  }, [accessibleSales, users])

  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase()
    return accessibleSales.filter((sale) => {
      const saleDate = sale.date || sale.createdAt.slice(0, 10)
      if (dateFrom && saleDate < dateFrom) return false
      if (dateTo && saleDate > dateTo) return false
      if (businessLocation !== 'all' && locationName(sale) !== businessLocation) return false
      if (customerFilter === 'walkin' && sale.memberId) return false
      if (customerFilter.startsWith('member:') && sale.memberId !== customerFilter.slice(7)) return false
      if (paymentStatusFilter !== 'all' && saleStatusValue(sale) !== paymentStatusFilter) return false
      if (userFilter !== 'all' && sale.userId !== userFilter) return false
      if (shippingStatusFilter !== 'all' && saleShippingStatus(sale).toLowerCase() !== shippingStatusFilter) return false
      if (subscriptionOnly && !saleIsSubscribed(sale)) return false
      if (paymentMethodFilter !== 'all' && sale.method !== paymentMethodFilter) return false
      if (query) {
        const haystack = [
          sale.number,
          customerName(sale),
          contactNumber(sale),
          locationName(sale),
          saleStatusLabel(sale),
          PAYMENT_METHOD_LABELS[sale.method],
          userName(sale.userId),
          ...sale.lines.map((line) => itemName(line.itemId)),
        ].join(' ').toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [accessibleSales, dateFrom, dateTo, businessLocation, customerFilter, paymentStatusFilter, userFilter, shippingStatusFilter, subscriptionOnly, paymentMethodFilter, search, members, users, branches, inventory])

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / entries))
  const pagedSales = filteredSales.slice((page - 1) * entries, page * entries)
  const startEntry = filteredSales.length === 0 ? 0 : (page - 1) * entries + 1
  const endEntry = Math.min(page * entries, filteredSales.length)
  useDismissOnOutside(columnMenuOpen, columnMenuRef, () => setColumnMenuOpen(false))
  const visibleColumns = SALES_COLUMNS.filter((column) => columnVisibility[column.key])
  /** Min-width tracks the visible columns so hiding columns removes the horizontal scrollbar. */
  const tableMinWidth = visibleColumns.length * 97

  useEffect(() => {
    setPage(1)
  }, [dateFrom, dateTo, businessLocation, customerFilter, paymentStatusFilter, userFilter, shippingStatusFilter, subscriptionOnly, paymentMethodFilter, search, entries])

  useEffect(() => {
    setBusinessLocation('all')
  }, [activeBranchId])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const openNewSale = () => setSaleEditor({ mode: 'add' })

  const exportRows = filteredSales.map((sale) => ({
    Date: saleDateTime(sale),
    'Invoice No.': sale.number,
    'Customer name': customerName(sale),
    'Contact Number': contactNumber(sale),
    Location: locationName(sale),
    'Payment Status': saleStatusLabel(sale),
    'Payment Method': PAYMENT_METHOD_LABELS[sale.method],
    'Total amount': sale.total,
    'Total paid': salePaidAmount(sale),
    'Sell Due': Math.max(0, sale.total - salePaidAmount(sale)),
    'Sell Return Due': 0,
    'Shipping Status': saleShippingStatus(sale),
    'Total Items': totalSaleItems(sale),
    'Types of service': saleServiceType(sale),
    'Custom Field 1': '',
    'Added By': userName(sale.userId),
    'Sell note': saleNote(sale),
  }))

  const handleExportCsv = async () => {
    setExporting('csv')
    await exportCsv('sales-history', exportRows)
    setExporting('')
  }

  const handleExportExcel = async () => {
    setExporting('excel')
    await exportExcel('sales-history', exportRows)
    setExporting('')
  }

  const footerValue = (key: SalesColumnKey): ReactNode => {
    const paidCount = filteredSales.filter((sale) => saleStatusValue(sale) === 'paid').length
    const methodCounts = filteredSales.reduce<Record<string, number>>((counts, sale) => {
      counts[sale.method] = (counts[sale.method] || 0) + 1
      return counts
    }, {})
    switch (key) {
      case 'invoice': return <strong>Total:</strong>
      case 'paymentStatus': return `Paid - ${paidCount}`
      case 'paymentMethod': return Object.entries(methodCounts).map(([method, count]) => `${PAYMENT_METHOD_LABELS[method as PaymentMethod]} - ${count}`).join(' | ')
      case 'totalAmount': return formatGhsExact(filteredSales.reduce((sum, sale) => sum + sale.total, 0))
      case 'totalPaid': return formatGhsExact(filteredSales.reduce((sum, sale) => sum + salePaidAmount(sale), 0))
      case 'sellDue': return formatGhsExact(filteredSales.reduce((sum, sale) => sum + Math.max(0, sale.total - salePaidAmount(sale)), 0))
      case 'sellReturnDue': return formatGhsExact(0)
      case 'totalItems': return filteredSales.reduce((sum, sale) => sum + totalSaleItems(sale), 0).toFixed(2)
      default: return ''
    }
  }

  const cellValue = (sale: Sale, key: SalesColumnKey): ReactNode => {
    switch (key) {
      case 'date': return <span className="whitespace-nowrap">{saleDateTime(sale)}</span>
      case 'invoice': return <span className="font-medium">{sale.number}</span>
      case 'customer': return customerName(sale)
      case 'contact': return contactNumber(sale)
      case 'location': return locationName(sale)
      case 'paymentStatus': {
        const status = saleStatusValue(sale)
        return <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold text-white ${status === 'paid' ? 'bg-lime-500' : status === 'refunded' ? 'bg-rose-500' : 'bg-amber-500'}`}>{saleStatusLabel(sale)}</span>
      }
      case 'paymentMethod': return PAYMENT_METHOD_LABELS[sale.method]
      case 'totalAmount': return formatGhsExact(sale.total)
      case 'totalPaid': return formatGhsExact(salePaidAmount(sale))
      case 'sellDue': return formatGhsExact(Math.max(0, sale.total - salePaidAmount(sale)))
      case 'sellReturnDue': return formatGhsExact(0)
      case 'shippingStatus': return <span className="inline-flex rounded bg-[#142b4a] px-2 py-0.5 text-xs font-semibold text-white">{saleShippingStatus(sale)}</span>
      case 'totalItems': return totalSaleItems(sale).toFixed(2)
      case 'addedBy': return userName(sale.userId)
      case 'serviceType': return saleServiceType(sale)
      case 'customField1': return ''
      case 'sellNote': return saleNote(sale)
      default: return ''
    }
  }

  if (saleEditor) {
    return <SaleEditorPage sale={saleEditor.sale} onClose={() => setSaleEditor(null)} />
  }

  return (
    <div className="w-full">
      <h1 className="mb-4 text-[26px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Sales</h1>

      {/* Filters */}
      <section className="mb-4 overflow-visible rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          className="flex w-full items-center gap-2 border-b border-zinc-200 px-5 py-4 text-left text-[18px] font-semibold text-[#5bc0de] dark:border-zinc-700"
        >
          <Filter className="size-5" aria-hidden />
          <span>Filters</span>
          <ChevronDown className={('ml-auto size-4 text-zinc-400 transition-transform ' + (filtersOpen ? 'rotate-180' : ''))} aria-hidden />
        </button>
        {filtersOpen && (
        <div className="grid gap-x-7 gap-y-4 p-5 lg:grid-cols-4">
          <Field label="Business Location">
            <Select value={businessLocation} onChange={(e) => setBusinessLocation(e.target.value)}>
              <option value="all">All</option>
              {locationOptions.map((location) => <option key={location} value={location}>{location}</option>)}
            </Select>
          </Field>
          <Field label="Customer">
            <Select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="walkin">Walk-in customer</option>
              {customerOptions.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </Select>
          </Field>
          <Field label="Payment Status">
            <Select value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="refunded">Refunded</option>
            </Select>
          </Field>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-zinc-800 dark:text-zinc-200">Date Range</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Date range from" className="field min-w-0" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Date range to" className="field min-w-0" />
            </div>
          </div>

          <Field label="User">
            <Select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
              <option value="all">All</option>
              {userOptions.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </Select>
          </Field>
          <Field label="Shipping Status">
            <Select value={shippingStatusFilter} onChange={(e) => setShippingStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="shipped">Shipped</option>
              <option value="pending">Pending</option>
              <option value="delivered">Delivered</option>
            </Select>
          </Field>
          <label className="flex items-end gap-2 pb-1 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={subscriptionOnly} onChange={(e) => setSubscriptionOnly(e.target.checked)} className="size-5 accent-[#337ab7]" />
            <span>Subscriptions</span>
          </label>
          <Field label="Payment Method">
            <Select value={paymentMethodFilter} onChange={(e) => setPaymentMethodFilter(e.target.value)}>
              <option value="all">All</option>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
        </div>
        )}
      </section>

      {/* Sales history */}
      <section className="overflow-visible rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5">
          <h2 className="text-[18px] font-semibold text-[#16325c] dark:text-zinc-100">All sales</h2>
          {canManage && (
            <button type="button" className="btn border-0 bg-gradient-to-r from-[#5544df] to-[#3c8fe9] font-semibold text-white shadow-sm hover:brightness-105" onClick={openNewSale}>
              <Plus className="size-4" aria-hidden /> Add
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-5 py-3 dark:border-zinc-700">
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <span>Show</span>
            <Select value={String(entries)} onChange={(e) => setEntries(Number(e.target.value))} className="w-20">
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
            <span>entries</span>
          </label>

          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
            <div className="flex flex-wrap items-center gap-2">
            <SalesToolbarIconButton label="Export CSV" onClick={() => void handleExportCsv()} disabled={!!exporting}>
              <Download className="size-5" aria-hidden style={{ width: 20, height: 20 }} />
            </SalesToolbarIconButton>
            <SalesToolbarIconButton label="Export Excel" onClick={() => void handleExportExcel()} disabled={!!exporting}>
              <FileSpreadsheet className="size-5" aria-hidden style={{ width: 20, height: 20 }} />
            </SalesToolbarIconButton>
            <SalesToolbarIconButton label="Print" onClick={() => window.print()}>
              <Printer className="size-5" aria-hidden style={{ width: 20, height: 20 }} />
            </SalesToolbarIconButton>
            <div className="relative" ref={columnMenuRef}>
              <SalesToolbarIconButton label="Column Visibility" onClick={() => setColumnMenuOpen((open) => !open)}>
                <Columns3 className="size-5" aria-hidden style={{ width: 20, height: 20 }} />
              </SalesToolbarIconButton>
              {columnMenuOpen && (
                <div className="menu-pop absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-lg p-2 text-left shadow-xl" role="menu">
                  <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-mist">Show columns</p>
                  {SALES_COLUMNS.filter((column) => column.key !== 'action').map((column) => (
                    <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5">
                      <input type="checkbox" checked={columnVisibility[column.key]} onChange={(e) => setColumnVisibility((current) => ({ ...current, [column.key]: e.target.checked }))} />
                      <span>{column.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <SalesToolbarIconButton label="Export PDF" onClick={() => window.print()}>
              <FileText className="size-5" aria-hidden style={{ width: 20, height: 20 }} />
            </SalesToolbarIconButton>
          </div>
            <div className="w-full sm:ml-1 sm:w-[230px] lg:w-[240px]">
              <SearchField value={search} onChange={setSearch} placeholder="Search ..." className="w-full" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto px-5 pt-3">
          <table className="w-full border-collapse text-[12px] text-zinc-800 dark:text-zinc-200" style={{ minWidth: tableMinWidth }}>
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/80">
                {visibleColumns.map((column) => (
                  <th key={column.key} className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedSales.map((sale) => (
                <tr key={sale.id} className="border-b border-zinc-100 hover:bg-sky-50/40 dark:border-zinc-800 dark:hover:bg-white/[0.03]">
                  {visibleColumns.map((column) => (
                    <td key={column.key} className="px-2 py-2.5 align-top">
                      {column.key === 'action' ? (
                        <div className="relative">
                          <button type="button" className="btn whitespace-nowrap border-[#3bb6e5] bg-white text-[12px] font-semibold text-[#159cca] hover:bg-sky-50 dark:bg-zinc-900" onClick={() => setOpenActionId((current) => current === sale.id ? null : sale.id)} aria-expanded={openActionId === sale.id}>
                            Actions <ChevronDown className="size-3.5" aria-hidden />
                          </button>
                          {openActionId === sale.id && (
                            <div className="menu-pop absolute left-0 top-full z-50 mt-1 min-w-40 rounded-lg p-1 shadow-xl">
                              <button type="button" className="menu-pop-item flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm" onClick={() => { setViewingSale(sale); setOpenActionId(null) }}><Eye className="size-4" /> View sale</button>
                              {sale.status === 'completed' && canManage && <button type="button" className="menu-pop-item flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm" onClick={() => { setSaleEditor({ mode: 'edit', sale }); setOpenActionId(null) }}><Receipt className="size-4" /> Edit sale</button>}
                              {sale.status === 'completed' && canManage && <button type="button" className="menu-pop-item flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm" onClick={() => { const result = refundSale(sale.id); setOpenActionId(null); result.ok ? toast.success('Sale refunded', 'Stock returned to inventory') : toast.error(result.error || 'Could not refund') }}><ArrowDownToLine className="size-4" /> Refund sale</button>}
                              {canManage && <button type="button" className="menu-pop-item flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-rose-600" onClick={() => { deleteSale(sale.id); setOpenActionId(null); toast.success('Sale deleted') }}><Trash2 className="size-4" /> Delete sale</button>}
                            </div>
                          )}
                        </div>
                      ) : cellValue(sale, column.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#d7dce5] font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                {visibleColumns.map((column) => <td key={column.key} className="border-r border-zinc-300 px-2 py-3 dark:border-zinc-700">{footerValue(column.key)}</td>)}
              </tr>
            </tfoot>
          </table>
          {!pagedSales.length && <Empty title="No sales found" desc="Try changing the filters or record a new sale." />}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm text-zinc-700 dark:text-zinc-300">
          <span>Showing {startEntry} to {endEntry} of {filteredSales.length} entries</span>
          <div className="flex items-center gap-1">
            <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
              const pageNumber = index + 1
              return <button key={pageNumber} type="button" className="btn min-w-9" aria-current={page === pageNumber ? 'page' : undefined} style={page === pageNumber ? { background: '#337ab7', color: '#fff', borderColor: '#337ab7' } : undefined} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
            })}
            <button type="button" className="btn" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button>
          </div>
        </div>
      </section>

      {/* Sale details */}
      <Modal open={!!viewingSale} onClose={() => setViewingSale(null)} title={viewingSale?.number || 'Sale details'} wide>
        {viewingSale && (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-3">
              <div><p className="text-xs text-mist">Customer</p><p className="font-semibold">{customerName(viewingSale)}</p></div>
              <div><p className="text-xs text-mist">Payment</p><p className="font-semibold">{PAYMENT_METHOD_LABELS[viewingSale.method]}</p></div>
              <div><p className="text-xs text-mist">Date</p><p className="font-semibold">{saleDateTime(viewingSale)}</p></div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[500px] text-sm">
                <thead><tr className="border-b border-line bg-black/[0.03] text-left text-xs uppercase tracking-wider text-mist dark:bg-white/[0.03]"><th className="px-3 py-2">Product</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Unit price</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
                <tbody>{viewingSale.lines.map((line) => <tr key={line.itemId} className="border-b border-line last:border-b-0"><td className="px-3 py-2">{itemName(line.itemId)}</td><td className="px-3 py-2">{line.quantity}</td><td className="px-3 py-2">{formatGhsExact(line.unitPrice)}</td><td className="px-3 py-2 text-right font-semibold">{formatGhsExact(Math.max(0, line.quantity * line.unitPrice - (line.discount || 0)))}</td></tr>)}</tbody>
              </table>
            </div>
            {(() => {
              const d = viewingSale.details
              if (!d || !d.discountAmount) return null
              const gross = viewingSale.lines.reduce((sum, l) => sum + Math.max(0, l.quantity) * Math.max(0, l.unitPrice), 0)
              const lineDisc = viewingSale.lines.reduce((sum, l) => sum + Math.max(0, l.discount || 0), 0)
              const net = Math.max(0, gross - lineDisc)
              const amt = Math.min(net, d.discountType === 'percentage' ? net * Math.max(0, d.discountAmount || 0) / 100 : Math.max(0, d.discountAmount || 0))
              if (amt <= 0) return null
              return (
                <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
                  <span className="text-mist">Discount{d.discountName ? ` — ${d.discountName}` : ''}{d.discountCode ? ` (${d.discountCode})` : ''}</span>
                  <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-300">− {formatGhsExact(amt)}</span>
                </div>
              )
            })()}
            <div className="flex items-center justify-between border-t border-line pt-3"><span className="text-sm text-mist">Total</span><strong className="text-lg">{formatGhsExact(viewingSale.total)}</strong></div>
          </div>
        )}
      </Modal>

    </div>
  )
}
