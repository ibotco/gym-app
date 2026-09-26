import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { DataTable, type Column } from '../../components/DataTable'
import { Check, LayoutGrid, List, Pencil, Plus, RotateCcw, Trash2, UploadCloud, X } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Empty, SearchInput } from '../../components/ui'
import { Badge } from '../../components/ui'
import { BooksCatalogGrid, LibrarySettingsCard, LibraryStatsBar } from './library/LibraryUI'
import { useToast } from '../../context/ToastContext'
import { useI18n } from '../../context/I18nContext'
import { useApp } from '../../context/AppContext'
import { formatGhs, uid } from '../../lib/utils'
import { loadEduRecords, saveEduRecords, type EduRow, type EduRecords } from '../../lib/eduRecords'
import menu from '../../data/eduMenu.json'

export type FieldDef = { key: string; label: string; type: string; options?: string[]; required?: boolean; source?: string; valueKey?: string; hideInForm?: boolean }
export type Leaf = { id: string; key: string; path: string; fields: FieldDef[] }
export type Group = { id: string; key: string; path: string; icon: string; leaves: Leaf[] }

const GROUPS = (menu as { groups: Group[] }).groups

import {
  buildLibraryMembers, memberStateOf, withAllMemberState, applyMemberPatch, applyAllMemberPatch,
  memberNameOptions, filterMemberRows, splitMemberStore, EXTERNAL_MEMBER_PREFIX,
  isOverdueLoan, isActiveLoan, todayISO, makeLoanFromRequest, settingsFrom, overdueFine, canIssueBook, computeLibraryStats, snapshotTitle, finesByMember, type MembershipState,
} from '../../lib/library'
export {
  buildLibraryMembers, memberStateOf, withMemberState, withAllMemberState, applyMemberPatch, applyAllMemberPatch,
  memberNameOptions, filterMemberRows, splitMemberStore, EXTERNAL_MEMBER_PREFIX, type MembershipState,
} from '../../lib/library'

export function buildMemberColumns(opts: {
  fields: FieldDef[]
  stateFor: (r: EduRow) => MembershipState
  onMember: (id: string, member: 'yes' | 'no') => void
  onStatus: (id: string, status: 'Active' | 'Inactive') => void
  allMembers: boolean
  onAllMembers: (member: 'yes' | 'no') => void
  finesFor?: (r: EduRow) => number
}): Column<EduRow>[] {
  const { fields, stateFor, onMember, onStatus, allMembers, onAllMembers, finesFor } = opts
  return [
    ...fields.map((f) => ({
      key: f.key,
      header: f.label,
      sortValue: (r: EduRow) => String(r[f.key] ?? ''),
      render: (r: EduRow) => (String(r[f.key] ?? '').trim() ? String(r[f.key]) : <span className="text-mist">—</span>),
    })),
    {
      key: '__member',
      header: (
        <span className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            className="size-4 accent-lime"
            checked={allMembers}
            onChange={(e) => onAllMembers(e.target.checked ? 'yes' : 'no')}
            aria-label="Check all library members"
          />
          Member
        </span>
      ),
      align: 'center' as const,
      sortValue: (r: EduRow) => (stateFor(r).member === 'yes' ? 1 : 0),
      render: (r: EduRow) => (
        <input
          type="checkbox"
          className="size-4 accent-lime"
          checked={stateFor(r).member === 'yes'}
          onChange={(e) => onMember(r.id, e.target.checked ? 'yes' : 'no')}
          aria-label={`Library membership for ${r.name ?? ''}`}
        />
      ),
    },
    {
      key: '__status',
      header: 'Membership Status',
      sortValue: (r: EduRow) => stateFor(r).status,
      render: (r: EduRow) => (
        <Select value={stateFor(r).status} onChange={(e) => onStatus(r.id, e.target.value as 'Active' | 'Inactive')} aria-label={`Membership status for ${r.name ?? ''}`}>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </Select>
      ),
    },
    ...(finesFor
      ? [
          {
            key: '__fines',
            header: 'Outstanding Fines',
            sortValue: (r: EduRow) => finesFor(r),
            render: (r: EduRow) => {
              const v = finesFor(r)
              return v > 0 ? <span className="font-semibold text-rose-500">{formatGhs(v)}</span> : <span className="text-mist">—</span>
            },
          },
        ]
      : []),
  ]
}

