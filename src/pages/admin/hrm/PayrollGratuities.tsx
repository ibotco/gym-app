import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, HandCoins } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, DatePicker } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatDate, formatGhsExact, uid } from '../../../lib/utils'
import { loadGratuities, saveGratuities, gratuityAmount, type GratuityEntry } from '../../../lib/payrollExtras'

type Form = { id?: string; staffUserId: string; basicSalary: string; yearsOfService: string; ratePct: string; date: string; note: string }

export function PayrollGratuitiesPage() {
  const { users, log } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [entries, setEntries] = useState<GratuityEntry[]>(() => loadGratuities())
  const [editing, setEditing] = useState<Form | null>(null)
  const [deleting, setDeleting] = useState<GratuityEntry | null>(null)

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id
  const persist = (next: GratuityEntry[]) => { setEntries(next); saveGratuities(next) }
  const rows = useMemo(() => [...entries].sort((a, b) => b.date.localeCompare(a.date)), [entries])
  const total = rows.reduce((n, g) => n + gratuityAmount(g), 0)

  const preview = editing ? gratuityAmount({ basicSalary: Number(editing.basicSalary) || 0, yearsOfService: Number(editing.yearsOfService) || 0, ratePct: Number(editing.ratePct) || 0 }) : 0

  const save = () => {
    if (!editing) return
    const basic = Number(editing.basicSalary), years = Number(editing.yearsOfService), rate = Number(editing.ratePct)
    if (!editing.staffUserId) { toast.error('Pick an employee.'); return }
    if (!Number.isFinite(basic) || basic <= 0) { toast.error('Enter a valid basic salary.'); return }
    if (!Number.isFinite(years) || years <= 0) { toast.error('Enter years of service.'); return }
    if (!Number.isFinite(rate) || rate <= 0 || rate > 100) { toast.error('Rate must be between 0 and 100%.'); return }
    const rec: GratuityEntry = { id: editing.id || uid('gr'), staffUserId: editing.staffUserId, basicSalary: basic, yearsOfService: years, ratePct: rate, date: editing.date, note: editing.note.trim() || undefined }
    persist(editing.id ? entries.map((g) => (g.id === rec.id ? rec : g)) : [...entries, rec])
    log(user?.id || 'system', editing.id ? 'UPDATE' : 'CREATE', 'Gratuity', `Gratuity ${formatGhsExact(gratuityAmount(rec))} for ${staffName(rec.staffUserId)}`)
    toast.success(editing.id ? 'Gratuity updated' : 'Gratuity recorded')
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    persist(entries.filter((g) => g.id !== deleting.id))
    log(user?.id || 'system', 'DELETE', 'Gratuity', `Deleted gratuity for ${staffName(deleting.staffUserId)}`)
    toast.success('Gratuity deleted')
    setDeleting(null)
  }

  const columns: Column<GratuityEntry>[] = [
    { key: 'staff', header: 'Employee', sortValue: (g) => staffName(g.staffUserId), render: (g) => <span className="font-semibold">{staffName(g.staffUserId)}</span> },
    { key: 'basic', header: 'Basic salary', align: 'right', sortValue: (g) => g.basicSalary, render: (g) => formatGhsExact(g.basicSalary) },
    { key: 'years', header: 'Years', align: 'right', sortValue: (g) => g.yearsOfService, render: (g) => <span className="tabular-nums">{g.yearsOfService}</span> },
    { key: 'rate', header: 'Rate', align: 'right', sortValue: (g) => g.ratePct, render: (g) => <span className="tabular-nums">{g.ratePct}%</span> },
    { key: 'amount', header: 'Gratuity', align: 'right', sortValue: (g) => gratuityAmount(g), render: (g) => <span className="font-extrabold text-green-700 dark:text-lime">{formatGhsExact(gratuityAmount(g))}</span> },
    { key: 'date', header: 'Date', sortValue: (g) => g.date, render: (g) => <span className="text-mist">{formatDate(g.date)}</span> },
    { key: 'note', header: 'Note', render: (g) => <span className="block max-w-48 truncate text-mist">{g.note || '—'}</span> },
    ...(canManage ? [{
      key: 'actions', header: 'Actions', align: 'right' as const,
      render: (g: GratuityEntry) => (
        <span className="flex justify-end gap-1">
          <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => setEditing({ id: g.id, staffUserId: g.staffUserId, basicSalary: String(g.basicSalary), yearsOfService: String(g.yearsOfService), ratePct: String(g.ratePct), date: g.date, note: g.note || '' })}><Pencil className="size-4" /></button>
          <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(g)}><Trash2 className="size-4" /></button>
        </span>
      ),
    }] : []),
  ]

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist"><span>Human Resources</span><span>/</span><span>Payroll</span><span>/</span><span className="font-semibold text-inherit">Gratuities</span></div>
      <PageHeader title="Gratuities" desc="End-of-service gratuities computed as basic × years × rate%."
        actions={canManage ? <Button onClick={() => setEditing({ staffUserId: users[0]?.id || '', basicSalary: '', yearsOfService: '', ratePct: '5', date: new Date().toISOString().slice(0, 10), note: '' })}><Plus className="size-4" /> Record gratuity</Button> : undefined} />

      <div className="card mb-4 flex items-center gap-3 p-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lime/15 text-green-700 dark:text-lime"><HandCoins className="size-5" /></span>
        <div><p className="text-[11px] font-extrabold uppercase tracking-wider text-mist">Total gratuities recorded</p><p className="text-xl font-extrabold">{formatGhsExact(total)}</p></div>
      </div>

      <DataTable data={rows} columns={columns} rowKey={(g) => g.id} pageSize={10} emptyTitle="No gratuities recorded" emptyDesc="Record an end-of-service gratuity to see it here." />

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit gratuity' : 'Record gratuity'}>
        {editing && (
          <div className="grid gap-3">
            <Field label="Employee" required>
              <select className="w-full rounded-xl border border-line bg-transparent px-3 py-2 text-sm" value={editing.staffUserId} onChange={(e) => setEditing({ ...editing, staffUserId: e.target.value })}>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Basic salary"><Input type="number" min={0} value={editing.basicSalary} onChange={(e) => setEditing({ ...editing, basicSalary: e.target.value })} /></Field>
              <Field label="Years"><Input type="number" min={0} step="0.5" value={editing.yearsOfService} onChange={(e) => setEditing({ ...editing, yearsOfService: e.target.value })} /></Field>
              <Field label="Rate %"><Input type="number" min={0} max={100} value={editing.ratePct} onChange={(e) => setEditing({ ...editing, ratePct: e.target.value })} /></Field>
            </div>
            <Field label="Date"><DatePicker value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} /></Field>
            <Field label="Note"><Input value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} placeholder="Contract reference…" /></Field>
            <p className="rounded-lg bg-black/5 px-3 py-2 text-[12px] dark:bg-white/5">Computed gratuity: <span className="font-extrabold text-inherit">{formatGhsExact(preview)}</span></p>
            <div className="flex gap-2"><Button className="flex-1" onClick={save}>Save gratuity</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete gratuity?">
        {deleting && (<>
          <p className="text-sm text-mist">Delete the gratuity of <span className="font-semibold text-inherit">{formatGhsExact(gratuityAmount(deleting))}</span> for {staffName(deleting.staffUserId)}?</p>
          <div className="mt-4 flex gap-2"><Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" onClick={doDelete}><Trash2 className="size-4" /> Delete</Button></div>
        </>)}
      </Modal>
    </div>
  )
}
