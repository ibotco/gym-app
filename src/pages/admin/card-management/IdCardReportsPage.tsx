/**
 * ID Card Reports — generated / printed / issued / active / lost / replaced /
 * class-wise / expiring reports with PDF, Excel and CSV export, plus the role
 * permission matrix and the full audit log.
 */
import { useEffect, useMemo, useState } from 'react'
import { BarChart3, ShieldCheck } from 'lucide-react'
import { DataTable, type Column } from '../../../components/DataTable'
import { ExportButtons } from '../../../components/ExportButtons'
import { ReportPrintSheet } from '../../../components/ReportPrintSheet'
import { Badge, Button, Empty, Field, PageHeader, Select, StatCard } from '../../../components/ui'
import { useToast } from '../../../context/ToastContext'
import {
  ID_CARD_PERMISSIONS, ID_CARD_REPORTS, buildIdCardReport, idCardAccessRows, idCardExportRows, idCardHistory,
  idCardReportFilename, readIdCardAccess, type IdCardPermissionKey, type IdCardReportRow, historyRow
} from '../../../lib/eduIdCards'
import { uid } from '../../../lib/utils'
import { CardHolderFilter, useIdCardContext } from './IdCardShared'

const AUDIT_ACTIONS = ['Generated', 'Printed', 'Issued', 'Activated', 'Marked Lost', 'Marked Damaged', 'Replaced', 'Expired', 'Verified', 'Permission change']

