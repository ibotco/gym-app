import { useState } from 'react'
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, Empty } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import type { Department } from '../../../types'

export function Departments() {
  const app = useApp()
  const { departments, staff, users, upsertDepartment, deleteDepartment, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [editing, setEditing] = useState<{ id?: string; name: string; headUserId: string; description: string } | null>(null)
  const [deleting, setDeleting] = useState<Department | null>(null)

  const staffIn = (name: string) => staff.filter((s) => s.department === name).length

  const openNew = () => setEditing({ name: '', headUserId: '', description: '' })
  const openEdit = (d: Department) => setEditing({ id: d.id, name: d.name, headUserId: d.headUserId || '', description: d.description || '' })

  const save = () => {
    if (!editing) return
    if (editing.name.trim().length < 2) { toast.error('Enter a department name.'); return }
    const clash = departments.some((d) => d.name.toLowerCase() === editing.name.trim().toLowerCase() && d.id !== editing.id)
    if (clash) { toast.error('That department already exists.'); return }
    const isNew = !editing.id
    const rec: Department = {
      id: editing.id || uid('dept'),
      name: editing.name.trim(),
      headUserId: editing.headUserId || undefined,
      description: editing.description.trim() || undefined,
    }
    upsertDepartment(rec)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Department', `${isNew ? 'Created' : 'Updated'} ${rec.name}`)
    toast.success(isNew ? 'Department created' : 'Department updated', rec.name)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    if (staffIn(deleting.name) > 0) { toast.error('Cannot delete', 'Staff are still assigned to this department.'); setDeleting(null); return }
    deleteDepartment(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Department', `Deleted ${deleting.name}`)
    toast.success('Department deleted', deleting.name)
    setDeleting(null)
  }

  return (
    <div>
      <PageHeader
        title="Departments"
        desc="Organise staff into departments and assign heads."
        actions={canManage ? <Button onClick={openNew}><Plus className="size-4" /> New department</Button> : undefined}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {departments.map((d) => {
          const head = users.find((u) => u.id === d.headUserId)
          return (
            <div key={d.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="grid size-9 place-items-center rounded-xl bg-lime/10 text-lime"><Building2 className="size-5" /></div>
                  <div>
                    <p className="font-semibold">{d.name}</p>
                    <p className="text-xs text-mist">{staffIn(d.name)} staff</p>
                  </div>
                </div>
                {canManage && (
                  <div className="flex">
                    <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => openEdit(d)} aria-label="Edit"><Pencil className="size-4" /></button>
                    <button className="rounded-lg p-2 text-mist hover:text-ember" onClick={() => setDeleting(d)} aria-label="Delete"><Trash2 className="size-4" /></button>
                  </div>
                )}
              </div>
              <p className="mt-3 text-sm text-mist">{d.description || 'No description.'}</p>
              <p className="mt-3 text-xs text-mist">Head: <span className="font-semibold text-inherit">{head?.name || '—'}</span></p>
            </div>
          )
        })}
      </div>
      {!departments.length && <Empty title="No departments yet" />}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit department' : 'New department'}>
        {editing && (
          <div className="grid gap-3">
            <Field label="Name" required><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Department head">
              <Select value={editing.headUserId} onChange={(e) => setEditing({ ...editing, headUserId: e.target.value })}>
                <option value="">None</option>
                {staff.map((s) => {
                  const u = users.find((x) => x.id === s.userId)
                  return <option key={s.id} value={s.userId}>{u?.name} · {s.title}</option>
                })}
              </Select>
            </Field>
            <Field label="Description"><Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>{editing.id ? 'Save' : 'Create department'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete department?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete <span className="font-semibold text-inherit">{deleting.name}</span>?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={doDelete}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
