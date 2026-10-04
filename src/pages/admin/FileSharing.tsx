import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Share2, Link2, Link2Off, Copy, Eye, SquarePen, Trash2, List, LayoutGrid, Plus,
  Settings2, Clock, Download, Lock, Globe, Users, ChevronLeft, ChevronRight, X, CalendarClock, HardDrive,
} from 'lucide-react'
import { PageHeader, Button, Badge, Select, Input, Empty, Switch, Textarea } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { uid } from '../../lib/utils'
import {
  loadShares, saveShares, shareStatus, daysLeft, shareLink, fmtSize, fmtDate,
  makeLinkCode, todayIso, daysFromNow, LIBRARY_FILES,
  type ShareRec, type ShareAccess, type ShareStatus,
} from '../../lib/fileSharing'
import { loadMediaSettings, ACCENT_UI } from '../../lib/mediaSettings'

type FormState = {
  id?: string
  fileId: string
  recipients: string
  access: ShareAccess
  visibility: 'public' | 'private'
  expiryDays: number // 0 = never
  allowDownload: boolean
  requireSignIn: boolean
  note: string
}

const ACCESS_LABEL: Record<ShareAccess, string> = { view: 'Can view', download: 'Can download', edit: 'Can edit' }
const ACCESS_TONE: Record<ShareAccess, 'sky' | 'lime' | 'violet'> = { view: 'sky', download: 'lime', edit: 'violet' }
const VIS_META = {
  public: { label: 'Public', tone: 'orange' as const, Icon: Globe, desc: 'Anyone with the link' },
  private: { label: 'Private', tone: 'zinc' as const, Icon: Lock, desc: 'Invited people only' },
}

const STATUS_META: Record<ShareStatus, { label: string; tone: 'lime' | 'amber' | 'rose' | 'zinc' }> = {
  active: { label: 'Active', tone: 'lime' },
  expiring: { label: 'Expiring soon', tone: 'amber' },
  expired: { label: 'Expired', tone: 'rose' },
  revoked: { label: 'Revoked', tone: 'zinc' },
}

function MiniAvatars({ names }: { names: string[] }) {
  const shown = names.slice(0, 3)
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((n) => (
          <span key={n} data-tip={n} className="grid size-7 place-items-center rounded-full border-2 border-white bg-zinc-200 text-[10px] font-bold text-zinc-700 dark:border-zinc-900 dark:bg-zinc-700 dark:text-zinc-200">
            {n.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
          </span>
        ))}
      </div>
      {names.length > 3 && <span className="ml-1.5 text-xs font-semibold text-mist">+{names.length - 3}</span>}
    </div>
  )
}

