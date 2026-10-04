import { useEffect, useMemo, useState } from 'react'
import {
  Printer, Mail, CalendarClock, ChevronDown, ChevronRight, X, MousePointerClick, Search,
  Camera, ScrollText,
} from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts'
import { PageHeader, Button, Select, Input, Badge } from '../../components/ui'
import { ExportButtons } from '../../components/ExportButtons'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { exportCsv } from '../../lib/export'
import { SECTIONS, type ReportView, type Row, type Col } from '../../lib/purchaseReportDefs'
import {
  defaultFilters, type PurchaseFilters, BRANCHES, WAREHOUSES, SUPPLIERS, PRODUCTS,
  REQS, PTXNS,
} from '../../lib/purchaseAnalytics'
import { CATEGORIES, BRANDS, dmy, money2 } from '../../lib/salesAnalytics'

const A_COLOR = '#2563eb'
const B_COLOR = '#059669'
const PIE_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#e11d48', '#0284c7', '#65a30d', '#be123c', '#0d9488', '#9333ea']

type WorkspaceView = 'management' | 'procurement' | 'finance' | 'store'
const VIEW_SECTIONS: Record<WorkspaceView, string[] | null> = {
  management: null,
  procurement: ['exec', 'overview', 'req', 'po', 'grn', 'sup', 'prod', 'ret', 'invty', 'branch', 'kpi', 'graph'],
  finance: ['exec', 'overview', 'pinv', 'pay', 'cost', 'kpi', 'graph'],
  store: ['grn', 'invty', 'branch', 'prod', 'ret'],
}

