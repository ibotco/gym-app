import { useMemo, useState } from 'react'
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, MapPin, Clock,
  User, Users, Link2, Ticket, Printer, List as ListIcon, CalendarRange, Image as ImageIcon, Tag,
} from 'lucide-react'
import {
  PageHeader, Button, Modal, Field, Input, Select, Textarea, Switch, SearchField, StatCard, Segmented, Badge,
} from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { nextCmsId, type CmsEvent } from '../../../lib/cms'

/* ---------- Event categories with professional color coding ---------- */
const CATEGORIES: { id: string; label: string; color: string }[] = [
  { id: 'workshop', label: 'Workshop', color: '#3b82f6' },
  { id: 'seminar', label: 'Seminar', color: '#8b5cf6' },
  { id: 'competition', label: 'Competition', color: '#f59e0b' },
  { id: 'social', label: 'Social', color: '#10b981' },
  { id: 'webinar', label: 'Webinar', color: '#06b6d4' },
  { id: 'other', label: 'Other', color: '#64748b' },
]
const catMeta = (id?: string) => CATEGORIES.find((c) => c.id === id) || { id: 'other', label: id || 'Event', color: '#64748b' }
const eventColor = (e: CmsEvent) => e.color || catMeta(e.category).color

/* ---------- Date helpers (local time, ISO strings) ---------- */
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayISO = () => iso(new Date())
const fmtTime = (t?: string) => {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h)) return t
  const ap = h >= 12 ? 'PM' : 'AM'
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh}:${String(m || 0).padStart(2, '0')} ${ap}`
}
const fmtDateLong = (d: string) => {
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  if (!y || !m || !day) return d
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
const isPastEvent = (e: CmsEvent) => (e.date ? e.date < todayISO() : e.status === 'past')

/* ---------- Form ---------- */
interface Form {
  title: string
  category: string
  date: string
  time: string
  endTime: string
  allDay: boolean
  location: string
  organizer: string
  capacity: string
  registered: string
  price: string
  description: string
  featuredImage: string
  registrationLink: string
  color: string
}
const blankForm = (date?: string): Form => ({
  title: '', category: 'workshop', date: date || todayISO(), time: '09:00', endTime: '10:00', allDay: false,
  location: '', organizer: '', capacity: '', registered: '', price: '', description: '',
  featuredImage: '', registrationLink: '', color: '',
})

/** Small colored category chip. */
function CatChip({ e }: { e: CmsEvent }) {
  const c = catMeta(e.category)
  return (
    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: `${c.color}22`, color: c.color }}>
      {c.label}
    </span>
  )
}

/** Date tile used in agenda / list rows. */
function DateTile({ date, past }: { date: string; past?: boolean }) {
  const [y, m, d] = (date || todayISO()).split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  return (
    <div className={`grid w-11 shrink-0 place-items-center rounded-lg border py-1 leading-none ${past ? 'border-line text-mist' : 'border-lime/40 bg-lime/10 text-lime'}`}>
      <span className="text-[9px] font-bold uppercase">{dt.toLocaleDateString(undefined, { month: 'short' })}</span>
      <span className="mt-0.5 text-base font-extrabold">{d}</span>
    </div>
  )
}

export function EventsApp() {
  const { cms, setCms, log } = useApp()
  const { user } = useAuth()
  const toast = useToast()

  const events: CmsEvent[] = useMemo(() => cms.events || [], [cms])
  const [view, setView] = useState('calendar')
  const [q, setQ] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null)
  const [detail, setDetail] = useState<CmsEvent | null>(null)
  const [deleting, setDeleting] = useState<CmsEvent | null>(null)
  const [dayOpen, setDayOpen] = useState<string | null>(null) // ISO date for "+N more" modal
  const [err, setErr] = useState('')

  /* ----- filtering ----- */
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return events.filter((e) => {
      if (catFilter && e.category !== catFilter) return false
      if (!ql) return true
      return `${e.title} ${e.location} ${e.organizer} ${e.description}`.toLowerCase().includes(ql)
    })
  }, [events, q, catFilter])

  /* ----- stats ----- */
  const stats = useMemo(() => {
    const t = todayISO()
    const month = t.slice(0, 7)
    return {
      total: events.length,
      upcoming: events.filter((e) => e.date >= t).length,
      thisMonth: events.filter((e) => (e.date || '').startsWith(month)).length,
      past: events.filter((e) => e.date && e.date < t).length,
    }
  }, [events])

  /* ----- calendar grid ----- */
  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1)
    const start = new Date(first)
    start.setDate(1 - first.getDay())
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  }, [cursor])
  const byDate = useMemo(() => {
    const map: Record<string, CmsEvent[]> = {}
    for (const e of filtered) {
      if (!e.date) continue
      ;(map[e.date] ||= []).push(e)
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))
    return map
  }, [filtered])

  const upcoming = useMemo(
    () => events.filter((e) => e.date >= todayISO()).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '')),
    [events],
  )
  const pastEvents = useMemo(
    () => events.filter((e) => e.date && e.date < todayISO()).sort((a, b) => b.date.localeCompare(a.date)),
    [events],
  )

  /* ----- CRUD ----- */
  const openCreate = (date?: string) => { setEditing({ id: null, form: blankForm(date) }); setErr('') }
  const openEdit = (e: CmsEvent) => {
    setEditing({
      id: e.id,
      form: {
        title: e.title || '', category: e.category || 'workshop', date: e.date || todayISO(), time: e.time || '',
        endTime: e.endTime || '', allDay: !!e.allDay, location: e.location || '', organizer: e.organizer || '',
        capacity: e.capacity ? String(e.capacity) : '', registered: e.registered ? String(e.registered) : '',
        price: e.price ? String(e.price) : '', description: e.description || '', featuredImage: e.featuredImage || '',
        registrationLink: e.registrationLink || '', color: e.color || '',
      },
    })
    setErr(''); setDetail(null)
  }
  const onImage = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]
    if (!file || !editing) return
    const reader = new FileReader()
    reader.onload = () => setEditing((ed) => (ed ? { ...ed, form: { ...ed.form, featuredImage: String(reader.result) } } : ed))
    reader.readAsDataURL(file)
  }
  const save = () => {
    if (!editing) return
    const f = editing.form
    if (!f.title.trim()) { setErr('Event title is required.'); return }
    if (!f.date) { setErr('Event date is required.'); return }
    const rec: CmsEvent = {
      id: editing.id || nextCmsId('even'),
      title: f.title.trim(),
      date: f.date,
      time: f.allDay ? '' : f.time,
      endTime: f.allDay ? '' : f.endTime,
      allDay: f.allDay,
      location: f.location.trim(),
      organizer: f.organizer.trim(),
      description: f.description,
      featuredImage: f.featuredImage || undefined,
      registrationLink: f.registrationLink.trim() || undefined,
      category: f.category,
      capacity: f.capacity ? Number(f.capacity) : undefined,
      registered: f.registered ? Number(f.registered) : undefined,
      price: f.price ? Number(f.price) : undefined,
      color: f.color || undefined,
      status: f.date < todayISO() ? 'past' : 'upcoming',
    }
    const next = editing.id ? events.map((e) => (e.id === editing.id ? rec : e)) : [...events, rec]
    setCms({ ...cms, events: next })
    log(user?.id || 'system', editing.id ? 'UPDATE' : 'CREATE', 'FrontCMS', `${editing.id ? 'Updated' : 'Created'} event ${rec.title}`)
    toast.success(editing.id ? 'Event updated' : 'Event created', rec.title)
    setEditing(null)
  }
  const doDelete = () => {
    if (!deleting) return
    setCms({ ...cms, events: events.filter((e) => e.id !== deleting.id) })
    log(user?.id || 'system', 'DELETE', 'FrontCMS', `Deleted event ${deleting.title}`)
    toast.success('Event deleted', deleting.title)
    setDeleting(null); setDetail(null)
  }

  const shiftMonth = (n: number) => setCursor((c) => {
    const d = new Date(c.y, c.m + n, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const dayEvents = dayOpen ? byDate[dayOpen] || [] : []

  const exportRows = filtered.map((e) => ({
    Title: e.title, Date: e.date, Time: e.allDay ? 'All day' : fmtTime(e.time), Category: catMeta(e.category).label,
    Location: e.location, Organizer: e.organizer, Capacity: e.capacity ?? '', Registered: e.registered ?? '',
    Price: e.price ?? '', Status: isPastEvent(e) ? 'Past' : 'Upcoming',
  }))

  return (
    <div>
      <PageHeader
        title="Events"
        desc="Plan, schedule and promote gym events — workshops, competitions, seminars and socials."
        actions={<Button onClick={() => openCreate()}><Plus className="size-4" /> New event</Button>}
      />

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total events" value={String(stats.total)} icon={<CalendarDays className="size-4" />} />
        <StatCard label="Upcoming" value={String(stats.upcoming)} icon={<CalendarRange className="size-4" />} hint="from today" />
        <StatCard label="This month" value={String(stats.thisMonth)} icon={<CalendarDays className="size-4" />} />
        <StatCard label="Past" value={String(stats.past)} icon={<Clock className="size-4" />} />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Search events…" className="max-w-xs" />
        <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="max-w-[180px]" aria-label="Filter by category">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </Select>
        <div className="mx-auto"><Segmented value={view} onChange={setView} options={[{ id: 'calendar', label: 'Calendar' }, { id: 'agenda', label: 'Agenda' }, { id: 'list', label: 'List' }]} /></div>
        <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
        <ExportButtons filename="events" rows={exportRows} />
      </div>

      {/* ============ CALENDAR VIEW ============ */}
      {view === 'calendar' && (
        <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
          <div className="card overflow-hidden">
            {/* Month header */}
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div className="flex items-center gap-1">
                <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => shiftMonth(-1)} title="Previous month"><ChevronLeft className="size-4" /></button>
                <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/5" onClick={() => { const d = new Date(); setCursor({ y: d.getFullYear(), m: d.getMonth() }) }}>Today</button>
                <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => shiftMonth(1)} title="Next month"><ChevronRight className="size-4" /></button>
              </div>
              <p className="text-base font-extrabold">{monthLabel}</p>
              <div className="hidden items-center gap-2 sm:flex">
                {CATEGORIES.slice(0, 4).map((c) => (
                  <span key={c.id} className="flex items-center gap-1 text-[10px] font-semibold text-mist">
                    <span className="size-2 rounded-full" style={{ background: c.color }} /> {c.label}
                  </span>
                ))}
              </div>
            </div>
            {/* Weekday header */}
            <div className="grid grid-cols-7 border-b border-line bg-black/[0.02] dark:bg-white/[0.02]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-mist">{d}</div>
              ))}
            </div>
            {/* Day grid */}
            <div className="grid grid-cols-7">
              {cells.map((d, i) => {
                const key = iso(d)
                const inMonth = d.getMonth() === cursor.m
                const isToday = key === todayISO()
                const dayList = byDate[key] || []
                const shown = dayList.slice(0, 3)
                return (
                  <div
                    key={key}
                    onClick={() => openCreate(key)}
                    className={`group relative min-h-[92px] cursor-pointer border-b border-r border-line p-1.5 transition-colors hover:bg-lime/[0.04] ${inMonth ? '' : 'bg-black/[0.02] opacity-45 dark:bg-white/[0.015]'} ${i % 7 === 6 ? 'border-r-0' : ''} ${i >= 35 ? 'border-b-0' : ''}`}
                    title="Click to add an event on this day"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`grid size-6 place-items-center rounded-full text-[11px] font-bold ${isToday ? 'bg-lime text-black' : inMonth ? 'text-ink' : 'text-mist'}`}>{d.getDate()}</span>
                      <Plus className="size-3.5 text-mist opacity-0 transition group-hover:opacity-100" />
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {shown.map((e) => (
                        <button
                          key={e.id}
                          onClick={(ev) => { ev.stopPropagation(); setDetail(e) }}
                          className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-semibold text-white transition hover:brightness-110"
                          style={{ background: eventColor(e) }}
                          title={`${e.title}${e.time ? ` · ${fmtTime(e.time)}` : ''}`}
                        >
                          {!e.allDay && e.time ? `${fmtTime(e.time).replace(':00', '')} ` : ''}{e.title}
                        </button>
                      ))}
                      {dayList.length > 3 && (
                        <button
                          onClick={(ev) => { ev.stopPropagation(); setDayOpen(key) }}
                          className="block w-full rounded px-1.5 text-left text-[10px] font-bold text-mist hover:text-lime"
                        >
                          +{dayList.length - 3} more
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Upcoming sidebar */}
          <div className="card h-fit p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-extrabold"><CalendarRange className="size-4 text-lime" /> Upcoming</p>
            {upcoming.length === 0 && <p className="text-sm text-mist">No upcoming events. Click any day on the calendar to schedule one.</p>}
            <div className="space-y-2">
              {upcoming.slice(0, 7).map((e) => (
                <button key={e.id} onClick={() => setDetail(e)} className="flex w-full items-center gap-2.5 rounded-xl border border-line p-2 text-left transition hover:border-lime/50 hover:bg-lime/[0.04]">
                  <DateTile date={e.date} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">{e.title}</p>
                    <p className="flex items-center gap-1 truncate text-[11px] text-mist">
                      {e.allDay ? 'All day' : fmtTime(e.time)}{e.location ? <> · <MapPin className="size-3" /> {e.location}</> : null}
                    </p>
                  </div>
                  <span className="size-2 shrink-0 rounded-full" style={{ background: eventColor(e) }} title={catMeta(e.category).label} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============ AGENDA VIEW ============ */}
      {view === 'agenda' && (
        <div className="space-y-6">
          <section>
            <p className="mb-2 text-sm font-extrabold uppercase tracking-wide text-lime">Upcoming</p>
            <div className="card divide-y divide-[var(--line,#e5e7eb)] dark:divide-white/10">
              {upcoming.filter((e) => (!q || `${e.title} ${e.location}`.toLowerCase().includes(q.toLowerCase())) && (!catFilter || e.category === catFilter)).map((e) => (
                <div key={e.id} className="flex flex-wrap items-center gap-3 p-3">
                  <DateTile date={e.date} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{e.title}</p>
                      <CatChip e={e} />
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-mist">
                      <span className="flex items-center gap-1"><Clock className="size-3" /> {e.allDay ? 'All day' : `${fmtTime(e.time)}${e.endTime ? ` – ${fmtTime(e.endTime)}` : ''}`}</span>
                      {e.location && <span className="flex items-center gap-1"><MapPin className="size-3" /> {e.location}</span>}
                      {e.organizer && <span className="flex items-center gap-1"><User className="size-3" /> {e.organizer}</span>}
                    </p>
                  </div>
                  <Button variant="ghost" onClick={() => setDetail(e)}>Details</Button>
                </div>
              ))}
              {upcoming.length === 0 && <p className="p-4 text-sm text-mist">No upcoming events.</p>}
            </div>
          </section>
          {pastEvents.length > 0 && (
            <section>
              <p className="mb-2 text-sm font-extrabold uppercase tracking-wide text-mist">Past</p>
              <div className="card divide-y divide-[var(--line,#e5e7eb)] dark:divide-white/10 opacity-70">
                {pastEvents.slice(0, 10).map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center gap-3 p-3">
                    <DateTile date={e.date} past />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold">{e.title}</p>
                        <CatChip e={e} />
                      </div>
                      <p className="mt-0.5 text-[11px] text-mist">{fmtDateLong(e.date)}{e.location ? ` · ${e.location}` : ''}</p>
                    </div>
                    <Button variant="ghost" onClick={() => setDetail(e)}>Details</Button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ============ LIST VIEW ============ */}
      {view === 'list' && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-black/[0.02] text-left text-[11px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Event</th>
                <th className="px-3 py-3">Time</th>
                <th className="px-3 py-3">Location</th>
                <th className="px-3 py-3">Organizer</th>
                <th className="px-3 py-3">Seats</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((e) => {
                const past = isPastEvent(e)
                const pct = e.capacity ? Math.min(100, Math.round(((e.registered || 0) / e.capacity) * 100)) : null
                return (
                  <tr key={e.id} className="border-b border-line last:border-0 hover:bg-lime/[0.03]">
                    <td className="px-3 py-2.5"><DateTile date={e.date} past={past} /></td>
                    <td className="px-3 py-2.5">
                      <button className="flex items-center gap-2 text-left font-bold hover:text-lime" onClick={() => setDetail(e)}>
                        <span className="size-2 shrink-0 rounded-full" style={{ background: eventColor(e) }} /> {e.title}
                      </button>
                      <div className="mt-0.5"><CatChip e={e} /></div>
                    </td>
                    <td className="px-3 py-2.5 text-mist">{e.allDay ? 'All day' : fmtTime(e.time)}</td>
                    <td className="px-3 py-2.5 text-mist">{e.location || '—'}</td>
                    <td className="px-3 py-2.5 text-mist">{e.organizer || '—'}</td>
                    <td className="px-3 py-2.5">
                      {pct === null ? <span className="text-mist">—</span> : (
                        <div className="w-24">
                          <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: eventColor(e) }} />
                          </div>
                          <p className="mt-1 text-[10px] text-mist">{e.registered || 0}/{e.capacity} seats</p>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={past ? 'zinc' : 'lime'}>{past ? 'Past' : 'Upcoming'}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center justify-end gap-1">
                        <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => openEdit(e)}><Pencil className="size-4" /></button>
                        <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(e)}><Trash2 className="size-4" /></button>
                      </span>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-mist">No events yet. Click “New event” to schedule your first one.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ============ EVENT DETAIL MODAL ============ */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Event details" wide>
        {detail && (
          <div className="space-y-4">
            {detail.featuredImage && <img src={detail.featuredImage} alt="" className="h-44 w-full rounded-xl object-cover" />}
            <div className="flex flex-wrap items-start gap-3">
              <DateTile date={detail.date} past={isPastEvent(detail)} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-extrabold">{detail.title}</h3>
                  <CatChip e={detail} />
                  <Badge tone={isPastEvent(detail) ? 'zinc' : 'lime'}>{isPastEvent(detail) ? 'Past' : 'Upcoming'}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-mist">{fmtDateLong(detail.date)}</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <p className="flex items-center gap-2 text-sm"><Clock className="size-4 text-mist" /> {detail.allDay ? 'All day' : `${fmtTime(detail.time)}${detail.endTime ? ` – ${fmtTime(detail.endTime)}` : ''}`}</p>
              <p className="flex items-center gap-2 text-sm"><MapPin className="size-4 text-mist" /> {detail.location || 'Location TBA'}</p>
              <p className="flex items-center gap-2 text-sm"><User className="size-4 text-mist" /> {detail.organizer || 'Organizer TBA'}</p>
              <p className="flex items-center gap-2 text-sm"><Ticket className="size-4 text-mist" /> {detail.price ? `GHS ${detail.price}` : 'Free'}</p>
            </div>
            {!!detail.capacity && (
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-mist">
                  <span className="flex items-center gap-1"><Users className="size-3.5" /> Registrations</span>
                  <span className="font-bold text-ink">{detail.registered || 0} / {detail.capacity}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round(((detail.registered || 0) / detail.capacity) * 100))}%`, background: eventColor(detail) }} />
                </div>
              </div>
            )}
            {detail.description && <p className="whitespace-pre-line rounded-xl border border-line p-3 text-sm text-mist">{detail.description}</p>}
            {detail.registrationLink && (
              <a href={detail.registrationLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-lime hover:underline">
                <Link2 className="size-4" /> Registration link
              </a>
            )}
            <div className="flex gap-2 border-t border-line pt-3">
              <Button onClick={() => openEdit(detail)}><Pencil className="size-4" /> Edit</Button>
              <Button variant="danger" onClick={() => setDeleting(detail)}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ============ CREATE / EDIT MODAL ============ */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit event' : 'New event'} wide>
        {editing && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Event title" required className="sm:col-span-2">
                <Input value={editing.form.title} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, title: e.target.value } })} placeholder="e.g. Annual Fitness Challenge" />
              </Field>
              <Field label="Category">
                <Select value={editing.form.category} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, category: e.target.value } })}>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </Select>
              </Field>
              <Field label="Colour (optional override)">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editing.form.color || catMeta(editing.form.category).color}
                    onChange={(e) => setEditing({ ...editing, form: { ...editing.form, color: e.target.value } })}
                    className="h-[42px] w-14 cursor-pointer rounded-lg border border-line bg-transparent p-1"
                    aria-label="Event colour"
                  />
                  <Button variant="ghost" onClick={() => setEditing({ ...editing, form: { ...editing.form, color: '' } })}>Use category colour</Button>
                </div>
              </Field>
              <Field label="Date" required>
                <Input type="date" value={editing.form.date} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, date: e.target.value } })} />
              </Field>
              <Field label="All day">
                <div className="flex h-[42px] items-center">
                  <Switch checked={editing.form.allDay} onChange={(v) => setEditing({ ...editing, form: { ...editing.form, allDay: v } })} aria-label="All day event" />
                </div>
              </Field>
              {!editing.form.allDay && (
                <>
                  <Field label="Start time">
                    <Input type="time" value={editing.form.time} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, time: e.target.value } })} />
                  </Field>
                  <Field label="End time">
                    <Input type="time" value={editing.form.endTime} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, endTime: e.target.value } })} />
                  </Field>
                </>
              )}
              <Field label="Location">
                <Input value={editing.form.location} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, location: e.target.value } })} placeholder="e.g. Main Studio" />
              </Field>
              <Field label="Organizer">
                <Input value={editing.form.organizer} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, organizer: e.target.value } })} placeholder="e.g. Coach Ama" />
              </Field>
              <Field label="Capacity (seats)">
                <Input type="number" min={0} value={editing.form.capacity} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, capacity: e.target.value } })} placeholder="Optional" />
              </Field>
              <Field label="Registered">
                <Input type="number" min={0} value={editing.form.registered} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, registered: e.target.value } })} placeholder="Optional" />
              </Field>
              <Field label="Price (GHS, blank = free)">
                <Input type="number" min={0} value={editing.form.price} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, price: e.target.value } })} placeholder="0 = Free" />
              </Field>
              <Field label="Registration link">
                <Input value={editing.form.registrationLink} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, registrationLink: e.target.value } })} placeholder="https://…" />
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <Textarea value={editing.form.description} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, description: e.target.value } })} placeholder="please provide description" className="placeholder:italic placeholder:text-rose-400" />
              </Field>
              <Field label="Featured image" className="sm:col-span-2">
                {editing.form.featuredImage ? (
                  <div className="flex items-center gap-2">
                    <img src={editing.form.featuredImage} alt="" className="h-16 w-24 rounded-lg object-cover" />
                    <label className="cursor-pointer rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5">Replace<input type="file" accept="image/*" className="hidden" onChange={onImage} /></label>
                    <button className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ember" onClick={() => setEditing({ ...editing, form: { ...editing.form, featuredImage: '' } })}>Remove</button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line px-3 py-4 text-xs text-mist hover:border-lime/50">
                    <ImageIcon className="size-4" /> Click to upload<input type="file" accept="image/*" className="hidden" onChange={onImage} />
                  </label>
                )}
              </Field>
            </div>
            {err && <p className="mt-3 text-sm text-ember">{err}</p>}
            <Button className="mt-4 w-full" onClick={save}>{editing.id ? 'Save changes' : 'Create event'}</Button>
          </>
        )}
      </Modal>

      {/* ============ DAY OVERFLOW MODAL ============ */}
      <Modal open={!!dayOpen} onClose={() => setDayOpen(null)} title={dayOpen ? `Events · ${fmtDateLong(dayOpen)}` : ''}>
        <div className="space-y-2">
          {dayEvents.map((e) => (
            <button key={e.id} onClick={() => { setDayOpen(null); setDetail(e) }} className="flex w-full items-center gap-2.5 rounded-xl border border-line p-2.5 text-left hover:border-lime/50">
              <span className="size-2.5 rounded-full" style={{ background: eventColor(e) }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{e.title}</p>
                <p className="text-[11px] text-mist">{e.allDay ? 'All day' : fmtTime(e.time)}{e.location ? ` · ${e.location}` : ''}</p>
              </div>
              <CatChip e={e} />
            </button>
          ))}
          <Button variant="ghost" className="w-full" onClick={() => { const d = dayOpen; setDayOpen(null); openCreate(d || undefined) }}>
            <Plus className="size-4" /> Add event on this day
          </Button>
        </div>
      </Modal>

      {/* ============ DELETE CONFIRM ============ */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete event?">
        {deleting && (
          <>
            <p className="flex items-start gap-2 text-sm text-mist">
              <Tag className="mt-0.5 size-4 shrink-0" />
              Delete <span className="font-semibold text-inherit">{deleting.title}</span> ({fmtDateLong(deleting.date)})? This cannot be undone.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={doDelete}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
