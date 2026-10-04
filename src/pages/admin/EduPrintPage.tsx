import { Fragment, useEffect, useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { PageHeader, Button, Field, Select, Empty } from '../../components/ui'
import { useI18n } from '../../context/I18nContext'
import { useApp } from '../../context/AppContext'
import { createPortal } from 'react-dom'
import { loadEduRecords, type EduRow } from '../../lib/eduRecords'
import { breakLabel, loadTtConfig } from '../../lib/eduTimetableConfig'

type Kind = 'class' | 'teacher' | 'room' | 'rooms'

const KIND_LABEL: Record<Kind, string> = {
  class: 'Class Timetable',
  teacher: 'Teacher Timetable',
  room: 'Room Timetable',
  rooms: 'Room Allocation Overview',
}

/**
 * Print centre for Education Management timetables: pick a sheet
 * (class / teacher / room / all-rooms overview), preview it and print on
 * A4 landscape. One menu item instead of hunting for the print button.
 */
export function EduPrintPage() {
  const { t } = useI18n()
  const { activeBranchId, branches } = useApp()
  const branchName = branches.find((b) => b.id === activeBranchId)?.name

  const [records, setRecords] = useState(() => loadEduRecords(activeBranchId))
  useEffect(() => {
    setRecords(loadEduRecords(activeBranchId))
  }, [activeBranchId])

  const [kind, setKind] = useState<Kind>('class')
  const [selected, setSelected] = useState('')

  const cfg = useMemo(() => loadTtConfig(records), [records])
  const BREAK = breakLabel(cfg)
  const lessons = useMemo(() => records['classTimetable'] ?? [], [records])
  const allocs = useMemo(() => (records['roomAllocation'] ?? []) as EduRow[], [records])

  const classes = useMemo(() => {
    const set = new Set<string>()
    lessons.forEach((l) => l.className && set.add(l.className))
    ;(records['classList'] ?? []).forEach((c) => {
      const label = [c.name, c.section].filter(Boolean).join(' ')
      if (label) set.add(label)
    })
    return [...set].sort()
  }, [lessons, records])

  const teachers = useMemo(() => {
    const set = new Set<string>()
    lessons.forEach((l) => l.teacher && set.add(l.teacher))
    ;(records['staffList'] ?? []).forEach((s) => s.name && set.add(s.name))
    return [...set].sort()
  }, [lessons, records])

  const roomNames = useMemo(() => {
    const set = new Set<string>()
    ;(records['rooms'] ?? []).forEach((r) => r.name && set.add(r.name))
    allocs.forEach((a) => a.room && set.add(a.room))
    ;(records['classList'] ?? []).forEach((c) => c.room && set.add(c.room))
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [records, allocs])

  const options = kind === 'class' ? classes : kind === 'teacher' ? teachers : kind === 'room' ? roomNames : []
  const who = selected && options.includes(selected) ? selected : options[0] ?? ''

  const roomFor = (className: string, day: string, period: string) =>
    allocs.find((a) => a.className === className && a.day === day && a.period === period)?.room ?? ''

  const thStyle: React.CSSProperties = { border: '1px solid #888', padding: '5px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', background: '#f0f0f0', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }
  const tdStyle: React.CSSProperties = { border: '1px solid #888', padding: '6px', fontSize: 10, verticalAlign: 'top', height: 44 }

  const cellContent = (day: string, period: string) => {
    if (kind === 'class') {
      const l = lessons.find((x) => x.className === who && x.day === day && x.period === period)
      if (!l) return null
      const room = roomFor(l.className, day, period)
      return (<><b>{l.subject}</b><br />{l.teacher}{room ? <><br />Room: {room}</> : null}</>)
    }
    if (kind === 'teacher') {
      const l = lessons.find((x) => x.teacher === who && x.day === day && x.period === period)
      if (!l) return null
      const room = roomFor(l.className, day, period)
      return (<><b>{l.subject}</b><br />{l.className}{room ? <><br />Room: {room}</> : null}</>)
    }
    const a = allocs.find((x) => x.room === who && x.day === day && x.period === period)
    if (!a) return null
    return (<><b>{a.className}</b>{a.subject ? <><br />{a.subject}</> : null}{a.teacher ? <><br />{a.teacher}</> : null}</>)
  }

  const sheet = (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ ...thStyle, width: kind === 'rooms' ? 130 : 90 }}>{kind === 'rooms' ? 'Room' : 'Period'}</th>
          {cfg.days.map((d, di) => (<th key={d} style={thStyle}>{cfg.showDayNumbers ? cfg.headerDays[di] : cfg.shortDays[di]}</th>))}
        </tr>
      </thead>
      <tbody>
        {kind === 'rooms' ? (
          roomNames.map((room) => (
            <tr key={room}>
              <td style={tdStyle}><b>{room}</b></td>
              {cfg.days.map((d) => (
                <td key={d} style={tdStyle}>
                  {allocs
                    .filter((a) => a.room === room && a.day === d)
                    .map((a) => (<div key={a.id} style={{ marginBottom: 2 }}>{a.period} · <b>{a.className}</b>{a.subject ? ` · ${a.subject}` : ''}</div>))}
                </td>
              ))}
            </tr>
          ))
        ) : (
          cfg.periods.map((p, pi) => (
            <Fragment key={p}>
              <tr>
                <td style={tdStyle}><b>{p}</b><br />{cfg.bellTimes[p]}</td>
                {cfg.days.map((d) => (<td key={d} style={tdStyle}>{cellContent(d, p)}</td>))}
              </tr>
              {pi === 3 && BREAK && (
                <tr>
                  <td colSpan={cfg.days.length + 1} style={{ ...tdStyle, height: 'auto', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.25em', background: '#e8e8e8', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                    {BREAK}
                  </td>
                </tr>
              )}
            </Fragment>
          ))
        )}
      </tbody>
    </table>
  )

  const printNow = () => {
    document.body.classList.add('timetable-printing')
    const done = () => {
      document.body.classList.remove('timetable-printing')
      window.removeEventListener('afterprint', done)
    }
    window.addEventListener('afterprint', done)
    window.setTimeout(() => window.print(), 60)
  }

  const title = kind === 'rooms' ? KIND_LABEL.rooms : `${KIND_LABEL[kind]} — ${who}`

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Administration</span><span>/</span><span>Education Management</span>
        <span>/</span><span>Timetable</span>
        <span>/</span><span className="font-semibold text-inherit">{t('nav.eduPrint')}</span>
      </div>
      <PageHeader
        title={t('nav.eduPrint')}
        desc={`${branchName ?? 'Branch'} · Choose a sheet, preview it, and print on A4 landscape.`}
      />

      <div className="card">
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-3">
          <Field label="Sheet" className="w-64">
            <Select value={kind} onChange={(e) => { setKind(e.target.value as Kind); setSelected('') }}>
              {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (<option key={k} value={k}>{KIND_LABEL[k]}</option>))}
            </Select>
          </Field>
          {kind !== 'rooms' && (
            <Field label="For" className="w-64">
              <Select value={who} onChange={(e) => setSelected(e.target.value)}>
                {options.map((o) => (<option key={o} value={o}>{o}</option>))}
              </Select>
            </Field>
          )}
          <div className="ml-auto">
            <Button onClick={printNow} disabled={kind !== 'rooms' && !who}>
              <Printer className="size-4" /> Print
            </Button>
          </div>
        </div>

        {kind !== 'rooms' && !who ? (
          <div className="p-6">
            <Empty title="Nothing to print yet" desc="Build the timetable first — then pick a class, teacher or room here." />
          </div>
        ) : (
          <div className="overflow-x-auto bg-white p-4">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #111', paddingBottom: 6, marginBottom: 10 }}>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111' }}>{branchName ?? 'Branch'} — {title}</p>
              </div>
              <p style={{ margin: 0, fontSize: 10, color: '#111' }}>Education Management · Printed {new Date().toLocaleDateString()}</p>
            </div>
            {sheet}
          </div>
        )}
      </div>

      {createPortal(
        <div className="timetable-print-root">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #111', paddingBottom: 6, marginBottom: 10 }}>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{branchName ?? 'Branch'} — {title}</p>
            </div>
            <p style={{ margin: 0, fontSize: 10 }}>Education Management · Printed {new Date().toLocaleDateString()}</p>
          </div>
          {sheet}
          <p style={{ marginTop: 8, fontSize: 9, color: '#444' }}>Generated by FitPro Education Management — Print.</p>
        </div>,
        document.body,
      )}
    </div>
  )
}
