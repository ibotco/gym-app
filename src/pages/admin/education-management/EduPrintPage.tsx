import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Printer } from 'lucide-react'
import { PageHeader, Button, Field, Select, Empty } from '../../../components/ui'
import { TableColumnSizer } from '../../../components/TableColumnSizer'
import { VerticalBreakLabel } from '../../../components/VerticalBreakLabel'
import { useI18n } from '../../../context/I18nContext'
import { useApp } from '../../../context/AppContext'
import { createPortal } from 'react-dom'
import { loadEduRecords, type EduRow } from '../../../lib/eduRecords'
import { loadTtConfig, printPeriodName } from '../../../lib/eduTimetableConfig'
import { activeTimetableSchedule, timetableScheduleCaption } from '../../../lib/eduTimetableSchedules'
import { breakHeaderLabel, breakPrintFontSize, breakPrintTitle, breaksBeforePeriod, classBreaksFor } from '../../../lib/eduTimetableBreaks'
import { teacherTimetableName } from '../../../lib/eduTeacherNames'
import { classroomTimetableName, subjectTimetableName } from '../../../lib/eduTimetableLabels'

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
  const { activeBranchId, branches, staff, users } = useApp()
  const branchName = branches.find((b) => b.id === activeBranchId)?.name

  const [records, setRecords] = useState(() => loadEduRecords(activeBranchId))
  useEffect(() => {
    setRecords(loadEduRecords(activeBranchId))
  }, [activeBranchId])

  const [kind, setKind] = useState<Kind>('class')
  const [selected, setSelected] = useState('')
  const [printLayout, setPrintLayout] = useState<'periods-down' | 'periods-across'>('periods-down')

  const cfg = useMemo(() => loadTtConfig(records), [records])
  const scheduleCaption = timetableScheduleCaption(activeTimetableSchedule(records))
  const displayTeacherName = (name: string) => teacherTimetableName(name, cfg.teacherNameDisplay, staff, users, activeBranchId)
  const roomRows = useMemo(() => records['rooms'] ?? [], [records])
  const subjectRows = useMemo(() => records['subjectList'] ?? [], [records])
  const displayRoomName = (name: string) => classroomTimetableName(name, cfg, roomRows)
  const displaySubjectName = (name: string) => subjectTimetableName(name, cfg, subjectRows)
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
    staff
      .filter((employee) => (!employee.branchId || employee.branchId === activeBranchId)
        && (employee.staffType === 'teacher' || employee.staffCategory?.trim().toLocaleLowerCase() === 'teaching'))
      .forEach((employee) => {
        const name = users.find((account) => account.id === employee.userId)?.name?.trim()
        if (name) set.add(name)
      })
    return [...set].sort()
  }, [lessons, records, staff, users, activeBranchId])

  const roomNames = useMemo(() => {
    const set = new Set<string>()
    roomRows.forEach((r) => r.name && set.add(r.name))
    allocs.forEach((a) => a.room && set.add(a.room))
    ;(records['classList'] ?? []).forEach((c) => c.room && set.add(c.room))
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [records, allocs])

  const options = kind === 'class' ? classes : kind === 'teacher' ? teachers : kind === 'room' ? roomNames : []
  const who = selected && options.includes(selected) ? selected : options[0] ?? ''
  const selectedBreaks = useMemo(
    () => kind === 'class' && cfg.showBreaks ? classBreaksFor(records['classBreaks'] ?? [], who) : [],
    [kind, cfg.showBreaks, records, who],
  )

  const roomFor = (className: string, day: string, period: string) =>
    allocs.find((a) => a.className === className && a.day === day && a.period === period)?.room ?? ''

  const thStyle: React.CSSProperties = { border: '1px solid #888', padding: '5px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', background: '#f0f0f0', color: '#111', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }
  const tdStyle: React.CSSProperties = { border: '1px solid #888', padding: '6px', fontSize: 10, verticalAlign: 'top', height: 44, color: '#111' }
  const dayHeaders = cfg.showDayNumbers ? cfg.headerDays : cfg.shortDays
  const periodColumnSizer = (
    <TableColumnSizer>
      {cfg.periods.map((p, pi) => (
        <span key={p} style={{ display: 'block', whiteSpace: 'nowrap' }}>
          <span style={{ display: 'block', fontSize: 10, fontWeight: 700 }}>{printPeriodName(cfg, p, pi)}</span>
          <span style={{ display: 'block', fontSize: 10 }}>{cfg.bellTimes[p]}</span>
        </span>
      ))}
    </TableColumnSizer>
  )
  const dayColumnSizer = (
    <TableColumnSizer>
      {dayHeaders.map((day) => <span key={day} style={{ display: 'block', whiteSpace: 'nowrap', fontSize: 10, fontWeight: 700 }}>{day}</span>)}
    </TableColumnSizer>
  )

  const renderPrintLines = (lines: ReactNode[]) => lines.map((line, index) => (
    <Fragment key={index}>{index > 0 ? <br /> : null}{line}</Fragment>
  ))
  const cellContent = (day: string, period: string) => {
    if (kind === 'class') {
      const l = lessons.find((x) => x.className === who && x.day === day && x.period === period)
      if (!l) return null
      const room = roomFor(l.className, day, period)
      const lines: ReactNode[] = []
      if (cfg.printShowSubject && l.subject) lines.push(<b>{displaySubjectName(l.subject)}</b>)
      if (cfg.printShowTeacher && l.teacher) lines.push(displayTeacherName(l.teacher))
      if (cfg.printShowClassroom && room) lines.push(<>Room: {displayRoomName(room)}</>)
      return renderPrintLines(lines)
    }
    if (kind === 'teacher') {
      const l = lessons.find((x) => x.teacher === who && x.day === day && x.period === period)
      if (!l) return null
      const room = roomFor(l.className, day, period)
      const lines: ReactNode[] = []
      if (cfg.printShowSubject && l.subject) lines.push(<b>{displaySubjectName(l.subject)}</b>)
      if (l.className) lines.push(l.className)
      if (cfg.printShowClassroom && room) lines.push(<>Room: {displayRoomName(room)}</>)
      return renderPrintLines(lines)
    }
    const a = allocs.find((x) => x.room === who && x.day === day && x.period === period)
    if (!a) return null
    const lines: ReactNode[] = []
    if (a.className) lines.push(<b>{a.className}</b>)
    if (cfg.printShowSubject && a.subject) lines.push(displaySubjectName(a.subject))
    if (cfg.printShowTeacher && a.teacher) lines.push(displayTeacherName(a.teacher))
    return renderPrintLines(lines)
  }

  const sheet = (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', color: '#111' }}>
      {kind === 'rooms' ? (
        <>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 130 }}>Room</th>
              {cfg.days.map((d, di) => (<th key={d} style={thStyle}>{cfg.showDayNumbers ? cfg.headerDays[di] : cfg.shortDays[di]}</th>))}
            </tr>
          </thead>
          <tbody>
            {roomNames.map((room) => (
              <tr key={room}>
                <td style={tdStyle}><b>{displayRoomName(room)}</b></td>
                {cfg.days.map((d) => (
                  <td key={d} style={tdStyle}>
                    {allocs
                      .filter((a) => a.room === room && a.day === d)
                      .map((a) => (
                        <div key={a.id} style={{ marginBottom: 2 }}>
                          {printPeriodName(cfg, a.period, cfg.periods.indexOf(a.period))} · <b>{a.className}</b>
                          {cfg.printShowSubject && a.subject ? ` · ${displaySubjectName(a.subject)}` : ''}
                          {cfg.printShowTeacher && a.teacher ? ` · ${displayTeacherName(a.teacher)}` : ''}
                        </div>
                      ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </>
      ) : printLayout === 'periods-down' ? (
        <>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 'max-content', whiteSpace: 'nowrap' }}>Period{periodColumnSizer}</th>
              {cfg.days.map((d, di) => (<th key={d} style={thStyle}>{cfg.showDayNumbers ? cfg.headerDays[di] : cfg.shortDays[di]}</th>))}
            </tr>
          </thead>
          <tbody>
            {cfg.periods.map((p, pi) => (
              <Fragment key={p}>
                {breaksBeforePeriod(selectedBreaks, pi).map((item) => (
                  <tr key={`break-${item.id}`}>
                    <td colSpan={cfg.days.length + 1} style={{ ...tdStyle, height: 'auto', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.25em', background: '#e8e8e8', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                      {breakHeaderLabel(cfg, item)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}><b>{printPeriodName(cfg, p, pi)}</b><br />{cfg.bellTimes[p]}</td>
                  {cfg.days.map((d) => (<td key={d} style={tdStyle}>{cellContent(d, p)}</td>))}
                </tr>
              </Fragment>
            ))}
          </tbody>
        </>
      ) : (
        <>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 'max-content', whiteSpace: 'nowrap' }}>Day{dayColumnSizer}</th>
              {cfg.periods.map((p, pi) => (
                <Fragment key={p}>
                  {breaksBeforePeriod(selectedBreaks, pi).map((item) => <th key={`break-${item.id}`} style={thStyle}>{breakHeaderLabel(cfg, item)}</th>)}
                  <th style={thStyle}>{printPeriodName(cfg, p, pi)}<br />{cfg.bellTimes[p]}</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {cfg.days.map((d, di) => (
              <tr key={d}>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}><b>{dayHeaders[di]}</b></td>
                {cfg.periods.map((p, pi) => (
                  <Fragment key={p}>
                    {breaksBeforePeriod(selectedBreaks, pi).map((item) => di === 0 ? (
                      <td key={`break-${item.id}`} rowSpan={cfg.days.length} style={{ ...tdStyle, position: 'relative', height: 'auto', padding: 0, textAlign: 'center', verticalAlign: 'middle', background: '#e8e8e8', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                        <VerticalBreakLabel title={breakPrintTitle(item, cfg)} fontSize={breakPrintFontSize(item)} />
                      </td>
                    ) : null)}
                    <td style={tdStyle}>{cellContent(d, p)}</td>
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </>
      )}
    </table>
  )

  const printNow = () => {
    // Add a final, temporary page rule so browser Print Preview opens in
    // landscape even if another module has registered a later portrait @page.
    const landscapeRule = document.createElement('style')
    landscapeRule.dataset.timetableLandscape = 'true'
    landscapeRule.textContent = '@media print { @page { size: A4 landscape; margin: 10mm; } }'
    document.head.appendChild(landscapeRule)
    document.body.classList.add('timetable-printing')
    const done = () => {
      document.body.classList.remove('timetable-printing')
      landscapeRule.remove()
      window.removeEventListener('afterprint', done)
    }
    window.addEventListener('afterprint', done)
    window.setTimeout(() => window.print(), 60)
  }

  const displayWho = kind === 'teacher' ? displayTeacherName(who) : kind === 'room' ? displayRoomName(who) : who
  const title = kind === 'rooms' ? KIND_LABEL.rooms : `${KIND_LABEL[kind]} — ${displayWho}`

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Administration</span><span>/</span><span>Education Management</span>
        <span>/</span><span>Timetable</span>
        <span>/</span><span className="font-semibold text-inherit">{t('nav.eduPrint')}</span>
      </div>
      <PageHeader
        title={t('nav.eduPrint')}
        printTitle={kind === 'rooms' ? KIND_LABEL.rooms : `${KIND_LABEL[kind]} - ${displayWho}`}
        desc={`${branchName ?? 'Branch'}${scheduleCaption ? ` · ${scheduleCaption}` : ''} · Choose a sheet and layout, preview it, and print on A4 landscape.`}
      />

      <div className="card">
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-3">
          <Field label="Sheet" className="w-64">
            <Select value={kind} onChange={(e) => { setKind(e.target.value as Kind); setSelected('') }}>
              {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (<option key={k} value={k}>{KIND_LABEL[k]}</option>))}
            </Select>
          </Field>
          {kind !== 'rooms' && (
            <>
              <Field label="For" className="w-64">
                <Select value={who} onChange={(e) => setSelected(e.target.value)}>
                  {options.map((o) => (<option key={o} value={o}>{kind === 'teacher' ? displayTeacherName(o) : kind === 'room' ? displayRoomName(o) : o}</option>))}
                </Select>
              </Field>
              <Field label="Print layout" className="w-72">
                <Select value={printLayout} onChange={(e) => setPrintLayout(e.target.value as 'periods-down' | 'periods-across')}>
                  <option value="periods-down">Periods vertical · Days horizontal</option>
                  <option value="periods-across">Periods horizontal · Days vertical</option>
                </Select>
              </Field>
            </>
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
          <div className="overflow-x-auto bg-white p-4" style={{ color: '#111' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #111', paddingBottom: 6, marginBottom: 10 }}>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111' }}>{branchName ?? 'Branch'} — {title}</p>
                {scheduleCaption && <p style={{ margin: 0, fontSize: 11, color: '#111' }}>{scheduleCaption}</p>}
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
              {scheduleCaption && <p style={{ margin: 0, fontSize: 11 }}>{scheduleCaption}</p>}
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
