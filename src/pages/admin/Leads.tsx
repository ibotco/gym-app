import { useState } from 'react'
import { PageHeader, Button, StatusBadge, Modal, Field, Input, Select, Textarea, SearchInput } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { uid } from '../../lib/utils'
import { CustomFields } from '../../components/CustomFields'
import type { Lead, LeadStatus, CustomFieldValues } from '../../types'

const cols: LeadStatus[] = ['new', 'contacted', 'trial', 'converted', 'lost']

export function Leads() {
  const { leads, upsertLead, deleteLead } = useApp()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: 'Website', interest: 'Monthly', notes: '', customFields: {} as CustomFieldValues })

  const filtered = leads.filter((l) => `${l.name} ${l.email} ${l.interest}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <div>
      <PageHeader title="Lead CRM" desc="Website, walk-in, corporate, referral." actions={<Button onClick={() => setOpen(true)}>Add lead</Button>} />
      <SearchInput value={q} onChange={setQ} placeholder="Search leads…" />
      <div className="mt-4 grid gap-3 lg:grid-cols-5">
        {cols.map((c) => (
          <div key={c} className="rounded-2xl border border-white/5 bg-white/2 p-2">
            <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-mist">{c} · {filtered.filter((l) => l.status === c).length}</p>
            <div className="space-y-2">
              {filtered.filter((l) => l.status === c).map((l) => (
                <div key={l.id} className="card p-3">
                  <p className="text-sm font-semibold">{l.name}</p>
                  <p className="text-xs text-mist">{l.interest} · {l.source}</p>
                  <p className="mt-1 text-xs text-mist">{l.notes}</p>
                  <Select
                    className="mt-2"
                    value={l.status}
                    onChange={(e) => { upsertLead({ ...l, status: e.target.value as LeadStatus }); toast.info('Stage updated') }}
                  >
                    {cols.map((s) => <option key={s}>{s}</option>)}
                  </Select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New lead">
        <div className="space-y-3">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Interest"><Input value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })} /></Field>
          <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <CustomFields module="lead" values={form.customFields} onChange={(v) => setForm({ ...form, customFields: v })} />
          <Button className="w-full" onClick={() => {
            upsertLead({ id: uid('ld'), ...form, status: 'new', createdAt: new Date().toISOString().slice(0, 10) })
            toast.success('Lead added')
            setOpen(false)
          }}>Save</Button>
        </div>
      </Modal>
    </div>
  )
}
