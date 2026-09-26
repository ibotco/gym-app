import { Fragment, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Trash2, AlertTriangle, Printer, Wand2, DoorOpen } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Empty } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { useApp } from '../../context/AppContext'
import { cn, uid } from '../../lib/utils'
import { createPortal } from 'react-dom'
import { loadEduRecords, saveEduRecords, type EduRow } from '../../lib/eduRecords'
import { generateTimetable } from '../../lib/eduTimetableGen'
import { breakLabel, loadTtConfig } from '../../lib/eduTimetableConfig'
import { flattenTimeOff } from '../../lib/eduTimeOff'
import { DIVISIONS, findStartSlots, lessonSlots, lessonsClash, nextPeriod } from '../../lib/eduLesson'

/** Stable subject → card colour, like aSc Timetables' coloured cards. */
const PALETTE = [
  'border-lime/50 bg-lime/15 text-lime-ink dark:text-lime',
  'border-sky-400/50 bg-sky-400/15 text-sky-800 dark:text-sky-300',
  'border-violet-400/50 bg-violet-400/15 text-violet-800 dark:text-violet-300',
  'border-amber-400/50 bg-amber-400/15 text-amber-800 dark:text-amber-300',
  'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  'border-orange-400/50 bg-orange-400/15 text-orange-800 dark:text-orange-300',
]
const colorFor = (subject: string) => {
  let h = 0
  for (let i = 0; i < subject.length; i++) h = (h * 31 + subject.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

type CellLesson = EduRow & { cont?: string }

/**
 * aSc-Timetables-style weekly grid for Education Management.
 * Class Timetable shows one class's week; Teacher Timetable shows one
 * teacher's week. The Add/Edit lesson dialog mirrors aSc's Lesson card:
 * teacher, subject, class + division, lessons/week, single/double length and
 * classroom choice (home classroom / shared rooms / other classrooms).
 */
export function EduTimetablePage() {
  const { leaf } = useParams()
  const navigate = useNavigate()
  const teacherMode = leaf === 'teacher-timetable'
  const toast = useToast()
  const { activeBranchId, branches } = useApp()
  const branchName = branches.find((b) => b.id === activeBranchId)?.name

  const [records, setRecords] = useState(() => loadEduRecords(activeBranchId))

  // Branch-related: each branch keeps its own timetable.
  useEffect(() => {
    setRecords(loadEduRecords(activeBranchId))
    setEdit(null)
    setSelected('')
  }, [activeBranchId])
  const lessons = useMemo(() => records['classTimetable'] ?? [], [records])
  const roomAlloc = useMemo(() => records['roomAllocation'] ?? [], [records])

  // Timetable definition (Timetable Rules → Days & Periods) drives the grid.
  const cfg = useMemo(() => loadTtConfig(records), [records])
  const DAYS = cfg.days
  const PERIODS = cfg.periods
  const PERIOD_TIMES = cfg.bellTimes
  const DAY_HEADS = cfg.showDayNumbers ? cfg.headerDays : cfg.shortDays
  const BREAK = breakLabel(cfg)

  const toFlat = useMemo(() => flattenTimeOff(records['timeOff'] ?? [], DAYS, PERIODS), [records, DAYS, PERIODS])
  const isBlocked = (whoType: 'teacher' | 'class', name: string, day: string, period: string) => {
    const idx = PERIODS.indexOf(period)
    return toFlat.blocked.some((o) => o.whoType === whoType && o.name === name && o.day === day && idx >= o.fromIdx && idx <= o.toIdx)
  }

  // Room assigned to a class slot, plus room double-booking detection.
  const roomInfo = (l: EduRow) => {
    const a = roomAlloc.find((r) => r.className === l.className && r.day === l.day && r.period === l.period)
    if (!a || !a.room) return null
    const roomClash = roomAlloc.some((o) => o.id !== a.id && o.room === a.room && o.day === a.day && o.period === a.period)
    return { room: a.room, roomClash }
  }

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

  const subjects = useMemo(() => {
    const set = new Set<string>()
    lessons.forEach((l) => l.subject && set.add(l.subject))
    ;(records['subjectList'] ?? []).forEach((s) => s.name && set.add(s.name))
    return [...set].sort()
  }, [lessons, records])

  const roomRows = useMemo(() => records['rooms'] ?? [], [records])
  const roomNames = useMemo(() => {
    const set = new Set<string>()
    roomRows.forEach((r) => r.name && set.add(r.name))
    roomAlloc.forEach((a) => a.room && set.add(a.room))
    ;(records['classList'] ?? []).forEach((c) => c.room && set.add(c.room))
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [roomRows, roomAlloc, records])
  const isSharedRoom = (name: string) => roomRows.find((r) => r.name === name)?.shared === 'Yes'
  const homeRoomOf = (name: string) => {
    const c = (records['classList'] ?? []).find((x) => [x.name, x.section].filter(Boolean).join(' ') === name)
    return c?.room ?? ''
  }

  const [selected, setSelected] = useState<string>('')
  const who = selected || (teacherMode ? teachers[0] : classes[0]) || ''

  const [edit, setEdit] = useState<EduRow | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [perWeek, setPerWeek] = useState('1')
  const [useHome, setUseHome] = useState(true)
  const [allowShared, setAllowShared] = useState(false)
  const [genOpen, setGenOpen] = useState(false)
  const [genPeriods, setGenPeriods] = useState('4')

  // ---- Automatic generation inputs ----
  const genClasses = useMemo(() => {
    const map = new Map<string, string>()
    ;(records['classList'] ?? []).forEach((c) => {
      const label = [c.name, c.section].filter(Boolean).join(' ')
      if (label) map.set(label, c.room ?? '')
    })
    ;(records['assignSubjectTeacher'] ?? []).forEach((a) => {
      if (a.className && !map.has(a.className)) map.set(a.className, '')
    })
    return [...map.entries()].map(([name, room]) => ({ name, room }))
  }, [records])

  const genAssignments = useMemo(() => {
    const fallback = Math.max(1, Number(genPeriods) || 4)
    return (records['assignSubjectTeacher'] ?? [])
      .filter((a) => a.className && a.subject && a.teacher)
      .map((a) => ({ className: a.className, subject: a.subject, teacher: a.teacher, periodsPerWeek: Math.max(1, Number(a.periodsPerWeek) || fallback) }))
  }, [records, genPeriods])

  const genRules = useMemo(() => {
    const num = (v: string | undefined) => {
      const n = Number(v)
      return Number.isFinite(n) && n > 0 ? n : undefined
    }
    return {
      classRules: (records['classRules'] ?? []).filter((r) => r.className).map((r) => ({ name: r.className, maxPerDay: num(r.maxPerDay), maxPerWeek: num(r.maxPerWeek) })),
      teacherRules: (records['teacherRules'] ?? []).filter((r) => r.teacher).map((r) => ({ name: r.teacher, maxPerDay: num(r.maxPerDay), maxPerWeek: num(r.maxPerWeek), unavailableDay: r.unavailableDay, unavailablePeriod: r.unavailablePeriod })),
      timeOff: toFlat.blocked,
      timeOffConditional: toFlat.conditional,
      constraints: (records['constraints'] ?? []).filter((r) => r.kind).map((r) => ({
        kind: r.kind as 'teacherConsec' | 'classConsec' | 'classSubjectOnce',
        target: r.target || '',
        value: num(r.value),
      })),
    }
  }, [records, toFlat])

  const runGenerate = () => {
    const { lessons, unplaced } = generateTimetable([...DAYS], [...PERIODS], genClasses, genAssignments, genRules)
    persist(lessons as unknown as EduRow[])
    setGenOpen(false)
    toast.success(
      'Timetable generated',
      `${lessons.length} lesson${lessons.length === 1 ? '' : 's'} placed across ${genClasses.length} class${genClasses.length === 1 ? '' : 'es'}${unplaced ? ` · ${unplaced} unplaced (not enough free slots)` : ''}`,
    )
  }

  const persistAll = (nextLessons: EduRow[], nextAllocs?: EduRow[]) => {
    const all = { ...records, classTimetable: nextLessons, ...(nextAllocs ? { roomAllocation: nextAllocs } : {}) }
    setRecords(all)
    saveEduRecords(activeBranchId, all)
  }
  const persist = (next: EduRow[]) => persistAll(next)

  const cellLesson = (day: string, period: string): CellLesson | undefined => {
    const direct = lessons.find((l) => l.day === day && l.period === period && (teacherMode ? l.teacher === who : l.className === who))
    if (direct) return direct
    const cont = lessons.find(
      (l) => l.duration === 'Double' && l.day === day && nextPeriod(PERIODS, l.period) === period && (teacherMode ? l.teacher === who : l.className === who),
    )
    return cont ? { ...cont, cont: '1' } : undefined
  }

  const clash = (lesson: EduRow) => lessons.some((l) => lessonsClash(l, lesson, PERIODS))

  const openAdd = (day?: string, period?: string) => {
    setEdit({
      id: uid(),
      day: day ?? DAYS[0],
      period: period ?? PERIODS[0],
      className: teacherMode ? '' : who,
      teacher: teacherMode ? who : '',
      subject: '',
      group: 'Entire class',
      duration: 'Single',
      room: '',
    })
    setIsNew(true)
    setPerWeek('1')
    setUseHome(true)
    setAllowShared(false)
  }

  const openEdit = (l: EduRow) => {
    setEdit({ ...l, group: l.group || 'Entire class', duration: l.duration || 'Single' })
    setIsNew(false)
    setPerWeek('1')
    setUseHome(true)
    setAllowShared(false)
  }

  const submit = () => {
    if (!edit) return
    if (!edit.subject?.trim()) { toast.error('Subject is required'); return }
    if (!edit.className?.trim()) { toast.error('Class is required'); return }
    if (!edit.teacher?.trim()) { toast.error('Teacher is required'); return }
    const base: EduRow = {
      ...edit,
      group: edit.group && edit.group !== 'Entire class' ? edit.group : '',
      duration: edit.duration === 'Double' ? 'Double' : '',
    }
    const span = lessonSlots(base, PERIODS)
    if (edit.duration === 'Double' && span.length !== 2) {
      toast.error('A double lesson needs a following period on the same day')
      return
    }
    // Time Off across the whole span.
    for (const sp of span) {
      if (isBlocked('teacher', base.teacher, sp.day, sp.period)) { toast.error(`${base.teacher} has time off on ${sp.day} ${sp.period}`); return }
      if (isBlocked('class', base.className, sp.day, sp.period)) { toast.error(`${base.className} has time off on ${sp.day} ${sp.period}`); return }
    }
    // Clash guard: teacher or same class/division on overlapping spans.
    const clashRow = lessons.find((l) => l.id !== base.id && lessonsClash(l, base, PERIODS))
    if (clashRow) {
      toast.error(
        clashRow.teacher === base.teacher
          ? `${base.teacher} already teaches ${clashRow.className} on ${clashRow.day} ${clashRow.period}`
          : `${base.className} already has ${clashRow.subject} on ${clashRow.day} ${clashRow.period}`,
      )
      return
    }
    // Classroom choice → Room Allocation rows.
    const homeRoom = homeRoomOf(base.className)
    const roomPick = base.room || (useHome && homeRoom ? homeRoom : '')
    const roomBusyRow = roomPick
      ? roomAlloc.find((a) => a.room === roomPick && a.className !== base.className && span.some((sp) => sp.day === a.day && sp.period === a.period))
      : undefined
    if (roomBusyRow) {
      toast.error(`${roomPick} is already booked for ${roomBusyRow.className} on ${roomBusyRow.day} ${roomBusyRow.period}`)
      return
    }

    // Build the card(s): the chosen slot first, then Lessons/week − 1 more.
    const others = lessons.filter((l) => l.id !== base.id)
    const cards: EduRow[] = [{ ...base }]
    if (isNew) {
      const extra = Math.max(0, (Number(perWeek) || 1) - 1)
      if (extra > 0) {
        const starts = findStartSlots(
          [...others, base],
          DAYS,
          PERIODS,
          { teacher: base.teacher, className: base.className, group: base.group || 'Entire class', duration: base.duration || 'Single' },
          extra,
          () => roomPick,
          (room, d, p) => !roomAlloc.some((a) => a.room === room && a.className !== base.className && a.day === d && a.period === p),
          (whoT, name, d, p) => isBlocked(whoT, name, d, p),
        ).filter((s) => !(s.day === base.day && s.period === base.period))
        starts.forEach((s) => cards.push({ ...base, id: uid(), day: s.day, period: s.period }))
      }
    }

    const nextLessons = isNew ? [...lessons, ...cards] : lessons.map((l) => (l.id === base.id ? base : l))
    // Re-sync Room Allocation for every span slot of every card.
    let nextAllocs = roomAlloc.filter((a) => !(a.className === base.className && cards.some((c) => lessonSlots(c, PERIODS).some((sp) => sp.day === a.day && sp.period === a.period))))
    if (roomPick) {
      for (const c of cards) {
        for (const sp of lessonSlots(c, PERIODS)) {
          nextAllocs = [...nextAllocs, { id: uid(), room: roomPick, day: sp.day, period: sp.period, className: base.className, subject: base.subject, teacher: base.teacher }]
        }
      }
    }
    persistAll(nextLessons, nextAllocs)
    toast.success(
      isNew ? 'Lesson added' : 'Lesson updated',
      `${base.subject} · ${cards.length > 1 ? `${cards.length} cards/week` : `${base.day} ${base.period}`}${roomPick ? ` · ${roomPick}` : ''}`,
    )
    setEdit(null)
  }

  const remove = () => {
    if (!edit) return
    const span = lessonSlots(edit, PERIODS)
    const nextAllocs = roomAlloc.filter((a) => !(a.className === edit.className && span.some((sp) => sp.day === a.day && sp.period === a.period)))
    persistAll(lessons.filter((l) => l.id !== edit.id), nextAllocs)
    toast.success('Lesson removed', `${edit.subject} · ${edit.day} ${edit.period}`)
    setEdit(null)
  }

  const printNow = () => {
    document.body.classList.add('timetable-printing')
    const done = () => {
      document.body.classList.remove('timetable-printing')
      window.removeEventListener('afterprint', done)
    }
    window.addEventListener('afterprint', done)
    window.setTimeout(() => window.print(), 60)
  }

  const options = teacherMode ? teachers : classes
  const roomOptions = roomNames.filter((r) => allowShared || !isSharedRoom(r))

  const thStyle: React.CSSProperties = { border: '1px solid #888', padding: '5px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', background: '#f0f0f0', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }
  const tdStyle: React.CSSProperties = { border: '1px solid #888', padding: '6px', fontSize: 10, verticalAlign: 'top', height: 44 }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Administration</span><span>/</span><span>Education Management</span>
        <span>/</span><span>Timetable</span>
        <span>/</span><span className="font-semibold text-inherit">{teacherMode ? 'Teacher Timetable' : 'Class Timetable'}</span>
      </div>
      <PageHeader
        title={teacherMode ? 'Teacher Timetable' : 'Class Timetable'}
        desc={`${branchName ?? 'Branch'} · Weekly grid — click an empty slot to add a lesson, click a card to edit it.`}
      />

      <div className="card">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <Field label={teacherMode ? 'Teacher' : 'Class'} className="w-56">
            <Select value={who} onChange={(e) => setSelected(e.target.value)}>
              {options.map((o) => (<option key={o} value={o}>{o}</option>))}
            </Select>
          </Field>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="soft" onClick={() => setGenOpen(true)}><Wand2 className="size-4" /> Auto-generate</Button>
            <Button size="sm" variant="outline" onClick={printNow} disabled={!who}><Printer className="size-4" /> Print</Button>
            <Button size="sm" onClick={() => openAdd()} disabled={!who}>
              <Plus className="size-4" /> Add lesson
            </Button>
          </div>
        </div>

        {!who ? (
          <div className="p-6">
            <Empty title="No classes or teachers yet" desc="Add classes and staff first, then build the timetable." />
          </div>
        ) : (
          <div className="overflow-x-auto p-3">
            <table className="w-full min-w-[860px] border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="w-32 rounded-lg border border-line bg-black/[0.02] px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">Period</th>
                  {DAYS.map((d, di) => (
                    <th key={d} className="rounded-lg border border-line bg-black/[0.02] px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">{DAY_HEADS[di]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((p, pi) => (
                  <Fragment key={p}>
                  <tr>
                    <td className="rounded-lg border border-line bg-black/[0.02] px-2 py-2 align-top dark:bg-white/[0.03]">
                      <p className="text-[11px] font-bold">{p}</p>
                      <p className="text-[10px] text-mist">{PERIOD_TIMES[p]}</p>
                    </td>
                    {DAYS.map((d) => {
                      const l = cellLesson(d, p)
                      const ri = l ? roomInfo(l) : null
                      return (
                        <td key={d} className="h-16 min-w-[120px] rounded-lg border border-dashed border-line/70 align-top">
                          {l ? (
                            <button
                              type="button"
                              onClick={() => openEdit(l)}
                              title={`${l.subject} · ${l.teacher} · ${l.className}${l.cont ? ' (continued)' : ''}`}
                              className={cn('flex h-full w-full flex-col justify-between rounded-lg border px-2 py-1.5 text-left text-[11px] font-semibold transition hover:brightness-110', colorFor(l.subject), l.cont && 'opacity-70')}
                            >
                              <span className="flex w-full items-center justify-between gap-1">
                                <span className="truncate">{l.subject}{l.cont ? ' ·' : ''}</span>
                                <span className="flex items-center gap-1">
                                  {!l.cont && l.duration === 'Double' && <span className="rounded bg-black/10 px-1 text-[9px] font-bold dark:bg-white/10">×2</span>}
                                  {(clash(l) || ri?.roomClash) && <AlertTriangle className="size-3.5 shrink-0 text-rose-600 dark:text-rose-400" aria-label="Clash" />}
                                </span>
                              </span>
                              <span className="truncate text-[10px] font-medium opacity-80">{teacherMode ? l.className : l.teacher}{ri?.room ? ` · ${ri.room}` : ''}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openAdd(d, p)}
                              aria-label={`Add lesson ${d} ${p}`}
                              className="flex h-full w-full items-center justify-center rounded-lg text-mist/40 transition hover:bg-black/[0.03] hover:text-mist dark:hover:bg-white/[0.04]"
                            >
                              <Plus className="size-4" />
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                  {pi === 3 && BREAK && (
                    <tr>
                      <td colSpan={DAYS.length + 1} className="rounded-lg border border-line/60 bg-black/[0.04] px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-mist dark:bg-white/[0.05]">
                        {BREAK}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {lessons.filter((l) => (teacherMode ? l.teacher === who : l.className === who)).length === 0 && (
              <p className="mt-2 text-center text-xs text-mist">Empty week — click any slot (or “Add lesson”) to place the first card.</p>
            )}
          </div>
        )}
      </div>

      {/* aSc-style Lesson dialog */}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={isNew ? 'Add lesson' : 'Edit lesson'}>
        {edit && (
          <div className="grid gap-3">
            <Field label="Teacher" required>
              {teachers.length ? (
                <Select value={edit.teacher ?? ''} onChange={(e) => setEdit({ ...edit, teacher: e.target.value })} placeholder="Select…">
                  {teachers.map((tc) => (<option key={tc} value={tc}>{tc}</option>))}
                </Select>
              ) : (
                <Input list="edu-tt-teachers" value={edit.teacher ?? ''} onChange={(e) => setEdit({ ...edit, teacher: e.target.value })} placeholder="e.g. Grace Mensah" />
              )}
            </Field>
            <Field label="Subject" required>
              {subjects.length ? (
                <Select value={edit.subject ?? ''} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} placeholder="Select…">
                  {subjects.map((s) => (<option key={s} value={s}>{s}</option>))}
                </Select>
              ) : (
                <Input value={edit.subject ?? ''} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} placeholder="e.g. Mathematics" />
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Class" required>
                {classes.length ? (
                  <Select value={edit.className ?? ''} onChange={(e) => setEdit({ ...edit, className: e.target.value })} placeholder="Select…">
                    {classes.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </Select>
                ) : (
                  <Input list="edu-tt-classes" value={edit.className ?? ''} onChange={(e) => setEdit({ ...edit, className: e.target.value })} placeholder="e.g. Basic 7 A" />
                )}
              </Field>
              <Field label="Division" hint="Divisions of the same class can run in parallel.">
                <Select value={edit.group || 'Entire class'} onChange={(e) => setEdit({ ...edit, group: e.target.value })}>
                  {DIVISIONS.map((dv) => (<option key={dv} value={dv}>{dv}</option>))}
                </Select>
              </Field>
            </div>
            <datalist id="edu-tt-classes">{classes.map((c) => (<option key={c} value={c} />))}</datalist>
            <datalist id="edu-tt-teachers">{teachers.map((tc) => (<option key={tc} value={tc} />))}</datalist>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Day"><Select value={edit.day ?? DAYS[0]} onChange={(e) => setEdit({ ...edit, day: e.target.value })}>{DAYS.map((d) => (<option key={d} value={d}>{d}</option>))}</Select></Field>
              <Field label="Period"><Select value={edit.period ?? PERIODS[0]} onChange={(e) => setEdit({ ...edit, period: e.target.value })}>{PERIODS.map((p) => (<option key={p} value={p}>{p} · {PERIOD_TIMES[p]}</option>))}</Select></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {isNew ? (
                <Field label="Lessons/week" hint="Extra cards are auto-placed in free slots.">
                  <Select value={perWeek} onChange={(e) => setPerWeek(e.target.value)}>
                    {['1', '2', '3', '4', '5'].map((n) => (<option key={n} value={n}>{n}</option>))}
                  </Select>
                </Field>
              ) : (
                <span />
              )}
              <Field label="Length">
                <Select value={edit.duration === 'Double' ? 'Double' : 'Single'} onChange={(e) => setEdit({ ...edit, duration: e.target.value === 'Double' ? 'Double' : '' })}>
                  <option value="Single">Single</option>
                  <option value="Double">Double</option>
                </Select>
              </Field>
            </div>

            <div className="grid gap-2 rounded-xl border border-line p-3">
              <label className={cn('flex items-center gap-2 text-sm font-semibold', !homeRoomOf(edit.className ?? '') && 'opacity-50')}>
                <input
                  type="checkbox"
                  className="size-4 accent-lime"
                  checked={useHome && !!homeRoomOf(edit.className ?? '')}
                  disabled={!homeRoomOf(edit.className ?? '')}
                  onChange={(e) => setUseHome(e.target.checked)}
                />
                Home classroom {homeRoomOf(edit.className ?? '') || '(none set)'}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <input type="checkbox" className="size-4 accent-lime" checked={allowShared} onChange={(e) => setAllowShared(e.target.checked)} />
                Shared rooms ({roomNames.filter(isSharedRoom).join(', ') || 'none'})
              </label>
              <div className="flex items-end gap-2">
                <Field label="Other available classrooms" className="flex-1">
                  <Select value={edit.room ?? ''} onChange={(e) => setEdit({ ...edit, room: e.target.value })} placeholder="No other classroom">
                    <option value="">No other classroom</option>
                    {roomOptions.map((r) => (<option key={r} value={r}>{r}</option>))}
                  </Select>
                </Field>
                <Button variant="outline" size="sm" onClick={() => navigate('/admin/education-management/timetable/room-allocation')}>
                  <DoorOpen className="size-4" /> More classrooms
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={submit}>Save lesson</Button>
              {!isNew && <Button variant="danger" onClick={remove}><Trash2 className="size-4" /> Remove</Button>}
              <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Auto-generate timetable">
        <div className="grid gap-3">
          <p className="text-xs font-semibold text-mist">
            {genRules.classRules.length} class rule{genRules.classRules.length === 1 ? '' : 's'} · {genRules.teacherRules.length} teacher rule{genRules.teacherRules.length === 1 ? '' : 's'} · {genRules.timeOff.length} time-off · {genRules.constraints.length} constraint{genRules.constraints.length === 1 ? '' : 's'} applied (Timetable → Timetable Rules).
          </p>
          <p className="text-sm text-mist">
            Builds the whole week automatically from Subjects → Assign Subject Teacher (which subject each teacher
            delivers to each class). The generator never double-books a teacher, a class or a room in the same period.
          </p>
          <div className="rounded-xl border border-line p-3 text-xs">
            <p className="font-bold">{genClasses.length} classes · {genAssignments.length} subject assignments</p>
            <ul className="mt-1 max-h-40 space-y-0 overflow-y-auto text-mist">
              {genAssignments.map((a, i) => (
                <li key={i}>{a.className} — {a.subject} ({a.teacher}) · {a.periodsPerWeek} periods/week</li>
              ))}
              {!genAssignments.length && <li>No assignments yet — add them under Subjects → Assign Subject Teacher.</li>}
            </ul>
          </div>
          <Field label="Default periods per subject per week">
            <Input type="number" min={1} max={40} value={genPeriods} onChange={(e) => setGenPeriods(e.target.value)} />
          </Field>
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Generating replaces the current timetable for every class.</p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={runGenerate} disabled={!genAssignments.length}><Wand2 className="size-4" /> Generate</Button>
            <Button variant="ghost" onClick={() => setGenOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {createPortal(
        <div className="timetable-print-root">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #111', paddingBottom: 6, marginBottom: 10 }}>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{branchName ?? 'Branch'} — {teacherMode ? 'Teacher Timetable' : 'Class Timetable'}</p>
              <p style={{ margin: 0, fontSize: 12 }}>{who}</p>
            </div>
            <p style={{ margin: 0, fontSize: 10 }}>Education Management · Printed {new Date().toLocaleDateString()}</p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 90 }}>Period</th>
                {DAYS.map((d, di) => (<th key={d} style={thStyle}>{DAY_HEADS[di]}</th>))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((p, pi) => (
                <Fragment key={p}>
                  <tr>
                    <td style={tdStyle}><b>{p}</b><br />{PERIOD_TIMES[p]}</td>
                    {DAYS.map((d) => {
                      const l = cellLesson(d, p)
                      const ri = l ? roomInfo(l) : null
                      return (
                        <td key={d} style={tdStyle}>
                          {l && (
                            <>
                              <b>{l.subject}</b>{l.cont ? ' (cont.)' : l.duration === 'Double' ? ' (double)' : ''}
                              <br />
                              {teacherMode ? l.className : l.teacher}
                              {ri?.room ? <><br />Room: {ri.room}</> : null}
                            </>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                  {pi === 3 && BREAK && (
                    <tr>
                      <td colSpan={DAYS.length + 1} style={{ ...tdStyle, height: 'auto', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.25em', background: '#e8e8e8', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                        {BREAK}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: 8, fontSize: 9, color: '#444' }}>Generated by FitPro Education Management — {teacherMode ? 'teacher' : 'class'} view. Rooms come from Room Allocation.</p>
        </div>,
        document.body,
      )}
    </div>
  )
}
