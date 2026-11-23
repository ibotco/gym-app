import { useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import Swal from 'sweetalert2'
import { Button, Field, Input, Modal, PageHeader, Select, Switch, Textarea } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { loadEduRecords, saveEduRecords, type EduRecords, type EduRow } from '../../../lib/eduRecords'
import { subscribeDbHydrated } from '../../../lib/mysqlBridge'
import { uid } from '../../../lib/utils'

function parseGroups(value: unknown): string[] {
  try { const arr = JSON.parse(String(value || '[]')); return Array.isArray(arr) ? arr.filter(x => typeof x === 'string') : [] } catch { return [] }
}
export function FeesDiscountPage() {
  const { activeBranchId, branches } = useApp()
  const branchName = branches.find(b => b.id === activeBranchId)?.name ?? ''
  const { toast } = useToast()
  const [records, setRecords] = useState<EduRecords>(() => loadEduRecords(activeBranchId, branchName))
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [discountType, setDiscountType] = useState('')
  const [value, setValue] = useState('')
  const [startDate, setStartDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [usageLimit, setUsageLimit] = useState('')
  const [studentLimit, setStudentLimit] = useState('')
  const [applyTo, setApplyTo] = useState('All Fee Groups')
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [active, setActive] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => { const refresh = () => setRecords(loadEduRecords(activeBranchId, branchName)); refresh(); setOpen(false); const unsub = subscribeDbHydrated(refresh); window.addEventListener('focus', refresh); return () => { unsub(); window.removeEventListener('focus', refresh) } }, [activeBranchId, branchName])
  const groups = records.feeGroups ?? []
  const reset = () => { setEditingId(''); setCode(''); setDescription(''); setDiscountType(''); setValue(''); setStartDate(''); setExpiryDate(''); setUsageLimit(''); setStudentLimit(''); setApplyTo('All Fee Groups'); setGroupIds([]); setActive(true); setError('') }
  const close = () => { setOpen(false); reset() }
  const edit = (r: EduRow) => { setEditingId(r.id); setCode(String(r.code ?? r.name ?? '')); setDescription(String(r.description ?? '')); setDiscountType(String(r.discountType ?? '')); setValue(String(r.value ?? '')); setStartDate(String(r.startDate ?? '')); setExpiryDate(String(r.expiryDate ?? '')); setUsageLimit(String(r.usageLimit ?? '')); setStudentLimit(String(r.usageLimitPerStudent ?? '')); setApplyTo(String(r.applyTo ?? 'All Fee Groups')); setGroupIds(parseGroups(r.feeGroupIdsJson)); setActive(!/^(disabled|inactive)$/i.test(String(r.status ?? ''))); setError(''); setOpen(true) }
  const save = (e: FormEvent) => {
    e.preventDefault()
    const cleanCode = code.trim()
    if (!cleanCode) { setError('Enter a discount code.'); return }
    const latest = loadEduRecords(activeBranchId, branchName)
    if ((latest.feesDiscount ?? []).some(r => r.id !== editingId && String(r.code ?? r.name ?? '').trim().toLowerCase() === cleanCode.toLowerCase())) { setError('This discount code already exists in this branch.'); return }
    if (!discountType || !value.trim() || !Number.isFinite(Number(value)) || Number(value) < 0 || (discountType === 'Percentage' && Number(value) > 100)) { setError('Select a discount type and enter a valid non-negative value. Percentages cannot exceed 100.'); return }
    if (!startDate || !expiryDate || expiryDate < startDate) { setError('Enter a start date and an expiry date on or after the start date.'); return }
    if ([usageLimit, studentLimit].some(v => v.trim() !== '' && (!/^\d+$/.test(v.trim()) || Number(v) < 1))) { setError('Usage limits must be positive whole numbers, or blank for unlimited.'); return }
    if (applyTo === 'Specific Fee Groups' && (!groupIds.length || groupIds.some(id => !(latest.feeGroups ?? []).some(g => g.id === id)))) { setError('Select at least one existing fee group.'); return }
    const old = (latest.feesDiscount ?? []).find(r => r.id === editingId)
    if (editingId && !old) { setError('This discount no longer exists.'); return }
    const row: EduRow = { ...(old ?? {}), id: editingId || uid(), name: cleanCode, code: cleanCode, description: description.trim(), discountType, value, startDate, expiryDate, usageLimit: usageLimit.trim(), usageLimitPerStudent: studentLimit.trim(), applyTo, feeGroupIdsJson: JSON.stringify(applyTo === 'Specific Fee Groups' ? groupIds : []), status: active ? 'Active' : 'Disabled' }
    const next = { ...latest, feesDiscount: editingId ? (latest.feesDiscount ?? []).map(r => r.id === editingId ? row : r) : [...(latest.feesDiscount ?? []), row] }
    saveEduRecords(activeBranchId, next); setRecords(next); toast(editingId ? 'Fees discount updated' : 'Fees discount added', 'success'); close()
  }
  const remove = async (r: EduRow) => { const result = await Swal.fire({ title: 'Delete fees discount?', text: `Delete ${r.code || r.name || 'this discount'}?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc2626' }); if (!result.isConfirmed) return; const latest = loadEduRecords(activeBranchId, branchName); const next = { ...latest, feesDiscount: (latest.feesDiscount ?? []).filter(x => x.id !== r.id) }; saveEduRecords(activeBranchId, next); setRecords(next); toast('Fees discount deleted', 'info') }
  const rows = (records.feesDiscount ?? []).filter(r => `${r.code ?? r.name ?? ''} ${r.description ?? ''} ${r.discountType ?? ''} ${r.status ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  const cell = 'border-b border-line px-3 py-2 text-left'
  return <div className="space-y-5">
    <PageHeader title="Fees Discount" desc="Configure discount codes and their eligible fee groups" />
    <div className="rounded-xl border border-line bg-surface p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Fees Discount List</h2><div className="flex w-full min-w-0 items-center gap-2 sm:w-auto"><Input aria-label="Search fees discounts" placeholder="Search discounts" value={search} onChange={e => setSearch(e.target.value)} className="min-w-0 flex-1" style={{ maxWidth: 240 }} /><Button type="button" onClick={() => { reset(); setOpen(true) }}><Plus className="size-4" /> Add Fees Discount</Button></div></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted"><tr>{['Sl', 'Branch', 'Discount Code', 'Description', 'Type', 'Value', 'Start Date', 'Expiry Date', 'Apply To', 'Status', 'Action'].map(x => <th className={cell} key={x}>{x}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={r.id}><td className={cell}>{i + 1}</td><td className={cell}>{branchName}</td><td className={cell}>{r.code || r.name || '—'}</td><td className={cell}>{r.description || '—'}</td><td className={cell}>{r.discountType || '—'}</td><td className={cell}>{r.value || '—'}{r.discountType === 'Percentage' ? '%' : ''}</td><td className={cell}>{r.startDate || '—'}</td><td className={cell}>{r.expiryDate || '—'}</td><td className={cell}>{r.applyTo === 'Specific Fee Groups' ? parseGroups(r.feeGroupIdsJson).map(id => groups.find(g => g.id === id)?.name ?? '(removed group)').join(', ') : (r.applyTo || '—')}</td><td className={cell}>{r.status || '—'}</td><td className={cell}><div className="flex gap-1"><button type="button" aria-label={`Edit ${r.code || r.name || 'discount'}`} onClick={() => edit(r)} className="rounded p-2 hover:bg-muted"><Pencil className="size-4" /></button><button type="button" aria-label={`Delete ${r.code || r.name || 'discount'}`} onClick={() => void remove(r)} className="rounded p-2 text-red-600 hover:bg-red-500/10"><Trash2 className="size-4" /></button></div></td></tr>)}</tbody></table>{!rows.length && <p className="p-4 text-sm text-mist">No fees discounts found.</p>}</div>
    </div>
    <Modal open={open} onClose={close} title={editingId ? 'Edit Fees Discount' : 'Add Fees Discount'} maxWidth="3xl"><form onSubmit={save} className="space-y-4">
      <Field label="Discount Code" required><Input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. EARLY2024, SIBLING50" /><p className="mt-1 text-xs text-mist">Enter a unique code for this branch.</p></Field>
      <Field label="Description"><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Discount Type" required><Select value={discountType} onChange={e => setDiscountType(e.target.value)}><option value="">Select discount type</option><option value="Fixed amount">Fixed amount</option><option value="Percentage">Percentage</option></Select></Field><Field label="Discount Value" required><Input type="number" min="0" max={discountType === 'Percentage' ? '100' : undefined} step="0.01" value={value} onChange={e => setValue(e.target.value)} /></Field></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Start Date" required><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></Field><Field label="Expiry Date" required><Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} /></Field></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Usage Limit"><Input type="number" min="1" step="1" value={usageLimit} onChange={e => setUsageLimit(e.target.value)} /><p className="mt-1 text-xs text-mist">Across all students; leave blank for unlimited.</p></Field><Field label="Usage Limit Per Student"><Input type="number" min="1" step="1" value={studentLimit} onChange={e => setStudentLimit(e.target.value)} /><p className="mt-1 text-xs text-mist">Leave blank for unlimited.</p></Field></div>
      <Field label="Apply To" required><Select value={applyTo} onChange={e => setApplyTo(e.target.value)}><option>All Fee Groups</option><option>Specific Fee Groups</option></Select></Field>
      {applyTo === 'Specific Fee Groups' && <Field label="Fee Groups" required><div className="space-y-2">{groups.map(g => <label key={g.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={groupIds.includes(g.id)} onChange={e => setGroupIds(prev => e.target.checked ? [...prev, g.id] : prev.filter(id => id !== g.id))} />{g.name}</label>)}{!groups.length && <p className="text-sm text-mist">No fee groups available. Add a fees group first.</p>}{groupIds.filter(id => !groups.some(g => g.id === id)).map(id => <label key={id} className="flex items-center gap-2 text-sm text-amber-600"><input type="checkbox" checked onChange={() => setGroupIds(prev => prev.filter(x => x !== id))} />Removed group (uncheck to continue)</label>)}</div></Field>}
      <div className="flex items-center gap-3"><span className="text-sm font-medium">Status</span><Switch aria-label="Discount active" checked={active} onChange={setActive} /><span className="text-sm text-mist">{active ? 'Active' : 'Disabled'}</span></div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={close}>Cancel</Button><Button type="submit">{editingId ? 'Update' : 'Save'}</Button></div>
    </form></Modal>
  </div>
}
