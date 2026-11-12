import { useApp } from '../context/AppContext'
import { Field, Select } from './ui'

/**
 * Company-level switch from Settings → General → App Enables.
 * Fund Accounting ships DISABLED — a company opts in explicitly.
 */
export function useFundAccounting(): boolean {
  const { company } = useApp()
  return company?.fundAccounting === true
}

/**
 * Aplos-style fund selector for vouchers. Renders nothing while the
 * Fund Accounting option is disabled for the company.
 */
export function FundField({ value, onChange }: { value: string; onChange: (fundId: string) => void }) {
  const { funds } = useApp()
  const on = useFundAccounting()
  if (!on) return null
  const active = funds.filter((f) => f.status === 'active')
  return (
    <Field label="Fund">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">No fund</option>
        {active.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </Select>
    </Field>
  )
}
