/**
 * Transport Reports — one page for all nine transport reports. Pick a report,
 * narrow it with the shared filters, then print / save as PDF or export to
 * Excel and CSV.
 */
import { useEffect, useMemo, useState } from 'react'
import { BarChart3, FilterX, Loader2 } from 'lucide-react'
import { DataTable, type Column } from '../../../components/DataTable'
import { ReportPrintSheet } from '../../../components/ReportPrintSheet'
import { ExportButtons } from '../../../components/ExportButtons'
import { Button, Empty, Field, PageHeader, Select, StatCard } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { loadEduRecords, type EduRecords } from '../../../lib/eduRecords'
import {
  EMPTY_TRANSPORT_REPORT_FILTERS, TRANSPORT_REPORTS, buildTransportReport, formatReportCell, transportExportRows,
  transportFilterOptions, transportReportFilename, type TransportFilterKey, type TransportReport,
  type TransportReportId, type TransportReportRow,
} from '../../../lib/eduTransportReports'

const FILTER_LABELS: Record<TransportFilterKey, string> = {
  academicYear: 'Academic year',
  term: 'Term',
  routeName: 'Route',
  vehicleNo: 'Vehicle',
  driver: 'Driver / attendant',
  student: 'Student',
  dateFrom: 'From date',
  dateTo: 'To date',
}

/** Cells that deserve a coloured badge instead of plain text. */
const TONE_TEXT: Record<string, { good: string[]; bad: string[] }> = {
  status: {
    good: ['active', 'settled', 'completed', 'picked up', 'dropped off', 'valid'],
    bad: ['inactive', 'unpaid', 'expired', 'absent', 'maintenance', 'overdue', 'suspended'],
  },
}

const cellClass = (columnKey: string, value: string | number, tone?: 'ok' | 'warn' | 'bad') => {
  if (tone === 'bad') {
    if (columnKey === 'licenceStatus' && String(value).startsWith('Expiring')) return 'text-amber-600 dark:text-amber-300'
    if (columnKey === 'nextServiceDue' && String(value).startsWith('Due in')) return 'text-amber-600 dark:text-amber-300'
    return typeof value === 'number' && value > 0 ? 'font-semibold text-rose-600 dark:text-rose-300'
      : /overdue|expired|unpaid|inactive/i.test(String(value)) ? 'font-semibold text-rose-600 dark:text-rose-300' : undefined
  }
  if (tone === 'warn') {
    return typeof value === 'number' && value > 0 ? 'font-semibold text-amber-600 dark:text-amber-300' : undefined
  }
  if (tone === 'ok') {
    const words = TONE_TEXT[columnKey] ?? { good: [], bad: [] }
    const lower = String(value).toLowerCase()
    if (words.bad.some((word) => lower === word)) return 'font-semibold text-rose-600 dark:text-rose-300'
    if (words.good.some((word) => lower === word)) return 'font-semibold text-lime-ink dark:text-lime'
    return typeof value === 'number' && value > 0 ? 'font-semibold text-lime-ink dark:text-lime' : undefined
  }
  return undefined
}

