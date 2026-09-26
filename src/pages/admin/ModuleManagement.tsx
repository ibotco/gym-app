import { Fragment, useMemo, useState } from 'react'
import { Boxes, CheckCircle2, XCircle, ShieldCheck, ChevronDown, ChevronRight, RotateCcw, Wand2, CheckCheck, Ban } from 'lucide-react'
import { PageHeader, Button, Badge, StatCard, SearchField, Segmented, Modal, Switch, Empty } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useI18n } from '../../context/I18nContext'
import { MODULES, MODULE_PRESETS, type ModulePreset } from '../../lib/modules'
import { NAV } from '../../components/layout/DashboardLayout'
import { formatDateTime } from '../../lib/utils'

type AnyNav = { key?: string; heading?: string; children?: AnyNav[] }
const navList = NAV as unknown as AnyNav[]

function flattenNavKeys(children: AnyNav[] | undefined): string[] {
  const out: string[] = []
  for (const c of children ?? []) {
    if (c.heading) continue
    if (c.key) out.push(c.key)
    if (c.children) out.push(...flattenNavKeys(c.children))
  }
  return out
}

/** Sidebar menu items (child nav keys) controlled by a module. */
function moduleMenuItems(navKeys: string[]): string[] {
  const out: string[] = []
  for (const topKey of navKeys) {
    const entry = navList.find((n) => n.key === topKey)
    if (entry?.children) out.push(...flattenNavKeys(entry.children))
  }
  return [...new Set(out)]
}

