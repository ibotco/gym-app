import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { AlertTriangle, BookOpen, CalendarClock, Coins, Inbox, Layers, Users } from 'lucide-react'
import { Badge, Button, Field, Input, Select } from '../../../components/ui'
import { formatGhs } from '../../../lib/utils'
import { activeLoansByTitle, availableStock, computeLibraryStats } from '../../../lib/library'
import type { EduRecords, EduRow } from '../../../lib/eduRecords'
import { uid } from '../../../lib/utils'
import type { StaffRecord, User } from '../../../types'

/** Professional at-a-glance dashboard shown on every Library page. */
export function LibraryStatsBar({
  records,
  staff,
  users,
  branchId,
}: {
  records: EduRecords
  staff: StaffRecord[]
  users: User[]
  branchId: string
}) {
  const s = computeLibraryStats(records, staff, users, branchId)
  const cards = [
    { label: 'Titles', value: String(s.titles), icon: BookOpen, tone: '' },
    { label: 'Copies available', value: `${s.available} / ${s.totalStock}`, icon: Layers, tone: '' },
    { label: 'Active members', value: String(s.membersActive), icon: Users, tone: '' },
    { label: 'On loan', value: String(s.onLoan), icon: CalendarClock, tone: '' },
    { label: 'Overdue', value: String(s.overdue), icon: AlertTriangle, tone: s.overdue > 0 ? 'text-rose-500' : '' },
    { label: 'Pending requests', value: String(s.pendingRequests), icon: Inbox, tone: s.pendingRequests > 0 ? 'text-amber-500' : '' },
    { label: 'Fines (est.)', value: formatGhs(s.fines), icon: Coins, tone: s.fines > 0 ? 'text-rose-500' : '' },
  ]
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <div key={c.label} className="card flex items-center gap-3 p-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-lime/10 text-lime-ink dark:text-lime">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className={`font-display text-lg font-bold leading-tight ${c.tone}`}>{c.value}</p>
              <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-mist">{c.label}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Catalog-style card view for the Books list with live availability. */
export function BooksCatalogGrid({ books, records }: { books: EduRow[]; records: EduRecords }) {
  const loans = activeLoansByTitle(records)
  if (!books.length) {
    return <p className="card p-6 text-center text-sm text-mist">No books match. Add a title or adjust the search.</p>
  }
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {books.map((b) => {
        const avail = availableStock(b, loans)
        const total = Number(b.totalStock ?? 0) || 0
        return (
          <div key={b.id} className="card flex flex-col overflow-hidden">
            {String(b.coverImage ?? '').startsWith('data:') ? (
              <img src={String(b.coverImage)} alt={String(b.title ?? '')} className="h-40 w-full object-cover" />
            ) : (
              <div className="grid h-40 w-full place-items-center bg-black/[0.04] dark:bg-white/[0.05]">
                <BookOpen className="size-8 text-mist" />
              </div>
            )}
            <div className="flex flex-1 flex-col gap-1.5 p-3">
              <p className="font-semibold leading-snug">{String(b.title ?? '')}</p>
              <p className="text-xs text-mist">{String(b.author ?? '') || 'Unknown author'}</p>
              <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                {String(b.category ?? '') ? <Badge tone="sky">{String(b.category)}</Badge> : <span />}
                {String(b.price ?? '') ? <span className="text-xs font-semibold">{formatGhs(Number(b.price))}</span> : <span />}
              </div>
              <Badge tone={avail > 0 ? 'lime' : 'rose'} className="mt-1 justify-center text-center">
                {avail > 0 ? `Available ${avail} / ${total}` : 'All copies out'}
              </Badge>
            </div>
          </div>
        )
      })}
    </div>
  )
}

type SettingsLeaf = {
  fields: { key: string; label: string; type: string; options?: string[]; required?: boolean }[]
}

/** Library Settings is a singleton: one editable card instead of a CRUD table. */
export function LibrarySettingsCard({
  leaf,
  row,
  onSave,
}: {
  leaf: SettingsLeaf
  row?: EduRow
  onSave: (r: EduRow) => void
}) {
  const [edit, setEdit] = useState<EduRow>(row ?? { id: 'ls-main' })
  useEffect(() => {
    setEdit(row ?? { id: 'ls-main' })
  }, [row])
  return (
    <div className="card max-w-2xl p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {leaf.fields.map((f) => (
          <Field key={f.key} label={f.label} required={f.required}>
            {f.type === 'select' ? (
              <Select value={String(edit[f.key] ?? '')} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} placeholder="Select…">
                {(f.options ?? []).map((o) => (<option key={o} value={o}>{o}</option>))}
              </Select>
            ) : (
              <Input
                type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                value={String(edit[f.key] ?? '')}
                onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })}
              />
            )}
          </Field>
        ))}
      </div>
      <Button className="mt-4" onClick={() => onSave({ ...edit, id: edit.id || uid('ls') })}>
        <Save className="size-4" /> Save settings
      </Button>
    </div>
  )
}