/** Printable version of the report, mounted only while printing. */
function TransportReportPrint({ report, onDone }: { report: TransportReport; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 80)
    const done = () => onDone()
    window.addEventListener('afterprint', done)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', done)
    }
  }, [onDone])

  const th: React.CSSProperties = {
    border: '1px solid #888', padding: '5px 6px', fontSize: 9, textTransform: 'uppercase',
    letterSpacing: '0.06em', background: '#f0f0f0', color: '#111', textAlign: 'left',
    WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
  }
  const td: React.CSSProperties = { border: '1px solid #888', padding: '4px 6px', fontSize: 9, color: '#111', verticalAlign: 'top' }

  return (
    <ReportPrintSheet title={report.title} subtitle={report.subtitle} landscape={report.columns.length > 6}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10, fontSize: 9, color: '#333' }}>
        {report.metrics.map((metric) => (
          <div key={metric.label} style={{ border: '1px solid #bbb', padding: '4px 8px', minWidth: 110 }}>
            <div style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 8 }}>{metric.label}</div>
            <div style={{ fontWeight: 700, fontSize: 11 }}>{metric.value}</div>
          </div>
        ))}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {report.columns.map((column) => (
              <th key={column.key} style={{ ...th, textAlign: column.numeric ? 'right' : 'left' }}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.id}>
              {report.columns.map((column) => (
                <td key={column.key} style={{ ...td, textAlign: column.numeric ? 'right' : 'left' }}>
                  {formatReportCell(row[column.key], column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 8, fontSize: 8, color: '#555' }}>
        {report.rows.length} row{report.rows.length === 1 ? '' : 's'} · {report.description}
      </p>
    </ReportPrintSheet>
  )
}

export function EduTransportReportsPage() {
  const { activeBranchId } = useApp()
  const toast = useToast()
  const [records, setRecords] = useState<EduRecords>(() => loadEduRecords(activeBranchId))
  const [reportId, setReportId] = useState<TransportReportId>('studentTransportLists')
  const [filters, setFilters] = useState({ ...EMPTY_TRANSPORT_REPORT_FILTERS })
  const [printing, setPrinting] = useState(false)

  useEffect(() => { setRecords(loadEduRecords(activeBranchId)) }, [activeBranchId])

  const definition = useMemo(
    () => TRANSPORT_REPORTS.find((item) => item.id === reportId) ?? TRANSPORT_REPORTS[0],
    [reportId],
  )
  const options = useMemo(() => transportFilterOptions(records), [records])
  const report = useMemo(() => buildTransportReport(reportId, records, filters), [reportId, records, filters])
  const exportRows = useMemo(() => transportExportRows(report), [report])

  const setFilter = (key: TransportFilterKey, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }))

  /** Filters that do not slice the chosen report are cleared when it changes. */
  const changeReport = (next: TransportReportId) => {
    const nextDefinition = TRANSPORT_REPORTS.find((item) => item.id === next) ?? TRANSPORT_REPORTS[0]
    setReportId(next)
    setFilters((current) => {
      const kept = { ...EMPTY_TRANSPORT_REPORT_FILTERS }
      for (const key of nextDefinition.filters) kept[key] = current[key]
      return kept
    })
  }

  const columns: Column<TransportReportRow>[] = useMemo(
    () => report.columns.map((column) => ({
      key: column.key,
      header: column.label,
      align: column.numeric ? 'right' : 'left',
      sortValue: (row: TransportReportRow) => row[column.key],
      render: (row: TransportReportRow) => (
        <span className={cellClass(column.key, row[column.key], column.tone)}>
          {formatReportCell(row[column.key], column)}
        </span>
      ),
    })),
    [report],
  )

  const optionList = (key: TransportFilterKey): string[] => {
    if (key === 'academicYear') return options.academicYears
    if (key === 'term') return options.terms
    if (key === 'routeName') return options.routes
    if (key === 'vehicleNo') return options.vehicles
    if (key === 'driver') return options.drivers
    if (key === 'student') return options.students
    return []
  }

  const renderFilter = (key: TransportFilterKey) => {
    const label = FILTER_LABELS[key]
    if (key === 'dateFrom' || key === 'dateTo') {
      return (
        <Field key={key} label={label}>
          <input
            type="date"
            value={filters[key]}
            onChange={(event) => setFilter(key, event.target.value)}
            className="w-full rounded-lg border border-line bg-transparent px-3 py-2 text-sm outline-none transition focus:border-lime dark:border-white/10"
          />
        </Field>
      )
    }
    const values = optionList(key)
    return (
      <Field key={key} label={label}>
        <Select value={filters[key]} onChange={(event) => setFilter(key, event.target.value)}>
          <option value="">All</option>
          {values.map((value) => (<option key={value} value={value}>{value}</option>))}
        </Select>
      </Field>
    )
  }

  const hasFilters = definition.filters.some((key) => filters[key])

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Transport"
        title="Transport Reports"
        desc="Operational, financial and compliance reporting for the whole transport fleet — print or export any report to PDF, Excel or CSV."
        printTitle="Transport Reports"
      />

      {printing && <TransportReportPrint report={report} onDone={() => setPrinting(false)} />}

      <section className="rounded-2xl border border-line bg-white/60 p-4 dark:bg-white/5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,18rem)_1fr] sm:items-end">
          <Field label="Report">
            <Select value={reportId} onChange={(event) => changeReport(event.target.value as TransportReportId)}>
              {TRANSPORT_REPORTS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </Select>
          </Field>
          <div>
            <p className="text-sm text-mist">{report.description}</p>
            <p className="mt-1 text-xs text-mist">
              <span className="rounded-full bg-black/5 px-2 py-0.5 font-semibold uppercase tracking-wide dark:bg-white/10">
                {definition.category}
              </span>
              <span className="ml-2">{report.rows.length} row{report.rows.length === 1 ? '' : 's'} · {report.subtitle}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 dark:border-white/10">
          {definition.filters.map(renderFilter)}
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters({ ...EMPTY_TRANSPORT_REPORT_FILTERS })}
              disabled={!hasFilters}
              title="Clear every filter"
            >
              <FilterX className="size-4" /> Clear filters
            </Button>
          </div>
        </div>

        {definition.filters.length < Object.keys(EMPTY_TRANSPORT_REPORT_FILTERS).length && (
          <p className="mt-2 text-[11px] text-mist">
            Only the filters that slice this report are shown — {definition.label} is not affected by the others.
          </p>
        )}
      </section>

      {report.rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {report.metrics.map((metric) => (
            <StatCard key={metric.label} label={metric.label} value={metric.value} hint={metric.hint} />
          ))}
        </div>
      )}

      <section className="rounded-2xl border border-line bg-white/60 p-4 dark:bg-white/5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-lime" />
            <h2 className="font-display text-lg font-semibold">{report.title}</h2>
          </div>
          {report.rows.length > 0 && (
            <ExportButtons
              filename={transportReportFilename(report)}
              rows={exportRows}
              onPdf={() => setPrinting(true)}
              onDone={(label, ok) => {
                if (ok) toast.success(`${label} export ready`, `${report.rows.length} rows written from ${report.title}.`)
                else toast.error(`${label} export failed`, 'The browser blocked the download. Try again.')
              }}
            />
          )}
        </div>

        {report.rows.length ? (
          <DataTable
            columns={columns}
            data={report.rows}
            rowKey={(row) => row.id}
            pageSize={25}
            emptyTitle={report.emptyTitle}
            emptyDesc={report.emptyDescription}
          />
        ) : (
          <Empty title={report.emptyTitle} desc={report.emptyDescription} />
        )}
      </section>

      {printing && (
        <p className="flex items-center gap-2 text-xs text-mist">
          <Loader2 className="size-3.5 animate-spin" /> Preparing the print sheet — choose “Save as PDF” in the print dialog.
        </p>
      )}
    </div>
  )
}
