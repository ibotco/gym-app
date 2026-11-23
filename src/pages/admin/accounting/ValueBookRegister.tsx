import { useEffect, useMemo, useState } from 'react'
import { Pencil, Trash2, Save, Undo2, ArrowLeft, RefreshCw } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, StatusBadge, DatePicker } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'

/**
 * Value Book Register (Perfex-style): three registers behind a tab bar.
 *  - Value Book Issued Register: books handed out (receipt books, voucher books…)
 *  - Value Book Received Register: books received in
 *  - Value Book Item Register: the book types themselves (Book Type + Status)
 */

type VBItem = { id: string; sno: number; bookType: string; status: string }
type IssuedBookLine = { receivedId: string; book: string; serialFrom: string; serialTo: string; receivedClass: string }
type VBIssued = { id: string; sno: number; date: string; accountClass: string; receivedBy: string; contactNo: string; books: IssuedBookLine[]; status: string }
type VBReceived = { id: string; sno: number; date: string; bookType: string; receivedFrom: string; serialFrom: string; serialTo: string; status: string }

const K_ITEMS = 'fitpro_valuebook_items_v1'
const K_ISSUED = 'fitpro_valuebook_issued_v2'
const K_RECEIVED = 'fitpro_valuebook_received_v2'

const SEED_ITEMS: VBItem[] = [
  { id: 'vbi-1', sno: 1, bookType: 'Receipt Book', status: 'Active' },
  { id: 'vbi-2', sno: 2, bookType: 'Payment Voucher', status: 'Active' },
  { id: 'vbi-3', sno: 3, bookType: 'Daily Offering Book', status: 'Active' },
  { id: 'vbi-4', sno: 4, bookType: 'Cheque Book', status: 'Active' },
]
const SEED_ISSUED: VBIssued[] = [
  { id: 'vbis-1', sno: 1, date: '2026-09-08', accountClass: 'Head Office', receivedBy: 'Kwame Mensah', contactNo: '020 111 0001', books: [{ receivedId: 'vbrs-1', book: 'Cheque Book', serialFrom: '1', serialTo: '100', receivedClass: 'Head Office' }], status: 'Active' },
]
const SEED_RECEIVED: VBReceived[] = [
  { id: 'vbrs-1', sno: 1, date: '2023-12-03', bookType: 'Cheque Book', receivedFrom: 'Head Office', serialFrom: '1', serialTo: '100', status: 'Active' },
  { id: 'vbrs-2', sno: 2, date: '2026-09-03', bookType: 'Receipt Book', receivedFrom: 'Head Office', serialFrom: '101', serialTo: '200', status: 'Active' },
]

function load<T>(key: string, seed: T[]): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(seed))
      return seed
    }
    return JSON.parse(raw) as T[]
  } catch {
    return seed
  }
}
const save = (key: string, rows: unknown[]) => {
  try { localStorage.setItem(key, JSON.stringify(rows)) } catch { /* quota */ }
}

type Tab = 'issued' | 'received' | 'items'

