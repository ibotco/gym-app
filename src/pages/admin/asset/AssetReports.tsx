import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Boxes, UserCheck, ShoppingCart, TrendingDown, Wrench, Trash2, ArrowLeftRight, ShieldCheck,
  ClipboardCheck, Wallet, AlertTriangle, ScrollText, Building2, MapPin, Users, Printer, FileDown,
  FileSpreadsheet,
} from 'lucide-react'
import { PageHeader, Button, Badge, Empty, Input, Select, SearchField } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhs, formatGhsExact, formatDate } from '../../../lib/utils'
import { ASSET_STATUSES, accumulatedDepreciation } from '../../../lib/assets'
import { ASSET_TRANSACTION_TYPES } from '../../../lib/assetTransactions'
import { loadAudits, loadAuditItems, loadAuditLog } from '../../../lib/assetAudit'
import { loadMaintenance } from './AssetMaintenance'
import { exportExcel } from '../../../lib/export'
import type { Asset } from '../../../types'

type Col = { k: string; label: string; right?: boolean }
type Row = Record<string, string | number> & {
  _date: string; _cat: string; _loc: string; _dep: string; _status: string; _emp: string; _search: string
}
type Metric = { label: string; value: string }
type Report = { columns: Col[]; rows: Row[]; metrics: Metric[] }

const row = (
  cells: Record<string, string | number>,
  m: { date?: string; cat?: string; loc?: string; dep?: string; status?: string; emp?: string } = {},
): Row => ({
  ...cells,
  _date: m.date || '', _cat: m.cat || '', _loc: m.loc || '', _dep: m.dep || '', _status: m.status || '', _emp: m.emp || '',
  _search: Object.values(cells).join(' ').toLowerCase(),
})

const ghs = (n: number) => formatGhsExact(Math.round(n))
/** Parse a currency-formatted cell (GH₵12,000.00) back to a number for totals. */
const cellNum = (v: string | number | undefined) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.\-]/g, '')) || 0)
const sumNum = (rs: Row[], k: string) => rs.reduce((s, r) => s + cellNum(r[k]), 0)

const REPORT_DEFS = [
  { id: 'register', label: 'Asset Register', icon: Boxes, desc: 'Complete register with IDs, serials, costs, statuses, locations and custodians.' },
  { id: 'assignment', label: 'Asset Assignment', icon: UserCheck, desc: 'Assignments to employees / departments with allocation dates and current ownership.' },
  { id: 'acquisition', label: 'Asset Acquisition', icon: ShoppingCart, desc: 'Assets purchased in the period with supplier information and costs.' },
  { id: 'depreciation', label: 'Asset Depreciation', icon: TrendingDown, desc: 'Cost, method, accumulated depreciation, book value and remaining life.' },
  { id: 'maintenance', label: 'Asset Maintenance', icon: Wrench, desc: 'Maintenance history, costs, technicians and upcoming service activities.' },
  { id: 'disposal', label: 'Asset Disposal', icon: Trash2, desc: 'Retired, sold, scrapped or written-off assets with dates and values.' },
  { id: 'transfer', label: 'Movement / Transfer', icon: ArrowLeftRight, desc: 'Transfers between locations, custodians or branches with approvals.' },
  { id: 'warranty', label: 'Warranty', icon: ShieldCheck, desc: 'Warranties in force, providers, expiry dates and warranties nearing expiration.' },
  { id: 'verification', label: 'Inventory Verification', icon: ClipboardCheck, desc: 'Physical counts vs system records — missing, excess or mismatched assets.' },
  { id: 'valuation', label: 'Asset Valuation', icon: Wallet, desc: 'Current values, acquisition costs, accumulated depreciation and total worth.' },
  { id: 'lost', label: 'Lost / Damaged', icon: AlertTriangle, desc: 'Missing, damaged or stolen assets with incident dates and recovery status.' },
  { id: 'audit', label: 'Audit Trail', icon: ScrollText, desc: 'Creation, updates, assignments, transfers, maintenance and disposals.' },
  { id: 'department', label: 'Department-wise', icon: Building2, desc: 'Counts and values of assets owned or managed by each department.' },
  { id: 'location', label: 'Location-wise', icon: MapPin, desc: 'Assets grouped by office, branch or site with quantity and value summaries.' },
  { id: 'employee', label: 'Employee Allocation', icon: Users, desc: 'Assets assigned to individual employees with dates, status and returns.' },
] as const
type ReportId = (typeof REPORT_DEFS)[number]['id']

