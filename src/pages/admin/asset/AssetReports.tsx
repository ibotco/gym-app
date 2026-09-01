import { useMemo } from 'react'
import { Boxes, Wrench, TrendingDown, ArrowLeftRight, Printer, Wallet } from 'lucide-react'
import { PageHeader, Button, StatCard, Badge, Empty } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhs, formatGhsExact, formatDate } from '../../../lib/utils'
import { ASSET_STATUSES } from '../../../lib/assets'
import { ASSET_TRANSACTION_TYPES } from '../../../lib/assetTransactions'
import { accumulatedDepreciation, residualValue } from '../../../lib/assets'
import { Bar, BarChart, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts'

const PIE_COLORS = ['#C8F542', '#38BDF8', '#A78BFA', '#FBBF24', '#FB7185', '#34D399', '#60A5FA', '#F59E0B']

export function AssetReports() {
  const app = useApp()
  const { assets, assetTransactions, depreciation, assetCategories, assetConditions, depreciationPolicy } = app
  const toast = useToast()
  const lifeYears = depreciationPolicy.usefulLifeYears
  const residualPct = depreciationPolicy.residualPercent

  // ---- Summary metrics ----
  const totalCost = assets.reduce((s, a) => s + (a.purchaseCost || 0), 0)
  const totalBook = assets.reduce((s, a) => {
    if (a.purchaseCost == null) return s
    return s + (a.currentValue ?? (a.purchaseCost - accumulatedDepreciation(a.purchaseCost, a.purchaseDate || '', lifeYears, residualPct)))
  }, 0)
  const totalAccumulated = assets.reduce((s, a) => s + (a.purchaseCost != null ? accumulatedDepreciation(a.purchaseCost, a.purchaseDate || '', lifeYears, residualPct) : 0), 0)
  const inMaintenance = assets.filter((a) => a.status === 'maintenance').length
  const retired = assets.filter((a) => a.status === 'retired').length
  const noCost = assets.filter((a) => a.purchaseCost == null || a.purchaseCost <= 0).length

  // ---- By category ---- (value = book value)
  const byCategory = useMemo(() => {
    const map = new Map<string, { value: number; count: number }>()
    for (const a of assets) {
      const book = a.purchaseCost != null ? (a.currentValue ?? (a.purchaseCost - accumulatedDepreciation(a.purchaseCost, a.purchaseDate || '', lifeYears, residualPct))) : 0
      const cur = map.get(a.category) || { value: 0, count: 0 }
      map.set(a.category, { value: cur.value + book, count: cur.count + 1 })
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.value - a.value)
  }, [assets, lifeYears, residualPct])

  // ---- By status ---- (count)
  const byStatus = useMemo(() => {
    const map = new Map<string, number>()
    assets.forEach((a) => map.set(a.status, (map.get(a.status) || 0) + 1))
    return Array.from(map.entries())
      .map(([id, value]) => ({ name: ASSET_STATUSES.find((s) => s.id === id)?.label || id, value }))
  }, [assets])

  // ---- By condition ---- (count)
  const byCondition = useMemo(() => {
    const map = new Map<string, number>()
    assets.forEach((a) => map.set(a.condition, (map.get(a.condition) || 0) + 1))
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [assets])

  // ---- Transactions by type ----
  const txByType = useMemo(() => {
    const map = new Map<string, number>()
    assetTransactions.forEach((t) => map.set(t.type, (map.get(t.type) || 0) + 1))
    return Array.from(map.entries())
      .map(([id, value]) => ({ name: ASSET_TRANSACTION_TYPES.find((t) => t.id === id)?.label || id, value }))
  }, [assetTransactions])

  // ---- Monthly acquisitions ----
  const acquisitionsByMonth = useMemo(() => {
    const map = new Map<string, number>()
    assets.forEach((a) => {
      if (!a.purchaseDate) return
      const m = a.purchaseDate.slice(0, 7)
      map.set(m, (map.get(m) || 0) + (a.purchaseCost || 0))
    })
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, value]) => ({ month, value }))
  }, [assets])

  // ---- Export blocks ----
  const assetName = (id: string) => {
    const a = assets.find((x) => x.id === id)
    return a ? `${a.tag} — ${a.name}` : id
  }
  const blocks = [
    {
      t: 'Asset register', d: `${assets.length} assets · ${formatGhs(totalBook)} book value`, filename: 'asset-register',
      rows: assets.map((a) => ({
        tag: a.tag, name: a.name, category: a.category, serialNumber: a.serialNumber || '',
        status: a.status, condition: a.condition, location: a.location, assignedTo: a.assignedTo || '',
        purchaseDate: a.purchaseDate || '', purchaseCost: a.purchaseCost ?? '', currentValue: a.currentValue ?? '',
      })),
    },
    {
      t: 'Depreciation summary', d: `${assets.length - noCost} depreciable · ${formatGhs(totalAccumulated)} accumulated`, filename: 'asset-depreciation',
      rows: assets.filter((a) => a.purchaseCost != null && a.purchaseCost > 0).map((a) => {
        const c = a.purchaseCost as number
        return {
          tag: a.tag, name: a.name, cost: c, residual: residualValue(c, residualPct),
          accumulated: accumulatedDepreciation(c, a.purchaseDate || '', lifeYears, residualPct),
          bookValue: a.currentValue ?? (c - accumulatedDepreciation(c, a.purchaseDate || '', lifeYears, residualPct)),
        }
      }),
    },
    {
      t: 'Depreciation entries', d: `${depreciation.length} journals · ${formatGhs(depreciation.reduce((s, d) => s + d.amount, 0))}`, filename: 'depreciation-entries',
      rows: depreciation.map((d) => ({ date: d.date, asset: assetName(d.assetId), method: d.method, amount: d.amount, notes: d.notes || '' })),
    },
    {
      t: 'Asset transactions', d: `${assetTransactions.length} movements`, filename: 'asset-transactions',
      rows: assetTransactions.map((t) => ({ date: t.date, asset: assetName(t.assetId), type: t.type, from: t.from || '', to: t.to || '', amount: t.amount ?? '', performedBy: t.performedBy || '' })),
    },
    {
      t: 'Value by category', d: `${byCategory.length} categories`, filename: 'value-by-category',
      rows: byCategory.map((c) => ({ category: c.name, assets: c.count, value: c.value })),
    },
    {
      t: 'Assets by status', d: `${byStatus.length} statuses`, filename: 'assets-by-status',
      rows: byStatus.map((s) => ({ status: s.name, count: s.value })),
    },
    {
      t: 'Assets by condition', d: `${byCondition.length} conditions`, filename: 'assets-by-condition',
      rows: byCondition.map((c) => ({ condition: c.name, count: c.value })),
    },
  ]

  const summaryRows = [
    { label: 'Total assets', value: String(assets.length) },
    { label: 'Assets with cost', value: String(assets.length - noCost) },
    { label: 'Original cost', value: formatGhsExact(totalCost) },
    { label: 'Book value', value: formatGhsExact(totalBook) },
    { label: 'Accumulated depreciation', value: formatGhsExact(totalAccumulated) },
    { label: 'In maintenance', value: String(inMaintenance) },
    { label: 'Retired', value: String(retired) },
    { label: 'Depreciation policy', value: `${depreciationPolicy.method === 'reducing_balance' ? 'Reducing balance' : 'Straight-line'} · ${lifeYears}y · ${residualPct}%` },
  ]

  return (
    <div>
      <PageHeader
        title="Asset reports"
        desc="Value, depreciation, condition, and movement analytics across your asset register."
        actions={
          <Button variant="outline" onClick={() => { window.print(); toast.info('Use Print → Save as PDF') }}>
            <Printer className="size-5" style={{ width: 20, height: 20 }} /> Print / PDF
          </Button>
        }
      />

      {/* Summary stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Book value" value={formatGhs(totalBook)} hint={`${assets.length} assets`} icon={<Boxes className="size-4" />} />
        <StatCard label="Original cost" value={formatGhs(totalCost)} icon={<Wallet className="size-4" />} />
        <StatCard label="Accum. depreciation" value={formatGhs(totalAccumulated)} icon={<TrendingDown className="size-4" />} />
        <StatCard label="In maintenance" value={String(inMaintenance)} hint={`${retired} retired`} icon={<Wrench className="size-4" />} />
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <p className="mb-2 text-sm font-semibold">Value by category</p>
          {byCategory.length ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} label>
                    {byCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatGhs(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty title="No asset data" />}
        </div>
        <div className="card p-4">
          <p className="mb-2 text-sm font-semibold">Assets by status</p>
          {byStatus.length ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} label>
                    {byStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty title="No status data" />}
        </div>
        <div className="card p-4">
          <p className="mb-2 text-sm font-semibold">Acquisitions by month</p>
          {acquisitionsByMonth.length ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={acquisitionsByMonth}>
                  <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} />
                  <Tooltip formatter={(v) => formatGhs(Number(v))} />
                  <Bar dataKey="value" fill="#C8F542" name="Cost" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty title="No acquisition data" />}
        </div>
        <div className="card p-4">
          <p className="mb-2 text-sm font-semibold">Transactions by type</p>
          {txByType.length ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={txByType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} label>
                    {txByType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty title="No transaction data" />}
        </div>
      </div>

      {/* Condition breakdown */}
      {byCondition.length > 0 && (
        <div className="card mt-4 p-4">
          <p className="mb-3 text-sm font-semibold">Assets by condition</p>
          <div className="grid gap-2 md:grid-cols-2">
            {byCondition.map((c, idx) => (
              <div key={c.name} className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Badge tone="zinc">#{idx + 1}</Badge>
                  <span className="truncate">{c.name}</span>
                </span>
                <span className="font-semibold">{c.value} asset{c.value === 1 ? '' : 's'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary table */}
      <div className="card mt-4 table-wrap">
        <table className="data">
          <thead><tr><th>Metric</th><th>Value</th></tr></thead>
          <tbody>
            {summaryRows.map((r) => (
              <tr key={r.label}><td className="font-semibold">{r.label}</td><td>{r.value}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Exportable reports */}
      <h2 className="font-display mt-8 text-xl">Export reports</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {blocks.map((b) => (
          <div key={b.t} className="card p-5">
            <h3 className="font-semibold">{b.t}</h3>
            <p className="mt-1 text-sm text-mist">{b.d}</p>
            <div className="mt-4">
              <ExportButtons filename={b.filename} rows={b.rows} onDone={(label, ok) => ok ? toast.success(`${label} export started`) : toast.error('Export blocked')} />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-mist">
        Reports are generated from your live asset, depreciation, and transaction data. Categories ({assetCategories.length}), conditions ({assetConditions.length}) and policy applied from Asset setup. Generated {formatDate(new Date().toISOString())}.
      </p>
    </div>
  )
}