export function FileSharing() {
  const toast = useToast()
  const navigate = useNavigate()
  const settings = useMemo(() => loadMediaSettings(), [])
  const A = ACCENT_UI[settings.accent]

  const [shares, setShares] = useState<ShareRec[]>(() => loadShares())
  useEffect(() => { saveShares(shares) }, [shares])

  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'all' | ShareStatus>('all')
  const [accessFilter, setAccessFilter] = useState<'all' | ShareAccess>('all')
  const [visFilter, setVisFilter] = useState<'all' | 'public' | 'private'>('all')
  const [sort, setSort] = useState<'newest' | 'name' | 'size' | 'expiry'>('newest')
  const [view, setView] = useState<'list' | 'grid'>(settings.defaultView)
  const [perPage, setPerPage] = useState(8)
  const [page, setPage] = useState(1)
  const [form, setForm] = useState<FormState | null>(null)
  const [viewing, setViewing] = useState<ShareRec | null>(null)

  useEffect(() => { setPage(1) }, [q, tab, accessFilter, visFilter, perPage])

  const today = todayIso()

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const list = shares.filter((s) =>
      (!ql || `${s.fileName}.${s.ext} ${s.owner} ${s.recipients.join(' ')}`.toLowerCase().includes(ql)) &&
      (tab === 'all' || shareStatus(s, today) === tab) &&
      (accessFilter === 'all' || s.access === accessFilter) &&
      (visFilter === 'all' || s.visibility === visFilter),
    )
    return list.sort((a, b) => {
      if (sort === 'name') return a.fileName.localeCompare(b.fileName)
      if (sort === 'size') return b.sizeKb - a.sizeKb
      if (sort === 'expiry') return (a.expiresAt ?? '9999-12-31').localeCompare(b.expiresAt ?? '9999-12-31')
      return b.createdAt.localeCompare(a.createdAt)
    })
  }, [shares, q, tab, accessFilter, visFilter, sort, today])

  const pages = Math.max(1, Math.ceil(filtered.length / perPage))
  const cur = Math.min(page, pages)
  const slice = filtered.slice((cur - 1) * perPage, cur * perPage)

  const counts = useMemo(() => {
    const c: Record<'all' | ShareStatus, number> = { all: shares.length, active: 0, expiring: 0, expired: 0, revoked: 0 }
    for (const s of shares) c[shareStatus(s, today)]++
    return c
  }, [shares, today])

  const stats = useMemo(() => {
    const live = shares.filter((s) => shareStatus(s, today) === 'active' || shareStatus(s, today) === 'expiring')
    return {
      active: counts.active + counts.expiring,
      expiring: counts.expiring,
      files: shares.length,
      sizeKb: live.reduce((t, s) => t + s.sizeKb, 0),
    }
  }, [shares, counts, today])

  const copyLink = async (s: ShareRec) => {
    try { await navigator.clipboard.writeText(shareLink(s.linkCode)) } catch { /* clipboard may be unavailable in the sandbox */ }
    toast.success('Link copied', shareLink(s.linkCode))
  }

  const toggleActive = (s: ShareRec) => {
    setShares((p) => p.map((x) => x.id === s.id
      ? { ...x, active: !x.active, activity: [{ at: today, who: 'You', what: x.active ? 'revoked the link' : 're-activated the link' }, ...x.activity] }
      : x))
    toast.success(s.active ? 'Link revoked' : 'Link re-activated', `${s.fileName}.${s.ext}`)
  }

  const remove = (s: ShareRec) => {
    if (!window.confirm(`Delete this share of “${s.fileName}.${s.ext}”? The link will stop working.`)) return
    setShares((p) => p.filter((x) => x.id !== s.id))
    if (viewing?.id === s.id) setViewing(null)
    toast.success('Share deleted', `${s.fileName}.${s.ext}`)
  }

  const openNew = () => setForm({
    fileId: LIBRARY_FILES[0].id,
    recipients: '',
    access: settings.defaultAccess,
    visibility: settings.publicLinks ? settings.defaultVisibility : 'private',
    expiryDays: settings.defaultExpiryDays,
    allowDownload: settings.defaultAllowDownload,
    requireSignIn: settings.defaultRequireSignIn,
    note: '',
  })

  const openEdit = (s: ShareRec) => {
    const known = LIBRARY_FILES.find((f) => f.fileName === s.fileName)
    setForm({
      id: s.id,
      fileId: known?.id ?? LIBRARY_FILES[0].id,
      recipients: s.recipients.join(', '),
      access: s.access,
      visibility: s.visibility,
      expiryDays: s.expiresAt ? Math.max(1, daysLeft(s, today) ?? 7) : 0,
      allowDownload: s.allowDownload,
      requireSignIn: s.requireSignIn,
      note: s.note ?? '',
    })
  }

  const saveForm = () => {
    if (!form) return
    const recipients = form.recipients.split(',').map((r) => r.trim()).filter(Boolean)
    if (!recipients.length) { toast.error('Add at least one recipient.'); return }
    const file = LIBRARY_FILES.find((f) => f.id === form.fileId) ?? LIBRARY_FILES[0]
    const expiresAt = form.expiryDays === 0 ? null : daysFromNow(form.expiryDays)
    if (form.id) {
      setShares((p) => p.map((x) => x.id === form.id
        ? {
            ...x, fileName: file.fileName, ext: file.ext, sizeKb: file.sizeKb, hue: file.hue, glyph: file.glyph,
            recipients, access: form.access, visibility: form.visibility, expiresAt, allowDownload: form.allowDownload,
            requireSignIn: form.requireSignIn, note: form.note.trim() || undefined,
            activity: [{ at: today, who: 'You', what: 'updated the share' }, ...x.activity],
          }
        : x))
      toast.success('Share updated', `${file.fileName}.${file.ext}`)
    } else {
      const rec: ShareRec = {
        id: uid('shr'), fileName: file.fileName, ext: file.ext, sizeKb: file.sizeKb, hue: file.hue, glyph: file.glyph,
        owner: 'You', recipients, access: form.access, visibility: form.visibility, createdAt: today, expiresAt,
        allowDownload: form.allowDownload, requireSignIn: form.requireSignIn,
        linkCode: makeLinkCode(), active: true, note: form.note.trim() || undefined,
        activity: [{ at: today, who: 'You', what: 'created the share' }],
      }
      setShares((p) => [rec, ...p])
      toast.success('Share created', `Link ready for ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}`)
    }
    setForm(null)
  }

  const rowPad = settings.compact ? 'px-4 py-2' : 'px-4 py-3'
  const tile = settings.compact ? 'size-8' : 'size-10'

  const visBadge = (v: 'public' | 'private') => {
    const m = VIS_META[v]
    return <Badge tone={m.tone}><m.Icon className="size-3" /> {m.label}</Badge>
  }

  const statusBadge = (s: ShareRec) => {
    const st = shareStatus(s, today)
    const m = STATUS_META[st]
    const left = daysLeft(s, today)
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge tone={m.tone}>{m.label}</Badge>
        <span className="text-[11px] text-mist">
          {s.expiresAt ? (left !== null && left < 0 ? `Expired ${fmtDate(s.expiresAt)}` : left === 0 ? 'Expires today' : `Expires ${fmtDate(s.expiresAt)}`) : 'Never expires'}
        </span>
      </div>
    )
  }

  const fileCell = (s: ShareRec) => (
    <div className="flex items-center gap-3">
      <span className={`grid ${tile} flex-shrink-0 place-items-center rounded-md`} style={{ background: `linear-gradient(135deg, hsl(${s.hue} 70% 90%), hsl(${(s.hue + 40) % 360} 65% 76%))` }}>
        <span className={settings.compact ? 'text-base' : 'text-xl'}>{s.glyph}</span>
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold">{s.fileName}.{s.ext}</p>
        <p className="text-xs text-mist">{fmtSize(s.sizeKb)} · by {s.owner}</p>
      </div>
    </div>
  )

  const actions = (s: ShareRec) => (
    <div className="flex items-center justify-end gap-1">
      <button type="button" title="Copy link" onClick={() => copyLink(s)} className={`cursor-pointer rounded-md p-1.5 transition hover:bg-black/[0.05] dark:hover:bg-white/10 ${A.text}`}><Link2 className="size-4" /></button>
      <button type="button" title="Details" onClick={() => setViewing(s)} className="cursor-pointer rounded-md p-1.5 text-emerald-600 transition hover:bg-emerald-500/10 dark:text-emerald-400"><Eye className="size-4" /></button>
      <button type="button" title="Edit share" onClick={() => openEdit(s)} className="cursor-pointer rounded-md p-1.5 text-sky-600 transition hover:bg-sky-500/10 dark:text-sky-400"><SquarePen className="size-4" /></button>
      <button type="button" title={s.active ? 'Revoke link' : 'Re-activate link'} onClick={() => toggleActive(s)} className={`cursor-pointer rounded-md p-1.5 transition hover:bg-black/[0.05] dark:hover:bg-white/10 ${s.active ? 'text-amber-600 dark:text-amber-400' : 'text-lime-600 dark:text-lime-400'}`}>{s.active ? <Link2Off className="size-4" /> : <Link2 className="size-4" />}</button>
      <button type="button" title="Delete" onClick={() => remove(s)} className="cursor-pointer rounded-md p-1.5 text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-400"><Trash2 className="size-4" /></button>
    </div>
  )

  const statChip = (icon: React.ReactNode, label: string, value: string) => (
    <div className="card flex items-center gap-3 p-4">
      <div className={`rounded-md p-2 ${A.soft}`}>{icon}</div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-mist">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  )

  return (
    <div>
      <PageHeader
        eyebrow="Media Library"
        title="File Sharing"
        desc="Share media with teammates and external partners using secure links with permissions, expiry and activity tracking."
        actions={<div className="flex items-center gap-2">
          <Button onClick={() => navigate('/admin/media-library/settings')}><Settings2 className="size-4" /> Settings</Button>
          <Button className={A.solid} onClick={openNew}><Plus className="size-4" /> Share files</Button>
        </div>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {statChip(<Link2 className="size-4" />, 'Active links', String(stats.active))}
        {statChip(<CalendarClock className="size-4" />, 'Expiring in 7 days', String(stats.expiring))}
        {statChip(<Users className="size-4" />, 'Shares created', String(stats.files))}
        {statChip(<HardDrive className="size-4" />, 'Data shared', fmtSize(stats.sizeKb))}
      </div>

      <div className="card overflow-hidden rounded-xl">
        {/* ---- Toolbar ---- */}
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files, people..." className="max-w-xs" />
          <Select value={accessFilter} onChange={(e) => setAccessFilter(e.target.value as 'all' | ShareAccess)} className="w-36">
            <option value="all">All access</option>
            <option value="view">Can view</option>
            <option value="download">Can download</option>
            <option value="edit">Can edit</option>
          </Select>
          <Select value={visFilter} onChange={(e) => setVisFilter(e.target.value as 'all' | 'public' | 'private')} className="w-36">
            <option value="all">All visibility</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="w-36">
            <option value="newest">Newest first</option>
            <option value="name">Name A–Z</option>
            <option value="size">Largest first</option>
            <option value="expiry">Soonest expiry</option>
          </Select>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-line">
              <button type="button" title="List view" onClick={() => setView('list')} className={`cursor-pointer p-2 transition ${view === 'list' ? A.solid : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`}><List className="size-4" /></button>
              <button type="button" title="Grid view" onClick={() => setView('grid')} className={`cursor-pointer p-2 transition ${view === 'grid' ? A.solid : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`}><LayoutGrid className="size-4" /></button>
            </div>
            <Select value={String(perPage)} onChange={(e) => setPerPage(Number(e.target.value))} className="w-28">
              <option value={8}>8 per page</option>
              <option value={16}>16 per page</option>
              <option value={24}>24 per page</option>
            </Select>
          </div>
        </div>

        {/* ---- Status tabs ---- */}
        <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 pt-2">
          {(['all', 'active', 'expiring', 'expired', 'revoked'] as const).map((t) => {
            const on = tab === t
            return (
              <button key={t} type="button" onClick={() => setTab(t)} className={`-mb-px flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${on ? `border-current ${A.text}` : 'border-transparent text-mist hover:text-inherit'}`}>
                {t === 'all' ? 'All' : STATUS_META[t].label}
                <span className={`rounded-full px-1.5 text-xs font-bold ${on ? A.soft : 'bg-black/[0.06] dark:bg-white/10'}`}>{counts[t]}</span>
              </button>
            )
          })}
        </div>

        {slice.length === 0 && <Empty title="No shares" desc="No shared files match your search or filters." />}

        {view === 'list' && slice.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-black/[0.04] text-xs font-bold uppercase tracking-wide text-mist dark:bg-white/[0.05]">
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Shared with</th>
                  <th className="px-4 py-3">Access</th>
                  <th className="px-4 py-3">Visibility</th>
                  <th className="px-4 py-3">Link status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {slice.map((s) => (
                  <tr key={s.id} className="transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                    <td className={rowPad}>{fileCell(s)}</td>
                    <td className={rowPad}><MiniAvatars names={s.recipients} /></td>
                    <td className={rowPad}><Badge tone={ACCESS_TONE[s.access]}>{ACCESS_LABEL[s.access]}</Badge></td>
                    <td className={rowPad}>{visBadge(s.visibility)}</td>
                    <td className={rowPad}>{statusBadge(s)}</td>
                    <td className={`${rowPad} text-mist`}>{fmtDate(s.createdAt)}</td>
                    <td className={rowPad}>{actions(s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'grid' && slice.length > 0 && (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {slice.map((s) => (
              <div key={s.id} className="rounded-xl border border-line p-4">
                {fileCell(s)}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Badge tone={STATUS_META[shareStatus(s, today)].tone}>{STATUS_META[shareStatus(s, today)].label}</Badge>
                  <Badge tone={ACCESS_TONE[s.access]}>{ACCESS_LABEL[s.access]}</Badge>
                  {visBadge(s.visibility)}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <MiniAvatars names={s.recipients} />
                  <span className="text-xs text-mist">{s.expiresAt ? `Expires ${fmtDate(s.expiresAt)}` : 'Never expires'}</span>
                </div>
                <div className="mt-3 flex justify-end border-t border-line pt-2">{actions(s)}</div>
              </div>
            ))}
          </div>
        )}

        {/* ---- Footer / pagination ---- */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-mist">
          <span>Showing {filtered.length === 0 ? 0 : (cur - 1) * perPage + 1} to {Math.min(cur * perPage, filtered.length)} of {filtered.length} shares</span>
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={cur === 1} onClick={() => setPage(cur - 1)} className="flex cursor-pointer items-center gap-1 rounded-md border border-line px-3 py-1.5 transition enabled:hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50 dark:enabled:hover:bg-white/[0.06]"><ChevronLeft className="size-3.5" /> Previous</button>
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <button key={p} type="button" onClick={() => setPage(p)} className={`h-8 w-8 cursor-pointer rounded-md text-sm font-medium transition ${p === cur ? A.solid : 'border border-line hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`}>{p}</button>
            ))}
            <button type="button" disabled={cur === pages} onClick={() => setPage(cur + 1)} className="flex cursor-pointer items-center gap-1 rounded-md border border-line px-3 py-1.5 transition enabled:hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50 dark:enabled:hover:bg-white/[0.06]">Next <ChevronRight className="size-3.5" /></button>
          </div>
        </div>
      </div>

      {/* ---- New / edit share ---- */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setForm(null)}>
          <div className="card max-h-[92vh] w-full overflow-y-auto rounded-t-2xl p-4 sm:max-w-lg sm:rounded-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div>
                <h2 className="text-base font-bold sm:text-lg">{form.id ? 'Edit Share' : 'Share Files'}</h2>
                <p className="mt-1 text-sm text-mist">Create a secure link with permissions and expiry.</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setForm(null)} className="-mr-1 cursor-pointer rounded-md p-1.5 transition hover:bg-black/[0.05] dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 grid gap-4">
              <div>
                <label className="mb-1 block text-xs font-bold">File from Media Library</label>
                <Select value={form.fileId} onChange={(e) => setForm({ ...form, fileId: e.target.value })} disabled={!!form.id}>
                  {LIBRARY_FILES.map((f) => <option key={f.id} value={f.id}>{f.fileName}.{f.ext} ({fmtSize(f.sizeKb)})</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Share with (comma separated) *</label>
                <Input value={form.recipients} onChange={(e) => setForm({ ...form, recipients: e.target.value })} placeholder="e.g. Ama Serwaa, Print Vendor" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold">Access level</label>
                  <Select value={form.access} onChange={(e) => setForm({ ...form, access: e.target.value as ShareAccess })}>
                    <option value="view">Can view</option>
                    <option value="download">Can download</option>
                    <option value="edit">Can edit</option>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold">Link expires</label>
                  <Select value={String(form.expiryDays)} onChange={(e) => setForm({ ...form, expiryDays: Number(e.target.value) })}>
                    <option value="1">After 1 day</option>
                    <option value="7">After 7 days</option>
                    <option value="14">After 14 days</option>
                    <option value="30">After 30 days</option>
                    <option value="90">After 90 days</option>
                    <option value="0">Never</option>
                  </Select>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold">Link visibility</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['public', 'private'] as const).map((v) => {
                    const m = VIS_META[v]
                    const on = form.visibility === v
                    const blocked = v === 'public' && !settings.publicLinks && !on
                    return (
                      <button key={v} type="button" disabled={blocked} onClick={() => setForm({ ...form, visibility: v })}
                        className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${on ? `border-transparent ${A.solid}` : 'border-line hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`}>
                        <m.Icon className="size-4" /> {m.label}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-1.5 text-xs text-mist">
                  {!settings.publicLinks && form.visibility !== 'public'
                    ? 'Public links are disabled in Media Library settings.'
                    : VIS_META[form.visibility].desc + '.'}
                </p>
              </div>
              <div className="grid gap-3 rounded-lg border border-line p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-medium"><Download className="size-4 text-mist" /> Allow download</span>
                  <Switch checked={form.allowDownload} onChange={(v) => setForm({ ...form, allowDownload: v })} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-medium"><Lock className="size-4 text-mist" /> Require sign-in</span>
                  <Switch checked={form.requireSignIn} onChange={(v) => setForm({ ...form, requireSignIn: v })} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Note (optional)</label>
                <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Add a short message for recipients..." rows={2} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => setForm(null)}>Cancel</Button>
              <Button className={A.solid} onClick={saveForm}>{form.id ? 'Save Changes' : 'Create Share Link'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Share details ---- */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setViewing(null)}>
          <div className="card max-h-[92vh] w-full overflow-y-auto rounded-t-2xl p-4 sm:max-w-md sm:rounded-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-line pb-4">
              <h2 className="flex items-center gap-2 text-base font-bold sm:text-lg"><Share2 className="size-5" /> Share Details</h2>
              <button type="button" aria-label="Close" onClick={() => setViewing(null)} className="-mr-1 cursor-pointer rounded-md p-1.5 transition hover:bg-black/[0.05] dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 space-y-4 text-sm">
              {fileCell(viewing)}
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={STATUS_META[shareStatus(viewing, today)].tone}>{STATUS_META[shareStatus(viewing, today)].label}</Badge>
                <Badge tone={ACCESS_TONE[viewing.access]}>{ACCESS_LABEL[viewing.access]}</Badge>
                {visBadge(viewing.visibility)}
                {viewing.allowDownload && <Badge tone="lime"><Download className="size-3" /> Download on</Badge>}
                {viewing.requireSignIn && <Badge tone="zinc"><Lock className="size-3" /> Sign-in</Badge>}
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-line p-2.5">
                <Link2 className={`size-4 flex-shrink-0 ${A.text}`} />
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{shareLink(viewing.linkCode)}</span>
                <Button onClick={() => copyLink(viewing)}><Copy className="size-4" /> Copy</Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-mist">Owner</p><p className="mt-0.5 font-semibold">{viewing.owner}</p></div>
                <div><p className="text-xs text-mist">Created</p><p className="mt-0.5 font-semibold">{fmtDate(viewing.createdAt)}</p></div>
                <div><p className="text-xs text-mist">Expires</p><p className="mt-0.5 font-semibold">{viewing.expiresAt ? fmtDate(viewing.expiresAt) : 'Never'}</p></div>
                <div><p className="text-xs text-mist">Recipients</p><p className="mt-0.5 font-semibold">{viewing.recipients.length}</p></div>
              </div>
              {viewing.note && <p className="rounded-lg bg-black/[0.04] p-3 text-xs text-mist dark:bg-white/[0.05]">“{viewing.note}”</p>}
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mist"><Clock className="size-3.5" /> Activity</p>
                <ul className="space-y-2">
                  {viewing.activity.map((a, i) => (
                    <li key={i} className="flex items-baseline gap-2 text-xs">
                      <span className={`mt-0.5 size-1.5 flex-shrink-0 rounded-full ${A.bar}`} />
                      <span><span className="font-semibold">{a.who}</span> {a.what} <span className="text-mist">· {fmtDate(a.at)}</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => { openEdit(viewing); setViewing(null) }}><SquarePen className="size-4" /> Edit</Button>
              <Button className={viewing.active ? 'bg-amber-500 text-white hover:bg-amber-600' : A.solid} onClick={() => toggleActive(viewing)}>{viewing.active ? 'Revoke Link' : 'Re-activate'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
