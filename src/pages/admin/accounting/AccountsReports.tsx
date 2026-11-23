import { useState } from 'react'
import { BookMarked, ChevronLeft, LayoutGrid } from 'lucide-react'
import { SearchField } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { userCompanyId } from '../../../lib/accessScope'
import { finTerms } from '../../../lib/orgTerms'
import { AccountingReportsPage, STATEMENT_REPORTS, type ReportId } from './AccountingReports'
import { FinancialReportsPage, finReportItems, type FinId } from './FinancialReports'

type Picked = { kind: 'stmt'; id: ReportId } | { kind: 'fin'; id: FinId } | null

/**
 * Report Viewer (formerly "Accounts Reports") — the Statements/Report and Financial Reports menus
 * combined into one searchable list, working like those menus: the list stays
 * on the left and the picked report renders in the right pane.
 */
export function AccountsReportsPage() {
  const app = useApp()
  const { user } = useAuth()
  const terms = finTerms(app.companies.find((c) => c.id === userCompanyId(user, app.branches))?.orgType)

  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Picked>(null)
  /** Render every report body stacked in the right pane at once. */
  const [showAll, setShowAll] = useState(false)

  const all: { key: string; kind: 'stmt' | 'fin'; id: ReportId | FinId; label: string; desc: string; grid: boolean }[] = [
    ...STATEMENT_REPORTS.map((r) => ({ key: `stmt-${r.id}`, kind: 'stmt' as const, id: r.id as ReportId | FinId, label: r.label, desc: r.desc, grid: !!r.grid })),
    ...finReportItems(terms).map((r) => ({ key: `fin-${r.id}`, kind: 'fin' as const, id: r.id as ReportId | FinId, label: r.label, desc: r.desc, grid: false })),
  ]
  const t = q.trim().toLowerCase()
  const visible = t ? all.filter((r) => r.label.toLowerCase().includes(t)) : all

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Report Viewer</h1>
        <p className="mt-1 text-sm text-mist">
          {`Accounting reports — pick one on the left to view it here. ${all.length} reports in total.`}
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="ml-2 inline-flex h-7 cursor-pointer items-center rounded-md border border-line bg-white px-2.5 text-xs font-semibold text-[#1a56b0] transition hover:bg-[#2e75b6] hover:text-white dark:bg-white/[0.04] dark:text-sky-300"
          >
            {showAll ? 'Show compact list' : 'Show all at once'}
          </button>
        </p>
      </div>
      <div className="grid items-stretch gap-4 lg:grid-cols-[320px_1fr]">
        <div className="card flex flex-col self-start overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <SearchField value={q} onChange={setQ} placeholder="Search reports…" />
          </div>
          <div className={`${showAll ? '' : 'max-h-[406px] '}flex-1 divide-y divide-line overflow-y-auto overscroll-contain`}>
            {visible.map((r) => {
              const active = picked?.kind === r.kind && picked.id === r.id
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => {
                    setShowAll(false)
                    setPicked(r.kind === 'stmt' ? { kind: 'stmt', id: r.id as ReportId } : { kind: 'fin', id: r.id as FinId })
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={
                    'flex h-[58px] w-full cursor-pointer flex-col items-start justify-center gap-0.5 px-4 text-left transition ' +
                    (active ? 'bg-[#2e75b6] text-white' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]')
                  }
                >
                  <span className="flex items-center gap-2.5 text-sm font-semibold">
                    {r.grid ? <LayoutGrid className={`size-4 shrink-0 ${active ? 'text-white' : 'text-mist'}`} /> : <BookMarked className={`size-4 shrink-0 ${active ? 'text-white' : 'text-mist'}`} />}
                    {r.label}
                  </span>
                  <span className={`pl-[26px] text-[10px] leading-tight ${active ? 'text-white/80' : 'text-mist'}`}>{r.desc}</span>
                </button>
              )
            })}
            {visible.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-mist">No reports match “{q}”.</div>
            )}
          </div>
        </div>

        <div className="card min-h-[420px] p-5">
          {!picked ? (
            <h2 className="flex items-center gap-2 border-b border-line pb-3 text-2xl font-semibold text-[#2e75b6] dark:text-sky-300">
              <ChevronLeft className="size-6" /> Reports: Make a selection
            </h2>
          ) : picked.kind === 'stmt' ? (
            <AccountingReportsPage key={picked.id} bodyOnly forcedReport={picked.id} />
          ) : (
            <FinancialReportsPage key={picked.id} bodyOnly forcedReport={picked.id} />
          )}
        </div>
      </div>
    </div>
  )
}
