import { useMemo, useState } from 'react'
import {
  List as ListIcon, Plus, Printer, Search, MoreVertical, Pencil, Trash2,
  ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight,
  CalendarDays, CalendarRange, User as UserIcon, HelpCircle,
} from 'lucide-react'
import { Button, Field, Input, Select, Modal } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import { computeHours } from '../../../lib/timesheets'
import { taskStatusMeta } from '../../../lib/tasks'
import type { TimesheetEntry } from '../../../types'

type SortKey = 'assignee' | 'hours' | 'earnings'

function SortHeader({ label, k, sortBy, sortDir, onSort }: {
  label: string; k: SortKey; sortBy: SortKey; sortDir: 'asc' | 'desc'; onSort: (k: SortKey) => void
}) {
  const active = sortBy === k
  return (
    <button onClick={() => onSort(k)} className="flex items-center gap-1 font-bold">
      {label}
      {active ? (sortDir === 'asc' ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />) : <ChevronsUpDown className="size-3.5 opacity-50" />}
    </button>
  )
}

function AvatarCircle({ name, photo }: { name: string; photo?: string }) {
  const initials = name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  return photo
    ? <img src={photo} alt={name} className="size-8 shrink-0 rounded-full object-cover" />
    : <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#1f4e79] text-[11px] font-semibold text-white">{initials}</span>
}

interface TSForm { id?: string; projectId: string; userId: string; task: string; date: string; start: string; end: string; rate: string }
const blank = (): TSForm => ({ projectId: '', userId: '', task: '', date: new Date().toISOString().slice(0, 10), start: '08:00', end: '17:00', rate: '20' })

interface WeekRow { id: string; taskId: string; hours: string[] }

