import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, CheckCircle2, Clock3, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { Badge, Button, Field, Input, Modal, MultiSelect, PageHeader, SearchField, Select, StatCard, Textarea } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { loadEmployeeAppointments, saveEmployeeAppointments, type EmployeeAppointmentRecord, type EmployeeAppointmentStatus } from '../../../lib/employeeAppointments'
import { loadHrmRows } from '../../../lib/hrmSettings'
import { formatDate, uid } from '../../../lib/utils'
import type { StaffRecord } from '../../../types'

type AppointmentSetting = { name: string; status?: string; _order?: number }
type AppointmentForm = {
  staffRecordIds: string[]
  appointmentType: string
  effectiveDate: string
  endDate: string
  status: EmployeeAppointmentStatus
  notes: string
}

const emptyForm = (appointmentType = ''): AppointmentForm => ({
  staffRecordIds: [], appointmentType, effectiveDate: new Date().toISOString().slice(0, 10), endDate: '', status: 'Active', notes: '',
})

function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

function loadAppointmentTypes(companyId: string): AppointmentSetting[] {
  return loadHrmRows<AppointmentSetting>(companyId, 'appointment', [])
}

export function AppointmentsPage() {
  const { staff, users, activeCompanyId, activeBranchId, log } = useApp()
  const { user } = useAuth()
  const toast = useToast()
  const [storedRecords, setStoredRecords] = useState(() => ({
    companyId: activeCompanyId,
    rows: loadEmployeeAppointments(activeCompanyId),
  }))
  const [storedTypes, setStoredTypes] = useState(() => ({
    companyId: activeCompanyId,
    rows: loadAppointmentTypes(activeCompanyId),
  }))
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AppointmentForm>(() => emptyForm())
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<EmployeeAppointmentRecord | null>(null)

  useEffect(() => {
    setStoredRecords({ companyId: activeCompanyId, rows: loadEmployeeAppointments(activeCompanyId) })
    setStoredTypes({ companyId: activeCompanyId, rows: loadAppointmentTypes(activeCompanyId) })
  }, [activeCompanyId])

  const records = storedRecords.companyId === activeCompanyId ? storedRecords.rows : []
  const appointmentTypes = useMemo(() => (
    (storedTypes.companyId === activeCompanyId ? storedTypes.rows : [])
      .filter((item) => item.name.trim() && (item.status || 'Active') === 'Active')
      .sort((a, b) => (a._order ?? 0) - (b._order ?? 0) || a.name.localeCompare(b.name))
  ), [activeCompanyId, storedTypes])
  const employeeOptions = useMemo(() => staff.map((employee) => {
    const person = users.find((item) => item.id === employee.userId)
    const name = person?.name || employee.employeeNumber || employee.id
    const inactive = person ? person.status !== 'active' : false
    return {
      value: employee.id,
      label: `${name}${employee.employeeNumber ? ` · ${employee.employeeNumber}` : ''}${inactive ? ' (inactive)' : ''}`,
    }
  }).sort((a, b) => a.label.localeCompare(b.label)), [staff, users])
  const visibleRecords = useMemo(() => records.filter((record) => (
    (!record.companyId || record.companyId === activeCompanyId)
    && (!activeBranchId || !record.branchId || record.branchId === activeBranchId)
  )), [activeBranchId, activeCompanyId, records])

  const employeeFor = (record: EmployeeAppointmentRecord) => staff.find((item) => item.id === record.staffRecordId)
  const employeeName = (record: EmployeeAppointmentRecord) => {
    const employee = employeeFor(record)
    return users.find((person) => person.id === (employee?.userId || record.staffUserId))?.name
      || employee?.employeeNumber || record.employeeName || record.staffUserId
  }
  const employeeNumber = (record: EmployeeAppointmentRecord) => employeeFor(record)?.employeeNumber || record.employeeNumber || record.staffRecordId
  const employeeSummary = (employee: StaffRecord | undefined, fallback?: EmployeeAppointmentRecord) => {
    if (!employee) return fallback?.employeeNumber ? `Employee no. ${fallback.employeeNumber}` : 'Employee record unavailable'
    return [employee.title, employee.department].filter(Boolean).join(' · ') || 'Employee'
  }

  const query = search.trim().toLocaleLowerCase()
  const filteredRecords = useMemo(() => visibleRecords
    .filter((record) => !statusFilter || record.status === statusFilter)
    .filter((record) => !query || [
      employeeName(record), employeeNumber(record), record.appointmentType, record.notes || '',
    ].join(' ').toLocaleLowerCase().includes(query))
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || b.updatedAt.localeCompare(a.updatedAt)),
  [visibleRecords, statusFilter, query, staff, users])

  const activeCount = visibleRecords.filter((record) => record.status === 'Active').length
  const inactiveCount = visibleRecords.length - activeCount
  const exportRows = filteredRecords.map((record) => ({
    Employee: employeeName(record),
    'Employee no.': employeeNumber(record),
    'Appointment type': record.appointmentType,
    'Effective date': record.effectiveDate,
    'End date': record.endDate || '',
    Status: record.status,
    Notes: record.notes || '',
  }))

  const persistRecords = (next: EmployeeAppointmentRecord[]) => {
    setStoredRecords({ companyId: activeCompanyId, rows: next })
    saveEmployeeAppointments(activeCompanyId, next)
  }

  const beginNew = () => {
    setEditingId(null)
    setForm(emptyForm(appointmentTypes[0]?.name || ''))
    setFormError('')
    setFormOpen(true)
  }

  const beginEdit = (record: EmployeeAppointmentRecord) => {
    setEditingId(record.id)
    setForm({
      staffRecordIds: [record.staffRecordId],
      appointmentType: record.appointmentType,
      effectiveDate: record.effectiveDate,
      endDate: record.endDate || '',
      status: record.status === 'Inactive' ? 'Inactive' : 'Active',
      notes: record.notes || '',
    })
    setFormError('')
    setFormOpen(true)
  }

  const saveAppointment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const existing = editingId ? records.find((record) => record.id === editingId) : undefined
    const selectedStaffIds = [...new Set(form.staffRecordIds)]
    if (!selectedStaffIds.length) {
      setFormError('Select at least one employee.')
      return
    }
    if (existing && selectedStaffIds.length !== 1) {
      setFormError('An existing appointment record can only be edited for one employee.')
      return
    }
    if (existing && !staff.some((record) => record.id === selectedStaffIds[0]) && existing.staffRecordId !== selectedStaffIds[0]) {
      setFormError('Select an employee from the list.')
      return
    }
    if (!existing && selectedStaffIds.some((id) => !staff.some((record) => record.id === id))) {
      setFormError('Select employees from the current company and branch list.')
      return
    }
    if (!form.appointmentType.trim()) {
      setFormError('Select an appointment type.')
      return
    }
    const typeIsActive = appointmentTypes.some((item) => item.name === form.appointmentType)
    const keepingExistingLegacyType = Boolean(existing && existing.appointmentType === form.appointmentType)
    if (!typeIsActive && !keepingExistingLegacyType) {
      setFormError('Choose an active appointment type configured in HR Admin → Job Settings → Appointment.')
      return
    }
    if (!isValidDate(form.effectiveDate)) {
      setFormError('Enter a valid effective date.')
      return
    }
    if (form.endDate && (!isValidDate(form.endDate) || form.endDate < form.effectiveDate)) {
      setFormError('The end date must be valid and on or after the effective date.')
      return
    }

    const now = new Date().toISOString()
    const buildRecord = (staffRecordId: string, employee?: StaffRecord, previous?: EmployeeAppointmentRecord): EmployeeAppointmentRecord => {
      const staffUserId = employee?.userId || previous?.staffUserId || ''
      const person = users.find((item) => item.id === staffUserId)
      return {
        id: previous?.id || uid('appt'),
        companyId: activeCompanyId,
        branchId: employee
          ? (previous?.staffRecordId === employee.id ? previous.branchId : employee.branchId || activeBranchId || undefined)
          : previous?.branchId,
        staffRecordId: employee?.id || previous?.staffRecordId || staffRecordId,
        staffUserId,
        employeeName: person?.name || employee?.employeeNumber || previous?.employeeName || staffUserId,
        employeeNumber: employee?.employeeNumber || previous?.employeeNumber || employee?.id || '',
        appointmentType: form.appointmentType.trim(),
        effectiveDate: form.effectiveDate,
        endDate: form.endDate || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
        createdAt: previous?.createdAt || now,
        updatedAt: now,
      }
    }

    if (existing) {
      const staffRecordId = selectedStaffIds[0]
      const employee = staff.find((record) => record.id === staffRecordId)
      const appointment = buildRecord(staffRecordId, employee, existing)
      persistRecords(records.map((record) => record.id === existing.id ? appointment : record))
      log(user?.id || 'system', 'UPDATE', 'Employee Appointment', `Updated ${appointment.appointmentType} appointment for ${appointment.employeeName}`)
      toast.success('Appointment updated', appointment.employeeName)
    } else {
      const appointments = selectedStaffIds.map((staffRecordId) => {
        const employee = staff.find((record) => record.id === staffRecordId)
        return buildRecord(staffRecordId, employee)
      })
      persistRecords([...appointments, ...records])
      log(user?.id || 'system', 'CREATE', 'Employee Appointment', `Recorded ${form.appointmentType} appointments for ${appointments.length} employee${appointments.length === 1 ? '' : 's'}`)
      toast.success(appointments.length === 1 ? 'Appointment recorded' : 'Appointments recorded', `${appointments.length} employee${appointments.length === 1 ? '' : 's'}`)
    }
    setFormOpen(false)
    setEditingId(null)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    persistRecords(records.filter((record) => record.id !== deleteTarget.id))
    log(user?.id || 'system', 'DELETE', 'Employee Appointment', `Removed ${deleteTarget.appointmentType} appointment for ${deleteTarget.employeeName}`)
    toast.success('Appointment deleted', deleteTarget.employeeName)
    setDeleteTarget(null)
  }

  const canAdd = staff.length > 0 && appointmentTypes.length > 0

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span className="font-semibold text-inherit">Appointments</span>
      </div>
      <PageHeader
        title="Appointments"
        desc="Record and review employee appointments. Appointment types come from HR Admin → Job Settings → Appointment."
        actions={(
          <>
            <Button variant="ghost" onClick={() => window.print()}>Print</Button>
            <ExportButtons filename="employee-appointments" rows={exportRows} />
            <Button onClick={beginNew} disabled={!canAdd}><Plus className="size-4" /> Add appointment</Button>
          </>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Appointments" value={String(visibleRecords.length)} icon={<CalendarCheck className="size-4" />} />
        <StatCard label="Active" value={String(activeCount)} icon={<CheckCircle2 className="size-4" />} />
        <StatCard label="Inactive" value={String(inactiveCount)} icon={<Clock3 className="size-4" />} />
      </div>

      {!appointmentTypes.length && (
        <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          No active appointment types are configured. <Link className="font-bold underline" to="/admin/hrm/admin/appointment">Configure appointment types in HR Admin → Job Settings → Appointment</Link> before adding a record.
        </div>
      )}
      {!staff.length && (
        <div className="mt-3 rounded-xl border border-sky-400/30 bg-sky-400/10 p-3 text-sm text-sky-800 dark:text-sky-200">
          No employee records are available for the selected branch. Add employees before recording appointments.
        </div>
      )}

      <div className="my-4 flex flex-wrap items-center gap-2">
        <SearchField value={search} onChange={setSearch} placeholder="Search employees or appointment types…" className="max-w-sm" />
        <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="max-w-[170px]" aria-label="Filter by appointment status">
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </Select>
        <span className="ml-auto text-xs text-mist">{filteredRecords.length} record{filteredRecords.length === 1 ? '' : 's'}</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-black/[0.02] text-left text-[11px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
              <th className="px-3 py-3">Employee</th>
              <th className="px-3 py-3">Appointment type</th>
              <th className="px-3 py-3">Effective date</th>
              <th className="px-3 py-3">End date</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Notes</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record) => {
              const employee = employeeFor(record)
              return (
                <tr key={record.id} className="border-b border-line last:border-0 hover:bg-lime/[0.03]">
                  <td className="px-3 py-3">
                    <p className="font-bold">{employeeName(record)}</p>
                    <p className="text-xs text-mist">{employeeSummary(employee, record)} · {employeeNumber(record)}</p>
                  </td>
                  <td className="px-3 py-3 font-semibold">{record.appointmentType}</td>
                  <td className="px-3 py-3">{formatDate(record.effectiveDate)}</td>
                  <td className="px-3 py-3">{record.endDate ? formatDate(record.endDate) : '—'}</td>
                  <td className="px-3 py-3"><Badge tone={record.status === 'Active' ? 'lime' : 'zinc'}>{record.status}</Badge></td>
                  <td className="max-w-[220px] truncate px-3 py-3 text-mist" title={record.notes || ''}>{record.notes || '—'}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => beginEdit(record)} aria-label="Edit appointment" title="Edit"><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(record)} aria-label="Delete appointment" title="Delete"><Trash2 className="size-4 text-rose-500" /></Button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!filteredRecords.length && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-mist">
                <Users className="mx-auto mb-2 size-8 opacity-50" />
                {visibleRecords.length ? 'No appointments match the current filters.' : 'No appointments have been recorded for this branch yet.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? 'Edit appointment' : 'Add appointment'} wide>
        <form onSubmit={saveAppointment} className="space-y-4">
          {formError && <div role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">{formError}</div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Employee" required>
              {editingId ? (
                <Select value={form.staffRecordIds[0] || ''} onChange={(event) => setForm({ ...form, staffRecordIds: event.target.value ? [event.target.value] : [] })} placeholder="Select employee…">
                  <option value="">Select employee…</option>
                  {!staff.some((employee) => employee.id === form.staffRecordIds[0]) && records.find((record) => record.id === editingId) && (
                    <option value={form.staffRecordIds[0]}>{records.find((record) => record.id === editingId)?.employeeName || form.staffRecordIds[0]} (legacy record)</option>
                  )}
                  {staff.map((employee) => {
                    const person = users.find((item) => item.id === employee.userId)
                    const name = person?.name || employee.employeeNumber || employee.id
                    const inactive = person?.status ? person.status !== 'active' : false
                    return <option key={employee.id} value={employee.id}>{name}{employee.employeeNumber ? ` · ${employee.employeeNumber}` : ''}{inactive ? ' (inactive)' : ''}</option>
                  })}
                </Select>
              ) : (
                <>
                  <MultiSelect
                    options={employeeOptions}
                    values={form.staffRecordIds}
                    onChange={(staffRecordIds) => setForm({ ...form, staffRecordIds })}
                    placeholder="Select one or more employees…"
                    aria-label="Select employees"
                    disabled={!employeeOptions.length}
                  />
                  {form.staffRecordIds.length > 0 && <p className="mt-1 text-[11px] text-mist">This appointment will be recorded for {form.staffRecordIds.length} employee{form.staffRecordIds.length === 1 ? '' : 's'}.</p>}
                </>
              )}
            </Field>
            <Field label="Appointment type" required hint="Manage available values in HR Admin → Job Settings → Appointment.">
              <Select value={form.appointmentType} onChange={(event) => setForm({ ...form, appointmentType: event.target.value })} placeholder="Select appointment type…">
                <option value="">Select appointment type…</option>
                {form.appointmentType && !appointmentTypes.some((item) => item.name === form.appointmentType) && (
                  <option value={form.appointmentType}>{form.appointmentType} (inactive/legacy)</option>
                )}
                {appointmentTypes.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
              </Select>
            </Field>
            <Field label="Effective date" required>
              <Input type="date" value={form.effectiveDate} onChange={(event) => setForm({ ...form, effectiveDate: event.target.value })} />
            </Field>
            <Field label="End date" hint="Optional">
              <Input type="date" value={form.endDate} min={form.effectiveDate || undefined} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
            </Field>
            <Field label="Status" required>
              <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as EmployeeAppointmentStatus })}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </Select>
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea value={form.notes} rows={3} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional notes about this appointment…" />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit"><CheckCircle2 className="size-4" /> {editingId ? 'Save changes' : 'Save appointment'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete appointment?" narrow>
        <div className="space-y-4">
          <p className="text-sm text-mist">This will permanently delete the {deleteTarget?.appointmentType} appointment for {deleteTarget?.employeeName}.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete}><Trash2 className="size-4" /> Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
