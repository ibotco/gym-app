import { useMemo, type Dispatch, type SetStateAction } from 'react'
import { Field, Input, Select } from './ui'
import type { StaffListFilterValues } from '../lib/staffListFilters'
import { staffDepartmentOptions } from '../lib/staffListFilters'
import type { StaffRecord } from '../types'

interface StaffListFiltersProps {
  staff: StaffRecord[]
  value: StaffListFilterValues
  onChange: Dispatch<SetStateAction<StaffListFilterValues>>
  className?: string
  compact?: boolean
}

/** Consistent employee-master filters for staff-based HR lists. */
export function StaffListFilters({ staff, value, onChange, className = '', compact = false }: StaffListFiltersProps) {
  const departments = useMemo(() => staffDepartmentOptions(staff), [staff])
  const update = (key: keyof StaffListFilterValues, next: string) => {
    onChange((current) => ({ ...current, [key]: next }))
  }

  return (
    <div className={`grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-3 ${compact ? 'items-end' : ''} ${className}`}>
      <Field label="Department" className={compact ? 'min-w-0' : undefined}>
        <Select value={value.department} onChange={(event) => update('department', event.target.value)} aria-label="Filter by department">
          <option value="">All departments</option>
          {departments.map((department) => <option key={department} value={department}>{department}</option>)}
        </Select>
      </Field>
      <Field label="Staff ID / Employee No." className={compact ? 'min-w-0' : undefined}>
        <Input
          value={value.staffId}
          onChange={(event) => update('staffId', event.target.value)}
          placeholder="Search employee identifier"
          aria-label="Filter by staff ID or employee number"
        />
      </Field>
      <Field label="Employee status" className={compact ? 'min-w-0' : undefined}>
        <Select value={value.status} onChange={(event) => update('status', event.target.value as StaffListFilterValues['status'])} aria-label="Filter by employee status">
          <option value="">All employee statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </Select>
      </Field>
    </div>
  )
}
