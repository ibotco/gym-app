import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import Swal from 'sweetalert2'
import { Button, Field, Input, Modal, PageHeader, Select } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { loadEduRecords, saveEduRecords, type EduRecords, type EduRow } from '../../../lib/eduRecords'
import { subscribeDbHydrated } from '../../../lib/mysqlBridge'
import { uid } from '../../../lib/utils'

type GroupItem = { feeTypeId: string; name: string }
function groupItems(group?: EduRow): GroupItem[] {
  try { const rows = JSON.parse(String(group?.itemsJson ?? '[]')); return Array.isArray(rows) ? rows.filter(x => x?.feeTypeId).map(x => ({ feeTypeId: String(x.feeTypeId), name: String(x.name ?? '') })) : [] } catch { return [] }
}
export function FineSetupPage() {
  const { activeBranchId, branches } = useApp()
  const branchName = branches.find(b => b.id === activeBranchId)?.name ?? ''
  const { toast } = useToast()
  const [records, setRecords] = useState<EduRecords>(() => loadEduRecords(activeBranchId, branchName))
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [feeTypeId, setFeeTypeId] = useState('')
  const [fineType, setFineType] = useState('')
  const [fineValue, setFineValue] = useState('')
  const [frequency, setFrequency] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => { const refresh = () => setRecords(loadEduRecords(activeBranchId, branchName)); refresh(); setOpen(false); const unsub = subscribeDbHydrated(refresh); window.addEventListener('focus', refresh); return () => { unsub(); window.removeEventListener('focus', refresh) } }, [activeBranchId, branchName])
  const groups = records.feeGroups ?? []
  const fees = groupItems(groups.find(g => g.id === groupId))
  const reset = () => { setEditingId(''); setGroupId(''); setFeeTypeId(''); setFineType(''); setFineValue(''); setFrequency(''); setError('') }
  const close = () => { setOpen(false); reset() }
  const edit = (row: EduRow) => { setEditingId(row.id); setGroupId(String(row.groupId ?? '')); setFeeTypeId(String(row.feeTypeId ?? '')); setFineType(String(row.fineType ?? '')); setFineValue(String(row.fineValue ?? row.amount ?? '')); setFrequency(String(row.lateFeeFrequency ?? '')); setError(''); setOpen(true) }
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const group = groups.find(g => g.id === groupId)
    const fee = fees.find(f => f.feeTypeId === feeTypeId)
    if (!group || !fee) { setError('Select a fees group and a fee type in that group.'); return }
    if (!fineType || !frequency) { setError('Select the fine type and late fee frequency.'); return }
    const amount = Number(fineValue)
    if (!fineValue.trim() || !Number.isFinite(amount) || amount < 0 || (fineType === 'Percentage' && amount > 100)) { setError('Enter a valid non-negative fine value; percentages must not exceed 100.'); return }
    const latest = loadEduRecords(activeBranchId, branchName)
    const old = (latest.fineSetup ?? []).find(r => r.id === editingId)
    if (editingId && !old) { setError('This fine setup no longer exists.'); return }
    const row: EduRow = { ...(old ?? {}), id: editingId || uid(), groupId, groupName: String(group.name ?? ''), feeTypeId, feeTypeName: String((latest.feeTypes ?? []).find(t => t.id === feeTypeId)?.name ?? fee.name), fineType, fineValue, lateFeeFrequency: frequency }
    const next = { ...latest, fineSetup: editingId ? (latest.fineSetup ?? []).map(r => r.id === editingId ? row : r) : [...(latest.fineSetup ?? []), row] }
    saveEduRecords(activeBranchId, next); setRecords(next); toast(editingId ? 'Fine setup updated' : 'Fine setup added', 'success'); close()
  }
  const remove = async (r: EduRow) => {
    const result = await Swal.fire({ title: 'Delete fine setup?', text: `Delete the fine for ${r.feeTypeName || r.name || 'this fee type'}?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc2626' })
    if (!result.isConfirmed) return
    const latest = loadEduRecords(activeBranchId, branchName); const next = { ...latest, fineSetup: (latest.fineSetup ?? []).filter(x => x.id !== r.id) }; saveEduRecords(activeBranchId, next); setRecords(next); toast('Fine setup deleted', 'info')
  }
  const rows = (records.fineSetup ?? []).filter(r => `${r.groupName ?? ''} ${r.feeTypeName ?? ''} ${r.name ?? ''} ${r.fineType ?? ''} ${r.lateFeeFrequency ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  const cell = 'border-b border-line px-3 py-2 text-left'
  return <div className="space-y-5">
    <PageHeader title="Fine Setup" desc="Configure late fee rules for fees groups and their items" />
    <div className="rounded-xl border border-line bg-surface p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Fine Setup List</h2><div className="flex w-full min-w-0 items-center gap-2 sm:w-auto"><Input aria-label="Search fine setups" placeholder="Search fine setups" value={search} onChange={e => setSearch(e.target.value)} className="min-w-0 flex-1" style={{ maxWidth: 240 }} /><Button type="button" onClick={() => { reset(); setOpen(true) }}><Plus className="size-4" /> Add Fine Setup</Button></div></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted"><tr>{['Sl', 'Branch', 'Group Name', 'Fees Type Name', 'Fine Type', 'Fine Value', 'Late Fee Frequency', 'Action'].map(x => <th className={cell} key={x}>{x}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={r.id}><td className={cell}>{i + 1}</td><td className={cell}>{branchName}</td><td className={cell}>{groups.find(g => g.id === r.groupId)?.name ?? r.groupName ?? '—'}</td><td className={cell}>{(records.feeTypes ?? []).find(t => t.id === r.feeTypeId)?.name ?? r.feeTypeName ?? r.name ?? '—'}</td><td className={cell}>{r.fineType || '—'}</td><td className={cell}>{r.fineValue ?? r.amount ?? '—'}{r.fineType === 'Percentage' ? '%' : ''}</td><td className={cell}>{r.lateFeeFrequency || '—'}</td><td className={cell}><div className="flex gap-1"><button type="button" aria-label={`Edit ${r.feeTypeName || r.name || 'fine'}`} onClick={() => edit(r)} className="rounded p-2 hover:bg-muted"><Pencil className="size-4" /></button><button type="button" aria-label={`Delete ${r.feeTypeName || r.name || 'fine'}`} onClick={() => void remove(r)} className="rounded p-2 text-red-600 hover:bg-red-500/10"><Trash2 className="size-4" /></button></div></td></tr>)}</tbody></table>{!rows.length && <p className="p-4 text-sm text-mist">No fine setups found.</p>}</div>
    </div>
    <Modal open={open} onClose={close} title={editingId ? 'Edit Fine Setup' : 'Add Fine Setup'} maxWidth="3xl"><form onSubmit={save} className="space-y-4">
      <p className="text-sm text-mist">Branch: {branchName || 'Current branch'}</p>
      <Field label="Group Name" required><Select value={groupId} onChange={e => { setGroupId(e.target.value); setFeeTypeId('') }}><option value="">Select fees group</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</Select></Field>
      <Field label="Fees Type" required><Select value={feeTypeId} disabled={!groupId} onChange={e => setFeeTypeId(e.target.value)}><option value="">{groupId ? 'Select fees type' : 'First select the group'}</option>{fees.map(f => <option key={f.feeTypeId} value={f.feeTypeId}>{(records.feeTypes ?? []).find(t => t.id === f.feeTypeId)?.name ?? f.name}</option>)}</Select>{groupId && !fees.length && <p className="mt-1 text-xs text-mist">Add fee items to this group first.</p>}</Field>
      <Field label="Fine Type" required><Select value={fineType} onChange={e => setFineType(e.target.value)}><option value="">Select fine type</option><option value="Fixed Amount">Fixed Amount</option><option value="Percentage">Percentage</option></Select></Field>
      <Field label="Fine Value" required><Input type="number" min="0" max={fineType === 'Percentage' ? '100' : undefined} step="0.01" value={fineValue} onChange={e => setFineValue(e.target.value)} /></Field>
      <Field label="Late Fee Frequency" required><Select value={frequency} onChange={e => setFrequency(e.target.value)}><option value="">Select frequency</option><option>Once</option><option>Daily</option><option>Weekly</option><option>Monthly</option></Select></Field>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={close}>Cancel</Button><Button type="submit">{editingId ? 'Update' : 'Save'}</Button></div>
    </form></Modal>
  </div>
}
