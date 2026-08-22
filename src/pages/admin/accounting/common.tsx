import { Badge, Select, Field } from '../../../components/ui'
import { ACCOUNT_TYPES, VOUCHER_METHODS } from '../../../lib/accounting'
import type { Account, AccountType, VoucherMethod, VoucherStatus } from '../../../types'

export function statusTone(s: VoucherStatus): 'lime' | 'zinc' | 'rose' {
  if (s === 'posted') return 'lime'
  if (s === 'void') return 'rose'
  return 'zinc'
}

export function VoucherStatusBadge({ status }: { status: VoucherStatus }) {
  return <Badge tone={statusTone(status)}>{status}</Badge>
}

export function AccountSelect({
  accounts,
  value,
  onChange,
  filterType,
  required,
}: {
  accounts: Account[]
  value: string
  onChange: (v: string) => void
  filterType?: AccountType
  required?: boolean
}) {
  const list = filterType ? accounts.filter((a) => a.type === filterType) : accounts
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{required ? 'Select account…' : 'None'}</option>
      {list.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
    </Select>
  )
}

export function MethodSelect({ value, onChange }: { value: VoucherMethod; onChange: (v: VoucherMethod) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as VoucherMethod)}>
      {VOUCHER_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
    </Select>
  )
}

export function StatusSelect({ value, onChange }: { value: VoucherStatus; onChange: (v: VoucherStatus) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as VoucherStatus)}>
      <option value="draft">draft</option>
      <option value="posted">posted</option>
      <option value="void">void</option>
    </Select>
  )
}

export function TypeLabel({ type }: { type: AccountType }) {
  return ACCOUNT_TYPES.find((t) => t.id === type)?.label || type
}

export function AccountField({ accounts, value, onChange, label = 'Account', filterType }: {
  accounts: Account[]; value: string; onChange: (v: string) => void; label?: string; filterType?: AccountType
}) {
  return (
    <Field label={label}>
      <AccountSelect accounts={accounts} value={value} onChange={onChange} filterType={filterType} />
    </Field>
  )
}
