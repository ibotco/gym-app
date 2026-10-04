import { useMemo, useState } from 'react'
import {
  Upload, Share2, HardDrive, Palette, AlertTriangle, RotateCcw, Trash2, Download, Lock, Globe, Type,
} from 'lucide-react'
import { PageHeader, Button, Select, Switch, Segmented } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import {
  defaultMediaSettings, loadMediaSettings, saveMediaSettings, FILE_TYPE_GROUPS, ACCENT_UI,
  type MediaSettingsState, type MediaAccent,
} from '../../lib/mediaSettings'
import { loadShares, saveShares, isExpired } from '../../lib/fileSharing'

function ToggleRow({ icon, label, desc, checked, onChange }: {
  icon: React.ReactNode; label: string; desc: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 flex-shrink-0 place-items-center rounded-lg bg-black/[0.05] text-mist dark:bg-white/[0.07]">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{label}</p>
          <p className="truncate text-xs text-mist">{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onChange={onChange} aria-label={label} />
    </div>
  )
}

export function MediaLibrarySettingsPage() {
  const toast = useToast()
  const initial = useMemo(() => loadMediaSettings(), [])
  const [s, setS] = useState<MediaSettingsState>(initial)
  const set = (patch: Partial<MediaSettingsState>) => setS((p) => ({ ...p, ...patch }))
  const dirty = JSON.stringify(s) !== JSON.stringify(initial)
  const A = ACCENT_UI[s.accent]

  const usedPct = Math.min(100, Math.round((s.usedGb / Math.max(1, s.quotaGb)) * 100))
  const overWarn = usedPct >= s.warnThresholdPct

  const save = () => {
    if (s.allowedTypes.length === 0) { toast.error('Select at least one allowed file type.'); return }
    saveMediaSettings(s)
    toast.success('Settings saved', 'Media Library preferences updated.')
  }

  const purgeExpired = () => {
    const list = loadShares()
    const keep = list.filter((x) => !isExpired(x))
    const removed = list.length - keep.length
    if (!removed) { toast.error('Nothing to purge', 'There are no expired share links.'); return }
    if (!window.confirm(`Remove ${removed} expired share link${removed > 1 ? 's' : ''}?`)) return
    saveShares(keep)
    toast.success('Expired links purged', `${removed} share${removed > 1 ? 's' : ''} removed.`)
  }

  const reset = () => {
    setS(defaultMediaSettings())
    toast.success('Defaults restored', 'Review and save to apply.')
  }

  return (
    <div className="pb-20">
      <PageHeader
        eyebrow="Media Library"
        title="Media Library Settings"
        desc="Control uploads, sharing defaults, storage quota and the look & feel of the Media Library workspace."
        actions={<Button onClick={reset}><RotateCcw className="size-4" /> Reset defaults</Button>}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {/* ---- Uploads ---- */}
        <div className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold"><Upload className={`size-4 ${A.text}`} /> Uploads</h2>
          <div className="grid gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold">Maximum file size</label>
              <Select value={String(s.maxUploadMb)} onChange={(e) => set({ maxUploadMb: Number(e.target.value) })} className="max-w-40">
                {[5, 10, 25, 50, 100, 250].map((n) => <option key={n} value={n}>{n} MB</option>)}
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold">Allowed file types</label>
              <div className="flex flex-wrap gap-2">
                {FILE_TYPE_GROUPS.map((g) => {
                  const on = s.allowedTypes.includes(g)
                  return (
                    <button key={g} type="button" onClick={() => set({ allowedTypes: on ? s.allowedTypes.filter((x) => x !== g) : [...s.allowedTypes, g] })}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition ${on ? `border-transparent ${A.solid}` : 'border-line text-mist hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`}>
                      {g}
                    </button>
                  )
                })}
              </div>
              {s.allowedTypes.length === 0 && <p className="mt-2 text-xs font-semibold text-rose-500">Select at least one file type, otherwise uploads are blocked.</p>}
            </div>
            <div className="divide-y divide-line border-t border-line">
              <ToggleRow icon={<Type className="size-4" />} label="Auto-rename duplicates" desc="Append a number instead of overwriting same-name uploads." checked={s.autoRename} onChange={(v) => set({ autoRename: v })} />
            </div>
          </div>
        </div>

        {/* ---- Sharing defaults ---- */}
        <div className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold"><Share2 className={`size-4 ${A.text}`} /> Sharing defaults</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold">Default access level</label>
              <Select value={s.defaultAccess} onChange={(e) => set({ defaultAccess: e.target.value as MediaSettingsState['defaultAccess'] })}>
                <option value="view">Can view</option>
                <option value="download">Can download</option>
                <option value="edit">Can edit</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold">Default link expiry</label>
              <Select value={String(s.defaultExpiryDays)} onChange={(e) => set({ defaultExpiryDays: Number(e.target.value) })}>
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="0">Never</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold">Default link visibility</label>
              <Select value={s.defaultVisibility} disabled={!s.publicLinks} onChange={(e) => set({ defaultVisibility: e.target.value as 'public' | 'private' })}>
                <option value="public">Public — anyone with the link</option>
                <option value="private">Private — invited people only</option>
              </Select>
            </div>
          </div>
          <div className="mt-2 divide-y divide-line">
            <ToggleRow icon={<Download className="size-4" />} label="Allow downloads by default" desc="New share links let recipients download the file." checked={s.defaultAllowDownload} onChange={(v) => set({ defaultAllowDownload: v })} />
            <ToggleRow icon={<Lock className="size-4" />} label="Require sign-in by default" desc="Recipients must sign in before opening new links." checked={s.defaultRequireSignIn} onChange={(v) => set({ defaultRequireSignIn: v })} />
            <ToggleRow icon={<Globe className="size-4" />} label="Public links" desc="Allow anyone with the link to open it (no sign-in)." checked={s.publicLinks} onChange={(v) => set({ publicLinks: v, ...(v ? {} : { defaultVisibility: 'private' as const }) })} />
          </div>
        </div>

        {/* ---- Storage ---- */}
        <div className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold"><HardDrive className={`size-4 ${A.text}`} /> Storage</h2>
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold">{s.usedGb.toFixed(2)} GB used of {s.quotaGb} GB</span>
              <span className={`font-bold ${overWarn ? 'text-rose-500' : 'text-mist'}`}>{usedPct}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/[0.08]">
              <div className={`h-full rounded-full transition-all ${overWarn ? 'bg-rose-500' : A.bar}`} style={{ width: `${usedPct}%` }} />
            </div>
            {overWarn && <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-rose-500"><AlertTriangle className="size-3.5" /> Usage is above your {s.warnThresholdPct}% warning threshold.</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold">Storage quota</label>
              <Select value={String(s.quotaGb)} onChange={(e) => set({ quotaGb: Number(e.target.value) })}>
                {[5, 10, 25, 50, 100, 500].map((n) => <option key={n} value={n}>{n} GB</option>)}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold">Warn at usage</label>
              <Select value={String(s.warnThresholdPct)} onChange={(e) => set({ warnThresholdPct: Number(e.target.value) })}>
                {[60, 70, 80, 90].map((n) => <option key={n} value={n}>{n}%</option>)}
              </Select>
            </div>
          </div>
        </div>

        {/* ---- Appearance & customization ---- */}
        <div className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold"><Palette className={`size-4 ${A.text}`} /> Appearance & customization</h2>
          <div className="grid gap-4">
            <div>
              <label className="mb-2 block text-xs font-bold">Accent colour</label>
              <div className="flex items-center gap-2.5">
                {(Object.keys(ACCENT_UI) as MediaAccent[]).map((k) => (
                  <button key={k} type="button" title={k} onClick={() => set({ accent: k })}
                    className={`size-8 cursor-pointer rounded-full transition ${ACCENT_UI[k].swatch} ${s.accent === k ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 ' + ACCENT_UI[k].ring : 'opacity-60 hover:opacity-100'}`}
                    aria-label={`Accent ${k}`} />
                ))}
                <span className="ml-1 text-xs font-semibold capitalize text-mist">{s.accent}</span>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold">Default view for File Sharing</label>
              <Segmented value={s.defaultView} onChange={(v) => set({ defaultView: v as 'list' | 'grid' })} options={[{ id: 'list', label: 'List' }, { id: 'grid', label: 'Grid' }]} />
            </div>
            <div className="divide-y divide-line border-t border-line">
              <ToggleRow icon={<Palette className="size-4" />} label="Compact tables" desc="Tighter rows to fit more shares on screen." checked={s.compact} onChange={(v) => set({ compact: v })} />
            </div>
          </div>
        </div>
      </div>

      {/* ---- Danger zone ---- */}
      <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/[0.06] p-5">
        <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-rose-600 dark:text-rose-400"><AlertTriangle className="size-4" /> Danger zone</h2>
        <p className="mb-3 text-xs text-mist">Permanently remove share links that have already expired. Active and never-expiring links are not touched.</p>
        <Button className="bg-rose-500 text-white hover:bg-rose-600" onClick={purgeExpired}><Trash2 className="size-4" /> Purge expired links</Button>
      </div>

      {/* ---- Save bar ---- */}
      <div className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 p-3 backdrop-blur transition dark:bg-zinc-900/95 lg:left-[260px] ${dirty ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="flex items-center justify-between gap-3 px-2">
          <p className="text-sm font-semibold text-mist">You have unsaved Media Library settings.</p>
          <div className="flex gap-2">
            <Button onClick={() => setS(initial)}>Discard</Button>
            <Button className={A.solid} onClick={save} disabled={s.allowedTypes.length === 0}>Save changes</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
