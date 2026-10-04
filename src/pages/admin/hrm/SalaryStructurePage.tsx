import { useState } from 'react'
import { Plus, Pencil, Trash2, Printer } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Textarea } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import { benefitAmount } from '../../../lib/payroll'
import type { SalaryStructure } from '../../../types'

const ghs = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface Form { name: string; basic: string; benefitIds: string[]; description: string }

export function SalaryStructurePage() {
  const { salaryStructures, salaryBenefits, salaryAssignments, upsertSalaryStructure, deleteSalaryStructure } = useApp()
  const toast = useToast()
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null)
  const [deleting, setDeleting] = useState<SalaryStructure | null>(null)
  const [err, setErr] = useState('')
  const [view, setView] = useState<'table' | 'cards'>('table')

  const estimate = (basic: number, benefitIds: string[]) => {
    let add = 0, sub = 0
    for (const id of benefitIds) {
      const b = salaryBenefits.find((x) => x.id === id)
      if (!b) continue
      const amt = benefitAmount(b, basic)
      if (b.kind === 'allowance') add += amt
      else sub += amt
    }
    return { add, sub, net: basic + add - sub }
  }

  const preview = editing ? estimate(Number(editing.form.basic) || 0, editing.form.benefitIds) : null

  const save = () => {
    if (!editing) return
    const name = editing.form.name.trim()
    if (!name) { setErr('Structure name is required.'); return }
    if (!editing.form.basic || Number(editing.form.basic) <= 0) { setErr('Enter a basic salary.'); return }
    upsertSalaryStructure({
      id: editing.id || uid('ss'),
      name,
      basic: Number(editing.form.basic),
      benefitIds: editing.form.benefitIds,
      description: editing.form.description.trim() || undefined,
    })
    toast.success(editing.id ? 'Structure updated' : 'Structure created', name)
    setEditing(null)
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span>Payroll</span><span>/</span>
        <span className="font-semibold text-inherit">Salary Structure</span>
      </div>
      <PageHeader
        title="Salary Structure"
        desc="Templates combining a basic salary with benefits and deductions — assign them to staff on the Assign Salary page."
        actions={<Button onClick={() => { setEditing({ id: null, form: { name: '', basic: '', benefitIds: [], description: '' } }); setErr('') }}><Plus className="size-4" /> New structure</Button>}
      />

      <div className="card mb-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <p className="text-sm font-bold">Salary structures <span className="text-mist">({salaryStructures.length})</span></p>
          <div className="flex items-center gap-0.5 rounded-xl border border-line bg-white p-1 dark:bg-ink-2">
            {(['table', 'cards'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition ${view === v ? 'bg-lime text-lime-ink' : 'text-zinc-600 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        {view === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 920 }}>
              <thead>
                <tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                  <th className="px-4 py-2.5">Structure</th>
                  <th className="px-3 py-2.5 text-right">Basic</th>
                  <th className="px-3 py-2.5 text-right">Allowances</th>
                  <th className="px-3 py-2.5 text-right">Deductions</th>
                  <th className="px-3 py-2.5 text-right">Estimated net</th>
                  <th className="px-3 py-2.5">Benefits</th>
                  <th className="px-3 py-2.5 text-center">Staff</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {salaryStructures.map((st) => {
                  const e = estimate(st.basic, st.benefitIds)
                  return (
                    <tr key={st.id} className="border-b border-line last:border-0 hover:bg-lime/[0.03]">
                      <td className="px-4 py-2.5">
                        <p className="font-bold">{st.name}</p>
                        <p className="max-w-[260px] truncate text-[11px] text-mist">{st.description || 'Salary template'}</p>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold">{ghs(st.basic)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-lime">+ {ghs(e.add)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-rose-400">− {ghs(e.sub)}</td>
                      <td className="px-3 py-2.5 text-right font-extrabold text-lime">{ghs(e.net)}</td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-1.5" title={st.benefitIds.map((id) => salaryBenefits.find((b) => b.id === id)?.name || id).join(', ')}>
                          {st.benefitIds.map((id) => {
                            const b = salaryBenefits.find((x) => x.id === id)
                            return <span key={id} className="size-2 rounded-full" style={{ background: b?.color || '#888' }} />
                          })}
                          <span className="text-xs text-mist">{st.benefitIds.length}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs font-bold">{salaryAssignments.filter((a) => a.structureId === st.id).length}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => { setEditing({ id: st.id, form: { name: st.name, basic: String(st.basic), benefitIds: [...st.benefitIds], description: st.description || '' } }); setErr('') }}><Pencil className="size-4" /></button>
                          <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(st)}><Trash2 className="size-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!salaryStructures.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-mist">No structures yet — create the first template.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {view === 'cards' && (
      <div className="grid gap-4 md:grid-cols-2">
        {salaryStructures.map((st) => {
          const e = estimate(st.basic, st.benefitIds)
          return (
            <div key={st.id} className="card overflow-hidden transition hover:border-lime/40">
              <div className="h-1 bg-lime" />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{st.name}</p>
                    <p className="text-xs text-mist">{st.description || 'Salary template'}</p>
                  </div>
                  <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-bold text-mist">
                    {salaryAssignments.filter((a) => a.structureId === st.id).length} staff
                  </span>
                </div>
                <div className="mt-3 space-y-1.5 text-sm">
                  <p className="flex justify-between"><span className="text-mist">Basic</span><span className="font-bold">{ghs(st.basic)}</span></p>
                  {st.benefitIds.map((id) => {
                    const b = salaryBenefits.find((x) => x.id === id)
                    if (!b) return null
                    const amt = benefitAmount(b, st.basic)
                    return (
                      <p key={id} className="flex justify-between text-[13px]">
                        <span className="flex items-center gap-1.5 text-mist"><span className="size-2 rounded-full" style={{ background: b.color }} /> {b.name}{b.basis === 'percent' ? ` (${b.value}%)` : ''}</span>
                        <span className="font-semibold" style={{ color: b.color }}>{b.kind === 'allowance' ? '+' : '−'} {ghs(amt)}</span>
                      </p>
                    )
                  })}
                  <p className="flex justify-between border-t border-line pt-1.5 font-extrabold"><span>Estimated net</span><span className="text-lime">{ghs(e.net)}</span></p>
                </div>
                <div className="mt-3 flex justify-end gap-1 border-t border-line pt-2">
                  <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => { setEditing({ id: st.id, form: { name: st.name, basic: String(st.basic), benefitIds: [...st.benefitIds], description: st.description || '' } }); setErr('') }}><Pencil className="size-4" /></button>
                  <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(st)}><Trash2 className="size-4" /></button>
                </div>
              </div>
            </div>
          )
        })}
        {!salaryStructures.length && <div className="card col-span-full p-10 text-center text-mist">No structures yet — create the first template.</div>}
      </div>
      )}

      <div className="mt-4 flex justify-end">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
          <ExportButtons filename="salary-structures" rows={salaryStructures.map((st) => ({
            Name: st.name, Basic: st.basic, Benefits: st.benefitIds.map((id) => salaryBenefits.find((b) => b.id === id)?.name || id).join(', '),
            'Estimated net': estimate(st.basic, st.benefitIds).net, Description: st.description || '',
          }))} />
        </div>
      </div>

      {/* Form modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit structure' : 'New salary structure'} wide>
        {editing && (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Structure name" required><Input value={editing.form.name} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, name: e.target.value } })} placeholder="e.g. Senior Trainer" /></Field>
              <Field label="Basic salary (GHS)" required><Input type="number" min={0} value={editing.form.basic} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, basic: e.target.value } })} placeholder="e.g. 2500" /></Field>
            </div>
            <Field label="Benefits & deductions included">
              <div className="space-y-1 rounded-xl border border-line p-2">
                {salaryBenefits.map((b) => (
                  <label key={b.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5">
                    <input
                      type="checkbox"
                      className="accent-[#c8f542]"
                      checked={editing.form.benefitIds.includes(b.id)}
                      onChange={() => setEditing({ ...editing, form: { ...editing.form, benefitIds: editing.form.benefitIds.includes(b.id) ? editing.form.benefitIds.filter((x) => x !== b.id) : [...editing.form.benefitIds, b.id] } })}
                    />
                    <span className="size-2 rounded-full" style={{ background: b.color }} />
                    <span className="flex-1 font-semibold">{b.name}</span>
                    <span className="text-[11px] text-mist">{b.kind === 'allowance' ? '+' : '−'} {b.basis === 'percent' ? `${b.value}%` : ghs(b.value)}</span>
                  </label>
                ))}
                {!salaryBenefits.length && <p className="p-2 text-sm text-mist">Define benefits first on the Salary Benefits page.</p>}
              </div>
            </Field>
            {preview && (
              <div className="rounded-xl border border-line p-3 text-sm">
                <p className="flex justify-between"><span className="text-mist">Basic</span><span className="font-bold">{ghs(Number(editing.form.basic) || 0)}</span></p>
                <p className="flex justify-between"><span className="text-mist">Allowances</span><span className="font-bold text-lime">+ {ghs(preview.add)}</span></p>
                <p className="flex justify-between"><span className="text-mist">Deductions</span><span className="font-bold text-rose-400">− {ghs(preview.sub)}</span></p>
                <p className="mt-1 flex justify-between border-t border-line pt-1 font-extrabold"><span>Estimated net</span><span className="text-lime">{ghs(preview.net)}</span></p>
              </div>
            )}
            <Field label="Description"><Textarea value={editing.form.description} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, description: e.target.value } })} placeholder="please provide description" className="placeholder:italic placeholder:text-rose-400" /></Field>
            {err && <p className="text-sm text-ember">{err}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>{editing.id ? 'Save changes' : 'Create structure'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete structure?">
        {deleting && (
          <>
            <p className="text-sm text-mist">Delete <span className="font-semibold text-inherit">{deleting.name}</span>? Staff assigned to it will need a new structure.</p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { deleteSalaryStructure(deleting.id); toast.success('Structure deleted', deleting.name); setDeleting(null) }}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
