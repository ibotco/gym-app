import { Fragment, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, AlertTriangle, Printer, Wand2 } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Empty } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { useI18n } from '../../context/I18nContext'
import { useApp } from '../../context/AppContext'
import { cn, uid } from '../../lib/utils'
import { createPortal } from 'react-dom'
import { loadEduRecords, saveEduRecords, type EduRow } from '../../lib/eduRecords'
import { autoAssignRooms, isRoomClash, migrateRoomRows, orderRoomsForAssign, type RoomAlloc } from '../../lib/eduRooms'
import { breakLabel, loadTtConfig } from '../../lib/eduTimetableConfig'
const THEAD = 'border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]'
const TH = 'px-3 py-2.5'
const TD = 'px-3 py-2'

/** Stable subject → card colour, matching the Class/Teacher timetable grid. */
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

type Section = 'rooms' | 'grid'

/**
 * Room Allocation — aSc-style room management.
 * "Rooms" keeps the room inventory (capacity, type, location);
 * "Room Timetable" shows each room's weekly booking grid (periods × days),
 * flags double-booked rooms, auto-assigns rooms from the class timetable and
 * prints an A4 landscape room card.
 */
export function EduRoomAllocationPage() {
  const { t } = useI18n()
  const toast = useToast()
  const { activeBranchId, branches } = useApp()
  const branchName = branches.find((b) => b.id === activeBranchId)?.name

  const [records, setRecords] = useState(() => loadEduRecords(activeBranchId))
  useEffect(() => {
    setRecords(loadEduRecords(activeBranchId))
    setEdit(null)
    setDel(null)
    setRoomEdit(null)
    setRoomDel(null)
    setSelected('')
  }, [activeBranchId])

  const [section, setSection] = useState<Section>('grid')
  const [selected, setSelected] = useState<string>('') // '' = all rooms
  const [edit, setEdit] = useState<RoomAlloc | null>(null)
  const [del, setDel] = useState<RoomAlloc | null>(null)
  const [roomEdit, setRoomEdit] = useState<EduRow | null>(null)
  const [roomDel, setRoomDel] = useState<EduRow | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [isNewRoom, setIsNewRoom] = useState(false)

  const allocs = useMemo(() => (records['roomAllocation'] ?? []) as unknown as RoomAlloc[], [records])
  const roomRows = useMemo(() => records['rooms'] ?? [], [records])
  const lessons = useMemo(() => records['classTimetable'] ?? [], [records])

  // Timetable definition (Timetable Rules → Days & Periods) drives the grid.
  const cfg = useMemo(() => loadTtConfig(records), [records])
  const DAYS = cfg.days
  const PERIODS = cfg.periods
  const PERIOD_TIMES = cfg.bellTimes
  const DAY_HEADS = cfg.showDayNumbers ? cfg.headerDays : cfg.shortDays
  const BREAK = breakLabel(cfg)

  /** class label → its home room (from Classes) and the reverse. */
  const homeRooms = useMemo(() => {
    const map: Record<string, string> = {}
    ;(records['classList'] ?? []).forEach((c) => {
      const label = [c.name, c.section].filter(Boolean).join(' ')
      if (label && c.room) map[label] = c.room
    })
    return map
  }, [records])
  const homeByRoom = useMemo(() => {
    const map: Record<string, string> = {}
    Object.entries(homeRooms).forEach(([cls, room]) => { map[room] = cls })
    return map
  }, [homeRooms])

  // One-time upgrade of rooms saved before the shared/home-classroom model.
  useEffect(() => {
    if (!roomRows.some((r) => 'type' in r)) return
    const all = { ...records, rooms: migrateRoomRows(roomRows, homeByRoom) }
    setRecords(all)
    saveEduRecords(activeBranchId, all)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomRows])

  /** Every room the school knows: inventory + rooms referenced anywhere. */
  const roomNames = useMemo(() => {
    const set = new Set<string>()
    roomRows.forEach((r) => r.name && set.add(r.name))
    allocs.forEach((a) => a.room && set.add(a.room))
    ;(records['classList'] ?? []).forEach((c) => c.room && set.add(c.room))
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [roomRows, allocs, records])

  const classNames = useMemo(() => {
    const set = new Set<string>()
    lessons.forEach((l) => l.className && set.add(l.className))
    allocs.forEach((a) => a.className && set.add(a.className))
    ;(records['classList'] ?? []).forEach((c) => {
      const label = [c.name, c.section].filter(Boolean).join(' ')
      if (label) set.add(label)
    })
    return [...set].sort()
  }, [lessons, allocs, records])

  const subjects = useMemo(() => {
    const set = new Set<string>()
    lessons.forEach((l) => l.subject && set.add(l.subject))
    allocs.forEach((a) => a.subject && set.add(a.subject))
    ;(records['subjectList'] ?? []).forEach((s) => s.name && set.add(s.name))
    return [...set].sort()
  }, [lessons, allocs, records])

  const teachers = useMemo(() => {
    const set = new Set<string>()
    lessons.forEach((l) => l.teacher && set.add(l.teacher))
    ;(records['staffList'] ?? []).forEach((s) => s.name && set.add(s.name))
    return [...set].sort()
  }, [lessons, records])

  const roomOf = selected && roomNames.includes(selected) ? selected : ''
  const shortOf = (name: string) => roomRows.find((r) => r.name === name)?.short ?? ''
  const cellAlloc = (day: string, period: string) => allocs.find((a) => a.room === roomOf && a.day === day && a.period === period)
  const classDoubleBooked = (row: RoomAlloc) =>
    allocs.some((o) => o.id !== row.id && o.className === row.className && o.day === row.day && o.period === row.period)
  const usageOf = (room: string) => allocs.filter((a) => a.room === room).length
  const totalSlots = DAYS.length * PERIODS.length

  const persistAllocs = (next: RoomAlloc[]) => {
    const all = { ...records, roomAllocation: next as unknown as EduRow[] }
    setRecords(all)
    saveEduRecords(activeBranchId, all)
  }
  const persistRooms = (next: EduRow[]) => {
    const all = { ...records, rooms: next }
    setRecords(all)
    saveEduRecords(activeBranchId, all)
  }

  // ---- room inventory CRUD ----
  const submitRoom = () => {
    if (!roomEdit) return
    const name = roomEdit.name?.trim()
    if (!name) { toast.error('Classroom name is required'); return }
    const prev = roomRows.find((r) => r.id === roomEdit.id)
    const exists = !!prev
    if (roomRows.some((r) => r.id !== roomEdit.id && r.name.trim().toLowerCase() === name.toLowerCase())) {
      toast.error('A room with this name already exists')
      return
    }
    const clean: EduRow = { ...roomEdit, name }
    if (clean.homeClassroom !== 'Yes') clean.homeClass = ''

    // Keep Classes (home room) in sync with the Home classroom flag.
    const classRows = records['classList'] ?? []
    let nextClassRows: EduRow[] | null = null
    if (clean.homeClassroom === 'Yes' && clean.homeClass) {
      nextClassRows = classRows.map((c) => {
        const label = [c.name, c.section].filter(Boolean).join(' ')
        if (label === clean.homeClass) return { ...c, room: name }
        if (c.room === name && label !== clean.homeClass) return { ...c, room: '' }
        return c
      })
    } else if (prev?.homeClassroom === 'Yes' && prev.homeClass) {
      nextClassRows = classRows.map((c) => {
        const label = [c.name, c.section].filter(Boolean).join(' ')
        return label === prev.homeClass && c.room === name ? { ...c, room: '' } : c
      })
    }

    // Renaming a room follows through to allocations and class home rooms.
    let nextAllocs: RoomAlloc[] | null = null
    if (prev && prev.name !== name) {
      if (nextClassRows) nextClassRows = nextClassRows.map((c) => (c.room === prev.name ? { ...c, room: name } : c))
      nextAllocs = allocs.map((a) => (a.room === prev.name ? { ...a, room: name } : a))
    }

    const all: Record<string, EduRow[]> = { ...records, rooms: exists ? roomRows.map((r) => (r.id === clean.id ? clean : r)) : [...roomRows, clean] }
    if (nextClassRows) all.classList = nextClassRows
    if (nextAllocs) all.roomAllocation = nextAllocs as unknown as EduRow[]
    setRecords(all)
    saveEduRecords(activeBranchId, all)
    toast.success(isNewRoom ? 'Room added' : 'Room updated', name)
    setRoomEdit(null)
  }

  // ---- allocation CRUD ----
  const openAdd = (day?: string, period?: string) => {
    setEdit({
      id: uid(),
      room: roomOf || roomNames[0] || '',
      day: day ?? DAYS[0],
      period: period ?? PERIODS[0],
      className: '',
      subject: '',
      teacher: '',
    })
    setIsNew(true)
  }
  const openEdit = (a: RoomAlloc) => { setEdit({ ...a }); setIsNew(false) }

  const submitAlloc = () => {
    if (!edit) return
    if (!edit.room?.trim()) { toast.error('Room is required'); return }
    if (!edit.className?.trim()) { toast.error('Class is required'); return }
    const clashRow = allocs.find((a) => a.id !== edit.id && a.room === edit.room && a.day === edit.day && a.period === edit.period)
    if (clashRow) {
      toast.error(`${edit.room} is already booked for ${clashRow.className} on ${edit.day} ${edit.period}`)
      return
    }
    persistAllocs(isNew ? [...allocs, edit] : allocs.map((a) => (a.id === edit.id ? edit : a)))
    toast.success(isNew ? 'Allocation added' : 'Allocation updated', `${edit.room} · ${edit.day} ${edit.period}`)
    setEdit(null)
  }

  const runAutoAssign = () => {
    if (!roomNames.length) { toast.error('Add rooms first (Rooms section)'); return }
    const ordered = orderRoomsForAssign(roomNames.map((n) => ({ name: n, shared: roomRows.find((r) => r.name === n)?.shared })))
    const { allocs: next, assigned, skipped } = autoAssignRooms(
      lessons.map((l) => ({ day: l.day, period: l.period, className: l.className, subject: l.subject, teacher: l.teacher })),
      allocs,
      ordered,
      homeRooms,
    )
    persistAllocs(next)
    toast.success(
      'Rooms auto-assigned',
      `${assigned} lesson${assigned === 1 ? '' : 's'} allocated${skipped ? ` · ${skipped} unplaced (every room busy on that slot)` : ''}`,
    )
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

  const thStyle: React.CSSProperties = { border: '1px solid #888', padding: '5px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', background: '#f0f0f0', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }
  const tdStyle: React.CSSProperties = { border: '1px solid #888', padding: '6px', fontSize: 10, verticalAlign: 'top', height: 40 }

  const sections: { id: Section; label: string }[] = [
    { id: 'rooms', label: t('nav.eduRooms') },
    { id: 'grid', label: t('nav.eduRoomTimetable') },
  ]

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Administration</span><span>/</span><span>Education Management</span>
        <span>/</span><span>Timetable</span>
        <span>/</span><span className="font-semibold text-inherit">{t('nav.eduRoomAllocation')}</span>
      </div>
      <PageHeader
        title={t('nav.eduRoomAllocation')}
        desc={`${branchName ?? 'Branch'} · Manage rooms and see which class uses each room in every period.`}
      />

      {/* Section bar — same format as the System settings category bar */}
      <div className="settings-catbar segmented-shell mb-4 flex max-w-full flex-wrap items-center gap-0.5 rounded-xl border border-line bg-white p-1 dark:bg-ink-2">
        {sections.map((sct) => (
          <button
            key={sct.id}
            type="button"
            onClick={() => setSection(sct.id)}
            aria-current={sct.id === section ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap rounded-lg px-3.5 py-2 text-[13px] font-bold transition',
              sct.id === section
                ? 'bg-lime text-lime-ink'
                : 'text-zinc-600 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white',
            )}
          >
            {sct.label}
          </button>
        ))}
      </div>

      {section === 'rooms' ? (
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
            <p className="text-sm font-bold">{roomRows.length} room{roomRows.length === 1 ? '' : 's'}</p>
            <Button size="sm" onClick={() => { setRoomEdit({ id: uid(), name: '', short: '', capacity: '', location: '', homeClassroom: '', homeClass: '', shared: '' }); setIsNewRoom(true) }}>
              <Plus className="size-4" /> Add room
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className={THEAD}>
                  <th className={TH}>Classroom</th><th className={TH}>Short</th><th className={TH}>Shared room</th>
                  <th className={TH}>Home classroom</th><th className={TH}>Capacity</th><th className={TH}>Location</th>
                  <th className={TH}>Weekly usage</th><th className={`${TH} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roomRows.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                    <td className={`${TD} font-semibold`}>{r.name}</td>
                    <td className={TD}>{r.short || '—'}</td>
                    <td className={TD}>{r.shared === 'Yes' ? <span className="rounded-md bg-sky-400/15 px-1.5 py-0.5 font-semibold text-sky-800 dark:text-sky-300">Shared</span> : 'No'}</td>
                    <td className={TD}>{r.homeClassroom === 'Yes' ? r.homeClass || 'Yes' : 'No'}</td>
                    <td className={TD}>{r.capacity || '—'}</td>
                    <td className={TD}>{r.location || '—'}</td>
                    <td className={TD}>{usageOf(r.name)} / {totalSlots} periods</td>
                    <td className={`${TD} text-right`}>
                      <button className="rounded-md p-1.5 text-mist hover:bg-black/5 hover:text-inherit dark:hover:bg-white/10" title="Edit" onClick={() => { setRoomEdit({ ...r }); setIsNewRoom(false) }}><Pencil className="size-3.5" /></button>
                      <button className="rounded-md p-1.5 text-mist hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400" title="Delete" onClick={() => setRoomDel(r)}><Trash2 className="size-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!roomRows.length && <Empty title="No rooms yet" desc="Add your classrooms, labs and halls — allocations and the generator pick rooms from this list." />}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <Field label="Room" className="w-56">
              <Select value={roomOf} onChange={(e) => setSelected(e.target.value)}>
                <option value="">All rooms (overview)</option>
                {roomNames.map((r) => (<option key={r} value={r}>{r}{shortOf(r) ? ` (${shortOf(r)})` : ''}</option>))}
              </Select>
            </Field>
            {roomOf && <p className="text-xs text-mist">{usageOf(roomOf)} / {totalSlots} periods booked</p>}
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="soft" onClick={runAutoAssign} disabled={!lessons.length}><Wand2 className="size-4" /> Auto-assign from timetable</Button>
              <Button size="sm" variant="outline" onClick={printNow} disabled={!roomNames.length}><Printer className="size-4" /> Print</Button>
              <Button size="sm" onClick={() => openAdd()} disabled={!roomNames.length}><Plus className="size-4" /> Add allocation</Button>
            </div>
          </div>

          {!roomNames.length ? (
            <div className="p-6">
              <Empty title="No rooms yet" desc="Add rooms in the Rooms section, then allocate them to lessons here or with Auto-assign." />
            </div>
          ) : roomOf ? (
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
                          const a = cellAlloc(d, p)
                          const clash = a ? isRoomClash(allocs, a) || classDoubleBooked(a) : false
                          return (
                            <td key={d} className="h-16 min-w-[120px] rounded-lg border border-dashed border-line/70 align-top">
                              {a ? (
                                <button
                                  type="button"
                                  onClick={() => openEdit(a)}
                                  title={`${a.className}${a.subject ? ` · ${a.subject}` : ''}${a.teacher ? ` · ${a.teacher}` : ''}`}
                                  className={cn('flex h-full w-full flex-col justify-between rounded-lg border px-2 py-1.5 text-left text-[11px] font-semibold transition hover:brightness-110', colorFor(a.subject || a.className), clash && 'ring-2 ring-rose-500')}
                                >
                                  <span className="flex w-full items-center justify-between gap-1">
                                    <span className="truncate">{a.className}</span>
                                    {clash && <AlertTriangle className="size-3.5 shrink-0 text-rose-600 dark:text-rose-400" aria-label="Clash" />}
                                  </span>
                                  <span className="truncate text-[10px] font-medium opacity-80">{[a.subject, a.teacher].filter(Boolean).join(' · ') || '—'}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openAdd(d, p)}
                                  aria-label={`Allocate ${roomOf} ${d} ${p}`}
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
            </div>
          ) : (
            <div className="overflow-x-auto p-3">
              <table className="w-full min-w-[860px] border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="w-40 rounded-lg border border-line bg-black/[0.02] px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">Room</th>
                    {DAYS.map((d, di) => (
                      <th key={d} className="rounded-lg border border-line bg-black/[0.02] px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">{DAY_HEADS[di]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roomNames.map((room) => (
                    <tr key={room}>
                      <td className="rounded-lg border border-line bg-black/[0.02] px-2 py-2 align-top dark:bg-white/[0.03]">
                        <p className="text-[11px] font-bold">{room}{shortOf(room) ? <span className="ml-1 font-semibold text-mist">({shortOf(room)})</span> : null}</p>
                        <p className="text-[10px] text-mist">{usageOf(room)} / {totalSlots} periods</p>
                      </td>
                      {DAYS.map((d) => {
                        const dayAllocs = allocs.filter((a) => a.room === room && a.day === d)
                        return (
                          <td key={d} className="min-w-[150px] rounded-lg border border-dashed border-line/70 align-top p-1">
                            {dayAllocs.length ? (
                              <ul className="space-y-1">
                                {dayAllocs.map((a) => (
                                  <li key={a.id} className={cn('rounded-md border px-1.5 py-1 text-[10px] font-semibold', colorFor(a.subject || a.className), isRoomClash(allocs, a) && 'ring-1 ring-rose-500')}>
                                    {a.period.replace('Period ', 'P')} · {a.className}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-[10px] text-mist/50">Free</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-center text-xs text-mist">Select a room above for its full weekly card — click any slot to allocate or edit.</p>
            </div>
          )}
        </div>
      )}

      {/* Allocation modal */}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={isNew ? 'Allocate room' : 'Edit allocation'}>
        {edit && (
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Room" required>
                <Select value={edit.room} onChange={(e) => setEdit({ ...edit, room: e.target.value })} placeholder="Select…">
                  {roomNames.map((r) => (<option key={r} value={r}>{r}</option>))}
                </Select>
              </Field>
              <Field label="Class" required>
                <Input list="edu-ra-classes" value={edit.className} onChange={(e) => setEdit({ ...edit, className: e.target.value })} placeholder="e.g. Basic 7 A" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Subject">
                {subjects.length ? (
                  <Select value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} placeholder="Select…">
                    <option value="">—</option>
                    {subjects.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </Select>
                ) : (
                  <Input value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} placeholder="e.g. Mathematics" />
                )}
              </Field>
              <Field label="Teacher">
                <Input list="edu-ra-teachers" value={edit.teacher} onChange={(e) => setEdit({ ...edit, teacher: e.target.value })} placeholder="e.g. Grace Mensah" />
              </Field>
            </div>
            <datalist id="edu-ra-classes">{classNames.map((c) => (<option key={c} value={c} />))}</datalist>
            <datalist id="edu-ra-teachers">{teachers.map((t) => (<option key={t} value={t} />))}</datalist>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Day"><Select value={edit.day} onChange={(e) => setEdit({ ...edit, day: e.target.value })}>{DAYS.map((d) => (<option key={d} value={d}>{d}</option>))}</Select></Field>
              <Field label="Period"><Select value={edit.period} onChange={(e) => setEdit({ ...edit, period: e.target.value })}>{PERIODS.map((p) => (<option key={p} value={p}>{p} · {PERIOD_TIMES[p]}</option>))}</Select></Field>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={submitAlloc}>Save allocation</Button>
              {!isNew && <Button variant="danger" onClick={() => { persistAllocs(allocs.filter((a) => a.id !== edit.id)); toast.success('Allocation removed'); setEdit(null) }}><Trash2 className="size-4" /> Remove</Button>}
              <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Room modal */}
      <Modal open={!!roomEdit} onClose={() => setRoomEdit(null)} title={isNewRoom ? 'Add room' : 'Edit room'}>
        {roomEdit && (
          <div className="grid gap-3">
            <Field label="Classroom name" required>
              <Input value={roomEdit.name ?? ''} onChange={(e) => setRoomEdit({ ...roomEdit, name: e.target.value })} placeholder="e.g. Science Lab" />
            </Field>
            <Field label="Short" hint="Compact name used on the timetable cards and prints.">
              <Input value={roomEdit.short ?? ''} onChange={(e) => setRoomEdit({ ...roomEdit, short: e.target.value })} placeholder="e.g. LAB" />
            </Field>

            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                className="size-4 accent-lime"
                checked={roomEdit.homeClassroom === 'Yes'}
                onChange={(e) => setRoomEdit({ ...roomEdit, homeClassroom: e.target.checked ? 'Yes' : '' })}
              />
              Home classroom
            </label>
            {roomEdit.homeClassroom === 'Yes' && (
              <Field label="Home class" hint="The class this classroom belongs to — also shown on Classes.">
                <Select value={roomEdit.homeClass ?? ''} onChange={(e) => setRoomEdit({ ...roomEdit, homeClass: e.target.value })} placeholder="Select class…">
                  {classNames.map((c) => (<option key={c} value={c}>{c}</option>))}
                </Select>
              </Field>
            )}

            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                className="size-4 accent-lime"
                checked={roomEdit.shared === 'Yes'}
                onChange={(e) => setRoomEdit({ ...roomEdit, shared: e.target.checked ? 'Yes' : '' })}
              />
              Shared room
            </label>
            <p className="-mt-1 text-xs text-mist">Shared rooms (labs, halls, library) are booked by any class and are used last by Auto-assign.</p>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Capacity">
                <Input type="number" min={1} value={roomEdit.capacity ?? ''} onChange={(e) => setRoomEdit({ ...roomEdit, capacity: e.target.value })} placeholder="e.g. 30" />
              </Field>
              <Field label="Location">
                <Input value={roomEdit.location ?? ''} onChange={(e) => setRoomEdit({ ...roomEdit, location: e.target.value })} placeholder="e.g. Main Block" />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={submitRoom}>Save room</Button>
              <Button variant="ghost" onClick={() => setRoomEdit(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!roomDel} onClose={() => setRoomDel(null)} title="Delete room?">
        {roomDel && (
          <>
            <p className="text-sm text-mist">
              Delete <span className="font-semibold text-inherit">{roomDel.name}</span>?
              {usageOf(roomDel.name) > 0 && <> It has {usageOf(roomDel.name)} allocation{usageOf(roomDel.name) === 1 ? '' : 's'} which will be removed too.</>}
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setRoomDel(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  persistRooms(roomRows.filter((r) => r.id !== roomDel.id))
                  const orphaned = allocs.filter((a) => a.room === roomDel.name)
                  if (orphaned.length) persistAllocs(allocs.filter((a) => a.room !== roomDel.name))
                  toast.success('Room deleted', orphaned.length ? `${orphaned.length} allocation(s) removed` : undefined)
                  setRoomDel(null)
                }}
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* A4 landscape print — single room card or all-rooms overview */}
      {createPortal(
        <div className="timetable-print-root">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #111', paddingBottom: 6, marginBottom: 10 }}>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{branchName ?? 'Branch'} — Room {roomOf ? 'Timetable' : 'Allocation Overview'}</p>
              <p style={{ margin: 0, fontSize: 12 }}>{roomOf ? `${roomOf}${shortOf(roomOf) ? ` (${shortOf(roomOf)})` : ''}` : `${roomNames.length} rooms`}</p>
            </div>
            <p style={{ margin: 0, fontSize: 10 }}>Education Management · Printed {new Date().toLocaleDateString()}</p>
          </div>
          {roomOf ? (
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
                        const a = cellAlloc(d, p)
                        return (
                          <td key={d} style={tdStyle}>
                            {a && (
                              <>
                                <b>{a.className}</b>
                                {a.subject ? <><br />{a.subject}</> : null}
                                {a.teacher ? <><br />{a.teacher}</> : null}
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
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 130 }}>Room</th>
                  {DAYS.map((d, di) => (<th key={d} style={thStyle}>{DAY_HEADS[di]}</th>))}
                </tr>
              </thead>
              <tbody>
                {roomNames.map((room) => (
                  <tr key={room}>
                    <td style={tdStyle}><b>{room}</b><br />{usageOf(room)}/{totalSlots} periods</td>
                    {DAYS.map((d) => (
                      <td key={d} style={tdStyle}>
                        {allocs
                          .filter((a) => a.room === room && a.day === d)
                          .map((a) => (<div key={a.id} style={{ marginBottom: 2 }}>{a.period.replace('Period ', 'P')} · <b>{a.className}</b>{a.subject ? ` · ${a.subject}` : ''}</div>))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p style={{ marginTop: 8, fontSize: 9, color: '#444' }}>
            Generated by FitPro Education Management — Room Allocation.
          </p>
        </div>,
        document.body,
      )}
    </div>
  )
}
