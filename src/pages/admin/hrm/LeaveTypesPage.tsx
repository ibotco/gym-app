import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Printer, CalendarDays, Wallet, CalendarOff } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Textarea, Switch, SearchField } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import type { LeaveTypeDef } from '../../../types'

interface Form {
  name: string
  color: string
  daysPerYear: string
  paid: boolean
  description: string
}
const blank: Form = { name: '', color: '#3b82f6', daysPerYear: '', paid: true, description: '' }

/**
 * HR → Leave Management → Leave Types.
 * Colour-coded leave categories with yearly entitlement, wired into leave requests.
 */
export function LeaveTypesPage() {
  const { leaveTypes, upsertLeaveType, deleteLeaveType, leaves } = useApp()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null)
  const [deleting, setDeleting] = useState<LeaveTypeDef | null>(null)
  const [err, setErr] = useState('')

  const ql = q.trim().toLowerCase()
  const filtered = useMemo(
    () => leaveTypes.filter((t) => !ql || `${t.name} ${t.description || ''}`.toLowerCase().includes(ql)),
    [leaveTypes, ql],
  )
  const usedBy = (t: LeaveTypeDef) => leaves.filter((l) => l.type === t.name || l.type === t.id).length

  const openCreate = () => { setEditing({ id: null, form: { ...blank } }); setErr('') }
  const openEdit = (t: LeaveTypeDef) => {
    setEditing({
      id: t.id,
      form: { name: t.name, color: t.color, daysPerYear: t.daysPerYear ? String(t.daysPerYear) : '', paid: t.paid, description: t.description || '' },
    })
    setErr('')
  }
  const save = () => {
    if (!editing) return
    const name = editing.form.name.trim()
    if (!name) { setErr('Leave type name is required.'); return }
    if (leaveTypes.some((t) => t.name.toLowerCase() === name.toLowerCase() && t.id !== editing.id)) {
      setErr('A leave type with this name already exists.'); return
    }
    upsertLeaveType({
      id: editing.id || uid('lt'),
      name,
      color: editing.form.color || '#3b82f6',
      daysPerYear: editing.form.daysPerYear ? Number(editing.form.daysPerYear) : undefined,
      paid: editing.form.paid,
      description: editing.form.description.trim() || undefined,
    })
    toast.success(editing.id ? 'Leave type updated' : 'Leave type created', name)
    setEditing(null)
  }
  const confirmDelete = () => {
    if (!deleting) return
    deleteLeaveType(deleting.id)
    toast.success('Leave type deleted', deleting.name)
    setDeleting(null)
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span>Leave Management</span><span>/</span>
        <span className="font-semibold text-inherit">Leave Types</span>
      </div>
      <PageHeader
        title="Leave Types"
        desc="Configure leave categories with colours and yearly entitlements. The colour is applied wherever a leave type is shown."
        actions={<Button onClick={openCreate}><Plus className="size-4" /> New leave type</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {/* ---- Form ---- */}
        <div className="card h-fit p-4">
          <p className="mb-3 text-sm font-extrabold">{editing?.id ? 'Edit leave type' : 'New leave type'}</p>
          <div className="grid gap-3">
            <Field label="Name" required>
              <Input
                value={editing?.form.name ?? ''}
                onChange={(e) => setEditing((ed) => (ed ? { ...ed, form: { ...ed.form, name: e.target.value } } : ed))}
                placeholder="e.g. Annual"
              />
            </Field>
            <Field label="Colour">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={editing?.form.color ?? '#3b82f6'}
                  onChange={(e) => setEditing((ed) => (ed ? { ...ed, form: { ...ed.form, color: e.target.value } } : ed))}
                  className="h-[42px] w-14 cursor-pointer rounded-lg border border-line bg-transparent p-1"
                  aria-label="Leave type colour"
                />
                <Input
                  value={editing?.form.color ?? ''}
                  onChange={(e) => setEditing((ed) => (ed ? { ...ed, form: { ...ed.form, color: e.target.value } } : ed))}
                  placeholder="#3b82f6"
                  className="font-mono"
                />
                <span
                  className="grid h-[42px] min-w-16 place-items-center rounded-lg px-2 text-[11px] font-bold text-white"
                  style={{ background: editing?.form.color || '#3b82f6' }}
                >
                  Preview
                </span>
              </div>
            </Field>
            <Field label="Days per year (blank = not tracked)">
              <Input
                type="number"
                min={0}
                value={editing?.form.daysPerYear ?? ''}
                onChange={(e) => setEditing((ed) => (ed ? { ...ed, form: { ...ed.form, daysPerYear: e.target.value } } : ed))}
                placeholder="e.g. 20"
              />
            </Field>
            <Field label="Paid leave">
              <div className="flex h-[42px] items-center gap-2">
                <Switch
                  checked={editing?.form.paid ?? true}
                  onChange={(v) => setEditing((ed) => (ed ? { ...ed, form: { ...ed.form, paid: v } } : ed))}
                  aria-label="Paid leave"
                />
                <span className="text-xs text-mist">{(editing?.form.paid ?? true) ? 'Paid' : 'Unpaid'}</span>
              </div>
            </Field>
            <Field label="Description">
              <Textarea
                value={editing?.form.description ?? ''}
                onChange={(e) => setEditing((ed) => (ed ? { ...ed, form: { ...ed.form, description: e.target.value } } : ed))}
                placeholder="please provide description"
                className="placeholder:italic placeholder:text-rose-400"
              />
            </Field>
            {err && <p className="text-sm text-ember">{err}</p>}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={save}>{editing?.id ? 'Save changes' : 'Create'}</Button>
              {editing && <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>}
            </div>
          </div>
        </div>

        {/* ---- List ---- */}
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="text-sm font-extrabold">Leave types ({filtered.length})</p>
            <div className="flex items-center gap-2">
              <SearchField value={q} onChange={setQ} placeholder="Search types…" className="w-44" />
              <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
              <ExportButtons filename="leave-types" rows={leaveTypes.map((t) => ({
                Name: t.name, Colour: t.color, 'Days per year': t.daysPerYear ?? '', Paid: t.paid ? 'Yes' : 'No', Requests: usedBy(t), Description: t.description || '',
              }))} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-black/[0.02] text-left text-[11px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                  <th className="w-10 px-3 py-3">No.</th>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Days / year</th>
                  <th className="px-3 py-3">Pay</th>
                  <th className="px-3 py-3">Requests</th>
                  <th className="px-3 py-3">Colour</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => (
                  <tr key={t.id} className="border-b border-line last:border-0 hover:bg-lime/[0.03]">
                    <td className="px-3 py-2.5 text-mist">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <p className="flex items-center gap-2 font-bold">
                        <span className="size-2.5 rounded-full" style={{ background: t.color }} /> {t.name}
                      </p>
                      {t.description && <p className="mt-0.5 text-[11px] text-mist">{t.description}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      {t.daysPerYear ? (
                        <span className="inline-flex items-center gap-1 text-mist"><CalendarDays className="size-3.5" /> {t.daysPerYear}</span>
                      ) : <span className="text-mist">Not tracked</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold ${t.paid ? 'bg-lime/15 text-lime' : 'bg-zinc-500/15 text-mist'}`}>
                        {t.paid ? <><Wallet className="size-3" /> Paid</> : <><CalendarOff className="size-3" /> Unpaid</>}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-mist">{usedBy(t)}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded px-2 py-0.5 font-mono text-[11px] font-bold" style={{ background: `${t.color}22`, color: t.color }}>{t.color}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center justify-end gap-1">
                        <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => openEdit(t)}><Pencil className="size-4" /></button>
                        <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(t)}><Trash2 className="size-4" /></button>
                      </span>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-mist">No leave types yet. Create your first one on the left.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete leave type?">
        {deleting && (
          <>
            <p className="text-sm text-mist">
              Delete <span className="font-semibold text-inherit">{deleting.name}</span>?
              {usedBy(deleting) > 0 && <> It is used by <span className="font-semibold text-inherit">{usedBy(deleting)}</span> leave request(s), which will keep the label but lose the colour.</>}
            </p>
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
