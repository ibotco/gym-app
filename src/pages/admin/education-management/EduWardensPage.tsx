import { useEffect, useMemo, useState } from 'react'
import { Building2, Pencil, Plus, UserRound } from 'lucide-react'
import { DataTable, type Column } from '../../../components/DataTable'
import { Badge, Button, Field, Input, Modal, PageHeader, SearchInput, Select, StatCard } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useI18n } from '../../../context/I18nContext'
import { useToast } from '../../../context/ToastContext'
import { loadEduRecords, saveEduRecords, type EduRecords, type EduRow } from '../../../lib/eduRecords'
import {
  activeWardenPeriod,
  normalizeWardenName,
  parseWardenNames,
  syncCurrentHostelWardenFields,
  teachingWardensForBranch,
  wardenAssignmentIsActive,
  type WardenAssignment,
} from '../../../lib/eduWardens'
import { uid } from '../../../lib/utils'

type WardenDirectoryRow = {
  id: string
  assignmentId: string
  legacy: boolean
  wardenId: string
  wardenName: string
  employeeNumber: string
  designation: string
  department: string
  hostelId: string
  hostelName: string
  academicYearId: string
  academicYear: string
  sessionId: string
  session: string
  startDate: string
  status: string
  endDate: string
  endReason: string
  hrMatched: boolean
}

type AssignmentDraft = {
  id?: string
  legacy?: boolean
  wardenId: string
  wardenName: string
  hostelId: string
  hostelName: string
  academicYearId: string
  sessionId: string
  startDate: string
  status: 'Active' | 'Ended'
  endDate: string
  endReason: string
}

const todayISO = () => new Date().toISOString().slice(0, 10)

