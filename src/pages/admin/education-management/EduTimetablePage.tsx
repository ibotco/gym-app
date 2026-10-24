import { Fragment, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Trash2, AlertTriangle, Printer, Wand2, DoorOpen } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Empty } from '../../../components/ui'
import { TableColumnSizer } from '../../../components/TableColumnSizer'
import { VerticalBreakLabel } from '../../../components/VerticalBreakLabel'
import { useToast } from '../../../context/ToastContext'
import { useApp } from '../../../context/AppContext'
import { cn, uid } from '../../../lib/utils'
import { createPortal } from 'react-dom'
import { loadEduRecords, saveEduRecords, type EduRow } from '../../../lib/eduRecords'
import { generateTimetable } from '../../../lib/eduTimetableGen'
import { loadTtConfig, printPeriodName } from '../../../lib/eduTimetableConfig'
import { activeTimetableSchedule, academicTermLabel, timetableScheduleCaption, timetableSchedules } from '../../../lib/eduTimetableSchedules'
import { breakGridHeaderLabel, breakHeaderLabel, breakPrintFontSize, breakPrintTitle, breaksBeforePeriod, classBreaksFor } from '../../../lib/eduTimetableBreaks'
import { teacherTimetableName } from '../../../lib/eduTeacherNames'
import { classroomTimetableName, subjectTimetableName } from '../../../lib/eduTimetableLabels'
import { flattenTimeOff } from '../../../lib/eduTimeOff'
import { DIVISIONS, findStartSlots, lessonSlots, lessonsClash, nextPeriod } from '../../../lib/eduLesson'

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

