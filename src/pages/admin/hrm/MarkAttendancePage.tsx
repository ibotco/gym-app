import { useMemo, useState } from 'react'
import { UserCheck, UserX, Clock, CalendarClock, PlaneTakeoff, CheckCircle2, Search, ListChecks, Save, X } from 'lucide-react'
import { PageHeader, Button, Badge, Input, Select, DatePicker, StatCard, Empty } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import { visibleBranches } from '../../../lib/accessScope'
import type { StaffAttendance, StaffAttendanceStatus } from '../../../types'

const STATUS_META: { id: StaffAttendanceStatus; label: string; color: string }[] = [
  { id: 'present', label: 'Present', color: '#22c55e' },
  { id: 'late', label: 'Late', color: '#f59e0b' },
  { id: 'absent', label: 'Absent', color: '#ef4444' },
  { id: 'leave', label: 'On leave', color: '#0ea5e9' },
]

type Draft = {
  status: StaffAttendanceStatus
  checkIn: string
  checkOut: string
  notes: string
  savedId?: string
  touched: boolean
}

export function MarkAttendancePage() {
  const app = useApp()
  const { staff, users, branches, staffAttendance, activeBranchId, activeCompanyId, upsertStaffAttendance, log } = app
  const { user } = useAuth()
  const toast = useToast()

  const branchOptions = useMemo(
    () => visibleBranches(user, branches, activeCompanyId).filter((b) => b.status !== 'inactive'),
    [user, branches, activeCompanyId],
  )

  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [branchId, setBranchId] = useState(activeBranchId || branchOptions[0]?.id || '')
  const [query, setQuery] = useState('')
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [draftKey, setDraftKey] = useState('')

  const userName = (id: string) => users.find((u) => u.id === id)?.name || id
  const initials = (name: string) =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'

  // Roster for the selected branch.
  const roster = useMemo(() => {
    const q = query.trim().toLowerCase()
    return staff
      .filter((s) => s.branchId === branchId)
      .filter((s) => !q || userName(s.userId).toLowerCase().includes(q) || (s.title || '').toLowerCase().includes(q))
  }, [staff, branchId, query, users])

  // Rebuild drafts whenever the date/branch changes: seed from saved records.
  const key = `${date}|${branchId}`
  if (key !== draftKey) {
    const seeded: Record<string, Draft> = {}
    for (const rec of staffAttendance) {
      if (rec.date === date && (!rec.branchId || rec.branchId === branchId)) {
        seeded[rec.staffUserId] = {
          status: rec.status,
          checkIn: rec.checkIn || '',
          checkOut: rec.checkOut || '',
          notes: rec.notes || '',
          savedId: rec.id,
          touched: false,
        }
      }
    }
    setDrafts(seeded)
    setDraftKey(key)
  }

  const setDraft = (userId: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] || { status: 'present', checkIn: '', checkOut: '', notes: '' }), ...patch, touched: true },
    }))

  const markAllPresent = () => {
    setDrafts((prev) => {
      const next = { ...prev }
      for (const s of roster) {
        if (!next[s.userId]) next[s.userId] = { status: 'present', checkIn: '', checkOut: '', notes: '', touched: true }
      }
      return next
    })
  }

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, leave: 0, unmarked: 0 }
    for (const s of roster) {
      const d = drafts[s.userId]
      if (!d) c.unmarked += 1
      else c[d.status] += 1
    }
    return c
  }, [roster, drafts])

  const dirty = useMemo(
    () => Object.values(drafts).filter((d) => d.touched).length,
    [drafts],
  )

  const save = () => {
    if (!branchId) {
      toast.error('Select a branch first.', 'Mark Attendance')
      return
    }
    const entries = Object.entries(drafts).filter(([, d]) => d.touched)
    if (!entries.length) {
      toast.error('Nothing to save — mark attendance first.', 'Mark Attendance')
      return
    }
    let created = 0
    for (const [userId, d] of entries) {
      const attended = d.status === 'present' || d.status === 'late'
      const rec: StaffAttendance = {
        id: d.savedId || uid('sa'),
        staffUserId: userId,
        date,
        checkIn: attended ? d.checkIn || undefined : undefined,
        checkOut: attended ? d.checkOut || undefined : undefined,
        status: d.status,
        branchId: branchId || undefined,
        notes: d.notes.trim() || undefined,
      }
      upsertStaffAttendance(rec)
      log(user?.id || 'system', d.savedId ? 'UPDATE' : 'CREATE', 'Staff Attendance', `Marked ${userName(userId)} — ${rec.status} (${date})`)
      if (!d.savedId) created += 1
    }
    setDrafts((prev) => {
      const next: Record<string, Draft> = {}
      for (const [userId, d] of Object.entries(prev)) {
        next[userId] = { ...d, touched: false, savedId: d.savedId || `sa_pending_${userId}_${date}` }
      }
      return next
    })
    toast.success(
      `Attendance saved for ${date}`,
      `${entries.length} record${entries.length === 1 ? '' : 's'} (${created} new, ${entries.length - created} updated)`,
    )
  }

  const statusColor = (s?: StaffAttendanceStatus) => STATUS_META.find((m) => m.id === s)?.color

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mark Attendance"
        desc="Take daily attendance for a branch roster — mark each employee present, late, absent, or on leave."
      />

      <div className="card p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-mist">Date</span>
            <div className="mt-1">
              <DatePicker value={date} onChange={setDate} />
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-mist">Branch</span>
            <Select className="mt-1" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Select branch…</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Present" value={String(counts.present)} icon={<UserCheck className="size-4" />} />
        <StatCard label="Late" value={String(counts.late)} icon={<Clock className="size-4" />} />
        <StatCard label="Absent" value={String(counts.absent)} icon={<UserX className="size-4" />} />
        <StatCard label="On leave" value={String(counts.leave)} icon={<PlaneTakeoff className="size-4" />} />
        <StatCard label="Unmarked" value={String(counts.unmarked)} icon={<CalendarClock className="size-4" />} />
      </div>

      {!branchId ? (
        <div className="card">
          <Empty title="Select a branch" desc="Pick the branch whose roster you want to mark attendance for." />
        </div>
      ) : (
        <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="group relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist transition-colors group-focus-within:text-[#c8f542]" />
            <Input
              style={{ borderRadius: 999, paddingLeft: 44, paddingRight: 104 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or title…"
              aria-label="Search employee"
            />
            {query.trim() !== '' && (
              <span className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                <span className="rounded-full bg-[#c8f542]/15 px-2 py-0.5 text-[11px] font-bold text-[#c8f542]">
                  {roster.length} match{roster.length === 1 ? '' : 'es'}
                </span>
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="grid size-6 place-items-center rounded-full text-mist transition hover:bg-line/60 hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm text-mist">
              {roster.length} employee{roster.length === 1 ? '' : 's'} on this roster
              {dirty ? ` · ${dirty} unsaved change${dirty === 1 ? '' : 's'}` : ''}
            </span>
            <Button onClick={markAllPresent} variant="ghost">
              <ListChecks className="size-4" /> Mark all present
            </Button>
            <Button onClick={save} variant="primary">
              <Save className="size-4" /> Save attendance{dirty ? ` (${dirty})` : ''}
            </Button>
          </div>
        </div>
        {roster.length ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-mist">
                <th className="px-4 py-3 font-semibold">Employee</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Check in</th>
                <th className="px-4 py-3 font-semibold">Check out</th>
                <th className="px-4 py-3 font-semibold">Notes</th>
                <th className="px-4 py-3 font-semibold">Record</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((s) => {
                const name = userName(s.userId)
                const d = drafts[s.userId]
                const attended = d?.status === 'present' || d?.status === 'late'
                return (
                  <tr key={s.id} className="border-b border-line/60 align-middle last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                          style={{ background: statusColor(d?.status) || '#64748b' }}
                        >
                          {initials(name)}
                        </span>
                        <div>
                          <p className="font-semibold">{name}</p>
                          <p className="text-xs text-mist">
                            {[s.title, s.department].filter(Boolean).join(' · ') || '—'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {STATUS_META.map((m) => {
                          const active = d?.status === m.id
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() =>
                                setDraft(s.userId, {
                                  status: m.id,
                                  checkIn: m.id === 'present' || m.id === 'late' ? d?.checkIn || '' : '',
                                  checkOut: m.id === 'present' || m.id === 'late' ? d?.checkOut || '' : '',
                                })
                              }
                              className="rounded-full px-3 py-1 text-xs font-semibold transition"
                              style={{
                                border: `1px solid ${active ? m.color : 'var(--color-line, #e5e7eb)'}`,
                                background: active ? `${m.color}1a` : 'transparent',
                                color: active ? m.color : undefined,
                              }}
                            >
                              {m.label}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="time"
                        style={{ width: 120 }}
                        value={d?.checkIn || ''}
                        disabled={!attended}
                        onChange={(e) => setDraft(s.userId, { checkIn: e.target.value })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="time"
                        style={{ width: 120 }}
                        value={d?.checkOut || ''}
                        disabled={!attended}
                        onChange={(e) => setDraft(s.userId, { checkOut: e.target.value })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        style={{ width: 192 }}
                        value={d?.notes || ''}
                        placeholder="Optional note…"
                        onChange={(e) => setDraft(s.userId, { notes: e.target.value })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {d?.touched ? (
                        <Badge tone="amber">Unsaved</Badge>
                      ) : d ? (
                        <Badge tone="lime">
                          <CheckCircle2 className="size-3" /> Saved
                        </Badge>
                      ) : (
                        <span className="text-xs text-mist">Not marked</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        ) : (
          <div className="card">
            <Empty title="No employees found" desc="No staff match this search on this branch. Clear the search to see the full roster." />
          </div>
        )}
        </div>
      )}
    </div>
  )
}

export default MarkAttendancePage