/** Printable version of a report, mounted only while printing. */
function IdCardReportPrint({ report, year, onDone }: { report: ReturnType<typeof buildIdCardReport>; year: string; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 80)
    const done = () => onDone()
    window.addEventListener('afterprint', done)
    return () => { window.clearTimeout(timer); window.removeEventListener('afterprint', done) }
  }, [onDone])
  const th: React.CSSProperties = {
    border: '1px solid #888', padding: '5px 6px', fontSize: 9, textTransform: 'uppercase',
    letterSpacing: '0.06em', background: '#f0f0f0', color: '#111', textAlign: 'left',
    WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
  }
  const td: React.CSSProperties = { border: '1px solid #888', padding: '4px 6px', fontSize: 9, color: '#111' }
  return (
    <ReportPrintSheet title={`ID Card — ${report.label}`} subtitle={`${report.rows.length} row${report.rows.length === 1 ? '' : 's'}${year ? ` · academic year ${year}` : ' · all academic years'}`} landscape={report.columns.length > 6}>
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
          <tr>{report.columns.map((column) => <th key={column.key} style={{ ...th, textAlign: column.numeric ? 'right' : 'left' }}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.id}>
              {report.columns.map((column) => (
                <td key={column.key} style={{ ...td, textAlign: column.numeric ? 'right' : 'left' }}>{String(row[column.key] ?? '') || '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ReportPrintSheet>
  )
}

export function IdCardReportsPage() {
  const {
    records, cards, academicYear, availableRoles, can, patch, officer,
    holderType, setHolderType, availableHolderTypes, holderLabels,
  } = useIdCardContext()
  const toast = useToast()
  const allowed = can('reports')
  const isAdmin = can('configure')

  const [reportId, setReportId] = useState(ID_CARD_REPORTS[0].id)
  const [year, setYear] = useState('')
  const [printing, setPrinting] = useState(false)
  const [auditAction, setAuditAction] = useState('')
  const [auditOfficer, setAuditOfficer] = useState('')

  const years = useMemo(
    () => [...new Set(cards.filter((card) => holderType === 'All' || card.holderType === holderType).map((card) => card.academicYear).filter(Boolean))].sort((a, b) => b.localeCompare(a)),
    [cards, holderType],
  )
  /* Reports follow the holder-type filter, so a staff report doesn't count
   * student cards. */
  const scopedRecords = useMemo(
    () => (holderType === 'All' ? records : { ...records, idCards: (records.idCards ?? []).filter((row) => String(row.holderType ?? 'Student') === holderType) }),
    [records, holderType],
  )
  const report = useMemo(() => buildIdCardReport(reportId, scopedRecords, year), [reportId, scopedRecords, year])
  const exportRows = useMemo(() => idCardExportRows(report), [report])

  const audit = useMemo(() => {
    const rows = idCardHistory(records)
    return rows.filter((row) => {
      if (auditAction && row.action !== auditAction) return false
      if (auditOfficer && !row.officer.toLowerCase().includes(auditOfficer.toLowerCase())) return false
      return true
    })
  }, [records, auditAction, auditOfficer])

  const access = useMemo(() => readIdCardAccess(records), [records])
  const settingsRow = (records.idCardSettings ?? [])[0]

  const toggleRole = (permission: IdCardPermissionKey, roleId: string) => {
    const current = access[permission] ?? []
    const granted = !current.includes(roleId)
    const next = granted ? [...current, roleId] : current.filter((item) => item !== roleId)
    const permissionLabel = ID_CARD_PERMISSIONS.find((item) => item.key === permission)?.label ?? permission
    const roleLabel = availableRoles.find((role) => role.id === roleId)?.name ?? roleId
    patch({
      idCardSettings: [idCardAccessRows({ ...access, [permission]: next }, settingsRow)],
      idCardHistory: [
        ...(records.idCardHistory ?? []),
        historyRow(uid('idch'), {
          cardNo: '',
          student: '',
          action: 'Permission change',
          officer,
          reason: `${permissionLabel} — ${granted ? 'granted to' : 'revoked for'} ${roleLabel}`,
        }),
      ],
    })
  }

  const columns: Column<IdCardReportRow>[] = useMemo(
    () => report.columns.map((column) => ({
      key: column.key,
      header: column.label,
      align: column.numeric ? 'right' : 'left',
      sortValue: (row: IdCardReportRow) => row[column.key],
      render: (row: IdCardReportRow) => <span>{String(row[column.key] ?? '') || '—'}</span>,
    })),
    [report],
  )

  const auditColumns: Column<(typeof audit)[number]>[] = [
    { key: 'date', header: 'Date', sortValue: (row) => row.date, render: (row) => row.date || '—' },
    { key: 'time', header: 'Time', sortValue: (row) => row.time, render: (row) => row.time || '—' },
    { key: 'cardNo', header: 'Card No', sortValue: (row) => row.cardNo, render: (row) => <span className="font-mono text-[11px]">{row.cardNo}</span> },
    { key: 'student', header: 'Student', sortValue: (row) => row.student, render: (row) => row.student || '—' },
    { key: 'action', header: 'Action', sortValue: (row) => row.action, render: (row) => <Badge tone={row.action === 'Verified' ? 'sky' : row.action === 'Replaced' ? 'amber' : 'lime'}>{row.action}</Badge> },
    { key: 'fromStatus', header: 'From', sortValue: (row) => row.fromStatus, render: (row) => row.fromStatus || '—' },
    { key: 'toStatus', header: 'To', sortValue: (row) => row.toStatus, render: (row) => row.toStatus || '—' },
    { key: 'officer', header: 'Officer', sortValue: (row) => row.officer, render: (row) => row.officer || '—' },
    { key: 'reason', header: 'Reason', sortValue: (row) => row.reason, render: (row) => <span className="text-mist">{row.reason || '—'}</span> },
  ]

  if (!allowed) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Card Management" title="ID Card Reports" printTitle="ID Card Reports" />
        <p className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          <ShieldCheck className="size-4" /> Your role cannot view ID card reports or the audit log. Ask an administrator for the “View reports” permission.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Card Management"
        title="ID Card Reports"
        desc="Generated, printed, issued, active, lost, replaced, expiring and class-wise summaries — exportable to PDF, Excel and CSV — with the role permission matrix and audit log."
        printTitle="ID Card Reports"
      />

      {printing && <IdCardReportPrint report={report} year={year} onDone={() => setPrinting(false)} />}

      <section className="rounded-2xl border border-line bg-white/60 p-4 dark:bg-white/5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,18rem)_1fr] sm:items-end">
          <Field label="Report">
            <Select value={reportId} onChange={(event) => setReportId(event.target.value as typeof reportId)}>
              {ID_CARD_REPORTS.map((item) => (<option key={item.id} value={item.id}>{item.label}</option>))}
            </Select>
          </Field>
          <div>
            <p className="text-sm text-mist">{report.description}</p>
            <p className="mt-1 text-xs text-mist">
              {report.rows.length} row{report.rows.length === 1 ? '' : 's'}
              {year ? ` · academic year ${year}` : ` · current year ${academicYear}`}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-line pt-3 dark:border-white/10">
          <Field label="Academic year">
            <Select value={year} onChange={(event) => setYear(event.target.value)}>
              <option value="">All years</option>
              {years.map((item) => (<option key={item} value={item}>{item}</option>))}
            </Select>
          </Field>
        </div>
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
            <h2 className="font-display text-lg font-semibold">{report.label}</h2>
          </div>
          <div className="ml-auto">
            <CardHolderFilter value={holderType} onChange={setHolderType} available={availableHolderTypes} labels={holderLabels} />
          </div>
          {report.rows.length > 0 && (
            <ExportButtons
              filename={idCardReportFilename(report)}
              rows={exportRows}
              onPdf={() => setPrinting(true)}
              onDone={(label, ok) => {
                if (ok) toast.success(`${label} export ready`, `${report.rows.length} rows written from ${report.label}.`)
                else toast.error(`${label} export failed`, 'The browser blocked the download. Try again.')
              }}
            />
          )}
        </div>
        {report.rows.length
          ? (
            <DataTable
              columns={columns}
              data={report.rows}
              rowKey={(row) => row.id}
              pageSize={25}
              emptyTitle={report.emptyTitle}
              emptyDesc={report.emptyDescription}
            />
          )
          : <Empty title={report.emptyTitle} desc={report.emptyDescription} />}
      </section>

      {/* Security & permissions */}
      <section className="rounded-2xl border border-line bg-white/60 p-4 dark:bg-white/5">
        <h2 className="mb-1 flex items-center gap-2 font-display text-base font-semibold">
          <ShieldCheck className="size-4 text-lime" /> Security & permissions
        </h2>
        <p className="mb-3 text-sm text-mist">
          Tick which roles may perform each ID Card action. Administrators always keep every permission, so you cannot lock yourself out.
        </p>
        <div className="overflow-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-mist">
              <tr>
                <th className="py-1.5">Action</th>
                {availableRoles.map((role) => (
                  <th key={role.id} className="px-1 py-1.5 text-center">{role.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ID_CARD_PERMISSIONS.map((permission) => (
                <tr key={permission.key} className="border-t border-line/60 dark:border-white/5">
                  <td className="py-1.5 pr-3">
                    <p className="font-medium">{permission.label}</p>
                    <p className="text-[11px] text-mist">{permission.description}</p>
                  </td>
                  {availableRoles.map((role) => (
                    <td key={role.id} className="px-1 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={(access[permission.key] ?? []).includes(role.id)}
                        onChange={() => isAdmin && toggleRole(permission.key, role.id)}
                        disabled={!isAdmin}
                        aria-label={`${role.name} — ${permission.label}`}
                        className="size-3.5 accent-lime"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isAdmin && <p className="mt-2 text-xs text-mist">Read-only: only roles with “Configure templates” can change permissions.</p>}
      </section>

      {/* Audit log */}
      <section className="rounded-2xl border border-line bg-white/60 p-4 dark:bg-white/5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold">Audit log</h2>
          {audit.length > 0 && (
            <ExportButtons
              filename={`id-card-audit-log-${new Date().toISOString().slice(0, 10)}`}
              rows={audit.map((row) => ({
                Date: row.date, Time: row.time, 'Card No': row.cardNo, Student: row.student,
                Action: row.action, From: row.fromStatus, To: row.toStatus, Officer: row.officer, Reason: row.reason,
              }))}
            />
          )}
        </div>
        <div className="mb-3 grid gap-3 sm:grid-cols-3">
          <Field label="Action">
            <Select value={auditAction} onChange={(event) => setAuditAction(event.target.value)}>
              <option value="">All actions</option>
              {AUDIT_ACTIONS.map((action) => (<option key={action} value={action}>{action}</option>))}
            </Select>
          </Field>
          <Field label="Officer contains">
            <input
              value={auditOfficer}
              onChange={(event) => setAuditOfficer(event.target.value)}
              className="w-full rounded-lg border border-line bg-transparent px-3 py-2 text-sm outline-none transition focus:border-lime dark:border-white/10"
              placeholder="e.g. Ama"
            />
          </Field>
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={() => { setAuditAction(''); setAuditOfficer('') }}>Clear</Button>
          </div>
        </div>
        <DataTable
          columns={auditColumns}
          data={audit}
          rowKey={(row) => row.id}
          pageSize={20}
          emptyTitle="No activity yet"
          emptyDesc="Every generation, print, issue, replacement and verification is written here automatically."
        />
      </section>
    </div>
  )
}
