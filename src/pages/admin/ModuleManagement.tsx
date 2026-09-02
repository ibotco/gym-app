import { useMemo, useState } from 'react'
import { Boxes, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react'
import { PageHeader, Button, Badge, StatCard, SearchField, Segmented, Modal, Switch, Empty } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { MODULES } from '../../lib/modules'
import { formatDateTime } from '../../lib/utils'

export function ModuleManagement() {
  const app = useApp()
  const { modules, setModuleEnabled, log, audit, users } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()

  const canEdit = hasRole('super_admin')

  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [confirming, setConfirming] = useState<{ id: string; label: string } | null>(null)

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
              return (
                <tr key={m.id} className={!on ? 'opacity-70' : undefined}>
                  <td className="font-semibold">{m.label}</td>
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

      {/* Confirmation */}
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
    </div>
  )
}