export function EduWardensPage() {
  const { activeBranchId, branches, staff, users } = useApp()
  const { t } = useI18n()
  const toast = useToast()
  const branchName = branches.find((branch) => branch.id === activeBranchId)?.name
  const [records, setRecords] = useState<EduRecords>(() => loadEduRecords(activeBranchId))
  const [query, setQuery] = useState('')
  const [yearFilter, setYearFilter] = useState('all')
  const [sessionFilter, setSessionFilter] = useState('all')
  const [draft, setDraft] = useState<AssignmentDraft | null>(null)

  useEffect(() => {
    const loaded = loadEduRecords(activeBranchId)
    setRecords(loaded)
    setQuery('')
    setSessionFilter('all')
    setYearFilter(activeWardenPeriod(loaded)?.academicYearId || 'all')
    setDraft(null)
  }, [activeBranchId])

  const academicYears = records.academicYear ?? []
  const sessions = records.termSemester ?? []
  const hostels = records.hostelList ?? []
  const teachingStaff = useMemo(
    () => teachingWardensForBranch(staff, users, activeBranchId),
    [staff, users, activeBranchId],
  )
  const assignments = (records.wardenAssignments ?? []) as WardenAssignment[]

  const rows = useMemo<WardenDirectoryRow[]>(() => {
    const staffById = new Map(teachingStaff.map((employee) => [employee.id, employee]))
    const currentPeriod = activeWardenPeriod(records)
    const explicitRows: WardenDirectoryRow[] = assignments.map((assignment) => {
      const person = staffById.get(String(assignment.wardenId ?? ''))
        || teachingStaff.find((employee) => normalizeWardenName(employee.name) === normalizeWardenName(String(assignment.wardenName ?? '')))
      const currentHostel = hostels.find((hostel) => hostel.id === assignment.hostelId)
      return {
        id: assignment.id,
        assignmentId: assignment.id,
        legacy: false,
        wardenId: String(assignment.wardenId ?? ''),
        wardenName: String(person?.name || assignment.wardenName || 'Unknown staff member'),
        employeeNumber: String(person?.employeeNumber || ''),
        designation: String(person?.designation || ''),
        department: String(person?.department || ''),
        hostelId: String(assignment.hostelId ?? ''),
        hostelName: String(currentHostel?.hostelName || assignment.hostelName || 'Deleted hostel'),
        academicYearId: String(assignment.academicYearId ?? ''),
        academicYear: String(assignment.academicYear || ''),
        sessionId: String(assignment.sessionId ?? ''),
        session: String(assignment.session || ''),
        startDate: String(assignment.startDate || ''),
        status: String(assignment.status || 'Active'),
        endDate: String(assignment.endDate || ''),
        endReason: String(assignment.endReason || ''),
        hrMatched: Boolean(person),
      }
    })

    const legacyRows: WardenDirectoryRow[] = []
    for (const hostel of hostels) {
      const alreadyPeriodizedNames = new Set(assignments
        .filter((assignment) => assignment.hostelId === hostel.id
          && Boolean(currentPeriod)
          && assignment.academicYearId === currentPeriod?.academicYearId
          && (!assignment.sessionId || (Boolean(currentPeriod?.sessionId) && assignment.sessionId === currentPeriod?.sessionId)))
        .map((assignment) => normalizeWardenName(String(assignment.wardenName ?? ''))))
      for (const name of parseWardenNames(hostel.warden)) {
        const normalized = normalizeWardenName(name)
        if (!normalized || alreadyPeriodizedNames.has(normalized)) continue
        const person = teachingStaff.find((employee) => normalizeWardenName(employee.name) === normalized)
        legacyRows.push({
          id: `legacy:${hostel.id}:${normalized}`,
          assignmentId: '',
          legacy: true,
          wardenId: String(person?.id || ''),
          wardenName: person?.name || name,
          employeeNumber: String(person?.employeeNumber || ''),
          designation: String(person?.designation || ''),
          department: String(person?.department || ''),
          hostelId: hostel.id,
          hostelName: String(hostel.hostelName || 'Unnamed hostel'),
          academicYearId: '',
          academicYear: '',
          sessionId: '',
          session: '',
          startDate: '',
          status: 'Legacy',
          endDate: '',
          endReason: 'This Hostel form assignment has no academic year/session recorded yet.',
          hrMatched: Boolean(person),
        })
      }
    }
    return [...explicitRows, ...legacyRows]
      .sort((a, b) => a.wardenName.localeCompare(b.wardenName, undefined, { sensitivity: 'base' })
        || a.hostelName.localeCompare(b.hostelName, undefined, { sensitivity: 'base' }))
  }, [assignments, hostels, records, teachingStaff])

  const sessionOptions = useMemo(() => {
    if (yearFilter === 'legacy') return []
    if (yearFilter === 'all') return sessions
    const selectedYear = academicYears.find((year) => year.id === yearFilter)
    return sessions.filter((session) => String(session.academicYear ?? '') === String(selectedYear?.name ?? ''))
  }, [academicYears, sessions, yearFilter])

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return rows.filter((row) => {
      if (yearFilter === 'legacy' && !row.legacy) return false
      const activeYearId = activeWardenPeriod(records)?.academicYearId
      const isCurrentLegacy = row.legacy && yearFilter === activeYearId
      if (yearFilter !== 'all' && yearFilter !== 'legacy' && row.academicYearId !== yearFilter && !isCurrentLegacy) return false
      if (sessionFilter === 'yearwide' && (row.legacy || row.sessionId)) return false
      if (sessionFilter !== 'all' && sessionFilter !== 'yearwide') {
        const selectedSession = sessions.find((session) => session.id === sessionFilter)
        const selectedYear = academicYears.find((year) => year.name === selectedSession?.academicYear)
        if (selectedYear && row.academicYearId !== selectedYear.id) return false
        if (row.sessionId && row.sessionId !== sessionFilter) return false
      }
      if (!needle) return true
      return [row.wardenName, row.employeeNumber, row.designation, row.department, row.hostelName, row.academicYear, row.session, row.endReason]
        .some((value) => value.toLocaleLowerCase().includes(needle))
    })
  }, [academicYears, query, records, rows, sessionFilter, sessions, yearFilter])

  const openAdd = () => {
    const activePeriod = activeWardenPeriod(records)
    setDraft({
      wardenId: '',
      wardenName: '',
      hostelId: '',
      hostelName: '',
      academicYearId: activePeriod?.academicYearId || '',
      sessionId: activePeriod?.sessionId || '',
      startDate: todayISO(),
      status: 'Active',
      endDate: '',
      endReason: '',
    })
  }

  const openEdit = (row: WardenDirectoryRow) => {
    if (row.legacy) {
      if (!row.hrMatched || !row.wardenId) {
        toast.error('This saved name is not a current Human Resource teaching staff member and cannot be periodized.')
        return
      }
      const activePeriod = activeWardenPeriod(records)
      setDraft({
        legacy: true,
        wardenId: row.wardenId,
        wardenName: row.wardenName,
        hostelId: row.hostelId,
        hostelName: row.hostelName,
        academicYearId: activePeriod?.academicYearId || '',
        sessionId: activePeriod?.sessionId || '',
        startDate: todayISO(),
        status: 'Active',
        endDate: '',
        endReason: '',
      })
      return
    }
    setDraft({
      id: row.assignmentId,
      wardenId: row.wardenId,
      wardenName: row.wardenName,
      hostelId: row.hostelId,
      hostelName: row.hostelName,
      academicYearId: row.academicYearId,
      sessionId: row.sessionId,
      startDate: row.startDate,
      status: row.status.toLowerCase() === 'ended' ? 'Ended' : 'Active',
      endDate: row.endDate,
      endReason: row.endReason,
    })
  }

  const save = () => {
    if (!draft) return
    const academicYear = academicYears.find((year) => year.id === draft.academicYearId)
    const hostel = hostels.find((item) => item.id === draft.hostelId)
    const existing = draft.id ? assignments.find((assignment) => assignment.id === draft.id) : undefined
    const person = teachingStaff.find((employee) => employee.id === draft.wardenId)
    if (!academicYear) { toast.error('Select an Academic Year first.') ; return }
    if (!draft.hostelId || (!hostel && !existing?.hostelName)) { toast.error('Select a Hostel first.') ; return }
    if (!draft.wardenId || (!person && !existing?.wardenName)) { toast.error('Select a Human Resource teaching staff member.') ; return }
    if (draft.status === 'Active' && !draft.startDate) { toast.error('Enter the assignment start date.') ; return }
    if (draft.status === 'Ended' && (!draft.endDate || !draft.endReason.trim())) {
      toast.error('Enter an end date and reason before ending an assignment.')
      return
    }
    if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) {
      toast.error('The end date cannot be earlier than the start date.')
      return
    }

    const selectedSession = sessions.find((session) => session.id === draft.sessionId
      && String(session.academicYear ?? '') === String(academicYear.name ?? ''))
    const currentHostelName = String(hostel?.hostelName || existing?.hostelName || draft.hostelName || '')
    const currentWardenName = String(person?.name || existing?.wardenName || draft.wardenName || '')
    const overlaps = (sessionId: string, otherSessionId: string) => !sessionId || !otherSessionId || sessionId === otherSessionId
    const duplicate = draft.status === 'Active' && assignments.find((assignment) => assignment.id !== draft.id
      && wardenAssignmentIsActive(assignment)
      && assignment.hostelId === draft.hostelId
      && assignment.wardenId === draft.wardenId
      && assignment.academicYearId === academicYear.id
      && overlaps(String(assignment.sessionId ?? ''), String(selectedSession?.id ?? '')))
    if (duplicate) {
      toast.error('This teacher already has an active assignment for that Hostel and period.')
      return
    }

    const saved: WardenAssignment = {
      id: draft.id || uid('wa'),
      wardenId: draft.wardenId,
      wardenName: currentWardenName,
      hostelId: draft.hostelId,
      hostelName: currentHostelName,
      academicYearId: academicYear.id,
      academicYear: String(academicYear.name ?? ''),
      sessionId: String(selectedSession?.id ?? ''),
      session: String(selectedSession?.name ?? ''),
      startDate: draft.startDate || todayISO(),
      status: draft.status,
      endDate: draft.status === 'Ended' ? draft.endDate : '',
      endReason: draft.status === 'Ended' ? draft.endReason.trim() : '',
    }
    const nextAssignments = draft.id
      ? assignments.map((assignment) => assignment.id === draft.id ? saved : assignment)
      : [...assignments, saved]
    const nextRecords: EduRecords = { ...records, wardenAssignments: nextAssignments }
    const syncedRecords = syncCurrentHostelWardenFields(nextRecords, activeWardenPeriod(nextRecords))
    setRecords(syncedRecords)
    saveEduRecords(activeBranchId, syncedRecords)
    toast.success(draft.id ? 'Warden assignment updated' : 'Warden assigned', `${currentWardenName} — ${currentHostelName}`)
    setDraft(null)
  }

  const columns = useMemo<Column<WardenDirectoryRow>[]>(() => [
    {
      key: 'academicYear',
      header: 'Academic year',
      sortValue: (row) => row.legacy ? '' : row.academicYear,
      render: (row) => row.legacy ? <Badge tone="amber">Unscoped</Badge> : row.academicYear || <span className="text-mist">—</span>,
    },
    {
      key: 'session',
      header: 'Session / term',
      sortValue: (row) => row.session || 'Full academic year',
      render: (row) => row.legacy ? <span className="text-mist">—</span> : row.session || 'Full academic year',
    },
    {
      key: 'hostel',
      header: 'Hostel',
      sortValue: (row) => row.hostelName,
      render: (row) => row.hostelName,
    },
    {
      key: 'warden',
      header: 'Warden',
      sortValue: (row) => row.wardenName,
      render: (row) => (
        <div>
          <p className="font-semibold">{row.wardenName}</p>
          {row.employeeNumber && <p className="mt-0.5 text-xs text-mist">Staff no. {row.employeeNumber}</p>}
          {!row.hrMatched && !row.legacy && <p className="mt-0.5 text-xs text-amber-600">No longer in active HR teaching staff</p>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (row) => row.legacy ? 'Legacy' : row.status,
      render: (row) => row.legacy
        ? <Badge tone="amber">Unscoped legacy</Badge>
        : row.status.toLowerCase() === 'active'
          ? <Badge tone="lime">Active</Badge>
          : <Badge tone="zinc">Ended</Badge>,
    },
    {
      key: 'startDate',
      header: 'Start date',
      sortValue: (row) => row.startDate,
      render: (row) => row.startDate || <span className="text-mist">—</span>,
    },
    {
      key: 'end',
      header: 'End date / reason',
      sortValue: (row) => `${row.endDate} ${row.endReason}`,
      render: (row) => row.endDate || row.endReason
        ? <div><p>{row.endDate || '—'}</p>{row.endReason && <p className="mt-0.5 text-xs text-mist">{row.endReason}</p>}</div>
        : <span className="text-mist">—</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <Button variant="ghost" size="sm" disabled={row.legacy && !row.hrMatched} onClick={() => openEdit(row)} title={row.legacy ? 'Add an academic period to this legacy assignment' : 'Edit assignment'}>
          <Pencil className="size-3.5" /> {row.legacy ? 'Set period' : 'Edit'}
        </Button>
      ),
    },
  ], [openEdit])

  const activeCount = filteredRows.filter((row) => row.legacy || row.status.toLowerCase() === 'active').length
  const assignedHostelCount = new Set(filteredRows.filter((row) => row.legacy || row.status.toLowerCase() === 'active').map((row) => row.hostelId)).size
  const canAdd = academicYears.length > 0 && hostels.length > 0 && teachingStaff.length > 0
  const selectedYear = academicYears.find((year) => year.id === draft?.academicYearId)
  const modalSessions = sessions.filter((session) => String(session.academicYear ?? '') === String(selectedYear?.name ?? ''))
  const modalExisting = Boolean(draft?.id)
  const modalTitle = draft?.id ? 'Edit Warden Assignment' : draft?.legacy ? 'Add Period to Warden Assignment' : 'Add Warden Assignment'

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-1 text-xs text-mist">
        <span>Administration</span><span>/</span><span>Education Management</span><span>/</span>
        <span>{t('nav.eduStudentAccommodation')}</span><span>/</span>
        <span className="font-semibold text-inherit">{t('nav.eduWardens')}</span>
      </div>
      <PageHeader
        title={t('nav.eduWardens')}
        desc={`Warden assignments by Academic Year and session${branchName ? ` · ${branchName}` : ''}.`}
        actions={(
          <Button size="sm" onClick={openAdd} disabled={!canAdd}>
            <Plus className="size-4" /> Add Warden
          </Button>
        )}
      />

      <div className="card mb-4 flex flex-wrap items-start justify-between gap-3 p-4">
        <div>
          <p className="font-semibold">Assignment history</p>
          <p className="mt-1 text-sm text-mist">Each assignment is one HR teaching staff member. To replace a warden, end the previous assignment with a date and reason, then add the replacement. Multiple wardens can be active for one hostel.</p>
        </div>
        <Badge tone="sky">HR teaching staff</Badge>
      </div>

      {!academicYears.length && (
        <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          Add an Academic Year under Education Management → Academic before assigning wardens.
        </div>
      )}
      {!hostels.length && (
        <div className="mb-4 rounded-xl border border-sky-400/30 bg-sky-400/10 p-3 text-sm text-sky-800 dark:text-sky-200">
          Add a Hostel under Student Accommodation before creating a warden assignment.
        </div>
      )}
      {!teachingStaff.length && (
        <div className="mb-4 rounded-xl border border-sky-400/30 bg-sky-400/10 p-3 text-sm text-sky-800 dark:text-sky-200">
          No Human Resource teaching staff are available for the active branch.
        </div>
      )}

      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <StatCard label="Active assignments in view" value={String(activeCount)} hint="Includes unscoped legacy assignments" icon={<UserRound className="size-4" />} />
        <StatCard label="Hostels with an active warden" value={String(assignedHostelCount)} hint="For the selected year/session" icon={<Building2 className="size-4" />} />
      </div>

      <div className="card mb-3 p-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(220px,1.2fr)]">
          <Field label="Academic year">
            <Select value={yearFilter} onChange={(event) => { setYearFilter(event.target.value); setSessionFilter('all') }}>
              <option value="all">All academic years</option>
              {rows.some((row) => row.legacy) && <option value="legacy">Unscoped / legacy</option>}
              {academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </Select>
          </Field>
          <Field label="Session / term">
            <Select value={sessionFilter} disabled={yearFilter === 'legacy'} onChange={(event) => setSessionFilter(event.target.value)}>
              <option value="all">All sessions</option>
              {yearFilter !== 'legacy' && <option value="yearwide">Full academic year only</option>}
              {sessionOptions.map((session) => {
                const sessionYear = academicYears.find((year) => year.name === session.academicYear)?.name
                return <option key={session.id} value={session.id}>{session.name}{yearFilter === 'all' && sessionYear ? ` — ${sessionYear}` : ''}</option>
              })}
            </Select>
          </Field>
          <Field label="Search assignments">
            <SearchInput value={query} onChange={setQuery} placeholder="Warden, hostel, year, or reason…" className="w-full" />
          </Field>
        </div>
      </div>

      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredRows}
          rowKey={(row) => row.id}
          emptyTitle={query.trim() ? 'No matching assignments' : 'No warden assignments'}
          emptyDesc={query.trim()
            ? 'Try a different search or adjust the Academic Year and Session filters.'
            : 'Use Add Warden to create a period-specific assignment. Existing Hostel Warden values appear as unscoped legacy rows until they are periodized.'}
        />
      </div>

      <Modal open={!!draft} onClose={() => setDraft(null)} title={modalTitle} wide>
        {draft && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Academic Year" required>
              <Select
                value={draft.academicYearId}
                disabled={modalExisting}
                onChange={(event) => {
                  const nextYearId = event.target.value
                  const year = academicYears.find((item) => item.id === nextYearId)
                  const activeSession = sessions.find((session) => session.academicYear === year?.name && session.status === 'Active')
                  setDraft((current) => current ? { ...current, academicYearId: nextYearId, sessionId: activeSession?.id || '' } : current)
                }}
                placeholder="Select Academic Year…"
              >
                {academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}{year.status === 'Active' ? ' (Active)' : ''}</option>)}
              </Select>
            </Field>
            <Field label="Term / Semester" hint="Optional — leave blank to cover the full Academic Year.">
              <Select
                value={draft.sessionId}
                disabled={modalExisting || !draft.academicYearId}
                onChange={(event) => setDraft((current) => current ? { ...current, sessionId: event.target.value } : current)}
              >
                <option value="">Full Academic Year</option>
                {modalSessions.map((session) => <option key={session.id} value={session.id}>{session.name}{session.status === 'Active' ? ' (Active)' : ''}</option>)}
              </Select>
            </Field>
            <Field label="Hostel" required>
              <Select
                value={draft.hostelId}
                disabled={modalExisting}
                onChange={(event) => {
                  const hostel = hostels.find((item) => item.id === event.target.value)
                  setDraft((current) => current ? { ...current, hostelId: event.target.value, hostelName: String(hostel?.hostelName ?? '') } : current)
                }}
                placeholder="Select Hostel…"
              >
                {draft.id && !hostels.some((hostel) => hostel.id === draft.hostelId) && (
                  <option value={draft.hostelId}>{draft.hostelName || 'Previously assigned hostel'} (no longer listed)</option>
                )}
                {hostels.map((hostel) => <option key={hostel.id} value={hostel.id}>{hostel.hostelName}</option>)}
              </Select>
            </Field>
            <Field label="Warden" required hint={modalExisting ? 'To replace this person, end this assignment and add a new one.' : 'One teacher per assignment; add more wardens for shared coverage.'}>
              <Select
                value={draft.wardenId}
                disabled={modalExisting}
                onChange={(event) => {
                  const person = teachingStaff.find((employee) => employee.id === event.target.value)
                  setDraft((current) => current ? { ...current, wardenId: event.target.value, wardenName: person?.name || '' } : current)
                }}
                placeholder="Select HR teaching staff…"
              >
                {draft.wardenId && !teachingStaff.some((person) => person.id === draft.wardenId) && (
                  <option value={draft.wardenId}>{draft.wardenName || 'Previously assigned staff member'} (not in active HR list)</option>
                )}
                {teachingStaff.map((person) => <option key={person.id} value={person.id}>{person.name}{person.employeeNumber ? ` · ${person.employeeNumber}` : ''}</option>)}
              </Select>
            </Field>
            <Field label="Start date" required>
              <Input type="date" value={draft.startDate} onChange={(event) => setDraft((current) => current ? { ...current, startDate: event.target.value } : current)} />
            </Field>
            <Field label="Assignment status" required>
              <Select
                value={draft.status}
                onChange={(event) => setDraft((current) => current ? {
                  ...current,
                  status: event.target.value as AssignmentDraft['status'],
                  endDate: event.target.value === 'Active' ? '' : current.endDate,
                  endReason: event.target.value === 'Active' ? '' : current.endReason,
                } : current)}
              >
                <option value="Active">Active</option>
                <option value="Ended">Ended / transferred / stopped</option>
              </Select>
            </Field>
            {draft.status === 'Ended' && (
              <>
                <Field label="End date" required>
                  <Input type="date" value={draft.endDate} onChange={(event) => setDraft((current) => current ? { ...current, endDate: event.target.value } : current)} />
                </Field>
                <Field label="Reason assignment ended" required hint="Enter Transferred, Stopped, or any other reason.">
                  <Input value={draft.endReason} onChange={(event) => setDraft((current) => current ? { ...current, endReason: event.target.value } : current)} placeholder="e.g. Transferred to another school" />
                </Field>
              </>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <Button className="flex-1" onClick={save}>{draft.id ? 'Save changes' : 'Assign Warden'}</Button>
              <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
