import { useMemo, useState } from 'react'
import { BookText, Plus, Pencil, Trash2, Printer, ArrowUp, ArrowDown } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Textarea, Select, SearchField, Empty } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { userCompanyId } from '../../../lib/accessScope'
import { uid } from '../../../lib/utils'
import {
  loadAccountingPolicies, saveAccountingPolicies, policiesForYear, nextPolicyCode,
  POLICY_NOTE_NUMBER, type AccountingPolicy,
} from '../../../lib/accountingPolicies'

/**
 * Accounting Policies — the narrative disclosures printed as NOTE 1 of the
 * financial statements.
 *
 * This register is deliberately separate from the Chart of Accounts and the
 * Notes to Accounts: policies have no account link, no balance and no posting
 * effect. The statement package merges them in at report time only.
 */
export function AccountingPoliciesPage() {
  const app = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')

  const [policies, setPolicies] = useState<AccountingPolicy[]>(() => loadAccountingPolicies())
  const persist = (next: AccountingPolicy[]) => { setPolicies(next); saveAccountingPolicies(next) }

  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(String(thisYear))
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editing, setEditing] = useState<AccountingPolicy | null>(null)
  const [deleting, setDeleting] = useState<AccountingPolicy | null>(null)
  const [preview, setPreview] = useState(false)

  const years = useMemo(
    () => Array.from(new Set([...policies.map((p) => p.effectiveYear), thisYear])).sort((a, b) => b - a),
    [policies, thisYear],
  )

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return policies
      .filter((p) => String(p.effectiveYear) === year || !year)
      .filter((p) => !statusFilter || (statusFilter === 'active' ? p.isActive : !p.isActive))
      .filter((p) => !ql || `${p.code} ${p.title} ${p.text}`.toLowerCase().includes(ql))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code, undefined, { numeric: true }))
  }, [policies, year, statusFilter, q])

  const blank = (): AccountingPolicy => ({
    id: uid('pol'),
    companyId: userCompanyId(user, app.branches),
    code: nextPolicyCode(policies),
    title: '',
    text: '',
    effectiveYear: Number(year) || thisYear,
    sortOrder: (policies.reduce((m, p) => Math.max(m, p.sortOrder), 0) || 0) + 1,
    isActive: true,
    createdAt: new Date().toISOString(),
  })

  const save = () => {
    if (!editing) return
    if (!editing.code.trim()) { toast.error('Enter the policy code, e.g. 1.7.'); return }
    if (!editing.title.trim()) { toast.error('Enter the policy title.'); return }
    if (!editing.text.trim()) { toast.error('Enter the policy narrative.'); return }
    const clash = policies.find((p) => p.id !== editing.id && p.code.trim() === editing.code.trim() && p.effectiveYear === editing.effectiveYear)
    if (clash) { toast.error('Code already used', `${editing.code} already exists for ${editing.effectiveYear}.`); return }
    const isNew = !policies.some((p) => p.id === editing.id)
    const row: AccountingPolicy = { ...editing, modifiedAt: new Date().toISOString() }
    persist(isNew ? [...policies, row] : policies.map((p) => (p.id === row.id ? row : p)))
    app.log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'AccountingPolicy', `${row.code} ${row.title}`)
    setEditing(null)
    toast.success(isNew ? 'Policy added' : 'Policy updated', `${row.code} ${row.title}`)
  }

  const remove = (p: AccountingPolicy) => {
    persist(policies.filter((x) => x.id !== p.id))
    app.log(user?.id || 'system', 'DELETE', 'AccountingPolicy', `${p.code} ${p.title}`)
    setDeleting(null)
    toast.success('Policy deleted', `${p.code} ${p.title}`)
  }

  const toggleActive = (p: AccountingPolicy) => {
    persist(policies.map((x) => (x.id === p.id ? { ...x, isActive: !x.isActive, modifiedAt: new Date().toISOString() } : x)))
  }

  /** Move a policy up/down the printed order. */
  const nudge = (p: AccountingPolicy, dir: -1 | 1) => {
    const ordered = [...policies].sort((a, b) => a.sortOrder - b.sortOrder)
    const i = ordered.findIndex((x) => x.id === p.id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= ordered.length) return
    const a = ordered[i]
    const b = ordered[j]
    persist(policies.map((x) => (x.id === a.id ? { ...x, sortOrder: b.sortOrder } : x.id === b.id ? { ...x, sortOrder: a.sortOrder } : x)))
  }

  /** Printable NOTE 1 — the same block the statement package merges in. */
  const printPolicies = () => {
    const company = app.companies.find((c) => c.id === userCompanyId(user, app.branches)) ?? app.companies[0]
    const esc = (t: string) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c))
    const list = policiesForYear(policies, Number(year) || thisYear)
    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>ACCOUNTING POLICIES</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 13px; background: #d5d5d5; padding: 20px 0; }
  .sheet { width: 210mm; min-height: 297mm; margin: 0 auto 20px; background: #fff; padding: 15mm; box-shadow: 0 2px 12px rgba(0,0,0,0.25); }
  h1, h2, h3 { text-align: center; margin: 0; }
  h1 { font-size: 20px; } h2 { font-size: 17px; margin-top: 2px; } h3 { font-size: 16px; margin-top: 4px; }
  h4 { margin: 18px 0 6px; font-size: 14px; }
  p.narrative { margin: 0 0 10px; text-align: justify; line-height: 1.5; }
  .actions { text-align: center; margin: 8px 0 24px; }
  .btn { display: inline-block; border: none; border-radius: 4px; padding: 10px 18px; font-size: 14px; font-weight: 600; cursor: pointer; margin: 0 6px; color: #fff; }
  .btn-print { background: #111; } .btn-back { background: #e2542c; }
  @page { size: A4; margin: 15mm; }
  @media print { body { background: #fff; padding: 0; } .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; } .actions { display: none; } }
</style></head>
<body>
  <div class="sheet">
    <h1>${esc((company?.name || 'Company').toUpperCase())}</h1>
    ${company?.location ? `<h2>${esc(company.location)}</h2>` : ''}
    <h3>NOTES TO THE FINANCIAL STATEMENTS</h3>
    <h3>FOR THE YEAR ENDED 31 DECEMBER ${esc(year)}</h3>
    <h4 style="text-align:left">NOTE ${POLICY_NOTE_NUMBER} — ACCOUNTING POLICIES</h4>
    ${list.map((p) => `<h4 style="text-align:left;margin-bottom:2px">${esc(p.code)} ${esc(p.title)}</h4><p class="narrative">${esc(p.text)}</p>`).join('')
      || '<p class="narrative">No active accounting policies for this year.</p>'}
  </div>
  <div class="actions">
    <button class="btn btn-print" onclick="window.print()">&#128424; Click Here to Print</button>
    <button class="btn btn-back" onclick="window.close()">&#8592; Go Back</button>
  </div>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 400); });</script>
</body></html>`
    const win = window.open('', '_blank')
    if (win) { win.document.open(); win.document.write(html); win.document.close() }
  }

  const activeCount = policies.filter((p) => p.isActive && String(p.effectiveYear) === year).length

  return (
    <div>
      <PageHeader
        title="Accounting Policies"
        desc={`The narrative disclosures printed as NOTE ${POLICY_NOTE_NUMBER} of the financial statements. Kept separate from the Chart of Accounts and the Notes to Accounts — policies carry no balances and no postings.`}
        actions={canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => setPreview(true)}><BookText className="size-4" /> Preview NOTE {POLICY_NOTE_NUMBER}</Button>
            <Button variant="ghost" onClick={printPolicies}><Printer className="size-4" /> Print</Button>
            <Button onClick={() => setEditing(blank())}><Plus className="size-4" /> New policy</Button>
          </div>
        ) : undefined}
      />

      <div className="card p-4">
        <div className="mb-4 flex w-full flex-wrap items-end gap-3">
          <div className="w-40"><Field label="Effective year">
            <Select value={year} onChange={(e) => setYear(e.target.value)}>
              {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
            </Select>
          </Field></div>
          <div className="w-40"><Field label="Status">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="All">
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field></div>
          <div className="min-w-[220px] flex-1"><Field label="Search">
            <SearchField value={q} onChange={setQ} placeholder="Code, title or wording…" />
          </Field></div>
          <span className="mb-2 rounded-md bg-black/5 px-2 py-1 text-[11px] font-semibold text-mist dark:bg-white/5">
            {activeCount} active in {year}
          </span>
        </div>

        {rows.length === 0 ? (
          <Empty title="No accounting policies" desc="Add the basis of preparation, revenue recognition and the other disclosures printed as NOTE 1." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-line">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] text-xs">
                <thead>
                  <tr className="bg-[#2e75b6] text-left text-[10px] font-bold uppercase tracking-wider text-white">
                    <th className="w-16 px-3 py-2.5">Code</th>
                    <th className="px-3 py-2.5">Policy title and narrative</th>
                    <th className="w-20 px-3 py-2.5 text-center">Year</th>
                    <th className="w-20 px-3 py-2.5 text-center">Order</th>
                    <th className="w-24 px-3 py-2.5 text-center">Status</th>
                    <th className="w-40 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70 bg-white dark:bg-transparent">
                  {rows.map((p) => (
                    <tr key={p.id} className="align-top transition-colors hover:bg-[#2e75b6]/10">
                      <td className="px-3 py-2.5 font-bold">{p.code}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold">{p.title}</div>
                        <div className="mt-0.5 line-clamp-2 text-[11px] text-mist">{p.text}</div>
                      </td>
                      <td className="px-3 py-2.5 text-center">{p.effectiveYear}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{p.sortOrder}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button type="button" onClick={() => canManage && toggleActive(p)} className={canManage ? 'cursor-pointer' : ''}>
                          <Badge tone={p.isActive ? 'lime' : 'zinc'}>{p.isActive ? 'Active' : 'Inactive'}</Badge>
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        {canManage && (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" onClick={() => nudge(p, -1)} title="Move up"><ArrowUp className="size-4" /></Button>
                            <Button variant="ghost" onClick={() => nudge(p, 1)} title="Move down"><ArrowDown className="size-4" /></Button>
                            <Button variant="ghost" onClick={() => setEditing(p)} title="Edit"><Pencil className="size-4" /></Button>
                            <Button variant="ghost" onClick={() => setDeleting(p)} title="Delete"><Trash2 className="size-4" /></Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ---------------- add / edit ---------------- */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing && policies.some((p) => p.id === editing.id) ? `Edit policy ${editing.code}` : 'New accounting policy'} wide>
        {editing && (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Policy code" required>
                <Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="1.7" />
              </Field>
              <Field label="Effective year" required>
                <Input
                  type="number"
                  value={String(editing.effectiveYear)}
                  onChange={(e) => setEditing({ ...editing, effectiveYear: Number(e.target.value) || thisYear })}
                />
              </Field>
              <Field label="Sort order">
                <Input
                  type="number"
                  value={String(editing.sortOrder)}
                  onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="Status">
                <Select value={editing.isActive ? 'active' : 'inactive'} onChange={(e) => setEditing({ ...editing, isActive: e.target.value === 'active' })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </Field>
            </div>
            <Field label="Policy title" required>
              <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Revenue Recognition" />
            </Field>
            <Field label="Policy narrative" required>
              <Textarea
                rows={8}
                value={editing.text}
                onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                placeholder="Describe the accounting treatment as it should read in the published statements…"
              />
            </Field>
            <p className="text-[11px] text-mist">
              Policies are disclosure text only — saving one never changes an account, a balance or a posting.
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={save}>Save policy</Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------- delete ---------------- */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete this policy?">
        {deleting && (
          <>
            <p className="text-sm text-mist">
              Remove <span className="font-semibold text-inherit">{deleting.code} {deleting.title}</span> from the policy register?
              It will no longer print in NOTE {POLICY_NOTE_NUMBER}. Accounts, balances and the Notes to Accounts are unaffected.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => remove(deleting)}><Trash2 className="size-4" /> Delete policy</Button>
            </div>
          </>
        )}
      </Modal>

      {/* ---------------- NOTE 1 preview ---------------- */}
      <Modal open={preview} onClose={() => setPreview(false)} title={`NOTE ${POLICY_NOTE_NUMBER} — ACCOUNTING POLICIES`} wide>
        <div className="grid gap-3">
          <p className="text-[11px] text-mist">Exactly how the block is merged into the statement package for {year}.</p>
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-line p-4">
            {policiesForYear(policies, Number(year) || thisYear).map((p) => (
              <div key={p.id} className="mb-4">
                <div className="text-sm font-bold text-ink dark:text-white">{p.code} {p.title}</div>
                <p className="mt-1 whitespace-pre-line text-justify text-xs leading-relaxed text-mist">{p.text}</p>
              </div>
            ))}
            {policiesForYear(policies, Number(year) || thisYear).length === 0 && (
              <p className="text-xs text-mist">No active policies for {year}.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={printPolicies}><Printer className="size-4" /> Print</Button>
            <Button variant="ghost" onClick={() => setPreview(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
