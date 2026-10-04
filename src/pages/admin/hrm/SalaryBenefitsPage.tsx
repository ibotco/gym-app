import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Printer, TrendingUp, TrendingDown, Layers, Wallet } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Textarea, SearchField, StatCard, Badge } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import { benefitAmount } from '../../../lib/payroll'
import type { SalaryBenefit } from '../../../types'

const ghs = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface Form { name: string; kind: 'allowance' | 'deduction'; basis: 'fixed' | 'percent'; value: string; color: string; description: string }
const blank: Form = { name: '', kind: 'allowance', basis: 'fixed', value: '', color: '#0ea5e9', description: '' }

export function SalaryBenefitsPage() {
  const { salaryBenefits, salaryStructures, salaryAssignments, upsertSalaryBenefit, deleteSalaryBenefit } = useApp()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null)
  const [deleting, setDeleting] = useState<SalaryBenefit | null>(null)
  const [err, setErr] = useState('')

  const ql = q.trim().toLowerCase()
  const filtered = useMemo(() => salaryBenefits.filter((b) => !ql || `${b.name} ${b.description || ''}`.toLowerCase().includes(ql)), [salaryBenefits, ql])

  const usedIn = (id: string) => salaryStructures.filter((st) => st.benefitIds.includes(id))
  const assignedStaff = (id: string) => usedIn(id).reduce((s, st) => s + salaryAssignments.filter((a) => a.structureId === st.id).length, 0)

  const stats = useMemo(() => {
    const allow = salaryBenefits.filter((b) => b.kind === 'allowance')
    const deduct = salaryBenefits.filter((b) => b.kind === 'deduction')
    const sample = 2000
    const cost = allow.reduce((s, b) => s + benefitAmount(b, sample), 0)
    const linked = new Set(salaryStructures.flatMap((st) => st.benefitIds)).size
    return { allow: allow.length, deduct: deduct.length, linked, cost }
  }, [salaryBenefits, salaryStructures])

  const save = () => {
    if (!editing) return
    const name = editing.form.name.trim()
    if (!name) { setErr('Benefit name is required.'); return }
    if (editing.form.value === '' || Number(editing.form.value) < 0) { setErr('Enter a valid value (amount or percent).'); return }
    upsertSalaryBenefit({
      id: editing.id || uid('sb'),
      name,
      kind: editing.form.kind,
      basis: editing.form.basis,
      value: Number(editing.form.value),
      color: editing.form.color || '#0ea5e9',
      description: editing.form.description.trim() || undefined,
    })
    toast.success(editing.id ? 'Benefit updated' : 'Benefit created', name)
    setEditing(null)
  }

  const previewAmount = editing && editing.form.value !== '' && Number(editing.form.value) >= 0
    ? benefitAmount({ id: 'x', name: '', kind: editing.form.kind, basis: editing.form.basis, value: Number(editing.form.value), color: '' }, 2000)
    : null

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span>Payroll</span><span>/</span>
        <span className="font-semibold text-inherit">Salary Benefits</span>
      </div>
      <PageHeader
        title="Salary Benefits"
        desc="Allowances and deductions used by salary structures — fixed amounts or percentages of basic."
        actions={<Button onClick={() => { setEditing({ id: null, form: { ...blank } }); setErr('') }}><Plus className="size-4" /> New benefit</Button>}
      />

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Allowances" value={String(stats.allow)} icon={<TrendingUp className="size-4" />} hint="add to pay" />
        <StatCard label="Deductions" value={String(stats.deduct)} icon={<TrendingDown className="size-4" />} hint="subtract from pay" />
        <StatCard label="Linked to structures" value={`${stats.linked}/${salaryBenefits.length}`} icon={<Layers className="size-4" />} />
        <StatCard label="Cost @ GHS 2,000 basic" value={ghs(stats.cost)} icon={<Wallet className="size-4" />} hint="allowances / month" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Form */}
        <div className="card h-fit p-4">
          <p className="mb-3 text-sm font-extrabold">{editing?.id ? 'Edit benefit' : 'New benefit'}</p>
          <div className="grid gap-3">
            <Field label="Name" required>
              <Input value={editing?.form.name ?? ''} onChange={(e) => setEditing((ed) => (ed ? { ...ed, form: { ...ed.form, name: e.target.value } } : ed))} placeholder="e.g. Housing" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kind">
                <Select value={editing?.form.kind ?? 'allowance'} onChange={(e) => setEditing((ed) => (ed ? { ...ed, form: { ...ed.form, kind: e.target.value as 'allowance' | 'deduction' } } : ed))}>
                  <option value="allowance">Allowance (adds)</option>
                  <option value="deduction">Deduction (subtracts)</option>
                </Select>
              </Field>
              <Field label="Basis">
                <Select value={editing?.form.basis ?? 'fixed'} onChange={(e) => setEditing((ed) => (ed ? { ...ed, form: { ...ed.form, basis: e.target.value as 'fixed' | 'percent' } } : ed))}>
                  <option value="fixed">Fixed GHS</option>
                  <option value="percent">% of basic</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={editing?.form.basis === 'percent' ? 'Percent of basic' : 'Amount (GHS)'}>
                <Input type="number" min={0} value={editing?.form.value ?? ''} onChange={(e) => setEditing((ed) => (ed ? { ...ed, form: { ...ed.form, value: e.target.value } } : ed))} placeholder={editing?.form.basis === 'percent' ? 'e.g. 10' : 'e.g. 300'} />
              </Field>
              <Field label="Colour">
                <div className="flex items-center gap-2">
                  <input type="color" value={editing?.form.color ?? '#0ea5e9'} onChange={(e) => setEditing((ed) => (ed ? { ...ed, form: { ...ed.form, color: e.target.value } } : ed))} className="h-[42px] w-14 cursor-pointer rounded-lg border border-line bg-transparent p-1" aria-label="Benefit colour" />
                  <span className="grid h-[42px] min-w-14 place-items-center rounded-lg px-2 text-[10px] font-bold text-white" style={{ background: editing?.form.color || '#0ea5e9' }}>{(editing?.form.kind ?? 'allowance') === 'allowance' ? '+' : '−'}</span>
                </div>
              </Field>
            </div>
            {previewAmount !== null && (
              <p className="rounded-xl border border-line p-2.5 text-xs text-mist">
                At a GHS 2,000 basic this {(editing?.form.kind ?? 'allowance') === 'allowance' ? 'adds' : 'subtracts'} <span className="font-extrabold" style={{ color: editing?.form.color || '#0ea5e9' }}>{ghs(previewAmount)}</span> per month.
              </p>
            )}
            <Field label="Description">
              <Textarea value={editing?.form.description ?? ''} onChange={(e) => setEditing((ed) => (ed ? { ...ed, form: { ...ed.form, description: e.target.value } } : ed))} placeholder="please provide description" className="placeholder:italic placeholder:text-rose-400" />
            </Field>
            {err && <p className="text-sm text-ember">{err}</p>}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={save}>{editing?.id ? 'Save changes' : 'Create benefit'}</Button>
              {editing && <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="text-sm font-extrabold">Benefits & deductions ({filtered.length})</p>
            <div className="flex items-center gap-2">
              <SearchField value={q} onChange={setQ} placeholder="Search…" className="w-40" />
              <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
              <ExportButtons filename="salary-benefits" rows={salaryBenefits.map((b) => ({
                Name: b.name, Kind: b.kind, Basis: b.basis, Value: b.value, 'At 2000 basic': benefitAmount(b, 2000),
                'Used in structures': usedIn(b.id).map((st) => st.name).join(', '), Colour: b.color, Description: b.description || '',
              }))} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-black/[0.02] text-left text-[11px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                  <th className="px-3 py-2.5">Name</th><th className="px-3 py-2.5">Kind</th><th className="px-3 py-2.5">Value</th><th className="px-3 py-2.5">Used in</th><th className="px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const structures = usedIn(b.id)
                  return (
                    <tr key={b.id} className="border-b border-line last:border-0 hover:bg-lime/[0.03]">
                      <td className="px-3 py-2.5">
                        <p className="flex items-center gap-2 font-bold"><span className="size-2.5 rounded-full" style={{ background: b.color }} /> {b.name}</p>
                        {b.description && <p className="mt-0.5 text-[11px] text-mist">{b.description}</p>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold ${b.kind === 'allowance' ? 'bg-lime/15 text-lime' : 'bg-rose-500/15 text-rose-400'}`}>
                          {b.kind === 'allowance' ? <><TrendingUp className="size-3" /> Adds</> : <><TrendingDown className="size-3" /> Subtracts</>}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-bold" style={{ color: b.color }}>{b.basis === 'percent' ? `${b.value}%` : ghs(b.value)}</p>
                        <p className="text-[10px] text-mist">= {ghs(benefitAmount(b, 2000))} @ 2k</p>
                      </td>
                      <td className="px-3 py-2.5">
                        {structures.length ? (
                          <span className="flex flex-wrap gap-1">
                            {structures.map((st) => <Badge key={st.id} tone="sky">{st.name}</Badge>)}
                          </span>
                        ) : <span className="text-[11px] italic text-mist">Not linked yet</span>}
                        {structures.length > 0 && <p className="mt-0.5 text-[10px] text-mist">{assignedStaff(b.id)} staff affected</p>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center justify-end gap-1">
                          <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => { setEditing({ id: b.id, form: { name: b.name, kind: b.kind, basis: b.basis, value: String(b.value), color: b.color, description: b.description || '' } }); setErr('') }}><Pencil className="size-4" /></button>
                          <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(b)}><Trash2 className="size-4" /></button>
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {!filtered.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-mist">No benefits yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete benefit?">
        {deleting && (
          <>
            <p className="text-sm text-mist">
              Delete <span className="font-semibold text-inherit">{deleting.name}</span>?
              {usedIn(deleting.id).length > 0 && <> It is used by <span className="font-semibold text-inherit">{usedIn(deleting.id).map((st) => st.name).join(', ')}</span> — those structures will simply skip it.</>}
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { deleteSalaryBenefit(deleting.id); toast.success('Benefit deleted', deleting.name); setDeleting(null) }}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