function Chart({ view }: { view: ReportView }) {
  const c = view.chart
  if (!c) return null
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {c.kind === 'pie' ? (
          <PieChart>
            <Pie data={c.data} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="75%" paddingAngle={2}>
              {c.data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => Number(v).toLocaleString()} />
            <Legend />
          </PieChart>
        ) : c.kind === 'line' ? (
          <LineChart data={c.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => Number(v).toLocaleString()} />
            <Tooltip formatter={(v) => Number(v).toLocaleString()} />
            <Legend />
            <Line type="monotone" dataKey="a" name={c.aLabel} stroke={A_COLOR} strokeWidth={2} dot={false} />
            {c.bLabel && <Line type="monotone" dataKey="b" name={c.bLabel} stroke={B_COLOR} strokeWidth={2} dot={false} />}
          </LineChart>
        ) : c.kind === 'area' ? (
          <AreaChart data={c.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => Number(v).toLocaleString()} />
            <Legend />
            <Area type="monotone" dataKey="a" name={c.aLabel} stroke={A_COLOR} fill={A_COLOR} fillOpacity={0.25} />
          </AreaChart>
        ) : (
          <BarChart data={c.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => Number(v).toLocaleString()} />
            <Tooltip formatter={(v) => Number(v).toLocaleString()} />
            <Legend />
            <Bar dataKey="a" name={c.aLabel} fill={A_COLOR} radius={[3, 3, 0, 0]} />
            {c.bLabel && <Bar dataKey="b" name={c.bLabel} fill={B_COLOR} radius={[3, 3, 0, 0]} />}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

function DataTable({ cols, rows, onDrill, compact }: { cols: Col[]; rows: Row[]; onDrill?: (r: Row) => void; compact?: boolean }) {
  if (!rows.length) return <p className="py-10 text-center text-sm text-mist">No data for the selected filters.</p>
  return (
    <div className="max-h-[560px] overflow-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-black/[0.04] text-xs font-bold uppercase tracking-wide text-mist dark:bg-white/[0.06]">
            {cols.map((c) => <th key={c.key} className={`px-3 py-2.5 ${c.right ? 'text-right' : ''}`}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr
              key={i}
              onClick={r.__txns && onDrill ? () => onDrill(r) : undefined}
              className={`transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03] ${r.__txns && onDrill ? 'cursor-pointer' : ''}`}
            >
              {cols.map((c) => (
                <td key={c.key} className={`${compact ? 'px-3 py-1.5' : 'px-3 py-2'} ${c.right ? 'text-right tabular-nums' : ''}`}>
                  {String(r[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PurchaseReports() {
  const toast = useToast()
  const { user } = useAuth()
  const roleView: WorkspaceView = user?.role === 'accountant' || user?.role === 'head_office' ? 'finance'
    : user?.role === 'staff' || user?.role === 'branch_admin' ? 'store'
    : user?.role === 'super_admin' || user?.role === 'gym_manager' ? 'management' : 'management'
  const [viewMode, setViewMode] = useState<WorkspaceView>(roleView)
  const visible = useMemo(() => {
    const allowed = VIEW_SECTIONS[viewMode]
    return allowed ? SECTIONS.filter((s) => allowed.includes(s.id)) : SECTIONS
  }, [viewMode])

  const [sectionId, setSectionId] = useState(visible[0].id)
  const [reportId, setReportId] = useState(visible[0].reports[0].id)
  const [open, setOpen] = useState<string[]>([visible[0].id])
  const [f, setF] = useState<PurchaseFilters>(() => defaultFilters())
  const [drill, setDrill] = useState<{ title: string; txns: Row[] } | null>(null)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [schedOpen, setSchedOpen] = useState(false)
  const [schedFreq, setSchedFreq] = useState('weekly')
  const [schedTo, setSchedTo] = useState('')
  const [auditOpen, setAuditOpen] = useState(false)

  useEffect(() => {
    if (!visible.some((s) => s.id === sectionId)) {
      setSectionId(visible[0].id); setReportId(visible[0].reports[0].id); setOpen([visible[0].id])
    }
  }, [visible, sectionId])

  const section = visible.find((s) => s.id === sectionId) ?? visible[0]
  const report = section.reports.find((r) => r.id === reportId) ?? section.reports[0]
  const view = useMemo(() => report.build(f), [report, f])

  const pickReport = (sid: string, rid: string) => {
    setSectionId(sid); setReportId(rid)
    setOpen((o) => (o.includes(sid) ? o : [...o, sid]))
  }

  const exportRows = useMemo(() => view.rows.map((r) => {
    const out: Record<string, string | number> = {}
    for (const c of view.cols) out[c.label] = (r[c.key] as string | number) ?? ''
    return out
  }), [view])

  const snapshot = async () => {
    const ok = await exportCsv('procurement-dashboard-snapshot', view.metrics.map((m) => ({ Metric: m.label, Value: m.value, Note: m.sub ?? '' })))
    toast[ok ? 'success' : 'error']('Snapshot export', ok ? 'Dashboard KPI snapshot downloaded.' : 'Export failed.')
  }

  const auditRows: Row[] = useMemo(() => [
    ...REQS.map((q) => ({ ref: q.id, date: dmy(q.date), action: q.status, by: q.employee, dept: q.department, time: `${q.approvalDays}d` })),
    ...PTXNS.map((t) => ({ ref: t.reqId, date: dmy(t.reqDate), action: t.reqStatus, by: t.buyer, dept: t.department, time: `${t.approvalDays}d` })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 400), [])

  const drillCols: Col[] = [
    { key: 'id', label: 'PO' }, { key: 'date', label: 'Date' }, { key: 'supplier', label: 'Supplier' },
    { key: 'buyer', label: 'Buyer' }, { key: 'method', label: 'Method' }, { key: 'landed', label: 'Landed', right: true },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Purchases"
        title="Purchase Reports"
        desc="Enterprise procurement analytics: requisitions, purchase orders, GRNs, invoices, supplier payments, returns, costs and inventory planning."
        actions={<div className="flex flex-wrap items-center gap-1.5">
          <ExportButtons filename={view.exportName} rows={exportRows} onDone={(l, ok) => toast[ok ? 'success' : 'error'](`${l} export ${ok ? 'ready' : 'failed'}`, view.title)} />
          <Button onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
          <Button onClick={() => void snapshot()}><Camera className="size-4" /> Snapshot</Button>
          <Button onClick={() => setEmailOpen(true)}><Mail className="size-4" /> Email</Button>
          <Button onClick={() => setSchedOpen(true)}><CalendarClock className="size-4" /> Schedule</Button>
          <Button onClick={() => setAuditOpen(true)}><ScrollText className="size-4" /> Audit log</Button>
        </div>}
      />

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* ---- Report navigator ---- */}
        <aside className="card w-full flex-shrink-0 self-start overflow-hidden lg:w-72">
          <div className="space-y-2 border-b border-line p-3">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-mist"><Search className="size-3.5" /> Report Navigator</p>
            <Select value={viewMode} onChange={(e) => setViewMode(e.target.value as WorkspaceView)} aria-label="Workspace view">
              <option value="management">Management view</option>
              <option value="procurement">Procurement officer view</option>
              <option value="finance">Finance view</option>
              <option value="store">Store manager view</option>
            </Select>
          </div>
          <nav className="max-h-[64vh] overflow-y-auto p-2">
            {visible.map((s, i) => {
              const isOpen = open.includes(s.id)
              return (
                <div key={s.id} className="mb-1">
                  <button
                    type="button"
                    onClick={() => { setOpen((o) => (isOpen ? o.filter((x) => x !== s.id) : [...o, s.id])); setSectionId(s.id); setReportId(s.reports[0].id) }}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition ${sectionId === s.id ? 'bg-blue-500/10 text-blue-600 dark:text-blue-300' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`}
                  >
                    {isOpen ? <ChevronDown className="size-3.5 flex-shrink-0" /> : <ChevronRight className="size-3.5 flex-shrink-0" />}
                    <span className="min-w-0 flex-1 truncate">{i + 1}. {s.title}</span>
                    <span className="rounded-full bg-black/[0.06] px-1.5 text-[10px] font-bold text-mist dark:bg-white/10">{s.reports.length}</span>
                  </button>
                  {isOpen && (
                    <div className="ml-4 border-l border-line pl-2">
                      {s.reports.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => pickReport(s.id, r.id)}
                          className={`block w-full cursor-pointer truncate rounded-md px-2.5 py-1.5 text-left text-[13px] transition ${reportId === r.id ? 'bg-blue-500/15 font-semibold text-blue-600 dark:text-blue-300' : 'text-mist hover:bg-black/[0.04] hover:text-inherit dark:hover:bg-white/[0.06]'}`}
                        >
                          {r.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
        </aside>

        {/* ---- Report area ---- */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* Filters */}
          <div className="card p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <div>
                <label className="mb-1 block text-xs font-bold">Date range</label>
                <Select value={f.preset} onChange={(e) => setF({ ...f, preset: e.target.value as PurchaseFilters['preset'] })}>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                  <option value="year">This Year</option>
                  <option value="all">All time</option>
                  <option value="custom">Custom…</option>
                </Select>
              </div>
              {f.preset === 'custom' && (<>
                <div>
                  <label className="mb-1 block text-xs font-bold">From</label>
                  <Input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold">To</label>
                  <Input type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
                </div>
              </>)}
              <div>
                <label className="mb-1 block text-xs font-bold">Branch</label>
                <Select value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })}>
                  <option value="">All branches</option>
                  {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Warehouse</label>
                <Select value={f.warehouse} onChange={(e) => setF({ ...f, warehouse: e.target.value })}>
                  <option value="">All warehouses</option>
                  {WAREHOUSES.map((b) => <option key={b} value={b}>{b}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Supplier</label>
                <Select value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })}>
                  <option value="">All suppliers</option>
                  {SUPPLIERS.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Product</label>
                <Select value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })}>
                  <option value="">All products</option>
                  {PRODUCTS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Category</label>
                <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                  <option value="">All categories</option>
                  {CATEGORIES.map((b) => <option key={b} value={b}>{b}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Brand</label>
                <Select value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })}>
                  <option value="">All brands</option>
                  {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">PO status</label>
                <Select value={f.poStatus} onChange={(e) => setF({ ...f, poStatus: e.target.value })}>
                  <option value="">Any</option>
                  {['open', 'closed', 'pending', 'partial'].map((b) => <option key={b} value={b}>{b}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Invoice status</label>
                <Select value={f.invoiceStatus} onChange={(e) => setF({ ...f, invoiceStatus: e.target.value })}>
                  <option value="">Any</option>
                  {['paid', 'unpaid', 'overdue', 'partial'].map((b) => <option key={b} value={b}>{b}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Payment status</label>
                <Select value={f.paymentStatus} onChange={(e) => setF({ ...f, paymentStatus: e.target.value })}>
                  <option value="">Any</option>
                  {['paid', 'partial', 'unpaid'].map((b) => <option key={b} value={b}>{b}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Requisition status</label>
                <Select value={f.reqStatus} onChange={(e) => setF({ ...f, reqStatus: e.target.value })}>
                  <option value="">Any</option>
                  {['approved', 'pending', 'rejected'].map((b) => <option key={b} value={b}>{b}</option>)}
                </Select>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
              <p className="min-w-0 truncate text-xs text-mist">{view.filtersLine}</p>
              <Button size="sm" variant="ghost" onClick={() => setF(defaultFilters())}>Reset filters</Button>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {view.metrics.map((m) => (
              <div key={m.label} className="card p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-mist">{m.label}</p>
                <p className="mt-1 truncate text-xl font-bold" style={{ color: m.color }}>{m.value}</p>
                {m.sub && <p className="mt-0.5 text-xs text-mist">{m.sub}</p>}
              </div>
            ))}
          </div>

          {/* Chart */}
          {view.chart && (
            <div className="card p-4">
              <p className="mb-2 text-sm font-bold">{view.chartTitle}</p>
              <Chart view={view} />
            </div>
          )}

          {/* Table */}
          {view.cols.length > 0 && (
            <div className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-4">
                <div>
                  <p className="text-sm font-bold">{view.title}</p>
                  <p className="text-xs text-mist">{view.desc} · click a row to drill down</p>
                </div>
                <Badge tone="sky">{view.rows.length} rows</Badge>
              </div>
              <DataTable cols={view.cols} rows={view.rows} onDrill={(r) => {
                const txns = (r.__txns as Row[] | undefined) ?? []
                setDrill({
                  title: `${view.title} — ${String(r[view.cols[0].key] ?? '')}`,
                  txns: txns.map((t) => ({ id: t.id, date: dmy(String(t.date)), supplier: t.supplier, buyer: t.buyer, method: t.method, landed: money2(Number(t.landed ?? 0)) })),
                })
              }} />
            </div>
          )}

          {/* Extra tables */}
          {view.extra?.map((x) => (
            <div key={x.label} className="card overflow-hidden">
              <p className="border-b border-line p-4 text-sm font-bold">{x.label}</p>
              <DataTable cols={x.cols} rows={x.rows} compact />
            </div>
          ))}
        </div>
      </div>

      {/* ---- Drill-down ---- */}
      {drill && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setDrill(null)}>
          <div className="card max-h-[92vh] w-full overflow-y-auto rounded-t-2xl p-4 sm:max-w-3xl sm:rounded-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold"><MousePointerClick className="size-4" /> Drill-down</h2>
                <p className="mt-1 text-sm text-mist">{drill.title} · {drill.txns.length} underlying purchase orders</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setDrill(null)} className="-mr-1 cursor-pointer rounded-md p-1.5 transition hover:bg-black/[0.05] dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4">
              <DataTable cols={drillCols} rows={drill.txns} compact />
            </div>
          </div>
        </div>
      )}

      {/* ---- Audit log ---- */}
      {auditOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setAuditOpen(false)}>
          <div className="card max-h-[92vh] w-full overflow-y-auto rounded-t-2xl p-4 sm:max-w-3xl sm:rounded-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold"><ScrollText className="size-4" /> Approval Audit Log</h2>
                <p className="mt-1 text-sm text-mist">Requisition approval decisions across the organisation.</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setAuditOpen(false)} className="-mr-1 cursor-pointer rounded-md p-1.5 transition hover:bg-black/[0.05] dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4">
              <DataTable compact cols={[
                { key: 'ref', label: 'Ref' }, { key: 'date', label: 'Date' }, { key: 'action', label: 'Decision' },
                { key: 'by', label: 'By' }, { key: 'dept', label: 'Department' }, { key: 'time', label: 'Time', right: true },
              ]} rows={auditRows} />
            </div>
          </div>
        </div>
      )}

      {/* ---- Email report ---- */}
      {emailOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setEmailOpen(false)}>
          <div className="card w-full rounded-t-2xl p-4 sm:max-w-md sm:rounded-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="flex items-center gap-2 text-base font-bold"><Mail className="size-4" /> Email Report</h2>
            <p className="mt-1 text-sm text-mist">Send “{view.title}” with current filters as PDF & Excel attachments.</p>
            <div className="mt-4">
              <label className="mb-1 block text-xs font-bold">Recipient email</label>
              <Input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="e.g. cfo@fitpro.app" />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => setEmailOpen(false)}>Cancel</Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => {
                if (!emailTo.includes('@')) { toast.error('Enter a valid email address.'); return }
                setEmailOpen(false); toast.success('Report emailed', `“${view.title}” sent to ${emailTo}.`)
              }}><Mail className="size-4" /> Send now</Button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Schedule delivery ---- */}
      {schedOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setSchedOpen(false)}>
          <div className="card w-full rounded-t-2xl p-4 sm:max-w-md sm:rounded-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="flex items-center gap-2 text-base font-bold"><CalendarClock className="size-4" /> Schedule Report Delivery</h2>
            <p className="mt-1 text-sm text-mist">Automatically deliver “{view.title}” to a mailbox.</p>
            <div className="mt-4 grid gap-4">
              <div>
                <label className="mb-1 block text-xs font-bold">Frequency</label>
                <Select value={schedFreq} onChange={(e) => setSchedFreq(e.target.value)}>
                  <option value="daily">Daily at 7:00 AM</option>
                  <option value="weekly">Weekly (Mondays)</option>
                  <option value="monthly">Monthly (1st)</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Recipient email</label>
                <Input type="email" value={schedTo} onChange={(e) => setSchedTo(e.target.value)} placeholder="e.g. board@fitpro.app" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => setSchedOpen(false)}>Cancel</Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => {
                if (!schedTo.includes('@')) { toast.error('Enter a valid email address.'); return }
                setSchedOpen(false); toast.success('Delivery scheduled', `“${view.title}” will be sent ${schedFreq} to ${schedTo}.`)
              }}><CalendarClock className="size-4" /> Schedule</Button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Print sheet ---- */}
      <style>{`
        .pr-print { display: none; }
        @media print {
          body * { visibility: hidden; }
          .pr-print, .pr-print * { visibility: visible; }
          .pr-print { display: block; position: absolute; inset: 0; padding: 24px; background: white; color: #111; }
          .pr-print table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .pr-print th, .pr-print td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
          .pr-print th { background: #f3f4f6; text-transform: uppercase; }
        }
      `}</style>
      <section className="pr-print">
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>FitPro Gym Management — {view.title}</h1>
        <p style={{ fontSize: 11, margin: '4px 0 12px' }}>{view.filtersLine} · Generated {dmy(new Date().toISOString().slice(0, 10))} · {viewMode} view</p>
        <table>
          <thead><tr>{view.metrics.map((m) => <th key={m.label}>{m.label}</th>)}</tr></thead>
          <tbody><tr>{view.metrics.map((m) => <td key={m.label}><strong>{m.value}</strong>{m.sub ? ` (${m.sub})` : ''}</td>)}</tr></tbody>
        </table>
        {view.cols.length > 0 && (
          <table style={{ marginTop: 12 }}>
            <thead><tr>{view.cols.map((c) => <th key={c.key} style={{ textAlign: c.right ? 'right' : 'left' }}>{c.label}</th>)}</tr></thead>
            <tbody>
              {view.rows.slice(0, 200).map((r, i) => (
                <tr key={i}>{view.cols.map((c) => <td key={c.key} style={{ textAlign: c.right ? 'right' : 'left' }}>{String(r[c.key] ?? '—')}</td>)}</tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ fontSize: 10, marginTop: 12 }}>Igracesoft GH · FitPro ERP — confidential. Page generated by Purchase Reports module.</p>
      </section>
    </div>
  )
}
