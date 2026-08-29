import { useMemo, useState } from 'react'
import { Printer, TrendingDown, Wallet, CalendarClock, LineChart, Plus, Pencil, Trash2, SlidersHorizontal } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, Textarea, Empty, StatCard, SearchField, DatePicker } from '../../components/ui'
import { ExportButtons } from '../../components/ExportButtons'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhs, formatGhsExact, formatDate, uid } from '../../lib/utils'
import {
  annualDepreciation, accumulatedDepreciation, residualValue, depreciationSchedule,
} from '../../lib/assets'
import { DEPRECIATION_METHODS } from '../../lib/depreciation'
import type { Asset, DepreciationEntry, DepreciationMethod } from '../../types'

type FormState = {
  id?: string
  assetId: string
  amount: string
  date: string
  method: DepreciationMethod
  notes: string
}

const blankForm = (assetId = ''): FormState => ({
  assetId, amount: '', date: new Date().toISOString().slice(0, 10), method: 'straight_line', notes: '',
})

export function AssetDepreciation() {
  const app = useApp()
  const { assets, depreciation, upsertDepreciation, deleteDepreciation, company, log, assetCategories, depreciationPolicy } = app
  const lifeYears = depreciationPolicy.usefulLifeYears
  const residualPct = depreciationPolicy.residualPercent
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff')

  const [q, setQ] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [viewing, setViewing] = useState<Asset | null>(null)
  const [editing, setEditing] = useState<FormState | null>(null)
  const [deleting, setDeleting] = useState<DepreciationEntry | null>(null)

  // Only depreciate assets with a known purchase cost.
  const depreciable = useMemo(() => assets.filter((a) => a.purchaseCost != null && a.purchaseCost > 0), [assets])

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return [...depreciable]
      .filter((a) => {
        if (categoryFilter && a.category !== categoryFilter) return false
        if (!ql) return true
        return a.tag.toLowerCase().includes(ql) || a.name.toLowerCase().includes(ql) || a.category.toLowerCase().includes(ql)
      })
      .sort((a, b) => (a.purchaseDate || '').localeCompare(b.purchaseDate || ''))
  }, [depreciable, q, categoryFilter])

  const totals = useMemo(() => {
    let cost = 0, book = 0, accumulated = 0, annual = 0
    for (const a of depreciable) {
      const c = a.purchaseCost || 0
      const acc = accumulatedDepreciation(c, a.purchaseDate || '', lifeYears, residualPct)
      const bookV = a.currentValue ?? (c - acc)
      cost += c
      accumulated += acc
      book += bookV
      annual += annualDepreciation(c, lifeYears, residualPct)
    }
    return { cost, book, accumulated, annual }
  }, [depreciable])

  const assetName = (id: string) => {
    const a = assets.find((x) => x.id === id)
    return a ? `${a.tag} — ${a.name}` : id
  }

  const manualRows = useMemo(() => [...depreciation].sort((a, b) => b.date.localeCompare(a.date)), [depreciation])
  const manualTotal = manualRows.reduce((s, d) => s + d.amount, 0)

  const save = () => {
    if (!editing) return
    if (!editing.assetId) { toast.error('Select an asset.'); return }
    const amount = Number(editing.amount)
    if (!Number.isFinite(amount) || amount <= 0) { toast.error('Enter a valid amount.'); return }
    if (!editing.date) { toast.error('Select a date.'); return }

    const isNew = !editing.id
    const rec: DepreciationEntry = {
      id: editing.id || uid('dep'),
      assetId: editing.assetId,
      amount,
      date: editing.date,
      method: editing.method,
      notes: editing.notes.trim() || undefined,
      createdAt: isNew ? new Date().toISOString() : (depreciation.find((d) => d.id === editing.id)?.createdAt || new Date().toISOString()),
    }
    upsertDepreciation(rec)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Depreciation', `${isNew ? 'Created' : 'Updated'} ${formatGhs(amount)} for ${assetName(rec.assetId)}`)
    toast.success(isNew ? 'Depreciation recorded' : 'Depreciation updated', formatGhs(amount))
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteDepreciation(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Depreciation', `Deleted ${formatGhs(deleting.amount)} for ${assetName(deleting.assetId)}`)
    toast.success('Depreciation entry deleted', formatGhs(deleting.amount))
    setDeleting(null)
  }

  const exportRows = rows.map((a) => {
    const c = a.purchaseCost || 0
    const acc = accumulatedDepreciation(c, a.purchaseDate || '', lifeYears, residualPct)
    const bookV = a.currentValue ?? (c - acc)
    return {
      tag: a.tag, name: a.name, category: a.category, purchaseDate: a.purchaseDate || '',
      cost: c, residual: residualValue(c, residualPct), accumulatedDepreciation: acc,
      bookValue: bookV, annualDepreciation: annualDepreciation(c, lifeYears, residualPct),
    }
  })

  return (
    <div>
      <PageHeader
        title="Asset depreciation"
        desc={`${depreciationPolicy.method === 'reducing_balance' ? 'Reducing-balance' : 'Straight-line'} depreciation of your fixed assets to a ${depreciationPolicy.residualPercent}% residual value over a ${depreciationPolicy.usefulLifeYears}-year useful life.`}
        actions={
          <>
            <ExportButtons filename="asset-depreciation" rows={exportRows} onDone={(label, ok) => ok ? toast.success(`${label} export started`) : toast.error('Export blocked')} />
            {canManage && <Button onClick={() => setEditing(blankForm())}><Plus className="size-4" /> New depreciation</Button>}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Original cost" value={formatGhs(totals.cost)} icon={<Wallet className="size-4" />} hint={`${rows.length} depreciable assets`} />
        <StatCard label="Book value" value={formatGhs(totals.book)} icon={<LineChart className="size-4" />} hint="current" />
        <StatCard label="Accumulated dep." value={formatGhs(totals.accumulated)} icon={<TrendingDown className="size-4" />} hint="to date" />
        <StatCard label="Annual charge" value={formatGhs(totals.annual)} icon={<CalendarClock className="size-4" />} hint="per year" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Search tag, name…" className="w-full max-w-sm" />
        <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-auto" icon={<SlidersHorizontal className="size-4" />}>
          <option value="">All categories</option>
          {assetCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>

      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Tag</th><th>Asset</th><th>Category</th><th>Purchased</th>
              <th className="text-right">Cost</th><th className="text-right">Accum. dep.</th>
              <th className="text-right">Book value</th><th className="text-right">Annual dep.</th><th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const c = a.purchaseCost || 0
              const acc = accumulatedDepreciation(c, a.purchaseDate || '', lifeYears, residualPct)
              const bookV = a.currentValue ?? (c - acc)
              return (
                <tr key={a.id}>
                  <td className="font-mono text-sm font-bold">{a.tag}</td>
                  <td className="font-semibold">{a.name}</td>
                  <td className="text-mist">{a.category}</td>
                  <td className="text-mist">{a.purchaseDate ? formatDate(a.purchaseDate) : '—'}</td>
                  <td className="text-right">{formatGhs(c)}</td>
                  <td className="text-right text-mist">{formatGhs(acc)}</td>
                  <td className="text-right font-semibold">{formatGhs(bookV)}</td>
                  <td className="text-right text-mist">{formatGhs(annualDepreciation(c, lifeYears, residualPct))}</td>
                  <td className="whitespace-nowrap">
                    <button className="rounded-lg p-2 text-mist hover:text-lime" title="Depreciation schedule" onClick={() => setViewing(a)}><TrendingDown className="size-4" /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!rows.length && <Empty title="No depreciable assets" desc={depreciable.length ? 'Adjust your search or filters.' : 'Assets need a purchase cost to appear here.'} />}
      </div>

      {/* Manual depreciation entries */}
      <div className="mt-6 flex items-end justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Depreciation entries</h2>
          <p className="text-sm text-mist">Manual depreciation journals and adjustments recorded against your assets.</p>
        </div>
        <p className="text-sm text-mist">Total recorded: <span className="font-semibold text-inherit">{formatGhs(manualTotal)}</span></p>
      </div>
      <div className="card table-wrap mt-3">
        <table className="data">
          <thead>
            <tr><th>Date</th><th>Asset</th><th>Method</th><th className="text-right">Amount</th><th>Notes</th><th>ACTIONS</th></tr>
          </thead>
          <tbody>
            {manualRows.map((d) => (
              <tr key={d.id}>
                <td className="text-mist">{formatDate(d.date)}</td>
                <td className="font-semibold">{assetName(d.assetId)}</td>
                <td><Badge tone="zinc">{DEPRECIATION_METHODS.find((m) => m.id === d.method)?.label || d.method}</Badge></td>
                <td className="text-right font-semibold">{formatGhs(d.amount)}</td>
                <td className="text-mist">{d.notes || '—'}</td>
                <td className="whitespace-nowrap">
                  {canManage && (
                    <>
                      <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit entry" onClick={() => setEditing({ id: d.id, assetId: d.assetId, amount: String(d.amount), date: d.date, method: d.method, notes: d.notes || '' })}><Pencil className="size-4" /></button>
                      <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete entry" onClick={() => setDeleting(d)}><Trash2 className="size-4" /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!manualRows.length && <Empty title="No depreciation entries yet" desc="Record a manual depreciation or adjustment with the New depreciation button." />}
      </div>

      {/* Add / edit depreciation entry */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit depreciation entry' : 'New depreciation entry'}>
        {editing && (
          <div className="space-y-3">
            <Field label="Asset" required>
              <Select value={editing.assetId} onChange={(e) => setEditing({ ...editing, assetId: e.target.value })}>
                <option value="">Select asset…</option>
                {assets.map((a) => <option key={a.id} value={a.id}>{a.tag} — {a.name}</option>)}
              </Select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date" required><DatePicker value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} /></Field>
              <Field label="Method">
                <Select value={editing.method} onChange={(e) => setEditing({ ...editing, method: e.target.value as DepreciationMethod })}>
                  {DEPRECIATION_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Amount (GHS)" required>
              <Input type="number" min={0} value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} placeholder="0.00" />
            </Field>
            <Field label="Notes"><Textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} placeholder="Reason for the charge or adjustment…" /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>{editing.id ? 'Save entry' : 'Record depreciation'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete entry */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete depreciation entry?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Delete the <span className="font-semibold text-inherit">{formatGhs(deleting.amount)}</span> entry for <span className="font-semibold text-inherit">{assetName(deleting.assetId)}</span> ({formatDate(deleting.date)})? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={doDelete}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `${viewing.tag} — depreciation schedule` : 'Schedule'} wide>
        {viewing && (() => {
          const c = viewing.purchaseCost || 0
          const schedule = depreciationSchedule(c, viewing.purchaseDate || '', lifeYears, residualPct)
          const bookV = viewing.currentValue ?? (c - accumulatedDepreciation(c, viewing.purchaseDate || '', lifeYears, residualPct))
          return (
            <div className="space-y-3">
              <div id="dep-print" className="rounded-xl bg-white p-6 text-sm text-zinc-900">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display text-lg font-bold">{company.name}</p>
                    <p className="text-xs text-zinc-500">{company.address}</p>
                    <p className="text-xs text-zinc-500">TIN {company.taxId}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold uppercase tracking-wide">Depreciation schedule</p>
                    <p className="font-mono text-xs text-zinc-500">{viewing.tag}</p>
                    <p className="mt-1 text-xs text-zinc-500">{viewing.name}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
                  {[
                    ['Category', viewing.category],
                    ['Purchased', viewing.purchaseDate ? formatDate(viewing.purchaseDate) : '—'],
                    ['Cost', formatGhsExact(c)],
                    ['Method', depreciationPolicy.method === 'reducing_balance' ? 'Reducing balance' : 'Straight-line'],
                    ['Useful life', `${depreciationPolicy.usefulLifeYears} years`],
                    ['Residual value', formatGhsExact(residualValue(c, residualPct))],
                    ['Annual charge', formatGhsExact(annualDepreciation(c, lifeYears, residualPct))],
                    ['Book value', formatGhsExact(bookV)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[10px] uppercase tracking-wide text-zinc-400">{k}</p>
                      <p className="font-semibold">{v}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 overflow-hidden rounded-lg border border-zinc-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-zinc-100 text-left uppercase tracking-wide text-zinc-500">
                        <th className="px-3 py-2">Year</th>
                        <th className="px-3 py-2 text-right">Opening value</th>
                        <th className="px-3 py-2 text-right">Depreciation</th>
                        <th className="px-3 py-2 text-right">Closing value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map((r) => (
                        <tr key={r.year} className="border-t border-zinc-100">
                          <td className="px-3 py-2 font-semibold">{r.year}</td>
                          <td className="px-3 py-2 text-right">{formatGhsExact(r.openingValue)}</td>
                          <td className="px-3 py-2 text-right">{formatGhsExact(r.depreciation)}</td>
                          <td className="px-3 py-2 text-right">{formatGhsExact(r.closingValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="no-print flex gap-2">
                <Button className="flex-1" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
                <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
