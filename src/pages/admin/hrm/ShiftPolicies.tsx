import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, MoreVertical, Sparkles, Printer, Power } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import { loadShiftPolicies, saveShiftPolicies } from '../../../lib/shiftPolicies'
import type { ShiftPolicy } from '../../../types'

interface Form {
  name: string
  shiftId: string
  departments: string[]
  staffUserIds: string[]
  requiredStaff: string
  weeklyHours: string
  maxConsecutiveDays: string
  restDaysPerWeek: string
  rotation: 'fixed' | 'weekly'
  workWeekends: boolean
  workHolidays: boolean
  active: boolean
  notes: string
}

export function ShiftPolicies() {
  const { shifts, staff, users } = useApp()
  const { hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [policies, setPolicies] = useState<ShiftPolicy[]>(() => loadShiftPolicies())
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null)
  const [deleting, setDeleting] = useState<ShiftPolicy | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const departments = useMemo(() => Array.from(new Set(staff.map((s) => s.department))).sort(), [staff])
  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id
  const shiftOf = (id: string) => shifts.find((s) => s.id === id)

  const persist = (next: ShiftPolicy[]) => { setPolicies(next); saveShiftPolicies(next) }

  const blank = (): Form => ({
    name: '', shiftId: shifts[0]?.id || '', departments: [], staffUserIds: [], requiredStaff: '1',
    weeklyHours: '48', maxConsecutiveDays: '6', restDaysPerWeek: '1', rotation: 'weekly',
    workWeekends: true, workHolidays: false, active: true, notes: '',
  })
  const openCreate = () => { setEditing({ id: null, form: blank() }); setErr('') }
  const openEdit = (p: ShiftPolicy) => {
    setEditing({
      id: p.id,
      form: {
        name: p.name, shiftId: p.shiftId, departments: [...p.departments], staffUserIds: [...p.staffUserIds],
        requiredStaff: String(p.requiredStaff), weeklyHours: String(p.weeklyHours),
        maxConsecutiveDays: String(p.maxConsecutiveDays), restDaysPerWeek: String(p.restDaysPerWeek),
        rotation: p.rotation, workWeekends: p.workWeekends, workHolidays: p.workHolidays, active: p.active, notes: p.notes || '',
      },
    })
    setErr('')
  }

  const save = () => {
    if (!editing) return
    const name = editing.form.name.trim()
    if (!name) { setErr('Policy name is required.'); return }
    if (!editing.form.shiftId) { setErr('Pick the shift this policy assigns.'); return }
    const rec: ShiftPolicy = {
      id: editing.id || uid('sp'),
      name,
      shiftId: editing.form.shiftId,
      departments: editing.form.departments,
      staffUserIds: editing.form.staffUserIds,
      requiredStaff: Math.max(1, Number(editing.form.requiredStaff) || 1),
      weeklyHours: Math.max(1, Number(editing.form.weeklyHours) || 48),
      maxConsecutiveDays: Math.max(1, Number(editing.form.maxConsecutiveDays) || 6),
      restDaysPerWeek: Math.max(0, Number(editing.form.restDaysPerWeek) || 0),
      rotation: editing.form.rotation,
      workWeekends: editing.form.workWeekends,
      workHolidays: editing.form.workHolidays,
      active: editing.form.active,
      notes: editing.form.notes.trim() || undefined,
      createdAt: editing.id ? policies.find((p) => p.id === editing.id)?.createdAt || new Date().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    }
    persist(editing.id ? policies.map((p) => (p.id === rec.id ? rec : p)) : [...policies, rec])
    toast.success(editing.id ? 'Policy updated' : 'Policy created', name)
    setEditing(null)
  }

  const toggleActive = (p: ShiftPolicy) => {
    persist(policies.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)))
    toast.success(p.active ? 'Policy deactivated' : 'Policy activated', p.name)
  }

  const confirmDelete = () => {
    if (!deleting) return
    persist(policies.filter((p) => p.id !== deleting.id))
    toast.success('Policy deleted', deleting.name)
    setDeleting(null)
  }

  const f = editing?.form

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span>Employee Attendance</span><span>/</span>
        <span>Shift Management</span><span>/</span>
        <span className="font-semibold text-inherit">Shift Policies</span>
      </div>
      <PageHeader
        title="Shift Policies"
        desc="Define the rules the automatic shift generator follows — schedules, hours, rotation, rest days and weekend/holiday work."
        actions={canManage ? <Button onClick={openCreate}><Plus className="size-4" /> New policy</Button> : undefined}
      />

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-extrabold"><Sparkles className="size-4 text-lime" /> Policies ({policies.length})</p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
            <ExportButtons filename="shift-policies" rows={policies.map((p) => ({
              Policy: p.name, Shift: shiftOf(p.shiftId)?.name || p.shiftId, Coverage: p.staffUserIds.length ? p.staffUserIds.map(staffName).join(', ') : p.departments.join(', ') || 'All departments',
              RequiredStaff: p.requiredStaff, WeeklyHours: p.weeklyHours, MaxConsecutiveDays: p.maxConsecutiveDays, RestDays: p.restDaysPerWeek,
              Rotation: p.rotation, Weekends: p.workWeekends ? 'yes' : 'no', Holidays: p.workHolidays ? 'yes' : 'no', Status: p.active ? 'active' : 'inactive',
            }))} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                <th className="px-3 py-2.5">Policy</th>
                <th className="px-3 py-2.5">Shift</th>
                <th className="px-3 py-2.5">Coverage</th>
                <th className="px-3 py-2.5 text-center">Required</th>
                <th className="px-3 py-2.5 text-center">Weekly hrs</th>
                <th className="px-3 py-2.5 text-center">Max consec.</th>
                <th className="px-3 py-2.5 text-center">Rest days</th>
                <th className="px-3 py-2.5 text-center">Rotation</th>
                <th className="px-3 py-2.5 text-center">Weekend / Holiday</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                {canManage && <th className="px-3 py-2.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => {
                const sh = shiftOf(p.shiftId)
                return (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-lime/[0.02]">
                    <td className="px-3 py-2">
                      <p className="font-bold">{p.name}</p>
                      {p.notes && <p className="mt-0.5 max-w-[220px] truncate text-[11px] text-mist">{p.notes}</p>}
                    </td>
                    <td className="px-3 py-2">
                      {sh ? <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-extrabold text-white" style={{ background: sh.color }}>{sh.name}</span> : <span className="text-mist">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {p.staffUserIds.length
                        ? <span className="text-mist">{p.staffUserIds.slice(0, 2).map(staffName).join(', ')}{p.staffUserIds.length > 2 ? ` +${p.staffUserIds.length - 2}` : ''}</span>
                        : p.departments.length ? <span>{p.departments.join(', ')}</span> : <span>All departments</span>}
                    </td>
                    <td className="px-3 py-2 text-center font-bold">{p.requiredStaff}</td>
                    <td className="px-3 py-2 text-center">{p.weeklyHours}h</td>
                    <td className="px-3 py-2 text-center">{p.maxConsecutiveDays}d</td>
                    <td className="px-3 py-2 text-center">{p.restDaysPerWeek}</td>
                    <td className="px-3 py-2 text-center capitalize">{p.rotation}</td>
                    <td className="px-3 py-2 text-center">{p.workWeekends ? '✔' : '—'} / {p.workHolidays ? '✔' : '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${p.active ? 'bg-green-600/15 text-green-700 dark:text-green-400' : 'bg-zinc-500/15 text-zinc-500'}`}>{p.active ? 'Active' : 'Inactive'}</span>
                    </td>
                    {canManage && (
                      <td className="relative px-3 py-2 text-right">
                        <button onClick={() => setMenuFor(menuFor === p.id ? null : p.id)} className="grid size-8 place-items-center rounded border border-line text-mist hover:bg-black/5 dark:hover:bg-white/5" aria-label="Row actions"><MoreVertical className="size-4" /></button>
                        {menuFor === p.id && (
                          <div className="menu-pop absolute right-3 top-10 z-20 w-44 rounded-xl border border-line bg-white p-1 shadow-xl dark:bg-zinc-900">
                            <button onClick={() => { setMenuFor(null); openEdit(p) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"><Pencil className="size-3.5" /> Edit</button>
                            <button onClick={() => { setMenuFor(null); toggleActive(p) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"><Power className="size-3.5" /> {p.active ? 'Deactivate' : 'Activate'}</button>
                            <button onClick={() => { setMenuFor(null); setDeleting(p) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-rose-600"><Trash2 className="size-3.5" /> Delete</button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
              {!policies.length && <tr><td colSpan={11} className="px-4 py-8 text-center text-mist">No shift policies yet. Create one to enable automatic shift generation.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Policy form */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit policy' : 'New policy'} wide>
        {editing && f && (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Policy name" required><Input value={f.name} onChange={(e) => setEditing({ ...editing, form: { ...f, name: e.target.value } })} placeholder="e.g. Front of House coverage" /></Field>
              <Field label="Shift to assign" required>
                <Select value={f.shiftId} onChange={(e) => setEditing({ ...editing, form: { ...f, shiftId: e.target.value } })}>
                  {shifts.map((sh) => <option key={sh.id} value={sh.id}>{sh.name} ({sh.startTime}–{sh.endTime})</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Departments (empty = all)">
              <div className="flex flex-wrap gap-1.5">
                {departments.map((d) => {
                  const on = f.departments.includes(d)
                  return (
                    <button key={d} onClick={() => setEditing({ ...editing, form: { ...f, departments: on ? f.departments.filter((x) => x !== d) : [...f.departments, d] } })}
                      className={`rounded-lg border-2 px-3 py-1 text-xs font-extrabold transition ${on ? 'border-lime bg-lime text-black' : 'border-line text-mist'}`}>{d}</button>
                  )
                })}
                {!departments.length && <span className="text-sm text-mist">No staff departments yet.</span>}
              </div>
            </Field>
            <Field label={`Specific employees (${f.staffUserIds.length}) — overrides departments`}>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
                {staff.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5">
                    <input type="checkbox" checked={f.staffUserIds.includes(s.userId)} onChange={() => setEditing({ ...editing, form: { ...f, staffUserIds: f.staffUserIds.includes(s.userId) ? f.staffUserIds.filter((x) => x !== s.userId) : [...f.staffUserIds, s.userId] } })} className="accent-[#c8f542]" />
                    <span className="font-semibold">{staffName(s.userId)}</span>
                    <span className="text-[11px] text-mist">{s.department}</span>
                  </label>
                ))}
                {!staff.length && <p className="p-2 text-sm text-mist">No staff records.</p>}
              </div>
            </Field>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Required staff"><Input type="number" min="1" value={f.requiredStaff} onChange={(e) => setEditing({ ...editing, form: { ...f, requiredStaff: e.target.value } })} /></Field>
              <Field label="Max weekly hours"><Input type="number" min="1" value={f.weeklyHours} onChange={(e) => setEditing({ ...editing, form: { ...f, weeklyHours: e.target.value } })} /></Field>
              <Field label="Max consecutive days"><Input type="number" min="1" value={f.maxConsecutiveDays} onChange={(e) => setEditing({ ...editing, form: { ...f, maxConsecutiveDays: e.target.value } })} /></Field>
              <Field label="Rest days / week"><Input type="number" min="0" max="6" value={f.restDaysPerWeek} onChange={(e) => setEditing({ ...editing, form: { ...f, restDaysPerWeek: e.target.value } })} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Shift rotation pattern">
                <Select value={f.rotation} onChange={(e) => setEditing({ ...editing, form: { ...f, rotation: e.target.value as 'fixed' | 'weekly' } })}>
                  <option value="fixed">Fixed order</option>
                  <option value="weekly">Rotate week by week</option>
                </Select>
              </Field>
              <Field label="Notes"><Input value={f.notes} onChange={(e) => setEditing({ ...editing, form: { ...f, notes: e.target.value } })} placeholder="Optional" /></Field>
            </div>
            <div className="flex flex-wrap gap-4 text-sm font-semibold">
              <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={f.workWeekends} onChange={(e) => setEditing({ ...editing, form: { ...f, workWeekends: e.target.checked } })} className="accent-[#c8f542]" /> Assign weekends</label>
              <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={f.workHolidays} onChange={(e) => setEditing({ ...editing, form: { ...f, workHolidays: e.target.checked } })} className="accent-[#c8f542]" /> Assign public holidays</label>
              <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={f.active} onChange={(e) => setEditing({ ...editing, form: { ...f, active: e.target.checked } })} className="accent-[#c8f542]" /> Policy active</label>
            </div>
            {err && <p className="text-sm text-ember">{err}</p>}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={save}>{editing.id ? 'Save changes' : 'Create policy'}</Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete policy?">
        {deleting && (
          <>
            <p className="text-sm text-mist">Delete <span className="font-semibold text-inherit">{deleting.name}</span>? The automatic generator will no longer use it.</p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={confirmDelete}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
