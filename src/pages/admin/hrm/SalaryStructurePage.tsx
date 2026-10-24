import { useState } from 'react'
import { Plus, Pencil, Trash2, Printer, RotateCcw } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Textarea } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import { benefitAmount, benefitAppliesToPeriod, benefitStatusIn, benefitWindowText, invalidStructureAmount, planStructureAmounts, structureAmountsToForm, structureEstimate } from '../../../lib/payroll'
import type { SalaryBenefit, SalaryStructure } from '../../../types'

const ghs = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** A benefit's name, plus the structure's own figure when it has one. */
const benefitText = (st: SalaryStructure, b: SalaryBenefit | undefined, id: string) => {
  if (!b) return id
  const own = st.amounts?.[id]
  const amount = own !== undefined ? ` (${ghs(own)})` : ''
  const window = b.startDate || b.endDate ? ` · ${benefitWindowText(b)}` : ''
  return `${b.name}${amount}${window}`
}

const benefitPeriodLabel = (b: SalaryBenefit) => {
  const status = benefitStatusIn(b)
  return status === 'inactive' ? 'Manually inactive' : status === 'always' ? 'No expiry' : status === 'scheduled' ? 'Starts later' : status === 'expired' ? 'Expired' : 'Included this month'
}

/** `amounts` is the structure's own figure per fixed-amount benefit, as typed. */
interface Form { name: string; basic: string; benefitIds: string[]; amounts: Record<string, string>; description: string }