/** DataTable columns for a leaf's fields, with optional status badges and an actions column. */
export function buildLeafColumns(
  leaf: { fields: FieldDef[] },
  opts?: {
    actions?: (r: EduRow) => ReactNode
    badgeFor?: (r: EduRow, f: FieldDef) => ReactNode | undefined
  },
): Column<EduRow>[] {
  const firstKey = leaf.fields[0]?.key
  return [
    ...leaf.fields.map((f) => ({
      key: f.key,
      header: <span className="font-semibold text-inherit">{f.label}</span>,
      sortValue: (r: EduRow) => (f.type === 'number' ? Number(r[f.key] ?? 0) : String(r[f.key] ?? '')),
      align: (f.type === 'number' ? 'right' : undefined) as 'right' | undefined,
      render: (r: EduRow) => {
        const badge = opts?.badgeFor?.(r, f)
        if (badge) return badge
        if (f.type === 'image') {
          return String(r[f.key] ?? '').startsWith('data:') ? (
            <img src={String(r[f.key])} alt="" className="h-9 w-7 rounded object-cover" />
          ) : (
            <span className="text-mist">—</span>
          )
        }
        const v = String(r[f.key] ?? '').trim()
        return <span className={f.key === firstKey ? 'font-semibold' : ''}>{v || '—'}</span>
      },
    })),
    ...(opts?.actions
      ? [{ key: '__actions', header: '', align: 'right' as const, render: opts.actions }]
      : []),
  ]
}

