import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import Swal from 'sweetalert2'
import { Button, Field, Input, Modal, PageHeader, Textarea } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { loadEduRecords, saveEduRecords, type EduRecords, type EduRow } from '../../../lib/eduRecords'
import { subscribeDbHydrated } from '../../../lib/mysqlBridge'
import { uid } from '../../../lib/utils'

type FeeItem = { feeTypeId: string; name: string; dueDate: string; amount: string }
function readItems(value: unknown): FeeItem[] {
  try {
    const data = JSON.parse(String(value || '[]'))
    if (!Array.isArray(data)) return []
    return data.filter(x => x && typeof x === 'object').map(x => ({ feeTypeId: String(x.feeTypeId ?? ''), name: String(x.name ?? ''), dueDate: String(x.dueDate ?? ''), amount: String(x.amount ?? '') })).filter(x => x.feeTypeId)
  } catch { return [] }
}

export function FeesGroupPage() {
  const { activeBranchId, branches } = useApp()
  const branch = branches.find(b => b.id === activeBranchId)
  const branchName = branch?.name ?? ''
  const { toast } = useToast()
  const [records, setRecords] = useState<EduRecords>(() => loadEduRecords(activeBranchId, branchName))
  const [editingId, setEditingId] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<FeeItem[]>([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    const refresh = () => setRecords(loadEduRecords(activeBranchId, branchName))
    refresh(); setModalOpen(false); setEditingId(''); setName(''); setDescription(''); setItems([]); setError('')
    const unsub = subscribeDbHydrated(refresh)
    window.addEventListener('focus', refresh)
    return () => { unsub(); window.removeEventListener('focus', refresh) }
  }, [activeBranchId, branchName])
  const types = records.feeTypes ?? []
  const displayed = useMemo(() => {
    const available = types.filter(t => !/^(disabled|inactive)$/i.test(String(t.status ?? '').trim()) || items.some(i => i.feeTypeId === t.id))
    const missing: EduRow[] = items.filter(i => !types.some(t => t.id === i.feeTypeId)).map(i => ({ id: i.feeTypeId, name: i.name, status: 'Removed' }))
    return [...available, ...missing]
  }, [types, items])
  const groups = (records.feeGroups ?? []).filter(r => `${r.name ?? ''} ${r.description ?? ''} ${readItems(r.itemsJson).map(i => i.name).join(' ')}`.toLowerCase().includes(search.toLowerCase().trim()))
  const reset = () => { setEditingId(''); setName(''); setDescription(''); setItems([]); setError('') }
  const closeModal = () => { setModalOpen(false); reset() }
  const toggle = (t: EduRow, checked: boolean) => setItems(prev => checked ? [...prev, { feeTypeId: t.id, name: String(t.name ?? ''), dueDate: '', amount: String(t.defaultAmount ?? '0') }] : prev.filter(i => i.feeTypeId !== t.id))
  const update = (id: string, patch: Partial<FeeItem>) => setItems(prev => prev.map(i => i.feeTypeId === id ? { ...i, ...patch } : i))
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Enter a group name.'); return }
    if (items.some(i => !i.dueDate || i.amount.trim() === '' || !Number.isFinite(Number(i.amount)) || Number(i.amount) < 0)) { setError('Each selected fee type needs a due date and a valid, non-negative amount.'); return }
    const latest = loadEduRecords(activeBranchId, branchName)
    const prior = (latest.feeGroups ?? []).find(r => r.id === editingId)
    if (editingId && !prior) { setError('This group no longer exists. Cancel and create a new group.'); return }
    const row: EduRow = { ...(prior ?? {}), id: editingId || uid(), name: name.trim(), description: description.trim(), itemsJson: JSON.stringify(items.map(i => ({ ...i, name: String(types.find(t => t.id === i.feeTypeId)?.name ?? i.name) }))) }
    const next = { ...latest, feeGroups: editingId ? (latest.feeGroups ?? []).map(r => r.id === editingId ? row : r) : [...(latest.feeGroups ?? []), row] }
    saveEduRecords(activeBranchId, next); setRecords(next); toast(editingId ? 'Fees group updated' : 'Fees group added', 'success'); closeModal()
  }
  const edit = (r: EduRow) => { setEditingId(r.id); setName(String(r.name ?? '')); setDescription(String(r.description ?? '')); setItems(readItems(r.itemsJson)); setError(''); setModalOpen(true) }
  const remove = async (r: EduRow) => {
    const confirmation = await Swal.fire({ title: 'Delete fees group?', text: `Delete ${r.name}?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc2626' })
    if (!confirmation.isConfirmed) return
    const latest = loadEduRecords(activeBranchId, branchName)
    const next = { ...latest, feeGroups: (latest.feeGroups ?? []).filter(g => g.id !== r.id) }
    saveEduRecords(activeBranchId, next); setRecords(next); if (editingId === r.id) reset(); toast('Fees group deleted', 'info')
  }
  const cell = 'border-b border-line px-3 py-2 text-left'
  return <div className="space-y-5">
    <PageHeader title="Fees Group" desc="Group fee items with their due dates and amounts" />
    <Modal open={modalOpen} onClose={closeModal} title={editingId ? 'Edit Fees Group' : 'Add Fees Group'} maxWidth="5xl">
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2"><Field label="Group Name" required><Input value={name} onChange={e => setName(e.target.value)} placeholder="Enter group name" /></Field><Field label="Description"><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></Field></div>
      <div className="overflow-x-auto rounded-lg border border-line"><table className="w-full text-sm"><thead className="bg-muted"><tr><th className={cell}><input type="checkbox" aria-label="Select all fee types" checked={displayed.length > 0 && displayed.every(t => items.some(i => i.feeTypeId === t.id))} onChange={e => { if (e.target.checked) setItems(prev => [...prev, ...displayed.filter(t => !prev.some(i => i.feeTypeId === t.id)).map(t => ({ feeTypeId: t.id, name: String(t.name ?? ''), dueDate: '', amount: String(t.defaultAmount ?? '0') }))]); else setItems(prev => prev.filter(i => !displayed.some(t => t.id === i.feeTypeId))) }} /></th><th className={cell}>Fees Type</th><th className={cell}>Due Date <span className="text-red-500">*</span></th><th className={cell}>Amount <span className="text-red-500">*</span></th></tr></thead><tbody>{displayed.map(t => { const item = items.find(i => i.feeTypeId === t.id); return <tr key={t.id}><td className={cell}><input type="checkbox" aria-label={`Select ${t.name}`} checked={!!item} onChange={e => toggle(t, e.target.checked)} /></td><td className={cell}>{t.name}{t.status === 'Removed' ? ' (removed)' : /^(disabled|inactive)$/i.test(String(t.status ?? '')) ? ' (disabled)' : ''}</td><td className={cell}><Input aria-label={`Due date for ${t.name}`} type="date" value={item?.dueDate ?? ''} disabled={!item} onChange={e => update(t.id, { dueDate: e.target.value })} /></td><td className={cell}><Input aria-label={`Amount for ${t.name}`} type="number" min="0" step="0.01" value={item?.amount ?? String(t.defaultAmount ?? '0')} disabled={!item} onChange={e => update(t.id, { amount: e.target.value })} /></td></tr> })}</tbody></table>{displayed.length === 0 && <p className="p-4 text-sm text-mist">No active fee types. Add them under Fees Type (Fees Item) first.</p>}</div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button><Button type="submit">{editingId ? 'Update' : 'Save'}</Button></div>
    </form>
    </Modal>
    <div className="rounded-xl border border-line bg-surface p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Fees Group List</h2><div className="flex w-full min-w-0 items-center gap-2 sm:w-auto"><Input aria-label="Search fees groups" placeholder="Search fees groups" value={search} onChange={e => setSearch(e.target.value)} className="min-w-0 flex-1" style={{ maxWidth: 240 }} /><Button type="button" onClick={() => { reset(); setModalOpen(true) }}><Plus className="size-4" /> Add Fees Group</Button></div></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted"><tr>{['Sl','Branch','Name','Fees Type','Description','Action'].map(x => <th className={cell} key={x}>{x}</th>)}</tr></thead><tbody>{groups.map((r, i) => <tr key={r.id}><td className={cell}>{i + 1}</td><td className={cell}>{branchName}</td><td className={cell}>{r.name}</td><td className={cell}>{readItems(r.itemsJson).map(item => <div key={item.feeTypeId}>{item.name} — {Number(item.amount).toFixed(2)} <span className="text-mist">(Due {item.dueDate})</span></div>)}</td><td className={cell}>{r.description}</td><td className={cell}><div className="flex gap-1"><button type="button" aria-label={`Edit ${r.name}`} onClick={() => edit(r)} className="rounded p-2 hover:bg-muted"><Pencil className="size-4" /></button><button type="button" aria-label={`Delete ${r.name}`} onClick={() => void remove(r)} className="rounded p-2 text-red-600 hover:bg-red-500/10"><Trash2 className="size-4" /></button></div></td></tr>)}</tbody></table>{!groups.length && <p className="p-4 text-sm text-mist">No fees groups found.</p>}</div></div>
  </div>
}