export function AssetReports() {
  const app = useApp()
  const { assets, assetTransactions, depreciation, assetCategories, users, staff, departments, branches, company, depreciationPolicy } = app
  const { user } = useAuth()
  const toast = useToast()

  const [reportId, setReportId] = useState<ReportId>('register')
  const [f, setF] = useState({ from: '', to: '', cat: '', loc: '', dep: '', status: '', emp: '', q: '' })
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)
  const [printing, setPrinting] = useState(false)
  const [busy, setBusy] = useState('')

  const today = new Date().toISOString().slice(0, 10)
  const lifeDefault = depreciationPolicy.usefulLifeYears
  const residualPct = depreciationPolicy.residualPercent

  // ---- shared helpers ----
  const accumOf = (a: Asset) => (a.purchaseCost != null ? accumulatedDepreciation(a.purchaseCost, a.purchaseDate || '', a.usefulLifeYears || lifeDefault, residualPct) : 0)
  const bookOf = (a: Asset) => (a.purchaseCost == null ? 0 : Math.max(a.salvageValue || 0, a.currentValue ?? (a.purchaseCost - accumOf(a))))
  const ageYears = (a: Asset) => (a.purchaseDate ? Math.max(0, (Date.now() - new Date(a.purchaseDate).getTime()) / (365.25 * 24 * 3600 * 1000)) : 0)
  const deptOf = (name: string) => {
    const u = users.find((x) => x.name === name)
    return staff.find((s) => s.userId === u?.id)?.department || ''
  }
  const statusLabel = (s: string) => ASSET_STATUSES.find((x) => x.id === s)?.label || s
  const txLabel = (t: string) => ASSET_TRANSACTION_TYPES.find((x) => x.id === t)?.label || t

  const ctx = useMemo(() => {
    const audits = loadAudits()
    const auditItems = loadAuditItems()
    const auditLog = loadAuditLog()
    const maint = loadMaintenance()
    return { audits, auditItems, auditLog, maint }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, assetTransactions])

  // ---- Report builders ----
  const build = (id: ReportId): Report => {
    switch (id) {
      case 'register': {
        const rows = assets.map((a) => row(
          { 'Asset ID': a.tag, Name: a.name, Category: a.category, 'Serial Number': a.serialNumber || '—', 'Purchase Date': a.purchaseDate ? formatDate(a.purchaseDate) : '—', 'Cost (GHS)': a.purchaseCost != null ? ghs(a.purchaseCost) : '—', Status: statusLabel(a.status), Location: a.location, Custodian: a.assignedTo || '—' },
          { date: a.purchaseDate, cat: a.category, loc: a.location, status: a.status, emp: a.assignedTo },
        ))
        return {
          columns: [
            { k: 'Asset ID', label: 'Asset ID' }, { k: 'Name', label: 'Name' }, { k: 'Category', label: 'Category' },
            { k: 'Serial Number', label: 'Serial Number' }, { k: 'Purchase Date', label: 'Purchase Date' },
            { k: 'Cost (GHS)', label: 'Cost (GHS)', right: true }, { k: 'Status', label: 'Status' },
            { k: 'Location', label: 'Location' }, { k: 'Custodian', label: 'Custodian' },
          ],
          rows,
          metrics: [
            { label: 'Assets', value: String(rows.length) },
            { label: 'Total cost', value: formatGhs(assets.reduce((s, a) => s + (a.purchaseCost || 0), 0)) },
            { label: 'Total book value', value: formatGhs(assets.reduce((s, a) => s + bookOf(a), 0)) },
          ],
        }
      }
      case 'assignment': {
        const rows = assetTransactions.filter((t) => t.type === 'assign' || t.type === 'return').map((t) => {
          const a = assets.find((x) => x.id === t.assetId)
          return row(
            { 'Asset ID': a?.tag || '—', Asset: a?.name || '—', Employee: t.to || '—', Department: deptOf(t.to || ''), Date: formatDate(t.date), Action: txLabel(t.type), 'Current Owner': a?.assignedTo || '—' },
            { date: t.date, cat: a?.category, loc: a?.location, dep: deptOf(t.to || ''), status: a?.status, emp: t.to },
          )
        })
        const current = assets.filter((a) => a.assignedTo).length
        return {
          columns: [
            { k: 'Asset ID', label: 'Asset ID' }, { k: 'Asset', label: 'Asset' }, { k: 'Employee', label: 'Employee' },
            { k: 'Department', label: 'Department' }, { k: 'Date', label: 'Allocation Date' }, { k: 'Action', label: 'Action' },
            { k: 'Current Owner', label: 'Current Ownership' },
          ],
          rows,
          metrics: [
            { label: 'Assignment events', value: String(rows.length) },
            { label: 'Assets currently assigned', value: String(current) },
            { label: 'Value assigned', value: formatGhs(assets.filter((a) => a.assignedTo).reduce((s, a) => s + bookOf(a), 0)) },
          ],
        }
      }
      case 'acquisition': {
        const acquireTx = assetTransactions.filter((t) => t.type === 'acquire')
        const withTx = new Set(acquireTx.map((t) => t.assetId))
        const rows = [
          ...acquireTx.map((t) => {
            const a = assets.find((x) => x.id === t.assetId)
            return row(
              { 'Asset ID': a?.tag || '—', Asset: a?.name || '—', Category: a?.category || '—', 'Supplier / Notes': t.notes || t.reason || '—', 'Acquisition Date': formatDate(t.date), 'Cost (GHS)': ghs(t.amount ?? a?.purchaseCost ?? 0), Status: statusLabel(a?.status || '') },
              { date: t.date, cat: a?.category, loc: a?.location, status: a?.status },
            )
          }),
          ...assets.filter((a) => !withTx.has(a.id) && a.purchaseDate).map((a) => row(
            { 'Asset ID': a.tag, Asset: a.name, Category: a.category, 'Supplier / Notes': '—', 'Acquisition Date': formatDate(a.purchaseDate || ''), 'Cost (GHS)': ghs(a.purchaseCost || 0), Status: statusLabel(a.status) },
            { date: a.purchaseDate, cat: a.category, loc: a.location, status: a.status },
          )),
        ]
        const total = sumNum(rows, 'Cost (GHS)')
        return {
          columns: [
            { k: 'Asset ID', label: 'Asset ID' }, { k: 'Asset', label: 'Asset' }, { k: 'Category', label: 'Category' },
            { k: 'Supplier / Notes', label: 'Supplier / Notes' }, { k: 'Acquisition Date', label: 'Acquisition Date' },
            { k: 'Cost (GHS)', label: 'Cost (GHS)', right: true }, { k: 'Status', label: 'Status' },
          ],
          rows,
          metrics: [
            { label: 'Acquisitions', value: String(rows.length) },
            { label: 'Total acquired value', value: formatGhs(total) },
          ],
        }
      }
      case 'depreciation': {
        const rows = assets.filter((a) => a.purchaseCost != null).map((a) => {
          const life = a.usefulLifeYears || lifeDefault
          const remaining = Math.max(0, life - ageYears(a))
          return row(
            { 'Asset ID': a.tag, Asset: a.name, 'Cost (GHS)': ghs(a.purchaseCost || 0), Method: a.depreciationMethod || depreciationPolicy.method, 'Accumulated (GHS)': ghs(accumOf(a)), 'Book Value (GHS)': ghs(bookOf(a)), 'Remaining Life (yrs)': remaining.toFixed(1) },
            { date: a.purchaseDate, cat: a.category, loc: a.location, status: a.status },
          )
        })
        return {
          columns: [
            { k: 'Asset ID', label: 'Asset ID' }, { k: 'Asset', label: 'Asset' }, { k: 'Cost (GHS)', label: 'Cost (GHS)', right: true },
            { k: 'Method', label: 'Method' }, { k: 'Accumulated (GHS)', label: 'Accumulated (GHS)', right: true },
            { k: 'Book Value (GHS)', label: 'Book Value (GHS)', right: true }, { k: 'Remaining Life (yrs)', label: 'Remaining Life (yrs)', right: true },
          ],
          rows,
          metrics: [
            { label: 'Depreciable assets', value: String(rows.length) },
            { label: 'Accumulated', value: formatGhs(sumNum(rows, 'Accumulated (GHS)')) },
            { label: 'Book value', value: formatGhs(sumNum(rows, 'Book Value (GHS)')) },
          ],
        }
      }
      case 'maintenance': {
        const rows = ctx.maint.map((m) => {
          const a = assets.find((x) => x.id === m.assetId)
          return row(
            { 'Asset ID': a?.tag || '—', Asset: a?.name || '—', Task: m.title, Type: m.type, Scheduled: formatDate(m.scheduledDate), Status: m.status, Priority: m.priority, 'Cost (GHS)': ghs(m.cost), 'Technician / Vendor': m.technician || '—', 'Next Service': m.nextDate ? formatDate(m.nextDate) : '—' },
            { date: m.scheduledDate, cat: a?.category, loc: a?.location, status: a?.status, emp: m.technician },
          )
        })
        const upcoming = ctx.maint.filter((m) => m.status === 'scheduled' && m.scheduledDate >= today).length
        return {
          columns: [
            { k: 'Asset ID', label: 'Asset ID' }, { k: 'Asset', label: 'Asset' }, { k: 'Task', label: 'Task' }, { k: 'Type', label: 'Type' },
            { k: 'Scheduled', label: 'Scheduled' }, { k: 'Status', label: 'Status' }, { k: 'Priority', label: 'Priority' },
            { k: 'Cost (GHS)', label: 'Cost (GHS)', right: true }, { k: 'Technician / Vendor', label: 'Technician / Vendor' }, { k: 'Next Service', label: 'Next Service' },
          ],
          rows,
          metrics: [
            { label: 'Maintenance jobs', value: String(rows.length) },
            { label: 'Upcoming', value: String(upcoming) },
            { label: 'Total cost', value: formatGhs(ctx.maint.reduce((s, m) => s + m.cost, 0)) },
          ],
        }
      }
      case 'disposal': {
        const rows = assetTransactions.filter((t) => t.type === 'dispose' || t.type === 'write_off').map((t) => {
          const a = assets.find((x) => x.id === t.assetId)
          return row(
            { 'Asset ID': a?.tag || '—', Asset: a?.name || '—', Type: txLabel(t.type), 'Disposal Date': formatDate(t.date), 'Method / Reason': t.reason || '—', 'Disposal Value (GHS)': ghs(t.amount ?? 0), 'Authorized By': t.performedBy || '—' },
            { date: t.date, cat: a?.category, loc: a?.location, status: a?.status, emp: t.performedBy },
          )
        })
        return {
          columns: [
            { k: 'Asset ID', label: 'Asset ID' }, { k: 'Asset', label: 'Asset' }, { k: 'Type', label: 'Type' },
            { k: 'Disposal Date', label: 'Disposal Date' }, { k: 'Method / Reason', label: 'Method / Reason' },
            { k: 'Disposal Value (GHS)', label: 'Disposal Value (GHS)', right: true }, { k: 'Authorized By', label: 'Authorized By' },
          ],
          rows,
          metrics: [
            { label: 'Disposals / write-offs', value: String(rows.length) },
            { label: 'Total disposal value', value: formatGhs(sumNum(rows, 'Disposal Value (GHS)')) },
          ],
        }
      }
      case 'transfer': {
        const rows = assetTransactions.filter((t) => t.type === 'transfer').map((t) => {
          const a = assets.find((x) => x.id === t.assetId)
          return row(
            { 'Asset ID': a?.tag || '—', Asset: a?.name || '—', From: t.from || '—', To: t.to || '—', 'Transfer Date': formatDate(t.date), 'Authorized By': t.performedBy || '—', Notes: t.notes || '—' },
            { date: t.date, cat: a?.category, loc: a?.location, status: a?.status, emp: t.performedBy },
          )
        })
        return {
          columns: [
            { k: 'Asset ID', label: 'Asset ID' }, { k: 'Asset', label: 'Asset' }, { k: 'From', label: 'From' }, { k: 'To', label: 'To' },
            { k: 'Transfer Date', label: 'Transfer Date' }, { k: 'Authorized By', label: 'Approved By' }, { k: 'Notes', label: 'Notes' },
          ],
          rows,
          metrics: [
            { label: 'Transfers', value: String(rows.length) },
            { label: 'Assets moved', value: String(new Set(rows.map((r) => r['Asset ID'])).size) },
          ],
        }
      }
      case 'warranty': {
        const rows = assets.filter((a) => a.warrantyExpiry).map((a) => {
          const days = Math.round((new Date(a.warrantyExpiry || '').getTime() - Date.now()) / 86400000)
          const state = days < 0 ? 'Expired' : days <= 30 ? 'Expiring soon' : 'Active'
          return row(
            { 'Asset ID': a.tag, Asset: a.name, Provider: a.warrantyProvider || '—', 'Warranty Start': a.purchaseDate ? formatDate(a.purchaseDate) : '—', 'Warranty Expiry': formatDate(a.warrantyExpiry || ''), 'Days Left': days, State: state, 'Value (GHS)': ghs(bookOf(a)) },
            { date: a.warrantyExpiry, cat: a.category, loc: a.location, status: a.status },
          )
        })
        return {
          columns: [
            { k: 'Asset ID', label: 'Asset ID' }, { k: 'Asset', label: 'Asset' }, { k: 'Provider', label: 'Warranty Provider' },
            { k: 'Warranty Start', label: 'Start' }, { k: 'Warranty Expiry', label: 'Expiry' }, { k: 'Days Left', label: 'Days Left', right: true },
            { k: 'State', label: 'State' }, { k: 'Value (GHS)', label: 'Value (GHS)', right: true },
          ],
          rows,
          metrics: [
            { label: 'Under warranty', value: String(rows.filter((r) => r.State !== 'Expired').length) },
            { label: 'Expiring ≤ 30 days', value: String(rows.filter((r) => r.State === 'Expiring soon').length) },
            { label: 'Expired', value: String(rows.filter((r) => r.State === 'Expired').length) },
          ],
        }
      }
      case 'verification': {
        const rows = ctx.auditItems.map((i) => {
          const a = assets.find((x) => x.id === i.assetId)
          const audit = ctx.audits.find((x) => x.id === i.auditId)
          const result = i.physicalStatus === 'verified' ? 'Match' : i.duplicateOfItemId ? 'Excess' : i.physicalStatus === 'missing' || i.physicalStatus === 'lost' ? 'Missing' : 'Mismatch'
          return row(
            { Audit: audit?.number || '—', 'Asset ID': i.assetTag, Asset: i.assetName, 'Register Location': i.expectedLocation || '—', 'Observed Location': i.observedLocation || '—', 'Physical Status': i.physicalStatus, Result: result },
            { date: audit?.date, cat: a?.category, loc: i.expectedLocation, status: a?.status },
          )
        })
        const count = (r: string) => rows.filter((x) => x.Result === r).length
        return {
          columns: [
            { k: 'Audit', label: 'Audit' }, { k: 'Asset ID', label: 'Asset ID' }, { k: 'Asset', label: 'Asset' },
            { k: 'Register Location', label: 'Register Location' }, { k: 'Observed Location', label: 'Observed Location' },
            { k: 'Physical Status', label: 'Physical Status' }, { k: 'Result', label: 'Result' },
          ],
          rows,
          metrics: [
            { label: 'Matched', value: String(count('Match')) }, { label: 'Missing', value: String(count('Missing')) },
            { label: 'Excess', value: String(count('Excess')) }, { label: 'Mismatched', value: String(count('Mismatch')) },
          ],
        }
      }
      case 'valuation': {
        const rows = assets.filter((a) => a.purchaseCost != null).map((a) => row(
          { 'Asset ID': a.tag, Asset: a.name, Category: a.category, 'Acquisition Cost (GHS)': ghs(a.purchaseCost || 0), 'Accumulated (GHS)': ghs(accumOf(a)), 'Current Value (GHS)': ghs(bookOf(a)) },
          { date: a.purchaseDate, cat: a.category, loc: a.location, status: a.status },
        ))
        const worth = sumNum(rows, 'Current Value (GHS)')
        return {
          columns: [
            { k: 'Asset ID', label: 'Asset ID' }, { k: 'Asset', label: 'Asset' }, { k: 'Category', label: 'Category' },
            { k: 'Acquisition Cost (GHS)', label: 'Acquisition Cost (GHS)', right: true }, { k: 'Accumulated (GHS)', label: 'Accumulated (GHS)', right: true },
            { k: 'Current Value (GHS)', label: 'Current Value (GHS)', right: true },
          ],
          rows,
          metrics: [
            { label: 'Assets valued', value: String(rows.length) },
            { label: 'Total acquisition cost', value: formatGhs(sumNum(rows, 'Acquisition Cost (GHS)')) },
            { label: 'Total organisation worth', value: formatGhs(worth) },
          ],
        }
      }
      case 'lost': {
        const rows = ctx.auditItems.filter((i) => ['missing', 'lost', 'damaged'].includes(i.physicalStatus)).map((i) => {
          const a = assets.find((x) => x.id === i.assetId)
          const audit = ctx.audits.find((x) => x.id === i.auditId)
          return row(
            { 'Asset ID': i.assetTag, Asset: i.assetName, Issue: i.physicalStatus, 'Incident Date': i.verifiedAt ? formatDate(i.verifiedAt.slice(0, 10)) : audit?.date || '—', 'Responsible Party': i.expectedCustodian || a?.assignedTo || '—', 'Recovery Status': a?.status === 'available' ? 'Recovered' : 'Open', 'Value (GHS)': ghs(bookOf(a || ({ purchaseCost: undefined } as Asset))) },
            { date: (i.verifiedAt || audit?.date || '').slice(0, 10), cat: a?.category, loc: a?.location, status: a?.status, emp: i.expectedCustodian },
          )
        })
        return {
          columns: [
            { k: 'Asset ID', label: 'Asset ID' }, { k: 'Asset', label: 'Asset' }, { k: 'Issue', label: 'Issue' },
            { k: 'Incident Date', label: 'Incident Date' }, { k: 'Responsible Party', label: 'Responsible Party' },
            { k: 'Recovery Status', label: 'Recovery Status' }, { k: 'Value (GHS)', label: 'Value (GHS)', right: true },
          ],
          rows,
          metrics: [
            { label: 'Incidents', value: String(rows.length) },
            { label: 'Open', value: String(rows.filter((r) => r['Recovery Status'] === 'Open').length) },
            { label: 'Value at risk', value: formatGhs(sumNum(rows, 'Value (GHS)')) },
          ],
        }
      }
      case 'audit': {
        const rows = ctx.auditLog.map((l) => row(
          { Date: formatDate(l.at.slice(0, 10)), Time: l.at.slice(11, 16), User: l.user, Action: l.action, Target: l.target, Details: l.details },
          { date: l.at.slice(0, 10), emp: l.user },
        ))
        return {
          columns: [
            { k: 'Date', label: 'Date' }, { k: 'Time', label: 'Time' }, { k: 'User', label: 'User' },
            { k: 'Action', label: 'Action' }, { k: 'Target', label: 'Target' }, { k: 'Details', label: 'Details' },
          ],
          rows,
          metrics: [
            { label: 'Audit events', value: String(rows.length) },
            { label: 'Users active', value: String(new Set(rows.map((r) => r.User)).size) },
          ],
        }
      }
      case 'department': {
        const map = new Map<string, { emps: Set<string>; count: number; cost: number; book: number }>()
        for (const a of assets) {
          const dep = a.assignedTo ? (deptOf(a.assignedTo) || 'Unassigned') : 'Unassigned'
          const cur = map.get(dep) || { emps: new Set<string>(), count: 0, cost: 0, book: 0 }
          if (a.assignedTo) cur.emps.add(a.assignedTo)
          cur.count += 1; cur.cost += a.purchaseCost || 0; cur.book += bookOf(a)
          map.set(dep, cur)
        }
        const rows = Array.from(map.entries()).map(([dep, v]) => row(
          { Department: dep, Employees: v.emps.size, 'Asset Count': v.count, 'Total Cost (GHS)': ghs(v.cost), 'Book Value (GHS)': ghs(v.book) },
          { dep },
        ))
        return {
          columns: [
            { k: 'Department', label: 'Department' }, { k: 'Employees', label: 'Employees', right: true },
            { k: 'Asset Count', label: 'Asset Count', right: true }, { k: 'Total Cost (GHS)', label: 'Total Cost (GHS)', right: true },
            { k: 'Book Value (GHS)', label: 'Book Value (GHS)', right: true },
          ],
          rows,
          metrics: [
            { label: 'Departments', value: String(rows.length) },
            { label: 'Assets tracked', value: String(assets.length) },
            { label: 'Book value', value: formatGhs(assets.reduce((s, a) => s + bookOf(a), 0)) },
          ],
        }
      }
      case 'location': {
        const map = new Map<string, { count: number; cost: number; book: number }>()
        for (const a of assets) {
          const cur = map.get(a.location) || { count: 0, cost: 0, book: 0 }
          cur.count += 1; cur.cost += a.purchaseCost || 0; cur.book += bookOf(a)
          map.set(a.location, cur)
        }
        const rows = Array.from(map.entries()).map(([loc, v]) => row(
          { Location: loc, 'Asset Count': v.count, 'Total Cost (GHS)': ghs(v.cost), 'Book Value (GHS)': ghs(v.book) },
          { loc },
        ))
        return {
          columns: [
            { k: 'Location', label: 'Location' }, { k: 'Asset Count', label: 'Quantity', right: true },
            { k: 'Total Cost (GHS)', label: 'Total Cost (GHS)', right: true }, { k: 'Book Value (GHS)', label: 'Book Value (GHS)', right: true },
          ],
          rows,
          metrics: [
            { label: 'Locations', value: String(rows.length) },
            { label: 'Assets', value: String(assets.length) },
            { label: 'Book value', value: formatGhs(assets.reduce((s, a) => s + bookOf(a), 0)) },
          ],
        }
      }
      case 'employee': {
        const rows = assets.filter((a) => a.assignedTo).map((a) => {
          const lastAssign = assetTransactions.filter((t) => t.type === 'assign' && t.assetId === a.id && t.to === a.assignedTo).sort((x, y) => x.date.localeCompare(y.date)).at(-1)
          const returns = assetTransactions.filter((t) => t.type === 'return' && t.assetId === a.id).length
          return row(
            { Employee: a.assignedTo || '—', Department: deptOf(a.assignedTo || ''), 'Asset ID': a.tag, Asset: a.name, 'Assigned Date': lastAssign ? formatDate(lastAssign.date) : '—', 'Asset Status': statusLabel(a.status), Returns: returns, 'Value (GHS)': ghs(bookOf(a)) },
            { date: lastAssign?.date, cat: a.category, loc: a.location, status: a.status, emp: a.assignedTo, dep: deptOf(a.assignedTo || '') },
          )
        })
        return {
          columns: [
            { k: 'Employee', label: 'Employee' }, { k: 'Department', label: 'Department' }, { k: 'Asset ID', label: 'Asset ID' },
            { k: 'Asset', label: 'Asset' }, { k: 'Assigned Date', label: 'Assignment Date' }, { k: 'Asset Status', label: 'Asset Status' },
            { k: 'Returns', label: 'Return History', right: true }, { k: 'Value (GHS)', label: 'Value (GHS)', right: true },
          ],
          rows,
          metrics: [
            { label: 'Employees holding assets', value: String(new Set(rows.map((r) => r.Employee)).size) },
            { label: 'Assets allocated', value: String(rows.length) },
            { label: 'Allocated value', value: formatGhs(sumNum(rows, 'Value (GHS)')) },
          ],
        }
      }
    }
  }

  const report = useMemo(() => build(reportId), [reportId, assets, assetTransactions, depreciation, ctx]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- generic filtering / sorting ----
  const rows = useMemo(() => {
    const q = f.q.trim().toLowerCase()
    const out = report.rows.filter((r) =>
      (!f.from || (r._date && r._date >= f.from)) &&
      (!f.to || (r._date && r._date <= f.to)) &&
      (!f.cat || r._cat === f.cat) &&
      (!f.loc || r._loc === f.loc) &&
      (!f.dep || r._dep === f.dep) &&
      (!f.status || r._status === f.status) &&
      (!f.emp || r._emp === f.emp) &&
      (!q || r._search.includes(q)))
    if (sort) {
      out.sort((a, b) => {
        const av = a[sort.key]; const bv = b[sort.key]
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sort.dir
        return String(av).localeCompare(String(bv)) * sort.dir
      })
    }
    return out
  }, [report, f, sort])

  const def = REPORT_DEFS.find((d) => d.id === reportId) || REPORT_DEFS[0]
  const activeFilters = [
    f.from && `From ${f.from}`, f.to && `To ${f.to}`, f.cat && `Category: ${f.cat}`, f.loc && `Location: ${f.loc}`,
    f.dep && `Department: ${f.dep}`, f.status && `Status: ${statusLabel(f.status)}`, f.emp && `Employee: ${f.emp}`, f.q && `Search: “${f.q}”`,
  ].filter(Boolean).join(' · ') || 'No filters applied'

  const exportRows = () => rows.map((r) => Object.fromEntries(report.columns.map((c) => [c.label, r[c.k] ?? ''])))

  const onExcel = async () => {
    setBusy('excel')
    const ok = await exportExcel(`asset-${reportId}-report`, exportRows())
    setBusy('')
    if (ok) toast.success('Excel export started', `${rows.length} rows → asset-${reportId}-report.xlsx`)
    else toast.error('Excel export failed')
  }
  const doPrint = (pdf: boolean) => {
    setPrinting(true)
    window.setTimeout(() => {
      document.body.classList.add('ar-printing')
      window.print()
      document.body.classList.remove('ar-printing')
      setPrinting(false)
      if (pdf) toast.success('PDF export ready', 'Choose “Save as PDF” in the print dialog.')
    }, 60)
  }

  const sheet = (
    <ReportSheet
      company={company?.name || 'FitPro'} address={company?.address || ''} contact={[company?.phone, company?.email].filter(Boolean).join(' · ')}
      brand={company?.brandPrimary || '#C8F542'} title={def.label} subtitle={def.desc} filters={activeFilters}
      metrics={report.metrics} columns={report.columns} rows={rows} user={user?.name || 'System'}
    />
  )

  return (
    <div>
      <PageHeader
        title="Asset Reports"
        desc="Generate, preview, print and export audit-ready asset management reports."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => doPrint(false)}><Printer className="size-4" /> Print</Button>
            <Button variant="outline" onClick={() => doPrint(true)}><FileDown className="size-4" /> Export PDF</Button>
            <Button onClick={onExcel} disabled={busy === 'excel'}><FileSpreadsheet className="size-4" /> Export Excel</Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* ---- report picker ---- */}
        <div className="card h-fit p-2">
          {REPORT_DEFS.map((d) => (
            <button key={d.id} type="button" onClick={() => { setReportId(d.id); setSort(null) }}
              className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${reportId === d.id ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400' : 'text-mist hover:bg-black/[0.04] hover:text-inherit dark:hover:bg-white/[0.06]'}`}>
              <d.icon className="size-4 shrink-0" /> {d.label}
            </button>
          ))}
        </div>

        <div className="min-w-0 space-y-4">
          {/* ---- filters ---- */}
          <div className="card p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Input type="date" aria-label="From date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
              <Input type="date" aria-label="To date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
              <Select aria-label="Category" value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })}>
                <option value="">All categories</option>
                {assetCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Select aria-label="Department" value={f.dep} onChange={(e) => setF({ ...f, dep: e.target.value })}>
                <option value="">All departments</option>
                {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </Select>
              <Select aria-label="Location" value={f.loc} onChange={(e) => setF({ ...f, loc: e.target.value })}>
                <option value="">All locations</option>
                {branches.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                {Array.from(new Set(assets.map((a) => a.location))).filter((l) => !branches.some((b) => b.name === l)).map((l) => <option key={l} value={l}>{l}</option>)}
              </Select>
              <Select aria-label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                <option value="">All statuses</option>
                {ASSET_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
              <Select aria-label="Employee" value={f.emp} onChange={(e) => setF({ ...f, emp: e.target.value })}>
                <option value="">All employees</option>
                {Array.from(new Set([...users.map((u) => u.name), ...assets.map((a) => a.assignedTo || '')].filter(Boolean))).map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
                <SearchField value={f.q} onChange={(v) => setF({ ...f, q: v })} placeholder="Search rows…" />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-mist">
              <span>{activeFilters}</span>
              <button type="button" className="cursor-pointer font-semibold underline-offset-2 hover:underline" onClick={() => setF({ from: '', to: '', cat: '', loc: '', dep: '', status: '', emp: '', q: '' })}>Clear filters</button>
            </div>
          </div>

          {/* ---- metrics ---- */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {report.metrics.map((m) => (
              <div key={m.label} className="card p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-mist">{m.label}</p>
                <p className="mt-1 text-xl font-bold">{m.value}</p>
              </div>
            ))}
          </div>

          {/* ---- preview ---- */}
          <div className="card table-wrap">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <h2 className="font-bold">{def.label} — preview</h2>
                <p className="text-xs text-mist">{def.desc}</p>
              </div>
              <Badge tone="orange">{rows.length} rows</Badge>
            </div>
            {rows.length === 0 ? (
              <Empty title="No rows for this report" desc="Adjust the filters or pick another report." />
            ) : (
              <div className="overflow-x-auto">
                <table className="data">
                  <thead>
                    <tr>
                      {report.columns.map((c) => (
                        <th key={c.k} className={c.right ? 'text-right' : ''}>
                          <button type="button" onClick={() => setSort((s) => (s?.key === c.k ? { key: c.k, dir: s.dir === 1 ? -1 : 1 } : { key: c.k, dir: 1 }))}
                            className="cursor-pointer uppercase hover:text-inherit">
                            {c.label}{sort?.key === c.k ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        {report.columns.map((c) => (
                          <td key={c.k} className={c.right ? 'text-right' : ''}>{r[c.k]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="border-t border-line px-4 py-2 text-[11px] text-mist">
              Generated {new Date().toLocaleString()} by {user?.name || 'System'} · FitPro Asset Management System
            </p>
          </div>
        </div>
      </div>

      {printing && createPortal(<div className="ar-print-root">{sheet}</div>, document.body)}
    </div>
  )
}

// ================= Printable A4 sheet =================
function ReportSheet({
  company, address, contact, brand, title, subtitle, filters, metrics, columns, rows, user,
}: {
  company: string; address: string; contact: string; brand: string
  title: string; subtitle: string; filters: string; metrics: Metric[]; columns: Col[]; rows: Row[]; user: string
}) {
  return (
    <div className="bg-white p-6 text-[11px] leading-snug text-zinc-900">
      {/* header */}
      <div className="flex items-start justify-between gap-4 border-b-2 border-zinc-900 pb-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg text-lg font-black text-zinc-900" style={{ background: brand }}>
            {company.slice(0, 1)}
          </span>
          <div>
            <p className="text-base font-black">{company}</p>
            <p className="text-zinc-600">{address}{address && contact ? ' · ' : ''}{contact}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-black uppercase tracking-wide">{title} Report</p>
          <p className="text-zinc-600">{subtitle}</p>
        </div>
      </div>
      <div className="flex justify-between gap-4 py-2 text-zinc-700">
        <span>Filters: {filters}</span>
        <span>Generated {new Date().toLocaleString()} · by {user}</span>
      </div>
      {/* metrics */}
      <div className="mb-3 grid grid-cols-4 gap-2">
        {metrics.map((m) => (
          <div key={m.label} className="rounded border border-zinc-300 px-2 py-1.5">
            <p className="text-[10px] font-bold uppercase text-zinc-500">{m.label}</p>
            <p className="text-sm font-black">{m.value}</p>
          </div>
        ))}
      </div>
      {/* table */}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.k} className={`border border-zinc-400 bg-zinc-100 px-2 py-1 font-bold uppercase ${c.right ? 'text-right' : 'text-left'}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td className="border border-zinc-400 px-2 py-3 text-center text-zinc-500" colSpan={columns.length}>No data for the selected filters.</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.k} className={`border border-zinc-300 px-2 py-1 ${c.right ? 'text-right' : ''}`}>{r[c.k]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {/* footer */}
      <div className="mt-4 flex items-center justify-between border-t border-zinc-400 pt-2 text-[10px] text-zinc-600">
        <span>{company} · Asset Management System · {rows.length} row{rows.length === 1 ? '' : 's'}</span>
        <span>Audit-ready · Generated {new Date().toLocaleString()} by {user}</span>
      </div>
    </div>
  )
}
