import { useState } from 'react'
import { Plus, Pencil, Trash2, ArrowRight } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select } from '../../../components/ui'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { useApp } from '../../../context/AppContext'
import { uid } from '../../../lib/utils'
import { loadStateTransitions, saveStateTransitions, PAYROLL_STATES, type StateTransition, type PayslipState } from '../../../lib/payrollExtras'

const STATE_TONE: Record<PayslipState, 'zinc' | 'lime' | 'amber' | 'rose' | 'sky' | 'violet' | 'orange'> = {
  draft: 'zinc', approved: 'sky', paid: 'lime', cancelled: 'rose',
}
const ROLES = ['super_admin', 'gym_manager', 'accountant', 'company_admin']

type Form = { id?: string; from: PayslipState; to: PayslipState; roles: string[]; note: string }

export function PayrollStateTransitionsPage() {
  const { log } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [transitions, setTransitions] = useState<StateTransition[]>(() => loadStateTransitions())
  const [editing, setEditing] = useState<Form | null>(null)
  const [deleting, setDeleting] = useState<StateTransition | null>(null)

  const persist = (next: StateTransition[]) => { setTransitions(next); saveStateTransitions(next) }

  const save = () => {
    if (!editing) return
    if (editing.from === editing.to) { toast.error('From and to states must differ.'); return }
    if (!editing.roles.length) { toast.error('Pick at least one role allowed to run this transition.'); return }
    const rec: StateTransition = { id: editing.id || uid('st'), from: editing.from, to: editing.to, roles: editing.roles, note: editing.note.trim() || undefined }
    const dup = transitions.some((t) => t.id !== rec.id && t.from === rec.from && t.to === rec.to)
    if (dup) { toast.error('That transition already exists.'); return }
    persist(editing.id ? transitions.map((t) => (t.id === rec.id ? rec : t)) : [...transitions, rec])
    log(user?.id || 'system', editing.id ? 'UPDATE' : 'CREATE', 'PayrollState', `${rec.from} → ${rec.to}`)
    toast.success('Transition saved')
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    persist(transitions.filter((t) => t.id !== deleting.id))
    log(user?.id || 'system', 'DELETE', 'PayrollState', `Deleted transition ${deleting.from} → ${deleting.to}`)
    toast.success('Transition deleted')
    setDeleting(null)
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist"><span>Human Resources</span><span>/</span><span>Payroll</span><span>/</span><span className="font-semibold text-inherit">State Transitions</span></div>
      <PageHeader title="State Transitions" desc="The payslip state machine: which role may move a payslip between draft, approved, paid and cancelled."
        actions={canManage ? <Button onClick={() => setEditing({ from: 'draft', to: 'approved', roles: ['gym_manager'], note: '' })}><Plus className="size-4" /> New transition</Button> : undefined} />

      {/* state machine overview */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {PAYROLL_STATES.map((s) => <Badge key={s} tone={STATE_TONE[s]}>{s.toUpperCase()}</Badge>)}
        <span className="text-[11px] text-mist">— transitions below define the allowed moves.</span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-xs">
            <thead><tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
              <th className="px-4 py-2.5">From</th><th className="px-4 py-2.5">To</th><th className="px-4 py-2.5">Allowed roles</th><th className="px-4 py-2.5">Note</th>{canManage && <th className="px-4 py-2.5 text-right">Actions</th>}
            </tr></thead>
            <tbody>
              {transitions.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5"><Badge tone={STATE_TONE[t.from]}>{t.from}</Badge></td>
                  <td className="px-4 py-2.5"><span className="flex items-center gap-1.5"><ArrowRight className="size-3.5 text-mist" /><Badge tone={STATE_TONE[t.to]}>{t.to}</Badge></span></td>
                  <td className="px-4 py-2.5">{t.roles.map((r) => <span key={r} className="mr-1 inline-block rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-extrabold dark:bg-white/10">{r.replace(/_/g, ' ')}</span>)}</td>
                  <td className="px-4 py-2.5 text-mist">{t.note || '—'}</td>
                  {canManage && <td className="px-4 py-2.5"><span className="flex justify-end gap-1">
                    <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => setEditing({ id: t.id, from: t.from, to: t.to, roles: [...t.roles], note: t.note || '' })}><Pencil className="size-4" /></button>
                    <button className="rounded-lg p-2 text-mist hover:text-ember" onClick={() => setDeleting(t)}><Trash2 className="size-4" /></button>
                  </span></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit transition' : 'New transition'}>
        {editing && (
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="From">
                <Select value={editing.from} onChange={(e) => setEditing({ ...editing, from: e.target.value as PayslipState })}>
                  {PAYROLL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="To">
                <Select value={editing.to} onChange={(e) => setEditing({ ...editing, to: e.target.value as PayslipState })}>
                  {PAYROLL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Allowed roles" required>
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map((role) => {
                  const on = editing.roles.includes(role)
                  return (
                    <button key={role} type="button" onClick={() => setEditing({ ...editing, roles: on ? editing.roles.filter((x) => x !== role) : [...editing.roles, role] })}
                      className={`rounded-lg border-2 px-2.5 py-1 text-[11px] font-extrabold transition ${on ? 'border-lime bg-lime text-black' : 'border-line text-mist'}`}>{role.replace(/_/g, ' ')}</button>
                  )
                })}
              </div>
            </Field>
            <Field label="Note"><Input value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} /></Field>
            <div className="flex gap-2"><Button className="flex-1" onClick={save}>Save transition</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete transition?">
        {deleting && (<>
          <p className="text-sm text-mist">Delete <Badge tone={STATE_TONE[deleting.from]}>{deleting.from}</Badge> → <Badge tone={STATE_TONE[deleting.to]}>{deleting.to}</Badge>?</p>
          <div className="mt-4 flex gap-2"><Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" onClick={doDelete}><Trash2 className="size-4" /> Delete</Button></div>
        </>)}
      </Modal>
    </div>
  )
}
