import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, FileText, X } from 'lucide-react'
import { PageHeader, Button, DatePicker } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { ATT_STATUS, StatusChip } from './AttendanceDashboard'
import type { StaffAttendance } from '../../../types'

type SectionKey = 'summary' | 'daily' | 'late' | 'absent' | 'leave' | 'dept'
const SECTIONS: { key: SectionKey; label: string; desc: string }[] = [
  { key: 'summary', label: 'Summary by staff', desc: 'Present / late / absent / leave totals and attendance rate per employee.' },
  { key: 'daily', label: 'Daily attendance log', desc: 'Every marked record in the period with times and status.' },
  { key: 'late', label: 'Late arrivals', desc: 'Only the late records, with check-in time.' },
  { key: 'absent', label: 'Absences', desc: 'Only the absent records.' },
  { key: 'leave', label: 'Leave days', desc: 'Approved leave days recorded in attendance.' },
  { key: 'dept', label: 'Department summary', desc: 'Aggregated attendance rates per department.' },
]

/* Plain-paper table cells for the A4 sheets (no cards, black on white). */
const th = 'border border-black/40 px-2 py-1 text-left text-[10px] font-bold uppercase tracking-wide'
const td = 'border border-black/40 px-2 py-1 text-[11px]'

function SheetTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-4 border-b-2 border-black pb-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Human Resource · Employee Attendance</p>
      <h2 className="mt-0.5 text-lg font-extrabold text-black">{title}</h2>
      <p className="text-[11px] text-black/70">{sub}</p>
    </div>
  )
}

