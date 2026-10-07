import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, RotateCcw, ChevronsUpDown, WandSparkles } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Textarea, Switch, SearchField } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import { loadAccountNotes, saveAccountNotes } from '../../../lib/accounting'
import { indentFor, orderByParent } from '../../../lib/hierarchy'
import { loadFinancialNoteTemplates } from '../../../lib/financialNoteTemplates'
import type { Account, AccountNote } from '../../../types'

const STATEMENTS: { value: AccountNote['statement']; label: string }[] = [
  { value: 'balance_sheet', label: 'Balance Sheet' },
  { value: 'income_statement', label: 'Income Statement' },
]
const statementLabel = (v: AccountNote['statement']) =>
  STATEMENTS.find((s) => s.value === v)?.label || v

const NOTE_DESCRIPTIONS: Record<string, string> = {
  '11': 'Cash on hand, petty cash, bank balances and mobile-money deposits available on demand.',
  '12': 'Amounts due from students, customers and other debtors, net of impairment allowances.',
  '13': 'Prepayments, advances and deposits expected to be recovered or utilised within the reporting period.',
  '14': 'Short-term investments and deposits held for liquidity management.',
  '15': 'Loans and advances receivable from members, staff or other parties.',
  '16': 'Goods and materials held for resale or consumption, measured at the lower of cost and net realisable value.',
  '17': 'Other current assets not separately presented in the financial statements.',
  '18': 'Leasehold properties and improvements held for use in operations.',
  '19': 'Property, plant and equipment, including buildings, vehicles, furniture and equipment, net of depreciation.',
  '20': 'Bank overdrafts and other credit facilities repayable on demand.',
  '21': 'Amounts owed to suppliers and other trade creditors for goods and services received.',
  '22': 'Accrued expenses and liabilities for services received but not yet invoiced or paid.',
  '23': 'Income received in advance and other deferred income recognised over the relevant service period.',
  '24': 'Taxes, statutory deductions and other amounts payable to tax authorities.',
  '25': 'Loans, borrowings and other financing obligations outstanding at the reporting date.',
  '26': 'Reserves and other appropriations of accumulated funds.',
  '27': 'Adjustments relating to errors or items identified from prior reporting periods.',
  '28': 'Retained earnings or accumulated fund after current-year results and distributions.',
  '31': 'Income from memberships, sales, tuition, services, grants and other ordinary activities.',
  '32': 'Grants, donations and restricted or unrestricted contributions received during the period.',
  '33': 'Income earned outside the entity’s principal activities.',
  '34': 'Employee salaries, wages, benefits, welfare costs and statutory employer contributions.',
  '35': 'General administrative and operating expenses incurred in running the organisation.',
  '36': 'Costs of repairing, servicing and maintaining property, plant and equipment.',
  '37': 'Electricity, water, telecommunications, internet and other utility costs.',
  '38': 'Depreciation charge recognised on depreciable property, plant and equipment.',
  '39': 'Interest, bank charges and other costs of financing.',
  '40': 'Current and deferred tax charges recognised for the reporting period.',
  '41': 'Reconciliation of operating results to net cash generated from operating activities.',
  '42': 'Material transactions that do not involve the movement of cash or cash equivalents.',
  '43': 'Transactions and balances with directors, trustees, key management and related entities.',
  '44': 'Potential obligations whose outcome depends on uncertain future events.',
  '45': 'Contractual commitments and material events occurring after the reporting date.',
  '46': 'Employee support, staff welfare and related welfare programme expenditure.',
  '47': 'General expenses incurred in the ordinary administration and operation of the organisation.',
}

type Form = {
  id?: string
  noteNo: string
  /** The chart-of-accounts account chosen as this note (its parent account). */
  accountId: string
  name: string
  statement: AccountNote['statement']
  parentId: string
  accountIds: string[]
  description: string
  status: 'active' | 'inactive'
}

const blank = (): Form => ({
  noteNo: '', accountId: '', name: '', statement: 'balance_sheet', parentId: '',
  accountIds: [], description: '', status: 'active',
})

/**
 * Accounting → Chart of Accounts → Accounts Note.
 *
 * The numbered disclosures the financial statements refer to. The page mirrors
 * Master Accounts: the same filter bar, the same hover Edit | Delete actions,
 * the same parent-first list, and the same modal form.
 */