export function SalaryStructurePage() {
  const { salaryStructures, salaryBenefits, salaryAssignments, upsertSalaryStructure, deleteSalaryStructure } = useApp()
  const toast = useToast()
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null)
  const [deleting, setDeleting] = useState<SalaryStructure | null>(null)
  const [err, setErr] = useState('')
  const [view, setView] = useState<'table' | 'cards'>('table')

  /** What the form would save — only figures that differ from the benefit's own. */
  const planAmounts = (form: Form) => planStructureAmounts(form.benefitIds, form.amounts, salaryBenefits)

  /** The bad figure in the form, if any. */
  const badAmount = (form: Form) => invalidStructureAmount(form.benefitIds, form.amounts, salaryBenefits)

  const estimate = (st: Pick<SalaryStructure, 'basic' | 'benefitIds' | 'amounts'>) => structureEstimate(st, salaryBenefits)

  const preview = editing
    ? structureEstimate({ basic: Number(editing.form.basic) || 0, benefitIds: editing.form.benefitIds, amounts: planAmounts(editing.form) }, salaryBenefits)
    : null

  const save = () => {
    if (!editing) return
    const name = editing.form.name.trim()
    if (!name) { setErr('Structure name is required.'); return }
    if (!editing.form.basic || Number(editing.form.basic) <= 0) { setErr('Enter a basic salary.'); return }
    const bad = badAmount(editing.form)
    if (bad) { setErr(`Enter a valid amount for ${bad} (a number of 0 or more, or clear it).`); return }
    const amounts = planAmounts(editing.form)
    upsertSalaryStructure({
      id: editing.id || uid('ss'),
      name,
      basic: Number(editing.form.basic),
      benefitIds: editing.form.benefitIds,
      amounts: Object.keys(amounts).length ? amounts : undefined,
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
        actions={<Button onClick={() => { setEditing({ id: null, form: { name: '', basic: '', benefitIds: [], amounts: {}, description: '' } }); setErr('') }}><Plus className="size-4" /> New structure</Button>}
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
                  const e = estimate(st)
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
                        <span className="flex items-center gap-1.5" title={st.benefitIds.map((id) => benefitText(st, salaryBenefits.find((b) => b.id === id), id)).join(', ')}>
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
                          <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => { setEditing({ id: st.id, form: { name: st.name, basic: String(st.basic), benefitIds: [...st.benefitIds], amounts: structureAmountsToForm(st.amounts), description: st.description || '' } }); setErr('') }}><Pencil className="size-4" /></button>
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
          const e = estimate(st)
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
                    const own = st.amounts?.[id]
                    const amt = benefitAmount(b, st.basic, own)
                    const applies = benefitAppliesToPeriod(b)
                    return (
                      <div key={id}>
                        <p className="flex justify-between text-[13px]">
                          <span className={`flex items-center gap-1.5 ${applies ? 'text-mist' : 'text-mist/60'}`}><span className="size-2 rounded-full" style={{ background: b.color }} /> {b.name}{b.basis === 'percent' ? ` (${b.value}%)` : own !== undefined ? ` (${ghs(own)})` : ''}</span>
                          <span className={`font-semibold ${applies ? '' : 'text-mist'}`} style={applies ? { color: b.color } : undefined}>{applies ? `${b.kind === 'allowance' ? '+' : '−'} ${ghs(amt)}` : benefitPeriodLabel(b)}</span>
                        </p>
                        {(b.startDate || b.endDate) && <p className="ml-4 text-[10px] text-mist">{benefitWindowText(b)}</p>}
                      </div>
                    )
                  })}
                  <p className="flex justify-between border-t border-line pt-1.5 font-extrabold"><span>Estimated net</span><span className="text-lime">{ghs(e.net)}</span></p>
                </div>
                <div className="mt-3 flex justify-end gap-1 border-t border-line pt-2">
                  <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => { setEditing({ id: st.id, form: { name: st.name, basic: String(st.basic), benefitIds: [...st.benefitIds], amounts: structureAmountsToForm(st.amounts), description: st.description || '' } }); setErr('') }}><Pencil className="size-4" /></button>
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
            Name: st.name, Basic: st.basic, Benefits: st.benefitIds.map((id) => benefitText(st, salaryBenefits.find((b) => b.id === id), id)).join(', '),
            'Estimated net (current payroll month)': estimate(st).net, Description: st.description || '',
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
            <Field
              label="Benefits & deductions included"
              hint="Tick what the structure pays. A benefit or deduction on a fixed amount can be updated right here — type the figure this structure pays (the ↺ button puts the Salary Benefits default back). Percentages are formulas and stay as defined on the benefit."
            >
              <div className="space-y-1 rounded-xl border border-line p-2">
                {salaryBenefits.map((b) => {
                  const checked = editing.form.benefitIds.includes(b.id)
                  const typed = editing.form.amounts[b.id]
                  const own = typed !== undefined && typed.trim() !== '' && Number.isFinite(Number(typed)) && Number(typed) >= 0
                    ? Math.round(Number(typed) * 100) / 100
                    : null
                  const overridden = b.basis === 'fixed' && own !== null && own !== b.value
                  return (
                    <div key={b.id} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-black/5 dark:hover:bg-white/5">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="accent-[#c8f542]"
                          checked={checked}
                          onChange={() => setEditing({ ...editing, form: { ...editing.form, benefitIds: checked ? editing.form.benefitIds.filter((x) => x !== b.id) : [...editing.form.benefitIds, b.id] } })}
                        />
                        <span className="size-2 rounded-full" style={{ background: b.color }} />
                        <span className="truncate font-semibold">{b.name}</span>
                        <span className="text-[11px] font-bold text-mist">{b.kind === 'allowance' ? 'adds' : 'deducts'}</span>
                        {(b.startDate || b.endDate) && <span className="hidden truncate text-[10px] text-mist md:inline">{benefitWindowText(b)} · {benefitPeriodLabel(b)}</span>}
                      </label>
                      {b.basis === 'fixed' ? (
                        <span className="flex shrink-0 items-center gap-1">
                          <span className="text-[11px] font-bold text-mist">{b.kind === 'allowance' ? '+' : '−'} GHS</span>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="text-right"
                            style={{ width: 104 }}
                            aria-label={`${b.name} amount for this structure`}
                            title={`The benefit's own amount is ${ghs(b.value)}`}
                            value={typed ?? String(b.value)}
                            onChange={(e) => setEditing({ ...editing, form: { ...editing.form, amounts: { ...editing.form.amounts, [b.id]: e.target.value } } })}
                          />
                          {overridden && (
                            <button
                              type="button"
                              title={`Use the benefit's own amount (${ghs(b.value)})`}
                              aria-label={`Reset ${b.name} to the benefit's own amount`}
                              className="rounded-lg p-1.5 text-mist hover:text-lime"
                              onClick={() => { const next = { ...editing.form.amounts }; delete next[b.id]; setEditing({ ...editing, form: { ...editing.form, amounts: next } }) }}
                            >
                              <RotateCcw className="size-3.5" />
                            </button>
                          )}
                        </span>
                      ) : (
                        <span className="shrink-0 text-[11px] text-mist">{b.kind === 'allowance' ? '+' : '−'} {b.value}%</span>
                      )}
                    </div>
                  )
                })}
                {!salaryBenefits.length && <p className="p-2 text-sm text-mist">Define benefits first on the Salary Benefits page.</p>}
              </div>
            </Field>
            {preview && (
              <div className="rounded-xl border border-line p-3 text-sm">
                <p className="flex justify-between"><span className="text-mist">Basic</span><span className="font-bold">{ghs(Number(editing.form.basic) || 0)}</span></p>
                <p className="flex justify-between"><span className="text-mist">Allowances</span><span className="font-bold text-lime">+ {ghs(preview.add)}</span></p>
                <p className="flex justify-between"><span className="text-mist">Deductions</span><span className="font-bold text-rose-400">− {ghs(preview.sub)}</span></p>
                <p className="mt-1 flex justify-between border-t border-line pt-1 font-extrabold"><span>Estimated net</span><span className="text-lime">{ghs(preview.net)}</span></p>
                {Object.keys(planAmounts(editing.form)).length > 0 && (
                  <p className="mt-1 text-[11px] text-mist">Includes this structure's own fixed amounts.</p>
                )}
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