export function Timesheet() {
  const app = useApp()
  const toast = useToast()
  const { timesheets, projects, users, taskTemplates, tasks, sessionUser, upsertTimesheet, deleteTimesheet } = app

  const [projectFilter, setProjectFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [q, setQ] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<SortKey>('assignee')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [view, setView] = useState<'list' | 'day' | 'month' | 'user' | 'help'>('list')
  const [monthDate, setMonthDate] = useState<Date>(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [weekStart, setWeekStart] = useState<Date>(() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(0, 0, 0, 0); return d })
  const [rows, setRows] = useState<WeekRow[]>([{ id: 'wr_1', taskId: '', hours: Array(7).fill('0') }])
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [editing, setEditing] = useState<TSForm | null>(null)
  const [deleting, setDeleting] = useState<TimesheetEntry | null>(null)

  const filtered = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    const needle = q.trim().toLowerCase()
    return timesheets
      .filter((t) => (!projectFilter || t.projectId === projectFilter)
        && (!userFilter || t.userId === userFilter)
        && (!needle || t.task.toLowerCase().includes(needle) || t.userName.toLowerCase().includes(needle) || t.refNo.toLowerCase().includes(needle)))
      .sort((a, b) => {
        if (sortBy === 'hours') return (a.hours - b.hours) * dir
        if (sortBy === 'earnings') return (a.earnings - b.earnings) * dir
        return a.userName.localeCompare(b.userName) * dir
      })
  }, [timesheets, projectFilter, userFilter, q, sortBy, sortDir])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const onSort = (k: SortKey) => {
    if (sortBy === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(k); setSortDir('asc') }
  }

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d }), [weekStart])
  const weekLabel = `${days[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${days[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  const weekUser = (userFilter ? users.find((u) => u.id === userFilter) : undefined) || sessionUser
  const dayTotal = (i: number) => rows.reduce((sum, r) => sum + (Number(r.hours[i]) || 0), 0)
  const shiftWeek = (dir: number) => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + dir * 7); return n })

  const saveWeek = (submit: boolean) => {
    if (!weekUser) { toast.error('No user', 'Sign in or pick a user to log hours.'); return }
    const dates = days.map((d) => d.toISOString().slice(0, 10))
    const keep = new Set<string>()
    for (const r of rows) {
      const tpl = taskTemplates.find((t) => t.id === r.taskId)
      if (!tpl) continue
      r.hours.forEach((h, i) => {
        const hrs = Number(h) || 0
        if (i > 4 || hrs <= 0) return
        const id = `tsw_${r.id}_${dates[i]}`
        keep.add(id)
        upsertTimesheet({
          id, projectId: projectFilter, projectName: projects.find((x) => x.id === projectFilter)?.name || '—',
          userId: weekUser.id, userName: weekUser.name, userEmail: weekUser.email, userAvatar: weekUser.avatar,
          task: tpl.description, refNo: 'TSW', date: dates[i], startTime: '00:00:00', endTime: '00:00:00',
          hours: hrs, rate: 20, earnings: Math.round(hrs * 20 * 100) / 100,
        })
      })
    }
    timesheets
      .filter((t) => t.id.startsWith('tsw_') && t.userId === weekUser.id && dates.includes(t.date) && !keep.has(t.id))
      .forEach((t) => deleteTimesheet(t.id))
    toast.success(submit ? 'Submitted for approval' : 'Timesheet saved', weekLabel)
  }

  const toLocalIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const monthLabel = monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const shiftMonth = (dir: number) => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1))

  const calTasks = useMemo(
    () => tasks.filter((t) => (!projectFilter || t.projectId === projectFilter)
      && (!userFilter || t.assigneeId === userFilter || t.collaboratorIds.includes(userFilter))),
    [tasks, projectFilter, userFilter],
  )
  const monthCells = useMemo(() => {
    const offset = (monthDate.getDay() + 6) % 7
    const start = new Date(monthDate)
    start.setDate(1 - offset)
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  }, [monthDate])
  const tasksOn = (d: Date) => {
    const iso = toLocalIso(d)
    return calTasks.filter((t) => t.startDate && t.startDate <= iso && (t.dueDate ? iso <= t.dueDate : iso === t.startDate))
  }

  // Clicking a day badge jumps into the weekly roster for that day's week, prefilled with the
  // hours already logged and — when a template matches — a row for the clicked task.
  const openWeekFor = (d: Date, taskName?: string) => {
    const m = new Date(d); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); m.setHours(0, 0, 0, 0)
    setWeekStart(m)
    const dates = Array.from({ length: 7 }, (_, i) => { const x = new Date(m); x.setDate(x.getDate() + i); return toLocalIso(x) })
    const u = (userFilter ? users.find((x) => x.id === userFilter) : undefined) || sessionUser
    const logged = timesheets.filter((t) => t.id.startsWith('tsw_') && t.userId === u?.id && dates.includes(t.date))
    const loaded: WeekRow[] = []
    for (const tpl of taskTemplates) {
      const hits = logged.filter((t) => t.task === tpl.description)
      if (taskName ? tpl.description === taskName : hits.length > 0) {
        loaded.push({ id: uid('wr'), taskId: tpl.id, hours: dates.map((dt) => String(hits.find((t) => t.date === dt)?.hours || 0)) })
      }
    }
    setRows(loaded.length ? [...loaded, { id: uid('wr'), taskId: '', hours: Array(7).fill('0') }] : [{ id: 'wr_1', taskId: '', hours: Array(7).fill('0') }])
    setView('day')
  }

  // Per-user aggregation of logged timesheets (respects the project filter).
  const byUser = useMemo(() => {
    const src = timesheets.filter((t) => !projectFilter || t.projectId === projectFilter)
    const map = new Map<string, { userName: string; userEmail: string; userAvatar?: string; hours: number; earnings: number; entries: number; perProject: Map<string, number> }>()
    for (const t of src) {
      const u = map.get(t.userId) || { userName: t.userName, userEmail: t.userEmail, userAvatar: t.userAvatar, hours: 0, earnings: 0, entries: 0, perProject: new Map<string, number>() }
      u.hours = Math.round((u.hours + t.hours) * 100) / 100
      u.earnings = Math.round((u.earnings + t.earnings) * 100) / 100
      u.entries += 1
      u.perProject.set(t.projectName, Math.round(((u.perProject.get(t.projectName) || 0) + t.hours) * 100) / 100)
      map.set(t.userId, u)
    }
    return [...map.values()].sort((a, b) => b.hours - a.hours)
  }, [timesheets, projectFilter])

  const exportRows = filtered.map((t) => ({
    Task: t.task, Reference: t.refNo, Assigned_To: t.userName, Project: t.projectName,
    Date: t.date, Start_Time: t.startTime, End_Time: t.endTime, Total_Hours: t.hours, Earnings: t.earnings,
  }))

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Project Management</span><span>/</span><span className="font-semibold text-inherit">Timesheet</span>
      </div>

      <div className="card">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-4">
          <h2 className="mr-auto flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100"><ListIcon className="size-5" /> Timesheet List</h2>
          <button onClick={() => setEditing(blank())} className="flex items-center gap-1.5 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"><Plus className="size-4" /> Add</button>
          <button onClick={() => window.print()} className="grid size-9 place-items-center rounded-full bg-slate-800 text-white hover:bg-slate-700" title="Print" aria-label="Print"><Printer className="size-4" /></button>
          <ExportButtons filename="timesheet" rows={exportRows} compact />
          <div className="ml-2 flex items-center overflow-hidden rounded-lg bg-zinc-400/70 dark:bg-zinc-700" role="group" aria-label="Timesheet view">
            <button onClick={() => setView('list')} title="Timesheet" aria-label="List view" className={`grid size-9 place-items-center ${view === 'list' ? 'bg-black text-white' : 'text-white hover:bg-black/30'}`}><ListIcon className="size-4" /></button>
            <button onClick={() => setView('day')} title="Weekly Timesheets" aria-label="Weekly timesheets view" className={`grid size-9 place-items-center ${view === 'day' ? 'bg-black text-white' : 'text-white hover:bg-black/30'}`}><CalendarDays className="size-4" /></button>
            <button onClick={() => setView('month')} title="Month" aria-label="Month view" className={`grid size-9 place-items-center ${view === 'month' ? 'bg-black text-white' : 'text-white hover:bg-black/30'}`}><CalendarRange className="size-4" /></button>
            <button onClick={() => setView('user')} title="By user" aria-label="By user view" className={`grid size-9 place-items-center ${view === 'user' ? 'bg-black text-white' : 'text-white hover:bg-black/30'}`}><UserIcon className="size-4" /></button>
            <button onClick={() => setView('help')} title="Help" aria-label="Help" className={`grid size-9 place-items-center ${view === 'help' ? 'bg-black text-white' : 'text-white hover:bg-black/30'}`}><HelpCircle className="size-4" /></button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-stretch gap-3 px-5 py-4">
          <Select value={projectFilter} onChange={(e) => { setProjectFilter(e.target.value); setPage(1) }} className="min-w-[220px] flex-1">
            <option value="">All Projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select value={userFilter} onChange={(e) => { setUserFilter(e.target.value); setPage(1) }} className="min-w-[220px] flex-1">
            <option value="">All Users</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <Button variant="outline" onClick={() => setPage(1)} className="shrink-0 border-sky-300 text-sky-600"><Search className="size-4" /> Search</Button>
        </div>

        {view === 'list' && (<>
        {/* Show + search */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="flex items-center gap-2">
            Show
            <Select value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="w-20">
              <option value="10">10</option><option value="25">25</option><option value="50">50</option>
            </Select>
            entries
          </span>
          <span className="flex items-center gap-2">
            Search:
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="w-48" placeholder="" />
          </span>
        </div>

        {/* Table — same format as All Sales */}
        <div className="overflow-x-auto px-5 pt-1">
          <table className="w-full min-w-[860px] border-collapse text-[12px] text-zinc-800 dark:text-zinc-200">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/80">
                <th className="w-10 border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">#</th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Task</th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left dark:border-zinc-700"><SortHeader label="Assigned To" k="assignee" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Start Time</th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">End Time</th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left dark:border-zinc-700"><SortHeader label="Total Hours" k="hours" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></th>
                <th className="border-b border-zinc-200 px-2 py-3 text-right dark:border-zinc-700"><span className="ml-auto"><SortHeader label="Earnings" k="earnings" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></span></th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((t, i) => (
                <tr key={t.id} className="border-b border-zinc-100 hover:bg-sky-50/40 dark:border-zinc-800 dark:hover:bg-white/[0.03]">
                  <td className="px-2 py-2.5 align-top text-zinc-500">{(safePage - 1) * pageSize + i + 1}</td>
                  <td className="px-2 py-2.5 align-top">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">{t.task}</div>
                    <div className="text-[11px] text-zinc-500">{t.refNo} · {t.projectName}</div>
                  </td>
                  <td className="px-2 py-2.5 align-top">
                    <div className="flex items-center gap-2">
                      <AvatarCircle name={t.userName} photo={t.userAvatar} />
                      <div>
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">{t.userName}</div>
                        <div className="text-[11px] text-zinc-500">{t.userEmail}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 align-top">{t.startTime}</td>
                  <td className="px-2 py-2.5 align-top">{t.endTime}</td>
                  <td className="px-2 py-2.5 align-top">{t.hours}</td>
                  <td className="px-2 py-2.5 text-right align-top">{t.earnings.toFixed(2)}</td>
                  <td className="px-2 py-2.5 align-top">
                    <div className="relative inline-block">
                      <button onClick={() => setMenuFor(menuFor === t.id ? null : t.id)} className="grid size-8 place-items-center rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800" aria-label="Row actions"><MoreVertical className="size-4" /></button>
                      {menuFor === t.id && (
                        <div className="menu-pop absolute left-0 z-20 mt-1 w-32 rounded-xl p-1">
                          <button onClick={() => { setMenuFor(null); setEditing({ id: t.id, projectId: t.projectId, userId: t.userId, task: t.task, date: t.date, start: t.startTime.slice(0, 5), end: t.endTime.slice(0, 5), rate: String(t.rate) }) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"><Pencil className="size-3.5" /> Edit</button>
                          <button onClick={() => { setMenuFor(null); setDeleting(t) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-rose-600"><Trash2 className="size-3.5" /> Delete</button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!paged.length && (
                <tr><td colSpan={8} className="bg-zinc-100 px-4 py-4 text-center text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">No data available in table</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer — same format as All Sales */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm text-zinc-700 dark:text-zinc-300">
          <span>
            Showing {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1} to{' '}
            {Math.min(safePage * pageSize, filtered.length)} of {filtered.length} entries
          </span>
          <div className="flex items-center gap-1">
            <button type="button" className="btn" disabled={safePage <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>Previous</button>
            {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => {
              const n = i + 1
              return (
                <button key={n} type="button" className="btn min-w-9" aria-current={safePage === n ? 'page' : undefined}
                  style={safePage === n ? { background: '#337ab7', color: '#fff', borderColor: '#337ab7' } : undefined}
                  onClick={() => setPage(n)}>{n}</button>
              )
            })}
            <button type="button" className="btn" disabled={safePage >= pageCount} onClick={() => setPage((v) => Math.min(pageCount, v + 1))}>Next</button>
          </div>
        </div>
        </>)}

        {view === 'day' && (
          <div className="px-5 pb-5">
            {/* Week navigation */}
            <div className="mb-4 flex items-stretch">
              <button onClick={() => shiftWeek(-1)} className="grid w-10 place-items-center rounded-l-md bg-[#1f4e79] text-white hover:bg-[#16395c]" aria-label="Previous week"><ChevronLeft className="size-4" /></button>
              <div className="grid flex-1 place-items-center border-y border-line bg-white px-4 py-2 text-sm font-semibold text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">{weekLabel}</div>
              <button onClick={() => shiftWeek(1)} className="grid w-10 place-items-center rounded-r-md bg-[#1f4e79] text-white hover:bg-[#16395c]" aria-label="Next week"><ChevronRight className="size-4" /></button>
            </div>

            {/* Weekly grid */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-[12px] text-zinc-800 dark:text-zinc-200">
                <thead>
                  <tr className="bg-zinc-100 dark:bg-zinc-800/80">
                    <th className="w-[300px] border border-zinc-200 px-3 py-3 text-left font-semibold dark:border-zinc-700">Task</th>
                    {days.map((d, i) => (
                      <th key={i} className="border border-zinc-200 px-2 py-2 text-left align-top dark:border-zinc-700">
                        <span className="text-lg font-bold">{d.getDate()}</span>{' '}
                        <span className="text-[10px] font-semibold uppercase leading-tight text-zinc-500">
                          {d.toLocaleDateString('en-GB', { weekday: 'long' })}<br />{d.toLocaleDateString('en-GB', { month: 'short' })}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="border border-zinc-200 px-2 py-2 dark:border-zinc-700">
                        <div className="flex items-stretch">
                          <Select value={r.taskId} onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, taskId: e.target.value } : x)))} className="min-w-0 flex-1 rounded-r-none">
                            <option value="">Please Select...</option>
                            {taskTemplates.map((t) => <option key={t.id} value={t.id}>{t.description}</option>)}
                          </Select>
                          <button onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} className="grid w-9 shrink-0 place-items-center rounded-r-md bg-[#1f4e79] text-white hover:bg-[#16395c]" aria-label="Remove row"><Trash2 className="size-4" /></button>
                        </div>
                      </td>
                      {days.map((_, i) => (
                        <td key={i} className="border border-zinc-200 px-2 py-2 dark:border-zinc-700">
                          {i < 5 ? (
                            <Input type="number" min="0" max="24" value={r.hours[i]}
                              onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, hours: x.hours.map((h, j) => (j === i ? e.target.value : h)) } : x)))}
                              className="w-20" />
                          ) : (
                            <span className="text-zinc-400">--</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td className="border border-zinc-200 px-3 py-3 font-bold dark:border-zinc-700">Total</td>
                    {days.map((_, i) => (
                      <td key={i} className="border border-zinc-200 px-2 py-3 font-semibold dark:border-zinc-700">{dayTotal(i)} hrs</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => setRows((rs) => [...rs, { id: uid('wr'), taskId: '', hours: Array(7).fill('0') }])} className="bg-[#1f4e79]">Add More</Button>
              <Button onClick={() => saveWeek(false)} className="bg-green-600 hover:bg-green-700">Save</Button>
              <Button onClick={() => saveWeek(true)} className="bg-[#1f4e79]">Submit for Approval</Button>
            </div>
          </div>
        )}

        {view === 'month' && (
          <div className="px-5 pb-5">
            {/* Month navigation */}
            <div className="mb-4 flex items-stretch">
              <button onClick={() => shiftMonth(-1)} className="grid w-10 place-items-center rounded-l-md bg-[#1f4e79] text-white hover:bg-[#16395c]" aria-label="Previous month"><ChevronLeft className="size-4" /></button>
              <div className="grid flex-1 place-items-center border-y border-line bg-white px-4 py-2 text-sm font-semibold capitalize text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">{monthLabel}</div>
              <button onClick={() => shiftMonth(1)} className="grid w-10 place-items-center rounded-r-md bg-[#1f4e79] text-white hover:bg-[#16395c]" aria-label="Next month"><ChevronRight className="size-4" /></button>
            </div>

            {/* Calendar grid of task assignments */}
            <div className="grid grid-cols-7 overflow-hidden rounded-md border border-line text-[11px]">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => (
                <div key={d} className="border-b border-line bg-zinc-100 px-2 py-2 font-bold uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{d}</div>
              ))}
              {monthCells.map((d, i) => {
                const inMonth = d.getMonth() === monthDate.getMonth()
                const list = tasksOn(d)
                return (
                  <div key={i} className={`min-h-24 border-b border-r border-line p-1.5 dark:border-zinc-700 ${inMonth ? 'bg-white dark:bg-zinc-900' : 'bg-zinc-50 dark:bg-zinc-800/50'}`}>
                    <div className={`mb-1 text-right font-semibold ${inMonth ? 'text-zinc-700 dark:text-zinc-200' : 'text-zinc-400'}`}>{d.getDate()}</div>
                    <div className="space-y-1">
                      {list.slice(0, 3).map((t) => (
                        <button key={t.id} type="button" title={`${t.name} · ${t.projectName} — open weekly roster`} onClick={() => openWeekFor(d, t.name)} className="block w-full truncate rounded px-1.5 py-0.5 text-left font-semibold text-white transition-opacity hover:opacity-80" style={{ backgroundColor: taskStatusMeta(t.status).card }}>{t.name}</button>
                      ))}
                      {list.length > 3 && <button type="button" onClick={() => openWeekFor(d)} title="Open weekly roster" className="font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">+{list.length - 3} more</button>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
              {(['to_do', 'in_progress', 'review', 'completed'] as const).map((st) => (
                <span key={st} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: taskStatusMeta(st).card }} /> {taskStatusMeta(st).label}
                </span>
              ))}
            </div>
          </div>
        )}

        {view === 'user' && (
          <div className="px-5 pb-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Logged hours by user</h3>
              {projectFilter && <span className="text-xs text-zinc-500">Filtered by project</span>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {byUser.map((u) => (
                <div key={u.userEmail} className="card p-4">
                  <div className="flex items-center gap-3">
                    <AvatarCircle name={u.userName} photo={u.userAvatar} />
                    <div className="min-w-0">
                      <div className="truncate font-bold text-zinc-900 dark:text-zinc-100">{u.userName}</div>
                      <div className="truncate text-xs text-zinc-500">{u.userEmail}</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-zinc-50 px-2 py-2 dark:bg-zinc-800">
                      <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{u.hours}</div>
                      <div className="text-[10px] font-semibold uppercase text-zinc-500">Hours</div>
                    </div>
                    <div className="rounded-lg bg-zinc-50 px-2 py-2 dark:bg-zinc-800">
                      <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{u.earnings.toFixed(2)}</div>
                      <div className="text-[10px] font-semibold uppercase text-zinc-500">Earnings</div>
                    </div>
                    <div className="rounded-lg bg-zinc-50 px-2 py-2 dark:bg-zinc-800">
                      <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{u.entries}</div>
                      <div className="text-[10px] font-semibold uppercase text-zinc-500">Entries</div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {[...u.perProject.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, hours]) => (
                      <div key={name}>
                        <div className="flex justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
                          <span className="truncate">{name}</span>
                          <span className="font-semibold">{hours}h</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                          <div className="h-full rounded-full bg-[#1f4e79]" style={{ width: `${Math.min(100, (hours / u.hours) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {!byUser.length && (
                <div className="card col-span-full p-10 text-center text-sm text-zinc-500">No timesheet entries yet. Save hours from the Day view or add them via Add.</div>
              )}
            </div>
          </div>
        )}

        {view === 'help' && (
          <div className="space-y-4 px-5 pb-5">
            <div className="rounded-lg border-l-4 border-[#1f4e79] bg-[#1f4e79]/5 px-4 py-3 dark:bg-[#1f4e79]/15">
              <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100"><HelpCircle className="size-4 text-[#1f4e79]" /> Timesheet quick guide</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Use the view switcher (top right of this card) to move between the five ways of looking at team time.
                The <span className="font-semibold">All Projects</span> and <span className="font-semibold">All Users</span> filters apply to every view.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="card p-4">
                <h4 className="mb-3 text-sm font-bold text-zinc-900 dark:text-zinc-100">The five views</h4>
                <ul className="space-y-2.5 text-sm text-zinc-600 dark:text-zinc-400">
                  <li className="flex gap-2.5"><span className="grid size-7 shrink-0 place-items-center rounded-md bg-black text-white"><ListIcon className="size-3.5" /></span><span><span className="font-semibold text-zinc-800 dark:text-zinc-200">List</span> — every logged entry with task, person, start/end times, total hours and earnings. Add, edit, delete, search and export here.</span></li>
                  <li className="flex gap-2.5"><span className="grid size-7 shrink-0 place-items-center rounded-md bg-black text-white"><CalendarDays className="size-3.5" /></span><span><span className="font-semibold text-zinc-800 dark:text-zinc-200">Day (Weekly)</span> — fill a Mon–Fri grid of hours per task row, see daily totals, then Save or Submit for Approval. Weekends are disabled.</span></li>
                  <li className="flex gap-2.5"><span className="grid size-7 shrink-0 place-items-center rounded-md bg-black text-white"><CalendarRange className="size-3.5" /></span><span><span className="font-semibold text-zinc-800 dark:text-zinc-200">Month</span> — a calendar of task assignments, coloured by task status, spanning each task's start to due date.</span></li>
                  <li className="flex gap-2.5"><span className="grid size-7 shrink-0 place-items-center rounded-md bg-black text-white"><UserIcon className="size-3.5" /></span><span><span className="font-semibold text-zinc-800 dark:text-zinc-200">By user</span> — per-person cards with hours, earnings, entry counts and a project breakdown.</span></li>
                  <li className="flex gap-2.5"><span className="grid size-7 shrink-0 place-items-center rounded-md bg-black text-white"><HelpCircle className="size-3.5" /></span><span><span className="font-semibold text-zinc-800 dark:text-zinc-200">Help</span> — this guide.</span></li>
                </ul>
              </div>

              <div className="card p-4">
                <h4 className="mb-3 text-sm font-bold text-zinc-900 dark:text-zinc-100">Log a week of hours</h4>
                <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                  <li>Click the <span className="font-semibold">Day</span> icon and pick the week with the ‹ › arrows.</li>
                  <li>Choose the person with the <span className="font-semibold">All Users</span> filter (defaults to you).</li>
                  <li>Press <span className="font-semibold">Add More</span> and select a task from the template list.</li>
                  <li>Type hours for Monday–Friday; the Total row updates as you type.</li>
                  <li><span className="font-semibold">Save</span> stores the entries; <span className="font-semibold">Submit for Approval</span> saves and flags them for review.</li>
                </ol>
                <h4 className="mb-2 mt-4 text-sm font-bold text-zinc-900 dark:text-zinc-100">Good to know</h4>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                  <li>Earnings = hours × hourly rate (set per entry in the Add modal).</li>
                  <li>Saved weekly entries appear in the List view and in By user totals.</li>
                  <li>Use the Excel/CSV buttons (top right) to export whatever is on screen.</li>
                  <li>The trash button on a weekly row removes that row before saving.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit timesheet' : 'Add timesheet'}>
        {editing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project" required className="sm:col-span-2">
              <Select value={editing.projectId} onChange={(e) => setEditing({ ...editing, projectId: e.target.value })}>
                <option value="">Please Select...</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="User" required className="sm:col-span-2">
              <Select value={editing.userId} onChange={(e) => setEditing({ ...editing, userId: e.target.value })}>
                <option value="">Please Select...</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </Field>
            <Field label="Task" required className="sm:col-span-2">
              <Input value={editing.task} onChange={(e) => setEditing({ ...editing, task: e.target.value })} placeholder="e.g. Site supervision" />
            </Field>
            <Field label="Date">
              <Input type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
            </Field>
            <Field label="Hourly Rate (GHS)">
              <Input type="number" min="0" step="0.5" value={editing.rate} onChange={(e) => setEditing({ ...editing, rate: e.target.value })} />
            </Field>
            <Field label="Start Time">
              <Input type="time" value={editing.start} onChange={(e) => setEditing({ ...editing, start: e.target.value })} />
            </Field>
            <Field label="End Time">
              <Input type="time" value={editing.end} onChange={(e) => setEditing({ ...editing, end: e.target.value })} />
            </Field>
            <div className="sm:col-span-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              Total hours: <span className="font-semibold">{computeHours(editing.start, editing.end)}</span> · Earnings:{' '}
              <span className="font-semibold">{(computeHours(editing.start, editing.end) * (Number(editing.rate) || 0)).toFixed(2)}</span>
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={() => {
                if (!editing.projectId) { toast.error('Select a project.'); return }
                if (!editing.userId) { toast.error('Select a user.'); return }
                if (!editing.task.trim()) { toast.error('Enter the task performed.'); return }
                const project = projects.find((p) => p.id === editing.projectId)
                const user = users.find((u) => u.id === editing.userId)
                const hours = computeHours(editing.start, editing.end)
                const rate = Number(editing.rate) || 0
                upsertTimesheet({
                  id: editing.id || uid('ts'),
                  projectId: editing.projectId,
                  projectName: project?.name || '',
                  userId: editing.userId,
                  userName: user?.name || '',
                  userEmail: user?.email || '',
                  userAvatar: user?.avatar,
                  task: editing.task.trim(),
                  refNo: editing.id ? (timesheets.find((x) => x.id === editing.id)?.refNo || '') : `TS-${1000 + timesheets.length + 1}`,
                  date: editing.date,
                  startTime: `${editing.start}:00`,
                  endTime: `${editing.end}:00`,
                  hours,
                  rate,
                  earnings: Math.round(hours * rate * 100) / 100,
                })
                toast.success(editing.id ? 'Timesheet updated' : 'Timesheet saved')
                setEditing(null)
              }}>Save</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete timesheet">
        {deleting && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Delete <span className="font-semibold">{deleting.task}</span> for {deleting.userName}? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { deleteTimesheet(deleting.id); toast.success('Deleted'); setDeleting(null) }}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>


    </div>
  )
}
