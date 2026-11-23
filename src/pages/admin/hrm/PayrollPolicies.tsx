import { useState } from 'react'
import { Plus, Pencil, Trash2, Calculator, ShieldCheck } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input } from '../../../components/ui'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { useApp } from '../../../context/AppContext'
import { formatGhsExact, uid } from '../../../lib/utils'
import { loadTaxBrackets, saveTaxBrackets, taxOn, effectiveRate, loadSSPolicies, saveSSPolicies, ssContribution, type TaxBracket, type SocialSecurityPolicy } from '../../../lib/payrollExtras'

// ---------------------------------------------------------------------------
export function PayrollTaxPoliciesPage() {
  const { log } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [brackets, setBrackets] = useState<TaxBracket[]>(() => loadTaxBrackets())
  const [editing, setEditing] = useState<{ id?: string; name: string; upTo: string; ratePct: string } | null>(null)
  const [sample, setSample] = useState('5000')

  const persist = (next: TaxBracket[]) => { setBrackets(next); saveTaxBrackets(next) }
  const sampleTax = taxOn(Number(sample) || 0, brackets)

  const save = () => {
    if (!editing) return
    const rate = Number(editing.ratePct)
    const upTo = editing.upTo.trim() === '' ? null : Number(editing.upTo)
    if (!editing.name.trim()) { toast.error('Band name is required.'); return }
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) { toast.error('Rate must be 0–100%.'); return }
    if (upTo !== null && (!Number.isFinite(upTo) || upTo <= 0)) { toast.error('Band width must be positive (blank = top band).'); return }
    const rec: TaxBracket = { id: editing.id || uid('tb'), name: editing.name.trim(), upTo, ratePct: rate, active: editing.id ? brackets.find((b) => b.id === editing.id)?.active ?? true : true }
    persist(editing.id ? brackets.map((b) => (b.id === rec.id ? rec : b)) : [...brackets, rec])
    log(user?.id || 'system', editing.id ? 'UPDATE' : 'CREATE', 'TaxPolicy', `${editing.id ? 'Updated' : 'Added'} tax band ${rec.name}`)
    toast.success('Tax band saved')
    setEditing(null)
  }

  const toggle = (b: TaxBracket) => persist(brackets.map((x) => (x.id === b.id ? { ...x, active: !x.active } : x)))

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist"><span>Human Resources</span><span>/</span><span>Payroll</span><span>/</span><span className="font-semibold text-inherit">Tax Policies</span></div>
      <PageHeader title="Tax Policies" desc="Progressive PAYE bands (monthly). Tax is applied band-by-band over the width of each band."
        actions={canManage ? <Button onClick={() => setEditing({ name: '', upTo: '', ratePct: '' })}><Plus className="size-4" /> New band</Button> : undefined} />

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <div className="card flex items-center gap-3 p-4 xl:col-span-1">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-black/5 dark:bg-white/10"><Calculator className="size-5" /></span>
          <div className="w-full">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-mist">Try a monthly salary</p>
            <div className="mt-1 flex items-center gap-2">
              <Input type="number" min={0} value={sample} onChange={(e) => setSample(e.target.value)} className="w-32" aria-label="Sample salary" />
              <p className="text-sm font-extrabold">→ {formatGhsExact(sampleTax)} <span className="text-[11px] font-bold text-mist">({effectiveRate(Number(sample) || 0, sampleTax)}% effective)</span></p>
            </div>
          </div>
        </div>
        <div className="card overflow-hidden xl:col-span-2">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-line text-left text-[10px] font-bold uppercase tracking-wider text-mist">
              <th className="px-4 py-2.5">Band</th><th className="px-4 py-2.5 text-right">Width (GHS)</th><th className="px-4 py-2.5 text-right">Rate</th><th className="px-4 py-2.5 text-center">Active</th>{canManage && <th className="px-4 py-2.5 text-right">Actions</th>}
            </tr></thead>
            <tbody>
              {brackets.map((b) => (
                <tr key={b.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 font-bold">{b.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{b.upTo === null ? '∞ (top)' : b.upTo}</td>
                  <td className="px-4 py-2 text-right font-extrabold tabular-nums">{b.ratePct}%</td>
                  <td className="px-4 py-2 text-center">
                    <button disabled={!canManage} onClick={() => toggle(b)} className={`h-5 w-9 rounded-full transition ${b.active ? 'bg-lime' : 'bg-zinc-300 dark:bg-zinc-600'}`} aria-label={`Toggle ${b.name}`}>
                      <span className={`block size-4 rounded-full bg-white transition ${b.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                  {canManage && <td className="px-4 py-2"><span className="flex justify-end gap-1">
                    <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => setEditing({ id: b.id, name: b.name, upTo: b.upTo === null ? '' : String(b.upTo), ratePct: String(b.ratePct) })}><Pencil className="size-4" /></button>
                    <button className="rounded-lg p-2 text-mist hover:text-ember" onClick={() => { persist(brackets.filter((x) => x.id !== b.id)); toast.success('Band deleted') }}><Trash2 className="size-4" /></button>
                  </span></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit band' : 'New tax band'}>
        {editing && (
          <div className="grid gap-3">
            <Field label="Band name" required><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Band width (blank = top)"><Input type="number" min={0} value={editing.upTo} onChange={(e) => setEditing({ ...editing, upTo: e.target.value })} /></Field>
              <Field label="Rate %"><Input type="number" min={0} max={100} value={editing.ratePct} onChange={(e) => setEditing({ ...editing, ratePct: e.target.value })} /></Field>
            </div>
            <div className="flex gap-2"><Button className="flex-1" onClick={save}>Save band</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
export function PayrollSocialSecurityPage() {
  const { log } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [policies, setPolicies] = useState<SocialSecurityPolicy[]>(() => loadSSPolicies())
  const [editing, setEditing] = useState<{ id?: string; name: string; employeePct: string; employerPct: string; cap: string } | null>(null)

  const persist = (next: SocialSecurityPolicy[]) => { setPolicies(next); saveSSPolicies(next) }
  const sample = ssContribution(10000, { id: 'x', name: '', employeePct: policies.filter((p) => p.active).reduce((n, p) => n + p.employeePct, 0), employerPct: policies.filter((p) => p.active).reduce((n, p) => n + p.employerPct, 0), cap: null, active: true })

  const save = () => {
    if (!editing) return
    const emp = Number(editing.employeePct) || 0, er = Number(editing.employerPct) || 0
    const cap = editing.cap.trim() === '' ? null : Number(editing.cap)
    if (!editing.name.trim()) { toast.error('Policy name is required.'); return }
    if (emp < 0 || er < 0 || emp > 100 || er > 100) { toast.error('Percentages must be 0–100.'); return }
    const rec: SocialSecurityPolicy = { id: editing.id || uid('ss'), name: editing.name.trim(), employeePct: emp, employerPct: er, cap, active: editing.id ? policies.find((p) => p.id === editing.id)?.active ?? true : true }
    persist(editing.id ? policies.map((p) => (p.id === rec.id ? rec : p)) : [...policies, rec])
    log(user?.id || 'system', editing.id ? 'UPDATE' : 'CREATE', 'SSPolicy', `${editing.id ? 'Updated' : 'Added'} ${rec.name}`)
    toast.success('Policy saved')
    setEditing(null)
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist"><span>Human Resources</span><span>/</span><span>Payroll</span><span>/</span><span className="font-semibold text-inherit">Social Security Policies</span></div>
      <PageHeader title="Social Security Policies" desc={`Statutory contribution tiers. Example on GHS 10,000 gross: employee ${formatGhsExact(sample.employee)} · employer ${formatGhsExact(sample.employer)}.`}
        actions={canManage ? <Button onClick={() => setEditing({ name: '', employeePct: '', employerPct: '', cap: '' })}><Plus className="size-4" /> New policy</Button> : undefined} />
      <div className="card mb-4 flex items-center gap-3 p-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-600"><ShieldCheck className="size-5" /></span>
        <div><p className="text-[11px] font-extrabold uppercase tracking-wider text-mist">On GHS 10,000 gross</p><p className="text-sm font-extrabold">Employee pays {formatGhsExact(sample.employee)} · Employer pays {formatGhsExact(sample.employer)}</p></div>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full min-w-[680px] text-xs">
          <thead><tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
            <th className="px-4 py-2.5">Policy</th><th className="px-4 py-2.5 text-right">Employee %</th><th className="px-4 py-2.5 text-right">Employer %</th><th className="px-4 py-2.5 text-right">Monthly cap</th><th className="px-4 py-2.5 text-center">Active</th>{canManage && <th className="px-4 py-2.5 text-right">Actions</th>}
          </tr></thead>
          <tbody>
            {policies.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 font-bold">{p.name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{p.employeePct}%</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{p.employerPct}%</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{p.cap === null ? '—' : formatGhsExact(p.cap)}</td>
                <td className="px-4 py-2.5 text-center">
                  <button disabled={!canManage} onClick={() => persist(policies.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)))} className={`h-5 w-9 rounded-full transition ${p.active ? 'bg-lime' : 'bg-zinc-300 dark:bg-zinc-600'}`} aria-label={`Toggle ${p.name}`}>
                    <span className={`block size-4 rounded-full bg-white transition ${p.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </td>
                {canManage && <td className="px-4 py-2.5"><span className="flex justify-end gap-1">
                  <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => setEditing({ id: p.id, name: p.name, employeePct: String(p.employeePct), employerPct: String(p.employerPct), cap: p.cap === null ? '' : String(p.cap) })}><Pencil className="size-4" /></button>
                  <button className="rounded-lg p-2 text-mist hover:text-ember" onClick={() => { persist(policies.filter((x) => x.id !== p.id)); toast.success('Policy deleted') }}><Trash2 className="size-4" /></button>
                </span></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit policy' : 'New social security policy'}>
        {editing && (
          <div className="grid gap-3">
            <Field label="Policy name" required><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Tier 2 — Occupational" /></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Employee %"><Input type="number" min={0} max={100} value={editing.employeePct} onChange={(e) => setEditing({ ...editing, employeePct: e.target.value })} /></Field>
              <Field label="Employer %"><Input type="number" min={0} max={100} value={editing.employerPct} onChange={(e) => setEditing({ ...editing, employerPct: e.target.value })} /></Field>
              <Field label="Cap (blank = none)"><Input type="number" min={0} value={editing.cap} onChange={(e) => setEditing({ ...editing, cap: e.target.value })} /></Field>
            </div>
            <div className="flex gap-2"><Button className="flex-1" onClick={save}>Save policy</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
          </div>
        )}
      </Modal>
    </div>
  )
}
