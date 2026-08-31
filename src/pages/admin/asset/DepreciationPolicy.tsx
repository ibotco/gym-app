import { useState } from 'react'
import { Save, RotateCcw, Info } from 'lucide-react'
import { PageHeader, Button, Field, Input, Select } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { annualDepreciation, residualValue } from '../../../lib/assets'
import { DEFAULT_DEPRECIATION_POLICY } from '../../../lib/assetSettings'
import { formatGhs } from '../../../lib/utils'
import type { DepreciationPolicy as Policy } from '../../../types'

export function DepreciationPolicy() {
  const app = useApp()
  const { depreciationPolicy, setDepreciationPolicy, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [method, setMethod] = useState<Policy['method']>(depreciationPolicy.method)
  const [years, setYears] = useState(String(depreciationPolicy.usefulLifeYears))
  const [residual, setResidual] = useState(String(depreciationPolicy.residualPercent))

  const save = () => {
    const y = Number(years)
    const r = Number(residual)
    if (!Number.isFinite(y) || y < 1 || y > 50) { toast.error('Useful life must be between 1 and 50 years.'); return }
    if (!Number.isFinite(r) || r < 0 || r > 90) { toast.error('Residual value must be between 0% and 90%.'); return }
    const policy: Policy = { method, usefulLifeYears: Math.round(y), residualPercent: r }
    setDepreciationPolicy(policy)
    log(user?.id || 'system', 'UPDATE', 'DepreciationPolicy', `Set ${policy.method} policy — ${policy.usefulLifeYears} years, ${policy.residualPercent}% residual`)
    toast.success('Depreciation policy saved')
  }

  const reset = () => {
    setMethod(DEFAULT_DEPRECIATION_POLICY.method)
    setYears(String(DEFAULT_DEPRECIATION_POLICY.usefulLifeYears))
    setResidual(String(DEFAULT_DEPRECIATION_POLICY.residualPercent))
  }

  // Preview on a GHS 10,000 asset.
  const sample = 10000
  const y = Number(years) || 1
  const r = Number(residual) || 0

  return (
    <div>
      <PageHeader
        title="Asset depreciation policy"
        desc="Configure the default depreciation method, useful life, and residual value applied across your asset register."
      />

      <div className="card max-w-2xl p-5">
        <div className="space-y-4">
          <Field label="Depreciation method">
            <Select value={method} onChange={(e) => setMethod(e.target.value as Policy['method'])} disabled={!canManage}>
              <option value="straight_line">Straight-line (equal annual charge)</option>
              <option value="reducing_balance">Reducing balance (declining charge)</option>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Useful life (years)">
              <Input type="number" min={1} max={50} value={years} onChange={(e) => setYears(e.target.value)} disabled={!canManage} />
            </Field>
            <Field label="Residual value (%)">
              <Input type="number" min={0} max={90} value={residual} onChange={(e) => setResidual(e.target.value)} disabled={!canManage} />
            </Field>
          </div>

          <div className="rounded-xl border border-lime/30 bg-lime/5 p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold"><Info className="size-4 text-lime" /> Preview</p>
            <p className="mt-1 text-mist">
              A {formatGhs(sample)} asset depreciated over {y} year{y === 1 ? '' : 's'} with a {r}% residual value would have a{' '}
              <span className="font-semibold text-inherit">{formatGhs(residualValue(sample, r))}</span> residual and an annual charge of{' '}
              <span className="font-semibold text-inherit">{formatGhs(annualDepreciation(sample, y, r))}</span>.
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="outline" onClick={reset} disabled={!canManage}><RotateCcw className="size-4" /> Reset to defaults</Button>
            <Button onClick={save} disabled={!canManage}><Save className="size-4" /> Save policy</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