export function AccountsNote() {
  const app = useApp()
  const { accounts } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()

  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')
  const canDelete = hasRole('super_admin', 'gym_manager')

  const [notes, setNotes] = useState<AccountNote[]>(() => {
    // Existing saved Notes are authoritative. Do not renumber or rename them on refresh.
    const existing = loadAccountNotes()
    let normalizedExisting = existing
    // Enforce unique note numbers by consolidating duplicate rows and their mappings.
    const byNo = new Map<string, AccountNote>()
    for (const note of normalizedExisting) {
      const prior = byNo.get(note.noteNo)
      if (!prior) byNo.set(note.noteNo, note)
      else byNo.set(note.noteNo, { ...prior, accountIds: Array.from(new Set([...(prior.accountIds || []), ...(note.accountId ? [note.accountId] : []), ...(note.accountIds || [])])) })
    }
    const uniqueExisting = Array.from(byNo.values())
    // Keep one Accounts Note for each normalized name; merge all covered accounts into it.
    const byName = new Map<string, AccountNote>()
    for (const note of uniqueExisting) {
      const rawName = note.name.trim().toLowerCase().replace(/\s+/g, ' ')
      const key = /general\s*(and|&)\s*administrative|^general expenses$/.test(rawName) ? 'general expenses' : /welfare\s*expenses?/.test(rawName) ? 'welfare expenses' : rawName
      const prior = byName.get(key)
      if (!prior) byName.set(key, note)
      else byName.set(key, { ...prior, accountIds: Array.from(new Set([...(prior.accountIds || []), ...(note.accountId ? [note.accountId] : []), ...(note.accountIds || [])])) })
    }
    const renamedExisting = Array.from(byName.values())
      .sort((a, b) => Number(a.noteNo) - Number(b.noteNo) || a.name.localeCompare(b.name))
      .map((n, index) => ({ ...n, noteNo: String(index + 2), name: /general\s*(and|&)\s*administrative|^general expenses$/i.test(n.name) ? 'General Expenses' : /welfare\s*expenses?/i.test(n.name) ? 'Welfare Expenses' : n.name }))
    const used = new Set(renamedExisting.map((n) => n.noteNo))
    saveAccountNotes(renamedExisting)
    const usedNames = new Set(renamedExisting.map((n) => n.name.trim().toLowerCase()))
    const defaults = accounts.filter(a => a.status !== 'inactive' && a.noteNo && !used.has(a.noteNo) && !usedNames.has(a.name.trim().toLowerCase())).map(a => ({
      id: `chart_${a.id}`, noteNo: a.noteNo!, name: a.name, statement: ['income','expense'].includes(a.type) ? 'income_statement' as const : 'balance_sheet' as const,
      description: 'Chart of Accounts note account.', accountId: a.id, accountIds: [], status: 'active' as const,
    }))
    const required: AccountNote[] = []
    const deleted = new Set<string>(JSON.parse(localStorage.getItem('fitpro_deleted_account_notes') || '[]'))
    return [...renamedExisting, ...defaults, ...required].filter(n => !deleted.has(n.name.trim().toLowerCase()))
  })

  // Keep every monetary default note represented by a real top-level Master Account.
  useEffect(() => {
    const seen = new Set<string>()
    const unique = notes.filter(n => { const key = n.name.trim().toLowerCase(); if (seen.has(key) && n.id.startsWith('template_')) return false; seen.add(key); return true })
    const deleted = new Set<string>(JSON.parse(localStorage.getItem('fitpro_deleted_account_notes') || '[]'))
    const ensured = [...unique]
    const kept = ensured.filter(n => !deleted.has(n.name.trim().toLowerCase()))
    const monetary = kept.filter(n => Number(n.noteNo) >= 10 && !n.noteNo.startsWith('1.'))
    let changed = kept.length !== notes.length || kept.some((n, i) => n.name !== (notes[i]?.name || '') || n.description !== (notes[i]?.description || ''))
    const next = kept.map(n => ({ ...n, noteNo: n.name.toLowerCase() === 'general expenses' ? '47' : n.noteNo, name: n.noteNo === '37' ? 'Utilities' : n.noteNo === '21' ? 'Accounts Payable (A/P)' : n.noteNo === '22' ? 'Accrued Expenses' : n.name, description: NOTE_DESCRIPTIONS[n.noteNo] || n.description?.replace('link Chart of Accounts accounts to this note to generate its balances.', 'Financial statement account note.') }))
    for (const note of monetary) {
      if (note.accountId && accounts.some(a => a.id === note.accountId)) continue
      const existing = accounts.find(a => a.code === `FSN-${note.noteNo}` || a.name.toLowerCase() === note.name.toLowerCase())
      const index = next.findIndex(n => n.id === note.id)
      if (existing) { next[index] = { ...next[index], accountId: existing.id }; changed = true; continue }
      const type = note.statement === 'income_statement' ? (['31','32','33'].includes(note.noteNo) ? 'income' : 'expense') : (note.noteNo === '28' ? 'equity' : ['20','21','22','23','24','25'].includes(note.noteNo) ? 'liability' : 'asset')
      const id = uid('noteacct')
      app.upsertAccount({ id, scopeType: 'COMPANY', companyId: app.activeCompanyId, code: `FSN-${note.noteNo}`, name: note.name, type: type as Account['type'], primaryBalance: 0, status: 'active', noteNo: note.noteNo, description: note.description })
      next[index] = { ...next[index], accountId: id }; changed = true
    }
    if (changed) { setNotes(next); saveAccountNotes(next) }
  }, [])
  const persist = (next: AccountNote[]) => { setNotes(next); saveAccountNotes(next) }

  const [noteQ, setNoteQ] = useState('')
  const [statementFilter, setStatementFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('yes')
  const [applied, setApplied] = useState({ noteQ: '', statement: '', active: 'yes' })
  const [sortBy, setSortBy] = useState<'noteNo' | 'name' | 'statement'>('noteNo')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [editing, setEditing] = useState<Form | null>(null)
  const [coverQ, setCoverQ] = useState('')
  const [deleting, setDeleting] = useState<AccountNote | null>(null)

  /** Every Chart of Accounts account is available, including bank accounts. */
  const linkableAccounts = useMemo(
    () => [...accounts]
      .sort((a, b) => (a.code || '').localeCompare(b.code || '') || a.name.localeCompare(b.name)),
    [accounts],
  )
  const accountLabel = (id: string) => {
    const a = accounts.find((x) => x.id === id)
    return a ? `${a.code ? `${a.code} - ` : ''}${a.name}` : id
  }
  // The statement a note belongs to follows the type of its account: income
  // and expense accounts report on the Income Statement, everything else
  // (asset / liability / equity) on the Balance Sheet.
  const statementForType = (t?: Account['type']): AccountNote['statement'] =>
    t === 'income' || t === 'expense' ? 'income_statement' : 'balance_sheet'
  /** A note is an account: always label it with the chart account's name. */
  const noteName = (n: AccountNote) => accounts.find((a) => a.id === n.accountId)?.name || n.name
  const noteStatement = (n: AccountNote): AccountNote['statement'] => {
    const acc = accounts.find((a) => a.id === n.accountId)
    return acc ? statementForType(acc.type) : n.statement
  }

  // Accounts already used as a Note account (top-level parents), and which note
  // currently "owns" each account (as its note account OR as a covered child).
  // Used to keep one account in a single place in the hierarchy.
  const noteAccountIds = useMemo(
    () => new Set(notes.map((n) => n.accountId).filter(Boolean) as string[]),
    [notes],
  )
  const ownerNoteOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const n of notes) {
      if (n.accountId) m.set(n.accountId, n.id)
      for (const id of n.accountIds || []) if (!m.has(id)) m.set(id, n.id)
    }
    return m
  }, [notes])

  /** Every note sits directly under its parent note, one indent per generation. */
  const { rows, depthOf } = useMemo(() => {
    const matched = notes.filter((n) => {
      if (applied.noteQ && !`${n.noteNo} ${noteName(n)}`.toLowerCase().includes(applied.noteQ.toLowerCase())) return false
      if (applied.statement && noteStatement(n) !== applied.statement) return false
      if (applied.active) {
        const isActive = n.status !== 'inactive'
        if (applied.active === 'yes' && !isActive) return false
        if (applied.active === 'no' && isActive) return false
      }
      return true
    })
    const key = (n: AccountNote) =>
      sortBy === 'name' ? noteName(n) : sortBy === 'statement' ? statementLabel(noteStatement(n)) : n.noteNo
    const cmp = (a: AccountNote, b: AccountNote) => {
      const c = key(a).localeCompare(key(b), undefined, { numeric: true })
      return sortDir === 'asc' ? c : -c
    }
    return orderByParent(matched, { parentIdOf: (n) => n.parentId, compare: cmp })
  }, [notes, applied, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const paged = rows.slice((curPage - 1) * pageSize, curPage * pageSize)

  const headerSort = (col: 'noteNo' | 'name' | 'statement') => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  const doSearch = () => setApplied({ noteQ: noteQ.trim(), statement: statementFilter, active: activeFilter })
  const doReset = () => {
    setNoteQ(''); setStatementFilter(''); setActiveFilter('yes')
    setApplied({ noteQ: '', statement: '', active: 'yes' })
  }

  /** Suggest account-to-note links without changing the Chart of Accounts hierarchy. */
  const autoMapAccounts = () => {
    const rules: [string[], string][] = [
      [['cash', 'petty cash', 'bank', 'mobile money'], '11'], [['receivable', 'debtor', 'student'], '12'], [['prepaid', 'prepayment', 'advance'], '13'],
      [['investment'], '14'], [['inventory', 'stock'], '16'], [['lease'], '18'], [['property', 'building', 'equipment', 'computer', 'furniture', 'vehicle', 'asset'], '19'],
      [['overdraft'], '20'], [['payable', 'creditor', 'supplier'], '21'], [['accrued', 'accrual'], '22'], [['deferred'], '23'], [['tax', 'vat'], '24'], [['loan', 'borrow'], '25'], [['reserve'], '26'], [['retained', 'accumulated', 'fund'], '28'],
      [['revenue', 'sales', 'income', 'membership', 'fee', 'tuition', 'donation', 'grant'], '31'], [['employee', 'salary', 'wage', 'payroll'], '34'], [['repair', 'maintenance'], '36'], [['utility', 'electric', 'water'], '37'], [['depreciation'], '38'], [['interest', 'finance'], '39'],
    ]
    const target = (a: Account) => {
      const text = `${a.name} ${a.code || ''}`.toLowerCase()
      const hit = rules.find(([words]) => words.some(w => text.includes(w)))
      if (hit) return hit[1]
      if (a.type === 'income') return '31'
      if (a.type === 'expense') return '35'
      if (a.type === 'liability') return '21'
      if (a.type === 'equity') return '28'
      return '17'
    }
    const next = notes.map(n => ({ ...n, accountIds: [...(n.accountIds || [])] }))
    // Monetary default notes become top-level Chart of Accounts accounts.
    // Narrative policies/general disclosures are intentionally not created here.
    for (const note of next) {
      if (note.accountId || Number(note.noteNo) < 10) continue
      const type = note.statement === 'income_statement' ? (note.noteNo === '31' || note.noteNo === '32' || note.noteNo === '33' ? 'income' : 'expense') : (note.noteNo === '28' ? 'equity' : note.noteNo === '20' || note.noteNo === '21' || note.noteNo === '22' || note.noteNo === '23' || note.noteNo === '24' || note.noteNo === '25' ? 'liability' : 'asset')
      const id = uid('noteacct')
      const anchor = { id, scopeType: 'COMPANY' as const, companyId: app.activeCompanyId, code: `FSN-${note.noteNo}`, name: note.name, type: type as Account['type'], primaryBalance: 0, status: 'active' as const, noteNo: note.noteNo, description: note.description }
      app.upsertAccount(anchor)
      note.accountId = id
    }
    let linked = 0
    for (const account of accounts) {
      const note = next.find(n => n.noteNo === target(account) && n.status !== 'inactive')
      if (!note) continue
      // Stamp the source Chart of Accounts account with the resolved note number.
      if (account.noteNo !== note.noteNo) app.upsertAccount({ ...account, noteNo: note.noteNo })
      if (note.accountId === account.id) continue
      if (!note.accountIds?.includes(account.id)) { note.accountIds = [...(note.accountIds || []), account.id]; linked++ }
    }
    // Every Accounts Note must be anchored to an actual Chart of Accounts account.
    // Use the first covered account as its parent anchor without re-parenting it.
    for (const note of next) {
      if (!note.accountId && note.accountIds?.length) note.accountId = note.accountIds[0]
    }
    persist(next)
    // Make the relationship structural: the note's anchor remains a real COA
    // account and all covered accounts become children beneath that account.
    for (const note of next) {
      if (!note.accountId) continue
      const anchor = accounts.find(a => a.id === note.accountId)
      if (!anchor) continue
      promoteAccountToNote(anchor.id, note.noteNo)
      for (const childId of note.accountIds || []) if (childId !== anchor.id) reparentChild(childId, anchor)
    }
    toast.success('Chart of Accounts mapped', `${linked} accounts were assigned to their correct Accounts Notes and linked structurally in the Chart of Accounts.`)
  }

  const unmapChartAccounts = () => {
    for (const note of notes) {
      releaseChildren(note)
      restoreAccount(note)
    }
    persist(notes.map(note => ({ ...note, accountId: undefined, accountIds: [], restoreParentId: undefined, restoreParentCode: undefined, childRestore: undefined })))
    toast.success('Chart of Accounts unmapped', 'All account links were removed from Accounts Notes. The note definitions were retained.')
  }

  const openNew = () => { setCoverQ(''); setEditing(blank()) }
  const openEdit = (n: AccountNote) => { setCoverQ(''); setEditing({
    id: n.id, noteNo: n.noteNo,
    // Prefer the stored link; fall back to matching a legacy note by its name.
    accountId: n.accountId || linkableAccounts.find((a) => a.name === n.name)?.id || '',
    name: n.name, statement: n.statement,
    parentId: n.parentId || '', accountIds: n.accountIds || [],
    description: n.description || '', status: n.status || 'active',
  }) }

  /** Next free note number when the field is left blank. */
  const nextNoteNo = () => {
    const used = notes.map((n) => Number(n.noteNo)).filter((v) => Number.isFinite(v))
    return String((used.length ? Math.max(...used) : 0) + 1)
  }

  /**
   * Promote an account to a first-level parent and stamp it with the note
   * number. An account chosen as a note can never be a sub-account, so its
   * parent links are cleared here.
   */
  const promoteAccountToNote = (accountId: string, noteNo: string) => {
    const acc = accounts.find((a) => a.id === accountId)
    if (!acc) return
    app.upsertAccount({ ...acc, parentId: undefined, parentCode: undefined, noteNo })
  }

  /**
   * Reverse the promotion: put the account back under its previous parent (if
   * one was recorded) and remove its note stamp, so it becomes an ordinary
   * account again.
   */
  const restoreAccount = (note?: Pick<AccountNote, 'accountId' | 'restoreParentId' | 'restoreParentCode'>) => {
    if (!note?.accountId) return
    const acc = accounts.find((a) => a.id === note.accountId)
    if (!acc) return
    app.upsertAccount({
      ...acc,
      parentId: note.restoreParentId,
      parentCode: note.restoreParentCode,
      noteNo: undefined,
    })
  }

  /** Re-parent a covered account beneath the note's account (parent → child). */
  const reparentChild = (childId: string, parent: Account) => {
    const acc = accounts.find((a) => a.id === childId)
    if (!acc) return
    app.upsertAccount({ ...acc, parentId: parent.id, parentCode: parent.code || undefined })
  }

  /** Put a covered account back under the parent it had before it joined the note. */
  const restoreChild = (entry: { accountId: string; parentId?: string; parentCode?: string }) => {
    const acc = accounts.find((a) => a.id === entry.accountId)
    if (!acc) return
    app.upsertAccount({ ...acc, parentId: entry.parentId, parentCode: entry.parentCode })
  }

  /** Release every covered account of a note back to its previous parent. */
  const releaseChildren = (note?: AccountNote) => {
    for (const id of note?.accountIds || []) {
      const entry = (note?.childRestore || []).find((e) => e.accountId === id)
      restoreChild(entry || { accountId: id, parentId: undefined, parentCode: undefined })
    }
  }

  const save = () => {
    if (!editing) return
    if (!editing.accountId) { toast.error('Select an account for this note.'); return }
    const account = accounts.find((a) => a.id === editing.accountId)
    if (!account) { toast.error('The selected account no longer exists.'); return }
    const noteNo = editing.noteNo.trim() || nextNoteNo()
    const clash = notes.find((n) => n.noteNo === noteNo && n.id !== editing.id)
    if (clash) { toast.error('That note number is already used', clash.name); return }
    const accClash = notes.find((n) => n.accountId === account.id && n.id !== editing.id)
    if (accClash) { toast.error('That account is already a note', `Note ${accClash.noteNo} — ${accClash.name}`); return }
    const isNew = !editing.id
    const prev = editing.id ? notes.find((n) => n.id === editing.id) : undefined
    // Remember where the account sat before promotion so it can be reversed. When
    // the note keeps the same account, preserve the parent captured originally.
    const keepsAccount = prev?.accountId === account.id
    const restoreParentId = keepsAccount ? prev?.restoreParentId : account.parentId
    const restoreParentCode = keepsAccount ? prev?.restoreParentCode : account.parentCode

    // Covered accounts become children of the note account. Never include the
    // note account itself. Capture each child's prior parent so it can be released.
    const covered = editing.accountIds.filter((id) => id !== account.id)
    const prevCovered = prev?.accountIds || []
    const prevChildRestore = prev?.childRestore || []
    const childRestore = covered.map((id) =>
      prevChildRestore.find((e) => e.accountId === id) || {
        accountId: id,
        parentId: accounts.find((a) => a.id === id)?.parentId,
        parentCode: accounts.find((a) => a.id === id)?.parentCode,
      },
    )

    const draft: AccountNote = {
      id: editing.id || uid('note'),
      companyId: app.activeCompanyId,
      noteNo,
      accountId: account.id,
      name: account.name,
      restoreParentId,
      restoreParentCode,
      statement: statementForType(account.type),
      parentId: editing.parentId || undefined,
      accountIds: covered.length ? covered : undefined,
      childRestore: childRestore.length ? childRestore : undefined,
      description: editing.description.trim() || undefined,
      status: editing.status,
    }
    persist(isNew ? [...notes, draft] : notes.map((n) => (n.id === draft.id ? draft : n)))
    // If the note was re-pointed to a different account, restore the old one.
    if (prev?.accountId && prev.accountId !== account.id) restoreAccount(prev)
    // Release accounts that are no longer covered, back to their previous parent.
    for (const id of prevCovered) {
      if (!covered.includes(id)) {
        restoreChild(prevChildRestore.find((e) => e.accountId === id) || { accountId: id, parentId: undefined, parentCode: undefined })
      }
    }
    // Assign the account as a note: always a first-level parent, stamped by note no.
    promoteAccountToNote(account.id, noteNo)
    // Re-parent every covered account beneath the note account (parent → child).
    for (const id of covered) reparentChild(id, account)
    app.log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Account note', `${isNew ? 'Created' : 'Updated'} note ${noteNo} ${draft.name}`)
    toast.success(isNew ? 'Note created' : 'Note updated')
    setEditing(null)
  }

  /**
   * Remove the top-level-parent note assignment from the account being edited:
   * the note record is removed and the account is restored to its prior place.
   */
  const reverse = () => {
    if (!editing?.id) return
    const note = notes.find((n) => n.id === editing.id)
    if (!note) return
    restoreAccount(note)
    releaseChildren(note)
    persist(notes
      .filter((n) => n.id !== note.id)
      .map((n) => (n.parentId === note.id ? { ...n, parentId: undefined } : n)))
    app.log(user?.id || 'system', 'UPDATE', 'Account note', `Removed top-level parent note ${note.noteNo} ${note.name}`)
    toast.success('Reversed', `${note.name} is no longer a top-level parent note.`)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    // Children are kept — they simply move up to the top level.
    const deletedNames = new Set<string>(JSON.parse(localStorage.getItem('fitpro_deleted_account_notes') || '[]'))
    deletedNames.add(deleting.name.trim().toLowerCase())
    localStorage.setItem('fitpro_deleted_account_notes', JSON.stringify([...deletedNames]))
    persist(notes
      .filter((n) => n.id !== deleting.id)
      .map((n) => (n.parentId === deleting.id ? { ...n, parentId: undefined } : n)))
    // The account is no longer a note — restore it and release its covered children.
    restoreAccount(deleting)
    releaseChildren(deleting)
    app.log(user?.id || 'system', 'DELETE', 'Account note', `Deleted note ${deleting.noteNo} ${deleting.name}`)
    toast.success('Note deleted', deleting.name)
    setDeleting(null)
  }

  const toggleAccount = (id: string) => {
    if (!editing) return
    setEditing({
      ...editing,
      accountIds: editing.accountIds.includes(id)
        ? editing.accountIds.filter((x) => x !== id)
        : [...editing.accountIds, id],
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Accounts Note"
        desc="Numbered notes to the financial statements, and the accounts each note explains."
        actions={canManage ? <div className="flex gap-2"><Button variant="outline" onClick={autoMapAccounts}><WandSparkles className="size-4" /> Map Chart of Accounts</Button><Button variant="outline" onClick={unmapChartAccounts}>Unmap Chart of Accounts</Button><Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={openNew}><Plus className="size-4" /> Add</Button></div> : undefined}
      />

      {/* Filters — same bar as Master Accounts */}
      <div className="rounded-2xl border border-line bg-card p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Note">
            <Input value={noteQ} onChange={(e) => setNoteQ(e.target.value)} placeholder="Search by note name or number" onKeyDown={(e) => e.key === 'Enter' && doSearch()} />
          </Field>
          <Field label="Statement">
            <Select value={statementFilter} onChange={(e) => setStatementFilter(e.target.value)}>
              <option value="">Nothing selected</option>
              {STATEMENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Active">
            <Select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
              <option value="">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          </Field>
          <div className="flex items-end gap-2">
            <Button onClick={doSearch}><Search className="size-4" /> Search</Button>
            <Button variant="outline" onClick={doReset}><RotateCcw className="size-4" /> Reset</Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="w-24">
          {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
        </Select>
        <ExportButtons
          filename="accounts-note"
          rows={rows.map((n) => ({
            'Note No.': n.noteNo,
            Name: noteName(n),
            Description: n.description || '',
            Statement: statementLabel(noteStatement(n)),
            Accounts: (n.accountIds || []).length,
            Active: n.status === 'inactive' ? 'No' : 'Yes',
          }))}
          onDone={(l, ok) => ok ? toast.success(`${l} export started`) : toast.error('Export blocked')}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-mist">
            <tr>
              <th className="cursor-pointer select-none px-3 py-2.5" onClick={() => headerSort('noteNo')}>
                <span className="inline-flex items-center gap-1">Note No. <ChevronsUpDown className="size-3.5 text-mist" /></span>
              </th>
              <th className="cursor-pointer select-none px-3 py-2.5" onClick={() => headerSort('name')}>Name</th>
              <th className="px-3 py-2.5">Description</th>
              <th className="cursor-pointer select-none px-3 py-2.5" onClick={() => headerSort('statement')}>
                <span className="inline-flex items-center gap-1">Statement <ChevronsUpDown className="size-3.5 text-mist" /></span>
              </th>
              <th className="px-3 py-2.5">Accounts</th>
              <th className="px-3 py-2.5 text-center">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {paged.map((n) => (
              <tr key={n.id}>
                <td className="px-3 py-2.5 font-mono">{n.noteNo}</td>
                <td className="group px-3 py-2.5 font-semibold" style={{ paddingLeft: indentFor(depthOf.get(n.id)) }}>
                  <div className="text-sm font-semibold leading-snug">{noteName(n)}</div>
                  <div className="mt-0.5 hidden items-center gap-2 text-[13px] group-hover:flex">
                    {canManage && (
                      <button type="button" className="font-medium text-mist transition hover:text-lime" onClick={() => openEdit(n)}>Edit</button>
                    )}
                    {canManage && canDelete && <span className="text-mist/40">|</span>}
                    {canDelete && (
                      <button type="button" className="font-semibold text-red-600 transition hover:text-red-700" onClick={() => setDeleting(n)}>Delete</button>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-mist">{n.description || '—'}</td>
                <td className="px-3 py-2.5">{statementLabel(noteStatement(n))}</td>
                <td className="px-3 py-2.5 text-mist">
                  {(n.accountIds || []).length
                    ? `${(n.accountIds || []).length} account${(n.accountIds || []).length === 1 ? '' : 's'}`
                    : '—'}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-center">
                    <Switch
                      checked={n.status !== 'inactive'}
                      disabled={!canManage}
                      onChange={(next) => {
                        persist(notes.map((x) => (x.id === n.id ? { ...x, status: next ? 'active' : 'inactive' } : x)))
                        toast.success(next ? 'Note activated' : 'Note deactivated', n.name)
                      }}
                      aria-label={`Toggle ${n.name} active`}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {!paged.length && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-mist">
                  No notes yet. Use <span className="font-semibold">Add</span> to create the first note to the accounts.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-mist">
        <span>
          {rows.length
            ? `Showing ${(curPage - 1) * pageSize + 1} to ${Math.min(curPage * pageSize, rows.length)} of ${rows.length} entries`
            : 'Showing 0 to 0 of 0 entries'}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)}>Next</Button>
        </div>
      </div>

      {/* Add / Edit — the Master Accounts form, for notes */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Accounts Note' : 'Add Accounts Note'}>
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Field label="Note Name" required>
                  <Select
                    value={editing.accountId}
                    onChange={(e) => {
                      const acc = accounts.find((a) => a.id === e.target.value)
                      setEditing({
                        ...editing,
                        accountId: e.target.value,
                        name: acc?.name || '',
                        // A note account is the parent, so drop it from its own covered list.
                        accountIds: editing.accountIds.filter((id) => id !== e.target.value),
                      })
                    }}
                    placeholder="Select an account…"
                  >
                    <option value="">Please Select…</option>
                    {/* Note Name can be any account in the Chart of Accounts. */}
                    {linkableAccounts
                      .map((a) => (
                        <option key={a.id} value={a.id}>{accountLabel(a.id)}</option>
                      ))}
                  </Select>
                </Field>
              </div>
              <Field label="Note No.">
                <Input value={editing.noteNo} onChange={(e) => setEditing({ ...editing, noteNo: e.target.value })} className="font-mono" placeholder="Auto if blank" />
              </Field>
            </div>

            <Field label="Accounts covered by this note">
              {(() => {
                // A covered account becomes a child of the note account. It may itself
                // parent other (non-note) accounts to build the hierarchy, but it can
                // never be: the note's own account, another Note account, or an account
                // already covered by a different note.
                const available = linkableAccounts.filter((a) =>
                  a.id !== editing.accountId
                  && !noteAccountIds.has(a.id)
                  && !notes.some(n => n.accountId === a.id && n.id !== editing.id)
                  && (!ownerNoteOf.has(a.id) || ownerNoteOf.get(a.id) === editing.id),
                )
                const t = coverQ.trim().toLowerCase()
                const shown = t ? available.filter((a) => accountLabel(a.id).toLowerCase().includes(t)) : available
                return (
                  <>
                    <SearchField value={coverQ} onChange={setCoverQ} placeholder="Search accounts…" className="mb-2 max-w-full" />
                    <div className="max-h-48 space-y-1 overflow-auto rounded-xl border border-line p-2" data-testid="note-accounts">
                      {shown.map((a) => (
                        <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-white/[0.04]">
                          <input
                            type="checkbox"
                            className="size-4 accent-blue-600"
                            checked={editing.accountIds.includes(a.id)}
                            onChange={() => toggleAccount(a.id)}
                            aria-label={`Include ${a.name}`}
                          />
                          <span className="min-w-0 truncate">{accountLabel(a.id)}</span>
                        </label>
                      ))}
                      {shown.length === 0 && (
                        <p className="px-1 py-2 text-sm text-mist">
                          {available.length === 0 ? 'No other accounts available.' : `No accounts match “${coverQ}”.`}
                        </p>
                      )}
                    </div>
                  </>
                )
              })()}
            </Field>

            <Field label="Description">
              <Textarea rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="please provide description" className="min-h-[42px] max-w-full resize placeholder:italic placeholder:text-rose-400" />
            </Field>

            <Field label="Status">
              <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as 'active' | 'inactive' })}>
                <option value="active">ACTIVE</option>
                <option value="inactive">INACTIVE</option>
              </Select>
            </Field>

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button className="h-11 flex-1 bg-blue-600 text-base font-semibold text-white hover:bg-blue-700" onClick={save}>Save</Button>
              {editing.id && canDelete && (
                <Button
                  variant="outline"
                  className="h-11 sm:flex-none"
                  onClick={reverse}
                  title="Restore this account to its previous parent and remove the note"
                >
                  <RotateCcw className="size-4" /> Remove top-level parent
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete note?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Delete note <span className="font-semibold text-inherit">{deleting.noteNo} {deleting.name}</span>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={doDelete}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
