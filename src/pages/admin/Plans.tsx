import { useState } from 'react'
import { PageHeader, Button, Badge, Modal, Field, Input, Textarea } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { formatGhs, uid } from '../../lib/utils'
import type { Plan } from '../../types'

const empty: Plan = { id: '', name: '', type: 'monthly', price: 0, durationDays: 30, features: [], active: true, color: '#c8f542' }

export function Plans() {
  const { plans, upsertPlan, deletePlan } = useApp()
  const toast = useToast()
  const [edit, setEdit] = useState<Plan | null>(null)

  return (
    <div>
      <PageHeader title="Membership plans" desc="Pricing, promotions, auto-renew defaults." actions={<Button onClick={() => setEdit({ ...empty, id: uid('pl') })}>Create plan</Button>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((p) => (
          <div key={p.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-mist">{p.type}</p>
                <h2 className="font-display text-xl">{p.name}</h2>
              </div>
              <Badge tone={p.active ? 'lime' : 'zinc'}>{p.active ? 'Live' : 'Hidden'}</Badge>
            </div>
            <p className="stat-num mt-3 text-3xl">{formatGhs(p.price)}</p>
            <p className="text-xs text-mist">{p.durationDays} days</p>
            <ul className="mt-3 space-y-1 text-sm text-mist">
              {p.features.map((f) => <li key={f}>· {f}</li>)}
            </ul>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEdit(p)}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => { upsertPlan({ ...p, active: !p.active }); toast.info(p.active ? 'Hidden' : 'Published') }}>{p.active ? 'Unpublish' : 'Publish'}</Button>
            </div>
          </div>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Plan editor">
        {edit && (
          <div className="space-y-3">
            <Field label="Name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price GHS"><Input type="number" value={edit.price} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) })} /></Field>
              <Field label="Duration days"><Input type="number" value={edit.durationDays} onChange={(e) => setEdit({ ...edit, durationDays: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Features (one per line)">
              <Textarea value={edit.features.join('\n')} onChange={(e) => setEdit({ ...edit, features: e.target.value.split('\n').filter(Boolean) })} />
            </Field>
            <Button className="w-full" onClick={() => { upsertPlan(edit); toast.success('Plan saved'); setEdit(null) }}>Save</Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