export function AttendanceReport() {
  const { staffAttendance, staff, users } = useApp()
  const now = new Date()
  const [from, setFrom] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
  const [to, setTo] = useState(now.toISOString().slice(0, 10))
  const [selected, setSelected] = useState<SectionKey[]>(['summary', 'daily', 'late', 'absent'])
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    document.body.classList.toggle('project-sheet-print', sheetOpen)
    return () => document.body.classList.remove('project-sheet-print')
  }, [sheetOpen])

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id
  const deptOf = (id: string) => staff.find((s) => s.userId === id)?.department || '—'

  const inRange = useMemo(
    () => staffAttendance.filter((a) => a.date >= from && a.date <= to).sort((a, b) => a.date.localeCompare(b.date) || staffName(a.staffUserId).localeCompare(staffName(b.staffUserId))),
    [staffAttendance, from, to, users], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const perStaff = useMemo(() => staff.map((s) => {
    const recs = inRange.filter((a) => a.staffUserId === s.userId)
    const p = recs.filter((r) => r.status === 'present').length
    const l = recs.filter((r) => r.status === 'late').length
    const a = recs.filter((r) => r.status === 'absent').length
    const v = recs.filter((r) => r.status === 'leave').length
    const marked = p + l + a + v
    const rate = marked ? Math.round(((p + l) / marked) * 100) : 0
    return { name: staffName(s.userId), dept: s.department, p, l, a, v, marked, rate }
  }), [staff, inRange, users]) // eslint-disable-line react-hooks/exhaustive-deps

  const perDept = useMemo(() => {
    const map = new Map<string, { marked: number; att: number }>()
    for (const r of perStaff) {
      const e = map.get(r.dept) || { marked: 0, att: 0 }
      e.marked += r.marked
      e.att += r.p + r.l
      map.set(r.dept, e)
    }
    return [...map.entries()].map(([dept, e]) => ({ dept, ...e, rate: e.marked ? Math.round((e.att / e.marked) * 100) : 0 }))
  }, [perStaff])

  const toggle = (k: SectionKey) => setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))
  const rangeLabel = `${from} → ${to}`

  const exportRows = inRange.map((r) => ({
    Date: r.date, Staff: staffName(r.staffUserId), Department: deptOf(r.staffUserId),
    'Check in': r.checkIn || '', 'Check out': r.checkOut || '', Status: ATT_STATUS[r.status].label, Notes: r.notes || '',
  }))

  const has = (k: SectionKey) => selected.includes(k)

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span>Employee Attendance</span><span>/</span>
        <span className="font-semibold text-inherit">Attendance Report</span>
      </div>
      <PageHeader
        title="Attendance Report"
        desc="Pick a period and the sections you need, then print a proper A4 report — one flat sheet per section."
      />

      {/* Controls */}
      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="mb-1 text-xs font-bold text-mist">From</p>
            <DatePicker value={from} onChange={setFrom} />
          </div>
          <div>
            <p className="mb-1 text-xs font-bold text-mist">To</p>
            <DatePicker value={to} onChange={setTo} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ExportButtons filename={`attendance-report-${from}-${to}`} rows={exportRows} />
            <Button onClick={() => setSheetOpen(true)} disabled={!selected.length}><Printer className="size-4" /> Preview & print</Button>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {SECTIONS.map((sct) => (
            <label key={sct.key} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${has(sct.key) ? 'border-lime/60 bg-lime/[0.06]' : 'border-line hover:border-lime/30'}`}>
              <input type="checkbox" checked={has(sct.key)} onChange={() => toggle(sct.key)} className="mt-0.5 accent-[#c8f542]" />
              <span>
                <span className="block text-sm font-bold">{sct.label}</span>
                <span className="block text-[11px] text-mist">{sct.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* On-screen quick preview list */}
      <div className="card overflow-x-auto">
        <p className="border-b border-line px-4 py-3 text-sm font-extrabold">Records in period ({inRange.length})</p>
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-black/[0.02] text-left text-[11px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
              <th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5">Staff</th><th className="px-3 py-2.5">Department</th>
              <th className="px-3 py-2.5">In / Out</th><th className="px-3 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {inRange.slice(0, 60).map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2 text-mist">{r.date}</td>
                <td className="px-3 py-2 font-bold">{staffName(r.staffUserId)}</td>
                <td className="px-3 py-2 text-mist">{deptOf(r.staffUserId)}</td>
                <td className="px-3 py-2 text-mist">{r.checkIn || '—'} / {r.checkOut || '—'}</td>
                <td className="px-3 py-2"><StatusChip status={r.status} /></td>
              </tr>
            ))}
            {!inRange.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-mist">No attendance records in this period.</td></tr>}
          </tbody>
        </table>
        {inRange.length > 60 && <p className="px-4 py-2 text-[11px] text-mist">Showing first 60 of {inRange.length} — the print report includes all.</p>}
      </div>

      {/* ============ A4 SHEET LAYER ============ */}
      {typeof document !== 'undefined' && createPortal(
        <div
          className={`project-sheet-layer fixed inset-0 z-[10000] overflow-y-auto bg-black/60 p-4 ${sheetOpen ? 'block' : 'hidden'}`}
          role="dialog"
          aria-modal="true"
          aria-label="Attendance report print preview"
        >
          <div className="mx-auto w-full max-w-4xl py-8">
            <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-zinc-900/90 p-4 backdrop-blur">
              <div>
                <p className="text-sm font-extrabold text-white">Print preview — {selected.length} section(s)</p>
                <p className="text-[11px] text-zinc-400">Each section prints as its own A4 sheet. Close to return.</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
                <Button variant="outline" onClick={() => setSheetOpen(false)}><X className="size-4" /> Close</Button>
              </div>
            </div>

            {/* 1 — Summary by staff */}
            {has('summary') && (
              <section className="report-page">
                <SheetTitle title="Attendance Summary by Staff" sub={`Period ${rangeLabel} · ${staff.length} employees`} />
                <table className="w-full border-collapse">
                  <thead><tr>{['Staff', 'Department', 'Present', 'Late', 'Absent', 'Leave', 'Marked', 'Rate %'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {perStaff.map((r) => (
                      <tr key={r.name}>
                        <td className={`${td} font-bold`}>{r.name}</td><td className={td}>{r.dept}</td>
                        <td className={td}>{r.p}</td><td className={td}>{r.l}</td><td className={td}>{r.a}</td><td className={td}>{r.v}</td>
                        <td className={td}>{r.marked}</td><td className={`${td} font-bold`}>{r.rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {/* 2 — Daily log */}
            {has('daily') && (
              <section className="report-page">
                <SheetTitle title="Daily Attendance Log" sub={`Period ${rangeLabel} · ${inRange.length} records`} />
                <table className="w-full border-collapse">
                  <thead><tr>{['Date', 'Staff', 'Department', 'Check in', 'Check out', 'Status'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {inRange.map((r) => (
                      <tr key={r.id}>
                        <td className={td}>{r.date}</td>
                        <td className={`${td} font-bold`}>{staffName(r.staffUserId)}</td>
                        <td className={td}>{deptOf(r.staffUserId)}</td>
                        <td className={td}>{r.checkIn || '—'}</td><td className={td}>{r.checkOut || '—'}</td>
                        <td className={`${td} font-bold`}>{ATT_STATUS[r.status].label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {/* 3 — Late arrivals */}
            {has('late') && (
              <section className="report-page">
                <SheetTitle title="Late Arrivals" sub={`Period ${rangeLabel} · ${inRange.filter((r) => r.status === 'late').length} occurrences`} />
                <table className="w-full border-collapse">
                  <thead><tr>{['Date', 'Staff', 'Department', 'Check in', 'Notes'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {inRange.filter((r) => r.status === 'late').map((r) => (
                      <tr key={r.id}>
                        <td className={td}>{r.date}</td><td className={`${td} font-bold`}>{staffName(r.staffUserId)}</td>
                        <td className={td}>{deptOf(r.staffUserId)}</td><td className={td}>{r.checkIn || '—'}</td><td className={td}>{r.notes || ''}</td>
                      </tr>
                    ))}
                    {!inRange.some((r) => r.status === 'late') && <tr><td className={td} colSpan={5}>No late arrivals in this period.</td></tr>}
                  </tbody>
                </table>
              </section>
            )}

            {/* 4 — Absences */}
            {has('absent') && (
              <section className="report-page">
                <SheetTitle title="Absence Report" sub={`Period ${rangeLabel} · ${inRange.filter((r) => r.status === 'absent').length} occurrences`} />
                <table className="w-full border-collapse">
                  <thead><tr>{['Date', 'Staff', 'Department', 'Notes'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {inRange.filter((r) => r.status === 'absent').map((r) => (
                      <tr key={r.id}>
                        <td className={td}>{r.date}</td><td className={`${td} font-bold`}>{staffName(r.staffUserId)}</td>
                        <td className={td}>{deptOf(r.staffUserId)}</td><td className={td}>{r.notes || ''}</td>
                      </tr>
                    ))}
                    {!inRange.some((r) => r.status === 'absent') && <tr><td className={td} colSpan={4}>No absences in this period.</td></tr>}
                  </tbody>
                </table>
              </section>
            )}

            {/* 5 — Leave days */}
            {has('leave') && (
              <section className="report-page">
                <SheetTitle title="Leave Days" sub={`Period ${rangeLabel} · ${inRange.filter((r) => r.status === 'leave').length} days`} />
                <table className="w-full border-collapse">
                  <thead><tr>{['Date', 'Staff', 'Department', 'Notes'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {inRange.filter((r) => r.status === 'leave').map((r) => (
                      <tr key={r.id}>
                        <td className={td}>{r.date}</td><td className={`${td} font-bold`}>{staffName(r.staffUserId)}</td>
                        <td className={td}>{deptOf(r.staffUserId)}</td><td className={td}>{r.notes || ''}</td>
                      </tr>
                    ))}
                    {!inRange.some((r) => r.status === 'leave') && <tr><td className={td} colSpan={4}>No leave days in this period.</td></tr>}
                  </tbody>
                </table>
              </section>
            )}

            {/* 6 — Department summary */}
            {has('dept') && (
              <section className="report-page">
                <SheetTitle title="Department Summary" sub={`Period ${rangeLabel} · ${perDept.length} departments`} />
                <table className="w-full border-collapse">
                  <thead><tr>{['Department', 'Marked days', 'Attended (P+L)', 'Rate %'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {perDept.map((d) => (
                      <tr key={d.dept}>
                        <td className={`${td} font-bold`}>{d.dept}</td><td className={td}>{d.marked}</td>
                        <td className={td}>{d.att}</td><td className={`${td} font-bold`}>{d.rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {!selected.length && (
              <div className="report-page"><SheetTitle title="Attendance Report" sub={rangeLabel} /><p className="text-sm text-black">No sections selected.</p></div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