export function ModuleManagement() {
  const app = useApp()
  const { modules, subModules, setModuleEnabled, setSubModuleHidden, log, audit, users } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const { t } = useI18n()

  const canEdit = hasRole('super_admin')

  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<{ id: string; label: string } | null>(null)
  const [bulkConfirm, setBulkConfirm] = useState<'disable' | 'reset' | null>(null)
  const [presetConfirm, setPresetConfirm] = useState<ModulePreset | null>(null)

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return MODULES.filter((m) => {
      if (filter === 'enabled' && !modules[m.id]) return false
      if (filter === 'disabled' && modules[m.id]) return false
      if (!ql) return true
      return m.label.toLowerCase().includes(ql) || m.description.toLowerCase().includes(ql)
    })
  }, [modules, q, filter])

  const enabledCount = MODULES.filter((m) => modules[m.id]).length
  const disabledCount = MODULES.length - enabledCount
  const hiddenItemsCount = Object.values(subModules).filter((v) => v === true).length

  const moduleAudit = useMemo(
    () => audit.filter((a) => a.entity === 'Module').slice(0, 20),
    [audit],
  )

  const requestToggle = (id: string, label: string, next: boolean) => {
    if (next) {
      applyToggle(id, label, next)
      return
    }
    // Disabling requires confirmation.
    setConfirming({ id, label })
  }

  const applyToggle = (id: string, label: string, next: boolean) => {
    const prev = modules[id]
    setModuleEnabled(id, next)
    log(
      user?.id || 'system',
      'UPDATE',
      'Module',
      `${label}: ${prev ? 'Enabled' : 'Disabled'} → ${next ? 'Enabled' : 'Disabled'}`,
    )
    toast.success('Module visibility updated successfully.')
  }

  const applyBulk = (enabled: boolean) => {
    MODULES.forEach((m) => setModuleEnabled(m.id, enabled))
    log(user?.id || 'system', 'UPDATE', 'Module', enabled ? 'Bulk action: all modules enabled' : 'Bulk action: all modules disabled')
    toast.success(enabled ? 'All modules enabled.' : 'All modules disabled.')
  }

  const applyReset = () => {
    MODULES.forEach((m) => setModuleEnabled(m.id, m.defaultEnabled))
    Object.keys(subModules).forEach((k) => setSubModuleHidden(k, false))
    log(user?.id || 'system', 'UPDATE', 'Module', 'Reset modules to defaults')
    toast.success('Modules reset to their default state.')
  }

  const applyPreset = (p: ModulePreset) => {
    const changed = MODULES.filter((m) => !!modules[m.id] !== p.modules.includes(m.id)).length
    MODULES.forEach((m) => setModuleEnabled(m.id, p.modules.includes(m.id)))
    log(user?.id || 'system', 'UPDATE', 'Module', `Preset ${p.label}: ${changed} modules changed`)
    toast.success(`"${p.label}" preset applied.`)
  }

  const toggleMenuItem = (moduleLabel: string, key: string, shown: boolean) => {
    setSubModuleHidden(key, !shown)
    log(
      user?.id || 'system',
      'UPDATE',
      'Module',
      `${moduleLabel} menu item ${t(key)}: ${shown ? 'Visible' : 'Hidden'} → ${shown ? 'Hidden' : 'Visible'}`,
    )
    toast.success(shown ? 'Menu item hidden.' : 'Menu item restored.')
  }

  return (
    <div>
      <PageHeader
        title="Module Management"
        desc="Enable or disable modules available in the system sidebar."
      />

      {!canEdit && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-sky-400/30 bg-sky-400/10 p-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-sky-400" />
          <p className="text-sm">
            <span className="font-semibold">View only.</span> Only the Super Admin can enable or disable modules.
          </p>
        </div>
      )}

      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard label="Total modules" value={String(MODULES.length)} icon={<Boxes className="size-4" />} />
        <StatCard label="Enabled" value={String(enabledCount)} icon={<CheckCircle2 className="size-4" />} />
        <StatCard label="Disabled" value={String(disabledCount)} icon={<XCircle className="size-4" />} />
      </div>

      {/* Industry presets + bulk actions */}
      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-mist">Industry presets</span>
        {MODULE_PRESETS.map((p) => (
          <Button key={p.id} variant="outline" size="sm" disabled={!canEdit} onClick={() => setPresetConfirm(p)} title={p.desc}>
            <Wand2 className="size-4" /> {p.label}
          </Button>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />
        <Button variant="outline" size="sm" disabled={!canEdit} onClick={() => applyBulk(true)}>
          <CheckCheck className="size-4" /> Enable all
        </Button>
        <Button variant="outline" size="sm" disabled={!canEdit} onClick={() => setBulkConfirm('disable')}>
          <Ban className="size-4" /> Disable all
        </Button>
        <Button variant="outline" size="sm" disabled={!canEdit} onClick={() => setBulkConfirm('reset')}>
          <RotateCcw className="size-4" /> Reset to defaults
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchField value={q} onChange={setQ} placeholder="Search modules…" className="w-full max-w-sm" />
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: 'All Modules' },
            { id: 'enabled', label: 'Enabled' },
            { id: 'disabled', label: 'Disabled' },
          ]}
        />
        {hiddenItemsCount > 0 && (
          <Badge tone="amber">{hiddenItemsCount} menu item{hiddenItemsCount === 1 ? '' : 's'} hidden</Badge>
        )}
      </div>

      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Module Name</th>
              <th>Description</th>
              <th>Status</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const on = modules[m.id]
              const items = moduleMenuItems(m.navKeys)
              const hiddenItems = items.filter((k) => subModules[k] === true).length
              const isOpen = expanded === m.id
              return (
                <Fragment key={m.id}>
                  <tr className={!on ? 'opacity-70' : undefined}>
                    <td className="font-semibold">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : m.id)}
                          aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${m.label}`}
                          aria-expanded={isOpen}
                          className="cursor-pointer text-mist transition hover:text-inherit"
                        >
                          {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </button>
                        <span>{m.label}</span>
                        {hiddenItems > 0 && <Badge tone="amber">{hiddenItems} hidden</Badge>}
                      </div>
                    </td>
                    <td className="text-mist">{m.description}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Badge tone={on ? 'lime' : 'zinc'}>{on ? 'Enabled' : 'Disabled'}</Badge>
                        {m.id === 'settings' && !on && (
                          <span className="text-[11px] text-mist">(stays visible to Super Admin)</span>
                        )}
                      </div>
                    </td>
                    <td className="text-right">
                      <Switch
                        checked={on}
                        disabled={!canEdit}
                        onChange={(next) => requestToggle(m.id, m.label, next)}
                        aria-label={`${m.label} ${on ? 'enabled' : 'disabled'}`}
                      />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={4} className="bg-black/5 dark:bg-white/5">
                        <div className="px-4 py-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-mist">
                            Menu items in {m.label}
                          </p>
                          {items.length ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {items.map((k) => {
                                const shown = subModules[k] !== true
                                return (
                                  <div key={k} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                                    <span className={`text-sm ${shown ? '' : 'text-mist line-through'}`}>{t(k)}</span>
                                    <Switch
                                      checked={shown}
                                      disabled={!canEdit}
                                      onChange={(next) => toggleMenuItem(m.label, k, next)}
                                      aria-label={`${t(k)} visible`}
                                    />
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-mist">
                              This module has a single menu entry — use the module switch instead.
                            </p>
                          )}
                          <p className="mt-2 text-xs text-mist">
                            Hiding an item removes just that entry from the sidebar for every user; the module itself stays on.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {!rows.length && <Empty title="No modules found" desc="Adjust your search or filter." />}
      </div>

      <p className="mt-3 text-xs text-mist">
        Disabling a module hides its menu from the sidebar for all users. The Settings module always remains visible to the Super Admin so they can re-enable modules.
      </p>

      {/* Audit log */}
      <h2 className="font-display mt-8 text-xl">Recent module changes</h2>
      <div className="card mt-3 table-wrap">
        <table className="data">
          <thead>
            <tr><th>Module</th><th>Change</th><th>Modified by</th><th>Date &amp; time</th></tr>
          </thead>
          <tbody>
            {moduleAudit.map((a) => {
              const name = users.find((u) => u.id === a.userId)?.name || a.userId
              const [label, change] = a.details.includes(': ') ? a.details.split(': ') : ['', a.details]
              return (
                <tr key={a.id}>
                  <td className="font-semibold">{label}</td>
                  <td className="text-mist">{change}</td>
                  <td>{name}</td>
                  <td className="text-mist">{formatDateTime(a.createdAt)}</td>
                </tr>
              )
            })}
            {!moduleAudit.length && (
              <tr><td colSpan={4} className="py-6 text-center text-sm text-mist">No module changes yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation: hide module */}
      <Modal open={!!confirming} onClose={() => setConfirming(null)} title="Hide this module?">
        {confirming && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Are you sure you want to hide <span className="font-semibold text-inherit">{confirming.label}</span> from the sidebar navigation?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirming(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => { applyToggle(confirming.id, confirming.label, false); setConfirming(null) }}
              >
                Hide module
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmation: bulk actions */}
      <Modal
        open={!!bulkConfirm}
        onClose={() => setBulkConfirm(null)}
        title={bulkConfirm === 'reset' ? 'Reset modules to defaults?' : 'Disable all modules?'}
      >
        <div className="space-y-3">
          <p className="text-sm text-mist">
            {bulkConfirm === 'reset'
              ? 'Every module returns to its default state and hidden menu items are restored for all users.'
              : 'This hides every module from the sidebar for all users. Settings stays visible to the Super Admin.'}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBulkConfirm(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (bulkConfirm === 'reset') applyReset()
                else applyBulk(false)
                setBulkConfirm(null)
              }}
            >
              {bulkConfirm === 'reset' ? 'Reset' : 'Disable all'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation: industry preset */}
      <Modal open={!!presetConfirm} onClose={() => setPresetConfirm(null)} title={`Apply "${presetConfirm?.label ?? ''}" preset?`}>
        {presetConfirm && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              {presetConfirm.desc} Every module outside this preset will be hidden.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPresetConfirm(null)}>Cancel</Button>
              <Button onClick={() => { applyPreset(presetConfirm); setPresetConfirm(null) }}>Apply preset</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
