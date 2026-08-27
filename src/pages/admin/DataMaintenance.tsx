import { useMemo, useState } from 'react'
import { Trash2, AlertTriangle, Download, ShieldAlert, Copy, Check } from 'lucide-react'
import { Button, Modal, Badge } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { DATA_COLLECTIONS, createBackup, buildBackup } from '../../lib/dataReset'
import { loadIntegrations } from '../../lib/integrations'
import { cn, downloadText } from '../../lib/utils'

export function DataMaintenance() {
  const app = useApp()
  const { hasRole } = useAuth()
  const toast = useToast()
  const canClear = hasRole('super_admin')

  const [selected, setSelected] = useState<string[]>([])
  const [confirm, setConfirm] = useState(false)
  const [withBackup, setWithBackup] = useState(true)
  const [backupView, setBackupView] = useState<{ filename: string; json: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const counts = useMemo<Record<string, number>>(() => {
    const roles = app.roles
    const perms = app.permissions
    const ints = loadIntegrations()
    return {
      users: app.users.length,
      members: app.members.length,
      trainers: app.trainers.length,
      staff: app.staff.length,
      plans: app.plans.length,
      memberships: app.memberships.length,
      payments: app.payments.length,
      invoices: app.invoices.length,
      classes: app.classes.length,
      bookings: app.bookings.length,
      attendance: app.attendance.length,
      workouts: app.workouts.length,
      progress: app.progress.length,
      notifications: app.notifications.length,
      branches: app.branches.length,
      leads: app.leads.length,
      messages: app.messages.length,
      audit: app.audit.length,
      leaves: app.leaves.length,
      sessions: app.sessions.length,
      inventory: app.inventory.length,
      purchases: app.purchases.length,
      purchaseOrders: app.purchaseOrders.length,
      purchaseReturns: app.purchaseReturns.length,
      sales: app.sales.length,
      proposals: app.proposals.length,
      estimates: app.estimates.length,
      salesOrders: app.salesOrders.length,
      shipments: app.shipments.length,
      salesReturns: app.salesReturns.length,
      discounts: app.discounts.length,
      departments: app.departments.length,
      payslips: app.payslips.length,
      jobs: app.jobs.length,
      candidates: app.candidates.length,
      reviews: app.reviews.length,
      staffAttendance: app.staffAttendance.length,
      assets: app.assets.length,
      depreciation: app.depreciation.length,
      assetTransactions: app.assetTransactions.length,
      customers: app.customers.length,
      supplierCategories: app.supplierCategories.length,
      customerCategories: app.customerCategories.length,
      modules: Object.keys(app.modules).length,
      accounting: app.accounts.length + app.receipts.length + app.paymentVouchers.length + app.journals.length + app.banks.length + app.signatories.length + app.voucherSerials.length + app.funds.length + app.paymentModes.length + app.detailTypes.length + app.incomeMods.length + app.currencyRates.length + app.reconciliations.length + app.budgets.length + app.valueBook.length,
      assetCategories: app.assetCategories.length,
      assetConditions: app.assetConditions.length,
      credentialEvents: app.credentialEvents.length,
      roles: roles.filter((r) => !r.builtin).length,
      permissions: perms.filter((p) => !p.builtin).length,
      integrations: ints.length,
    }
  }, [app])

  const toggle = (key: string) => {
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]))
  }

  const allSelected = selected.length === DATA_COLLECTIONS.length

  const toggleAll = () => {
    setSelected(allSelected ? [] : DATA_COLLECTIONS.map((c) => c.key))
  }

  const snapshot = () => ({
    company: app.company,
    users: app.users,
    members: app.members,
    trainers: app.trainers,
    staff: app.staff,
    plans: app.plans,
    memberships: app.memberships,
    payments: app.payments,
    invoices: app.invoices,
    classes: app.classes,
    bookings: app.bookings,
    attendance: app.attendance,
    workouts: app.workouts,
    progress: app.progress,
    notifications: app.notifications,
    branches: app.branches,
    leads: app.leads,
    messages: app.messages,
    audit: app.audit,
    leaves: app.leaves,
    sessions: app.sessions,
    inventory: app.inventory,
    suppliers: app.suppliers,
    stockMovements: app.stockMovements,
    purchases: app.purchases,
    purchaseOrders: app.purchaseOrders,
    purchaseReturns: app.purchaseReturns,
    sales: app.sales,
    proposals: app.proposals,
    estimates: app.estimates,
    salesOrders: app.salesOrders,
    shipments: app.shipments,
    salesReturns: app.salesReturns,
    discounts: app.discounts,
    departments: app.departments,
    payslips: app.payslips,
    jobs: app.jobs,
    candidates: app.candidates,
    reviews: app.reviews,
    staffAttendance: app.staffAttendance,
    assets: app.assets,
    depreciation: app.depreciation,
    assetTransactions: app.assetTransactions,
    customers: app.customers,
    supplierCategories: app.supplierCategories,
    customerCategories: app.customerCategories,
    modules: app.modules,
    sidebarOrder: app.sidebarOrder,
    accounts: app.accounts,
    accountingSettings: app.accountingSettings,
    receipts: app.receipts,
    paymentVouchers: app.paymentVouchers,
    journals: app.journals,
    banks: app.banks,
    signatories: app.signatories,
    voucherSerials: app.voucherSerials,
    funds: app.funds,
    paymentModes: app.paymentModes,
    detailTypes: app.detailTypes,
    incomeMods: app.incomeMods,
    currencyRates: app.currencyRates,
    reconciliations: app.reconciliations,
    budgets: app.budgets,
    valueBook: app.valueBook,
    assetCategories: app.assetCategories,
    assetConditions: app.assetConditions,
    depreciationPolicy: app.depreciationPolicy,
    credentialEvents: app.credentialEvents,
    credentialSettings: app.credentialSettings,
    roles: app.roles,
    permissions: app.permissions,
    integrations: loadIntegrations(),
  })

  const downloadBackup = () => {
    setBackupView(buildBackup(snapshot()))
  }

  const doDownload = async () => {
    const { filename, json } = buildBackup(snapshot())
    const ok = await downloadText(filename, json, 'application/json')
    if (ok) {
      toast.success('Download started', 'Check your browser downloads. If nothing appears, use Copy to clipboard.')
    } else {
      toast.error('Download blocked', 'Your browser blocked the download. Use Copy to clipboard instead.')
    }
  }

  const copyBackup = async () => {
    if (!backupView) return
    try {
      await navigator.clipboard.writeText(backupView.json)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Could not copy', 'Select the text below and copy it manually.')
    }
  }

  const doClear = () => {
    if (!canClear) return
    if (withBackup) {
      createBackup(snapshot())
    }
    app.resetData(selected)
    const labels = DATA_COLLECTIONS.filter((c) => selected.includes(c.key)).map((c) => c.label).join(', ')
    app.log('system', 'CLEAR', 'Data', `Cleared ${selected.length} collection(s): ${labels}${withBackup ? ' · backup created first' : ''}`)
    toast.success('Data cleared', withBackup
      ? `${selected.length} collection(s) reset. A backup was downloaded first.`
      : `${selected.length} collection(s) reset to defaults.`)
    setSelected([])
    setConfirm(false)
  }

  return (
    <div className="card mt-4 max-w-3xl p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-500">
          <AlertTriangle className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Clear database</p>
          <p className="mt-1 text-sm text-mist">
            Select the collections you want to reset to their factory defaults. This removes any test or sample entries you created, so you can start fresh. This cannot be undone.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadBackup}>
          <Download className="size-4" /> Create backup
        </Button>
      </div>

      {!canClear && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-500" />
          <p className="text-sm">
            <span className="font-semibold">Super admin only.</span> You can create a backup, but clearing the database is reserved for the super admin role.
          </p>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-b border-line pb-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="size-4 accent-[#c8f542]" checked={allSelected} onChange={toggleAll} disabled={!canClear} />
          Select all
        </label>
        <span className="text-xs text-mist">{selected.length} selected</span>
      </div>

      <div className="mt-2 max-h-[46vh] space-y-1 overflow-y-auto pr-1">
        {DATA_COLLECTIONS.map((c) => {
          const on = selected.includes(c.key)
          const n = counts[c.key] ?? 0
          return (
            <label
              key={c.key}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                canClear && 'cursor-pointer',
                on ? 'bg-lime/10 ring-1 ring-lime' : 'hover:bg-white/5',
                !canClear && 'opacity-60',
              )}
            >
              <input type="checkbox" className="size-4 shrink-0 accent-[#c8f542]" checked={on} onChange={() => toggle(c.key)} disabled={!canClear} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{c.label}</span>
                <span className="block truncate text-xs text-mist">{c.desc}</span>
              </span>
              <Badge tone={n > 0 ? 'lime' : 'zinc'}>{n} record{n === 1 ? '' : 's'}</Badge>
            </label>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <p className="text-xs text-mist">Built-in demo data is restored when a collection is cleared.</p>
        <Button variant="danger" disabled={!selected.length || !canClear} onClick={() => setConfirm(true)}>
          <Trash2 className="size-4" /> Clear {selected.length || ''} selected
        </Button>
      </div>

      <Modal open={!!backupView} onClose={() => setBackupView(null)} title="Backup created" wide>
        {backupView && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Your backup snapshot (<span className="font-mono text-xs">{backupView.filename}</span>) is ready.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void doDownload()}>
                <Download className="size-4" /> Download .json
              </Button>
              <Button variant="outline" onClick={() => void copyBackup()}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy to clipboard'}
              </Button>
            </div>
            <p className="text-xs text-mist">
              If the download doesn&apos;t appear (some embedded/sandboxed windows block downloads), use <span className="font-semibold">Copy to clipboard</span> or select the text below and save it as a <span className="font-mono">.json</span> file.
            </p>
            <textarea
              readOnly
              value={backupView.json}
              rows={12}
              className="field w-full resize-y font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
        )}
      </Modal>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Clear selected data?">
        <div className="space-y-3">
          <p className="text-sm text-mist">
            You are about to reset <span className="font-semibold text-inherit">{selected.length}</span> collection(s) to their defaults:
          </p>
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/10 p-3 text-sm">
            {DATA_COLLECTIONS.filter((c) => selected.includes(c.key)).map((c) => (
              <li key={c.key} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-lime" aria-hidden /> {c.label}
              </li>
            ))}
          </ul>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[#c8f542]"
              checked={withBackup}
              onChange={(e) => setWithBackup(e.target.checked)}
            />
            <span>
              <span className="font-semibold">Create a backup before clearing</span>
              <span className="block text-xs text-mist">Download a full JSON snapshot of the current data first, so you can review or restore it later.</span>
            </span>
          </label>
          <p className="text-xs text-amber-500">This removes any entries you created while testing and cannot be undone.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button variant="danger" onClick={doClear}>Clear data</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