export function EduLeafCrud({ group, leaf, crumb }: { group: Group; leaf: Leaf; crumb: string[] }) {
  const { t } = useI18n()
  const toast = useToast()
  const { activeBranchId, branches, staff, users } = useApp()
  const branchName = branches.find((b) => b.id === activeBranchId)?.name

  const [records, setRecords] = useState(() => loadEduRecords(activeBranchId))

  // Branch-related: switching the active branch loads that branch's records.
  useEffect(() => {
    setRecords(loadEduRecords(activeBranchId))
    setEdit(null)
    setDel(null)
    setQ('')
  }, [activeBranchId])
  const [q, setQ] = useState('')
  const [memberTypeFilter, setMemberTypeFilter] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [booksView, setBooksView] = useState<'grid' | 'table'>('grid')
  const [edit, setEdit] = useState<EduRow | null>(null)
  const [del, setDel] = useState<EduRow | null>(null)

  const generatedMembers = group.id === 'library' && leaf.id === 'members'
  const memberStore = generatedMembers ? records[leaf.id] || [] : []
  const { externalRows, membershipOverrides } = splitMemberStore(memberStore)
  const rows = generatedMembers
    ? [...buildLibraryMembers(records, staff, users, activeBranchId), ...externalRows]
    : records[leaf.id] || []
  const saveMemberStore = (overrides: EduRow[], external: EduRow[]) => persist([...overrides, ...external])
  const stateFor = (r: EduRow): MembershipState =>
    r.id.startsWith(EXTERNAL_MEMBER_PREFIX)
      ? { member: r.member === 'no' ? 'no' : 'yes', status: r.status === 'Inactive' ? 'Inactive' : 'Active' }
      : memberStateOf(membershipOverrides, r.id)
  const setMemberState = (rowId: string, patch: Partial<MembershipState>) => persist(applyMemberPatch(memberStore, rowId, patch))
  const leafBadgeFor = (r: EduRow, f: FieldDef): ReactNode | undefined =>
    leaf.id === 'bookIssueReturn' && f.key === 'status'
      ? isOverdueLoan(r)
        ? (
          <Badge tone="rose">
            Overdue{overdueFine(r, settingsFrom(records).finePerDay) > 0
              ? ` · ${formatGhs(overdueFine(r, settingsFrom(records).finePerDay))}`
              : ''}
          </Badge>
        )
        : (<Badge tone={String(r.status) === 'Returned' ? 'zinc' : 'lime'}>{String(r.status || '—')}</Badge>)
      : undefined

  const leafRowActions = (r: EduRow) => (
    <div className="flex justify-end gap-1.5">
      {leaf.id === 'bookIssueReturn' && isActiveLoan(r) && (
        <button className="rounded-md p-1.5 text-mist hover:bg-lime/10 hover:text-lime-ink dark:hover:text-lime" title="Mark returned" onClick={() => returnLoan(r.id)}>
          <RotateCcw className="size-3.5" />
        </button>
      )}
      {leaf.id === 'requestBooks' && String(r.status) === 'Pending' && (
        <>
          <button
            className="rounded-md p-1.5 text-mist hover:bg-lime/10 hover:text-lime-ink dark:hover:text-lime disabled:cursor-not-allowed disabled:opacity-40"
            title={canIssueBook(records, String(r.book ?? '')) ? 'Approve & issue book' : 'No copies available'}
            disabled={!canIssueBook(records, String(r.book ?? ''))}
            onClick={() => approveRequest(r)}
          >
            <Check className="size-3.5" />
          </button>
          <button className="rounded-md p-1.5 text-mist hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400" title="Reject request" onClick={() => rejectRequest(r)}>
            <X className="size-3.5" />
          </button>
        </>
      )}
      <button className="rounded-md p-1.5 text-mist hover:bg-black/5 hover:text-inherit dark:hover:bg-white/10" title="Edit" onClick={() => setEdit({ ...r })}><Pencil className="size-3.5" /></button>
      <button className="rounded-md p-1.5 text-mist hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400" title="Delete" onClick={() => setDel(r)}><Trash2 className="size-3.5" /></button>
    </div>
  )

  const allMembers = rows.length > 0 && rows.every((r) => stateFor(r).member === 'yes')
  const finesMap = generatedMembers ? finesByMember(records) : {}
  const setAllMembers = (member: 'yes' | 'no') => persist(applyAllMemberPatch(memberStore, rows.map((r) => r.id), member))

  const classOptions = useMemo(() => {
    if (!generatedMembers) return [] as string[]
    return [...new Set((records.studentList ?? []).map((r) => String(r.className ?? '').trim()).filter(Boolean))].sort()
  }, [generatedMembers, records.studentList])

  const filtered = useMemo(
    () => filterMemberRows(rows, leaf, q, memberTypeFilter, classFilter),
    [q, rows, leaf, memberTypeFilter, classFilter],
  )

  // Select options: static list, or pulled live from another submenu's records
  // (e.g. Level → Programme picks from the Programmes you created).
  const optionsFor = (f: FieldDef): string[] => {
    if (f.options && f.options.length) return f.options
    if (f.source === 'members') return memberNameOptions(records, staff, users, activeBranchId)
    if (f.source) {
      const key = f.valueKey ?? 'name'
      const values = (records[f.source] ?? []).map((r) => String(r[key] ?? '').trim()).filter(Boolean)
      return [...new Set(values)].sort()
    }
    return []
  }

  // Image fields (e.g. book cover): read the dropped/picked file as a data URL.
  const readImage = (file: File, key: string) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed')
      return
    }
    if (file.size > 2_000_000) {
      toast.error('Image too large (max 2 MB)')
      return
    }
    const rd = new FileReader()
    rd.onload = () => setEdit((cur) => (cur ? { ...cur, [key]: String(rd.result) } : cur))
    rd.readAsDataURL(file)
  }

  const persist = (next: EduRow[]) => {
    if (!leaf) return
    const all = { ...records, [leaf.id]: next }
    setRecords(all)
    saveEduRecords(activeBranchId, all)
  }

  const persistLeaves = (patch: Record<string, EduRow[]>) => {
    const all = { ...records, ...patch }
    setRecords(all)
    saveEduRecords(activeBranchId, all)
  }

  // Circulation workflows: one-click return; approve a request issues the book.
  const returnLoan = (id: string) => {
    persist(rows.map((r) => (r.id === id ? { ...r, returnDate: todayISO(), status: 'Returned' } : r)))
    toast.success('Book returned')
  }
  const approveRequest = (row: EduRow) => {
    persistLeaves({
      requestBooks: (records.requestBooks ?? []).map((r) => (r.id === row.id ? { ...r, status: 'Approved' } : r)),
      bookIssueReturn: [...(records.bookIssueReturn ?? []), makeLoanFromRequest(row, todayISO(), settingsFrom(records).loanPeriodDays)],
    })
    toast.success('Request approved — book issued for 14 days')
  }
  const generateSnapshot = () => {
    const today = todayISO()
    const stats = computeLibraryStats(records, staff, users, activeBranchId)
    persist([...rows, { id: uid('rep'), title: snapshotTitle(stats, today), fromDate: today, toDate: today, type: 'Summary' }])
    toast.success('Report generated', 'A snapshot of the current library state was saved.')
  }

  const rejectRequest = (row: EduRow) => {
    persistLeaves({
      requestBooks: (records.requestBooks ?? []).map((r) => (r.id === row.id ? { ...r, status: 'Rejected' } : r)),
    })
    toast.success('Request rejected')
  }

  const submit = () => {
    if (!edit || !leaf) return
    const missing = leaf.fields.find((f) => f.required && !String(edit[f.key] ?? '').trim())
    if (missing) {
      toast.error(`${missing.label} is required`)
      return
    }
    if (
      leaf.id === 'bookIssueReturn' &&
      !rows.some((r) => r.id === edit.id) &&
      String(edit.status ?? '') !== 'Returned' &&
      !canIssueBook(records, String(edit.book ?? ''))
    ) {
      toast.error('No copies available', 'Add stock or receive returns before issuing this book.')
      return
    }
    if (generatedMembers) {
      const row = { member: 'yes', status: 'Active', ...edit, memberType: 'External' }
      const exists = externalRows.some((r) => r.id === edit.id)
      saveMemberStore(membershipOverrides, exists ? externalRows.map((r) => (r.id === edit.id ? row : r)) : [...externalRows, row])
      toast.success(exists ? 'External member updated' : 'External member registered', String(edit.name ?? ''))
      setEdit(null)
      return
    }
    const exists = rows.some((r) => r.id === edit.id)
    persist(exists ? rows.map((r) => (r.id === edit.id ? edit : r)) : [...rows, edit])
    toast.success(exists ? 'Record updated' : 'Record added', leaf.fields[0] ? String(edit[leaf.fields[0].key] || '') : '')
    setEdit(null)
  }

  if (group.id === 'library' && leaf.id === 'librarySettings') {
    return (
      <div>
        <div className="mb-1 flex items-center gap-1 text-xs text-mist">
          <span>Administration</span>
          {crumb.map((c) => (
            <span key={c} className="contents">
              <span>/</span><span>{c}</span>
            </span>
          ))}
          <span>/</span><span className="font-semibold text-inherit">{t(leaf.key)}</span>
        </div>
        <PageHeader title={t(leaf.key)} desc={`${t(group.key)} · ${branchName ?? 'Branch'} — Education Management`} />
        <LibraryStatsBar records={records} staff={staff} users={users} branchId={activeBranchId} />
        <LibrarySettingsCard
          leaf={leaf}
          row={(records.librarySettings ?? [])[0]}
          onSave={(r) => {
            persist([r])
            toast.success('Library settings saved')
          }}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Administration</span>
        {crumb.map((c) => (
          <span key={c} className="contents">
            <span>/</span><span>{c}</span>
          </span>
        ))}
        <span>/</span><span className="font-semibold text-inherit">{t(leaf.key)}</span>
      </div>
      <PageHeader title={t(leaf.key)} desc={`${t(group.key)} · ${branchName ?? 'Branch'} — Education Management`} />

      {group.id === 'library' && <LibraryStatsBar records={records} staff={staff} users={users} branchId={activeBranchId} />}

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
          <SearchInput value={q} onChange={setQ} placeholder={`Search ${t(leaf.key).toLowerCase()}…`} />
          {generatedMembers && (
            <Select value={memberTypeFilter} onChange={(e) => setMemberTypeFilter(e.target.value)} aria-label="Filter by member type" className="w-32">
              <option value="">All types</option>
              <option value="Student">Student</option>
              <option value="Staff">Staff</option>
              <option value="External">External</option>
            </Select>
          )}
          {generatedMembers && (
            <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} aria-label="Filter by class" className="w-32">
              <option value="">All classes</option>
              {classOptions.map((c) => (<option key={c} value={c}>{c}</option>))}
            </Select>
          )}
          {leaf.id === 'books' && (
            <div className="flex overflow-hidden rounded-lg border border-line">
              <button
                type="button"
                onClick={() => setBooksView('grid')}
                aria-label="Catalog view"
                className={`p-2 ${booksView === 'grid' ? 'bg-lime text-lime-ink' : 'text-mist hover:text-inherit'}`}
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setBooksView('table')}
                aria-label="Table view"
                className={`p-2 ${booksView === 'table' ? 'bg-lime text-lime-ink' : 'text-mist hover:text-inherit'}`}
              >
                <List className="size-4" />
              </button>
            </div>
          )}
          {leaf.id === 'libraryReports' && (
            <Button size="sm" variant="outline" onClick={generateSnapshot}>
              <Plus className="size-4" /> Generate Snapshot
            </Button>
          )}
          {generatedMembers ? (
            <Button size="sm" onClick={() => setEdit({ id: `${EXTERNAL_MEMBER_PREFIX}${uid()}`, memberType: 'External' })}>
              <Plus className="size-4" /> Register External Member
            </Button>
          ) : (
            <Button size="sm" onClick={() => setEdit({ id: uid() })}>
              <Plus className="size-4" /> Add {t(leaf.key)}
            </Button>
          )}
        </div>
        {leaf.id === 'books' && booksView === 'grid' ? (
          <BooksCatalogGrid books={filtered} records={records} />
        ) : generatedMembers ? (
          <DataTable
            columns={buildMemberColumns({
              fields: leaf.fields,
              stateFor,
              onMember: (id, member) => setMemberState(id, { member }),
              onStatus: (id, status) => setMemberState(id, { status }),
              allMembers,
              onAllMembers: setAllMembers,
              finesFor: (r) => finesMap[String(r.name ?? '').trim()] ?? 0,
            })}
            data={filtered}
            rowKey={(r) => r.id}
            pageSize={25}
            emptyTitle={`No ${t(leaf.key).toLowerCase()} yet`}
            emptyDesc="Members are generated from Students and Employees; register external members with the button above."
          />
        ) : group.id === 'library' ? (
          <DataTable
            columns={buildLeafColumns(leaf, { actions: leafRowActions, badgeFor: leafBadgeFor })}
            data={filtered}
            rowKey={(r) => r.id}
            pageSize={10}
            emptyTitle={`No ${t(leaf.key).toLowerCase()} yet`}
            emptyDesc="Use Add to create the first record."
          />
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                {leaf.fields.map((f) => (
                  <th key={f.key} className={`px-3 py-2.5 ${f.type === 'number' ? 'text-right' : ''}`}>{f.label}</th>
                ))}
                {generatedMembers && (
                  <th className="px-3 py-2.5 text-center">
                    <span className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        className="size-4 accent-lime"
                        checked={allMembers}
                        onChange={(e) => setAllMembers(e.target.checked ? 'yes' : 'no')}
                        aria-label="Check all library members"
                      />
                      Member
                    </span>
                  </th>
                )}
                {generatedMembers && <th className="px-3 py-2.5">Membership Status</th>}
                {(!generatedMembers || externalRows.length > 0) && <th className="px-3 py-2.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                  {leaf.fields.map((f) => (
                    <td key={f.key} className={`px-3 py-2 ${f.type === 'number' ? 'text-right font-mono' : ''}`}>
                      {leaf.id === 'bookIssueReturn' && f.key === 'status' ? (
                        isOverdueLoan(r) ? (
                          <Badge tone="rose">
                            Overdue{overdueFine(r, settingsFrom(records).finePerDay) > 0
                              ? ` · ${formatGhs(overdueFine(r, settingsFrom(records).finePerDay))}`
                              : ''}
                          </Badge>
                        ) : (
                          <Badge tone={String(r.status) === 'Returned' ? 'zinc' : 'lime'}>{String(r.status || '—')}</Badge>
                        )
                      ) : f.type === 'image' ? (
                        String(r[f.key] ?? '').startsWith('data:') ? (
                          <img src={String(r[f.key])} alt="" className="h-9 w-7 rounded object-cover" />
                        ) : (
                          '—'
                        )
                      ) : String(r[f.key] ?? '').trim() ? (
                        String(r[f.key])
                      ) : (
                        '—'
                      )}
                    </td>
                  ))}
                  {generatedMembers && (
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        className="size-4 accent-lime"
                        checked={stateFor(r).member === 'yes'}
                        onChange={(e) => setMemberState(r.id, { member: e.target.checked ? 'yes' : 'no' })}
                        aria-label={`Library membership for ${r.name}`}
                      />
                    </td>
                  )}
                  {generatedMembers && (
                    <td className="px-3 py-2">
                      <Select
                        value={stateFor(r).status}
                        onChange={(e) => setMemberState(r.id, { status: e.target.value as 'Active' | 'Inactive' })}
                        aria-label={`Membership status for ${r.name}`}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </Select>
                    </td>
                  )}
                  {(!generatedMembers || r.id.startsWith(EXTERNAL_MEMBER_PREFIX)) && (
                    <td className="px-3 py-2 text-right">{leafRowActions(r)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <Empty title={`No ${t(leaf.key).toLowerCase()} yet`} desc="Use Add to create the first record." />}
        </div>
        )}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={
          generatedMembers
            ? externalRows.some((r) => r.id === edit?.id)
              ? 'Edit External Member'
              : 'Register External Member'
            : rows.some((r) => r.id === edit?.id)
              ? `Edit ${t(leaf.key)}`
              : `Add ${t(leaf.key)}`
        }>
        {edit && (
          <div className="grid gap-3">
            {leaf.fields.filter((f) => !f.hideInForm).map((f) => (
              <Field key={f.key} label={f.label} required={f.required}>
                {f.type === 'select' ? (
                  <Select value={String(edit[f.key] ?? '')} disabled={generatedMembers && f.key === 'memberType'} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} placeholder="Select…">
                    {optionsFor(f).map((o) => (<option key={o} value={o}>{o}</option>))}
                  </Select>
                ) : f.type === 'image' ? (
                  <label
                    className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line bg-black/[0.02] p-4 text-center text-xs text-mist transition hover:border-lime hover:text-inherit dark:bg-white/[0.03]"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      const file = e.dataTransfer.files?.[0]
                      if (file) readImage(file, f.key)
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) readImage(file, f.key)
                        e.target.value = ''
                      }}
                    />
                    {String(edit[f.key] ?? '').startsWith('data:') ? (
                      <img src={String(edit[f.key])} alt="Cover preview" className="h-24 w-16 rounded-md object-cover" />
                    ) : (
                      <UploadCloud className="size-6" />
                    )}
                    <span>{String(edit[f.key] ?? '') ? 'Click or drop a file to replace' : 'Drag and drop a file here or click'}</span>
                  </label>
                ) : (
                  <Input
                    type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                    value={String(edit[f.key] ?? '')}
                    onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })}
                  />
                )}
              </Field>
            ))}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={submit}>Save</Button>
              <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!del} onClose={() => setDel(null)} title={`Delete ${t(leaf.key)}?`}>
        {del && (
          <>
            <p className="text-sm text-mist">
              Delete <span className="font-semibold text-inherit">{String(del[leaf.fields[0].key] || 'this record')}</span>? This cannot be undone.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => {
                        if (generatedMembers) saveMemberStore(membershipOverrides, externalRows.filter((r) => r.id !== del.id))
                        else persist(rows.filter((r) => r.id !== del.id))
                        toast.success('Record deleted')
                        setDel(null)
                      }}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

/** Route wrapper: resolves group/leaf from the URL (Education Management pages). */
export function EduModulePage() {
  const { group: groupId, leaf: leafId } = useParams()
  const { t } = useI18n()
  const group = GROUPS.find((g) => g.path === groupId)
  const leaf = group?.leaves.find((l) => l.path === leafId)
  if (!group || !leaf) {
    return <Empty title="Section not found" desc="This Education Management section does not exist." />
  }
  return <EduLeafCrud group={group} leaf={leaf} crumb={['Education Management', t(group.key)]} />
}
