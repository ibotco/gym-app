import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Printer, FileText, X, Users, ClipboardList, Receipt, Wallet, TrendingUp, CalendarClock,
  ScrollText, ClipboardCheck, Clock, PenLine, BarChart3,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageHeader, Button, Select } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { formatGhsExact, formatDate } from '../../../lib/utils'
import { TASK_STATUSES } from '../../../lib/tasks'
import {
  projectMetrics, utilisationByUser, monthlyBillingSeries, countByStatus, type ProjectMetrics,
} from '../../../lib/projectReports'
import { projectInvoiceLabel } from '../../../lib/projectInvoices'
import type { Project, ProjectContract } from '../../../types'

/* ── Status palettes ─────────────────────────────────────────────────── */

const PROJECT_STATUS_META: { id: string; label: string; color: string }[] = [
  { id: 'open', label: 'Open', color: '#17a2b8' },
  { id: 'pending', label: 'Pending', color: '#f5a623' },
  { id: 'in_progress', label: 'In progress', color: '#a855f7' },
  { id: 'on_hold', label: 'On hold', color: '#94a3b8' },
  { id: 'testing', label: 'Testing', color: '#3b82f6' },
  { id: 'completed', label: 'Completed', color: '#2ecc71' },
  { id: 'cancelled', label: 'Cancelled', color: '#ef4444' },
]

const INVOICE_STATUS_META: { id: string; label: string; color: string }[] = [
  { id: 'draft', label: 'Draft', color: '#94a3b8' },
  { id: 'sent', label: 'Sent', color: '#f5a623' },
  { id: 'paid', label: 'Paid', color: '#2ecc71' },
  { id: 'cancelled', label: 'Cancelled', color: '#ef4444' },
]

const pretty = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const projectStatusMeta = (id: string) =>
  PROJECT_STATUS_META.find((s) => s.id === id) || { id, label: pretty(id), color: '#94a3b8' }

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const TODAY = () => new Date().toISOString().slice(0, 10)

/* ── Chart primitives (inline SVG / CSS — no chart library) ──────────── */

type Segment = { label: string; value: number; color: string }

