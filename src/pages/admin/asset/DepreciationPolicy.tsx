import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Save, RotateCcw, Info, SquarePen, List, ClipboardEdit, ArrowUpDown } from 'lucide-react'
import { PageHeader, Button, Badge, Field, Input, Select } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { annualDepreciation, residualValue } from '../../../lib/assets'
import { DEFAULT_DEPRECIATION_POLICY, type DepreciationPolicyRec } from '../../../lib/assetSettings'
import { formatGhs, uid } from '../../../lib/utils'
import type { DepreciationPolicy as Policy } from '../../../types'

type SortKey = 'no' | 'name' | 'period' | 'rate' | 'status'

export function DepreciationPolicy() {
  const app = useApp()
  const { depreciationPolicies, upsertDepPolicy, depreciationPolicy, setDepreciationPolicy, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  // ---- Policy form ----
  const [form, setForm] = useState<{ id?: string; name: string; period: string; rate: string; status: 'active' | 'inactive' }>({ name: '', period: '', rate: '', status: 'active' })

  // ---- List state ----
  const [q, setQ] = useState('')
  const [perPage, setPerPage] = useState(5)
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<SortKey>('no')
  const [sortAsc, setSortAsc] = useState(true)

  // ---- Default fallback policy ----
  const [method, setMethod] = useState<Policy['method']>(depreciationPolicy.method)
  const [years, setYears] = useState(String(depreciationPolicy.usefulLifeYears))
  const [residual, setResidual] = useState(String(depreciationPolicy.residualPercent))

  const save = () => {
    const name = form.name.trim()
    const period = Number(form.period)
    const rate = Number(form.rate)
    if (name.length < 2) { toast.error('Enter a policy name.'); return }
    if (!Number.isFinite(period) || period < 0 || period > 60) { toast.error('Period must be between 0 and 60 years.'); return }
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) { toast.error('Rate must be between 0% and 100%.'); return }
    if (!form.id && depreciationPolicies.some((p) => p.name.toLowerCase() === name.toLowerCase())) { toast.error('A policy with that name already exists.'); return }
    const rec: DepreciationPolicyRec = { id: form.id || uid('dp'), name, period, rate, status: form.status }
    upsertDepPolicy(rec)
    log(user?.id || 'system', form.id ? 'UPDATE' : 'CREATE', 'DepreciationPolicy', `${form.id ? 'Updated' : 'Added'} policy "${name}" — ${period} yr, ${rate}%`)
    toast.success(form.id ? 'Policy updated' : 'Policy added', name)
    setForm({ name: '', period: '', rate: '', status: 'active' })
  }

  const startEdit = (p: DepreciationPolicyRec) => {
    setForm({ id: p.id, name: p.name, period: String(p.period), rate: String(p.rate), status: p.status })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc((s) => !s)
    else { setSortKey(k); setSortAsc(true) }
  }

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const list = depreciationPolicies
      .map((p, i) => ({ ...p, no: i + 1 }))
      .filter((p) => !ql || p.name.toLowerCase().includes(ql) || String(p.period).includes(ql) || String(p.rate).includes(ql) || p.status.includes(ql))
    const dir = sortAsc ? 1 : -1
    return [...list].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir
      if (sortKey === 'period') return (a.period - b.period) * dir
      if (sortKey === 'rate') return (a.rate - b.rate) * dir
      if (sortKey === 'status') return a.status.localeCompare(b.status) * dir
      return (a.no - b.no) * dir
    })
  }, [depreciationPolicies, q, sortKey, sortAsc])

  const pages = Math.max(1, Math.ceil(rows.length / perPage))
  const cur = Math.min(page, pages)
  const slice = rows.slice((cur - 1) * perPage, cur * perPage)

  const exportRows = rows.map((p) => ({ no: p.no, policy: p.name, period: p.period, rate: p.rate, status: p.status }))

  const saveDefault = () => {
    const y = Number(years)
    const r = Number(residual)
    if (!Number.isFinite(y) || y < 1 || y > 50) { toast.error('Useful life must be between 1 and 50 years.'); return }
    if (!Number.isFinite(r) || r < 0 || r > 90) { toast.error('Residual value must be between 0% and 90%.'); return }
    const policy: Policy = { method, usefulLifeYears: Math.round(y), residualPercent: r }
    setDepreciationPolicy(policy)
    log(user?.id || 'system', 'UPDATE', 'DepreciationPolicy', `Set default ${policy.method} policy — ${policy.usefulLifeYears} years, ${policy.residualPercent}% residual`)
    toast.success('Default policy saved')
  }

  const sample = 10000
  const y = Number(years) || 1
  const r = Number(residual) || 0

  const Th = ({ k, children, right }: { k: SortKey; children: ReactNode; right?: boolean }) => (
    <th className={`px-3 py-3 ${right ? 'text-right' : ''}`}>
      <button type="button" onClick={() => toggleSort(k)} className={`flex cursor-pointer items-center gap-1 uppercase tracking-wide ${right ? 'ml-auto' : ''}`}>
        {children} <ArrowUpDown className="size-3 opacity-60" />
      </button>
    </th>
  )

  return (
    <div>
      <PageHeader
        title="Depreciation policy"
        desc="Asset-class depreciation policies — period and rate per class — plus the default fallback applied across the register."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
        {/* ---- Left: form ---- */}
        <div className="space-y-4">
          <div className="card p-5">
            <p className="mb-4 flex items-center gap-2 text-lg font-bold"><ClipboardEdit className="size-5" /> Depreciation Policy</p>
            <div className="space-y-3">
              <Field label="Depreciation Policy">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Computers" disabled={!canManage} />
              </Field>
              <Field label="Period">
                <Input type="number" min={0} max={60} value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="Useful life (years)" disabled={!canManage} />
              </Field>
              <Field label="Rate">
                <Input type="number" min={0} max={100} value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="Annual rate (%)" disabled={!canManage} />
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })} disabled={!canManage}>
                  <option value="active">ACTIVE</option>
                  <option value="inactive">INACTIVE</option>
                </Select>
              </Field>
              {canManage && (
                <div className="flex gap-2 pt-1">
                  <Button className="flex-1 bg-[#2c4a77] text-white hover:bg-[#243d63]" onClick={save}><Save className="size-4" /> {form.id ? 'Save Changes' : 'Save'}</Button>
                  {form.id && <Button variant="outline" onClick={() => setForm({ name: '', period: '', rate: '', status: 'active' })}>Cancel</Button>}
                </div>
              )}
            </div>
          </div>

          {/* ---- Default fallback ---- */}
          <div className="card p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-bold"><Info className="size-4 text-lime" /> Default fallback (assets without a matching policy)</p>
            <div className="space-y-3">
              <Field label="Depreciation method">
                <Select value={method} onChange={(e) => setMethod(e.target.value as Policy['method'])} disabled={!canManage}>
                  <option value="straight_line">Straight-line (equal annual charge)</option>
                  <option value="reducing_balance">Reducing balance (declining charge)</option>
                  <option value="sum_of_years">Sum of Years (accelerated digits)</option>
                </Select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Useful life (years)">
                  <Input type="number" min={1} max={50} value={years} onChange={(e) => setYears(e.target.value)} disabled={!canManage} />
                </Field>
                <Field label="Residual value (%)">
                  <Input type="number" min={0} max={90} value={residual} onChange={(e) => setResidual(e.target.value)} disabled={!canManage} />
                </Field>
              </div>
              <p className="rounded-lg border border-lime/30 bg-lime/5 px-3 py-2 text-xs text-mist">
                A {formatGhs(sample)} asset over {y} yr with {r}% residual → {formatGhs(residualValue(sample, r))} residual, {formatGhs(annualDepreciation(sample, y, r))}/yr.
              </p>
              {canManage && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setMethod(DEFAULT_DEPRECIATION_POLICY.method); setYears(String(DEFAULT_DEPRECIATION_POLICY.usefulLifeYears)); setResidual(String(DEFAULT_DEPRECIATION_POLICY.residualPercent)) }}><RotateCcw className="size-4" /> Reset</Button>
                  <Button onClick={saveDefault}><Save className="size-4" /> Save</Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ---- Right: list ---- */}
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="flex items-center gap-2 text-lg font-bold"><List className="size-5" /> Depreciation Policy List</p>
            <ExportButtons filename="depreciation-policies" rows={exportRows} compact onDone={(label, ok) => ok ? toast.success(`${label} export started`) : toast.error('Export blocked')} />
          </div>

          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <label className="flex items-center gap-2 text-sm text-mist">
              Show
              <Select value={String(perPage)} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }} className="w-20">
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </Select>
              entries
            </label>
            <label className="ml-auto flex items-center gap-2 text-sm text-mist">
              Search:
              <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="w-44" />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs font-bold uppercase tracking-wide text-mist">
                  <Th k="no">No.</Th>
                  <Th k="name">Depreciation Policy</Th>
                  <Th k="period">Period</Th>
                  <Th k="rate">Rate</Th>
                  <Th k="status">Status</Th>
                  <th className="px-3 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {slice.map((p) => (
                  <tr key={p.id} className="transition even:bg-black/[0.03] hover:bg-black/[0.04] dark:even:bg-white/[0.03] dark:hover:bg-white/[0.05]">
                    <td className="px-3 py-3 text-mist">{p.no}</td>
                    <td className="px-3 py-3 font-semibold">{p.name}</td>
                    <td className="px-3 py-3">{p.period}</td>
                    <td className="px-3 py-3">{p.rate}</td>
                    <td className="px-3 py-3"><Badge tone={p.status === 'active' ? 'lime' : 'zinc'}>{p.status === 'active' ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="px-3 py-3">
                      {canManage && (
                        <button type="button" onClick={() => startEdit(p)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#2c4a77] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#243d63]">
                          <SquarePen className="size-3.5" /> Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!slice.length && <p className="px-4 py-8 text-center text-sm text-mist">No policies match your search.</p>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-mist">
            <span>Showing {rows.length === 0 ? 0 : (cur - 1) * perPage + 1} to {Math.min(cur * perPage, rows.length)} of {rows.length} entries</span>
            <span className="flex items-center gap-1">
              <button type="button" disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="cursor-pointer rounded-md border border-line px-3 py-1.5 font-semibold transition enabled:hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-40 dark:enabled:hover:bg-white/[0.06]">Previous</button>
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" onClick={() => setPage(n)} className={`cursor-pointer rounded-md px-3 py-1.5 font-bold transition ${n === cur ? 'bg-[#2c4a77] text-white' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`}>{n}</button>
              ))}
              <button type="button" disabled={cur >= pages} onClick={() => setPage(cur + 1)} className="cursor-pointer rounded-md border border-line px-3 py-1.5 font-semibold transition enabled:hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-40 dark:enabled:hover:bg-white/[0.06]">Next</button>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
