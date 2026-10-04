import { useMemo, useState } from 'react'
import { Pencil, Save } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Textarea } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { loadLeavePolicies, saveLeavePolicies, type LeavePolicy } from '../../../lib/leaveExtras'
import type { LeaveTypeDef } from '../../../types'

export function LeavePoliciesPage() {
  const { leaveTypes, log } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [policies, setPolicies] = useState<LeavePolicy[]>(() => loadLeavePolicies(leaveTypes))
  const [editing, setEditing] = useState<{ policy: LeavePolicy; type: LeaveTypeDef; allocation: string; carry: string; doc: string } | null>(null)

  const policyFor = (typeId: string) => policies.find((p) => p.leaveTypeId === typeId)

  const persist = (next: LeavePolicy[]) => { setPolicies(next); saveLeavePolicies(next) }

  const save = () => {
    if (!editing) return
    const num = (v: string) => (v.trim() === '' ? undefined : Number(v))
    const rec: LeavePolicy = {
      ...editing.policy,
      allocationDays: num(editing.allocation),
      carryOverMaxDays: num(editing.carry),
      requiresDocAboveDays: num(editing.doc),
    }
    if ([rec.allocationDays, rec.carryOverMaxDays, rec.requiresDocAboveDays].some((n) => n !== undefined && (!Number.isFinite(n) || n < 0))) {
      toast.error('Enter valid non-negative numbers.'); return
    }
    persist(policies.map((p) => (p.id === rec.id ? rec : p)))
    log(user?.id || 'system', 'UPDATE', 'LeavePolicy', `Updated policy for ${editing.type.name}`)
    toast.success('Policy saved', editing.type.name)
    setEditing(null)
  }

  const toggleActive = (p: LeavePolicy) => {
    persist(policies.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)))
    log(user?.id || 'system', 'UPDATE', 'LeavePolicy', `${p.active ? 'Disabled' : 'Enabled'} policy`)
  }

  const rows = useMemo(() => leaveTypes.map((t) => ({ t, p: policyFor(t.id) })), [leaveTypes, policies])

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resources</span><span>/</span><span>Leave</span><span>/</span><span className="font-semibold text-inherit">Leave Policies</span>
      </div>
      <PageHeader title="Leave Policies" desc="Entitlements and rules per leave type — allocation, carry-over cap and documentation thresholds." />
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-xs">
            <thead>
              <tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                <th className="px-3 py-2.5">Leave type</th><th className="px-3 py-2.5 text-right">Annual allocation</th>
                <th className="px-3 py-2.5 text-right">Carry-over cap</th><th className="px-3 py-2.5 text-right">Doc required above</th>
                <th className="px-3 py-2.5">Paid</th><th className="px-3 py-2.5 text-center">Policy active</th>
                {canManage && <th className="px-3 py-2.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ t, p }) => (
                <tr key={t.id} className="border-b border-line last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-bold" style={{ background: `${t.color}22`, color: t.color }}>{t.name}</span>
                    {t.description && <span className="ml-2 text-mist">{t.description}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-extrabold tabular-nums">{p?.allocationDays ?? t.daysPerYear ?? 0} days</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{p?.carryOverMaxDays ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{p?.requiresDocAboveDays ? `${p.requiresDocAboveDays} days` : '—'}</td>
                  <td className="px-3 py-2.5"><Badge tone={t.paid ? 'lime' : 'zinc'}>{t.paid ? 'paid' : 'unpaid'}</Badge></td>
                  <td className="px-3 py-2.5 text-center">
                    <button disabled={!canManage} onClick={() => toggleActive(p!)} className={`h-5 w-9 rounded-full transition ${p?.active ? 'bg-lime' : 'bg-zinc-300 dark:bg-zinc-600'}`} aria-label={`Toggle policy for ${t.name}`}>
                      <span className={`block size-4 translate-x-0.5 rounded-full bg-white transition ${p?.active ? 'translate-x-4' : ''}`} />
                    </button>
                  </td>
                  {canManage && (
                    <td className="px-3 py-2.5 text-right">
                      <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit policy" onClick={() => setEditing({ policy: p!, type: t, allocation: String(p?.allocationDays ?? t.daysPerYear ?? ''), carry: p?.carryOverMaxDays !== undefined ? String(p.carryOverMaxDays) : '', doc: p?.requiresDocAboveDays !== undefined ? String(p.requiresDocAboveDays) : '' })}>
                        <Pencil className="size-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Policy — ${editing?.type.name || ''}`}>
        {editing && (
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Annual allocation (days)"><Input type="number" min={0} value={editing.allocation} onChange={(e) => setEditing({ ...editing, allocation: e.target.value })} /></Field>
              <Field label="Carry-over cap (days)"><Input type="number" min={0} value={editing.carry} onChange={(e) => setEditing({ ...editing, carry: e.target.value })} placeholder="blank = none" /></Field>
            </div>
            <Field label="Supporting document required above (days)"><Input type="number" min={0} value={editing.doc} onChange={(e) => setEditing({ ...editing, doc: e.target.value })} placeholder="blank = never" /></Field>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={save}><Save className="size-4" /> Save policy</Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