function Donut({ segments, size = 148, thickness = 20 }: { segments: Segment[]; size?: number; thickness?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Donut chart">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={thickness} opacity={0.08} />
        {total > 0 && segments.filter((s) => s.value > 0).map((s, i) => {
          const len = (s.value / total) * c
          const el = (
            <circle
              key={i}
              cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )
          offset += len
          return el
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-xl font-bold">{total}</p>
          <p className="text-[10px] uppercase tracking-wider opacity-60">total</p>
        </div>
      </div>
    </div>
  )
}

function Legend({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  return (
    <ul className="space-y-1.5">
      {segments.map((s) => (
        <li key={s.label} className="flex items-center gap-2 text-xs">
          <span className="size-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden />
          <span className="min-w-0 flex-1 truncate">{s.label}</span>
          <span className="font-semibold">{s.value}</span>
          <span className="w-10 text-right opacity-60">{total ? Math.round((s.value / total) * 100) : 0}%</span>
        </li>
      ))}
      {!segments.length && <li className="text-xs opacity-60">No data yet.</li>}
    </ul>
  )
}

/** Twin vertical bars per month — billed vs collected. */
function MonthlyBars({ series }: { series: { month: number; billed: number; collected: number }[] }) {
  const max = Math.max(1, ...series.map((m) => m.billed))
  return (
    <div>
      <div className="flex h-44 items-end gap-1.5" role="img" aria-label="Monthly billed vs collected">
        {series.map((m) => (
          <div key={m.month} className="flex h-full flex-1 items-end justify-center gap-[3px]">
            <div
              className="w-2/5 rounded-t transition-all"
              style={{ height: `${(m.billed / max) * 100}%`, minHeight: m.billed > 0 ? 3 : 0, background: '#3b82f6' }}
              title={`${MONTH_LABELS[m.month - 1]} billed: ${formatGhsExact(m.billed)}`}
            />
            <div
              className="w-2/5 rounded-t transition-all"
              style={{ height: `${(m.collected / max) * 100}%`, minHeight: m.collected > 0 ? 3 : 0, background: '#2ecc71' }}
              title={`${MONTH_LABELS[m.month - 1]} collected: ${formatGhsExact(m.collected)}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {series.map((m) => (
          <span key={m.month} className="flex-1 text-center text-[10px] font-semibold opacity-60">{MONTH_LABELS[m.month - 1][0]}</span>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-[11px]">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: '#3b82f6' }} /> Billed</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: '#2ecc71' }} /> Collected</span>
      </div>
    </div>
  )
}

/** Horizontal value bars — utilisation, etc. */
function HBars({ rows, suffix }: { rows: { label: string; value: number; sub?: string; color: string }[]; suffix?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate font-semibold">{r.label}</span>
            <span className="shrink-0 opacity-70">{r.sub}</span>
            <span className="shrink-0 font-bold">{r.value}{suffix}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-current" style={{ opacity: 0.08 }}>
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
          </div>
        </li>
      ))}
      {!rows.length && <li className="text-xs opacity-60">No data yet.</li>}
    </ul>
  )
}

/* ── Printable document catalogue ─────────────────────────────────────── */

type SheetSection = 'summary' | 'budget' | 'contracts' | 'tasks' | 'timesheets' | 'invoices' | 'signoff'

const SHEET_SECTIONS: { id: SheetSection; label: string; hint: string; icon: LucideIcon }[] = [
  { id: 'summary', label: 'Management summary', hint: 'KPIs, status breakdown, project & utilisation tables', icon: BarChart3 },
  { id: 'budget', label: 'Budget & cost report', hint: 'Budget vs labour cost, burn and remaining per project', icon: Wallet },
  { id: 'contracts', label: 'Contract agreement forms', hint: 'One signed-form page per contract in scope', icon: ScrollText },
  { id: 'tasks', label: 'Task sheets', hint: 'Checklist of every task per project, with assignees', icon: ClipboardCheck },
  { id: 'timesheets', label: 'Timesheet forms', hint: 'Per-project timesheet with declaration & signatures', icon: Clock },
  { id: 'invoices', label: 'Invoice schedule', hint: 'Invoice list and totals per project', icon: Receipt },
  { id: 'signoff', label: 'Client sign-off forms', hint: 'Handover acceptance form per project', icon: PenLine },
]

/* ── Page ─────────────────────────────────────────────────────────────── */

type Period = 'all' | 'month' | '90' | 'year'

export function ProjectReports() {
  const { projects, contracts, tasks, timesheets, projectInvoices, users, company } = useApp()

  const [period, setPeriod] = useState<Period>('all')
  const [fProject, setFProject] = useState('all')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetProject, setSheetProject] = useState('all')
  const [sections, setSections] = useState<Set<SheetSection>>(new Set<SheetSection>(['summary']))

  const toggleSection = (id: SheetSection) => setSections((cur) => {
    const next = new Set(cur)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const userName = (id?: string) => (id && users.find((u) => u.id === id)?.name) || 'Unassigned'

  // Theme tokens — same palette as the other project pages, either theme.
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark')); sync()
    const obs = new MutationObserver(sync); obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  const CARD_BG = isDark ? '#1b1f24' : '#ffffff'
  const PANEL_BD = isDark ? '#363c44' : '#e5e7eb'
  const PANEL_BG = isDark ? '#20252c' : '#f8fafc'
  const TABLE_HEAD_BG = isDark ? '#2a313b' : '#f1f5f9'
  const ROW_ALT = isDark ? '#1f242b' : '#f1f5f9'
  const TEXT = isDark ? '#e5e7eb' : '#0f172a'
  const TEXT_MUTED = isDark ? '#9aa3ad' : '#64748b'

  // Print mode classes — scoped to this page only (see index.css).
  useEffect(() => {
    document.body.classList.toggle('project-sheet-print', sheetOpen)
    document.body.classList.toggle('project-report-print', !sheetOpen)
    return () => {
      document.body.classList.remove('project-sheet-print')
      document.body.classList.remove('project-report-print')
    }
  }, [sheetOpen])

  /** Inclusive lower bound for the period filter ('' = no bound). */
  const periodFrom = useMemo(() => {
    const now = new Date()
    if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    if (period === '90') return new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10)
    if (period === 'year') return `${now.getFullYear()}-01-01`
    return ''
  }, [period])

  const periodLabel = period === 'month' ? 'This month' : period === '90' ? 'Last 90 days' : period === 'year' ? 'This year' : 'All time'

  /**
   * Every derived figure for one scope ('all' or a project id). Built once per
   * scope so the dashboard (its own filter) and the printable sheet (its own
   * scope picker) can report on different projects at the same time.
   */
  const buildScope = useCallback((projectId: string) => {
    const projectsIn = projectId === 'all' ? projects : projects.filter((p) => p.id === projectId)
    const timesheetsIn = timesheets.filter((t) => (!periodFrom || t.date >= periodFrom) && (projectId === 'all' || t.projectId === projectId))
    const invoicesIn = projectInvoices.filter((i) => (!periodFrom || i.invoiceDate >= periodFrom) && (projectId === 'all' || i.projectId === projectId))
    const tasksIn = tasks.filter((t) => (!periodFrom || t.dueDate >= periodFrom) && (projectId === 'all' || t.projectId === projectId))
    const contractsIn = contracts.filter((c) => projectId === 'all' || c.projectId === projectId)

    const met = projectMetrics(projectsIn, contractsIn, tasksIn, timesheetsIn, invoicesIn)
    const tot = {
      portfolio: projectsIn.reduce((s, p) => s + (Number(p.estimatedValue) || 0), 0),
      contracted: met.reduce((s, m) => s + m.contractValue, 0),
      billed: met.reduce((s, m) => s + m.billed, 0),
      collected: met.reduce((s, m) => s + m.collected, 0),
      outstanding: met.reduce((s, m) => s + m.outstanding, 0),
      labor: met.reduce((s, m) => s + m.laborCost, 0),
      hours: Math.round(met.reduce((s, m) => s + m.hours, 0) * 100) / 100,
      profit: met.reduce((s, m) => s + m.billed - m.laborCost, 0),
    }
    const margin = tot.billed > 0 ? (tot.profit / tot.billed) * 100 : 0

    const projectSegs: Segment[] = countByStatus(projectsIn, (p) => p.status, PROJECT_STATUS_META.map((s) => s.id))
      .map((c) => ({ label: projectStatusMeta(c.status).label, value: c.count, color: projectStatusMeta(c.status).color }))
    const taskSegs: Segment[] = countByStatus(tasksIn, (t) => t.status, TASK_STATUSES.map((s) => s.id))
      .map((c) => {
        const meta = TASK_STATUSES.find((s) => s.id === c.status)
        return { label: meta?.label || c.status, value: c.count, color: meta?.card || '#94a3b8' }
      })
    const invoiceSegs: Segment[] = countByStatus(invoicesIn, (i) => i.status, INVOICE_STATUS_META.map((s) => s.id))
      .map((c) => ({
        label: projectInvoiceLabel(c.status),
        value: c.count,
        color: INVOICE_STATUS_META.find((s) => s.id === c.status)?.color || '#94a3b8',
      }))

    return {
      projects: projectsIn,
      contracts: contractsIn,
      tasks: tasksIn,
      timesheets: timesheetsIn,
      invoices: invoicesIn,
      metrics: met,
      totals: tot,
      marginPct: margin,
      projectStatusSegments: projectSegs,
      taskStatusSegments: taskSegs,
      invoiceStatusSegments: invoiceSegs,
      utilisation: utilisationByUser(timesheetsIn).slice(0, 8),
      monthly: monthlyBillingSeries(invoicesIn, new Date().getFullYear()),
    }
  }, [projects, contracts, tasks, timesheets, projectInvoices, periodFrom])

  /** Dashboard scope (follows the page filter). */
  const view = useMemo(() => buildScope(fProject), [buildScope, fProject])
  /** Printable-sheet scope (follows the scope picker inside the print centre). */
  const sheet = useMemo(() => buildScope(sheetProject), [buildScope, sheetProject])

  const scopeName = (projectId: string) => (projectId === 'all' ? 'All projects' : (projects.find((p) => p.id === projectId)?.name || 'Selected project'))

  const kpisOf = (sc: typeof view) => [
    { label: 'Portfolio value', value: formatGhsExact(sc.totals.portfolio), sub: `${sc.projects.length} projects`, icon: ClipboardList, color: '#3b82f6' },
    { label: 'Contracted', value: formatGhsExact(sc.totals.contracted), sub: `${sc.contracts.filter((c) => c.status !== 'declined').length} contracts`, icon: FileText, color: '#a855f7' },
    { label: 'Billed', value: formatGhsExact(sc.totals.billed), sub: `sent + paid · ${periodLabel}`, icon: Receipt, color: '#f5a623' },
    { label: 'Collected', value: formatGhsExact(sc.totals.collected), sub: `outstanding ${formatGhsExact(sc.totals.outstanding)}`, icon: Wallet, color: '#2ecc71' },
    { label: 'Labour cost', value: formatGhsExact(sc.totals.labor), sub: `${sc.totals.hours} h logged`, icon: Users, color: '#17a2b8' },
    { label: 'Profit', value: formatGhsExact(sc.totals.profit), sub: `${sc.marginPct.toFixed(1)}% margin`, icon: TrendingUp, color: sc.totals.profit >= 0 ? '#22c55e' : '#ef4444' },
  ]
  const kpis = kpisOf(view)

  const burnColor = (m: ProjectMetrics) =>
    !m.budget ? '#94a3b8' : m.burn > 1 ? '#ef4444' : m.burn > m.timeElapsed / 100 ? '#f5a623' : '#2ecc71'

  /* ── Printable document building blocks ────────────────────────────── */

  const letterhead = (title: string, meta: string[]) => (
    <div className="flex items-start justify-between border-b border-zinc-300 pb-4">
      <div>
        <p className="font-display text-xl font-bold">{company.name}</p>
        <p className="text-xs text-zinc-500">
          {[company.address, company.phone].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>
      <div className="text-right">
        <p className="font-bold uppercase tracking-wide">{title}</p>
        {meta.map((m) => <p key={m} className="text-xs text-zinc-500">{m}</p>)}
      </div>
    </div>
  )

  const docFooter = (title: string) => (
    <div className="mt-8 flex items-end justify-between border-t border-zinc-200 pt-4 text-[11px] text-zinc-500">
      <p>Generated by {company.name} · Project Management module · {formatDate(TODAY())}</p>
      <p>{title}</p>
    </div>
  )

  /** One printable A4 page inside the sheet. */
  const SheetPage = ({ title, meta, children }: { title: string; meta: string[]; children: React.ReactNode }) => (
    <div className="report-page bg-white text-sm text-zinc-900">
      {letterhead(title, meta)}
      {children}
      {docFooter(title)}
    </div>
  )

  const sigBlock = (labels: string[]) => (
    <div className="mt-10 flex flex-wrap items-end justify-between gap-8">
      {labels.map((l) => (
        <div key={l} className="min-w-[180px] flex-1">
          <div className="mb-1 h-8 border-b border-zinc-400" />
          <p className="text-[11px] text-zinc-500">{l}</p>
        </div>
      ))}
    </div>
  )

  const kvGrid = (pairs: [string, string][]) => (
    <div className="mt-4 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
      {pairs.map(([k, v]) => (
        <p key={k}><span className="font-semibold text-zinc-800">{k}:</span> {v || '—'}</p>
      ))}
    </div>
  )

  /** Documents for one project — task sheet, timesheet, invoice schedule, sign-off. */
  const projectDocs = (sc: typeof view, p: Project, m: ProjectMetrics) => {
    const out: React.ReactNode[] = []
    const pTasks = sc.tasks.filter((t) => t.projectId === p.id)
    const pTimes = sc.timesheets.filter((t) => t.projectId === p.id)
    const pInvoices = sc.invoices.filter((i) => i.projectId === p.id)

    if (sections.has('tasks')) {
      const ordered = ['to_do', 'in_progress', 'review', 'completed']
        .flatMap((st) => pTasks.filter((t) => t.status === st))
        .concat(pTasks.filter((t) => !['to_do', 'in_progress', 'review', 'completed'].includes(t.status)))
      out.push(
        <SheetPage key={`tasks-${p.id}`} title="Task Sheet" meta={[p.name, `Client: ${p.clientName}`, `Due window: ${p.startDate} → ${p.endDate}`]}>
          <p className="mt-4 text-xs text-zinc-500">
            Tick each task as it is completed. Progress to date: <b>{p.progress}%</b> · {m.tasksDone} of {m.taskCount} task(s) done.
          </p>
          <div className="mt-3">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-y border-zinc-400 text-left uppercase tracking-wide text-zinc-600">
                  <th className="w-8 px-2 py-2">✓</th>
                  <th className="px-2 py-2">Task</th>
                  <th className="px-2 py-2">Priority</th>
                  <th className="px-2 py-2">Assigned to</th>
                  <th className="px-2 py-2">Start</th>
                  <th className="px-2 py-2">Due</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((t) => (
                  <tr key={t.id} className="border-t border-zinc-100">
                    <td className="px-2 py-1.5 text-center"><span className="inline-block size-3.5 border border-zinc-400 align-middle" /></td>
                    <td className="px-2 py-1.5 font-semibold">{t.name}</td>
                    <td className="px-2 py-1.5">{pretty(t.priority)}</td>
                    <td className="px-2 py-1.5">{userName(t.assigneeId)}</td>
                    <td className="px-2 py-1.5">{formatDate(t.startDate)}</td>
                    <td className="px-2 py-1.5">{formatDate(t.dueDate)}</td>
                    <td className="px-2 py-1.5">{TASK_STATUSES.find((s) => s.id === t.status)?.label || pretty(t.status)}</td>
                  </tr>
                ))}
                {!ordered.length && <tr><td colSpan={7} className="px-2 py-6 text-center text-zinc-500">No tasks on this project.</td></tr>}
              </tbody>
            </table>
          </div>
          {sigBlock(['Prepared by (name & signature)', 'Reviewed by (project manager)'])}
        </SheetPage>,
      )
    }

    if (sections.has('timesheets')) {
      const byUser = new Map<string, typeof pTimes>()
      for (const t of pTimes) byUser.set(t.userId, [...(byUser.get(t.userId) || []), t])
      out.push(
        <SheetPage key={`ts-${p.id}`} title="Timesheet" meta={[p.name, `Period: ${periodLabel}`, `${m.hours} h · ${formatGhsExact(m.laborCost)}`]}>
          {Array.from(byUser.entries()).map(([uid, entries]) => (
            <div key={uid} className="mt-4">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-zinc-500">{entries[0].userName}</p>
              <div className="">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="border-y border-zinc-400 text-left uppercase tracking-wide text-zinc-600">
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">Task / activity</th>
                      <th className="px-2 py-2">Start</th>
                      <th className="px-2 py-2">End</th>
                      <th className="px-2 py-2 text-right">Hours</th>
                      <th className="px-2 py-2 text-right">Rate</th>
                      <th className="px-2 py-2 text-right">Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((t) => (
                      <tr key={t.id} className="border-t border-zinc-100">
                        <td className="px-2 py-1.5">{formatDate(t.date)}</td>
                        <td className="px-2 py-1.5">{t.task}</td>
                        <td className="px-2 py-1.5">{t.startTime.slice(0, 5)}</td>
                        <td className="px-2 py-1.5">{t.endTime.slice(0, 5)}</td>
                        <td className="px-2 py-1.5 text-right">{t.hours}</td>
                        <td className="px-2 py-1.5 text-right">{formatGhsExact(t.rate)}</td>
                        <td className="px-2 py-1.5 text-right">{formatGhsExact(t.earnings)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-zinc-300 bg-zinc-50 font-bold">
                      <td className="px-2 py-1.5" colSpan={4}>Totals — {entries[0].userName}</td>
                      <td className="px-2 py-1.5 text-right">{Math.round(entries.reduce((s, t) => s + t.hours, 0) * 100) / 100}</td>
                      <td className="px-2 py-1.5" />
                      <td className="px-2 py-1.5 text-right">{formatGhsExact(entries.reduce((s, t) => s + t.earnings, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {!byUser.size && <p className="mt-4 text-xs text-zinc-500">No timesheet entries on this project in this period.</p>}
          <p className="mt-4 text-[11px] text-zinc-500">
            I declare that the hours recorded above are a true account of work performed on this project.
          </p>
          {sigBlock(['Employee (name & signature)', 'Supervisor (name & signature)'])}
        </SheetPage>,
      )
    }

    if (sections.has('invoices')) {
      out.push(
        <SheetPage key={`inv-${p.id}`} title="Invoice Schedule" meta={[p.name, `Client: ${p.clientName}`, `Billed ${formatGhsExact(m.billed)} · Collected ${formatGhsExact(m.collected)}`]}>
          <div className="mt-4">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-y border-zinc-400 text-left uppercase tracking-wide text-zinc-600">
                  <th className="px-2 py-2">Invoice</th>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Due</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2 text-right">Subtotal</th>
                  <th className="px-2 py-2 text-right">Tax</th>
                  <th className="px-2 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {pInvoices.map((i) => (
                  <tr key={i.id} className="border-t border-zinc-100">
                    <td className="px-2 py-1.5 font-mono font-semibold">{i.number}</td>
                    <td className="px-2 py-1.5">{formatDate(i.invoiceDate)}</td>
                    <td className="px-2 py-1.5">{i.dueDate ? formatDate(i.dueDate) : '—'}</td>
                    <td className="px-2 py-1.5">{projectInvoiceLabel(i.status)}</td>
                    <td className="px-2 py-1.5 text-right">{formatGhsExact(i.subtotal)}</td>
                    <td className="px-2 py-1.5 text-right">{formatGhsExact(i.tax)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{formatGhsExact(i.total)}</td>
                  </tr>
                ))}
                {!pInvoices.length && <tr><td colSpan={7} className="px-2 py-6 text-center text-zinc-500">No invoices on this project in this period.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex justify-end">
            <div className="w-64 space-y-1 text-xs">
              <div className="flex justify-between"><span>Billed (sent + paid)</span><b>{formatGhsExact(m.billed)}</b></div>
              <div className="flex justify-between"><span>Collected (paid)</span><b>{formatGhsExact(m.collected)}</b></div>
              <div className="flex justify-between border-t border-zinc-300 pt-1 text-sm font-bold"><span>Outstanding</span><span>{formatGhsExact(m.outstanding)}</span></div>
            </div>
          </div>
        </SheetPage>,
      )
    }

    if (sections.has('signoff')) {
      out.push(
        <SheetPage key={`sign-${p.id}`} title="Project Handover & Client Sign-Off" meta={[p.name, `Client: ${p.clientName}`, `Completion: ${p.progress}%`]}>
          {kvGrid([
            ['Project', p.name],
            ['Client', `${p.clientName} (${p.clientPhone || '—'})`],
            ['Project manager', userName(p.managerId)],
            ['Status', projectStatusMeta(p.status).label],
            ['Start date', formatDate(p.startDate)],
            ['End date', formatDate(p.endDate)],
            ['Contracted value', m.contractValue ? formatGhsExact(m.contractValue) : '—'],
            ['Completion', `${p.progress}%`],
          ])}
          <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-zinc-500">Deliverables accepted</p>
          {[1, 2, 3].map((n) => (
            <div key={n} className="mb-3 flex items-center gap-3">
              <span className="inline-block size-3.5 shrink-0 border border-zinc-400" />
              <span className="h-5 flex-1 border-b border-dotted border-zinc-300" />
            </div>
          ))}
          <p className="mt-4 text-[11px] leading-relaxed text-zinc-600">
            By signing below, the client confirms that the works and deliverables listed above have been inspected and
            accepted, and that the project is handed over as at the date of signature. Outstanding obligations, if any,
            are recorded in the invoice schedule attached to this form.
          </p>
          {sigBlock(['Client (name, signature & date)', `For ${company.name} (name, signature & date)`])}
        </SheetPage>,
      )
    }

    return out
  }

  /** Contract agreement form — one page per contract in scope. */
  const contractDoc = (c: ProjectContract) => (
    <SheetPage key={`c-${c.id}`} title="Contract Agreement" meta={[`Ref: ${c.id}`, `Status: ${pretty(c.status)}`, `Value: ${formatGhsExact(c.value)}`]}>
      <p className="mt-5 text-xs leading-relaxed text-zinc-700">
        This Contract Agreement (“the Agreement”) is entered into on <b>{formatDate(c.startDate)}</b> by and between:
      </p>
      <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
        <div className="border-t-2 border-zinc-400 pt-2">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">The Provider</p>
          <p className="font-bold">{company.name}</p>
          <p className="text-zinc-600">{company.address || '—'}</p>
          <p className="text-zinc-600">{[company.phone, company.email].filter(Boolean).join(' · ') || '—'}</p>
        </div>
        <div className="border-t-2 border-zinc-400 pt-2">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">The Client</p>
          <p className="font-bold">{c.clientName}</p>
          <p className="text-zinc-600">In respect of the project: <b>{c.projectName}</b></p>
        </div>
      </div>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-zinc-700">
        <li><b>Subject of engagement.</b> {c.subject}{c.description ? ` — ${c.description}` : '.'}</li>
        <li><b>Contract value.</b> The total value of this Agreement is <b>{formatGhsExact(c.value)}</b>, invoiced per the invoice schedule issued by the Provider.</li>
        <li><b>Term.</b> Works commence on <b>{formatDate(c.startDate)}</b> and complete by <b>{formatDate(c.endDate)}</b>, subject to variations agreed in writing.</li>
        <li><b>Payment.</b> Payment is due against each invoice within the terms stated thereon; outstanding balances attract the Provider&apos;s standard credit policy.</li>
        <li><b>Changes.</b> Any change to scope, value or timeline must be agreed in writing by both parties before execution.</li>
        <li><b>Acceptance.</b> Completion is confirmed on the Project Handover &amp; Client Sign-Off form.</li>
      </ol>
      {sigBlock(['For the Provider (name, signature & date)', 'For the Client (name, signature & date)'])}
    </SheetPage>
  )

  /** Assemble every selected document, in catalogue order, for the sheet scope. */
  const sheetPages: React.ReactNode[] = []
  if (sections.has('summary')) {
    sheetPages.push(
      <SheetPage key="summary" title="Management Summary" meta={[`Generated ${formatDate(TODAY())}`, `Period: ${periodLabel}`, scopeName(sheetProject)]}>
        <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-zinc-500">Summary</p>
        <div className="grid grid-cols-3 text-xs sm:grid-cols-6">
          {([
            ['Portfolio value', formatGhsExact(sheet.totals.portfolio)],
            ['Contracted', formatGhsExact(sheet.totals.contracted)],
            ['Billed', formatGhsExact(sheet.totals.billed)],
            ['Collected', formatGhsExact(sheet.totals.collected)],
            ['Labour cost', formatGhsExact(sheet.totals.labor)],
            ['Profit', `${formatGhsExact(sheet.totals.profit)} (${sheet.marginPct.toFixed(1)}%)`],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} className="border-t-2 border-zinc-400 pt-2 pr-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{k}</p>
              <p className="mt-0.5 text-sm font-bold">{v}</p>
            </div>
          ))}
        </div>
        <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-zinc-500">Status breakdown</p>
        <div className="grid gap-3 text-xs sm:grid-cols-3">
          <div className="border-t-2 border-zinc-400 pt-2">
            <p className="mb-1.5 font-bold">Projects</p>
            {sheet.projectStatusSegments.map((s) => <p key={s.label} className="flex justify-between"><span>{s.label}</span><b>{s.value}</b></p>)}
          </div>
          <div className="border-t-2 border-zinc-400 pt-2">
            <p className="mb-1.5 font-bold">Tasks</p>
            {sheet.taskStatusSegments.map((s) => <p key={s.label} className="flex justify-between"><span>{s.label}</span><b>{s.value}</b></p>)}
          </div>
          <div className="border-t-2 border-zinc-400 pt-2">
            <p className="mb-1.5 font-bold">Invoices</p>
            {sheet.invoiceStatusSegments.map((s) => <p key={s.label} className="flex justify-between"><span>{s.label}</span><b>{s.value}</b></p>)}
          </div>
        </div>
        <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-zinc-500">Projects</p>
        <div className="">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-y border-zinc-400 text-left uppercase tracking-wide text-zinc-600">
                <th className="px-2.5 py-2">Project</th>
                <th className="px-2.5 py-2">Client</th>
                <th className="px-2.5 py-2 text-right">Progress</th>
                <th className="px-2.5 py-2 text-right">Hours</th>
                <th className="px-2.5 py-2 text-right">Labour cost</th>
                <th className="px-2.5 py-2 text-right">Billed</th>
                <th className="px-2.5 py-2 text-right">Collected</th>
                <th className="px-2.5 py-2 text-right">Profit</th>
              </tr>
            </thead>
            <tbody>
              {sheet.metrics.map((m) => (
                <tr key={m.project.id} className="border-t border-zinc-100">
                  <td className="px-2.5 py-1.5 font-semibold">{m.project.name}</td>
                  <td className="px-2.5 py-1.5">{m.project.clientName}</td>
                  <td className="px-2.5 py-1.5 text-right">{m.project.progress}%</td>
                  <td className="px-2.5 py-1.5 text-right">{m.hours}</td>
                  <td className="px-2.5 py-1.5 text-right">{formatGhsExact(m.laborCost)}</td>
                  <td className="px-2.5 py-1.5 text-right">{formatGhsExact(m.billed)}</td>
                  <td className="px-2.5 py-1.5 text-right">{formatGhsExact(m.collected)}</td>
                  <td className="px-2.5 py-1.5 text-right font-semibold">{formatGhsExact(m.billed - m.laborCost)}</td>
                </tr>
              ))}
              {!sheet.metrics.length && (
                <tr><td colSpan={8} className="px-2.5 py-6 text-center text-zinc-500">No projects in this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-zinc-500">Resource utilisation</p>
        <div className="">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-y border-zinc-400 text-left uppercase tracking-wide text-zinc-600">
                <th className="px-2.5 py-2">Team member</th>
                <th className="px-2.5 py-2 text-right">Hours</th>
                <th className="px-2.5 py-2 text-right">Earnings</th>
              </tr>
            </thead>
            <tbody>
              {sheet.utilisation.map((u) => (
                <tr key={u.userId} className="border-t border-zinc-100">
                  <td className="px-2.5 py-1.5">{u.userName}</td>
                  <td className="px-2.5 py-1.5 text-right">{u.hours}</td>
                  <td className="px-2.5 py-1.5 text-right">{formatGhsExact(u.earnings)}</td>
                </tr>
              ))}
              {!sheet.utilisation.length && (
                <tr><td colSpan={3} className="px-2.5 py-6 text-center text-zinc-500">No timesheet entries in this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SheetPage>,
    )
  }

  if (sections.has('budget')) {
    sheetPages.push(
      <SheetPage key="budget" title="Budget & Cost Report" meta={[`Generated ${formatDate(TODAY())}`, `Period: ${periodLabel}`, scopeName(sheetProject)]}>
        <div className="mt-4">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-y border-zinc-400 text-left uppercase tracking-wide text-zinc-600">
                <th className="px-2.5 py-2">Project</th>
                <th className="px-2.5 py-2 text-right">Budget</th>
                <th className="px-2.5 py-2 text-right">Labour cost</th>
                <th className="px-2.5 py-2 text-right">Burn</th>
                <th className="px-2.5 py-2 text-right">Remaining</th>
                <th className="px-2.5 py-2 text-right">Time elapsed</th>
                <th className="px-2.5 py-2 text-right">Progress</th>
              </tr>
            </thead>
            <tbody>
              {sheet.metrics.map((m) => (
                <tr key={m.project.id} className="border-t border-zinc-100">
                  <td className="px-2.5 py-1.5 font-semibold">{m.project.name}</td>
                  <td className="px-2.5 py-1.5 text-right">{m.budget ? formatGhsExact(m.budget) : '—'}</td>
                  <td className="px-2.5 py-1.5 text-right">{formatGhsExact(m.laborCost)}</td>
                  <td className="px-2.5 py-1.5 text-right">{m.budget ? `${Math.round(m.burn * 100)}%` : '—'}</td>
                  <td className="px-2.5 py-1.5 text-right">{m.budget ? formatGhsExact(Math.max(0, m.budget - m.laborCost)) : '—'}</td>
                  <td className="px-2.5 py-1.5 text-right">{Math.round(m.timeElapsed)}%</td>
                  <td className="px-2.5 py-1.5 text-right">{m.project.progress}%</td>
                </tr>
              ))}
              {!sheet.metrics.length && <tr><td colSpan={7} className="px-2.5 py-6 text-center text-zinc-500">No projects in scope.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
          Burn is labour cost recorded through timesheets against the project&apos;s estimated value. A burn percentage
          ahead of time elapsed indicates the project is spending faster than it is progressing.
        </p>
        {sigBlock(['Prepared by (name & signature)', 'Approved by (name & signature)'])}
      </SheetPage>,
    )
  }

  if (sections.has('contracts')) {
    if (sheet.contracts.length) sheet.contracts.forEach((c) => sheetPages.push(contractDoc(c)))
    else sheetPages.push(
      <SheetPage key="contracts-empty" title="Contract Agreement" meta={['No contracts in scope']}>
        <p className="mt-6 text-xs text-zinc-500">No contracts are recorded for the selected project scope.</p>
      </SheetPage>,
    )
  }

  for (const m of sheet.metrics) {
    if (sections.has('tasks') || sections.has('timesheets') || sections.has('invoices') || sections.has('signoff')) {
      sheetPages.push(...projectDocs(sheet, m.project, m))
    }
  }

  return (
    <div id="project-reports">
      <PageHeader
        title="Project reports"
        desc="Profitability, timelines, budget burn and resource utilisation across every project — on screen and on paper."
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" /> Print dashboard</Button>
            <Button onClick={() => { setSheetProject(fProject); setSheetOpen(true) }}><FileText className="size-4" /> Printable reports</Button>
          </div>
        }
      />

      {/* ── Controls ───────────────────────────────────────────────────── */}
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="w-44" aria-label="Reporting period">
          <option value="all">All time</option>
          <option value="month">This month</option>
          <option value="90">Last 90 days</option>
          <option value="year">This year</option>
        </Select>
        <Select value={fProject} onChange={(e) => setFProject(e.target.value)} className="w-64" aria-label="Project filter">
          <option value="all">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <span className="text-xs" style={{ color: TEXT_MUTED }}>
          {periodFrom ? `From ${formatDate(periodFrom)}` : 'All time'} · {view.projects.length} project(s)
        </span>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border p-4" style={{ background: CARD_BG, borderColor: PANEL_BD }}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: TEXT_MUTED }}>{k.label}</p>
              <k.icon className="size-4" style={{ color: k.color }} aria-hidden />
            </div>
            <p className="mt-1.5 font-display text-lg font-bold" style={{ color: k.color }}>{k.value}</p>
            <p className="mt-0.5 text-[11px]" style={{ color: TEXT_MUTED }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Status donuts ──────────────────────────────────────────────── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {([
          ['Projects by status', view.projectStatusSegments],
          ['Tasks by status', view.taskStatusSegments],
          ['Invoices by status', view.invoiceStatusSegments],
        ] as [string, Segment[]][]).map(([title, segs]) => (
          <section key={title} className="rounded-xl border p-4" style={{ background: CARD_BG, borderColor: PANEL_BD }}>
            <h3 className="mb-3 text-sm font-bold" style={{ color: TEXT }}>{title}</h3>
            <div className="flex items-center gap-4">
              <Donut segments={segs} />
              <div className="min-w-0 flex-1" style={{ color: TEXT }}>
                <Legend segments={segs} />
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* ── Billing trend + utilisation ────────────────────────────────── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border p-4" style={{ background: CARD_BG, borderColor: PANEL_BD }}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: TEXT }}>
            <CalendarClock className="size-4" aria-hidden /> Billing trend — {new Date().getFullYear()}
          </h3>
          <MonthlyBars series={view.monthly} />
        </section>
        <section className="rounded-xl border p-4" style={{ background: CARD_BG, borderColor: PANEL_BD }}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: TEXT }}>
            <Users className="size-4" aria-hidden /> Resource utilisation — top {view.utilisation.length || 0} by hours
          </h3>
          <div style={{ color: TEXT }}>
            <HBars
              rows={view.utilisation.map((u) => ({
                label: u.userName,
                value: u.hours,
                sub: formatGhsExact(u.earnings),
                color: '#a855f7',
              }))}
              suffix=" h"
            />
          </div>
        </section>
      </div>

      {/* ── Budget burn & timeline ─────────────────────────────────────── */}
      <section className="mt-4 rounded-xl border p-4" style={{ background: CARD_BG, borderColor: PANEL_BD }}>
        <h3 className="mb-1 text-sm font-bold" style={{ color: TEXT }}>Budget burn vs time elapsed</h3>
        <p className="mb-3 text-xs" style={{ color: TEXT_MUTED }}>
          Spend turning amber ahead of the grey time bar means the project is burning faster than it is progressing.
        </p>
        <div className="space-y-3.5">
          {view.metrics.map((m) => (
            <div key={m.project.id}>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs">
                <span className="font-semibold" style={{ color: TEXT }}>{m.project.name}</span>
                <span style={{ color: TEXT_MUTED }}>
                  {m.budget
                    ? <>spend <b style={{ color: burnColor(m) }}>{formatGhsExact(m.laborCost)}</b> / {formatGhsExact(m.budget)} ({Math.round(m.burn * 100)}%) · time {Math.round(m.timeElapsed)}% · progress {m.project.progress}%</>
                    : <>no budget set · spend {formatGhsExact(m.laborCost)} · progress {m.project.progress}%</>}
                </span>
              </div>
              <div className="space-y-1">
                <div className="h-2 overflow-hidden rounded-full" style={{ background: PANEL_BG }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, m.burn * 100)}%`, background: burnColor(m) }} />
                </div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ background: PANEL_BG }}>
                  <div className="h-full rounded-full" style={{ width: `${m.timeElapsed}%`, background: '#94a3b8' }} />
                </div>
              </div>
            </div>
          ))}
          {!view.metrics.length && <p className="text-xs" style={{ color: TEXT_MUTED }}>No projects to report on.</p>}
        </div>
      </section>

      {/* ── Per-project table (All-Sales formatting) ───────────────────── */}
      <section className="mt-4 rounded-xl border" style={{ background: CARD_BG, borderColor: PANEL_BD }}>
        <div className="overflow-x-auto px-4 pt-4 pb-4 sm:px-5">
          <table className="w-full border-collapse text-sm" style={{ minWidth: 960 }}>
            <thead>
              <tr style={{ background: TABLE_HEAD_BG }}>
                {['Project', 'Status', 'Progress', 'Tasks', 'Hours', 'Labour cost', 'Billed', 'Collected', 'Profit', 'Margin'].map((h) => (
                  <th key={h} scope="col" className="whitespace-nowrap px-3 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.metrics.map((m, idx) => {
                const meta = projectStatusMeta(m.project.status)
                const profit = m.billed - m.laborCost
                return (
                  <tr key={m.project.id} style={{ background: idx % 2 ? ROW_ALT : 'transparent' }}>
                    <td className="px-3 py-2.5 font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{m.project.name}</td>
                    <td className="whitespace-nowrap px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: `${meta.color}22`, color: meta.color }}>{meta.label}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{m.project.progress}%</td>
                    <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{m.tasksDone}/{m.taskCount}</td>
                    <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{m.hours} h</td>
                    <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(m.laborCost)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(m.billed)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(m.collected)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-semibold" style={{ color: profit >= 0 ? '#22c55e' : '#ef4444', borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(profit)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{m.billed > 0 ? `${(m.margin * 100).toFixed(1)}%` : '—'}</td>
                  </tr>
                )
              })}
              {!view.metrics.length && (
                <tr><td colSpan={10} className="px-3 py-10 text-center" style={{ color: TEXT_MUTED }}>No projects to report on.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Printable report centre (portal to <body> for clean printing) ── */}
      {typeof document !== 'undefined' && createPortal(
        <div
          className={'project-sheet-layer fixed inset-0 z-[10000] overflow-y-auto bg-black/60 p-4 ' + (sheetOpen ? 'block' : 'hidden')}
          role="dialog"
          aria-modal="true"
          aria-label="Printable reports"
        >
          <div className="mx-auto w-full max-w-4xl py-8">
            {/* Section picker + actions (never printed) */}
            <div className="no-print mb-4 rounded-xl border border-white/10 bg-zinc-900/90 p-4 backdrop-blur">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-white">Choose what to print</p>
                  <p className="text-xs text-white/60">
                    Each selected section prints on its own A4 page · period: {periodLabel}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="dark" onClick={() => setSections(new Set(SHEET_SECTIONS.map((s) => s.id)))}>Select all</Button>
                  <Button variant="dark" onClick={() => setSections(new Set<SheetSection>(['summary']))}>Reset</Button>
                  <Button variant="dark" onClick={() => window.print()}><Printer className="size-4" /> Print / PDF</Button>
                  <Button variant="dark" onClick={() => setSheetOpen(false)}><X className="size-4" /> Close</Button>
                </div>
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/70">Print scope:</span>
                  <Select
                    value={sheetProject}
                    onChange={(e) => setSheetProject(e.target.value)}
                    className="w-64"
                    aria-label="Print scope — all projects or a single project"
                  >
                    <option value="all">All projects</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                </span>
                <span className="text-[11px] text-white/50">
                  {sheetProject === 'all'
                    ? `Covers all ${projects.length} projects — per-project forms repeat for each.`
                    : 'Covers the selected project only.'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {SHEET_SECTIONS.map((s) => {
                  const on = sections.has(s.id)
                  return (
                    <label
                      key={s.id}
                      title={s.hint}
                      className={
                        'flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ' +
                        (on
                          ? 'border-lime bg-lime text-ink'
                          : 'border-white/15 bg-white/5 text-white/80 hover:border-white/40')
                      }
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleSection(s.id)}
                        className="size-3.5 accent-zinc-900"
                      />
                      <s.icon className="size-3.5" aria-hidden />
                      {s.label}
                    </label>
                  )
                })}
              </div>
              <p className="mt-2 text-[11px] text-white/50">
                {sections.size} section(s) selected — {sheetPages.length} page(s) queued for {scopeName(sheetProject).toLowerCase()}.
              </p>
            </div>

            {sheetPages.length
              ? sheetPages
              : (
                <div className="report-page bg-white text-center text-sm text-zinc-500">
                  No sections selected — tick at least one section above, then Print / PDF.
                </div>
              )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