export function ValueBookRegisterPage() {
  const { log, branches } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'accountant', 'company_admin')

  const [tab, setTab] = useState<Tab>('issued')
  const [items, setItems] = useState<VBItem[]>(() => load(K_ITEMS, SEED_ITEMS))
  const [issued, setIssued] = useState<VBIssued[]>(() => load(K_ISSUED, SEED_ISSUED))
  const [received, setReceived] = useState<VBReceived[]>(() => load(K_RECEIVED, SEED_RECEIVED))
  useEffect(() => save(K_ITEMS, items), [items])
  useEffect(() => save(K_ISSUED, issued), [issued])
  useEffect(() => save(K_RECEIVED, received), [received])

  // Item form
  const [itemForm, setItemForm] = useState<{ id?: string; bookType: string; status: string }>({ bookType: '', status: 'Active' })
  const [itemDel, setItemDel] = useState<VBItem | null>(null)
  // Issued form
  const [issuedForm, setIssuedForm] = useState({ date: new Date().toISOString().slice(0, 10), accountClass: '', receivedBy: '', contactNo: '' })
  const [issuedSel, setIssuedSel] = useState<string[]>([])
  const [showUndo, setShowUndo] = useState(false)
  const [issuedDel, setIssuedDel] = useState<VBIssued | null>(null)
  // Received form
  const [receivedForm, setReceivedForm] = useState({ id: undefined as string | undefined, date: new Date().toISOString().slice(0, 10), bookType: '', receivedFrom: '', serialFrom: '', serialTo: '', status: 'Active' })
  const [receivedDel, setReceivedDel] = useState<VBReceived | null>(null)

  const activeItems = items.filter((i) => i.status === 'Active')
  const receivedSources = useMemo(() => ['Head Office', ...branches.map((b) => b.name)].filter(Boolean), [branches])

  const saveItem = () => {
    if (!itemForm.bookType.trim()) { toast.error('Book Type is required'); return }
    if (itemForm.id) {
      setItems(items.map((i) => (i.id === itemForm.id ? { ...i, bookType: itemForm.bookType.trim(), status: itemForm.status } : i)))
      toast.success('Book type updated', itemForm.bookType)
    } else {
      setItems([...items, { id: uid('vbi'), sno: items.length ? Math.max(...items.map((i) => i.sno)) + 1 : 1, bookType: itemForm.bookType.trim(), status: itemForm.status }])
      toast.success('Book type saved', itemForm.bookType)
    }
    log(user?.id || 'system', itemForm.id ? 'UPDATE' : 'CREATE', 'ValueBook', `${itemForm.id ? 'Updated' : 'Added'} book type ${itemForm.bookType}`)
    setItemForm({ bookType: '', status: 'Active' })
  }

  const issuedBatchIds = useMemo(
    () => new Set(issued.filter((r) => r.status === 'Active').flatMap((r) => r.books.map((b) => b.receivedId))),
    [issued],
  )
  const availableBooks = useMemo(() => received.filter((r) => !issuedBatchIds.has(r.id)), [received, issuedBatchIds])
  const selectedBooks = received.filter((r) => issuedSel.includes(r.id))

  const saveIssued = () => {
    if (!issuedForm.accountClass) { toast.error('Select an account class'); return }
    if (!issuedForm.receivedBy.trim()) { toast.error('Received by is required'); return }
    if (!issuedSel.length) { toast.error('Check at least one available book'); return }
    const lines: IssuedBookLine[] = selectedBooks.map((r) => ({ receivedId: r.id, book: r.bookType, serialFrom: r.serialFrom, serialTo: r.serialTo, receivedClass: r.receivedFrom }))
    setIssued([...issued, { id: uid('vbis'), sno: issued.length ? Math.max(...issued.map((r) => r.sno)) + 1 : 1, date: issuedForm.date, accountClass: issuedForm.accountClass, receivedBy: issuedForm.receivedBy.trim(), contactNo: issuedForm.contactNo.trim(), books: lines, status: 'Active' }])
    log(user?.id || 'system', 'CREATE', 'ValueBook', `Issued ${lines.length} book batch(es) to ${issuedForm.accountClass} (${issuedForm.receivedBy})`)
    toast.success('Books issued', `${lines.length} batch(es) → ${issuedForm.accountClass}`)
    setIssuedForm({ date: new Date().toISOString().slice(0, 10), accountClass: '', receivedBy: '', contactNo: '' })
    setIssuedSel([])
  }

  const undoIssued = (id: string) => {
    setIssued(issued.map((r) => (r.id === id ? { ...r, status: 'Undo' } : r)))
    log(user?.id || 'system', 'UPDATE', 'ValueBook', `Undone issue #${issued.find((r) => r.id === id)?.sno}`)
    toast.success('Issue undone', 'The books are available again')
  }

  const saveReceived = () => {
    if (!receivedForm.bookType) { toast.error('Select a value book'); return }
    if (!receivedForm.receivedFrom) { toast.error('Select who it was received from'); return }
    const from = Number(receivedForm.serialFrom)
    const to = Number(receivedForm.serialTo)
    if (!receivedForm.serialFrom.trim() || !receivedForm.serialTo.trim() || !Number.isFinite(from) || !Number.isFinite(to) || from > to) {
      toast.error('Serial From must be less than or equal to Serial To')
      return
    }
    const serials = `${String(from).padStart(7, '0')} - ${String(to).padStart(7, '0')}`
    if (receivedForm.id) {
      setReceived(received.map((r) => (r.id === receivedForm.id ? { ...r, ...receivedForm, id: r.id } : r)))
      toast.success('Receipt updated', `${receivedForm.bookType} · ${serials}`)
    } else {
      setReceived([...received, { id: uid('vbrs'), sno: received.length ? Math.max(...received.map((r) => r.sno)) + 1 : 1, date: receivedForm.date, bookType: receivedForm.bookType, receivedFrom: receivedForm.receivedFrom, serialFrom: receivedForm.serialFrom.trim(), serialTo: receivedForm.serialTo.trim(), status: receivedForm.status }])
      toast.success('Book received', `${receivedForm.bookType} ← ${receivedForm.receivedFrom} · ${serials}`)
    }
    log(user?.id || 'system', receivedForm.id ? 'UPDATE' : 'CREATE', 'ValueBook', `${receivedForm.id ? 'Updated' : 'Received'} ${receivedForm.bookType} ${serials}`)
    setReceivedForm({ id: undefined, date: new Date().toISOString().slice(0, 10), bookType: '', receivedFrom: '', serialFrom: '', serialTo: '', status: 'Active' })
  }

  const itemColumns: Column<VBItem>[] = [
    { key: 'sno', header: 'S/No.', sortValue: (v) => String(v.sno), render: (v) => <span>{v.sno}</span> },
    { key: 'bookType', header: 'Book Type', sortValue: (v) => v.bookType, render: (v) => <span className="font-semibold">{v.bookType}</span> },
    { key: 'status', header: 'Status', sortValue: (v) => v.status, render: (v) => <StatusBadge status={v.status} /> },
    {
      key: 'actions', header: 'Action',
      render: (v) => (
        <span className="whitespace-nowrap">
          {canManage && <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => setItemForm({ id: v.id, bookType: v.bookType, status: v.status })}><Pencil className="size-4" /></button>}
          {canManage && <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setItemDel(v)}><Trash2 className="size-4" /></button>}
        </span>
      ),
    },
  ]
  const pad7 = (n: string) => String(Number(n) || 0).padStart(7, '0')
  // Same display format as the sale date (MM/DD/YYYY).
  const saleDateFmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`)
    if (Number.isNaN(d.getTime())) return iso
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
  }

  const issuedColumns: Column<VBIssued>[] = [
    { key: 'sno', header: 'S/No.', sortValue: (v) => String(v.sno), render: (v) => <span>{v.sno}</span> },
    { key: 'date', header: 'Date Issued', sortValue: (v) => v.date, render: (v) => <span className="text-mist">{saleDateFmt(v.date)}</span> },
    { key: 'accountClass', header: 'Account Class', sortValue: (v) => v.accountClass, render: (v) => <span className="font-semibold">{v.accountClass}</span> },
    { key: 'receivedBy', header: 'Received By', sortValue: (v) => v.receivedBy, render: (v) => <span>{v.receivedBy}</span> },
    { key: 'contactNo', header: 'Contact No.', sortValue: (v) => v.contactNo, render: (v) => <span className="text-mist">{v.contactNo || '—'}</span> },
    { key: 'books', header: 'Books', sortValue: (v) => v.books[0]?.book ?? '', render: (v) => <span>{v.books.length ? `${v.books[0].book} ${pad7(v.books[0].serialFrom)}-${pad7(v.books[0].serialTo)}${v.books.length > 1 ? ` (+${v.books.length - 1} more)` : ''}` : '—'}</span> },
    { key: 'status', header: 'Status', sortValue: (v) => v.status, render: (v) => <StatusBadge status={v.status} /> },
    {
      key: 'actions', header: 'Action',
      render: (v) => (
        <span className="whitespace-nowrap">
          {canManage && v.status === 'Active' && <button className="rounded-lg p-2 text-mist hover:text-sky-600 dark:hover:text-sky-400" title="Undo issue" onClick={() => undoIssued(v.id)}><Undo2 className="size-4" /></button>}
          {canManage && <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setIssuedDel(v)}><Trash2 className="size-4" /></button>}
        </span>
      ),
    },
  ]
  const availableColumns: Column<VBReceived>[] = [
    {
      key: 'pick', header: '',
      render: (v) => (
        <input
          type="checkbox"
          className="size-4 accent-lime"
          checked={issuedSel.includes(v.id)}
          onChange={() => setIssuedSel(issuedSel.includes(v.id) ? issuedSel.filter((x) => x !== v.id) : [...issuedSel, v.id])}
          aria-label={`Select ${v.bookType} ${v.serialFrom}-${v.serialTo}`}
        />
      ),
    },
    { key: 'book', header: 'Book', sortValue: (v) => v.bookType, render: (v) => <span className="font-semibold">{v.bookType}</span> },
    { key: 'serial', header: 'Serial', sortValue: (v) => v.serialFrom, render: (v) => <span>{pad7(v.serialFrom)}-{pad7(v.serialTo)}</span> },
  ]
  const selectedColumns: Column<VBReceived>[] = [
    { key: 'sno', header: 'S/No.', sortValue: (v) => String(v.sno), render: (v) => <span>{v.sno}</span> },
    { key: 'book', header: 'Book', sortValue: (v) => v.bookType, render: (v) => <span className="font-semibold">{v.bookType}</span> },
    { key: 'rc', header: 'Received Class', sortValue: (v) => v.receivedFrom, render: (v) => <span>{v.receivedFrom}</span> },
    { key: 'act', header: 'Action', render: (v) => <button className="rounded-lg p-2 text-mist hover:text-ember" title="Remove" onClick={() => setIssuedSel(issuedSel.filter((x) => x !== v.id))}><Trash2 className="size-4" /></button> },
  ]
  const undoColumns: Column<VBIssued>[] = [
    { key: 'sno', header: 'S/No.', sortValue: (v) => String(v.sno), render: (v) => <span>{v.sno}</span> },
    { key: 'date', header: 'Date Issued', sortValue: (v) => v.date, render: (v) => <span className="text-mist">{saleDateFmt(v.date)}</span> },
    { key: 'books', header: 'Book', sortValue: (v) => v.books[0]?.book ?? '', render: (v) => <span>{v.books.map((b) => b.book).join(', ')}</span> },
    { key: 'accountClass', header: 'Received Class', sortValue: (v) => v.accountClass, render: (v) => <span>{v.accountClass}</span> },
  ]
  const receivedColumns: Column<VBReceived>[] = [
    { key: 'sno', header: 'S/No.', sortValue: (v) => String(v.sno), render: (v) => <span>{v.sno}</span> },
    { key: 'date', header: 'Date', sortValue: (v) => v.date, render: (v) => <span className="text-mist">{saleDateFmt(v.date)}</span> },
    { key: 'bookType', header: 'Book List', sortValue: (v) => v.bookType, render: (v) => <span className="font-semibold">{v.bookType}</span> },
    { key: 'receivedFrom', header: 'Received From', sortValue: (v) => v.receivedFrom, render: (v) => <span>{v.receivedFrom}</span> },
    { key: 'serials', header: 'Serial Numbers', sortValue: (v) => v.serialFrom, render: (v) => <span>{v.serialFrom && v.serialTo ? `${pad7(v.serialFrom)} - ${pad7(v.serialTo)}` : '—'}</span> },
    { key: 'status', header: 'Status', sortValue: (v) => v.status, render: (v) => <StatusBadge status={v.status} /> },
    {
      key: 'actions', header: 'Action',
      render: (v) => (
        <span className="whitespace-nowrap">
          {canManage && <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => setReceivedForm({ id: v.id, date: v.date, bookType: v.bookType, receivedFrom: v.receivedFrom, serialFrom: v.serialFrom, serialTo: v.serialTo, status: v.status })}><Pencil className="size-4" /></button>}
          {canManage && <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setReceivedDel(v)}><Trash2 className="size-4" /></button>}
        </span>
      ),
    },
  ]
  const tabs: { id: Tab; label: string }[] = [
    { id: 'issued', label: 'Value Book Issued Register' },
    { id: 'received', label: 'Value Book Received Register' },
    { id: 'items', label: 'Value Book Item Register' },
  ]

  return (
    <div>
      <PageHeader title="Value Book Register" desc="Register of value books issued, received and the book types in use." />

      {/* Tab bar */}
      <div className="settings-catbar segmented-shell mb-4 flex max-w-full flex-wrap items-center gap-0.5 rounded-xl border border-line bg-white p-1 dark:bg-ink-2">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            aria-current={tb.id === tab ? 'page' : undefined}
            className={
              'whitespace-nowrap rounded-lg px-3.5 py-2 text-[13px] font-bold transition ' +
              (tb.id === tab
                ? 'bg-lime text-lime-ink'
                : 'text-zinc-600 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white')
            }
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'items' && (
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <div className="card h-fit p-4">
            <div className="grid gap-3">
              <Field label="Book Type" required>
                <Input value={itemForm.bookType} onChange={(e) => setItemForm({ ...itemForm, bookType: e.target.value })} placeholder="e.g. Receipt Book" />
              </Field>
              <Field label="Status">
                <Select value={itemForm.status} onChange={(e) => setItemForm({ ...itemForm, status: e.target.value })}>
                  <option>Active</option>
                  <option>Inactive</option>
                </Select>
              </Field>
              <Button onClick={saveItem}><Save className="size-4" /> Save</Button>
              {itemForm.id && <Button variant="ghost" onClick={() => { setItemForm({ bookType: '', status: 'Active' }) }}>Cancel edit</Button>}
            </div>
          </div>
          <div className="card">
            <DataTable columns={itemColumns} data={items} rowKey={(v) => v.id} emptyTitle="No book types" emptyDesc="Add your first book type on the left." />
          </div>
        </div>
      )}

      {tab === 'issued' && (
        <>
        <div className="grid gap-4 xl:grid-cols-[300px_1fr_1fr]">
          <div className="card h-fit p-4">
            <div className="grid gap-3">
              <div className="flex items-end gap-2">
                <Field label="Date Issued" className="flex-1"><DatePicker value={issuedForm.date} onChange={(v) => setIssuedForm({ ...issuedForm, date: v })} aria-label="Date issued" /></Field>
                <Button variant="soft" onClick={() => setIssuedForm({ ...issuedForm, date: new Date().toISOString().slice(0, 10) })} title="Set today's date"><RefreshCw className="size-4" /></Button>
              </div>
              <Field label="Account Class" required>
                <Select value={issuedForm.accountClass} onChange={(e) => setIssuedForm({ ...issuedForm, accountClass: e.target.value })} placeholder="Please Select…">
                  {receivedSources.map((src) => (<option key={src} value={src}>{src}</option>))}
                </Select>
              </Field>
              <Field label="Received by" required><Input value={issuedForm.receivedBy} onChange={(e) => setIssuedForm({ ...issuedForm, receivedBy: e.target.value })} placeholder="Person receiving the books" /></Field>
              <Field label="Contact No. of Receipt"><Input value={issuedForm.contactNo} onChange={(e) => setIssuedForm({ ...issuedForm, contactNo: e.target.value })} placeholder="e.g. 020 123 4567" /></Field>
              <Button onClick={saveIssued}><Save className="size-4" /> Save</Button>
            </div>
          </div>

          <div className="card">
            <div className="border-b border-line p-3"><p className="text-sm font-bold">Check to Select the Available Book(s)</p></div>
            <DataTable columns={availableColumns} data={availableBooks} rowKey={(v) => v.id} emptyTitle="No available books" emptyDesc="Receive books in the Received Register first — issued batches disappear from this list." />
          </div>

          <div className="card">
            <div className="flex items-center justify-between gap-2 border-b border-line p-3">
              <button type="button" onClick={() => setShowUndo(!showUndo)} className="text-sm font-bold italic text-ember underline-offset-2 hover:underline">show undo book</button>
              <Button size="sm" variant="outline" onClick={() => { setIssuedSel([]); setIssuedForm({ date: new Date().toISOString().slice(0, 10), accountClass: '', receivedBy: '', contactNo: '' }) }}><ArrowLeft className="size-4" /> Go Back</Button>
            </div>
            {showUndo ? (
              <DataTable columns={undoColumns} data={issued.filter((r) => r.status === 'Undo')} rowKey={(v) => v.id} emptyTitle="No undone issues" emptyDesc="Undo an issue from the register below." />
            ) : (
              <DataTable columns={selectedColumns} data={selectedBooks} rowKey={(v) => v.id} emptyTitle="No data available in table" emptyDesc="Check available books to stage them for this issue." />
            )}
          </div>
        </div>

        <div className="card mt-4">
          <DataTable columns={issuedColumns} data={issued} rowKey={(v) => v.id} emptyTitle="No books issued" emptyDesc="Saved issues appear here." />
        </div>
        </>
      )}

      {tab === 'received' && (
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <div className="card h-fit p-4">
            <div className="grid gap-3">
              <Field label="Date"><DatePicker value={receivedForm.date} onChange={(v) => setReceivedForm({ ...receivedForm, date: v })} aria-label="Date" /></Field>
              <Field label="Received From" required>
                <Select value={receivedForm.receivedFrom} onChange={(e) => setReceivedForm({ ...receivedForm, receivedFrom: e.target.value })} placeholder="Please Select…">
                  {receivedSources.map((src) => (<option key={src} value={src}>{src}</option>))}
                </Select>
              </Field>
              <Field label="Value Book List" required>
                <Select value={receivedForm.bookType} onChange={(e) => setReceivedForm({ ...receivedForm, bookType: e.target.value })} placeholder="Please Select…">
                  {activeItems.map((i) => (<option key={i.id} value={i.bookType}>{i.bookType}</option>))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Serial From"><Input type="number" min={0} value={receivedForm.serialFrom} onChange={(e) => setReceivedForm({ ...receivedForm, serialFrom: e.target.value })} placeholder="1" /></Field>
                <Field label="Serial To"><Input type="number" min={0} value={receivedForm.serialTo} onChange={(e) => setReceivedForm({ ...receivedForm, serialTo: e.target.value })} placeholder="100" /></Field>
              </div>
              <Field label="Status">
                <Select value={receivedForm.status} onChange={(e) => setReceivedForm({ ...receivedForm, status: e.target.value })}>
                  <option>Active</option>
                  <option>Archived</option>
                </Select>
              </Field>
              <Button onClick={saveReceived}><Save className="size-4" /> Save</Button>
              {receivedForm.id && <Button variant="ghost" onClick={() => setReceivedForm({ id: undefined, date: new Date().toISOString().slice(0, 10), bookType: '', receivedFrom: '', serialFrom: '', serialTo: '', status: 'Active' })}>Cancel edit</Button>}
            </div>
          </div>
          <div className="card">
            <DataTable columns={receivedColumns} data={received} rowKey={(v) => v.id} emptyTitle="No books received" emptyDesc="Record your first received value book on the left." />
          </div>
        </div>
      )}

      {/* Delete confirms */}
      <Modal open={!!itemDel} onClose={() => setItemDel(null)} title="Delete book type?">
        {itemDel && (
          <>
            <p className="text-sm text-mist">Delete <span className="font-semibold text-inherit">{itemDel.bookType}</span> from the Value Book Item Register?</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setItemDel(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { setItems(items.filter((i) => i.id !== itemDel.id)); log(user?.id || 'system', 'DELETE', 'ValueBook', `Deleted book type ${itemDel.bookType}`); toast.success('Book type deleted'); setItemDel(null) }}>Delete</Button>
            </div>
          </>
        )}
      </Modal>
      <Modal open={!!issuedDel} onClose={() => setIssuedDel(null)} title="Delete issue record?">
        {issuedDel && (
          <>
            <p className="text-sm text-mist">Delete the issue of <span className="font-semibold text-inherit">{issuedDel.books.map((b) => b.book).join(', ')}</span> to {issuedDel.accountClass} ({issuedDel.receivedBy})?</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIssuedDel(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { setIssued(issued.filter((i) => i.id !== issuedDel.id)); log(user?.id || 'system', 'DELETE', 'ValueBook', `Deleted issue #${issuedDel.sno}`); toast.success('Issue record deleted'); setIssuedDel(null) }}>Delete</Button>
            </div>
          </>
        )}
      </Modal>
      <Modal open={!!receivedDel} onClose={() => setReceivedDel(null)} title="Delete receipt record?">
        {receivedDel && (
          <>
            <p className="text-sm text-mist">Delete the receipt of <span className="font-semibold text-inherit">{receivedDel.bookType}</span> ({receivedDel.serialFrom}–{receivedDel.serialTo}) from {receivedDel.receivedFrom}?</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReceivedDel(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { setReceived(received.filter((i) => i.id !== receivedDel.id)); log(user?.id || 'system', 'DELETE', 'ValueBook', `Deleted receipt ${receivedDel.bookType} ${receivedDel.serialFrom}-${receivedDel.serialTo}`); toast.success('Receipt record deleted'); setReceivedDel(null) }}>Delete</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
