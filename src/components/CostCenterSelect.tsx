import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { Select } from './ui'
import { pickableCostCenters } from '../lib/costCenters'

/**
 * Compact Cost Center picker used on transaction line items. Renders nothing
 * unless the parent decides the company has cost centers enabled (see
 * `costCenterOnLineItems`), so this component is purely a controlled input.
 */
export function CostCenterSelect({
  value,
  onChange,
  disabled,
  className,
  ariaLabel = 'Cost center',
}: {
  value?: string
  onChange: (id: string) => void
  disabled?: boolean
  className?: string
  ariaLabel?: string
}) {
  const { costCenters } = useApp()
  const options = useMemo(() => pickableCostCenters(costCenters), [costCenters])

  return (
    <Select
      value={value ?? ''}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— None —</option>
      {options.map((c) => (
        <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
      ))}
    </Select>
  )
}

/** Human-readable label for a stored cost center id, or an em dash. */
export function costCenterName(costCenters: { id: string; code: string; name: string }[], id?: string): string {
  const c = costCenters.find((x) => x.id === id)
  return c ? `${c.code} · ${c.name}` : '—'
}