const lessonSeriesValue = (value: unknown, fallback = '') => String(value ?? '').trim().toLocaleLowerCase() || fallback.toLocaleLowerCase()
const sameLessonSeries = (a: EduRow, b: EduRow) =>
  ['className', 'teacher', 'subject', 'room'].every((key) => lessonSeriesValue(a[key]) === lessonSeriesValue(b[key]))
  && lessonSeriesValue(a.group, 'Entire class') === lessonSeriesValue(b.group, 'Entire class')
  && lessonSeriesValue(a.duration, 'Single') === lessonSeriesValue(b.duration, 'Single')

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
  const { activeBranchId, branches, staff, users } = useApp()
  const branchName = branches.find((b) => b.id === activeBranchId)?.name

  const [records, setRecords] = useState(() => loadEduRecords(activeBranchId))
  const [scheduleEdit, setScheduleEdit] = useState<EduRow | null>(null)
  const [isNewSchedule, setIsNewSchedule] = useState(false)

  // Branch-related: each branch keeps its own timetable.
  useEffect(() => {
    setRecords(loadEduRecords(activeBranchId))
    setEdit(null)
    setEditSeriesIds([])
    setScheduleEdit(null)
    setIsNewSchedule(false)
    setSelected('')
  }, [activeBranchId])
  const lessons = useMemo(() => records['classTimetable'] ?? [], [records])
  const roomAlloc = useMemo(() => records['roomAllocation'] ?? [], [records])

  // Timetable definition (Timetable Rules → Days & Periods) drives the grid.
  const cfg = useMemo(() => loadTtConfig(records), [records])
  const schedules = timetableSchedules(records)
  const termRows = useMemo(() => [...(records['termSemester'] ?? [])].sort((a, b) =>
    String(b.academicYear ?? '').localeCompare(String(a.academicYear ?? ''), undefined, { numeric: true })
      || String(a.name ?? '').localeCompare(String(b.name ?? ''), undefined, { numeric: true, sensitivity: 'base' })), [records])
  const activeSchedule = activeTimetableSchedule(records)
  const scheduleCaption = timetableScheduleCaption(activeSchedule)
  const availableTerms = termRows.filter((term) => !schedules.some((schedule) => schedule.termId === term.id))
  const DAYS = cfg.days
  const PERIODS = cfg.periods
  const PERIOD_TIMES = cfg.bellTimes
  const DAY_HEADS = cfg.showDayNumbers ? cfg.headerDays : cfg.shortDays
  const displayTeacherName = (name: string) => teacherTimetableName(name, cfg.teacherNameDisplay, staff, users, activeBranchId)

  const toFlat = useMemo(() => flattenTimeOff(records['timeOff'] ?? [], DAYS, PERIODS), [records, DAYS, PERIODS])
  const isBlocked = (whoType: 'teacher' | 'class', name: string, day: string, period: string) => {
    const idx = PERIODS.indexOf(period)
    return toFlat.blocked.some((o) => o.whoType === whoType && o.name === name && o.day === day && idx >= o.fromIdx && idx <= o.toIdx)
  }

  // Prefer a slot-specific allocation, then a room saved on the lesson, then
  // the class's home classroom so every scheduled lesson can show its room.
  const roomInfo = (l: EduRow) => {
    const allocation = roomAlloc.find((row) =>
      row.className === l.className
        && row.day === l.day
        && row.period === l.period
        && (!row.subject || row.subject === l.subject)
        && (!row.teacher || row.teacher === l.teacher),
    )
    const room = String(allocation?.room || l.room || homeRoomOf(l.className) || '').trim()
    if (!room) return null
    const roomClash = roomAlloc.some((row) =>
      row.id !== allocation?.id && row.room === room && row.day === l.day && row.period === l.period,
    )
    return { room, roomClash }
  }

  const classes = useMemo(() => {
    const set = new Set<string>()
    lessons.forEach((l) => l.className && set.add(l.className))
    ;(records['classList'] ?? []).forEach((c) => {
      const label = [c.name, c.section].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ')
      if (label) set.add(label)
    })
    ;(records['assignSubjectTeacher'] ?? []).forEach((assignment) => {
      const label = String(assignment.className ?? '').trim()
      if (label) set.add(label)
    })
    return [...set].sort()
  }, [lessons, records])

  const teachers = useMemo(() => {
    const set = new Set<string>()
    lessons.forEach((l) => l.teacher && set.add(l.teacher))
    ;(records['staffList'] ?? []).forEach((s) => s.name && set.add(s.name))
    ;(records['assignSubjectTeacher'] ?? []).forEach((assignment) => {
      const name = String(assignment.teacher ?? '').trim()
      if (name) set.add(name)
    })
    staff
      .filter((employee) => (!employee.branchId || employee.branchId === activeBranchId)
        && (employee.staffType === 'teacher' || employee.staffCategory?.trim().toLocaleLowerCase() === 'teaching'))
      .forEach((employee) => {
        const name = users.find((account) => account.id === employee.userId)?.name?.trim()
        if (name) set.add(name)
      })
    return [...set].sort()
  }, [lessons, records, staff, users, activeBranchId])

  const subjects = useMemo(() => {
    const set = new Set<string>()
    lessons.forEach((l) => l.subject && set.add(l.subject))
    ;(records['subjectList'] ?? []).forEach((s) => s.name && set.add(s.name))
    ;(records['assignSubjectTeacher'] ?? []).forEach((assignment) => {
      const name = String(assignment.subject ?? '').trim()
      if (name) set.add(name)
    })
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
  const subjectRows = records['subjectList'] ?? []
  const displayRoomName = (name: string) => classroomTimetableName(name, cfg, roomRows)
  const displaySubjectName = (name: string) => subjectTimetableName(name, cfg, subjectRows)
  const isSharedRoom = (name: string) => roomRows.find((r) => r.name === name)?.shared === 'Yes'
  const homeRoomOf = (name: string) => {
    const c = (records['classList'] ?? []).find((x) => [x.name, x.section].filter(Boolean).join(' ') === name)
    return c?.room ?? ''
  }

  const [selected, setSelected] = useState<string>('')
  const [printLayout, setPrintLayout] = useState<'periods-down' | 'periods-across'>('periods-down')
  const [draggingLessonId, setDraggingLessonId] = useState('')
  const [dropTarget, setDropTarget] = useState<{ day: string; period: string } | null>(null)
  const who = selected || (teacherMode ? teachers[0] : classes[0]) || ''
  const classBreaks = useMemo(
    () => teacherMode || !cfg.showBreaks ? [] : classBreaksFor(records['classBreaks'] ?? [], who),
    [teacherMode, cfg.showBreaks, records, who],
  )
  const [edit, setEdit] = useState<EduRow | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [editSeriesIds, setEditSeriesIds] = useState<string[]>([])
  const [perWeek, setPerWeek] = useState('1')
  const [useHome, setUseHome] = useState(true)
  const [allowShared, setAllowShared] = useState(false)
  const [genOpen, setGenOpen] = useState(false)
  const [genPeriods, setGenPeriods] = useState('4')

  // ---- Automatic generation inputs ----
  const genClasses = useMemo(() => {
    const map = new Map<string, string>()
    ;(records['classList'] ?? []).forEach((c) => {
      const label = [c.name, c.section].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ')
      if (label) map.set(label, String(c.room ?? '').trim())
    })
    ;(records['assignSubjectTeacher'] ?? []).forEach((assignment) => {
      const className = String(assignment.className ?? '').trim()
      if (className && !map.has(className)) map.set(className, '')
    })
    return [...map.entries()].map(([name, room]) => ({ name, room }))
  }, [records])

  // The generator's only lesson source is the saved Assign Subject Teacher list.
  const genAssignments = useMemo(() => {
    const fallback = Math.max(1, Number(genPeriods) || 4)
    return (records['assignSubjectTeacher'] ?? [])
      .map((assignment) => ({
        className: String(assignment.className ?? '').trim(),
        subject: String(assignment.subject ?? '').trim(),
        teacher: String(assignment.teacher ?? '').trim(),
        periodsPerWeek: Math.max(1, Number(assignment.periodsPerWeek) || fallback),
      }))
      .filter((assignment) => assignment.className && assignment.subject && assignment.teacher)
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

  const persistSchedules = (nextSchedules: EduRow[]) => {
    const next = { ...records, ttSchedules: nextSchedules }
    setRecords(next)
    saveEduRecords(activeBranchId, next)
  }

  const activateSchedule = (scheduleId: string) => {
    if (!schedules.some((schedule) => schedule.id === scheduleId)) return
    persistSchedules(schedules.map((schedule) => ({ ...schedule, active: schedule.id === scheduleId ? 'Yes' : '' })))
  }

  const openNewSchedule = () => {
    if (!termRows.length) {
      toast.error('No terms or semesters are available', 'Add a Term/Semester under Education Management first.')
      return
    }
    const term = availableTerms[0]
    if (!term) {
      toast.error('Every term already has a timetable', 'Edit an existing timetable to change its name or term.')
      return
    }
    setIsNewSchedule(true)
    setScheduleEdit({
      id: uid(),
      name: `${String(term.name ?? '').trim()} Timetable`,
      termId: term.id,
      termName: String(term.name ?? '').trim(),
      academicYear: String(term.academicYear ?? '').trim(),
    })
  }

  const openEditSchedule = () => {
    if (!activeSchedule) return
    setIsNewSchedule(false)
    setScheduleEdit({ ...activeSchedule })
  }

  const updateScheduleTerm = (termId: string) => {
    if (!scheduleEdit) return
    const term = termRows.find((row) => row.id === termId)
    setScheduleEdit({
      ...scheduleEdit,
      termId,
      termName: String(term?.name ?? '').trim(),
      academicYear: String(term?.academicYear ?? '').trim(),
    })
  }

  const saveSchedule = () => {
    if (!scheduleEdit) return
    const name = String(scheduleEdit.name ?? '').trim()
    const termId = String(scheduleEdit.termId ?? '').trim()
    const term = termRows.find((row) => row.id === termId)
    if (!name) {
      toast.error('Timetable name is required')
      return
    }
    if (!term) {
      toast.error('Choose a Term/Semester for this timetable')
      return
    }
    if (schedules.some((row) => row.id !== scheduleEdit.id && row.termId === termId)) {
      toast.error('A timetable already exists for this term', 'Edit that timetable instead; each term has one named timetable.')
      return
    }
    const clean: EduRow = {
      ...scheduleEdit,
      name,
      termId,
      termName: String(term.name ?? '').trim(),
      academicYear: String(term.academicYear ?? '').trim(),
    }
    const baseRows = isNewSchedule || !schedules.some((row) => row.id === clean.id)
      ? [...schedules, clean]
      : schedules.map((row) => (row.id === clean.id ? clean : row))
    const nextSchedules = baseRows.map((row) => ({ ...row, active: row.id === clean.id ? 'Yes' : '' }))
    persistSchedules(nextSchedules)
    setScheduleEdit(null)
    toast.success(isNewSchedule ? 'Timetable created' : 'Timetable details updated', `${name} · ${academicTermLabel(term)}`)
  }

  const cellLesson = (day: string, period: string): CellLesson | undefined => {
    const direct = lessons.find((l) => l.day === day && l.period === period && (teacherMode ? l.teacher === who : l.className === who))
    if (direct) return direct
    const cont = lessons.find(
      (l) => l.duration === 'Double' && l.day === day && nextPeriod(PERIODS, l.period) === period && (teacherMode ? l.teacher === who : l.className === who),
    )
    return cont ? { ...cont, cont: '1' } : undefined
  }

  const clash = (lesson: EduRow) => lessons.some((l) => lessonsClash(l, lesson, PERIODS))

  const timetableGridCell = (day: string, period: string, key: string) => {
    const lesson = cellLesson(day, period)
    const ri = lesson ? roomInfo(lesson) : null
    const isDropTarget = dropTarget?.day === day && dropTarget.period === period
    return (
      <td
        key={key}
        className={cn('h-16 rounded-lg border border-dashed border-line/70 align-top', printLayout === 'periods-across' ? 'min-w-[88px]' : 'min-w-[120px]', isDropTarget && 'bg-lime/10 ring-1 ring-lime/70')}
        onDragOver={(event) => {
          if (!draggingLessonId) return
          const targetLesson = cellLesson(day, period)
          if (!targetLesson || targetLesson.id === draggingLessonId) {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            setDropTarget((current) => current?.day === day && current.period === period ? current : { day, period })
          } else {
            setDropTarget(null)
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          const lessonId = event.dataTransfer.getData('text/plain') || draggingLessonId
          setDraggingLessonId('')
          setDropTarget(null)
          if (lessonId) moveLesson(lessonId, day, period)
        }}
      >
        {lesson ? (
          <button
            type="button"
            draggable={!lesson.cont}
            onDragStart={(event) => {
              if (lesson.cont) { event.preventDefault(); return }
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', lesson.id)
              setDraggingLessonId(lesson.id)
              setDropTarget(null)
            }}
            onDragEnd={() => {
              setDraggingLessonId('')
              setDropTarget(null)
            }}
            onDoubleClick={() => openEdit(lesson)}
            title={`${displaySubjectName(lesson.subject)} · ${displayTeacherName(lesson.teacher)} · ${lesson.className}${lesson.cont ? ' (continued)' : ''} · double-click to edit${lesson.cont ? '' : ' or drag to move'}`}
            className={cn('flex h-full w-full flex-col justify-between rounded-lg border px-2 py-1.5 text-left text-[11px] font-semibold transition hover:brightness-110', colorFor(lesson.subject), lesson.cont && 'opacity-70', !lesson.cont && 'cursor-grab active:cursor-grabbing', draggingLessonId === lesson.id && 'opacity-50')}
          >
            <span className="flex w-full items-center justify-between gap-1">
              <span className="truncate">{displaySubjectName(lesson.subject)}{lesson.cont ? ' ·' : ''}</span>
              <span className="flex items-center gap-1">
                {!lesson.cont && lesson.duration === 'Double' && <span className="rounded bg-black/10 px-1 text-[9px] font-bold dark:bg-white/10">×2</span>}
                {(clash(lesson) || ri?.roomClash) && <AlertTriangle className="size-3.5 shrink-0 text-rose-600 dark:text-rose-400" aria-label="Clash" />}
              </span>
            </span>
            <span className="truncate text-[10px] font-medium opacity-80">{teacherMode ? lesson.className : displayTeacherName(lesson.teacher)}{ri?.room ? ` · ${displayRoomName(ri.room)}` : ''}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openAdd(day, period)}
            aria-label={`Add lesson ${day} ${period}`}
            className="flex h-full w-full items-center justify-center rounded-lg text-mist/40 transition hover:bg-black/[0.03] hover:text-mist dark:hover:bg-white/[0.04]"
          >
            <Plus className="size-4" />
          </button>
        )}
      </td>
    )
  }

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
    setEditSeriesIds([])
    setPerWeek('1')
    setUseHome(true)
    setAllowShared(false)
  }

  const openEdit = (l: EduRow) => {
    const savedSeriesId = String(l.lessonSeriesId ?? '').trim()
    const seriesRows = savedSeriesId
      ? lessons.filter((row) => String(row.lessonSeriesId ?? '').trim() === savedSeriesId)
      : lessons.filter((row) => sameLessonSeries(row, l))
    const members = seriesRows.length ? seriesRows : [l]
    const lessonSeriesId = savedSeriesId || uid('lesson-series')
    setEdit({ ...l, lessonSeriesId, group: l.group || 'Entire class', duration: l.duration || 'Single' })
    setIsNew(false)
    setEditSeriesIds([...new Set(members.map((row) => row.id))])
    setPerWeek(String(Math.max(1, members.length)))
    setUseHome(true)
    setAllowShared(false)
  }

  const submit = () => {
    if (!edit) return
    if (!edit.subject?.trim()) { toast.error('Subject is required'); return }
    if (!edit.className?.trim()) { toast.error('Class is required'); return }
    if (!edit.teacher?.trim()) { toast.error('Teacher is required'); return }
    const relatedRows = isNew
      ? []
      : lessons.filter((row) => editSeriesIds.includes(row.id) || row.id === edit.id)
    const relatedIds = new Set(relatedRows.map((row) => row.id))
    const otherLessons = lessons.filter((row) => !relatedIds.has(row.id))
    const seriesId = String(edit.lessonSeriesId ?? '').trim() || uid('lesson-series')
    const base: EduRow = {
      ...edit,
      lessonSeriesId: seriesId,
      group: edit.group && edit.group !== 'Entire class' ? edit.group : '',
      duration: edit.duration === 'Double' ? 'Double' : '',
    }
    delete base.cont
    const requestedCount = Math.max(1, Number(perWeek) || 1)
    const siblingRows = relatedRows.filter((row) => row.id !== base.id).slice(0, requestedCount - 1)
    const cards: EduRow[] = [
      { ...base },
      ...siblingRows.map((row) => ({
        ...row,
        ...base,
        id: row.id,
        day: row.day,
        period: row.period,
        lessonSeriesId: seriesId,
      })),
    ]

    // Keep existing weekly placements when possible; validate the entire series.
    for (const card of cards) {
      const span = lessonSlots(card, PERIODS)
      if (card.duration === 'Double' && span.length !== 2) {
        toast.error('A double lesson needs a following period on the same day')
        return
      }
      for (const sp of span) {
        if (isBlocked('teacher', card.teacher, sp.day, sp.period)) { toast.error(`${card.teacher} has time off on ${sp.day} ${sp.period}`); return }
        if (isBlocked('class', card.className, sp.day, sp.period)) { toast.error(`${card.className} has time off on ${sp.day} ${sp.period}`); return }
      }
    }
    const internalClash = cards.some((card, index) => cards.slice(index + 1).some((other) => lessonsClash(card, other, PERIODS)))
    if (internalClash) {
      toast.error('Weekly lesson cards would overlap', 'Choose another slot or reduce Lessons/week.')
      return
    }
    let clashRow: EduRow | undefined
    for (const card of cards) {
      clashRow = otherLessons.find((row) => lessonsClash(row, card, PERIODS))
      if (clashRow) break
    }
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
    const allocationMatchesLesson = (allocation: EduRow, lesson: EduRow) => {
      if (allocation.className !== lesson.className
        || !lessonSlots(lesson, PERIODS).some((sp) => sp.day === allocation.day && sp.period === allocation.period)) return false
      if (allocation.subject || allocation.teacher) {
        return (!allocation.subject || allocation.subject === lesson.subject)
          && (!allocation.teacher || allocation.teacher === lesson.teacher)
      }
      // Older room rows may not carry subject/teacher; only replace them when
      // their room can be tied to this lesson, rather than clearing a parallel one.
      const expectedRooms = [lesson.room, homeRoomOf(lesson.className)].filter(Boolean)
      return expectedRooms.includes(allocation.room)
    }
    const roomAllocWithoutSeries = roomAlloc.filter((allocation) =>
      !relatedRows.some((row) => allocationMatchesLesson(allocation, row)),
    )
    const roomBusyRow = roomPick
      ? roomAllocWithoutSeries.find((allocation) =>
        allocation.room === roomPick
          && allocation.className !== base.className
          && cards.some((card) => lessonSlots(card, PERIODS).some((sp) => sp.day === allocation.day && sp.period === allocation.period)),
      )
      : undefined
    if (roomBusyRow) {
      toast.error(`${roomPick} is already booked for ${roomBusyRow.className} on ${roomBusyRow.day} ${roomBusyRow.period}`)
      return
    }

    // Add/adjust weekly placements. Extra cards are placed in free slots.
    const extra = Math.max(0, requestedCount - cards.length)
    if (extra > 0) {
      const starts = findStartSlots(
        [...otherLessons, ...cards],
        DAYS,
        PERIODS,
        { teacher: base.teacher, className: base.className, group: base.group || 'Entire class', duration: base.duration || 'Single' },
        extra,
        () => roomPick,
        (room, day, period) => !roomAllocWithoutSeries.some((allocation) =>
          allocation.room === room && allocation.className !== base.className && allocation.day === day && allocation.period === period,
        ),
        (whoType, name, day, period) => isBlocked(whoType, name, day, period),
      )
      if (!isNew && starts.length < extra) {
        toast.error('Not enough free slots for that Lessons/week value', `Only ${cards.length + starts.length} of ${requestedCount} weekly lesson cards can fit.`)
        return
      }
      starts.forEach((slot) => cards.push({ ...base, id: uid(), day: slot.day, period: slot.period, lessonSeriesId: seriesId }))
    }

    const nextLessons = isNew
      ? [...lessons, ...cards]
      : [...lessons.filter((row) => !relatedIds.has(row.id)), ...cards]
    // Re-sync Room Allocation for every span slot of every card in the series.
    let nextAllocs = roomAlloc.filter((allocation) =>
      !relatedRows.some((row) => allocationMatchesLesson(allocation, row))
        && !cards.some((card) => allocationMatchesLesson(allocation, card)),
    )
    if (roomPick) {
      for (const card of cards) {
        for (const sp of lessonSlots(card, PERIODS)) {
          nextAllocs = [...nextAllocs, { id: uid(), room: roomPick, day: sp.day, period: sp.period, className: card.className, subject: card.subject, teacher: card.teacher }]
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

  const moveLesson = (lessonId: string, targetDay: string, targetPeriod: string) => {
    const source = lessons.find((lesson) => lesson.id === lessonId)
    if (!source || (source.day === targetDay && source.period === targetPeriod)) return

    const targetCellLesson = cellLesson(targetDay, targetPeriod)
    if (targetCellLesson && targetCellLesson.id !== source.id) {
      toast.error('Choose an empty timetable slot', 'Move a lesson onto an empty day and period.')
      return
    }

    const moved: EduRow = { ...source, day: targetDay, period: targetPeriod }
    const sourceSpan = lessonSlots(source, PERIODS)
    const targetSpan = lessonSlots(moved, PERIODS)
    if (source.duration === 'Double' && targetSpan.length !== 2) {
      toast.error('A double lesson needs a following period on the same day')
      return
    }

    const conflict = lessons.find((lesson) => lesson.id !== source.id && lessonsClash(lesson, moved, PERIODS))
    if (conflict) {
      toast.error(
        conflict.teacher === source.teacher
          ? `${source.teacher} is already teaching ${conflict.className} on ${targetDay} ${targetPeriod}`
          : `${source.className} already has ${conflict.subject} on ${targetDay} ${targetPeriod}`,
      )
      return
    }
    for (const slot of targetSpan) {
      if (isBlocked('teacher', source.teacher, slot.day, slot.period)) {
        toast.error(`${source.teacher} has time off on ${slot.day} ${slot.period}`)
        return
      }
      if (isBlocked('class', source.className, slot.day, slot.period)) {
        toast.error(`${source.className} has time off on ${slot.day} ${slot.period}`)
        return
      }
    }

    const roomMoves = roomAlloc.flatMap((allocation) => {
      if (allocation.className !== source.className) return []
      const spanIndex = sourceSpan.findIndex((slot) => slot.day === allocation.day && slot.period === allocation.period)
      if (spanIndex < 0) return []
      if (allocation.subject && allocation.subject !== source.subject) return []
      if (allocation.teacher && allocation.teacher !== source.teacher) return []
      const destination = targetSpan[spanIndex]
      return destination ? [{ allocation, destination }] : []
    })
    const movingAllocationIds = new Set(roomMoves.map((move) => move.allocation.id))
    for (const move of roomMoves) {
      const roomBusy = roomAlloc.find((allocation) =>
        !movingAllocationIds.has(allocation.id)
        && allocation.room === move.allocation.room
        && allocation.day === move.destination.day
        && allocation.period === move.destination.period,
      )
      if (roomBusy) {
        toast.error(`${move.allocation.room} is already booked for ${roomBusy.className} on ${move.destination.day} ${move.destination.period}`)
        return
      }
    }

    const destinations = new Map(roomMoves.map((move) => [move.allocation.id, move.destination]))
    const nextAllocs = roomAlloc.map((allocation) => {
      const destination = destinations.get(allocation.id)
      return destination ? { ...allocation, day: destination.day, period: destination.period } : allocation
    })
    persistAll(lessons.map((lesson) => lesson.id === source.id ? moved : lesson), nextAllocs)
    toast.success('Lesson moved', `${source.subject} · ${source.day} ${source.period} → ${targetDay} ${targetPeriod}`)
  }

  const printNow = () => {
    // This page may be printed after another module registered a portrait @page
    // rule. Append a temporary landscape rule last so both timetable modes print
    // in the selected sheet orientation, then remove it when preview closes.
    document.querySelector('style[data-class-teacher-timetable-print]')?.remove()
    const landscapeRule = document.createElement('style')
    landscapeRule.dataset.classTeacherTimetablePrint = 'true'
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

  const options = teacherMode ? teachers : classes
  const roomOptions = roomNames.filter((r) => allowShared || !isSharedRoom(r))

  const thStyle: React.CSSProperties = { border: '1px solid #888', padding: '5px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', background: '#f0f0f0', color: '#111', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }
  const tdStyle: React.CSSProperties = { border: '1px solid #888', padding: '6px', fontSize: 10, verticalAlign: 'top', height: 44, color: '#111' }
  const printCellContent = (day: string, period: string) => {
    const lesson = cellLesson(day, period)
    if (!lesson) return null
    const ri = roomInfo(lesson)
    const showTeacherOrClass = teacherMode || cfg.printShowTeacher
    const showRoom = cfg.printShowClassroom && !!ri?.room
    return (
      <>
        {cfg.printShowSubject && <><b>{displaySubjectName(lesson.subject)}</b>{lesson.cont ? ' (cont.)' : lesson.duration === 'Double' ? ' (double)' : ''}</>}
        {showTeacherOrClass && <>{cfg.printShowSubject ? <br /> : null}{teacherMode ? lesson.className : displayTeacherName(lesson.teacher)}</>}
        {showRoom && <>{cfg.printShowSubject || showTeacherOrClass ? <br /> : null}Room: {displayRoomName(ri!.room)}</>}
      </>
    )
  }
  const periodColumnSizer = (
    <TableColumnSizer>
      {PERIODS.map((p, pi) => (
        <span key={p} style={{ display: 'block', whiteSpace: 'nowrap' }}>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 700 }}>{p}</span>
          <span style={{ display: 'block', fontSize: 10 }}>{PERIOD_TIMES[p]}</span>
        </span>
      ))}
    </TableColumnSizer>
  )
  const printPeriodColumnSizer = (
    <TableColumnSizer>
      {PERIODS.map((p, pi) => (
        <span key={p} style={{ display: 'block', whiteSpace: 'nowrap' }}>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 700 }}>{printPeriodName(cfg, p, pi)}</span>
          <span style={{ display: 'block', fontSize: 10 }}>{PERIOD_TIMES[p]}</span>
        </span>
      ))}
    </TableColumnSizer>
  )
  const dayColumnSizer = (
    <TableColumnSizer>
      {DAYS.map((d, di) => (
        <span key={d} style={{ display: 'block', whiteSpace: 'nowrap', fontSize: 10, fontWeight: 700 }}>{DAY_HEADS[di]}</span>
      ))}
    </TableColumnSizer>
  )

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Administration</span><span>/</span><span>Education Management</span>
        <span>/</span><span>Timetable</span>
        <span>/</span><span className="font-semibold text-inherit">{teacherMode ? 'Teacher Timetable' : 'Class Timetable'}</span>
      </div>
      <PageHeader
        title={teacherMode ? 'Teacher Timetable' : 'Class Timetable'}
        printTitle={`${teacherMode ? 'Teacher Timetable' : 'Class Timetable'}${who ? ` - ${who}` : ''}`}
        desc={`${branchName ?? 'Branch'} · Click + to add a lesson, double-click a card to edit it, or drag it to another empty day/period.`}
      />

      <div className="card mb-4">
        <div className="flex flex-wrap items-end gap-3 p-3">
          <Field label="Named timetable · Term/Semester" className="w-full sm:w-80">
            <Select value={activeSchedule?.id ?? ''} disabled={!schedules.length} onChange={(e) => activateSchedule(e.target.value)}>
              {!schedules.length && <option value="">No named timetable created</option>}
              {schedules.map((schedule) => (
                <option key={schedule.id} value={schedule.id}>{timetableScheduleCaption(schedule)}</option>
              ))}
            </Select>
          </Field>
          <Button size="sm" onClick={openNewSchedule} disabled={!availableTerms.length}>
            <Plus className="size-4" /> New timetable
          </Button>
          <Button size="sm" variant="outline" onClick={openEditSchedule} disabled={!activeSchedule}>Edit name / term</Button>
          <p className="w-full text-xs text-mist">
            {!termRows.length
              ? 'Add a Term/Semester under Education Management before creating a named timetable.'
              : availableTerms.length === 0
                ? 'Each available Term/Semester already has a named timetable. Lessons, breaks, and room allocations remain shared across terms.'
                : 'One named timetable per Term/Semester. Lessons, breaks, and room allocations remain shared across terms.'}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 gap-2 border-b border-line p-3 sm:grid-cols-2 md:grid-cols-[minmax(9rem,0.8fr)_minmax(13rem,1.2fr)_auto] md:items-end">
          <Field label={teacherMode ? 'Teacher' : 'Class'} className="min-w-0">
            <Select value={who} onChange={(e) => setSelected(e.target.value)}>
              {options.map((o) => (<option key={o} value={o}>{teacherMode ? displayTeacherName(o) : o}</option>))}
            </Select>
          </Field>
          <Field label="Print layout" className="min-w-0">
            <Select value={printLayout} onChange={(e) => setPrintLayout(e.target.value as 'periods-down' | 'periods-across')}>
              <option value="periods-down">Periods vertical · Days horizontal</option>
              <option value="periods-across">Periods horizontal · Days vertical</option>
            </Select>
          </Field>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 md:col-span-1 md:col-start-3 md:flex-nowrap md:items-end">
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
            {printLayout === 'periods-down' ? (
              <table key="screen-periods-down" className="w-full min-w-[860px] table-fixed border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th style={{ width: 'max-content', whiteSpace: 'nowrap' }} className="rounded-lg border border-line bg-black/[0.02] px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">Period{periodColumnSizer}</th>
                    {DAYS.map((d, di) => (
                      <th key={d} className="rounded-lg border border-line bg-black/[0.02] px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">{DAY_HEADS[di]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map((p, pi) => (
                    <Fragment key={p}>
                      {breaksBeforePeriod(classBreaks, pi).map((item) => (
                        <tr key={`break-${item.id}`}>
                          <td colSpan={DAYS.length + 1} className="rounded-lg border border-line/60 bg-black/[0.04] px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-mist dark:bg-white/[0.05]">
                            {breakGridHeaderLabel(cfg, item)}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td className="whitespace-nowrap rounded-lg border border-line bg-black/[0.02] px-2 py-2 align-top dark:bg-white/[0.03]">
                          <p className="text-[11px] font-bold">{p}</p>
                          <p className="text-[10px] text-mist">{PERIOD_TIMES[p]}</p>
                        </td>
                        {DAYS.map((d) => timetableGridCell(d, p, d))}
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            ) : (
              <table key="screen-periods-across" className="w-full min-w-[860px] table-fixed border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th style={{ width: 'max-content', whiteSpace: 'nowrap' }} className="rounded-lg border border-line bg-black/[0.02] px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">Day{dayColumnSizer}</th>
                    {PERIODS.map((p, pi) => (
                      <Fragment key={p}>
                        {breaksBeforePeriod(classBreaks, pi).map((item) => (
                          <th
                            key={`break-${item.id}`}
                            aria-label={breakGridHeaderLabel(cfg, item)}
                            title={breakGridHeaderLabel(cfg, item)}
                            className="w-9 min-w-[2.25rem] rounded-lg border border-line/60 bg-black/[0.04] dark:bg-white/[0.05]"
                          />
                        ))}
                        <th className="rounded-lg border border-line bg-black/[0.02] px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                          <span className="block whitespace-nowrap">{p}</span>
                          <span className="block whitespace-nowrap text-[9px] font-medium normal-case tracking-normal">{PERIOD_TIMES[p]}</span>
                        </th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((d, di) => (
                    <tr key={d}>
                      <th scope="row" style={{ width: 'max-content', whiteSpace: 'nowrap' }} className="rounded-lg border border-line bg-black/[0.02] px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">{DAY_HEADS[di]}</th>
                      {PERIODS.map((p, pi) => (
                        <Fragment key={p}>
                          {breaksBeforePeriod(classBreaks, pi).map((item) => di === 0 ? (
                            <td key={`break-${item.id}`} rowSpan={DAYS.length} title={breakGridHeaderLabel(cfg, item)} className="relative w-9 min-w-[2.25rem] rounded-lg border border-line/60 bg-black/[0.04] p-0 text-center align-middle text-mist dark:bg-white/[0.05]">
                              <VerticalBreakLabel title={breakGridHeaderLabel(cfg, item)} fontSize={9} color="currentColor" />
                            </td>
                          ) : null)}
                          {timetableGridCell(d, p, p)}
                        </Fragment>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-2 text-center text-xs text-mist">
              {lessons.filter((l) => (teacherMode ? l.teacher === who : l.className === who)).length === 0
                ? 'Empty week — click + in any slot (or “Add lesson”) to place the first card.'
                : 'Click + to add · double-click a lesson to edit · drag a lesson to an empty slot to move it.'}
            </p>
          </div>
        )}
      </div>

      <Modal open={!!scheduleEdit} onClose={() => setScheduleEdit(null)} title={isNewSchedule ? 'Create term timetable' : 'Edit timetable name and term'}>
        {scheduleEdit && (
          <div className="grid gap-3">
            <Field label="Timetable name" required>
              <Input value={scheduleEdit.name ?? ''} onChange={(e) => setScheduleEdit({ ...scheduleEdit, name: e.target.value })} placeholder="e.g. 2026/2027 Term 1 Timetable" />
            </Field>
            <Field label="Term / Semester" required>
              <Select value={scheduleEdit.termId ?? ''} onChange={(e) => updateScheduleTerm(e.target.value)}>
                {termRows
                  .filter((term) => term.id === scheduleEdit.termId || !schedules.some((schedule) => schedule.termId === term.id))
                  .map((term) => (<option key={term.id} value={term.id}>{academicTermLabel(term)}</option>))}
              </Select>
            </Field>
            <p className="text-xs text-mist">This creates a named timetable record for the selected term. Lessons, breaks, and room allocations remain shared across terms.</p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveSchedule}>{isNewSchedule ? 'Create timetable' : 'Save details'}</Button>
              <Button variant="ghost" onClick={() => setScheduleEdit(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

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
              <Field label="Lessons/week" hint="Extra cards are auto-placed in free slots.">
                <Select value={perWeek} onChange={(e) => setPerWeek(e.target.value)}>
                  {Array.from({ length: Math.max(5, (Number(perWeek) || 1) + (isNew ? 0 : 4)) }, (_, index) => String(index + 1))
                    .map((count) => (<option key={count} value={count}>{count}</option>))}
                </Select>
              </Field>
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
            Uses the saved rows in Subjects → Subject Assignments as the source for every class, subject and teacher.
            The generated lessons are shared by Class and Teacher Timetable, and the generator never double-books a teacher, a class or a room in one period.
          </p>
          <div className="rounded-xl border border-line p-3 text-xs">
            <p className="font-bold">{genClasses.length} classes · {genAssignments.length} subject assignments</p>
            <ul className="mt-1 max-h-40 space-y-0 overflow-y-auto text-mist">
              {genAssignments.map((a, i) => (
                <li key={i}>{a.className} — {a.subject} ({a.teacher}) · {a.periodsPerWeek} periods/week</li>
              ))}
              {!genAssignments.length && <li>No assignments yet — add them under Subjects → Subject Assignments.</li>}
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
        <div className="timetable-print-root" data-print-layout={printLayout}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #111', paddingBottom: 6, marginBottom: 10 }}>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{branchName ?? 'Branch'} — {teacherMode ? 'Teacher Timetable' : 'Class Timetable'}</p>
              {scheduleCaption && <p style={{ margin: 0, fontSize: 11 }}>{scheduleCaption}</p>}
              <p style={{ margin: 0, fontSize: 12 }}>{teacherMode ? displayTeacherName(who) : who}</p>
            </div>
            <p style={{ margin: 0, fontSize: 10 }}>Education Management · Printed {new Date().toLocaleDateString()}</p>
          </div>
          {printLayout === 'periods-down' ? (
            <table key="periods-down" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 'max-content', whiteSpace: 'nowrap' }}>Period{printPeriodColumnSizer}</th>
                  {DAYS.map((d, di) => (<th key={d} style={thStyle}>{DAY_HEADS[di]}</th>))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((p, pi) => (
                  <Fragment key={p}>
                    {breaksBeforePeriod(classBreaks, pi).map((item) => (
                      <tr key={`break-${item.id}`}>
                        <td colSpan={DAYS.length + 1} style={{ ...tdStyle, height: 'auto', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.25em', background: '#e8e8e8', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                          {breakHeaderLabel(cfg, item)}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}><b>{printPeriodName(cfg, p, pi)}</b><br />{PERIOD_TIMES[p]}</td>
                      {DAYS.map((d) => (<td key={d} style={tdStyle}>{printCellContent(d, p)}</td>))}
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          ) : (
            <table key="periods-across" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 'max-content', whiteSpace: 'nowrap' }}>Day{dayColumnSizer}</th>
                  {PERIODS.map((p, pi) => (
                    <Fragment key={p}>
                      {breaksBeforePeriod(classBreaks, pi).map((item) => <th key={`break-${item.id}`} style={thStyle}>{breakHeaderLabel(cfg, item)}</th>)}
                      <th style={thStyle}>{printPeriodName(cfg, p, pi)}<br />{PERIOD_TIMES[p]}</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((d, di) => (
                  <tr key={d}>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}><b>{DAY_HEADS[di]}</b></td>
                    {PERIODS.map((p, pi) => (
                      <Fragment key={p}>
                        {breaksBeforePeriod(classBreaks, pi).map((item) => di === 0 ? (
                          <td key={`break-${item.id}`} rowSpan={DAYS.length} style={{ ...tdStyle, position: 'relative', height: 'auto', padding: 0, textAlign: 'center', verticalAlign: 'middle', background: '#e8e8e8', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                            <VerticalBreakLabel title={breakPrintTitle(item, cfg)} fontSize={breakPrintFontSize(item)} />
                          </td>
                        ) : null)}
                        <td style={tdStyle}>{printCellContent(d, p)}</td>
                      </Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p style={{ marginTop: 8, fontSize: 9, color: '#444' }}>Generated by FitPro Education Management — {teacherMode ? 'teacher' : 'class'} view. Rooms come from Room Allocation.</p>
        </div>,
        document.body,
      )}
    </div>
  )
}
